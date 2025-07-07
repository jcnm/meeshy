'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSimpleTranslation } from './use-simple-translation';
import { getCachedTranslation, setCachedTranslation } from '@/utils/translation';
import { translationPersistenceService } from '@/services/translation-persistence.service';
import type { Message, TranslatedMessage, User, TranslationModelType, Translation } from '@/types';
import { SUPPORTED_LANGUAGES } from '@/types';

interface UseMessageTranslationReturn {
  translateMessage: (message: Message, targetLanguage: string) => Promise<TranslatedMessage>;
  translateMessages: (messages: Message[], targetLanguage: string) => Promise<TranslatedMessage[]>;
  isTranslating: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook pour gérer la traduction des messages avec cache et sélection de modèle automatique
 */
export const useMessageTranslation = (currentUser: User | null): UseMessageTranslationReturn => {
  const { translateWithModel, isTranslating, error: translationError } = useSimpleTranslation();
  const [error, setError] = useState<string | null>(null);

  // Effacer les erreurs
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Détecter la complexité du message pour choisir le modèle approprié
  const getOptimalModel = useCallback((text: string): 'mt5' | 'nllb' => {
    // Règles de sélection basées sur les instructions
    const isShort = text.length <= 50;
    const hasComplexSyntax = /[,.;:!?(){}[\]"'`]/.test(text) || text.split(' ').length > 10;
    
    // MT5 pour messages courts et simples, NLLB pour le reste
    if (isShort && !hasComplexSyntax) {
      return 'mt5';
    }
    return 'nllb';
  }, []);

  // Mapper le nom de modèle vers le type TranslationModelType
  const getModelType = useCallback((model: 'mt5' | 'nllb'): TranslationModelType => {
    return model === 'mt5' ? 'MT5_BASE' : 'NLLB_DISTILLED_600M';
  }, []);

  // Convertir un Message en TranslatedMessage
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

  // Traduire un message unique
  const translateMessage = useCallback(async (
    message: Message,
    targetLanguage: string
  ): Promise<TranslatedMessage> => {
    const translatedMessage = convertToTranslatedMessage(message);

    // Si c'est le même utilisateur, pas besoin de traduire
    if (currentUser && message.senderId === currentUser.id) {
      return translatedMessage;
    }

    // Si même langue, pas besoin de traduire
    if (message.originalLanguage === targetLanguage) {
      return translatedMessage;
    }

    try {
      setError(null);

      // Vérifier le cache d'abord
      const cacheKey = `${message.content}-${message.originalLanguage}-${targetLanguage}`;
      const cached = getCachedTranslation(cacheKey, message.originalLanguage, targetLanguage);
      
      if (cached) {
        console.log(`📦 Traduction trouvée en cache pour le message ${message.id}`);
        return {
          ...translatedMessage,
          translatedContent: cached,
          targetLanguage,
          isTranslated: true,
          showingOriginal: false,
        };
      }

      // Marquer comme en cours de traduction
      translatedMessage.isTranslating = true;

      // Choisir le modèle optimal
      const optimalModel = getOptimalModel(message.content);
      console.log(`🤖 Utilisation du modèle ${optimalModel} pour traduire: "${message.content}"`);

      // Traduire avec le modèle choisi
      const translatedText = await translateWithModel(
        message.content,
        message.originalLanguage,
        targetLanguage,
        optimalModel
      );

      // Sauvegarder en cache
      setCachedTranslation(cacheKey, message.originalLanguage, targetLanguage, translatedText);

      console.log(`✅ Message ${message.id} traduit: "${translatedText}"`);

      // Créer l'objet Translation avec le drapeau approprié
      const flag = SUPPORTED_LANGUAGES.find(lang => lang.code === targetLanguage)?.flag || '🌍';
      const newTranslation: Translation = {
        language: targetLanguage,
        content: translatedText,
        flag,
        createdAt: new Date(),
        modelUsed: getModelType(optimalModel),
      };

      // Sauvegarder la traduction via le service de persistance
      const allTranslations = translationPersistenceService.addTranslation(message.id, newTranslation, false);
      console.log(`💾 Traduction persistée pour le message ${message.id} en ${targetLanguage}`);

      return {
        ...translatedMessage,
        translatedContent: translatedText,
        targetLanguage,
        isTranslated: true,
        isTranslating: false,
        showingOriginal: false,
        translations: allTranslations,
        modelUsed: getModelType(optimalModel),
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
    }
  }, [currentUser, convertToTranslatedMessage, getOptimalModel, getModelType, translateWithModel]);

  // Traduire plusieurs messages
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

    // Traiter les messages un par un pour éviter de surcharger les modèles
    for (const message of messages) {
      try {
        const translatedMessage = await translateMessage(message, targetLanguage);
        translatedMessages.push(translatedMessage);
      } catch (error) {
        console.error(`❌ Erreur lors de la traduction du message ${message.id}:`, error);
        // En cas d'erreur, ajouter le message sans traduction
        translatedMessages.push(convertToTranslatedMessage(message));
      }
    }

    console.log(`✅ Traduction de ${messages.length} messages terminée`);
    return translatedMessages;
  }, [currentUser, translateMessage, convertToTranslatedMessage]);

  // Synchroniser les erreurs avec le hook de traduction
  useEffect(() => {
    if (translationError) {
      setError(translationError);
    }
  }, [translationError]);

  return {
    translateMessage,
    translateMessages,
    isTranslating,
    error,
    clearError,
  };
};
