# 🔍 Code où le Translator fait PUB sur le port 5558

## 📍 **Localisation du Code**

Le code se trouve dans le fichier : `translator/src/services/zmq_server.py`

## 🔧 **1. Configuration du Socket PUB (Port 5558)**

### 📋 **Initialisation du Serveur**

```python
# Ligne 344-345 dans zmq_server.py
class ZMQTranslationServer:
    def __init__(self, 
                 host: str = "localhost",
                 gateway_push_port: int = 5555,  # Port où Translator PULL bind (Gateway PUSH connect ici)
                 gateway_sub_port: int = 5558,   # Port où Translator PUB bind (Gateway SUB connect ici)
                 normal_pool_size: int = 10000,
                 any_pool_size: int = 10000,
                 normal_workers: int = 3,
                 any_workers: int = 2,
                 translation_service=None):
        
        self.host = host
        self.gateway_push_port = gateway_push_port  # Port pour PULL (recevoir commandes)
        self.gateway_sub_port = gateway_sub_port    # Port pour PUB (envoyer réponses)
        self.context = zmq.asyncio.Context()
        
        # Sockets
        self.pull_socket = None  # PULL pour recevoir les commandes de traduction
        self.pub_socket = None   # PUB pour publier les résultats
```

### 🔌 **Création et Binding du Socket PUB**

```python
# Lignes 380-390 dans zmq_server.py
async def initialize(self):
    """Initialise les sockets ZMQ avec architecture PUSH/PULL + PUB/SUB"""
    try:
        # Socket PULL pour recevoir les commandes du Gateway
        self.pull_socket = self.context.socket(zmq.PULL)
        self.pull_socket.bind(f"tcp://{self.host}:{self.gateway_push_port}")
        
        # Socket PUB pour publier les résultats vers le Gateway
        self.pub_socket = self.context.socket(zmq.PUB)
        self.pub_socket.bind(f"tcp://{self.host}:{self.gateway_sub_port}")  # ← PORT 5558
        
        # Petit délai pour établir les connexions ZMQ
        await asyncio.sleep(0.1)
        
        # Démarrer les workers
        self.worker_tasks = await self.pool_manager.start_workers()
        
        logger.info("ZMQTranslationServer initialisé avec succès")
        logger.info(f"🔌 Socket PULL lié au port: {self.host}:{self.gateway_push_port}")
        logger.info(f"🔌 Socket PUB lié au port: {self.host}:{self.gateway_sub_port}")  # ← PORT 5558
```

## 📤 **2. Envoi des Résultats via PUB (Port 5558)**

### 🎯 **Méthode Principale de Publication**

```python
# Lignes 495-530 dans zmq_server.py
async def _publish_translation_result(self, task_id: str, result: dict, target_language: str):
    """Publie un résultat de traduction via PUB vers la gateway"""
    try:
        # LOG DÉTAILLÉ DES OBJETS AVANT ENVOI
        logger.info("🔍 [TRANSLATOR] VÉRIFICATION OBJETS ZMQ AVANT ENVOI PUB:")
        logger.info(f"   📋 self.pub_socket: {self.pub_socket}")
        logger.info(f"   📋 self.pub_socket type: {type(self.pub_socket)}")
        logger.info(f"   📋 Socket PUB fermé?: {self.pub_socket.closed if self.pub_socket else 'N/A'}")
        logger.info(f"   📋 self.context: {self.context}")
        logger.info(f"   📋 self.context term?: {self.context.closed if hasattr(self.context, 'closed') else 'N/A'}")
        
        message = {
            'type': 'translation_completed',
            'taskId': task_id,
            'result': result,
            'targetLanguage': target_language,
            'timestamp': time.time()
        }
        
        logger.info(f"📤 [TRANSLATOR] Préparation envoi résultat vers gateway:")
        logger.info(f"   📋 taskId: {task_id}")
        logger.info(f"   📋 target: {target_language}")
        logger.info(f"   📋 message size: {len(json.dumps(message))} chars")
        logger.info(f"   📋 result: {result}")
        
        # Utiliser le socket PUB configuré pour envoyer à la gateway
        if self.pub_socket:
            logger.info("🔍 [TRANSLATOR] ENVOI VIA PUB SOCKET:")
            logger.info(f"   📋 Socket state avant envoi: {self.pub_socket}")
            
            await self.pub_socket.send(json.dumps(message).encode('utf-8'))  # ← PUB SUR PORT 5558
            
            logger.info("🔍 [TRANSLATOR] VÉRIFICATION APRÈS ENVOI:")
            logger.info(f"   📋 Socket state après envoi: {self.pub_socket}")
            logger.info(f"   📋 Envoi réussi pour taskId: {task_id}")
            logger.info(f"📤 [TRANSLATOR] Résultat envoyé vers gateway: {task_id} -> {target_language}")
        else:
            logger.error("❌ Socket PUB non initialisé")
        
    except Exception as e:
        logger.error(f"Erreur lors de la publication du résultat: {e}")
```

### ❌ **Envoi des Messages d'Erreur**

```python
# Lignes 480-490 dans zmq_server.py
async def _handle_translation_request(self, message: bytes):
    """Traite une requête de traduction reçue via PULL"""
    try:
        # ... traitement de la requête ...
        
        # Si la pool est pleine, envoyer un message d'erreur
        if not success:
            error_message = {
                'type': 'translation_error',
                'taskId': task.task_id,
                'messageId': task.message_id,
                'error': 'translation pool full',
                'conversationId': task.conversation_id
            }
            # Utiliser le socket PUB configuré pour envoyer l'erreur à la gateway
            if self.pub_socket:
                await self.pub_socket.send(json.dumps(error_message).encode('utf-8'))  # ← PUB SUR PORT 5558
                logger.warning(f"Pool pleine, rejet de la tâche {task.task_id}")
            else:
                logger.error("❌ Socket PUB non initialisé pour envoyer l'erreur")
```

## 🔄 **3. Intégration dans le Flux de Traduction**

### 📋 **Appel depuis le Pool Manager**

```python
# Lignes 350-370 dans zmq_server.py
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
                # Publier le résultat via PUB sur le port 5558
                await self._publish_translation_result(task.task_id, result, target_language)
                
            except Exception as e:
                logger.error(f"Erreur de traduction pour {target_language}: {e}")
                # Publier un résultat d'erreur
                error_result = self._create_error_result(task, target_language, str(e))
                await self._publish_translation_result(task.task_id, error_result, target_language)
                
    except Exception as e:
        logger.error(f"Erreur lors du traitement de la tâche {task.task_id}: {e}")
```

## 📊 **4. Format des Messages Publiés**

### ✅ **Message de Succès**

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

### ❌ **Message d'Erreur**

```json
{
  "type": "translation_error",
  "taskId": "uuid-1234-5678-9abc",
  "messageId": "msg-456",
  "error": "translation pool full",
  "conversationId": "conv-789"
}
```

## 🎯 **5. Points Clés**

### 🔍 **Localisation Exacte**
- **Fichier** : `translator/src/services/zmq_server.py`
- **Classe** : `ZMQTranslationServer`
- **Méthode** : `_publish_translation_result()`
- **Ligne** : `await self.pub_socket.send(json.dumps(message).encode('utf-8'))`

### 🔧 **Configuration**
- **Port** : 5558 (configuré dans `gateway_sub_port`)
- **Protocole** : TCP
- **Socket Type** : PUB (Publisher)
- **Binding** : `tcp://localhost:5558`

### 📤 **Déclenchement**
1. **Réception** d'une commande via PULL (port 5555)
2. **Traitement** de la traduction par les workers
3. **Publication** du résultat via PUB (port 5558)
4. **Réception** par la Gateway via SUB (port 5558)

## 🎉 **Conclusion**

Le code de publication sur le port 5558 se trouve dans la méthode `_publish_translation_result()` de la classe `ZMQTranslationServer`. Cette méthode est appelée automatiquement après chaque traduction terminée pour envoyer le résultat à la Gateway via le socket PUB configuré sur le port 5558.
