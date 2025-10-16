/**
 * Hook useSocketIOMessaging - Gestion des messages temps réel
 * 
 * Utilise meeshy-socketio.service.ts pour une compatibilité complète
 * avec les identifiants de conversation (ObjectId, identifier, objet)
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { meeshySocketIOService } from '@/services/meeshy-socketio.service';
import type { Message, User, TypingEvent, UserStatusEvent, TranslationEvent } from '@/types';

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
 * Hook pour la gestion des messages temps réel via Socket.IO
 */
export function useSocketIOMessaging(options: UseSocketIOMessagingOptions = {}) {
  const {
    conversationId,
    currentUser,
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    onUserTyping,
    onUserStatus,
    onTranslation,
    onConversationStats,
    onConversationOnlineStats
  } = options;

  const [isConnected, setIsConnected] = useState(false);

  // ÉTAPE 1: Pas besoin d'initialiser explicitement - le service s'initialise automatiquement
  // avec les tokens disponibles dans localStorage

  // ÉTAPE 2: Gérer le join/leave de conversation
  useEffect(() => {
    if (!conversationId) return;
    
    console.log('🚪 [useSocketIOMessaging] Join conversation:', conversationId);
    
    // Support des identifiants et ObjectId
    const conversationIdOrObject = conversationId.includes('-') 
      ? conversationId // ObjectId
      : { identifier: conversationId }; // Identifiant lisible
    
    meeshySocketIOService.joinConversation(conversationIdOrObject);
    
    return () => {
      console.log('🚪 [useSocketIOMessaging] Leave conversation:', conversationId);
      meeshySocketIOService.leaveConversation(conversationIdOrObject);
    };
  }, [conversationId]);

  // ÉTAPE 3: Configurer les listeners
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    
    if (onNewMessage) {
      const unsub = meeshySocketIOService.onNewMessage(onNewMessage);
      unsubscribers.push(unsub);
    }
    
    if (onMessageEdited) {
      const unsub = meeshySocketIOService.onMessageEdited(onMessageEdited);
      unsubscribers.push(unsub);
    }
    
    if (onMessageDeleted) {
      const unsub = meeshySocketIOService.onMessageDeleted(onMessageDeleted);
      unsubscribers.push(unsub);
    }
    
    if (onTranslation) {
      const unsub = meeshySocketIOService.onTranslation((data: TranslationEvent) => {
        onTranslation(data.messageId, data.translations);
      });
      unsubscribers.push(unsub);
    }
    
    if (onUserTyping) {
      const unsub = meeshySocketIOService.onTyping((event: TypingEvent) => {
        onUserTyping(event.userId, event.username, event.isTyping || false);
      });
      unsubscribers.push(unsub);
    }
    
    if (onUserStatus) {
      const unsub = meeshySocketIOService.onUserStatus((event: UserStatusEvent) => {
        onUserStatus(event.userId, event.username, event.isOnline);
      });
      unsubscribers.push(unsub);
    }

    if (onConversationStats) {
      const unsub = meeshySocketIOService.onConversationStats(onConversationStats);
      unsubscribers.push(unsub);
    }

    if (onConversationOnlineStats) {
      const unsub = meeshySocketIOService.onConversationOnlineStats(onConversationOnlineStats);
      unsubscribers.push(unsub);
    }
    
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [onNewMessage, onMessageEdited, onMessageDeleted, onTranslation, onUserTyping, onUserStatus, onConversationStats, onConversationOnlineStats]);

  // ÉTAPE 4: Surveiller l'état de connexion
  useEffect(() => {
    const interval = setInterval(() => {
      const diagnostics = meeshySocketIOService.getConnectionDiagnostics();
      setIsConnected(diagnostics.isConnected);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // ÉTAPE 5: Actions
  const sendMessage = useCallback(async (
    content: string, 
    language: string,
    replyToId?: string
  ): Promise<boolean> => {
    if (!conversationId) {
      console.error('❌ [useSocketIOMessaging] Pas de conversationId');
      return false;
    }
    
    const conversationIdOrObject = conversationId.includes('-') 
      ? conversationId 
      : { identifier: conversationId };
    
    return await meeshySocketIOService.sendMessage(conversationIdOrObject, content, language, replyToId);
  }, [conversationId]);

  const sendMessageWithAttachments = useCallback(async (
    content: string,
    attachmentIds: string[],
    language: string,
    replyToId?: string
  ): Promise<boolean> => {
    if (!conversationId) {
      console.error('❌ [useSocketIOMessaging] Pas de conversationId');
      return false;
    }
    
    const conversationIdOrObject = conversationId.includes('-') 
      ? conversationId 
      : { identifier: conversationId };
    
    return await meeshySocketIOService.sendMessageWithAttachments(
      conversationIdOrObject, 
      content, 
      attachmentIds, 
      language, 
      replyToId
    );
  }, [conversationId]);

  const editMessage = useCallback(async (messageId: string, content: string): Promise<boolean> => {
    return await meeshySocketIOService.editMessage(messageId, content);
  }, []);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    return await meeshySocketIOService.deleteMessage(messageId);
  }, []);

  const startTyping = useCallback(() => {
    if (conversationId) {
      meeshySocketIOService.startTyping(conversationId);
    }
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (conversationId) {
      meeshySocketIOService.stopTyping(conversationId);
    }
  }, [conversationId]);

  const reconnect = useCallback(() => {
    meeshySocketIOService.reconnect();
  }, []);

  const getDiagnostics = useCallback(() => {
    const diagnostics = meeshySocketIOService.getConnectionDiagnostics();
    return {
      isConnected: diagnostics.isConnected,
      conversationId,
      hasCurrentUser: !!currentUser,
      ...diagnostics
    };
  }, [conversationId, currentUser]);

  return {
    isConnected,
    status: { isConnected },
    connectionStatus: { isConnected },
    sendMessage,
    sendMessageWithAttachments,
    editMessage,
    deleteMessage,
    startTyping,
    stopTyping,
    reconnect,
    getDiagnostics
  };
}
