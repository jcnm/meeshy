/**
 * Service de traduction optimisé avec queue de priorités et chargement intelligent
 * Implémente la stratégie de traduction multi-niveaux pour Meeshy
 */

import type {
  TranslationQueue,
  TranslationTask,
  TranslationPriority,
  MessageComplexity,
  UserTranslationPreferences,
  OptimizationEvent,
  OptimizationEventData
} from '@/types/translation-optimization';
import type { Message, User } from '@/types';
import type { TranslationModelType } from '@/lib/simplified-model-config';
import { HuggingFaceTranslationService } from '@/services/huggingface-translation';
import { hierarchicalCache } from './hierarchical-cache.service';

/**
 * Service principal de traduction optimisée
 */
export class OptimizedTranslationService {
  private static instance: OptimizedTranslationService;
  
  // Services externes
  private translationService: HuggingFaceTranslationService;
  private cacheService = hierarchicalCache;
  
  // Queue de traductions avec priorités
  private translationQueue: TranslationQueue = {
    CRITICAL: [],
    HIGH: [],
    NORMAL: [],
    LOW: []
  };

  // État du service
  private isProcessingQueue = false;
  private batchProcessor: NodeJS.Timeout | null = null;
  private performanceMetrics = {
    totalTranslations: 0,
    successfulTranslations: 0,
    failedTranslations: 0,
    averageProcessingTime: 0,
    cacheHitRate: 0,
    queueProcessingRate: 0
  };

  // Configuration
  private config = {
    batchSize: 5,
    batchInterval: 200, // ms
    maxConcurrentTranslations: 3,
    retryAttempts: 3,
    retryDelay: 1000, // ms
    cacheEnabled: true,
    backgroundProcessing: true
  };

  // Gestionnaires d'événements
  private eventListeners = new Map<OptimizationEvent, Array<(data: OptimizationEventData) => void>>();

  static getInstance(): OptimizedTranslationService {
    if (!OptimizedTranslationService.instance) {
      OptimizedTranslationService.instance = new OptimizedTranslationService();
    }
    return OptimizedTranslationService.instance;
  }

  private constructor() {
    this.translationService = HuggingFaceTranslationService.getInstance();
    this.initialize();
  }

  // ================= INITIALISATION =================

  private async initialize(): Promise<void> {
    console.log('🚀 Initialisation du service de traduction optimisé...');
    
    try {
      // Démarrer le processeur de queue
      this.startQueueProcessor();
      
      // Écouter les événements de cache
      this.setupCacheEventListeners();
      
      console.log('✅ Service de traduction optimisé initialisé');
      this.emitEvent('TRANSLATION_BATCH_COMPLETE', { initialized: true });
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation du service de traduction:', error);
    }
  }

  private setupCacheEventListeners(): void {
    this.cacheService.addEventListener('CACHE_WARM_START', () => {
      console.log('🔄 Cache réchauffé - activation du traitement en arrière-plan');
      this.config.backgroundProcessing = true;
    });
  }

  // ================= API PRINCIPALE =================

  /**
   * Traduire un message avec priorité automatique
   */
  async translateMessage(
    message: Message, 
    targetLanguage: string, 
    user: User,
    priority?: TranslationPriority
  ): Promise<string> {
    // Générer la clé de cache
    const cacheKey = this.generateCacheKey(message.content, message.originalLanguage, targetLanguage);
    
    // Vérifier le cache en premier
    if (this.config.cacheEnabled) {
      const cachedTranslation = await this.getCachedTranslation(cacheKey);
      if (cachedTranslation) {
        console.log(`🔄 Traduction trouvée en cache pour message ${message.id}`);
        this.performanceMetrics.cacheHitRate++;
        return cachedTranslation;
      }
    }

    // Déterminer la priorité si non spécifiée
    const translationPriority = priority || this.calculatePriority(message, user);
    
    // Créer la tâche de traduction
    const task: TranslationTask = {
      id: `${message.id}_${targetLanguage}_${Date.now()}`,
      messageId: message.id,
      conversationId: message.conversationId,
      content: message.content,
      sourceLanguage: message.originalLanguage,
      targetLanguage,
      priority: translationPriority,
      complexity: this.analyzeComplexity(message.content),
      estimatedTime: this.estimateTranslationTime(message.content),
      retryCount: 0,
      maxRetries: this.config.retryAttempts,
      createdAt: new Date(),
      userId: user.id,
      isVisible: true, // À déterminer selon le contexte
      isLastMessage: false, // À déterminer selon le contexte
      userPreferences: this.extractUserPreferences(user)
    };

    // Traduction immédiate pour les priorités critiques et élevées
    if (translationPriority === 'CRITICAL' || translationPriority === 'HIGH') {
      return this.executeTranslationTask(task);
    }

    // Ajouter à la queue pour traitement en arrière-plan
    this.addToQueue(task);
    
    // Retourner le contenu original en attendant
    return message.content;
  }

  /**
   * Traduire plusieurs messages par batch
   */
  async translateMessagesBatch(
    messages: Message[], 
    targetLanguage: string, 
    user: User
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    console.log(`🔄 Traduction par batch de ${messages.length} messages vers ${targetLanguage}`);
    
    // Grouper par priorité
    const priorityGroups = this.groupMessagesByPriority(messages, user);
    
    // Traiter les priorités élevées immédiatement
    for (const message of [...priorityGroups.CRITICAL, ...priorityGroups.HIGH]) {
      try {
        const translation = await this.translateMessage(message, targetLanguage, user);
        results.set(message.id, translation);
      } catch (error) {
        console.error(`❌ Erreur traduction message ${message.id}:`, error);
        results.set(message.id, message.content); // Fallback
      }
    }
    
    // Ajouter les autres à la queue
    [...priorityGroups.NORMAL, ...priorityGroups.LOW].forEach(message => {
      this.translateMessage(message, targetLanguage, user, 'LOW');
    });
    
    return results;
  }

  /**
   * Traduire le dernier message de chaque conversation (CRITIQUE)
   */
  async translateLastMessages(
    conversations: Array<{ id: string; lastMessage?: Message }>,
    targetLanguage: string,
    user: User
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    console.log(`🎯 Traduction prioritaire des derniers messages (${conversations.length} conversations)`);
    
    // Traiter en parallèle avec limite de concurrence
    const concurrentTasks = conversations
      .filter(conv => conv.lastMessage)
      .map(conv => async () => {
        try {
          const translation = await this.translateMessage(
            conv.lastMessage!, 
            targetLanguage, 
            user, 
            'CRITICAL'
          );
          results.set(conv.id, translation);
        } catch (error) {
          console.error(`❌ Erreur traduction dernier message conversation ${conv.id}:`, error);
          results.set(conv.id, conv.lastMessage!.content);
        }
      });

    // Exécuter avec limitation de concurrence
    await this.executeWithConcurrencyLimit(concurrentTasks, this.config.maxConcurrentTranslations);
    
    return results;
  }

  // ================= GESTION DES PRIORITÉS =================

  private calculatePriority(message: Message, user: User): TranslationPriority {
    // Facteurs de priorité
    const isRecent = Date.now() - message.createdAt.getTime() < 3600000; // 1 heure
    const isShort = message.content.length < 100;
    const userHasAutoTranslate = user.autoTranslateEnabled;
    
    // Logique de priorité
    if (isRecent && isShort && userHasAutoTranslate) return 'CRITICAL';
    if (isRecent && userHasAutoTranslate) return 'HIGH';
    if (userHasAutoTranslate) return 'NORMAL';
    return 'LOW';
  }

  private groupMessagesByPriority(messages: Message[], user: User): Record<TranslationPriority, Message[]> {
    const groups: Record<TranslationPriority, Message[]> = {
      CRITICAL: [],
      HIGH: [],
      NORMAL: [],
      LOW: []
    };

    messages.forEach(message => {
      const priority = this.calculatePriority(message, user);
      groups[priority].push(message);
    });

    return groups;
  }

  // ================= ANALYSE DE COMPLEXITÉ =================

  private analyzeComplexity(content: string): MessageComplexity {
    const length = content.length;
    const wordCount = content.split(/\s+/).length;
    const hasSpecialChars = /[{}[\]().,;:!?""''`]/.test(content);
    const hasNumbers = /\d/.test(content);
    const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(content);
    
    let complexityScore = 0;
    
    // Facteurs de complexité
    if (length > 200) complexityScore += 2;
    else if (length > 100) complexityScore += 1;
    
    if (wordCount > 30) complexityScore += 2;
    else if (wordCount > 15) complexityScore += 1;
    
    if (hasSpecialChars) complexityScore += 1;
    if (hasNumbers) complexityScore += 1;
    if (hasEmojis) complexityScore += 1;
    
    // Retourner la complexité
    if (complexityScore <= 2) return 'SIMPLE';
    if (complexityScore <= 4) return 'MEDIUM';
    if (complexityScore <= 6) return 'COMPLEX';
    return 'ADVANCED';
  }

  private estimateTranslationTime(content: string): number {
    const baseTime = 100; // ms
    const lengthFactor = content.length * 3; // 3ms par caractère
    const complexity = this.analyzeComplexity(content);
    
    const complexityMultiplier = {
      'SIMPLE': 1,
      'MEDIUM': 1.5,
      'COMPLEX': 2,
      'ADVANCED': 3
    }[complexity];
    
    return baseTime + (lengthFactor * complexityMultiplier);
  }

  // ================= EXÉCUTION DES TRADUCTIONS =================

  /**
   * Exécuter directement une tâche de traduction (API publique)
   */
  async executeTranslationTask(task: TranslationTask): Promise<string> {
    const startTime = performance.now();
    
    try {
      console.log(`🔄 Exécution tâche traduction ${task.id} (priorité: ${task.priority})`);
      
      // Choisir le modèle optimal selon la complexité
      const modelType = this.selectOptimalModel(task.complexity, task.content.length);
      
      // Exécuter la traduction
      const result = await this.translationService.translateText(
        task.content,
        task.sourceLanguage,
        task.targetLanguage,
        modelType
      );
      
      // Calculer les métriques
      const processingTime = performance.now() - startTime;
      this.updatePerformanceMetrics(processingTime, true);
      
      // Mettre en cache le résultat
      if (this.config.cacheEnabled) {
        const cacheKey = this.generateCacheKey(task.content, task.sourceLanguage, task.targetLanguage);
        await this.setCachedTranslation(cacheKey, result.translatedText);
      }
      
      console.log(`✅ Traduction terminée en ${processingTime.toFixed(2)}ms`);
      return result.translatedText;
      
    } catch (error) {
      console.error(`❌ Erreur lors de la traduction de la tâche ${task.id}:`, error);
      this.updatePerformanceMetrics(performance.now() - startTime, false);
      
      // Retry si possible
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        console.log(`🔄 Retry ${task.retryCount}/${task.maxRetries} pour la tâche ${task.id}`);
        
        // Délai exponentiel pour les retries
        await this.delay(this.config.retryDelay * Math.pow(2, task.retryCount - 1));
        return this.executeTranslationTask(task);
      }
      
      // Fallback: retourner le contenu original
      return task.content;
    }
  }

  private selectOptimalModel(complexity: MessageComplexity, contentLength: number): TranslationModelType {
    // Sélection du modèle selon la complexité et la longueur
    if (complexity === 'SIMPLE' && contentLength < 50) {
      return 'MT5_BASE'; // Rapide pour les messages simples
    }
    
    if (complexity === 'MEDIUM' && contentLength < 150) {
      return 'MT5_BASE'; // Bon compromis
    }
    
    // Pour les cas complexes, utiliser NLLB
    return 'NLLB_DISTILLED_600M';
  }

  // ================= GESTION DE LA QUEUE =================

  private addToQueue(task: TranslationTask): void {
    // Ajouter à la queue selon la priorité
    switch (task.priority) {
      case 'CRITICAL':
        this.translationQueue.CRITICAL.unshift(task); // Début de queue
        break;
      case 'HIGH':
        this.translationQueue.HIGH.push(task);
        break;
      case 'NORMAL':
        this.translationQueue.NORMAL.push(task);
        break;
      case 'LOW':
        this.translationQueue.LOW.push(task);
        break;
    }
    
    console.log(`📝 Tâche ${task.id} ajoutée à la queue ${task.priority}`);
    this.triggerQueueProcessing();
  }

  private startQueueProcessor(): void {
    if (this.batchProcessor) return;
    
    this.batchProcessor = setInterval(() => {
      if (!this.isProcessingQueue && this.config.backgroundProcessing) {
        this.processQueue();
      }
    }, this.config.batchInterval);
    
    console.log('🔄 Processeur de queue démarré');
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    try {
      // Traiter par ordre de priorité
      const tasks = [
        ...this.translationQueue.CRITICAL.splice(0, this.config.batchSize),
        ...this.translationQueue.HIGH.splice(0, this.config.batchSize),
        ...this.translationQueue.NORMAL.splice(0, this.config.batchSize),
        ...this.translationQueue.LOW.splice(0, this.config.batchSize)
      ];
      
      if (tasks.length === 0) {
        return; // Rien à traiter
      }
      
      console.log(`🔄 Traitement batch de ${tasks.length} tâches`);
      
      // Exécuter en parallèle avec limitation
      const taskExecutors = tasks.map(task => () => this.executeTranslationTask(task));
      await this.executeWithConcurrencyLimit(taskExecutors, this.config.maxConcurrentTranslations);
      
      // Émettre événement de completion
      this.emitEvent('TRANSLATION_BATCH_COMPLETE', { 
        processed: tasks.length,
        remaining: this.getTotalQueueSize()
      });
      
    } catch (error) {
      console.error('❌ Erreur lors du traitement de la queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private triggerQueueProcessing(): void {
    // Traitement immédiat si queue critique
    if (this.translationQueue.CRITICAL.length > 0 && !this.isProcessingQueue) {
      setTimeout(() => this.processQueue(), 0);
    }
  }

  private getTotalQueueSize(): number {
    return this.translationQueue.CRITICAL.length +
           this.translationQueue.HIGH.length +
           this.translationQueue.NORMAL.length +
           this.translationQueue.LOW.length;
  }

  // ================= UTILITAIRES =================

  private async executeWithConcurrencyLimit<T>(
    tasks: Array<() => Promise<T>>, 
    limit: number
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];
    
    for (const task of tasks) {
      const promise = task().then(result => {
        results.push(result);
      });
      
      executing.push(promise);
      
      if (executing.length >= limit) {
        await Promise.race(executing);
        executing.splice(0, 1);
      }
    }
    
    await Promise.all(executing);
    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateCacheKey(content: string, sourceLang: string, targetLang: string): string {
    // Générer une clé unique pour le cache
    const hash = btoa(encodeURIComponent(`${sourceLang}-${targetLang}-${content.trim()}`));
    return `translation_${hash}`;
  }

  private async getCachedTranslation(key: string): Promise<string | null> {
    // Utiliser le cache hiérarchique
    const cached = this.cacheService.getCachedValue(key) as string;
    return cached || null;
  }

  private async setCachedTranslation(key: string, translation: string): Promise<void> {
    // Mettre en cache dans tous les niveaux
    this.cacheService.setCachedValue(key, translation);
  }

  private extractUserPreferences(user: User): UserTranslationPreferences {
    return {
      primaryLanguage: user.systemLanguage,
      secondaryLanguages: [user.regionalLanguage],
      autoTranslateEnabled: user.autoTranslateEnabled,
      translateToSystemLanguage: user.translateToSystemLanguage,
      translateToRegionalLanguage: user.translateToRegionalLanguage,
      useCustomDestination: user.useCustomDestination,
      customDestinationLanguage: user.customDestinationLanguage,
      preloadTranslations: true,
      maxCacheSize: 50, // MB
      translationQuality: 'balanced',
      backgroundTranslation: true
    };
  }

  private updatePerformanceMetrics(processingTime: number, success: boolean): void {
    this.performanceMetrics.totalTranslations++;
    
    if (success) {
      this.performanceMetrics.successfulTranslations++;
    } else {
      this.performanceMetrics.failedTranslations++;
    }
    
    // Mise à jour de la moyenne
    const total = this.performanceMetrics.totalTranslations;
    this.performanceMetrics.averageProcessingTime = 
      ((this.performanceMetrics.averageProcessingTime * (total - 1)) + processingTime) / total;
  }

  private emitEvent(type: OptimizationEvent, data?: unknown): void {
    const eventData: OptimizationEventData = {
      type,
      timestamp: new Date(),
      data
    };
    
    const listeners = this.eventListeners.get(type) || [];
    listeners.forEach(listener => {
      try {
        listener(eventData);
      } catch (error) {
        console.error(`❌ Erreur dans le listener d'événement ${type}:`, error);
      }
    });
  }

  // ================= API PUBLIQUE =================

  /**
   * Obtenir les métriques de performance
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Obtenir l'état de la queue
   */
  getQueueStatus() {
    return {
      critical: this.translationQueue.CRITICAL.length,
      high: this.translationQueue.HIGH.length,
      normal: this.translationQueue.NORMAL.length,
      low: this.translationQueue.LOW.length,
      total: this.getTotalQueueSize(),
      isProcessing: this.isProcessingQueue
    };
  }

  /**
   * Vider une queue spécifique
   */
  clearQueue(priority?: TranslationPriority): void {
    if (priority) {
      switch (priority) {
        case 'CRITICAL':
          this.translationQueue.CRITICAL = [];
          break;
        case 'HIGH':
          this.translationQueue.HIGH = [];
          break;
        case 'NORMAL':
          this.translationQueue.NORMAL = [];
          break;
        case 'LOW':
          this.translationQueue.LOW = [];
          break;
      }
    } else {
      this.translationQueue = { CRITICAL: [], HIGH: [], NORMAL: [], LOW: [] };
    }
    console.log(`🗑️ Queue ${priority || 'complète'} vidée`);
  }

  /**
   * Configurer le service
   */
  configure(newConfig: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Configuration mise à jour:', this.config);
  }

  /**
   * Ajouter un listener d'événement
   */
  addEventListener(event: OptimizationEvent, listener: (data: OptimizationEventData) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Supprimer un listener d'événement
   */
  removeEventListener(event: OptimizationEvent, listener: (data: OptimizationEventData) => void): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }
}

// Export de l'instance singleton
export const optimizedTranslation = OptimizedTranslationService.getInstance();
