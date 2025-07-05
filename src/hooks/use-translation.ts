'use client';

import { useState, useCallback, useEffect } from 'react';
import { Message, User, TranslationModel } from '@/types';
import { translateMessage, detectLanguage } from '@/utils/translation';

interface TranslatedMessage extends Message {
  translatedContent?: string;
  isTranslated?: boolean;
  isTranslating?: boolean;
  translationError?: string;
}

export function useTranslation(currentUser: User | null) {
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, TranslatedMessage>>(new Map());
  const [translationModels, setTranslationModels] = useState<TranslationModel[]>([
    { name: 'MT5', isLoaded: false },
    { name: 'NLLB', isLoaded: false },
  ]);

  // Simuler le chargement des modèles de traduction
  useEffect(() => {
    const loadModels = async () => {
      // Simulation du chargement des modèles
      setTimeout(() => {
        setTranslationModels(prev => 
          prev.map(model => ({ ...model, isLoaded: true }))
        );
      }, 2000);
    };

    loadModels();
  }, []);

  const getTargetLanguage = useCallback((user: User): string => {
    if (!user.autoTranslateEnabled) return '';
    
    if (user.useCustomDestination && user.customDestinationLanguage) {
      return user.customDestinationLanguage;
    }
    
    if (user.translateToSystemLanguage) {
      return user.systemLanguage;
    }
    
    if (user.translateToRegionalLanguage) {
      return user.regionalLanguage;
    }
    
    return '';
  }, []);

  const translateMessageContent = useCallback(async (
    message: Message,
    targetLanguage: string
  ): Promise<string> => {
    if (!targetLanguage || message.originalLanguage === targetLanguage) {
      return message.content;
    }

    try {
      const translatedContent = await translateMessage(
        message.content,
        message.originalLanguage,
        targetLanguage
      );
      
      return translatedContent;
    } catch (error) {
      console.error('Erreur de traduction:', error);
      throw error;
    }
  }, []);

  const translateIncomingMessage = useCallback(async (message: Message): Promise<void> => {
    if (!currentUser) return;

    const targetLanguage = getTargetLanguage(currentUser);
    if (!targetLanguage) {
      // Pas de traduction nécessaire
      setTranslatedMessages(prev => new Map(prev.set(message.id, {
        ...message,
        isTranslated: false,
      })));
      return;
    }

    // Marquer le message comme en cours de traduction
    setTranslatedMessages(prev => new Map(prev.set(message.id, {
      ...message,
      isTranslating: true,
      isTranslated: false,
    })));

    try {
      const translatedContent = await translateMessageContent(message, targetLanguage);
      
      setTranslatedMessages(prev => new Map(prev.set(message.id, {
        ...message,
        translatedContent,
        isTranslated: true,
        isTranslating: false,
      })));
    } catch (error) {
      setTranslatedMessages(prev => new Map(prev.set(message.id, {
        ...message,
        isTranslating: false,
        isTranslated: false,
        translationError: error instanceof Error ? error.message : 'Erreur de traduction',
      })));
    }
  }, [currentUser, getTargetLanguage, translateMessageContent]);

  const toggleMessageTranslation = useCallback(async (messageId: string): Promise<void> => {
    const translatedMessage = translatedMessages.get(messageId);
    if (!translatedMessage || !currentUser) return;

    if (translatedMessage.isTranslated && translatedMessage.translatedContent) {
      // Basculer entre original et traduit
      setTranslatedMessages(prev => new Map(prev.set(messageId, {
        ...translatedMessage,
        isTranslated: !translatedMessage.isTranslated,
      })));
    } else if (!translatedMessage.translatedContent && !translatedMessage.isTranslating) {
      // Traduire le message pour la première fois
      await translateIncomingMessage(translatedMessage);
    }
  }, [translatedMessages, currentUser, translateIncomingMessage]);

  const retranslateMessage = useCallback(async (messageId: string): Promise<void> => {
    const translatedMessage = translatedMessages.get(messageId);
    if (!translatedMessage || !currentUser) return;

    const targetLanguage = getTargetLanguage(currentUser);
    if (!targetLanguage) return;

    // Marquer comme en cours de traduction
    setTranslatedMessages(prev => new Map(prev.set(messageId, {
      ...translatedMessage,
      isTranslating: true,
      translationError: undefined,
    })));

    try {
      const translatedContent = await translateMessageContent(translatedMessage, targetLanguage);
      
      setTranslatedMessages(prev => new Map(prev.set(messageId, {
        ...translatedMessage,
        translatedContent,
        isTranslated: true,
        isTranslating: false,
        translationError: undefined,
      })));
    } catch (error) {
      setTranslatedMessages(prev => new Map(prev.set(messageId, {
        ...translatedMessage,
        isTranslating: false,
        translationError: error instanceof Error ? error.message : 'Erreur de traduction',
      })));
    }
  }, [translatedMessages, currentUser, getTargetLanguage, translateMessageContent]);

  const addMessage = useCallback((message: Message): void => {
    // Ajouter le message et le traduire automatiquement si nécessaire
    setTranslatedMessages(prev => new Map(prev.set(message.id, message)));
    
    if (currentUser?.autoTranslateEnabled) {
      translateIncomingMessage(message);
    }
  }, [currentUser, translateIncomingMessage]);

  const getDisplayedMessage = useCallback((messageId: string): TranslatedMessage | undefined => {
    return translatedMessages.get(messageId);
  }, [translatedMessages]);

  const getMessageContent = useCallback((messageId: string): string => {
    const message = translatedMessages.get(messageId);
    if (!message) return '';
    
    if (message.isTranslated && message.translatedContent) {
      return message.translatedContent;
    }
    
    return message.content;
  }, [translatedMessages]);

  const isTranslationAvailable = useCallback((): boolean => {
    return translationModels.every(model => model.isLoaded);
  }, [translationModels]);

  return {
    // État
    translatedMessages: Array.from(translatedMessages.values()),
    translationModels,
    isTranslationAvailable: isTranslationAvailable(),
    
    // Actions
    translateIncomingMessage,
    toggleMessageTranslation,
    retranslateMessage,
    addMessage,
    getDisplayedMessage,
    getMessageContent,
    
    // Utilitaires
    detectLanguage,
  };
}
