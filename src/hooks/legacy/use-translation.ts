'use client';

import { useState, useCallback, useEffect } from 'react';
import { Message, User, TranslatedMessage } from '@/types';
import { translateMessage, detectLanguage } from '@/utils/translation';

export function useTranslation(currentUser: User | null) {
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, TranslatedMessage>>(new Map());
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(false);

  // Vérifier si la traduction est activée pour l'utilisateur
  useEffect(() => {
    setIsTranslationEnabled(currentUser?.autoTranslateEnabled || false);
  }, [currentUser]);

  /**
   * Obtient la langue cible pour la traduction (langue que l'utilisateur comprend)
   */
  const getTargetLanguage = useCallback((): string => {
    if (!currentUser) return 'en';
    
    // Langue de destination personnalisée en priorité
    if (currentUser.customDestinationLanguage) {
      return currentUser.customDestinationLanguage;
    }
    
    // Sinon, langue système
    return currentUser.systemLanguage || 'en';
  }, [currentUser]);

  /**
   * Traduit automatiquement un message reçu vers la langue de l'utilisateur
   */
  const translateIncomingMessage = useCallback(async (message: Message): Promise<void> => {
    if (!currentUser || !isTranslationEnabled) {
      // Pas de traduction, juste stocker le message original
      setTranslatedMessages(prev => new Map(prev.set(message.id, {
        ...message,
        isTranslated: false,
        showingOriginal: false,
      })));
      return;
    }

    const targetLanguage = getTargetLanguage();
    const sourceLanguage = message.originalLanguage || detectLanguage(message.content);

    // Si même langue, pas de traduction nécessaire
    if (sourceLanguage === targetLanguage) {
      setTranslatedMessages(prev => new Map(prev.set(message.id, {
        ...message,
        originalLanguage: sourceLanguage,
        isTranslated: false,
        showingOriginal: false,
      })));
      return;
    }

    // Marquer comme en cours de traduction
    setTranslatedMessages(prev => new Map(prev.set(message.id, {
      ...message,
      originalLanguage: sourceLanguage,
      isTranslating: true,
      isTranslated: false,
      showingOriginal: false,
    })));

    try {
      console.log(`🔄 Traduction de "${message.content}" (${sourceLanguage} → ${targetLanguage})`);
      
      const translatedContent = await translateMessage(
        message.content,
        sourceLanguage,
        targetLanguage
      );
      
      console.log(`✅ Traduction réussie: "${translatedContent}"`);

      // Sauvegarder la traduction réussie
      setTranslatedMessages(prev => new Map(prev.set(message.id, {
        ...message,
        originalLanguage: sourceLanguage,
        translatedContent,
        targetLanguage,
        isTranslated: true,
        isTranslating: false,
        showingOriginal: false,
        translationError: undefined,
      })));

    } catch (error) {
      console.error('❌ Erreur de traduction:', error);

      // Sauvegarder l'erreur et afficher le message original
      setTranslatedMessages(prev => new Map(prev.set(message.id, {
        ...message,
        originalLanguage: sourceLanguage,
        isTranslated: false,
        isTranslating: false,
        showingOriginal: true,
        translationError: 'Échec de traduction',
      })));
    }
  }, [currentUser, isTranslationEnabled, getTargetLanguage]);

  /**
   * Bascule entre le message original et traduit
   */
  const toggleMessageTranslation = useCallback((messageId: string): void => {
    const message = translatedMessages.get(messageId);
    if (!message) return;

    // Si on a une traduction, basculer l'affichage
    if (message.isTranslated && message.translatedContent) {
      setTranslatedMessages(prev => new Map(prev.set(messageId, {
        ...message,
        showingOriginal: !message.showingOriginal,
      })));
    }
  }, [translatedMessages]);

  /**
   * Force la retraduction d'un message
   */
  const retranslateMessage = useCallback(async (messageId: string): Promise<void> => {
    const message = translatedMessages.get(messageId);
    if (!message || !currentUser) return;

    const targetLanguage = getTargetLanguage();
    const sourceLanguage = message.originalLanguage || detectLanguage(message.content);

    // Marquer comme en cours de traduction
    setTranslatedMessages(prev => new Map(prev.set(messageId, {
      ...message,
      isTranslating: true,
      translationError: undefined,
    })));

    try {
      const translatedContent = await translateMessage(
        message.content,
        sourceLanguage,
        targetLanguage
      );

      setTranslatedMessages(prev => new Map(prev.set(messageId, {
        ...message,
        translatedContent,
        targetLanguage,
        isTranslated: true,
        isTranslating: false,
        showingOriginal: false,
        translationError: undefined,
      })));

    } catch (error) {
      console.error('Erreur de retraduction:', error);

      setTranslatedMessages(prev => new Map(prev.set(messageId, {
        ...message,
        isTranslating: false,
        showingOriginal: true,
        translationError: 'Échec de traduction',
      })));
    }
  }, [translatedMessages, currentUser, getTargetLanguage]);

  /**
   * Ajoute un nouveau message (envoyé ou reçu)
   */
  const addMessage = useCallback((message: Message): void => {
    // Pour les messages reçus (pas envoyés par l'utilisateur actuel), traduire automatiquement
    if (currentUser && message.senderId !== currentUser.id) {
      translateIncomingMessage(message);
    } else {
      // Pour les messages envoyés, juste les stocker sans traduction
      setTranslatedMessages(prev => new Map(prev.set(message.id, {
        ...message,
        originalLanguage: message.originalLanguage || detectLanguage(message.content),
        isTranslated: false,
        showingOriginal: false,
      })));
    }
  }, [currentUser, translateIncomingMessage]);

  /**
   * Obtient le message formaté pour l'affichage
   */
  const getDisplayedMessage = useCallback((messageId: string): TranslatedMessage | undefined => {
    return translatedMessages.get(messageId);
  }, [translatedMessages]);

  /**
   * Obtient le contenu à afficher (original ou traduit)
   */
  const getMessageContent = useCallback((messageId: string): string => {
    const message = translatedMessages.get(messageId);
    if (!message) return '';
    
    // Si on affiche l'original ou qu'il n'y a pas de traduction
    if (message.showingOriginal || !message.isTranslated || !message.translatedContent) {
      return message.content;
    }
    
    // Sinon afficher la traduction
    return message.translatedContent;
  }, [translatedMessages]);

  /**
   * Vérifie si un message est en cours de traduction
   */
  const isMessageTranslating = useCallback((messageId: string): boolean => {
    const message = translatedMessages.get(messageId);
    return message?.isTranslating || false;
  }, [translatedMessages]);

  /**
   * Vérifie si un message a une erreur de traduction
   */
  const hasTranslationError = useCallback((messageId: string): boolean => {
    const message = translatedMessages.get(messageId);
    return Boolean(message?.translationError);
  }, [translatedMessages]);

  /**
   * Obtient l'erreur de traduction d'un message
   */
  const getTranslationError = useCallback((messageId: string): string | undefined => {
    const message = translatedMessages.get(messageId);
    return message?.translationError;
  }, [translatedMessages]);

  return {
    // État
    isTranslationEnabled,
    
    // Actions
    addMessage,
    toggleMessageTranslation,
    retranslateMessage,
    
    // Getters
    getDisplayedMessage,
    getMessageContent,
    isMessageTranslating,
    hasTranslationError,
    getTranslationError,
    
    // Utilitaires
    detectLanguage,
  };
}
