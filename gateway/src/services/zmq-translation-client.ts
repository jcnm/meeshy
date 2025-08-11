/**
 * Client ZMQ haute performance pour communication avec le service de traduction
 * Architecture: PUB/SUB + REQ/REP avec pool de connexions et gestion asynchrone
 */

import * as zmq from 'zeromq';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

interface TranslationRequest {
  messageId: string;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  modelType?: string;
  conversationId?: string;
  participantIds?: string[];
  requestType?: string;
}

interface TranslationResponse {
  taskId: string;
  messageId: string;
  translatedText: string;
  detectedSourceLanguage: string;
  status: number;
  metadata?: {
    confidenceScore: number;
    fromCache: boolean;
    modelUsed: string;
    processingTimeMs?: number;
    workerId?: number;
  };
}

interface TranslationTask {
  taskId: string;
  messageId: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  estimatedProcessingTime: number;
  createdAt: number;
  resolve: (result: TranslationResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface ServerStats {
  requests_received: number;
  translations_completed: number;
  errors: number;
  avg_processing_time: number;
  queue_size: number;
  active_tasks: number;
  cached_results: number;
}

export class ZMQTranslationClient extends EventEmitter {
  private reqSocket: zmq.Request | null = null;
  private subSocket: zmq.Subscriber | null = null;
  private isInitialized = false;
  private readonly port: number;
  private readonly host: string;
  private readonly timeout: number;
  private readonly maxConcurrentRequests: number;
  
  // Pool de connexions pour les requêtes multiples
  private connectionPool: zmq.Request[] = [];
  private poolSize: number;
  private poolIndex = 0;
  
  // Gestion des tâches
  private pendingTasks: Map<string, TranslationTask> = new Map();
  private taskResults: Map<string, TranslationResponse> = new Map();
  
  // Statistiques
  private stats = {
    requestsSent: 0,
    responsesReceived: 0,
    errors: 0,
    avgLatency: 0
  };
  
  constructor(
    port?: number, 
    host?: string,
    timeout?: number,
    maxConcurrentRequests: number = 50,
    poolSize: number = 5
  ) {
    super();
    
    console.log(`🔍 Configuration ZMQ Client haute performance:`);
    console.log(`   ZMQ_TRANSLATOR_HOST: "${process.env.ZMQ_TRANSLATOR_HOST}"`);
    console.log(`   ZMQ_TRANSLATOR_PORT: "${process.env.ZMQ_TRANSLATOR_PORT}"`);
    console.log(`   ZMQ_TIMEOUT: "${process.env.ZMQ_TIMEOUT}"`);
    
    this.port = port ?? parseInt(process.env.ZMQ_TRANSLATOR_PORT || '5555', 10);
    this.host = host ?? (process.env.ZMQ_TRANSLATOR_HOST || 'translator');
    this.timeout = timeout ?? parseInt(process.env.ZMQ_TIMEOUT || '30000', 10);
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.poolSize = poolSize;
    
    console.log(`🔧 Configuration finale:`);
    console.log(`   🌐 Host: ${this.host}`);
    console.log(`   🔌 Port: ${this.port}`);
    console.log(`   ⏱️  Timeout: ${this.timeout}ms`);
    console.log(`   🚀 Max concurrent: ${this.maxConcurrentRequests}`);
    console.log(`   🏊 Pool size: ${this.poolSize}`);
  }
  
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initialisation du client ZMQ haute performance...');
      
      // Vérifier la configuration
      if (process.env.ZMQ_TRANSLATOR_HOST && this.host === 'localhost') {
        this.host = process.env.ZMQ_TRANSLATOR_HOST;
        console.log(`⚠️  Host mis à jour: ${this.host}`);
      }
      
      // 1. Créer le pool de connexions REQ
      await this._initializeConnectionPool();
      
      // 2. Créer le socket SUB pour les notifications
      await this._initializeSubscriber();
      
      // 3. Démarrer l'écoute des notifications
      this._startNotificationListener();
      
      this.isInitialized = true;
      console.log(`✅ Client ZMQ haute performance initialisé`);
      console.log(`   📥 REQ/REP: tcp://${this.host}:${this.port}`);
      console.log(`   📤 PUB/SUB: tcp://${this.host}:${this.port + 1}`);
      console.log(`   🏊 Pool: ${this.poolSize} connexions`);
      
    } catch (error) {
      console.error('❌ Erreur initialisation client ZMQ:', error);
      throw error;
    }
  }
  
  private async _initializeConnectionPool(): Promise<void> {
    console.log(`🏊 Initialisation du pool de connexions (${this.poolSize})...`);
    
    for (let i = 0; i < this.poolSize; i++) {
      const socket = new zmq.Request();
      socket.receiveTimeout = this.timeout;
      socket.sendTimeout = this.timeout;
      socket.setsockopt(zmq.LINGER, 1000);
      
      const zmqUrl = `tcp://${this.host}:${this.port}`;
      await socket.connect(zmqUrl);
      
      this.connectionPool.push(socket);
      console.log(`   ✅ Connexion ${i + 1}/${this.poolSize} établie`);
    }
    
    // Socket principal pour les requêtes simples
    this.reqSocket = this.connectionPool[0];
  }
  
  private async _initializeSubscriber(): Promise<void> {
    console.log('📡 Initialisation du subscriber pour notifications...');
    
    this.subSocket = new zmq.Subscriber();
    this.subSocket.setsockopt(zmq.LINGER, 1000);
    
    const subUrl = `tcp://${this.host}:${this.port + 1}`;
    await this.subSocket.connect(subUrl);
    
    // S'abonner à tous les messages
    await this.subSocket.subscribe('');
    
    console.log(`✅ Subscriber connecté sur ${subUrl}`);
  }
  
  private _startNotificationListener(): void {
    console.log('👂 Démarrage de l\'écoute des notifications...');
    
    const listenForNotifications = async () => {
      while (this.isInitialized && this.subSocket) {
        try {
          const [message] = await this.subSocket.receive();
          await this._handleNotification(message);
        } catch (error) {
          if (this.isInitialized) {
            console.error('❌ Erreur écoute notifications:', error);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
    };
    
    // Démarrer l'écoute en arrière-plan
    setImmediate(listenForNotifications);
  }
  
  private async _handleNotification(message: Buffer): Promise<void> {
    try {
      const notificationText = message.toString('utf-8');
      const notification = JSON.parse(notificationText);
      
      if (notification.type === 'translation_completed') {
        const taskId = notification.taskId;
        const result = notification.result;
        
        console.log(`📥 Notification reçue pour tâche ${taskId}`);
        
        // Stocker le résultat
        this.taskResults.set(taskId, result);
        
        // Résoudre la promesse en attente
        const pendingTask = this.pendingTasks.get(taskId);
        if (pendingTask) {
          clearTimeout(pendingTask.timeout);
          this.pendingTasks.delete(taskId);
          pendingTask.resolve(result);
          
          this.stats.responsesReceived++;
          this._updateAvgLatency(Date.now() - pendingTask.createdAt);
        }
        
        // Émettre l'événement
        this.emit('translationCompleted', { taskId, result });
      }
      
    } catch (error) {
      console.error('❌ Erreur traitement notification:', error);
    }
  }
  
  async translateText(request: TranslationRequest): Promise<TranslationResponse> {
    if (!this.isInitialized) {
      throw new Error('Client ZMQ non initialisé');
    }
    
    if (this.pendingTasks.size >= this.maxConcurrentRequests) {
      throw new Error(`Limite de requêtes concurrentes atteinte (${this.maxConcurrentRequests})`);
    }
    
    const taskId = randomUUID();
    const messageId = request.messageId || randomUUID();
    
    console.log(`🔄 DÉBUT TRADUCTION HAUTE PERFORMANCE:`);
    console.log(`   🆔 Task ID: ${taskId}`);
    console.log(`   📝 Texte: "${request.text}"`);
    console.log(`   🌐 ${request.sourceLanguage} → ${request.targetLanguage}`);
    console.log(`   📏 Longueur: ${request.text.length} caractères`);
    
    return new Promise<TranslationResponse>((resolve, reject) => {
      // Créer la requête JSON
      const jsonRequest = {
        messageId: messageId,
        text: request.text,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        modelType: request.modelType || 'basic',
        conversationId: request.conversationId,
        participantIds: request.participantIds,
        requestType: request.requestType || 'direct_translation'
      };
      
      // Sérialiser
      const requestBuffer = Buffer.from(JSON.stringify(jsonRequest), 'utf-8');
      
      // Créer la tâche
      const task: TranslationTask = {
        taskId,
        messageId,
        status: 'queued',
        estimatedProcessingTime: this._estimateProcessingTime(request.text, request.modelType || 'basic'),
        createdAt: Date.now(),
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.pendingTasks.delete(taskId);
          reject(new Error(`Timeout après ${this.timeout}ms pour tâche ${taskId}`));
        }, this.timeout)
      };
      
      // Ajouter à la liste des tâches en attente
      this.pendingTasks.set(taskId, task);
      
      // Envoyer la requête via le pool de connexions
      this._sendRequest(requestBuffer, taskId).catch(error => {
        this.pendingTasks.delete(taskId);
        clearTimeout(task.timeout);
        reject(error);
      });
      
      this.stats.requestsSent++;
    });
  }
  
  private async _sendRequest(requestBuffer: Buffer, taskId: string): Promise<void> {
    // Sélectionner une connexion du pool (round-robin)
    const socket = this.connectionPool[this.poolIndex % this.poolSize];
    this.poolIndex++;
    
    try {
      console.log(`📤 Envoi requête ${taskId} via connexion ${this.poolIndex % this.poolSize}`);
      
      await socket.send(requestBuffer);
      
      // Attendre la réponse immédiate (taskId)
      const [responseBuffer] = await socket.receive();
      const responseText = responseBuffer.toString('utf-8');
      const response = JSON.parse(responseText);
      
      console.log(`📥 Réponse reçue pour ${taskId}:`, response);
      
      if (response.taskId === taskId) {
        // Mettre à jour le statut de la tâche
        const task = this.pendingTasks.get(taskId);
        if (task) {
          task.status = 'processing';
        }
      } else {
        throw new Error(`TaskId mismatch: attendu ${taskId}, reçu ${response.taskId}`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur envoi requête ${taskId}:`, error);
      throw error;
    }
  }
  
  async translateToMultipleLanguages(
    text: string, 
    sourceLanguage: string, 
    targetLanguages: string[],
    modelType?: 'basic' | 'medium' | 'premium'
  ): Promise<TranslationResponse[]> {
    console.log(`🌍 Traduction multi-langues: ${targetLanguages.join(', ')}`);
    
    const promises = targetLanguages.map(targetLang => 
      this.translateText({
        messageId: randomUUID(),
        text,
        sourceLanguage,
        targetLanguage: targetLang,
        modelType
      })
    );
    
    try {
      const results = await Promise.allSettled(promises);
      
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`❌ Erreur traduction vers ${targetLanguages[index]}:`, result.reason);
          return {
            taskId: randomUUID(),
            messageId: randomUUID(),
            translatedText: text,
            detectedSourceLanguage: sourceLanguage,
            status: 0,
            metadata: {
              confidenceScore: 0,
              fromCache: false,
              modelUsed: 'error'
            }
          };
        }
      });
    } catch (error) {
      console.error('❌ Erreur traduction multi-langues:', error);
      throw error;
    }
  }
  
  async getTaskResult(taskId: string): Promise<TranslationResponse | null> {
    return this.taskResults.get(taskId) || null;
  }
  
  async getStats(): Promise<ServerStats> {
    try {
      // Demander les stats au serveur
      const statsRequest = {
        messageId: 'stats-request',
        text: 'stats',
        sourceLanguage: 'en',
        targetLanguage: 'en',
        requestType: 'stats_request'
      };
      
      const requestBuffer = Buffer.from(JSON.stringify(statsRequest), 'utf-8');
      await this.reqSocket!.send(requestBuffer);
      
      const [responseBuffer] = await this.reqSocket!.receive();
      const response = JSON.parse(responseBuffer.toString('utf-8'));
      
      return response.stats || {};
    } catch (error) {
      console.error('❌ Erreur récupération stats:', error);
      return {
        requests_received: 0,
        translations_completed: 0,
        errors: 0,
        avg_processing_time: 0,
        queue_size: 0,
        active_tasks: 0,
        cached_results: 0
      };
    }
  }
  
  getClientStats() {
    return {
      ...this.stats,
      pendingTasks: this.pendingTasks.size,
      cachedResults: this.taskResults.size,
      poolSize: this.poolSize,
      isInitialized: this.isInitialized
    };
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.translateText({
        messageId: 'health-check',
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      });
      
      return response.status === 1;
    } catch (error) {
      console.error('❌ Health check ZMQ échoué:', error);
      return false;
    }
  }
  
  private _estimateProcessingTime(text: string, modelType: string): number {
    const baseTime = text.length * 2;
    
    switch (modelType) {
      case 'basic':
        return Math.min(baseTime, 1000);
      case 'medium':
        return Math.min(baseTime * 2, 2000);
      case 'premium':
        return Math.min(baseTime * 3, 5000);
      default:
        return Math.min(baseTime, 1000);
    }
  }
  
  private _updateAvgLatency(newLatency: number): void {
    const total = this.stats.responsesReceived;
    if (total > 0) {
      this.stats.avgLatency = (
        (this.stats.avgLatency * (total - 1) + newLatency) / total
      );
    } else {
      this.stats.avgLatency = newLatency;
    }
  }
  
  getPredictedModelType(text: string): 'basic' | 'medium' | 'premium' {
    const length = text.length;
    if (length < 20) return 'basic';
    if (length <= 100) return 'medium';
    return 'premium';
  }
  
  getConfiguration() {
    return {
      host: this.host,
      port: this.port,
      timeout: this.timeout,
      maxConcurrentRequests: this.maxConcurrentRequests,
      poolSize: this.poolSize,
      isInitialized: this.isInitialized
    };
  }
  
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    if (!this.isInitialized) {
      return { success: false, error: 'Client non initialisé' };
    }
    
    const startTime = Date.now();
    try {
      const result = await this.translateText({
        messageId: 'connection-test',
        text: 'Hi',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        modelType: 'basic'
      });
      
      const latency = Date.now() - startTime;
      console.log(`✅ Test de connexion ZMQ réussi (${latency}ms)`);
      return { success: result.status === 1, latency };
      
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Test de connexion ZMQ échoué après ${latency}ms:`, error);
      return { success: false, latency, error: errorMessage };
    }
  }
  
  async close(): Promise<void> {
    console.log('🛑 Fermeture du client ZMQ haute performance...');
    
    this.isInitialized = false;
    
    // Nettoyer les tâches en attente
    for (const [taskId, task] of this.pendingTasks) {
      clearTimeout(task.timeout);
      task.reject(new Error('Client fermé'));
    }
    this.pendingTasks.clear();
    
    // Fermer les connexions du pool
    for (const socket of this.connectionPool) {
      await socket.close();
    }
    this.connectionPool = [];
    
    // Fermer le subscriber
    if (this.subSocket) {
      await this.subSocket.close();
      this.subSocket = null;
    }
    
    console.log('✅ Client ZMQ haute performance fermé');
  }
}
