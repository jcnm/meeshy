'use client';

import { useState, useCallback } from 'react';
import { translateMessage, detectLanguage } from '@/utils/translation';
import type { Message, TranslatedMessage, User } from '@/types';

interface UseOptimizedMessageTranslationReturn {
  translateMessage: (message: Message, targetLanguage: string) => Promise<TranslatedMessage>;
  translateMessages: (messages: Message[], targetLanguage: string) => Promise<TranslatedMessage[]>;
  retranslateMessage: (messageId: string, message: TranslatedMessage, targetLanguage: string) => Promise<TranslatedMessage>;
  toggleOriginalTranslated: (messageId: string, translatedMessage: TranslatedMessage) => TranslatedMessage;
  isTranslating: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook optimisé pour la traduction de messages avec cache intelligent
 */
export const useOptimizedMessageTranslation = (currentUser: User | null): UseOptimizedMessageTranslationReturn => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effacer les erreurs
  const clearError = useCallback(() => {
    setError(null);
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

  // Traduire un message unique
  const translateSingleMessage = useCallback(async (message: Message, targetLanguage: string): Promise<TranslatedMessage> => {
    const translatedMessage = convertToTranslatedMessage(message);
    
    if (!currentUser || !message.content?.trim()) {
      return translatedMessage;
    }

    // Détecter la langue source
    const sourceLanguage = message.originalLanguage || detectLanguage(message.content);
    
    // Si même langue, pas besoin de traduire
    if (sourceLanguage === targetLanguage) {
      return {
        ...translatedMessage,
        translatedContent: message.content,
        targetLanguage,
        isTranslated: false,
        showingOriginal: true,
      };
    }

    try {
      console.log(`🔄 Traduction: ${sourceLanguage} → ${targetLanguage}`);
      
      // Utiliser le service de traduction unifié
      const translatedText = await translateMessage(message.content, sourceLanguage, targetLanguage);
      
      return {
        ...translatedMessage,
        originalContent: message.content,
        translatedContent: translatedText,
        targetLanguage,
        isTranslated: true,
        showingOriginal: false,
        translationError: undefined,
        translationFailed: false,
      };
    } catch (error) {
      console.error('❌ Erreur de traduction:', error);
      
      return {
        ...translatedMessage,
        translationError: error instanceof Error ? error.message : 'Erreur de traduction',
        translationFailed: true,
        isTranslated: false,
        showingOriginal: true,
      };
    }
  }, [currentUser, convertToTranslatedMessage]);

  // Traduire plusieurs messages
  const translateMultipleMessages = useCallback(async (messages: Message[], targetLanguage: string): Promise<TranslatedMessage[]> => {
    if (!currentUser || !messages.length) {
      return messages.map(msg => convertToTranslatedMessage(msg));
    }

    setIsTranslating(true);
    setError(null);

    try {
      console.log(`🔄 Traduction de ${messages.length} messages vers ${targetLanguage}`);
      
      // Traduire tous les messages en parallèle
      const translationPromises = messages.map(message => translateSingleMessage(message, targetLanguage));
      const translatedMessages = await Promise.all(translationPromises);
      
      console.log(`✅ ${translatedMessages.length} messages traduits`);
      return translatedMessages;
    } catch (error) {
      console.error('❌ Erreur lors de la traduction des messages:', error);
      setError('Erreur lors de la traduction des messages');
      
      // Retourner les messages non traduits en cas d'erreur
      return messages.map(msg => convertToTranslatedMessage(msg));
    } finally {
      setIsTranslating(false);
    }
  }, [currentUser, convertToTranslatedMessage, translateSingleMessage]);

  // Retraduire un message
  const retranslateMessage = useCallback(async (messageId: string, message: TranslatedMessage, targetLanguage: string): Promise<TranslatedMessage> => {
    if (!currentUser) {
      return message;
    }

    try {
      setIsTranslating(true);
      setError(null);
      
      const originalMessage: Message = {
        id: message.id,
        content: message.originalContent || message.content,
        senderId: message.senderId,
        conversationId: message.conversationId,
        originalLanguage: message.originalLanguage,
        isEdited: message.isEdited,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        sender: message.sender,
      };
      
      const retranslated = await translateSingleMessage(originalMessage, targetLanguage);
      console.log(`🔄 Message ${messageId} retraduit vers ${targetLanguage}`);
      
      return retranslated;
    } catch (error) {
      console.error('❌ Erreur lors de la retraduction:', error);
      setError('Erreur lors de la retraduction');
      return message;
    } finally {
      setIsTranslating(false);
    }
  }, [currentUser, translateSingleMessage]);

  // Basculer entre original et traduit
  const toggleOriginalTranslated = useCallback((messageId: string, translatedMessage: TranslatedMessage): TranslatedMessage => {
    if (!translatedMessage.isTranslated || !translatedMessage.translatedContent) {
      return translatedMessage;
    }

    return {
      ...translatedMessage,
      showingOriginal: !translatedMessage.showingOriginal,
    };
  }, []);

  return {
    translateMessage: translateSingleMessage,
    translateMessages: translateMultipleMessages,
    retranslateMessage,
    toggleOriginalTranslated,
    isTranslating,
    error,
    clearError,
  };
};
