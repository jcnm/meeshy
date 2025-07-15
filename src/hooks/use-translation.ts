/**
 * Hook unifié pour la traduction dans Meeshy
 * Combine toutes les fonctionnalités de traduction en un seul hook
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { translationService, type TranslationResult, type TranslationProgress } from '@/services/translation.service';
import { ACTIVE_MODELS } from '@/lib/unified-model-config';
import type { Message, TranslatedMessage, User, TranslationModelType } from '@/types';

// Types unifiés
interface UseTranslationReturn {
  // Traduction simple
  translate: (text: string, sourceLanguage: string, targetLanguage: string, preferredModel?: TranslationModelType) => Promise<string>;
  
  // Traduction de messages
  translateMessage: (message: Message, targetLanguage: string) => Promise<TranslatedMessage>;
  translateMessages: (messages: Message[], targetLanguage: string) => Promise<TranslatedMessage[]>;
  
  // Gestion des modèles
  loadModel: (model: TranslationModelType) => Promise<void>;
  isModelLoaded: (model: TranslationModelType) => boolean;
  getLoadedModels: () => TranslationModelType[];
  
  // États
  isTranslating: boolean;
  isLoading: boolean;
  progress: TranslationProgress | null;
  error: string | null;
  
  // Cache
  getCacheStats: () => { size: number; expiredCount: number; totalTranslations: number };
  clearCache: () => void;
  
  // Utilitaires
  clearError: () => void;
}

interface TranslationRequest {
  id: string;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
}

/**
 * Hook unifié pour toutes les fonctionnalités de traduction
 */
export const useTranslation = (currentUser: User | null): UseTranslationReturn => {
  // États
  const [isTranslating, setIsTranslating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Queue de traductions pour éviter les conflits
  const translationQueue = useRef<TranslationRequest[]>([]);
  const isProcessingQueue = useRef(false);

  // Effacer les erreurs
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // === MÉTHODES DE TRADUCTION SIMPLE ===

  const translate = useCallback(async (
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    preferredModel?: TranslationModelType
  ): Promise<string> => {
    if (!text.trim()) return text;
    
    try {
      setIsTranslating(true);
      setError(null);
      
      const result = await translationService.translate(text, targetLanguage, sourceLanguage, { preferredModel });
      return result.translatedText;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de traduction inconnue';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsTranslating(false);
    }
  }, []);

  // === MÉTHODES DE TRADUCTION DE MESSAGES ===

  const convertToTranslatedMessage = useCallback((message: Message): TranslatedMessage => {
    return {
      ...message,
      originalContent: message.content,
      translations: [],
      isTranslated: false
    };
  }, []);

  const translateMessage = useCallback(async (
    message: Message,
    targetLanguage: string
  ): Promise<TranslatedMessage> => {
    try {
      const translatedMessage = convertToTranslatedMessage(message);
      
      // Éviter la traduction si c'est déjà dans la langue cible
      if (message.originalLanguage === targetLanguage) {
        return translatedMessage;
      }
      
      // Vérifier que les langues sont supportées (cette logique pourrait être déplacée ou améliorée)
      const supportedLanguages = ['en', 'fr', 'es', 'de', 'ru', 'zh', 'ja', 'ar', 'hi', 'pt', 'it', 'sv'];
      if (!supportedLanguages.includes(message.originalLanguage)) {
        throw new Error(`Langue source "${message.originalLanguage}" non supportée`);
      }
      if (!supportedLanguages.includes(targetLanguage)) {
        throw new Error(`Langue cible "${targetLanguage}" non supportée`);
      }
      
      const result = await translationService.translate(
        message.content,
        targetLanguage,
        message.originalLanguage
      );
      
      // Ajouter la traduction
      if (!translatedMessage.translations) {
        translatedMessage.translations = [];
      }
      
      translatedMessage.translations.push({
        language: targetLanguage,
        content: result.translatedText,
        flag: '', // À définir selon la langue
        createdAt: new Date(),
        modelUsed: result.modelUsed as TranslationModelType
      });
      
      translatedMessage.isTranslated = true;
      translatedMessage.translatedContent = result.translatedText;
      translatedMessage.targetLanguage = targetLanguage;
      
      return translatedMessage;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de traduction du message';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [convertToTranslatedMessage]);

  const translateMessages = useCallback(async (
    messages: Message[],
    targetLanguage: string
  ): Promise<TranslatedMessage[]> => {
    const results: TranslatedMessage[] = [];
    
    try {
      setIsTranslating(true);
      setError(null);
      
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const translatedMessage = await translateMessage(message, targetLanguage);
        results.push(translatedMessage);
        
        // Petite pause pour éviter de surcharger
        if (i % 5 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de traduction des messages';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsTranslating(false);
    }
  }, [translateMessage]);

  // === MÉTHODES DE GESTION DES MODÈLES ===

  const loadModel = useCallback(async (model: TranslationModelType) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await translationService.loadTranslationPipeline(model, (progressData) => {
        setProgress(progressData);
      });
      
      setProgress(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de chargement du modèle';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isModelLoaded = useCallback((model: TranslationModelType): boolean => {
    return translationService.isModelLoaded(model);
  }, []);

  const getLoadedModels = useCallback((): TranslationModelType[] => {
    return translationService.getLoadedModels();
  }, []);

  // === MÉTHODES DE CACHE ===

  const getCacheStats = useCallback(() => {
    return translationService.getCacheStats();
  }, []);

  const clearCache = useCallback(() => {
    translationService.clearCache();
  }, []);

  return {
    // Traduction simple
    translate,
    
    // Traduction de messages
    translateMessage,
    translateMessages,
    
    // Gestion des modèles
    loadModel,
    isModelLoaded,
    getLoadedModels,
    
    // États
    isTranslating,
    isLoading,
    progress,
    error,
    
    // Cache
    getCacheStats,
    clearCache,
    
    // Utilitaires
    clearError
  };
};

// Hooks spécialisés pour compatibilité
export const useMessageTranslation = (currentUser: User | null) => {
  const { translateMessage, translateMessages, isTranslating, error, clearError } = useTranslation(currentUser);
  
  return {
    translateMessage,
    translateMessages,
    isTranslating,
    error,
    clearError
  };
};

export const useSimpleTranslation = () => {
  const { translate, isTranslating, error, clearError } = useTranslation(null);
  
  return {
    translate,
    isTranslating,
    error,
    clearError
  };
};

export const useTranslationCache = () => {
  const { getCacheStats, clearCache } = useTranslation(null);
  
  return {
    getCacheStats,
    clearCache
  };
};


