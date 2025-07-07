/**
 * Hook pour la stratégie optimisée de traduction multi-niveaux
 * Implémente le chargement hiérarchique et la traduction intelligente par priorité
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { 
  ConversationMetadata, 
  TranslationQueue, 
  LoadingState, 
  TranslationTask,
  UserTranslationPreferences,
  OptimizationConfig
} from '@/types/translation-optimization';
import type { TranslatedMessage } from '@/types';
import { hierarchicalCache } from '@/services/hierarchical-cache.service';
import { OptimizedTranslationService } from '@/services/optimized-translation.service';
import { ConversationsService } from '@/services/conversationsService';

interface OptimizedTranslationState {
  // Phase 1: Chargement instantané
  conversationsMetadata: ConversationMetadata[];
  isMetadataLoaded: boolean;
  
  // Phase 2: Traduction prioritaire
  translationQueue: TranslationQueue;
  isProcessingTranslations: boolean;
  
  // Phase 3: Traduction paresseuse
  backgroundTranslations: Map<string, TranslatedMessage>;
  
  // États globaux
  loadingState: LoadingState;
  isOnline: boolean;
  cacheStats: {
    memoryHits: number;
    localStorageHits: number;
    indexedDBHits: number;
    totalRequests: number;
  };
}

interface UseOptimizedTranslationOptions {
  userPreferences: UserTranslationPreferences;
  autoStartTranslation?: boolean;
  enableBackgroundProcessing?: boolean;
  batchSize?: number;
  maxRetries?: number;
}

export function useOptimizedTranslationStrategy(options: UseOptimizedTranslationOptions) {
  // Service instances
  const conversationsService = useRef(new ConversationsService()).current;
  const optimizedTranslationService = useRef(OptimizedTranslationService.getInstance()).current;
  
  // État principal
  const [state, setState] = useState<OptimizedTranslationState>({
    conversationsMetadata: [],
    isMetadataLoaded: false,
    translationQueue: {
      CRITICAL: [],
      HIGH: [],
      NORMAL: [],
      LOW: []
    },
    isProcessingTranslations: false,
    backgroundTranslations: new Map(),
    loadingState: {
      phase: 'STARTUP',
      progress: 0,
      conversationsLoaded: 0,
      totalConversations: 0,
      translationsCompleted: 0,
      totalTranslations: 0,
      estimatedTimeRemaining: 0,
      errors: []
    },
    isOnline: navigator.onLine,
    cacheStats: {
      memoryHits: 0,
      localStorageHits: 0,
      indexedDBHits: 0,
      totalRequests: 0
    }
  });

  // Configuration par défaut
  const config: OptimizationConfig = {
    maxInitialLoadTime: 100,
    maxTranslationTime: 500,
    maxCacheSize: 50,
    batchSize: options.batchSize || 10,
    batchTimeout: 200,
    maxRetries: options.maxRetries || 3,
    retryBackoff: 1000,
    autoCleanupInterval: 5 * 60 * 1000,
    cacheRetentionDays: 7,
    fallbackToOriginal: true,
    offlineMode: true,
    gracefulDegradation: true
  };

  // Refs pour éviter les re-renders
  const translationTimeouts = useRef(new Map<string, NodeJS.Timeout>());

  // ================= PHASE 1: CHARGEMENT INSTANTANÉ =================

  /**
   * Charger instantanément l'interface avec les métadonnées des conversations
   */
  const loadConversationsMetadata = useCallback(async (): Promise<ConversationMetadata[]> => {
    const startTime = performance.now();
    
    try {
      setState(prev => ({
        ...prev,
        loadingState: { ...prev.loadingState, phase: 'STARTUP', currentTask: 'Chargement des métadonnées...' }
      }));

      // 1. Essayer de charger depuis le cache hiérarchique
      let metadata = await hierarchicalCache.loadConversationsMetadata();
      
      if (metadata.length === 0) {
        // 2. Démarrage à froid - charger les conversations complètes
        console.log('🔄 Démarrage à froid - chargement des conversations...');
        const conversations = await conversationsService.getConversations();
        
        // 3. Transformer en métadonnées et mettre en cache
        await hierarchicalCache.updateConversationsMetadata(conversations);
        metadata = await hierarchicalCache.loadConversationsMetadata();
      }

      // 4. Mettre à jour l'état
      setState(prev => ({
        ...prev,
        conversationsMetadata: metadata,
        isMetadataLoaded: true,
        loadingState: {
          ...prev.loadingState,
          conversationsLoaded: metadata.length,
          totalConversations: metadata.length,
          progress: 25
        }
      }));

      const loadTime = performance.now() - startTime;
      console.log(`✅ Métadonnées chargées en ${loadTime.toFixed(2)}ms - ${metadata.length} conversations`);
      
      return metadata;

    } catch (error) {
      console.error('❌ Erreur lors du chargement des métadonnées:', error);
      
      setState(prev => ({
        ...prev,
        loadingState: {
          ...prev.loadingState,
          errors: [...prev.loadingState.errors, {
            type: 'CACHE',
            message: 'Erreur de chargement des métadonnées',
            timestamp: new Date(),
            recoverable: true
          }]
        }
      }));
      
      return [];
    }
  }, [conversationsService]);

  // ================= UTILITAIRES =================

  const analyzeMessageComplexity = useCallback((content: string): import('@/types/translation-optimization').MessageComplexity => {
    const length = content.length;
    const wordCount = content.split(/\s+/).length;
    const hasSpecialChars = /[{}[\]().,;:!?""''`]/.test(content);
    
    if (length < 50 && wordCount < 10 && !hasSpecialChars) return 'SIMPLE';
    if (length < 150 && wordCount < 25) return 'MEDIUM';
    if (length < 300 && wordCount < 50) return 'COMPLEX';
    return 'ADVANCED';
  }, []);

  const estimateTranslationTime = useCallback((content: string): number => {
    const baseTime = 100;
    const lengthFactor = content.length * 2;
    const complexity = analyzeMessageComplexity(content);
    const complexityMultiplier = complexity === 'SIMPLE' ? 1 : 
                                complexity === 'MEDIUM' ? 1.5 :
                                complexity === 'COMPLEX' ? 2 : 3;
    
    return baseTime + (lengthFactor * complexityMultiplier);
  }, [analyzeMessageComplexity]);

  const translateMessageWithCache = useCallback(async (task: TranslationTask): Promise<string | null> => {
    try {
      // 1. Vérifier le cache hiérarchique d'abord
      const cacheKey = `${task.content}-${task.sourceLanguage}-${task.targetLanguage}`;
      const cached = hierarchicalCache.getCachedValue(cacheKey);
      
      if (cached) {
        console.log(`✅ Traduction trouvée en cache: ${task.messageId}`);
        return cached as string;
      }
      
      // 2. Appel direct à executeTranslationTask (évite la double création de tâche)
      const result = await optimizedTranslationService.executeTranslationTask(task);
      
      // 3. Mettre en cache le résultat
      hierarchicalCache.setCachedValue(cacheKey, result);
      
      console.log(`✅ Traduction réussie: ${task.messageId} -> ${result.substring(0, 50)}...`);
      return result;
    } catch (error) {
      console.error(`❌ Erreur traduction message ${task.messageId}:`, error);
      return null;
    }
  }, [optimizedTranslationService]);

  const updateConversationMetadataWithTranslation = useCallback((task: TranslationTask, translation: string) => {
    setState(prev => ({
      ...prev,
      conversationsMetadata: prev.conversationsMetadata.map(conv => {
        if (conv.id === task.conversationId && conv.lastMessage?.id === task.messageId) {
          return {
            ...conv,
            lastMessage: {
              ...conv.lastMessage,
              translatedContent: translation,
              targetLanguage: task.targetLanguage,
              isTranslated: true
            }
          };
        }
        return conv;
      })
    }));
  }, []);

  /**
   * Traiter un batch de traductions critiques
   */
  const processCriticalTranslationBatch = useCallback(async (tasks: TranslationTask[]) => {
    const batchSize = config.batchSize;
    
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      
      // Traiter le batch en parallèle
      const translations = await Promise.allSettled(
        batch.map(task => translateMessageWithCache(task))
      );

      // Mettre à jour les métadonnées avec les traductions
      translations.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          updateConversationMetadataWithTranslation(batch[index], result.value);
        }
      });

      setState(prev => ({
        ...prev,
        loadingState: {
          ...prev.loadingState,
          translationsCompleted: Math.min(i + batchSize, tasks.length),
          progress: 60 + (30 * (i + batchSize) / tasks.length)
        }
      }));

      // Délai entre les batches pour ne pas surcharger
      if (i + batchSize < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, config.batchTimeout));
      }
    }
  }, [config.batchSize, config.batchTimeout, translateMessageWithCache, updateConversationMetadataWithTranslation]);

  // ================= PHASE 2: TRADUCTION PRIORITAIRE =================

  /**
   * Traduire automatiquement les messages critiques (derniers messages de chaque conversation)
   */
  const processHighPriorityTranslations = useCallback(async (metadata: ConversationMetadata[]) => {
    if (!options.userPreferences.autoTranslateEnabled) {
      console.log('🚫 Traduction automatique désactivée');
      return;
    }

    try {
      setState(prev => ({
        ...prev,
        loadingState: { ...prev.loadingState, phase: 'PRIORITY_TRANSLATION', currentTask: 'Traduction prioritaire...' }
      }));

      // 1. Identifier les traductions critiques
      const criticalTasks: TranslationTask[] = [];
      
      for (const conv of metadata) {
        if (conv.lastMessage && !conv.lastMessage.isTranslated) {
          criticalTasks.push({
            id: `critical_${conv.lastMessage.id}`,
            messageId: conv.lastMessage.id,
            conversationId: conv.id,
            content: conv.lastMessage.content,
            sourceLanguage: conv.lastMessage.originalLanguage,
            targetLanguage: options.userPreferences.primaryLanguage,
            priority: 'CRITICAL',
            complexity: analyzeMessageComplexity(conv.lastMessage.content),
            estimatedTime: estimateTranslationTime(conv.lastMessage.content),
            retryCount: 0,
            maxRetries: config.maxRetries,
            createdAt: new Date(),
            userId: conv.lastMessage.senderId,
            isVisible: true,
            isLastMessage: true,
            userPreferences: options.userPreferences
          });
        }
      }

      // 2. Traiter les tâches par batch
      if (criticalTasks.length > 0) {
        setState(prev => ({
          ...prev,
          translationQueue: {
            ...prev.translationQueue,
            CRITICAL: criticalTasks
          },
          loadingState: {
            ...prev.loadingState,
            totalTranslations: criticalTasks.length
          }
        }));

        await processCriticalTranslationBatch(criticalTasks);
      }

      setState(prev => ({
        ...prev,
        loadingState: { ...prev.loadingState, progress: 60 }
      }));

    } catch (error) {
      console.error('❌ Erreur lors des traductions prioritaires:', error);
    }
  }, [options.userPreferences, config.maxRetries, analyzeMessageComplexity, estimateTranslationTime, processCriticalTranslationBatch]);

  // ================= PHASE 3: TRADUCTION PARESSEUSE =================

  /**
   * Démarrer la traduction en arrière-plan des messages non critiques
   */
  const startBackgroundTranslations = useCallback(async () => {
    if (!options.enableBackgroundProcessing) return;

    setState(prev => ({
      ...prev,
      loadingState: { ...prev.loadingState, phase: 'LAZY_TRANSLATION', currentTask: 'Traduction en arrière-plan...' }
    }));

    // Logique de traduction paresseuse
    console.log('🔄 Démarrage des traductions en arrière-plan...');
    
    // Marquer comme terminé après un délai
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        loadingState: { 
          ...prev.loadingState, 
          phase: 'COMPLETE', 
          progress: 100,
          currentTask: 'Chargement terminé'
        }
      }));
    }, 2000);
  }, [options.enableBackgroundProcessing]);

  // ================= LIFECYCLE =================

  /**
   * Initialiser la stratégie de chargement optimisée
   */
  const initialize = useCallback(async () => {
    console.log('🚀 Initialisation de la stratégie de traduction optimisée...');
    
    try {
      // Phase 1: Chargement instantané (< 100ms)
      const metadata = await loadConversationsMetadata();
      
      // Phase 2: Traduction prioritaire (100-500ms)
      if (options.autoStartTranslation !== false) {
        setTimeout(() => {
          processHighPriorityTranslations(metadata);
        }, 100);
      }
      
      // Phase 3: Traduction paresseuse (arrière-plan)
      setTimeout(() => {
        startBackgroundTranslations();
      }, 500);
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation:', error);
    }
  }, [loadConversationsMetadata, processHighPriorityTranslations, startBackgroundTranslations, options.autoStartTranslation]);

  // Auto-initialisation
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Gestion de l'état de connexion
  useEffect(() => {
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Nettoyage
  useEffect(() => {
    const timeouts = translationTimeouts.current;
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  // ================= API PUBLIQUE =================

  return {
    // États
    conversationsMetadata: state.conversationsMetadata,
    isMetadataLoaded: state.isMetadataLoaded,
    loadingState: state.loadingState,
    isOnline: state.isOnline,
    cacheStats: state.cacheStats,
    
    // Actions
    initialize,
    loadConversationsMetadata,
    processHighPriorityTranslations,
    startBackgroundTranslations,
    
    // Utilitaires
    config,
    hierarchicalCache
  };
}
