'use client';

import { useEffect, useCallback } from 'react';
import { translationPersistenceService } from '@/services/translation-persistence.service';
import { useWebSocket } from './use-websocket';
import type { Message } from '@/types';

interface MessageEvent {
  type: 'new_message' | 'message_edited' | 'message_deleted';
  message: Message;
  conversationId: string;
}

interface UseWebSocketMessagesOptions {
  conversationId?: string;
  onNewMessage?: (message: Message) => void;
  onMessageEdited?: (message: Message) => void;
  onMessageDeleted?: (messageId: string) => void;
  autoEnrichWithTranslations?: boolean;
}

/**
 * Hook pour gérer la réception et le traitement des messages WebSocket
 * avec persistance automatique des traductions
 */
export const useWebSocketMessages = (options: UseWebSocketMessagesOptions = {}) => {
  const {
    conversationId,
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    autoEnrichWithTranslations = true
  } = options;

  const { on, off, emit, isConnected } = useWebSocket();

  // Gestionnaire pour les nouveaux messages reçus
  const handleNewMessage = useCallback((messageEvent: MessageEvent) => {
    console.log('📨 Nouveau message WebSocket reçu:', messageEvent);
    
    // Vérifier que le message appartient à la conversation active
    if (conversationId && messageEvent.conversationId !== conversationId) {
      return;
    }

    const message = messageEvent.message as Message;
    
    // Si l'enrichissement automatique est activé, charger les traductions persistées
    if (autoEnrichWithTranslations) {
      const enrichedMessage = translationPersistenceService.enrichMessageWithTranslations(message);
      console.log(`🔄 Message ${message.id} enrichi avec ${enrichedMessage.translations?.length || 0} traductions persistées`);
    }

    // Déclencher le callback
    if (onNewMessage) {
      onNewMessage(message);
    }
  }, [conversationId, autoEnrichWithTranslations, onNewMessage]);

  // Gestionnaire pour les messages édités
  const handleMessageEdited = useCallback((messageEvent: MessageEvent) => {
    console.log('✏️ Message édité WebSocket reçu:', messageEvent);
    
    // Vérifier que le message appartient à la conversation active
    if (conversationId && messageEvent.conversationId !== conversationId) {
      return;
    }

    const message = messageEvent.message as Message;

    // Déclencher le callback
    if (onMessageEdited) {
      onMessageEdited(message);
    }
  }, [conversationId, onMessageEdited]);

  // Gestionnaire pour les messages supprimés
  const handleMessageDeleted = useCallback((messageEvent: MessageEvent) => {
    console.log('🗑️ Message supprimé WebSocket reçu:', messageEvent);
    
    // Vérifier que le message appartient à la conversation active
    if (conversationId && messageEvent.conversationId !== conversationId) {
      return;
    }

    const message = messageEvent.message as Message;
    
    // Supprimer les traductions persistées du message supprimé
    translationPersistenceService.deleteTranslations(message.id);
    console.log(`🗑️ Traductions supprimées pour le message ${message.id}`);

    // Déclencher le callback
    if (onMessageDeleted) {
      onMessageDeleted(message.id);
    }
  }, [conversationId, onMessageDeleted]);

  // Configurer les écouteurs WebSocket
  useEffect(() => {
    if (!isConnected) return;

    const handleMessage = (...args: unknown[]) => {
      const messageEvent = args[0] as MessageEvent;
      if (messageEvent.type === 'new_message') {
        handleNewMessage(messageEvent);
      } else if (messageEvent.type === 'message_edited') {
        handleMessageEdited(messageEvent);
      } else if (messageEvent.type === 'message_deleted') {
        handleMessageDeleted(messageEvent);
      }
    };

    // Écouter les événements selon les conventions du backend
    on('newMessage', handleMessage);
    on('messageEdited', handleMessage);
    on('messageDeleted', handleMessage);

    return () => {
      off('newMessage', handleMessage);
      off('messageEdited', handleMessage);
      off('messageDeleted', handleMessage);
    };
  }, [isConnected, handleNewMessage, handleMessageEdited, handleMessageDeleted, on, off]);

  // Auto-join/leave conversation
  useEffect(() => {
    if (conversationId && isConnected) {
      emit('joinConversation', { conversationId });
      
      return () => {
        emit('leaveConversation', { conversationId });
      };
    }
  }, [conversationId, isConnected, emit]);

  return {
    isConnected,
    joinConversation: (id: string) => emit('joinConversation', { conversationId: id }),
    leaveConversation: (id: string) => emit('leaveConversation', { conversationId: id }),
    startTyping: (id: string) => emit('startTyping', { conversationId: id }),
    stopTyping: (id: string) => emit('stopTyping', { conversationId: id }),
  };
};
