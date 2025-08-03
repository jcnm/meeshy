/**
 * Types pour l'optimisation de la traduction multi-niveaux
 * Implémentation de la stratégie de chargement hiérarchique
 */

import type { Message } from './index';

// ================= STRUCTURES DE CACHE HIÉRARCHIQUE =================

/**
 * Métadonnées de conversation pour chargement instantané (Niveau 1)
 */
export interface ConversationMetadata {
  id: string;
  title?: string;
  type: string;
  isGroup: boolean;
  participantCount: number;
  lastActivity: Date;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    timestamp: Date;
    originalLanguage: string;
    // Traduction du dernier message si disponible
    translatedContent?: string;
    targetLanguage?: string;
    isTranslated?: boolean;
  };
  unreadCount: number;
  // Indicateurs d'état pour optimisation
  hasTranslations: boolean;
  lastTranslationUpdate: Date;
  priority: ConversationPriority;
}

/**
 * Cache de messages avec traductions par conversation (Niveau 2)
 */
export interface ConversationMessageCache {
  conversationId: string;
  messages: CachedMessage[];
  lastSync: Date;
  totalMessages: number;
  loadedPages: number[];
  // Métadonnées pour optimisation
  averageMessageLength: number;
  dominantLanguages: string[];
  translationCoverage: Record<string, number>; // % de traductions par langue
}

/**
 * Message avec métadonnées de cache optimisées
 */
export interface CachedMessage extends Message {
  // État de traduction
  translations: Record<string, CachedTranslation>;
  translationPriority: TranslationPriority;
  lastTranslationUpdate: Date;
  
  // Métadonnées d'optimisation
  complexity: MessageComplexity;
  estimatedTranslationTime: number; // en ms
  accessFrequency: number;
  lastAccessed: Date;
}

/**
 * Traduction en cache avec métadonnées
 */
export interface CachedTranslation {
  content: string;
  language: string;
  timestamp: Date;
  modelUsed: string;
  confidence: number;
  processingTime: number;
  cacheHit: boolean;
}

// ================= SYSTÈME DE PRIORITÉS =================

export type ConversationPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type TranslationPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type MessageComplexity = 'SIMPLE' | 'MEDIUM' | 'COMPLEX' | 'ADVANCED';

/**
 * Queue de traductions avec gestion des priorités (Niveau 3)
 */
export interface TranslationQueue {
  CRITICAL: TranslationTask[];    // Dernier message de chaque conversation
  HIGH: TranslationTask[];        // Messages visibles à l'écran
  NORMAL: TranslationTask[];      // Messages hors écran mais dans conversation ouverte
  LOW: TranslationTask[];         // Traductions à la demande
}

/**
 * Tâche de traduction avec contexte complet
 */
export interface TranslationTask {
  id: string;
  messageId: string;
  conversationId: string;
  content: string;
  sourceLanguage: string;
  targetLanguage: string;
  priority: TranslationPriority;
  complexity: MessageComplexity;
  estimatedTime: number;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  scheduledFor?: Date;
  // Contexte pour optimisation
  userId: string;
  isVisible: boolean;
  isLastMessage: boolean;
  userPreferences: UserTranslationPreferences;
}

/**
 * Préférences utilisateur pour traduction optimisée
 */
export interface UserTranslationPreferences {
  primaryLanguage: string;
  secondaryLanguages: string[];
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
  customDestinationLanguage?: string;
  // Nouvelles préférences pour optimisation
  preloadTranslations: boolean;
  maxCacheSize: number; // en MB
  translationQuality: 'fast' | 'balanced' | 'quality';
  backgroundTranslation: boolean;
}

// ================= ÉTATS DE CHARGEMENT =================

export type LoadingPhase = 'STARTUP' | 'PRIORITY_TRANSLATION' | 'LAZY_TRANSLATION' | 'COMPLETE';

export interface LoadingState {
  phase: LoadingPhase;
  progress: number; // 0-100
  conversationsLoaded: number;
  totalConversations: number;
  translationsCompleted: number;
  totalTranslations: number;
  currentTask?: string;
  estimatedTimeRemaining: number; // en ms
  errors: LoadingError[];
}

export interface LoadingError {
  type: 'TRANSLATION' | 'CACHE' | 'NETWORK' | 'MODEL';
  message: string;
  messageId?: string;
  conversationId?: string;
  timestamp: Date;
  recoverable: boolean;
}

// ================= STRATÉGIES DE CACHE =================

export interface CacheStrategy {
  localStorage: LocalStorageConfig;
  indexedDB: IndexedDBConfig;
  sessionStorage: SessionStorageConfig;
  memory: MemoryCacheConfig;
}

export interface LocalStorageConfig {
  maxSize: number; // en MB
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  // Structure des données stockées
  storeConversationMetadata: boolean;
  storeLastMessages: boolean;
  storeUserPreferences: boolean;
}

export interface IndexedDBConfig {
  dbName: string;
  version: number;
  maxSize: number; // en MB
  retentionDays: number;
  compressionEnabled: boolean;
  // Structure des tables
  stores: {
    conversations: boolean;
    messages: boolean;
    translations: boolean;
    cache: boolean;
  };
}

export interface SessionStorageConfig {
  maxSize: number; // en MB
  // Données temporaires de session
  storeTranslationQueue: boolean;
  storeUIState: boolean;
  storeActiveConversation: boolean;
}

export interface MemoryCacheConfig {
  maxEntries: number;
  ttl: number; // en ms
  compressionThreshold: number; // en caractères
  // Stratégie d'éviction
  evictionPolicy: 'LRU' | 'LFU' | 'FIFO';
}

// ================= PERFORMANCE ET MÉTRIQUES =================

export interface PerformanceMetrics {
  loadingTimes: {
    initialUI: number;
    conversationsList: number;
    firstTranslation: number;
    fullPageLoad: number;
  };
  translationStats: {
    totalRequests: number;
    cacheHits: number;
    cacheHitRate: number;
    averageTime: number;
    errorRate: number;
  };
  cacheStats: {
    localStorage: CacheStats;
    indexedDB: CacheStats;
    sessionStorage: CacheStats;
    memory: CacheStats;
  };
  userExperience: {
    averageResponseTime: number;
    failureRecoveryTime: number;
    offlineCapability: number; // %
  };
}

export interface CacheStats {
  size: number; // en bytes
  entries: number;
  hitRate: number;
  lastCleanup: Date;
  fragmentation: number; // %
}

// ================= ÉVÉNEMENTS ET NOTIFICATIONS =================

export type OptimizationEvent = 
  | 'CACHE_WARM_START'
  | 'TRANSLATION_BATCH_COMPLETE'
  | 'PRIORITY_QUEUE_EMPTY'
  | 'CACHE_CLEANUP_STARTED'
  | 'OFFLINE_MODE_ENABLED'
  | 'SYNC_COMPLETED';

export interface OptimizationEventData {
  type: OptimizationEvent;
  timestamp: Date;
  data?: unknown;
  metrics?: Partial<PerformanceMetrics>;
}

// ================= CONFIGURATION GLOBALE =================

export interface OptimizationConfig {
  // Seuils de performance
  maxInitialLoadTime: number; // ms
  maxTranslationTime: number; // ms
  maxCacheSize: number; // MB
  
  // Paramètres de batching
  batchSize: number;
  batchTimeout: number; // ms
  
  // Stratégies de retry
  maxRetries: number;
  retryBackoff: number; // ms
  
  // Nettoyage automatique
  autoCleanupInterval: number; // ms
  cacheRetentionDays: number;
  
  // Mode dégradé
  fallbackToOriginal: boolean;
  offlineMode: boolean;
  gracefulDegradation: boolean;
}
