/**
 * Hook simplifié pour utiliser la stratégie de traduction optimisée
 * Interface simple pour les composants React
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { optimizedTranslationIntegration } from '@/services/optimized-translation-integration.service';
import type { ConversationMetadata, LoadingState } from '@/types/translation-optimization';
import type { User } from '@/types';

interface UseOptimizedTranslationResult {
  // États
  conversationsMetadata: ConversationMetadata[];
  isLoading: boolean;
  loadingState: LoadingState;
  translations: Map<string, string>;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  clearCache: () => Promise<void>;
  
  // Métriques
  performanceMetrics: {
    cache: unknown;
    translation: unknown;
    queue: unknown;
  };
}

interface UseOptimizedTranslationOptions {
  user: User | null;
  autoInitialize?: boolean;
  enableBackgroundProcessing?: boolean;
}

export function useOptimizedTranslation(options: UseOptimizedTranslationOptions): UseOptimizedTranslationResult {
  // États
  const [conversationsMetadata, setConversationsMetadata] = useState<ConversationMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    phase: 'STARTUP',
    progress: 0,
    conversationsLoaded: 0,
    totalConversations: 0,
    translationsCompleted: 0,
    totalTranslations: 0,
    estimatedTimeRemaining: 0,
    errors: []
  });
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    cache: {},
    translation: {},
    queue: {}
  });

  // Initialisation de la stratégie
  const initialize = useCallback(async () => {
    if (!options.user) {
      console.warn('⚠️ Utilisateur non défini - impossible d\'initialiser la traduction');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🚀 Initialisation de la stratégie de traduction optimisée...');

      // Exécuter la stratégie complète
      const result = await optimizedTranslationIntegration.executeOptimizedTranslationStrategy(options.user);

      // Mettre à jour les états
      setConversationsMetadata(result.metadata);
      setTranslations(result.translations);
      setLoadingState(result.loadingState);

      // Mettre à jour les métriques
      const metrics = optimizedTranslationIntegration.getPerformanceMetrics();
      setPerformanceMetrics(metrics);

      console.log(`✅ Stratégie initialisée: ${result.metadata.length} conversations, ${result.translations.size} traductions`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error('❌ Erreur lors de l\'initialisation:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [options.user]);

  // Nettoyage du cache
  const clearCache = useCallback(async () => {
    try {
      await optimizedTranslationIntegration.clearCache();
      
      // Réinitialiser les états
      setConversationsMetadata([]);
      setTranslations(new Map());
      setLoadingState({
        phase: 'STARTUP',
        progress: 0,
        conversationsLoaded: 0,
        totalConversations: 0,
        translationsCompleted: 0,
        totalTranslations: 0,
        estimatedTimeRemaining: 0,
        errors: []
      });
      
      console.log('🧹 Cache nettoyé et états réinitialisés');
    } catch (err) {
      console.error('❌ Erreur lors du nettoyage du cache:', err);
    }
  }, []);

  // Initialisation automatique
  useEffect(() => {
    if (options.autoInitialize !== false && options.user) {
      initialize();
    }
  }, [initialize, options.autoInitialize, options.user]);

  // Mise à jour périodique des métriques
  useEffect(() => {
    if (!options.user) return;

    const interval = setInterval(() => {
      try {
        const metrics = optimizedTranslationIntegration.getPerformanceMetrics();
        setPerformanceMetrics(metrics);
        
        const currentLoadingState = optimizedTranslationIntegration.getLoadingState();
        setLoadingState(currentLoadingState);
      } catch (err) {
        console.warn('⚠️ Erreur lors de la mise à jour des métriques:', err);
      }
    }, 5000); // Toutes les 5 secondes

    return () => clearInterval(interval);
  }, [options.user]);

  return {
    // États
    conversationsMetadata,
    isLoading,
    loadingState,
    translations,
    error,
    
    // Actions
    initialize,
    clearCache,
    
    // Métriques
    performanceMetrics
  };
}
