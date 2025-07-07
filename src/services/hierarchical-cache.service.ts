/**
 * Service de cache hiérarchique pour l'optimisation des traductions
 * Implémente le stockage multi-niveaux : LocalStorage + IndexedDB + SessionStorage + Memory
 */

import type {
  ConversationMetadata,
  CachedMessage,
  TranslationQueue,
  LoadingState,
  PerformanceMetrics,
  OptimizationConfig,
  OptimizationEvent,
  OptimizationEventData,
  TranslationPriority,
  MessageComplexity
} from '@/types/translation-optimization';
import type { Message, Conversation } from '@/types';

/**
 * Service principal de cache hiérarchique
 */
export class HierarchicalCacheService {
  private static instance: HierarchicalCacheService;
  
  // Configuration par défaut
  private config: OptimizationConfig = {
    maxInitialLoadTime: 100,
    maxTranslationTime: 500,
    maxCacheSize: 50, // 50MB
    batchSize: 10,
    batchTimeout: 200,
    maxRetries: 3,
    retryBackoff: 1000,
    autoCleanupInterval: 5 * 60 * 1000, // 5 minutes
    cacheRetentionDays: 7,
    fallbackToOriginal: true,
    offlineMode: true,
    gracefulDegradation: true
  };

  // États internes
  private loadingState: LoadingState = {
    phase: 'STARTUP',
    progress: 0,
    conversationsLoaded: 0,
    totalConversations: 0,
    translationsCompleted: 0,
    totalTranslations: 0,
    estimatedTimeRemaining: 0,
    errors: []
  };

  private translationQueue: TranslationQueue = {
    CRITICAL: [],
    HIGH: [],
    NORMAL: [],
    LOW: []
  };

  private performanceMetrics: PerformanceMetrics = {
    loadingTimes: {
      initialUI: 0,
      conversationsList: 0,
      firstTranslation: 0,
      fullPageLoad: 0
    },
    translationStats: {
      totalRequests: 0,
      cacheHits: 0,
      cacheHitRate: 0,
      averageTime: 0,
      errorRate: 0
    },
    cacheStats: {
      localStorage: { size: 0, entries: 0, hitRate: 0, lastCleanup: new Date(), fragmentation: 0 },
      indexedDB: { size: 0, entries: 0, hitRate: 0, lastCleanup: new Date(), fragmentation: 0 },
      sessionStorage: { size: 0, entries: 0, hitRate: 0, lastCleanup: new Date(), fragmentation: 0 },
      memory: { size: 0, entries: 0, hitRate: 0, lastCleanup: new Date(), fragmentation: 0 }
    },
    userExperience: {
      averageResponseTime: 0,
      failureRecoveryTime: 0,
      offlineCapability: 0
    }
  };

  // Cache en mémoire
  private memoryCache = new Map<string, unknown>();
  private memoryCacheStats = new Map<string, { hits: number; lastAccessed: Date }>();

  // Gestionnaires d'événements
  private eventListeners = new Map<OptimizationEvent, Array<(data: OptimizationEventData) => void>>();

  static getInstance(): HierarchicalCacheService {
    if (!HierarchicalCacheService.instance) {
      HierarchicalCacheService.instance = new HierarchicalCacheService();
    }
    return HierarchicalCacheService.instance;
  }

  private constructor() {
    this.initializeCache();
    this.startPerformanceMonitoring();
    this.startAutoCleanup();
  }

  // ================= INITIALISATION =================

  private async initializeCache(): Promise<void> {
    console.log('🚀 Initialisation du cache hiérarchique...');
    
    try {
      // Vérifier les capacités du navigateur
      await this.checkBrowserCapabilities();
      
      // Charger la configuration depuis le cache
      await this.loadConfiguration();
      
      // Restaurer l'état de session si disponible
      await this.restoreSessionState();
      
      // Démarrer le nettoyage si nécessaire
      await this.performInitialCleanup();
      
      console.log('✅ Cache hiérarchique initialisé avec succès');
      this.emitEvent('CACHE_WARM_START', { ready: true });
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation du cache:', error);
      // Mode dégradé : fonctionnement sans cache optimisé
      this.config.gracefulDegradation = true;
    }
  }

  private async checkBrowserCapabilities(): Promise<void> {
    // Vérifier LocalStorage
    if (typeof Storage === 'undefined') {
      console.warn('⚠️ LocalStorage non disponible');
    }

    // Vérifier IndexedDB
    if (!window.indexedDB) {
      console.warn('⚠️ IndexedDB non disponible');
    }

    // Vérifier SessionStorage
    if (typeof sessionStorage === 'undefined') {
      console.warn('⚠️ SessionStorage non disponible');
    }
  }

  // ================= GESTION DES MÉTADONNÉES (NIVEAU 1) =================

  /**
   * Charger les métadonnées des conversations pour affichage instantané
   */
  async loadConversationsMetadata(): Promise<ConversationMetadata[]> {
    const startTime = performance.now();
    
    try {
      // 1. Essayer de charger depuis le cache mémoire
      let metadata = this.getFromMemoryCache('conversations_metadata') as ConversationMetadata[];
      
      if (metadata) {
        console.log('🔄 Métadonnées chargées depuis le cache mémoire');
        this.performanceMetrics.cacheStats.memory.hitRate++;
        return metadata;
      }

      // 2. Essayer de charger depuis LocalStorage
      metadata = this.getFromLocalStorage('conversations_metadata') as ConversationMetadata[];
      if (metadata && this.isMetadataValid(metadata)) {
        console.log('🔄 Métadonnées chargées depuis LocalStorage');
        this.cacheInMemory('conversations_metadata', metadata);
        this.performanceMetrics.cacheStats.localStorage.hitRate++;
        return metadata;
      }

      // 3. Essayer de charger depuis IndexedDB
      metadata = await this.getFromIndexedDB('conversations_metadata') as ConversationMetadata[];
      if (metadata && this.isMetadataValid(metadata)) {
        console.log('🔄 Métadonnées chargées depuis IndexedDB');
        this.cacheInMemory('conversations_metadata', metadata);
        this.cacheInLocalStorage('conversations_metadata', metadata);
        return metadata;
      }

      // 4. Aucun cache disponible - renvoyer un tableau vide
      console.log('📭 Aucune métadonnée en cache - démarrage à froid');
      return [];

    } catch (error) {
      console.error('❌ Erreur lors du chargement des métadonnées:', error);
      return [];
    } finally {
      const loadTime = performance.now() - startTime;
      this.performanceMetrics.loadingTimes.conversationsList = loadTime;
      console.log(`⏱️ Chargement métadonnées: ${loadTime.toFixed(2)}ms`);
    }
  }

  /**
   * Mettre à jour les métadonnées des conversations
   */
  async updateConversationsMetadata(conversations: Conversation[]): Promise<void> {
    const metadata: ConversationMetadata[] = conversations.map(conv => this.transformToMetadata(conv));
    
    // Stocker dans tous les niveaux de cache
    this.cacheInMemory('conversations_metadata', metadata);
    this.cacheInLocalStorage('conversations_metadata', metadata);
    await this.cacheInIndexedDB('conversations_metadata', metadata);
    
    console.log(`💾 Métadonnées mises à jour pour ${metadata.length} conversations`);
  }

  private transformToMetadata(conversation: Conversation): ConversationMetadata {
    return {
      id: conversation.id,
      title: conversation.title,
      type: conversation.type,
      isGroup: Boolean(conversation.isGroup),
      participantCount: conversation.participants?.length || 0,
      lastActivity: conversation.updatedAt,
      lastMessage: conversation.lastMessage ? {
        id: conversation.lastMessage.id,
        content: conversation.lastMessage.content,
        senderId: conversation.lastMessage.senderId,
        senderName: conversation.lastMessage.sender?.displayName || 'Utilisateur',
        timestamp: conversation.lastMessage.createdAt,
        originalLanguage: conversation.lastMessage.originalLanguage
      } : undefined,
      unreadCount: conversation.unreadCount || 0,
      hasTranslations: false, // À calculer selon le cache
      lastTranslationUpdate: new Date(),
      priority: this.calculateConversationPriority(conversation)
    };
  }

  private calculateConversationPriority(conversation: Conversation): import('@/types/translation-optimization').ConversationPriority {
    // Logique de priorité basée sur l'activité et l'importance
    const timeSinceLastActivity = Date.now() - conversation.updatedAt.getTime();
    const hasUnread = (conversation.unreadCount || 0) > 0;
    
    if (hasUnread && timeSinceLastActivity < 60000) return 'CRITICAL'; // 1 minute
    if (hasUnread || timeSinceLastActivity < 3600000) return 'HIGH'; // 1 heure
    if (timeSinceLastActivity < 86400000) return 'NORMAL'; // 24 heures
    return 'LOW';
  }

  private isMetadataValid(metadata: ConversationMetadata[]): boolean {
    if (!Array.isArray(metadata)) return false;
    if (metadata.length === 0) return true; // Vide mais valide
    
    // Vérifier la structure du premier élément
    const first = metadata[0];
    return first && 
           typeof first.id === 'string' && 
           typeof first.type === 'string' &&
           first.lastActivity instanceof Date;
  }

  // ================= GESTION DES MESSAGES (NIVEAU 2) =================

  /**
   * Charger les messages d'une conversation avec cache intelligent
   */
  async loadConversationMessages(conversationId: string, page = 1, limit = 50): Promise<CachedMessage[]> {
    const cacheKey = `messages_${conversationId}_${page}_${limit}`;
    
    try {
      // 1. Vérifier le cache mémoire
      let messages = this.getFromMemoryCache(cacheKey) as CachedMessage[];
      if (messages) {
        console.log(`🔄 Messages conversation ${conversationId} depuis cache mémoire`);
        return messages;
      }

      // 2. Vérifier IndexedDB
      messages = await this.getFromIndexedDB(cacheKey) as CachedMessage[];
      if (messages && this.isMessagesValid(messages)) {
        console.log(`🔄 Messages conversation ${conversationId} depuis IndexedDB`);
        this.cacheInMemory(cacheKey, messages);
        return messages;
      }

      // 3. Pas de cache - retourner tableau vide
      console.log(`📭 Aucun message en cache pour conversation ${conversationId}`);
      return [];

    } catch (error) {
      console.error(`❌ Erreur chargement messages conversation ${conversationId}:`, error);
      return [];
    }
  }

  /**
   * Mettre en cache les messages d'une conversation
   */
  async cacheConversationMessages(conversationId: string, messages: Message[], page = 1, limit = 50): Promise<void> {
    const cacheKey = `messages_${conversationId}_${page}_${limit}`;
    const cachedMessages: CachedMessage[] = messages.map(msg => this.transformToCachedMessage(msg));
    
    // Stocker dans les caches appropriés
    this.cacheInMemory(cacheKey, cachedMessages);
    await this.cacheInIndexedDB(cacheKey, cachedMessages);
    
    console.log(`💾 Messages mis en cache pour conversation ${conversationId}: ${messages.length} messages`);
  }

  private transformToCachedMessage(message: Message): CachedMessage {
    return {
      ...message,
      translations: {},
      translationPriority: this.calculateTranslationPriority(message),
      lastTranslationUpdate: new Date(),
      complexity: this.analyzeMessageComplexity(message.content),
      estimatedTranslationTime: this.estimateTranslationTime(message.content),
      accessFrequency: 0,
      lastAccessed: new Date()
    };
  }

  private calculateTranslationPriority(message: Message): TranslationPriority {
    const isRecent = Date.now() - message.createdAt.getTime() < 3600000; // 1 heure
    const isShort = message.content.length < 100;
    
    if (isRecent && isShort) return 'CRITICAL';
    if (isRecent) return 'HIGH';
    if (isShort) return 'NORMAL';
    return 'LOW';
  }

  private analyzeMessageComplexity(content: string): MessageComplexity {
    const length = content.length;
    const wordCount = content.split(/\s+/).length;
    const hasSpecialChars = /[{}[\]().,;:!?""''`]/.test(content);
    
    if (length < 50 && wordCount < 10 && !hasSpecialChars) return 'SIMPLE';
    if (length < 150 && wordCount < 25) return 'MEDIUM';
    if (length < 300 && wordCount < 50) return 'COMPLEX';
    return 'ADVANCED';
  }

  private estimateTranslationTime(content: string): number {
    const baseTime = 100; // ms de base
    const lengthFactor = content.length * 2; // 2ms par caractère
    const complexityFactor = this.analyzeMessageComplexity(content) === 'SIMPLE' ? 1 : 
                            this.analyzeMessageComplexity(content) === 'MEDIUM' ? 1.5 :
                            this.analyzeMessageComplexity(content) === 'COMPLEX' ? 2 : 3;
    
    return baseTime + (lengthFactor * complexityFactor);
  }

  private isMessagesValid(messages: CachedMessage[]): boolean {
    if (!Array.isArray(messages)) return false;
    if (messages.length === 0) return true;
    
    const first = messages[0];
    return first && 
           typeof first.id === 'string' && 
           typeof first.content === 'string' &&
           first.createdAt instanceof Date;
  }

  // ================= GESTION DES CACHES =================

  private getFromMemoryCache(key: string): unknown {
    const data = this.memoryCache.get(key);
    if (data) {
      // Mettre à jour les statistiques
      const stats = this.memoryCacheStats.get(key) || { hits: 0, lastAccessed: new Date() };
      stats.hits++;
      stats.lastAccessed = new Date();
      this.memoryCacheStats.set(key, stats);
    }
    return data;
  }

  private cacheInMemory(key: string, data: unknown): void {
    this.memoryCache.set(key, data);
    this.memoryCacheStats.set(key, { hits: 0, lastAccessed: new Date() });
    this.performanceMetrics.cacheStats.memory.entries++;
  }

  private getFromLocalStorage(key: string): unknown {
    try {
      const data = localStorage.getItem(`meeshy_${key}`);
      if (data) {
        this.performanceMetrics.cacheStats.localStorage.entries++;
        return JSON.parse(data, this.jsonReviver);
      }
    } catch (error) {
      console.warn(`⚠️ Erreur LocalStorage pour ${key}:`, error);
    }
    return null;
  }

  private cacheInLocalStorage(key: string, data: unknown): void {
    try {
      const serialized = JSON.stringify(data, this.jsonReplacer);
      localStorage.setItem(`meeshy_${key}`, serialized);
      this.performanceMetrics.cacheStats.localStorage.entries++;
    } catch (error) {
      console.warn(`⚠️ Erreur stockage LocalStorage pour ${key}:`, error);
      // Tentative de nettoyage si quota dépassé
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.cleanupLocalStorage();
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getFromIndexedDB(_key: string): Promise<unknown> {
    // Implementation simplifiée - à développer selon les besoins
    return null;
  }

  private async cacheInIndexedDB(key: string, data: unknown): Promise<void> {
    // Implementation simplifiée - à développer selon les besoins
    console.log(`💾 IndexedDB cache: ${key} (${JSON.stringify(data).length} chars)`);
  }

  // ================= UTILITAIRES JSON =================

  private jsonReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  private jsonReviver(_key: string, value: unknown): unknown {
    if (value && typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if (obj.__type === 'Date' && typeof obj.value === 'string') {
        return new Date(obj.value);
      }
    }
    return value;
  }

  // ================= NETTOYAGE ET MAINTENANCE =================

  private async performInitialCleanup(): Promise<void> {
    console.log('🧹 Démarrage du nettoyage initial...');
    await this.cleanupExpiredEntries();
    await this.optimizeCacheFragmentation();
    console.log('✅ Nettoyage initial terminé');
  }

  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    const retentionTime = this.config.cacheRetentionDays * 24 * 60 * 60 * 1000;
    
    // Nettoyage LocalStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('meeshy_')) {
        // Vérifier l'âge de l'entrée
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.timestamp && (now - data.timestamp) > retentionTime) {
            keysToRemove.push(key);
          }
        } catch {
          // Entrée corrompue - la supprimer
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🗑️ Supprimé ${keysToRemove.length} entrées expirées du LocalStorage`);
  }

  private async optimizeCacheFragmentation(): Promise<void> {
    // Logique de défragmentation des caches
    // À implémenter selon les besoins spécifiques
    console.log('🔧 Optimisation de la fragmentation des caches...');
  }

  private cleanupLocalStorage(): void {
    console.log('🧹 Nettoyage d\'urgence du LocalStorage...');
    // Supprimer les entrées les plus anciennes
    const entries: Array<{ key: string; timestamp: number }> = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('meeshy_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          entries.push({ key, timestamp: data.timestamp || 0 });
        } catch {
          entries.push({ key, timestamp: 0 });
        }
      }
    }
    
    // Trier par timestamp et supprimer les plus anciennes
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = entries.slice(0, Math.ceil(entries.length * 0.3)); // Supprimer 30%
    
    toRemove.forEach(entry => localStorage.removeItem(entry.key));
    console.log(`🗑️ Nettoyage d'urgence: ${toRemove.length} entrées supprimées`);
  }

  private startAutoCleanup(): void {
    setInterval(() => {
      this.performInitialCleanup();
    }, this.config.autoCleanupInterval);
  }

  // ================= MONITORING ET ÉVÉNEMENTS =================

  private startPerformanceMonitoring(): void {
    // Surveiller les performances globales
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 30000); // Toutes les 30 secondes
  }

  private updatePerformanceMetrics(): void {
    // Calculer les métriques de cache
    this.performanceMetrics.cacheStats.memory.entries = this.memoryCache.size;
    this.performanceMetrics.cacheStats.localStorage.entries = this.getLocalStorageEntryCount();
    
    // Calculer le taux de hit
    const memoryHits = Array.from(this.memoryCacheStats.values()).reduce((sum, stats) => sum + stats.hits, 0);
    this.performanceMetrics.cacheStats.memory.hitRate = memoryHits / Math.max(1, this.performanceMetrics.translationStats.totalRequests);
  }

  private getLocalStorageEntryCount(): number {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('meeshy_')) count++;
    }
    return count;
  }

  private emitEvent(type: OptimizationEvent, data?: unknown): void {
    const eventData: OptimizationEventData = {
      type,
      timestamp: new Date(),
      data,
      metrics: this.performanceMetrics
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

  /**
   * Obtenir les métriques de performance actuelles
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Obtenir l'état de chargement actuel
   */
  getLoadingState(): LoadingState {
    return { ...this.loadingState };
  }

  /**
   * Forcer un nettoyage complet des caches
   */
  async forceCacheCleanup(): Promise<void> {
    console.log('🧹 Nettoyage forcé des caches...');
    
    // Vider le cache mémoire
    this.memoryCache.clear();
    this.memoryCacheStats.clear();
    
    // Nettoyer LocalStorage
    this.cleanupLocalStorage();
    
    // Nettoyer IndexedDB (à implémenter)
    
    this.emitEvent('CACHE_CLEANUP_STARTED');
    console.log('✅ Nettoyage forcé terminé');
  }

  /**
   * Configuration du service
   */
  private async loadConfiguration(): Promise<void> {
    const savedConfig = this.getFromLocalStorage('optimization_config');
    if (savedConfig) {
      this.config = { ...this.config, ...savedConfig };
    }
  }

  private async restoreSessionState(): Promise<void> {
    // Restaurer l'état de session depuis SessionStorage
    try {
      const sessionState = sessionStorage.getItem('meeshy_session_state');
      if (sessionState) {
        const state = JSON.parse(sessionState);
        this.loadingState = { ...this.loadingState, ...state.loadingState };
        console.log('🔄 État de session restauré');
      }
    } catch (error) {
      console.warn('⚠️ Impossible de restaurer l\'état de session:', error);
    }
  }

  // ================= MÉTHODES PUBLIQUES POUR L'ACCÈS AU CACHE =================

  /**
   * Obtenir une valeur du cache mémoire (méthode publique)
   */
  public getCachedValue(key: string): unknown {
    return this.getFromMemoryCache(key);
  }

  /**
   * Mettre une valeur en cache (méthode publique)
   */
  public setCachedValue(key: string, value: unknown): void {
    this.cacheInMemory(key, value);
  }
}

// Export de l'instance singleton
export const hierarchicalCache = HierarchicalCacheService.getInstance();
