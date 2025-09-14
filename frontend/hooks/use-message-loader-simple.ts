import { useState, useCallback } from 'react';
import type { User, Message, MessageWithTranslations, MessageTranslation, TranslationData } from '@shared/types';
import { buildApiUrl } from '@/lib/config';

interface UseMessageLoaderSimpleProps {
  currentUser: User;
  conversationId?: string;
}

interface UseMessageLoaderSimpleReturn {
  messages: MessageWithTranslations[];
  isLoadingMessages: boolean;
  loadMessages: (conversationId: string, isNewConversation?: boolean) => Promise<void>;
  clearMessages: () => void;
  addMessage: (message: Message) => void;
  updateMessageTranslations: (messageId: string, translations: TranslationData[]) => void;
}

/**
 * Hook simplifié pour gérer les messages avec traductions
 * Version épurée sans la complexité des types multiples
 */
export function useMessageLoaderSimple({ 
  currentUser, 
  conversationId 
}: UseMessageLoaderSimpleProps): UseMessageLoaderSimpleReturn {
  
  const [messages, setMessages] = useState<MessageWithTranslations[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Fonction utilitaire pour convertir TranslationData vers MessageTranslation
  const createMessageTranslation = useCallback((translation: TranslationData, messageId: string): MessageTranslation => ({
    id: `${messageId}_${translation.targetLanguage}`,
    messageId,
    sourceLanguage: translation.sourceLanguage,
    targetLanguage: translation.targetLanguage,
    translatedContent: translation.translatedContent,
    translationModel: (translation.translationModel as 'basic' | 'medium' | 'premium') ?? 'basic',
    cacheKey: translation.cacheKey || `${messageId}_${translation.targetLanguage}`,
    confidenceScore: translation.confidenceScore,
    createdAt: translation.createdAt ? new Date(translation.createdAt) : new Date(),
  }), []);

  // Fonction utilitaire pour convertir Message vers MessageWithTranslations
  const ensureMessageWithTranslations = useCallback((message: Message): MessageWithTranslations => {
    if ('translations' in message && Array.isArray((message as any).translations)) {
      return message as MessageWithTranslations;
    }
    
    return {
      ...message,
      timestamp: message.createdAt, // Alias requis
      translations: []
    };
  }, []);

  // Charger les messages d'une conversation
  const loadMessages = useCallback(async (conversationId: string, isNewConversation = false) => {
    try {
      setIsLoadingMessages(true);
      
      if (isNewConversation) {
        setMessages([]);
      }
      
      console.log('🔄 Chargement des messages pour conversation:', conversationId);
      
      // Obtenir le token d'authentification
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ Pas de token d\'authentification disponible');
        return;
      }
      
      // Appel API pour charger les messages
      const response = await fetch(buildApiUrl(`/conversations/${conversationId}/messages`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
        if (response.ok) {
        const responseData = await response.json();
        console.log('📨 Messages reçus:', responseData);
        
        // Gérer différents formats de réponse
        let existingMessages = [];
        if (responseData.success && responseData.data) {
          // Format: { success: true, data: [...] }
          existingMessages = responseData.data;
        } else if (responseData.data?.messages) {
          existingMessages = responseData.data.messages;
        } else if (responseData.messages) {
          existingMessages = responseData.messages;
        } else if (Array.isArray(responseData)) {
          existingMessages = responseData;
        }        // Convertir les messages vers le format MessageWithTranslations
        const messagesWithTranslations = existingMessages.map(ensureMessageWithTranslations);
        setMessages(messagesWithTranslations);
        
        console.log('✅ Messages chargés:', messagesWithTranslations.length);
      } else {
        console.error('❌ Erreur lors du chargement des messages:', response.status, response.statusText);
      }
      
    } catch (error) {
      console.error('❌ Erreur lors du chargement des messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [ensureMessageWithTranslations]);

  // Vider les messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Ajouter un nouveau message
  const addMessage = useCallback((message: Message) => {
    const messageWithTranslations = ensureMessageWithTranslations(message);
    
    setMessages(prev => {
      // Éviter les doublons
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }
      
      // Ajouter le message à la fin (ordre chronologique)
      return [...prev, messageWithTranslations];
    });
  }, [ensureMessageWithTranslations]);

  // Mettre à jour les traductions d'un message
  const updateMessageTranslations = useCallback((messageId: string, translations: TranslationData[]) => {
    console.log('🌐 Mise à jour traductions pour message:', messageId, translations);
    
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        // Fusionner les traductions existantes avec les nouvelles
        const existingTranslations = msg.translations || [];
        const mergedTranslations = [...existingTranslations];
        
        translations.forEach(newTranslation => {
          const existingIndex = mergedTranslations.findIndex(
            existing => existing.targetLanguage === newTranslation.targetLanguage
          );
          
          const messageTranslation = createMessageTranslation(newTranslation, messageId);
          
          if (existingIndex >= 0) {
            mergedTranslations[existingIndex] = messageTranslation;
          } else {
            mergedTranslations.push(messageTranslation);
          }
        });
        
        return {
          ...msg,
          translations: mergedTranslations
        };
      }
      return msg;
    }));
  }, [createMessageTranslation]);

  return {
    messages,
    isLoadingMessages,
    loadMessages,
    clearMessages,
    addMessage,
    updateMessageTranslations,
  };
}