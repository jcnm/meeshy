/**
 * Hook unifié WebSocket pour Meeshy
 * Combine connexion WebSocket de base et gestion des messages
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { translationService } from '@/services/translation.service';
import type { Message } from '@/types';

// Types pour WebSocket de base
interface UseWebSocketReturn {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback?: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
  isConnected: boolean;
}

// Types pour les messages WebSocket
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

interface UseWebSocketMessagesReturn {
  sendMessage: (content: string, conversationId: string) => void;
  editMessage: (messageId: string, newContent: string) => void;
  deleteMessage: (messageId: string) => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
}

/**
 * Hook WebSocket de base - Gestion de la connexion
 */
export function useWebSocket(): UseWebSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Récupérer le token JWT depuis localStorage
    const token = localStorage.getItem('auth_token');

    if (!token) {
      console.warn('⚠️ Aucun token JWT trouvé, connexion WebSocket refusée');
      return;
    }

    // Créer la connexion socket avec authentification
    const socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: {
        token
      }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ WebSocket connecté');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket déconnecté');
      setIsConnected(false);
    });

    socket.on('error', (error) => {
      console.error('❌ Erreur WebSocket:', error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, []);

  const on = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, ...args);
    }
  }, [isConnected]);

  return {
    on,
    off,
    emit,
    isConnected,
  };
}

/**
 * Hook WebSocket spécialisé pour les messages
 * Gère la réception et l'envoi de messages avec traductions automatiques
 */
export const useWebSocketMessages = (options: UseWebSocketMessagesOptions = {}): UseWebSocketMessagesReturn => {
  const {
    conversationId,
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    autoEnrichWithTranslations = false
  } = options;

  const { on, off, emit, isConnected } = useWebSocket();

  // Gestion des messages entrants
  useEffect(() => {
    if (!isConnected) return;

    const handleMessageEvent = async (event: MessageEvent) => {
      const { type, message, conversationId: eventConversationId } = event;

      // Filtrer par conversation si spécifiée
      if (conversationId && eventConversationId !== conversationId) {
        return;
      }

      try {
        let processedMessage = message;

        // Enrichir avec les traductions si demandé
        if (autoEnrichWithTranslations && message.content) {
          try {
            const translationResult = await translationService.translateSimple(
              message.content,
              'auto', // Détection automatique
              'fr'
            );
            
            // Ajouter la traduction au message (structure flexible)
            if ('translations' in processedMessage) {
              // @ts-ignore - Structure flexible pour les traductions
              processedMessage.translations = processedMessage.translations || [];
              // @ts-ignore
              processedMessage.translations.push({
                text: translationResult.translatedText,
                targetLanguage: 'fr',
                sourceLanguage: translationResult.sourceLanguage,
                modelUsed: translationResult.modelUsed,
                timestamp: Date.now(),
                confidence: translationResult.confidence || 0.9
              });
            }
          } catch (translationError) {
            console.warn('Échec de la traduction automatique:', translationError);
          }
        }

        // Dispatcher selon le type d'événement
        switch (type) {
          case 'new_message':
            onNewMessage?.(processedMessage);
            break;
          case 'message_edited':
            onMessageEdited?.(processedMessage);
            break;
          case 'message_deleted':
            onMessageDeleted?.(message.id);
            break;
        }
      } catch (error) {
        console.error('Erreur lors du traitement du message:', error);
      }
    };

    // Écouter les événements de messages
    on('message_event', handleMessageEvent);
    on('new_message', (message: Message) => handleMessageEvent({ 
      type: 'new_message', 
      message, 
      conversationId: message.conversationId 
    }));
    on('message_edited', (message: Message) => handleMessageEvent({ 
      type: 'message_edited', 
      message, 
      conversationId: message.conversationId 
    }));
    on('message_deleted', (data: { messageId: string; conversationId: string }) => {
      handleMessageEvent({ 
        type: 'message_deleted', 
        message: { id: data.messageId } as Message, 
        conversationId: data.conversationId 
      });
    });

    return () => {
      off('message_event');
      off('new_message');
      off('message_edited');
      off('message_deleted');
    };
  }, [isConnected, conversationId, onNewMessage, onMessageEdited, onMessageDeleted, autoEnrichWithTranslations, on, off]);

  // Actions de messages
  const sendMessage = useCallback((content: string, conversationId: string) => {
    emit('send_message', { content, conversationId });
  }, [emit]);

  const editMessage = useCallback((messageId: string, newContent: string) => {
    emit('edit_message', { messageId, content: newContent });
  }, [emit]);

  const deleteMessage = useCallback((messageId: string) => {
    emit('delete_message', { messageId });
  }, [emit]);

  const joinConversation = useCallback((conversationId: string) => {
    emit('join_conversation', { conversationId });
  }, [emit]);

  const leaveConversation = useCallback((conversationId: string) => {
    emit('leave_conversation', { conversationId });
  }, [emit]);

  return {
    sendMessage,
    editMessage,
    deleteMessage,
    joinConversation,
    leaveConversation
  };
};
