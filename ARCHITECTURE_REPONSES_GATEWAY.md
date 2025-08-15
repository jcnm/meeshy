# 🔄 Architecture des Réponses vers la Gateway

## 📊 Vue d'ensemble

Le système de traduction utilise une architecture **PUB/SUB + PUSH/PULL** pour la communication entre le Translator et la Gateway. Voici comment les réponses sont renvoyées :

## 🏗️ Architecture ZMQ

### 🔄 Flux de Communication

```
┌─────────────────┐    PUSH     ┌─────────────────┐    PUB      ┌─────────────────┐
│     Gateway     │ ──────────► │    Translator   │ ──────────► │     Gateway     │
│                 │ (Commandes) │                 │ (Réponses)  │                 │
└─────────────────┘             └─────────────────┘             └─────────────────┘
        │                                │                                │
        │                                │                                │
        │                                │                                │
        ▼                                ▼                                ▼
   PUSH Socket                      PULL Socket                    SUB Socket
   (Port 5555)                      (Port 5555)                    (Port 5558)
```

### 📡 Ports de Communication

| Composant | Socket | Port | Direction | Usage |
|-----------|--------|------|-----------|-------|
| **Gateway** | PUSH | 5555 | Gateway → Translator | Envoi des commandes de traduction |
| **Translator** | PULL | 5555 | Gateway → Translator | Réception des commandes |
| **Translator** | PUB | 5558 | Translator → Gateway | Envoi des résultats |
| **Gateway** | SUB | 5558 | Translator → Gateway | Réception des résultats |

## 🔄 Processus de Réponse

### 1️⃣ Réception de la Commande (Translator)

```python
# Dans le Translator (zmq_server.py)
async def _handle_translation_request(self, message: bytes):
    """Traite une requête de traduction reçue via PULL"""
    try:
        request_data = json.loads(message.decode('utf-8'))
        
        # Créer la tâche de traduction
        task = TranslationTask(
            task_id=str(uuid.uuid4()),
            message_id=request_data.get('messageId'),
            text=request_data.get('text'),
            source_language=request_data.get('sourceLanguage', 'fr'),
            target_languages=request_data.get('targetLanguages', []),
            conversation_id=request_data.get('conversationId', 'unknown'),
            model_type=request_data.get('modelType', 'basic')
        )
        
        # Enfiler la tâche dans la pool appropriée
        success = await self.pool_manager.enqueue_task(task)
        
    except Exception as e:
        logger.error(f"Erreur lors du traitement de la requête: {e}")
```

### 2️⃣ Traitement de la Traduction

```python
# Dans le Translator (zmq_server.py)
async def _process_translation_task(self, task: TranslationTask, worker_name: str):
    """Traite une tâche de traduction avec traduction parallèle"""
    try:
        # Lancer les traductions en parallèle
        translation_tasks = []
        
        for target_language in task.target_languages:
            translation_task = asyncio.create_task(
                self._translate_single_language(task, target_language, worker_name)
            )
            translation_tasks.append((target_language, translation_task))
        
        # Attendre toutes les traductions
        for target_language, translation_task in translation_tasks:
            try:
                result = await translation_task
                # Publier le résultat via PUB
                await self._publish_translation_result(task.task_id, result, target_language)
                
            except Exception as e:
                logger.error(f"Erreur de traduction pour {target_language}: {e}")
                # Publier un résultat d'erreur
                error_result = self._create_error_result(task, target_language, str(e))
                await self._publish_translation_result(task.task_id, error_result, target_language)
                
    except Exception as e:
        logger.error(f"Erreur lors du traitement de la tâche {task.task_id}: {e}")
```

### 3️⃣ Envoi de la Réponse (Translator)

```python
# Dans le Translator (zmq_server.py)
async def _publish_translation_result(self, task_id: str, result: dict, target_language: str):
    """Publie un résultat de traduction via PUB vers la gateway"""
    try:
        message = {
            'type': 'translation_completed',
            'taskId': task_id,
            'result': result,
            'targetLanguage': target_language,
            'timestamp': time.time()
        }
        
        # Utiliser le socket PUB configuré pour envoyer à la gateway
        if self.pub_socket:
            await self.pub_socket.send(json.dumps(message).encode('utf-8'))
            logger.info(f"📤 [TRANSLATOR] Résultat envoyé vers gateway: {task_id} -> {target_language}")
        else:
            logger.error("❌ Socket PUB non initialisé")
            
    except Exception as e:
        logger.error(f"Erreur lors de la publication du résultat: {e}")
```

### 4️⃣ Réception de la Réponse (Gateway)

```typescript
// Dans la Gateway (zmq-translation-client.ts)
private async _startResultListener(): Promise<void> {
    logger.info('🎧 [ZMQ-Client] Démarrage écoute des résultats de traduction...');

    (async () => {
        try {
            while (this.running) {
                try {
                    // Recevoir un message avec timeout
                    const [message] = await this.subSocket.receive();
                    
                    logger.info(`📨 [ZMQ-Client] Message reçu (taille: ${message.length} bytes)`);
                    
                    await this._handleTranslationResult(message);
                    
                } catch (error) {
                    if (this.running) {
                        logger.error(`❌ Erreur réception résultat: ${error}`);
                    }
                    break;
                }
            }
        } catch (error) {
            logger.error(`❌ Erreur boucle écoute résultats: ${error}`);
        }
    })();
}

private async _handleTranslationResult(message: Buffer): Promise<void> {
    try {
        const messageStr = message.toString('utf-8');
        const event: TranslationEvent = JSON.parse(messageStr);
        
        this.stats.results_received++;
        
        if (event.type === 'translation_completed') {
            logger.info(`✅ [ZMQ-Client] Traduction terminée: ${event.taskId} -> ${event.targetLanguage}`);
            
            // Émettre l'événement de traduction terminée
            this.emit('translationCompleted', {
                taskId: event.taskId,
                result: event.result,
                targetLanguage: event.targetLanguage
            });
            
            // Nettoyer la requête en cours
            this.pendingRequests.delete(event.taskId);
            
        } else if (event.type === 'translation_error') {
            this.stats.errors_received++;
            
            logger.error(`❌ [ZMQ-Client] Erreur de traduction: ${event.error} pour ${event.messageId}`);
            
            // Émettre l'événement d'erreur
            this.emit('translationError', {
                taskId: event.taskId,
                messageId: event.messageId,
                error: event.error,
                conversationId: event.conversationId
            });
            
            // Nettoyer la requête en cours
            this.pendingRequests.delete(event.taskId);
        }
        
    } catch (error) {
        logger.error(`❌ [ZMQ-Client] Erreur traitement résultat: ${error}`);
    }
}
```

## 📋 Format des Messages

### 📤 Commande envoyée par la Gateway

```json
{
  "taskId": "uuid-1234-5678-9abc",
  "messageId": "msg-456",
  "text": "Bonjour tout le monde",
  "sourceLanguage": "fr",
  "targetLanguages": ["en", "es", "de"],
  "conversationId": "conv-789",
  "modelType": "basic",
  "timestamp": 1640995200000
}
```

### 📥 Réponse envoyée par le Translator

```json
{
  "type": "translation_completed",
  "taskId": "uuid-1234-5678-9abc",
  "result": {
    "messageId": "msg-456",
    "translatedText": "Hello everyone",
    "sourceLanguage": "fr",
    "targetLanguage": "en",
    "confidenceScore": 0.95,
    "processingTime": 0.123,
    "modelType": "basic",
    "workerName": "normal_worker_0"
  },
  "targetLanguage": "en",
  "timestamp": 1640995200123
}
```

### ❌ Message d'erreur

```json
{
  "type": "translation_error",
  "taskId": "uuid-1234-5678-9abc",
  "messageId": "msg-456",
  "error": "translation pool full",
  "conversationId": "conv-789"
}
```

## 🔧 Configuration des Sockets

### Translator (Côté Serveur)

```python
# Initialisation des sockets
async def initialize(self):
    """Initialise les sockets ZMQ avec architecture PUSH/PULL + PUB/SUB"""
    try:
        # Socket PULL pour recevoir les commandes du Gateway
        self.pull_socket = self.context.socket(zmq.PULL)
        self.pull_socket.bind(f"tcp://{self.host}:{self.gateway_push_port}")
        
        # Socket PUB pour publier les résultats vers le Gateway
        self.pub_socket = self.context.socket(zmq.PUB)
        self.pub_socket.bind(f"tcp://{self.host}:{self.gateway_sub_port}")
        
        logger.info(f"🔌 Socket PULL lié au port: {self.host}:{self.gateway_push_port}")
        logger.info(f"🔌 Socket PUB lié au port: {self.host}:{self.gateway_sub_port}")
        
    except Exception as e:
        logger.error(f"Erreur lors de l'initialisation: {e}")
        raise
```

### Gateway (Côté Client)

```typescript
async initialize(): Promise<void> {
    try {
        // Créer le contexte ZMQ
        this.context = new zmq.Context();
        
        // Socket PUSH pour envoyer les commandes de traduction
        this.pushSocket = new zmq.Push();
        await this.pushSocket.connect(`tcp://${this.host}:${this.pushPort}`);
        
        // Socket SUB pour recevoir les résultats
        this.subSocket = new zmq.Subscriber();
        await this.subSocket.connect(`tcp://${this.host}:${this.subPort}`);
        await this.subSocket.subscribe(''); // S'abonner à tous les messages
        
        // Démarrer l'écoute des résultats
        this._startResultListener();
        
        this.running = true;
        logger.info(`🔌 [ZMQ-Client] Socket PUSH connecté: ${this.host}:${this.pushPort}`);
        logger.info(`🔌 [ZMQ-Client] Socket SUB connecté: ${this.host}:${this.subPort}`);
        
    } catch (error) {
        logger.error(`❌ Erreur initialisation ZMQTranslationClient: ${error}`);
        throw error;
    }
}
```

## 🎯 Avantages de cette Architecture

### ✅ Performance
- **Asynchrone** : Les réponses sont envoyées dès qu'elles sont prêtes
- **Parallèle** : Plusieurs traductions peuvent être traitées simultanément
- **Non-bloquant** : La Gateway n'attend pas les réponses

### ✅ Fiabilité
- **PUB/SUB** : Les messages sont distribués à tous les abonnés
- **PUSH/PULL** : Distribution équitable des tâches entre les workers
- **Gestion d'erreurs** : Messages d'erreur dédiés

### ✅ Scalabilité
- **Multi-workers** : Plusieurs workers peuvent traiter les traductions
- **Pool de connexions** : Gestion efficace des ressources
- **Cache** : Réduction de la charge de traduction

## 🔍 Monitoring et Debugging

### 📊 Statistiques Collectées

```typescript
interface ZMQClientStats {
  requests_sent: number;        // Nombre de requêtes envoyées
  results_received: number;     // Nombre de résultats reçus
  errors_received: number;      // Nombre d'erreurs reçues
  pool_full_rejections: number; // Nombre de rejets (pool pleine)
  avg_response_time: number;    // Temps de réponse moyen
  uptime_seconds: number;       // Temps de fonctionnement
  memory_usage_mb: number;      // Utilisation mémoire
}
```

### 📝 Logs Détaillés

```typescript
// Logs d'envoi
logger.info(`📤 [ZMQ-Client] Commande PUSH envoyée: taskId=${taskId}`);

// Logs de réception
logger.info(`📥 [ZMQ-Client] Résultat ZMQ reçu: type=${event.type}`);

// Logs d'erreur
logger.error(`❌ [ZMQ-Client] Erreur de traduction: ${event.error}`);
```

## 🎉 Conclusion

L'architecture de communication entre le Translator et la Gateway est **robuste, performante et scalable** :

1. **📤 Envoi** : Gateway → Translator via PUSH/PULL (port 5555)
2. **🔄 Traitement** : Translator traite les traductions en parallèle
3. **📥 Réponse** : Translator → Gateway via PUB/SUB (port 5558)
4. **📡 Distribution** : Gateway distribue les résultats aux clients

Cette architecture garantit une **communication fiable et efficace** entre les composants du système de traduction.
