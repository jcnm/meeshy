/**
 * Hook useSocketIOMessaging - Wrapper de compatibilité
 * @deprecated Utiliser useWebSocket directement à la place
 * 
 * Ce hook maintient l'API existante pour compatibilité
 * mais utilise le nouveau service WebSocket simplifié en interne
 */

'use client';

import { useWebSocket } from './use-websocket';
import type { Message, User } from '@/types';

export interface UseSocketIOMessagingOptions {
  conversationId?: string | null;
  currentUser?: User | null;
  events?: any;
  onNewMessage?: (message: Message) => void;
  onMessageEdited?: (message: Message) => void;
  onMessageDeleted?: (messageId: string) => void;
  onUserTyping?: (userId: string, username: string, isTyping: boolean) => void;
  onUserStatus?: (userId: string, username: string, isOnline: boolean) => void;
  onTranslation?: (messageId: string, translations: any[]) => void;
  onConversationStats?: (data: any) => void;
  onConversationOnlineStats?: (data: any) => void;
}

/**
 * Hook de compatibilité - Wrapper autour de useWebSocket
 */
export function useSocketIOMessaging(options: UseSocketIOMessagingOptions = {}) {
  const {
    conversationId,
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    onUserTyping,
    onUserStatus,
    onTranslation,
  } = options;

  // Utiliser le nouveau hook simplifié
  const ws = useWebSocket({
    conversationId,
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    onTyping: onUserTyping ? (event) => {
      onUserTyping(event.userId, event.username, event.isTyping || false);
    } : undefined,
    onUserStatus: onUserStatus ? (event) => {
      onUserStatus(event.userId, event.username, event.isOnline);
    } : undefined,
    onTranslation: onTranslation ? (data) => {
      onTranslation(data.messageId, data.translations);
    } : undefined,
  });

  // Retourner une API compatible avec l'ancien hook
  return {
    ...ws,
    connectionStatus: ws.status,
    // Adapter les méthodes pour l'ancienne API
    sendMessage: ws.sendMessage,
    sendMessageWithAttachments: ws.sendMessageWithAttachments,
    editMessage: ws.editMessage,
    deleteMessage: ws.deleteMessage,
    startTyping: ws.startTyping,
    stopTyping: ws.stopTyping,
    reconnect: ws.reconnect,
    getDiagnostics: ws.getDiagnostics
  };
}
