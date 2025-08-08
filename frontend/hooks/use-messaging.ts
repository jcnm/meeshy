/**
 * Hook unifié pour la gestion des conversations
 * Point unique d'interface avec le messaging service
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { nativeWebSocketService } from '@/services/native-websocket.service';
import type { Message, User } from '@/types';

interface UseMessagingOptions {
  conversationId?: string;
  currentUser?: User;
  onNewMessage?: (message: Message) => void;
  onMessageEdited?: (message: Message) => void;
  onMessageDeleted?: (messageId: string) => void;
  onUserTyping?: (userId: string, username: string, isTyping: boolean) => void;
  onUserStatus?: (userId: string, username: string, isOnline: boolean) => void;
}

interface UseMessagingReturn {
  // Actions
  sendMessage: (content: string) => Promise<boolean>;
  editMessage: (messageId: string, newContent: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  
  // Navigation
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  
  // Frappe
  startTyping: () => void;
  stopTyping: () => void;
  
  // Connexion
  reconnect: () => void;
  forceConnect: () => void;
  disconnect: () => void;
  getDiagnostics: () => any;
  
  // État
  connectionStatus: {
    isConnected: boolean;
    hasSocket: boolean;
    currentUser: string;
  };
}

export const useMessaging = (options: UseMessagingOptions = {}): UseMessagingReturn => {
  const {
    conversationId,
    currentUser,
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    onUserTyping,
    onUserStatus
  } = options;

  const [connectionStatus, setConnectionStatus] = useState(nativeWebSocketService.getConnectionStatus());

  // Configuration de l'utilisateur actuel
  useEffect(() => {
    // Ne pas configurer pendant le build SSR
    if (typeof window === 'undefined') {
      return;
    }
    
    if (currentUser) {
      nativeWebSocketService.setCurrentUser(currentUser);
      console.log('🔧 useMessaging: Utilisateur configuré', { userId: currentUser.id, username: currentUser.username });
      
      // Forcer la connexion WebSocket immédiatement après configuration de l'utilisateur
      setTimeout(() => {
        const status = nativeWebSocketService.getConnectionStatus();
        if (!status.isConnected && !status.hasSocket) {
          console.log('🔌 useMessaging: Connexion WebSocket manquante, force la connexion...');
          nativeWebSocketService.reconnect();
        }
      }, 500);
    }
  }, [currentUser]);

  // Rejoindre/quitter la conversation
  useEffect(() => {
    // Ne pas se connecter pendant le build SSR
    if (typeof window === 'undefined') {
      return;
    }
    
    if (conversationId) {
      console.log('🚪 useMessaging: Rejoindre conversation', { conversationId });
      nativeWebSocketService.joinConversation(conversationId);

      return () => {
        console.log('🚪 useMessaging: Quitter conversation', { conversationId });
        nativeWebSocketService.leaveConversation(conversationId);
      };
    }
  }, [conversationId]);

  // Setup des listeners
  useEffect(() => {
    // Ne pas configurer les listeners pendant le build SSR
    if (typeof window === 'undefined') {
      return;
    }
    
    console.log('🎧 useMessaging: Installation des listeners');
    
    const unsubscribeMessage = nativeWebSocketService.onNewMessage((message: Message) => {
      console.log('📨 useMessaging: Nouveau message reçu', { 
        messageId: message.id, 
        conversationId: message.conversationId,
        isTargetConversation: !conversationId || message.conversationId === conversationId
      });
      
      // Filtrer par conversation si spécifiée
      if (!conversationId || message.conversationId === conversationId) {
        onNewMessage?.(message);
      } else {
        console.log('⚠️ useMessaging: Message ignoré (conversation différente)', {
          messageConversationId: message.conversationId,
          currentConversationId: conversationId
        });
      }
    });

    const unsubscribeEdit = nativeWebSocketService.onMessageEdited((message: Message) => {
      console.log('✏️ useMessaging: Message modifié', { messageId: message.id });
      if (!conversationId || message.conversationId === conversationId) {
        onMessageEdited?.(message);
      }
    });

    const unsubscribeDelete = nativeWebSocketService.onMessageDeleted((messageId: string) => {
      console.log('🗑️ useMessaging: Message supprimé', { messageId });
      onMessageDeleted?.(messageId);
    });

    // Listeners pour les événements de frappe et de statut
    const unsubscribeTyping = nativeWebSocketService.onTyping((event: any) => {
      if (!conversationId || event.conversationId === conversationId) {
        onUserTyping?.(event.userId, event.username, event.isTyping);
      }
    });

    const unsubscribeStatus = nativeWebSocketService.onUserStatus((event: any) => {
      onUserStatus?.(event.userId, event.username, event.isOnline);
    });

    // Mise à jour du statut de connexion
    const statusInterval = setInterval(() => {
      const newStatus = nativeWebSocketService.getConnectionStatus();
      setConnectionStatus(newStatus);
    }, 1000);

    return () => {
      console.log('🎧 useMessaging: Nettoyage des listeners');
      unsubscribeMessage();
      unsubscribeEdit();
      unsubscribeDelete();
      unsubscribeTyping();
      unsubscribeStatus();
      clearInterval(statusInterval);
    };
  }, [conversationId, onNewMessage, onMessageEdited, onMessageDeleted, onUserTyping, onUserStatus]);

  // Actions
  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!conversationId) {
      console.error('❌ useMessaging: Impossible d\'envoyer - aucune conversation active');
      return false;
    }

    console.log('📤 useMessaging: Envoi message', { 
      conversationId, 
      contentLength: content.length,
      content: content.substring(0, 50) + '...'
    });

    return await nativeWebSocketService.sendMessage(conversationId, content);
  }, [conversationId]);

  const editMessage = useCallback(async (messageId: string, newContent: string): Promise<boolean> => {
    console.log('✏️ useMessaging: Modification message', { messageId, newContent: newContent.substring(0, 50) + '...' });
    return await nativeWebSocketService.editMessage(messageId, newContent);
  }, []);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    console.log('🗑️ useMessaging: Suppression message', { messageId });
    return await nativeWebSocketService.deleteMessage(messageId);
  }, []);

  const joinConversation = useCallback((newConversationId: string) => {
    console.log('🚪 useMessaging: Rejoindre nouvelle conversation', { 
      from: conversationId,
      to: newConversationId 
    });
    nativeWebSocketService.joinConversation(newConversationId);
  }, [conversationId]);

  const leaveConversation = useCallback((targetConversationId: string) => {
    console.log('🚪 useMessaging: Quitter conversation', { conversationId: targetConversationId });
    nativeWebSocketService.leaveConversation(targetConversationId);
  }, []);

  const startTyping = useCallback(() => {
    if (conversationId) {
      nativeWebSocketService.startTyping(conversationId);
    }
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (conversationId) {
      nativeWebSocketService.stopTyping(conversationId);
    }
  }, [conversationId]);

  const reconnect = useCallback(() => {
    nativeWebSocketService.reconnect();
  }, []);

  const forceConnect = useCallback(() => {
    console.log('🔧 useMessaging: Forcer la connexion WebSocket');
    nativeWebSocketService.reconnect();
  }, []);

  const disconnect = useCallback(() => {
    console.log('🔌 useMessaging: Déconnexion WebSocket');
    nativeWebSocketService.disconnect();
  }, []);

  const getDiagnostics = useCallback(() => {
    return nativeWebSocketService.getConnectionDiagnostics();
  }, []);

  return {
    sendMessage,
    editMessage,
    deleteMessage,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
    reconnect,
    forceConnect,
    disconnect,
    getDiagnostics,
    connectionStatus,
  };
};
