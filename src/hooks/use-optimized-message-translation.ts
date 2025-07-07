'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslationCache } from './use-translation-cache';
import { translationModels } from '@/lib/translation-models';
import type { Message, TranslatedMessage, User, TranslationModelType } from '@/types';

interface UseOptimizedMessageTranslationReturn {
  translateMessage: (message: Message, targetLanguage: string) => Promise<TranslatedMessage>;
  translateMessages: (messages: Message[], targetLanguage: string) => Promise<TranslatedMessage[]>;
  retranslateMessage: (messageId: string, message: TranslatedMessage, targetLanguage: string) => Promise<TranslatedMessage>;
  toggleOriginalTranslated: (messageId: string, translatedMessage: TranslatedMessage) => TranslatedMessage;
  isTranslating: boolean;
  error: string | null;
  clearError: () => void;
  modelsStatus: Record<string, { loaded: boolean; loading: boolean }>;
  preloadModels: () => Promise<void>;
}

/**
 * Hook optimisé pour la traduction de messages avec cache intelligent,
 * sélection automatique de modèle et gestion des états
 */
export const useOptimizedMessageTranslation = (currentUser: User | null): UseOptimizedMessageTranslationReturn => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsStatus, setModelsStatus] = useState<Record<string, { loaded: boolean; loading: boolean }>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  // Hook de cache optimisé
  const { 
    get: getTranslation, 
    set: setTranslation, 
    stats: getStats,
    clear: clearOldEntries 
  } = useTranslationCache({
    maxEntries: 2000,
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 jours
    autoCleanup: true,
    cleanupInterval: 10 * 60 * 1000, // 10 minutes
  });

  // Mettre à jour le statut des modèles
  const updateModelsStatus = useCallback(() => {
    const allModels = translationModels.getAllAvailableModels();
    const status: Record<string, { loaded: boolean; loading: boolean }> = {};
    
    allModels.forEach(modelType => {
      const modelKey = translationModels.getModelKey(modelType);
      status[modelKey] = {
        loaded: translationModels.isModelLoaded(modelKey),
        loading: false // Nous n'avons plus de tracking des loading promises dans la nouvelle structure
      };
    });
    
    setModelsStatus(status);
  }, []);

  useEffect(() => {
    updateModelsStatus();
    const interval = setInterval(updateModelsStatus, 3000);
    return () => clearInterval(interval);
  }, [updateModelsStatus]);

  // Effacer les erreurs
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Précharger les modèles de traduction
  const preloadModels = useCallback(async () => {
    try {
      setError(null);
      console.log('🚀 Préchargement des modèles de traduction...');
      
      const allModels = translationModels.getAllAvailableModels();
      const loadPromises = allModels.slice(0, 3).map(async (modelType) => {
        try {
          await translationModels.loadModel(modelType);
          console.log(`✅ Modèle ${modelType} préchargé`);
        } catch (error) {
          console.warn(`⚠️ Échec du préchargement du modèle ${modelType}:`, error);
        }
      });

      await Promise.allSettled(loadPromises);
      updateModelsStatus();
      console.log('🎉 Préchargement des modèles terminé');
    } catch (error) {
      console.error('❌ Erreur lors du préchargement des modèles:', error);
      setError('Erreur lors du préchargement des modèles');
    }
  }, [updateModelsStatus]);

  // Sélection intelligente du modèle optimal
  const selectOptimalModel = useCallback((text: string): { model: TranslationModelType; reason: string } => {
    const textLength = text.length;
    const wordCount = text.split(/\s+/).length;
    const hasComplexPunctuation = /[,.;:!?(){}[\]"'`]/.test(text);
    const hasNumbers = /\d/.test(text);
    const hasSpecialChars = /[#@$%^&*+=<>]/.test(text);
    
    // Calculer un score de complexité
    let complexityScore = 0;
    if (textLength > 50) complexityScore += 2;
    if (textLength > 100) complexityScore += 1;
    if (wordCount > 10) complexityScore += 1;
    if (wordCount > 20) complexityScore += 1;
    if (hasComplexPunctuation) complexityScore += 1;
    if (hasNumbers) complexityScore += 1;
    if (hasSpecialChars) complexityScore += 2;

    // Obtenir les modèles disponibles par famille
    const mt5Models = translationModels.getAvailableModelsByFamily('MT5');
    const nllbModels = translationModels.getAvailableModelsByFamily('NLLB');
    
    // Sélection MT5 pour messages simples et courts
    if (complexityScore <= 2 && textLength <= 50) {
      // Choisir le meilleur modèle MT5 disponible selon la longueur
      if (textLength <= 20 && mt5Models.includes('MT5_SMALL')) {
        return { model: 'MT5_SMALL', reason: 'Message très court et simple' };
      } else if (mt5Models.includes('MT5_BASE')) {
        return { model: 'MT5_BASE', reason: 'Message court et simple' };
      } else if (mt5Models.includes('MT5_SMALL')) {
        return { model: 'MT5_SMALL', reason: 'Message court (MT5_BASE non disponible)' };
      }
    }
    
    // Sélection NLLB pour messages complexes ou longs
    if (complexityScore >= 5 || textLength > 150) {
      // Messages très complexes ou très longs - utiliser le meilleur modèle disponible
      if (nllbModels.includes('NLLB_DISTILLED_1_3B')) {
        return { model: 'NLLB_DISTILLED_1_3B', reason: `Message très complexe (score: ${complexityScore})` };
      } else if (nllbModels.includes('NLLB_DISTILLED_600M')) {
        return { model: 'NLLB_DISTILLED_600M', reason: `Message complexe (score: ${complexityScore})` };
      } else if (nllbModels.includes('NLLB_200M')) {
        return { model: 'NLLB_200M', reason: `Message complexe (modèles supérieurs non disponibles)` };
      }
    }
    
    // Cas intermédiaire - modèle moyen
    if (nllbModels.includes('NLLB_DISTILLED_600M')) {
      return { model: 'NLLB_DISTILLED_600M', reason: `Message moyennement complexe (score: ${complexityScore})` };
    } else if (nllbModels.includes('NLLB_200M')) {
      return { model: 'NLLB_200M', reason: `Message moyennement complexe (modèles supérieurs non disponibles)` };
    } else if (mt5Models.includes('MT5_BASE')) {
      return { model: 'MT5_BASE', reason: 'Fallback MT5_BASE (aucun NLLB disponible)' };
    } else if (mt5Models.includes('MT5_SMALL')) {
      return { model: 'MT5_SMALL', reason: 'Fallback MT5_SMALL (seul modèle disponible)' };
    }
    
    // Fallback ultime - retourner le premier modèle disponible
    const allAvailable = translationModels.getAllAvailableModels();
    if (allAvailable.length > 0) {
      return { model: allAvailable[0], reason: 'Fallback - premier modèle disponible' };
    }
    
    // Si aucun modèle n'est disponible, retourner un modèle par défaut
    return { model: 'MT5_SMALL', reason: 'Aucun modèle disponible - utilisation par défaut' };
  }, []);

  // Convertir un Message en TranslatedMessage de base
  const convertToTranslatedMessage = useCallback((message: Message): TranslatedMessage => {
    return {
      ...message,
      originalContent: message.content,
      translatedContent: undefined,
      targetLanguage: undefined,
      isTranslated: false,
      isTranslating: false,
      showingOriginal: true,
      translationError: undefined,
      translationFailed: false,
      translations: [],
      sender: message.sender || {
        id: message.senderId,
        username: 'unknown',
        firstName: 'Utilisateur',
        lastName: 'Inconnu',
        email: 'unknown@example.com',
        role: 'USER',
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        systemLanguage: 'fr',
        regionalLanguage: 'fr',
        autoTranslateEnabled: false,
        translateToSystemLanguage: false,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: false,
        createdAt: new Date(),
        lastActiveAt: new Date(),
      }
    };
  }, []);

  // Traduire un message unique avec optimisations
  const translateMessage = useCallback(async (
    message: Message,
    targetLanguage: string
  ): Promise<TranslatedMessage> => {
    const translatedMessage = convertToTranslatedMessage(message);

    // Si c'est le même utilisateur qui a envoyé le message, pas de traduction
    if (currentUser && message.senderId === currentUser.id) {
      return translatedMessage;
    }

    // Si même langue source et cible, pas de traduction
    if (message.originalLanguage === targetLanguage) {
      return translatedMessage;
    }

    // Annuler la traduction précédente si en cours
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setError(null);

      // Vérifier le cache d'abord
      const cached = getTranslation(message.content, message.originalLanguage, targetLanguage);
      if (cached) {
        console.log(`📦 Traduction trouvée en cache pour le message ${message.id}`);
        return {
          ...translatedMessage,
          translatedContent: cached,
          targetLanguage,
          isTranslated: true,
          showingOriginal: false,
          translations: [{
            language: targetLanguage,
            content: cached,
            flag: '🌍',
            createdAt: new Date(),
          }],
        };
      }

      // Sélectionner le modèle optimal
      const { model, reason } = selectOptimalModel(message.content);
      console.log(`🤖 Utilisation du modèle ${model} pour traduire: "${message.content}" (${reason})`);

      // Marquer comme en cours de traduction
      setIsTranslating(true);

      // Traduire avec le modèle choisi
      const translatedText = await translationModels.translateWithModel(
        message.content,
        message.originalLanguage,
        targetLanguage,
        model
      );

      // Sauvegarder en cache
      setTranslation(message.content, message.originalLanguage, targetLanguage, translatedText);

      console.log(`✅ Message ${message.id} traduit avec ${model}: "${translatedText}"`);

      return {
        ...translatedMessage,
        translatedContent: translatedText,
        targetLanguage,
        isTranslated: true,
        isTranslating: false,
        showingOriginal: false,
        translations: [{
          language: targetLanguage,
          content: translatedText,
          flag: '🌍',
          createdAt: new Date(),
          modelUsed: model,
        }],
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de traduction inconnue';
      console.error(`❌ Erreur lors de la traduction du message ${message.id}:`, errorMessage);
      setError(errorMessage);

      return {
        ...translatedMessage,
        isTranslating: false,
        translationFailed: true,
        translationError: errorMessage,
      };
    } finally {
      setIsTranslating(false);
      updateModelsStatus();
    }
  }, [
    currentUser, 
    convertToTranslatedMessage, 
    getTranslation, 
    setTranslation, 
    selectOptimalModel, 
    updateModelsStatus
  ]);

  // Traduire plusieurs messages avec optimisation
  const translateMessages = useCallback(async (
    messages: Message[],
    targetLanguage: string
  ): Promise<TranslatedMessage[]> => {
    if (!currentUser || !currentUser.autoTranslateEnabled) {
      // Si la traduction automatique est désactivée, retourner les messages sans traduction
      return messages.map(convertToTranslatedMessage);
    }

    console.log(`🌍 Traduction de ${messages.length} messages vers ${targetLanguage}`);
    const translatedMessages: TranslatedMessage[] = [];

    // Traiter par lots pour éviter de surcharger
    const batchSize = 5;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (message) => {
        try {
          return await translateMessage(message, targetLanguage);
        } catch (error) {
          console.error(`❌ Erreur lors de la traduction du message ${message.id}:`, error);
          return convertToTranslatedMessage(message);
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          translatedMessages.push(result.value);
        }
      });

      // Petite pause entre les lots
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Traduction de ${messages.length} messages terminée`);
    
    // Nettoyage automatique du cache après traitement
    setTimeout(() => {
      clearOldEntries();
      console.log('🧹 Cache de traduction nettoyé', getStats);
    }, 1000);

    return translatedMessages;
  }, [currentUser, translateMessage, convertToTranslatedMessage, clearOldEntries, getStats]);

  // Retraduire un message
  const retranslateMessage = useCallback(async (
    messageId: string,
    message: TranslatedMessage,
    targetLanguage: string
  ): Promise<TranslatedMessage> => {
    console.log(`🔄 Retraduction du message ${messageId}`);
    
    // Créer un message temporaire pour la retraduction
    const tempMessage: Message = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.originalContent || message.content,
      originalLanguage: message.originalLanguage || 'fr',
      isEdited: message.isEdited,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: message.sender,
    };

    return await translateMessage(tempMessage, targetLanguage);
  }, [translateMessage]);

  // Basculer entre original et traduit
  const toggleOriginalTranslated = useCallback((
    messageId: string,
    translatedMessage: TranslatedMessage
  ): TranslatedMessage => {
    if (!translatedMessage.isTranslated || !translatedMessage.translatedContent) {
      return translatedMessage;
    }

    return {
      ...translatedMessage,
      showingOriginal: !translatedMessage.showingOriginal,
    };
  }, []);

  return {
    translateMessage,
    translateMessages,
    retranslateMessage,
    toggleOriginalTranslated,
    isTranslating,
    error,
    clearError,
    modelsStatus,
    preloadModels,
  };
};
