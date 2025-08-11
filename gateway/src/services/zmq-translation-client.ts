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
}

export interface TranslationCompletedEvent {
  type: 'translation_completed';
  taskId: string;
  result: TranslationResult;
  targetLanguage: string;
  timestamp: number;
}

export interface TranslationErrorEvent {
  type: 'translation_error';
  taskId: string;
  messageId: string;
  error: string;
  conversationId: string;
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
  private pubSocket: zmq.Publisher | null = null;
  private subSocket: zmq.Subscriber | null = null;
  private context: zmq.Context | null = null;
  
  private host: string;
  private pubPort: number;
  private subPort: number;
  
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

  constructor(
    host: string = 'localhost',
    pubPort: number = 5555,
    subPort: number = 5556
  ) {
    super();
    this.host = host;
    this.pubPort = pubPort;
    this.subPort = subPort;
    
    logger.info(`ZMQTranslationClient initialisé: PUB ${host}:${pubPort}, SUB ${host}:${subPort}`);
  }

  async initialize(): Promise<void> {
    try {
      // Créer le contexte ZMQ
      this.context = new zmq.Context();
      
      // Socket PUB pour envoyer les requêtes de traduction
      this.pubSocket = new zmq.Publisher();
      await this.pubSocket.bind(`tcp://${this.host}:${this.pubPort}`);
      
      // Socket SUB pour recevoir les résultats
      this.subSocket = new zmq.Subscriber();
      await this.subSocket.connect(`tcp://${this.host}:${this.subPort}`);
      await this.subSocket.subscribe(''); // S'abonner à tous les messages
      
      // Démarrer l'écoute des résultats
      this._startResultListener();
      
      this.running = true;
      logger.info('✅ ZMQTranslationClient initialisé avec succès');
      
    } catch (error) {
      logger.error(`❌ Erreur initialisation ZMQTranslationClient: ${error}`);
      throw error;
    }
  }

  private async _startResultListener(): Promise<void> {
    if (!this.subSocket) {
      throw new Error('Socket SUB non initialisé');
    }

    logger.info('🎧 Démarrage écoute des résultats de traduction...');

    (async () => {
      try {
        while (this.running) {
          try {
            // Recevoir un message avec timeout
            const [message] = await this.subSocket.receive();
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
        logger.info(`📥 Résultat reçu: ${event.taskId} -> ${event.targetLanguage}`);
        
        // Émettre l'événement de traduction terminée
        this.emit('translationCompleted', {
          taskId: event.taskId,
          result: event.result,
          targetLanguage: event.targetLanguage
        });
        
        // Nettoyer la requête en cours si elle existe
        this.pendingRequests.delete(event.taskId);
        
      } else if (event.type === 'translation_error') {
        this.stats.errors_received++;
        
        if (event.error === 'translation pool full') {
          this.stats.pool_full_rejections++;
          logger.warning(`⚠️ Pool de traduction pleine pour ${event.messageId}`);
        }
        
        logger.error(`❌ Erreur de traduction: ${event.error} pour ${event.messageId}`);
        
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
      logger.error(`❌ Erreur traitement résultat: ${error}`);
    }
  }

  async sendTranslationRequest(request: TranslationRequest): Promise<string> {
    if (!this.pubSocket) {
      throw new Error('Socket PUB non initialisé');
    }

    try {
      const taskId = randomUUID();
      
      // Préparer le message de requête
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
      
      // Envoyer la requête via PUB
      await this.pubSocket.send(JSON.stringify(requestMessage));
      
      // Mettre à jour les statistiques
      this.stats.requests_sent++;
      
      // Stocker la requête en cours pour traçabilité
      this.pendingRequests.set(taskId, {
        request: request,
        timestamp: Date.now()
      });
      
      logger.info(`📤 Requête envoyée: ${taskId} pour ${request.conversationId} (${request.targetLanguages.length} langues)`);
      
      return taskId;
      
    } catch (error) {
      logger.error(`❌ Erreur envoi requête: ${error}`);
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
      if (!this.running || !this.pubSocket || !this.subSocket) {
        return false;
      }
      
      // Test simple d'envoi d'un message de ping
      const pingMessage = {
        type: 'ping',
        timestamp: Date.now()
      };
      
      await this.pubSocket.send(JSON.stringify(pingMessage));
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
      if (this.pubSocket) {
        await this.pubSocket.close();
        this.pubSocket = null;
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
      
      logger.info('✅ ZMQTranslationClient arrêté');
      
    } catch (error) {
      logger.error(`❌ Erreur arrêt ZMQTranslationClient: ${error}`);
    }
  }
}

// Configuration du logging
const logger = {
  info: (message: string) => console.log(`[ZMQ-Client] ${message}`),
  error: (message: string) => console.error(`[ZMQ-Client] ❌ ${message}`),
  warning: (message: string) => console.warn(`[ZMQ-Client] ⚠️ ${message}`)
};
