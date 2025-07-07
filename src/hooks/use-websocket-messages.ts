'use client';

import { useEffect, useCallback } from 'react';
import { translationPersistenceService } from '@/services/translation-persistence.service';
import realtimeService, { MessageEvent } from '@/services/realtimeService';
import type { Message } from '@/types';

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

    // Lors de l'édition d'un message, nous pourrions vouloir 
    // réinitialiser ses traductions ou les conserver
    // Pour l'instant, on conserve les traductions existantes

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
    if (!realtimeService.isSocketConnected()) return;

    // S'abonner aux événements de messages
    const unsubscribeMessage = realtimeService.onMessage((messageEvent: MessageEvent) => {
      if (messageEvent.type === 'new_message') {
        handleNewMessage(messageEvent);
      } else if (messageEvent.type === 'message_edited') {
        handleMessageEdited(messageEvent);
      } else if (messageEvent.type === 'message_deleted') {
        handleMessageDeleted(messageEvent);
      }
    });

    return () => {
      unsubscribeMessage();
    };
  }, [handleNewMessage, handleMessageEdited, handleMessageDeleted]);

  // Auto-join/leave conversation
  useEffect(() => {
    if (conversationId && realtimeService.isSocketConnected()) {
      realtimeService.joinConversation(conversationId);
      
      return () => {
        realtimeService.leaveConversation(conversationId);
      };
    }
  }, [conversationId]);

  return {
    isConnected: realtimeService.isSocketConnected(),
    joinConversation: (id: string) => realtimeService.joinConversation(id),
    leaveConversation: (id: string) => realtimeService.leaveConversation(id),
    startTyping: (id: string) => realtimeService.startTyping(id),
    stopTyping: (id: string) => realtimeService.stopTyping(id),
  };
};
