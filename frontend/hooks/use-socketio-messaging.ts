/**
 * Hook useSocketIOMessaging - Gestion des messages temps réel
 * 
 * Utilise meeshy-socketio.service.ts pour une compatibilité complète
 * avec les identifiants de conversation (ObjectId, identifier, objet)
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { authManager } from '@/services/auth-manager.service';
import { meeshySocketIOService } from '@/services/meeshy-socketio.service';
import type { Message, User, TypingEvent, UserStatusEvent, TranslationEvent } from '@/types';

export interface UseSocketIOMessagingOptions {
  conversationId?: string | null;
  currentUser?: User | null;
  events?: any;
  onNewMessage?: (message: Message) => void;
  onMessageEdited?: (message: Message) => void;
  onMessageDeleted?: (messageId: string) => void;
  onUserTyping?: (userId: string, username: string, isTyping: boolean, conversationId: string) => void;
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

  // CORRECTION: Utiliser un état complet pour le statut de connexion
  const [connectionStatus, setConnectionStatus] = useState({ 
    isConnected: false, 
    hasSocket: false 
  });
  
  // Compatibilité avec l'ancien code qui utilise isConnected directement
  const isConnected = connectionStatus.isConnected;

  // ÉTAPE 1: Initialiser la connexion au montage du hook
  useEffect(() => {
    // Définir l'utilisateur courant dans le service si disponible
    if (currentUser) {
      meeshySocketIOService.setCurrentUser(currentUser);
    }

    // Force la connexion initiale si des tokens sont disponibles
    const hasAuthToken = typeof window !== 'undefined' && !!authManager.getAuthToken();
    const hasSessionToken = typeof window !== 'undefined' && !!authManager.getAnonymousSession()?.token;

    if (hasAuthToken || hasSessionToken) {
      // Forcer la connexion initiale
      meeshySocketIOService.reconnect();
    }
  }, [currentUser]); // Re-exécuter si currentUser change

  // ÉTAPE 2: Gérer le join/leave de conversation
  useEffect(() => {
    if (!conversationId) return;

    // Passer l'identifiant directement - le service gère la conversion
    meeshySocketIOService.joinConversation(conversationId);

    return () => {
      meeshySocketIOService.leaveConversation(conversationId);
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
        onUserTyping(event.userId, event.username, event.isTyping || false, event.conversationId);
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
      // CORRECTION: Mettre à jour l'objet complet avec isConnected ET hasSocket
      setConnectionStatus({
        isConnected: diagnostics.isConnected,
        hasSocket: diagnostics.hasSocket
      });
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
    
    // Passer l'identifiant directement - le service gère la conversion
    return await meeshySocketIOService.sendMessage(conversationId, content, language, replyToId);
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
    
    // Passer l'identifiant directement - le service gère la conversion
    return await meeshySocketIOService.sendMessageWithAttachments(
      conversationId, 
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
    // CORRECTION CRITIQUE: Utiliser l'ID normalisé du service au lieu du conversationId local
    // Le service a reçu l'ID normalisé via CONVERSATION_JOINED
    const normalizedId = meeshySocketIOService.getCurrentConversationId();
    const idToUse = normalizedId || conversationId;
    
    if (idToUse) {
      meeshySocketIOService.startTyping(idToUse);
    }
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    // CORRECTION CRITIQUE: Utiliser l'ID normalisé du service au lieu du conversationId local
    const normalizedId = meeshySocketIOService.getCurrentConversationId();
    const idToUse = normalizedId || conversationId;
    
    if (idToUse) {
      meeshySocketIOService.stopTyping(idToUse);
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
    status: connectionStatus, // Retourner l'objet complet
    connectionStatus, // CORRECTION: Retourner l'objet complet avec isConnected ET hasSocket
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
