/**
 * Hook Simple pour WebSocket
 * 
 * UTILISATION:
 * 
 * // Dans n'importe quelle page avec conversation
 * const { sendMessage, messages } = useSimpleWebSocket({
 *   conversationId: 'meeshy',  // ou ID dynamique
 *   onNewMessage: (msg) => console.log('Message reçu:', msg)
 * });
 * 
 * // Envoyer un message
 * await sendMessage('Hello', 'en');
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { webSocketService } from '@/services/websocket.service';
import type { Message, TranslationEvent, TypingEvent, UserStatusEvent } from '@/types';

export interface UseWebSocketOptions {
  conversationId?: string | null;
  onNewMessage?: (message: Message) => void;
  onTranslation?: (data: TranslationEvent) => void;
  onTyping?: (event: TypingEvent) => void;
  onUserStatus?: (event: UserStatusEvent) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { conversationId, onNewMessage, onTranslation, onTyping, onUserStatus } = options;
  
  const [isConnected, setIsConnected] = useState(false);

  // ÉTAPE 1: Gérer le join/leave de conversation
  useEffect(() => {
    if (!conversationId) return;
    
    console.log('🚪 [HOOK] Join conversation:', conversationId);
    simpleWebSocketService.joinConversation(conversationId);
    
    return () => {
      console.log('🚪 [HOOK] Leave conversation:', conversationId);
      simpleWebSocketService.leaveConversation(conversationId);
    };
  }, [conversationId]);

  // ÉTAPE 2: Configurer les listeners
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    
    if (onNewMessage) {
      const unsub = simpleWebSocketService.onNewMessage(onNewMessage);
      unsubscribers.push(unsub);
    }
    
    if (onTranslation) {
      const unsub = simpleWebSocketService.onTranslation(onTranslation);
      unsubscribers.push(unsub);
    }
    
    if (onTyping) {
      const unsub = simpleWebSocketService.onTyping(onTyping);
      unsubscribers.push(unsub);
    }
    
    if (onUserStatus) {
      const unsub = simpleWebSocketService.onUserStatus(onUserStatus);
      unsubscribers.push(unsub);
    }
    
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [onNewMessage, onTranslation, onTyping, onUserStatus]);

  // ÉTAPE 3: Surveiller l'état de connexion
  useEffect(() => {
    const interval = setInterval(() => {
      const connected = simpleWebSocketService.isConnected();
      setIsConnected(connected);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // ÉTAPE 4: Actions
  const sendMessage = useCallback(async (
    content: string, 
    language: string,
    replyToId?: string
  ): Promise<boolean> => {
    if (!conversationId) {
      console.error('❌ [HOOK] Pas de conversationId');
      return false;
    }
    
    return await simpleWebSocketService.sendMessage(conversationId, content, language, replyToId);
  }, [conversationId]);

  const startTyping = useCallback(() => {
    if (conversationId) {
      simpleWebSocketService.startTyping(conversationId);
    }
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (conversationId) {
      simpleWebSocketService.stopTyping(conversationId);
    }
  }, [conversationId]);

  const reconnect = useCallback(() => {
    simpleWebSocketService.reconnect();
  }, []);

  return {
    isConnected,
    sendMessage,
    startTyping,
    stopTyping,
    reconnect,
    status: simpleWebSocketService.getConnectionStatus()
  };
}

