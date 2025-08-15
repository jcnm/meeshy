/**
 * Client ZMQ haute performance pour communication avec le service de traduction
 * Architecture: PUB/SUB + REQ/REP avec pool de connexions et gestion asynchrone
 */

import { EventEmitter } from 'events';
import * as zmq from 'zeromq';
import { randomUUID } from 'crypto';

// Types pour l'architecture PUB/SUB
export interface TranslationRequest {
  messageId: string;
  text: string;
  sourceLanguage: string;
  targetLanguages: string[];
  conversationId: string;
  modelType?: string;
}

export interface TranslationResult {
  messageId: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidenceScore: number;
  processingTime: number;
  modelType: string;
  workerName?: string;
  error?: string;
  // NOUVELLES INFORMATIONS TECHNIQUES
  translatorModel?: string;  // Modèle ML utilisé
  workerId?: string;        // Worker qui a traité
  poolType?: string;        // Pool utilisée (normal/any)
  translationTime?: number; // Temps de traduction
  queueTime?: number;       // Temps d'attente en queue
  memoryUsage?: number;     // Usage mémoire (MB)
  cpuUsage?: number;        // Usage CPU (%)
  version?: string;         // Version du Translator
}

export interface TranslationCompletedEvent {
  type: 'translation_completed';
  taskId: string;
  result: TranslationResult;
  targetLanguage: string;
  timestamp: number;
  metadata?: any;  // Métadonnées techniques
}

export interface TranslationErrorEvent {
  type: 'translation_error';
  taskId: string;
  messageId: string;
  error: string;
  conversationId: string;
  metadata?: any;  // Métadonnées techniques
}

export type TranslationEvent = TranslationCompletedEvent | TranslationErrorEvent;

export interface ZMQClientStats {
  requests_sent: number;
  results_received: number;
  errors_received: number;
  pool_full_rejections: number;
  avg_response_time: number;
  uptime_seconds: number;
  memory_usage_mb: number;
}

export class ZMQTranslationClient extends EventEmitter {
  private pushSocket: zmq.Push | null = null;  // PUSH pour envoyer commandes
  private subSocket: zmq.Subscriber | null = null;  // SUB pour recevoir réponses
  private context: zmq.Context | null = null;
  
  private host: string;
  private pushPort: number;  // Port pour PUSH (commandes)
  private subPort: number;   // Port pour SUB (réponses)
  
  private running: boolean = false;
  private startTime: number = Date.now();
  
  // Statistiques
  private stats: ZMQClientStats = {
    requests_sent: 0,
    results_received: 0,
    errors_received: 0,
    pool_full_rejections: 0,
    avg_response_time: 0,
    uptime_seconds: 0,
    memory_usage_mb: 0
  };
  
  // Cache des requêtes en cours (pour traçabilité)
  private pendingRequests: Map<string, {
    request: TranslationRequest;
    timestamp: number;
  }> = new Map();

  private processedResults = new Set<string>();

  constructor(
    host: string = process.env.ZMQ_TRANSLATOR_HOST || 'localhost',
    pushPort: number = parseInt(process.env.ZMQ_TRANSLATOR_PUSH_PORT || '5555'),  // Port où Gateway PUSH connect (Translator PULL bind)
    subPort: number = parseInt(process.env.ZMQ_TRANSLATOR_SUB_PORT || '5558')     // Port où Gateway SUB connect (Translator PUB bind)
  ) {
    super();
    this.host = host;
    this.pushPort = pushPort;
    this.subPort = subPort;
    
    logger.info(`[ZMQ-Client] ZMQTranslationClient initialisé: PUSH connect ${host}:${pushPort} (envoi commandes), SUB connect ${host}:${subPort} (réception résultats)`);
  }

  async initialize(): Promise<void> {
    try {
      logger.info(`🔧 [ZMQ-Client] Début initialisation ZMQTranslationClient...`);
      
      // Créer le contexte ZMQ
      this.context = new zmq.Context();
      logger.info(`🔧 [ZMQ-Client] Contexte ZMQ créé`);
      
      // Socket PUSH pour envoyer les commandes de traduction (remplace PUB)
      this.pushSocket = new zmq.Push();
      await this.pushSocket.connect(`tcp://${this.host}:${this.pushPort}`);
      logger.info(`🔧 [ZMQ-Client] Socket PUSH connecté à ${this.host}:${this.pushPort}`);
      
      // Socket SUB pour recevoir les résultats (se connecte au port 5558 du Translator)
      this.subSocket = new zmq.Subscriber();
      await this.subSocket.connect(`tcp://${this.host}:${this.subPort}`);
      await this.subSocket.subscribe(''); // S'abonner à tous les messages
      logger.info(`🔧 [ZMQ-Client] Socket SUB connecté à ${this.host}:${this.subPort}`);
      
      // Démarrer l'écoute des résultats
      logger.info(`🔧 [ZMQ-Client] Démarrage de l'écoute des résultats...`);
      this._startResultListener();
      
      // Vérification de connectivité après un délai
      setTimeout(() => {
        logger.info(`🔍 [ZMQ-Client] Vérification de connectivité...`);
        logger.info(`   📋 Socket PUSH: ${this.pushSocket ? 'Connecté' : 'Non connecté'}`);
        logger.info(`   📋 Socket SUB: ${this.subSocket ? 'Connecté' : 'Non connecté'}`);
        logger.info(`   📋 Running: ${this.running}`);
        logger.info(`   📋 Context: ${this.context ? 'Actif' : 'Inactif'}`);
      }, 2000);
      
      this.running = true;
      logger.info('✅ [ZMQ-Client] ZMQTranslationClient initialisé avec succès');
      logger.info(`🔌 [ZMQ-Client] Socket PUSH connecté: ${this.host}:${this.pushPort} (envoi commandes)`);
      logger.info(`🔌 [ZMQ-Client] Socket SUB connecté: ${this.host}:${this.subPort} (réception résultats)`);
      
    } catch (error) {
      logger.error(`❌ Erreur initialisation ZMQTranslationClient: ${error}`);
      throw error;
    }
  }

  private async _startResultListener(): Promise<void> {
    if (!this.subSocket) {
      throw new Error('Socket SUB non initialisé');
    }

    logger.info('🎧 [ZMQ-Client] Démarrage écoute des résultats de traduction...');

    // Approche simple avec setInterval
    let heartbeatCount = 0;
    
    const checkForMessages = async () => {
      if (!this.running) {
        logger.info('🛑 [ZMQ-Client] Arrêt de l\'écoute - running=false');
        return;
      }

      try {
        // Log périodique pour vérifier que la boucle fonctionne
        if (heartbeatCount % 50 === 0) { // Toutes les 5 secondes
          logger.info(`💓 [ZMQ-Client] Boucle d'écoute active (heartbeat ${heartbeatCount})`);
          
          // LOG DÉTAILLÉ DES OBJETS PÉRIODIQUEMENT
          logger.info('🔍 [GATEWAY] VÉRIFICATION OBJETS ZMQ DANS BOUCLE ÉCOUTE:');
          logger.info(`   📋 this.subSocket: ${this.subSocket}`);
          logger.info(`   📋 this.subSocket type: ${typeof this.subSocket}`);
          logger.info(`   📋 this.running: ${this.running}`);
          logger.info(`   📋 Socket SUB fermé?: ${this.subSocket?.closed || 'N/A'}`);
          logger.info(`   📋 this.context: ${this.context}`);
        }
        heartbeatCount++;

        // Essayer de recevoir un message de manière non-bloquante
        try {
          const messages = await this.subSocket.receive();
          
          if (messages && messages.length > 0) {
            const [message] = messages as Buffer[];
            
            // LOG APRÈS RÉCEPTION
            logger.info('🔍 [GATEWAY] APRÈS RÉCEPTION SUB:');
            logger.info(`   📋 Message reçu (taille): ${message.length} bytes`);
            logger.info(`   📋 Socket SUB state: ${this.subSocket}`);
            logger.info(`📨 [ZMQ-Client] Message reçu dans la boucle (taille: ${message.length} bytes)`);
            
            await this._handleTranslationResult(message);
          }
        } catch (receiveError) {
          // Pas de message disponible ou erreur de réception
          // C'est normal, on continue
        }

      } catch (error) {
        if (this.running) {
          logger.error(`❌ Erreur réception résultat: ${error}`);
        }
      }
    };

    // Démarrer le polling avec setInterval
    logger.info('🔄 [ZMQ-Client] Démarrage polling avec setInterval...');
    const intervalId = setInterval(checkForMessages, 100); // 100ms entre chaque vérification
    
    // Stocker l'interval ID pour pouvoir l'arrêter plus tard
    (this as any).pollingIntervalId = intervalId;
  }

  private async _handleTranslationResult(message: Buffer): Promise<void> {
    try {
      const messageStr = message.toString('utf-8');
      logger.info(`📋 [GATEWAY] Message ZMQ reçu brut: ${messageStr}`);
      
      const event: TranslationEvent = JSON.parse(messageStr);
      logger.info(`📋 [GATEWAY] Message parsé: ${JSON.stringify(event, null, 2)}`);
      
      // Vérifier le type d'événement
      if (event.type === 'translation_completed') {
        const completedEvent = event as TranslationCompletedEvent;
        
        // Utiliser taskId pour la déduplication (permet la retraduction avec un nouveau taskId)
        const resultKey = `${completedEvent.taskId}_${completedEvent.targetLanguage}`;
        
        // Vérifier si ce taskId a déjà été traité (évite les doublons accidentels)
        if (this.processedResults.has(resultKey)) {
          logger.info(`🔄 [GATEWAY] Task déjà traité, ignoré: ${resultKey}`);
          return;
        }
        
        // Marquer ce task comme traité
        this.processedResults.add(resultKey);
        
        // Nettoyer les anciens résultats (garder seulement les 1000 derniers)
        if (this.processedResults.size > 1000) {
          const firstKey = this.processedResults.values().next().value;
          this.processedResults.delete(firstKey);
        }
        
        // VALIDATION COMPLÈTE
        if (!completedEvent.result) {
          logger.error(`❌ [GATEWAY] Message sans résultat: ${JSON.stringify(completedEvent)}`);
          return;
        }
        
        if (!completedEvent.result.messageId) {
          logger.error(`❌ [GATEWAY] Message sans messageId: ${JSON.stringify(completedEvent)}`);
          return;
        }
        
        this.stats.results_received++;
        
        // LOGGING DES INFORMATIONS TECHNIQUES
        logger.info(`🔧 [GATEWAY] Informations techniques reçues:`);
        logger.info(`   📋 Modèle: ${completedEvent.result.translatorModel || 'unknown'}`);
        logger.info(`   📋 Worker: ${completedEvent.result.workerId || 'unknown'}`);
        logger.info(`   📋 Pool: ${completedEvent.result.poolType || 'unknown'}`);
        logger.info(`   📋 Temps traduction: ${completedEvent.result.translationTime || 0}ms`);
        logger.info(`   📋 Temps queue: ${completedEvent.result.queueTime || 0}ms`);
        logger.info(`   📋 Mémoire: ${completedEvent.result.memoryUsage || 0}MB`);
        logger.info(`   📋 CPU: ${completedEvent.result.cpuUsage || 0}%`);
        
        logger.info(`✅ [GATEWAY] Traduction terminée: ${completedEvent.taskId} -> ${completedEvent.targetLanguage} (messageId: ${completedEvent.result.messageId})`);
        
        // Émettre l'événement avec toutes les informations
        this.emit('translationCompleted', {
          taskId: completedEvent.taskId,
          result: completedEvent.result,
          targetLanguage: completedEvent.targetLanguage,
          metadata: completedEvent.metadata || {}
        });
        
        // Nettoyer la requête en cours si elle existe
        this.pendingRequests.delete(completedEvent.taskId);
        
      } else if (event.type === 'translation_error') {
        const errorEvent = event as TranslationErrorEvent;
        this.stats.errors_received++;
        
        if (errorEvent.error === 'translation pool full') {
          this.stats.pool_full_rejections++;
          logger.warning(`⚠️ [GATEWAY] Pool de traduction pleine pour ${errorEvent.messageId}`);
        }
        
        logger.error(`❌ [GATEWAY] Erreur traduction: ${errorEvent.error} pour ${errorEvent.messageId}`);
        logger.error(`🔧 [GATEWAY] Contexte erreur: ${JSON.stringify(errorEvent.metadata || {}, null, 2)}`);
        
        // Émettre l'événement d'erreur avec métadonnées
        this.emit('translationError', {
          taskId: errorEvent.taskId,
          messageId: errorEvent.messageId,
          error: errorEvent.error,
          conversationId: errorEvent.conversationId,
          metadata: errorEvent.metadata || {}
        });
        
        // Nettoyer la requête en cours
        this.pendingRequests.delete(errorEvent.taskId);
      }
      
    } catch (error) {
      logger.error(`❌ [GATEWAY] Erreur traitement message ZMQ: ${error}`);
      logger.error(`📋 [GATEWAY] Message problématique: ${message.toString('utf-8')}`);
    }
  }

  async sendTranslationRequest(request: TranslationRequest): Promise<string> {
    // LOG DÉTAILLÉ DES OBJETS AVANT ENVOI
    logger.info('🔍 [GATEWAY] VÉRIFICATION OBJETS ZMQ AVANT ENVOI PUSH:');
    logger.info(`   📋 this.pushSocket: ${this.pushSocket}`);
    logger.info(`   📋 this.pushSocket type: ${typeof this.pushSocket}`);
    logger.info(`   📋 this.subSocket: ${this.subSocket}`);
    logger.info(`   📋 this.context: ${this.context}`);
    logger.info(`   📋 this.running: ${this.running}`);
    logger.info(`   📋 Socket PUSH fermé?: ${this.pushSocket?.closed || 'N/A'}`);
    logger.info(`   📋 Socket SUB fermé?: ${this.subSocket?.closed || 'N/A'}`);

    if (!this.pushSocket) {
      logger.error('❌ [GATEWAY] Socket PUSH non initialisé lors de la vérification');
      throw new Error('Socket PUSH non initialisé');
    }

    // Test de connectivité avec un ping
    try {
      logger.info('🔍 [GATEWAY] Test de connectivité avec ping...');
      const pingMessage = { type: 'ping', timestamp: Date.now() };
      await this.pushSocket.send(JSON.stringify(pingMessage));
      logger.info('✅ [GATEWAY] Ping envoyé avec succès');
    } catch (error) {
      logger.error(`❌ [GATEWAY] Erreur lors du ping: ${error}`);
    }

    try {
      const taskId = randomUUID();
      
      // Préparer le message de commande
      const requestMessage = {
        taskId: taskId,
        messageId: request.messageId,
        text: request.text,
        sourceLanguage: request.sourceLanguage,
        targetLanguages: request.targetLanguages,
        conversationId: request.conversationId,
        modelType: request.modelType || 'basic',
        timestamp: Date.now()
      };
      
      logger.info('🔍 [GATEWAY] PRÉPARATION ENVOI PUSH:');
      logger.info(`   📋 taskId: ${taskId}`);
      logger.info(`   📋 messageId: ${request.messageId}`);
      logger.info(`   📋 text: "${request.text}"`);
      logger.info(`   📋 sourceLanguage: ${request.sourceLanguage}`);
      logger.info(`   📋 targetLanguages: [${request.targetLanguages.join(', ')}]`);
      logger.info(`   📋 conversationId: ${request.conversationId}`);
      logger.info(`   📋 message size: ${JSON.stringify(requestMessage).length} chars`);
      
      // Envoyer la commande via PUSH (garantit distribution équitable)
      logger.info('🔍 [GATEWAY] ENVOI VIA PUSH SOCKET:');
      logger.info(`   📋 Socket state avant envoi: ${this.pushSocket}`);
      
      await this.pushSocket.send(JSON.stringify(requestMessage));
      
      logger.info('🔍 [GATEWAY] VÉRIFICATION APRÈS ENVOI:');
      logger.info(`   📋 Socket state après envoi: ${this.pushSocket}`);
      logger.info(`   📋 Envoi réussi pour taskId: ${taskId}`);
      
      // Mettre à jour les statistiques
      this.stats.requests_sent++;
      
      // Stocker la requête en cours pour traçabilité
      this.pendingRequests.set(taskId, {
        request: request,
        timestamp: Date.now()
      });
      
      logger.info(`📤 [ZMQ-Client] Commande PUSH envoyée: taskId=${taskId}, conversationId=${request.conversationId}, langues=${request.targetLanguages.length}, message=${JSON.stringify(requestMessage)}`);
      
      return taskId;
      
    } catch (error) {
      logger.error(`❌ Erreur envoi commande PUSH: ${error}`);
      throw error;
    }
  }

  async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    messageId: string,
    conversationId: string,
    modelType: string = 'basic'
  ): Promise<string> {
    const request: TranslationRequest = {
      messageId: messageId,
      text: text,
      sourceLanguage: sourceLanguage,
      targetLanguages: [targetLanguage],
      conversationId: conversationId,
      modelType: modelType
    };
    
    return await this.sendTranslationRequest(request);
  }

  async translateToMultipleLanguages(
    text: string,
    sourceLanguage: string,
    targetLanguages: string[],
    messageId: string,
    conversationId: string,
    modelType: string = 'basic'
  ): Promise<string> {
    const request: TranslationRequest = {
      messageId: messageId,
      text: text,
      sourceLanguage: sourceLanguage,
      targetLanguages: targetLanguages,
      conversationId: conversationId,
      modelType: modelType
    };
    
    return await this.sendTranslationRequest(request);
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.running || !this.pushSocket || !this.subSocket) {
        return false;
      }
      
      // Test simple d'envoi d'un message de ping
      const pingMessage = {
        type: 'ping',
        timestamp: Date.now()
      };
      
      await this.pushSocket.send(JSON.stringify(pingMessage));
      return true;
      
    } catch (error) {
      logger.error(`❌ Health check échoué: ${error}`);
      return false;
    }
  }

  getStats(): ZMQClientStats {
    const uptime = (Date.now() - this.startTime) / 1000;
    
    return {
      ...this.stats,
      uptime_seconds: uptime,
      memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  getPendingRequestsCount(): number {
    return this.pendingRequests.size;
  }

  async close(): Promise<void> {
    logger.info('🛑 Arrêt ZMQTranslationClient...');
    
    this.running = false;
    
    try {
      if (this.pushSocket) {
        await this.pushSocket.close();
        this.pushSocket = null;
      }
      
      if (this.subSocket) {
        await this.subSocket.close();
        this.subSocket = null;
      }
      
      if (this.context) {
        this.context = null;
      }
      
      // Nettoyer les requêtes en cours
      this.pendingRequests.clear();
      
      // Arrêter le polling
      if ((this as any).pollingIntervalId) {
        clearInterval((this as any).pollingIntervalId);
        (this as any).pollingIntervalId = null;
      }

      logger.info('✅ ZMQTranslationClient arrêté');
      
    } catch (error) {
      logger.error(`❌ Erreur arrêt ZMQTranslationClient: ${error}`);
    }
  }

  // Méthode de test pour vérifier la réception
  async testReception(): Promise<void> {
    logger.info('🧪 [ZMQ-Client] Test de réception des messages...');
    
    // Envoyer un ping et attendre la réponse
    try {
      const pingMessage = { type: 'ping', timestamp: Date.now() };
      await this.pushSocket.send(JSON.stringify(pingMessage));
      logger.info('🧪 [ZMQ-Client] Ping envoyé pour test');
      
      // Attendre un peu pour voir si on reçoit quelque chose
      setTimeout(() => {
        logger.info(`🧪 [ZMQ-Client] Test terminé. Messages reçus: ${this.stats.results_received}`);
        logger.info(`🧪 [ZMQ-Client] Heartbeats: ${this.stats.uptime_seconds}s`);
        logger.info(`🧪 [ZMQ-Client] Socket SUB état: ${this.subSocket ? 'Connecté' : 'Non connecté'}`);
        logger.info(`🧪 [ZMQ-Client] Running: ${this.running}`);
      }, 3000);
      
    } catch (error) {
      logger.error(`❌ [ZMQ-Client] Erreur test réception: ${error}`);
    }
  }
}

// Configuration du logging
const logger = {
  info: (message: string) => console.log(`[GATEWAY] ${message}`),
  error: (message: string) => console.error(`[GATEWAY] ❌ ${message}`),
  warning: (message: string) => console.warn(`[GATEWAY] ⚠️ ${message}`)
};