/**
 * Hook unifié pour la gestion des conversations
 * Point unique d'interface avec le messaging service
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { messagingService } from '@/services/messaging.service';
import type { Message, User } from '@/types';

interface UseMessagingOptions {
  conversationId?: string;
  currentUser?: User;
  onNewMessage?: (message: Message) => void;
  onMessageEdited?: (message: Message) => void;
  onMessageDeleted?: (messageId: string) => void;
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
    onMessageDeleted
  } = options;

  const [connectionStatus, setConnectionStatus] = useState(messagingService.getConnectionStatus());

  // Configuration de l'utilisateur actuel
  useEffect(() => {
    if (currentUser) {
      messagingService.setCurrentUser(currentUser);
      console.log('🔧 useMessaging: Utilisateur configuré', { userId: currentUser.id, username: currentUser.username });
    }
  }, [currentUser]);

  // Rejoindre/quitter la conversation
  useEffect(() => {
    if (conversationId) {
      console.log('🚪 useMessaging: Rejoindre conversation', { conversationId });
      messagingService.joinConversation(conversationId);

      return () => {
        console.log('🚪 useMessaging: Quitter conversation', { conversationId });
        messagingService.leaveConversation(conversationId);
      };
    }
  }, [conversationId]);

  // Setup des listeners
  useEffect(() => {
    console.log('🎧 useMessaging: Installation des listeners');
    
    const unsubscribeMessage = messagingService.onNewMessage((message) => {
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

    const unsubscribeEdit = messagingService.onMessageEdited((message) => {
      console.log('✏️ useMessaging: Message modifié', { messageId: message.id });
      if (!conversationId || message.conversationId === conversationId) {
        onMessageEdited?.(message);
      }
    });

    const unsubscribeDelete = messagingService.onMessageDeleted((messageId) => {
      console.log('🗑️ useMessaging: Message supprimé', { messageId });
      onMessageDeleted?.(messageId);
    });

    // Mise à jour du statut de connexion
    const statusInterval = setInterval(() => {
      const newStatus = messagingService.getConnectionStatus();
      setConnectionStatus(newStatus);
    }, 1000);

    return () => {
      console.log('🎧 useMessaging: Nettoyage des listeners');
      unsubscribeMessage();
      unsubscribeEdit();
      unsubscribeDelete();
      clearInterval(statusInterval);
    };
  }, [conversationId, onNewMessage, onMessageEdited, onMessageDeleted]);

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

    return await messagingService.sendMessage(conversationId, content);
  }, [conversationId]);

  const editMessage = useCallback(async (messageId: string, newContent: string): Promise<boolean> => {
    console.log('✏️ useMessaging: Modification message', { messageId, newContent: newContent.substring(0, 50) + '...' });
    return await messagingService.editMessage(messageId, newContent);
  }, []);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    console.log('🗑️ useMessaging: Suppression message', { messageId });
    return await messagingService.deleteMessage(messageId);
  }, []);

  const joinConversation = useCallback((newConversationId: string) => {
    console.log('🚪 useMessaging: Rejoindre nouvelle conversation', { 
      from: conversationId,
      to: newConversationId 
    });
    messagingService.joinConversation(newConversationId);
  }, [conversationId]);

  const leaveConversation = useCallback((targetConversationId: string) => {
    console.log('🚪 useMessaging: Quitter conversation', { conversationId: targetConversationId });
    messagingService.leaveConversation(targetConversationId);
  }, []);

  const startTyping = useCallback(() => {
    if (conversationId) {
      messagingService.startTyping(conversationId);
    }
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (conversationId) {
      messagingService.stopTyping(conversationId);
    }
  }, [conversationId]);

  return {
    sendMessage,
    editMessage,
    deleteMessage,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
    connectionStatus,
  };
};
