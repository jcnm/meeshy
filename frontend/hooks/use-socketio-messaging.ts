/**
 * Hook React pour la gestion des conversations avec Socket.IO
 * Remplace le hook WebSocket natif par Socket.IO pour une meilleure gestion
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { meeshySocketIOService } from '@/services/meeshy-socketio.service';
import { logger } from '@/utils/logger';
import type { Message, User } from '@/types';

interface TypingEvent {
  userId: string;
  username: string;
  conversationId: string;
  isTyping?: boolean; // Optionnel car sera ajouté côté service
}

interface UseSocketIOMessagingOptions {
  conversationId?: string;
  currentUser?: User;
  events?: {
    message?: boolean;
    edit?: boolean;
    delete?: boolean;
    translation?: boolean;
    typing?: boolean;
    status?: boolean;
    conversationStats?: boolean;
    onlineStats?: boolean;
  };
  onNewMessage?: (message: Message) => void;
  onMessageEdited?: (message: Message) => void;
  onMessageDeleted?: (messageId: string) => void;
  onUserTyping?: (userId: string, username: string, isTyping: boolean) => void;
  onUserStatus?: (userId: string, username: string, isOnline: boolean) => void;
  onTranslation?: (messageId: string, translations: any[]) => void;
  onConversationStats?: (data: { conversationId: string; stats: any }) => void;
  onConversationOnlineStats?: (data: { conversationId: string; onlineUsers: any[]; updatedAt: Date }) => void;
  // Nouvelles options d'amélioration
  enableBatchTranslations?: boolean; // Traiter les traductions par batch pour de meilleures performances
  translationDebounceMs?: number; // Délai de debounce pour éviter les traductions en cascade
  autoRetryFailedTranslations?: boolean; // Relancer automatiquement les traductions échouées
}

interface UseSocketIOMessagingReturn {
  // Actions
  sendMessage: (content: string, originalLanguage?: string, replyToId?: string) => Promise<boolean>;
  sendMessageWithAttachments: (content: string, attachmentIds: string[], originalLanguage?: string, replyToId?: string) => Promise<boolean>;
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
  getDiagnostics: () => any;
  
  // État
  connectionStatus: {
    isConnected: boolean;
    hasSocket: boolean;
    currentUser: string;
  };
}

// Exporter les types pour utilisation externe
export type { UseSocketIOMessagingOptions, UseSocketIOMessagingReturn };

export const useSocketIOMessaging = (options: UseSocketIOMessagingOptions = {}): UseSocketIOMessagingReturn => {
  const {
    conversationId,
    currentUser,
    events,
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    onUserTyping,
    onUserStatus,
    onTranslation,
    onConversationStats,
    onConversationOnlineStats
  } = options;

  const [connectionStatus, setConnectionStatus] = useState(meeshySocketIOService.getConnectionStatus());

  // Utiliser des refs pour les callbacks pour éviter les recréations du useEffect
  const callbacksRef = useRef({
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    onUserTyping,
    onUserStatus,
    onTranslation,
    onConversationStats,
    onConversationOnlineStats
  });

  // Mettre à jour les refs quand les callbacks changent
  callbacksRef.current = {
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    onUserTyping,
    onUserStatus,
    onTranslation,
    onConversationStats,
    onConversationOnlineStats
  };

  // Configuration de l'utilisateur actuel
  useEffect(() => {
    // Ne pas configurer pendant le build SSR
    if (typeof window === 'undefined') {
      return;
    }
    
    logger.messaging.debug('useSocketIOMessaging: Configuration utilisateur...', {
      hasUser: !!currentUser,
      userId: currentUser?.id,
      username: currentUser?.username
    });
    
    if (currentUser) {
      // Vérifier d'abord que le token est présent (auth_token ou anonymous_session_token)
      const authToken = localStorage.getItem('auth_token');
      const sessionToken = localStorage.getItem('anonymous_session_token');
      const hasAnyToken = !!authToken || !!sessionToken;
      
      logger.messaging.debug('useSocketIOMessaging: Vérification tokens avant configuration', {
        hasAuthToken: !!authToken,
        hasSessionToken: !!sessionToken,
        hasAnyToken,
        authTokenLength: authToken?.length,
        sessionTokenLength: sessionToken?.length,
        authTokenPreview: authToken ? authToken.substring(0, 20) + '...' : 'none',
        sessionTokenPreview: sessionToken ? sessionToken.substring(0, 20) + '...' : 'none'
      });
      
      meeshySocketIOService.setCurrentUser(currentUser);
      logger.messaging.debug('useSocketIOMessaging: Utilisateur configuré', { 
        userId: currentUser.id, 
        username: currentUser.username 
      });
      
      // Vérifier la connexion une seule fois, sans reconnexion automatique
      const status = meeshySocketIOService.getConnectionStatus();
      logger.messaging.debug('useSocketIOMessaging: Statut de connexion après configuration', status);
    } else {
      logger.messaging.warn('useSocketIOMessaging: Aucun utilisateur fourni');
    }
  }, [currentUser?.id]); // Utiliser seulement l'ID pour éviter les re-rendus

  // Rejoindre/quitter la conversation
  useEffect(() => {
    // Ne pas se connecter pendant le build SSR
    if (typeof window === 'undefined') {
      return;
    }
    
    // Rejoindre uniquement si un utilisateur courant est fourni (évite les doubles joins via sous-composants)
    if (conversationId && currentUser?.id) {
      logger.messaging.debug('useSocketIOMessaging: Rejoindre conversation', { conversationId });
      meeshySocketIOService.joinConversation(conversationId);

      return () => {
        logger.messaging.debug('useSocketIOMessaging: Quitter conversation', { conversationId });
        meeshySocketIOService.leaveConversation(conversationId);
      };
    }
  }, [conversationId, currentUser?.id]); // Utiliser seulement l'ID pour éviter les re-rendus

  // Setup des listeners
  useEffect(() => {
    // Ne pas configurer les listeners pendant le build SSR
    if (typeof window === 'undefined') {
      return;
    }
    
    logger.messaging.debug('useSocketIOMessaging: Installation des listeners');
    
    const shouldListenMessage = events?.message ?? true;
    const shouldListenEdit = events?.edit ?? true;
    const shouldListenDelete = events?.delete ?? true;
    const shouldListenTranslation = events?.translation ?? true;
    const shouldListenTyping = events?.typing ?? true;
    const shouldListenStatus = events?.status ?? true;
    const shouldListenConvStats = events?.conversationStats ?? true;
    const shouldListenOnlineStats = events?.onlineStats ?? true;

    const unsubscribeMessage = shouldListenMessage ? meeshySocketIOService.onNewMessage((message) => {
      // Log seulement en mode debug et seulement pour la conversation actuelle
      if (conversationId && message.conversationId === conversationId) {
        logger.messaging.debug('useSocketIOMessaging: Nouveau message reçu', { 
          messageId: message.id, 
          conversationId: message.conversationId
        });
      }
      
      // Filtrer par conversation si spécifiée
      if (!conversationId || message.conversationId === conversationId) {
        callbacksRef.current.onNewMessage?.(message);
      }
    }) : () => {};

    const unsubscribeEdit = shouldListenEdit ? meeshySocketIOService.onMessageEdited((message) => {
      logger.messaging.debug('useSocketIOMessaging: Message modifié', { messageId: message.id });
      if (!conversationId || message.conversationId === conversationId) {
        callbacksRef.current.onMessageEdited?.(message);
      }
    }) : () => {};

    const unsubscribeDelete = shouldListenDelete ? meeshySocketIOService.onMessageDeleted((messageId) => {
      logger.messaging.debug('useSocketIOMessaging: Message supprimé', { messageId });
      callbacksRef.current.onMessageDeleted?.(messageId);
    }) : () => {};

    // Listener pour les traductions
    const unsubscribeTranslation = shouldListenTranslation ? meeshySocketIOService.onTranslation((data) => {
      console.group('🔗 [USE-SOCKETIO-MESSAGING] TRADUCTION TRANSFÉRÉE');
      console.log('📨 Hook useSocketIOMessaging: Traductions reçues depuis le service', { 
        messageId: data.messageId, 
        translationsCount: data.translations.length,
        translations: data.translations.map(t => ({
          id: t.id,
          targetLanguage: t.targetLanguage,
          translatedContent: t.translatedContent?.substring(0, 40) + '...',
          translationModel: t.translationModel
        }))
      });
      
      logger.messaging.debug('useSocketIOMessaging: Traductions reçues', { 
        messageId: data.messageId, 
        translationsCount: data.translations.length 
      });
      
      console.log('🎯 [USE-SOCKETIO-MESSAGING] Appel du callback onTranslation...');
      if (callbacksRef.current.onTranslation) {
        callbacksRef.current.onTranslation(data.messageId, data.translations);
        console.log('✅ [USE-SOCKETIO-MESSAGING] Callback onTranslation exécuté avec succès');
      } else {
        console.warn('⚠️ [USE-SOCKETIO-MESSAGING] Aucun callback onTranslation configuré');
      }
      console.groupEnd();
    }) : () => {};

    const unsubscribeConvStats = shouldListenConvStats ? meeshySocketIOService.onConversationStats((data) => {
      callbacksRef.current.onConversationStats?.(data);
    }) : () => {};
    const unsubscribeOnlineStats = shouldListenOnlineStats ? meeshySocketIOService.onConversationOnlineStats((data) => {
      callbacksRef.current.onConversationOnlineStats?.(data);
    }) : () => {};

    // Listeners pour les événements de frappe - avec distinction start/stop
    const unsubscribeTyping = shouldListenTyping ? meeshySocketIOService.onTyping((event: TypingEvent) => {
      if (!event || typeof event !== 'object') {
        logger.messaging.warn('useSocketIOMessaging: Événement de frappe invalide', event);
        return;
      }
      
      if (!event.conversationId) {
        logger.messaging.warn('useSocketIOMessaging: Événement de frappe sans conversationId', event);
        return;
      }
      
      // Si on a un conversationId spécifique, filtrer les événements
      if (!conversationId || event.conversationId === conversationId) {
        // L'événement contient maintenant le flag isTyping du service
        const isTyping = event.isTyping ?? true; // Par défaut true pour rétrocompatibilité
        logger.messaging.debug('useSocketIOMessaging: Événement frappe', { 
          userId: event.userId, 
          username: event.username, 
          isTyping 
        });
        callbacksRef.current.onUserTyping?.(event.userId, event.username, isTyping);
      }
    }) : () => {};

    const unsubscribeStatus = shouldListenStatus ? meeshySocketIOService.onUserStatus((event) => {
      callbacksRef.current.onUserStatus?.(event.userId, event.username, event.isOnline);
    }) : () => {};

    // Mises à jour de statut événementielles: courte fenêtre d'init, pas de polling continu
    const updateStatus = () => {
      const newStatus = meeshySocketIOService.getConnectionStatus();
      setConnectionStatus(prev => (
        prev.isConnected !== newStatus.isConnected ||
        prev.hasSocket !== newStatus.hasSocket ||
        prev.currentUser !== newStatus.currentUser
      ) ? newStatus : prev);
    };

    const bootstrapInterval = setInterval(updateStatus, 1000);
    let bootstrapTicks = 0;
    const bootstrapStopper = setInterval(() => {
      bootstrapTicks++;
      if (bootstrapTicks >= 5) {
        clearInterval(bootstrapInterval);
        clearInterval(bootstrapStopper);
      }
    }, 1000);

    return () => {
      logger.messaging.debug('useSocketIOMessaging: Nettoyage des listeners');
      unsubscribeMessage();
      unsubscribeEdit();
      unsubscribeDelete();
      unsubscribeTranslation();
      unsubscribeConvStats();
      unsubscribeOnlineStats();
      unsubscribeTyping();
      unsubscribeStatus();
      clearInterval(bootstrapInterval);
      clearInterval(bootstrapStopper);
    };
  }, [conversationId, currentUser?.id]); // Dépendances minimales pour éviter les re-rendus

  // Actions
  const sendMessage = useCallback(async (content: string, originalLanguage?: string, replyToId?: string): Promise<boolean> => {
    if (!conversationId) {
      logger.messaging.error('useSocketIOMessaging: Impossible d\'envoyer - aucune conversation active');
      return false;
    }

    logger.messaging.debug('useSocketIOMessaging: Envoi message', { 
      conversationId, 
      contentLength: content.length,
      originalLanguage,
      replyToId: replyToId || 'none',
      content: content.substring(0, 50) + '...'
    });

    return await meeshySocketIOService.sendMessage(conversationId, content, originalLanguage, replyToId);
  }, [conversationId]);

  const sendMessageWithAttachments = useCallback(async (
    content: string, 
    attachmentIds: string[], 
    originalLanguage?: string, 
    replyToId?: string
  ): Promise<boolean> => {
    if (!conversationId) {
      logger.messaging.error('useSocketIOMessaging: Impossible d\'envoyer - aucune conversation active');
      return false;
    }

    logger.messaging.debug('useSocketIOMessaging: Envoi message avec attachments', { 
      conversationId, 
      contentLength: content.length,
      attachmentCount: attachmentIds.length,
      originalLanguage,
      replyToId: replyToId || 'none',
      content: content.substring(0, 50) + '...'
    });

    return await meeshySocketIOService.sendMessageWithAttachments(
      conversationId, 
      content, 
      attachmentIds,
      originalLanguage, 
      replyToId
    );
  }, [conversationId]);

  const editMessage = useCallback(async (messageId: string, newContent: string): Promise<boolean> => {
    logger.messaging.debug('useSocketIOMessaging: Modification message', { 
      messageId, 
      newContent: newContent.substring(0, 50) + '...' 
    });
    return await meeshySocketIOService.editMessage(messageId, newContent);
  }, []);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    logger.messaging.debug('useSocketIOMessaging: Suppression message', { messageId });
    return await meeshySocketIOService.deleteMessage(messageId);
  }, []);

  // Navigation
  const joinConversation = useCallback((conversationId: string) => {
    logger.messaging.debug('useSocketIOMessaging: Rejoindre conversation (manuel)', { conversationId });
    meeshySocketIOService.joinConversation(conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    logger.messaging.debug('useSocketIOMessaging: Quitter conversation (manuel)', { conversationId });
    meeshySocketIOService.leaveConversation(conversationId);
  }, []);

  // Frappe
  const startTyping = useCallback(() => {
    if (conversationId) {
      logger.messaging.debug('useSocketIOMessaging: Début frappe', { conversationId });
      meeshySocketIOService.startTyping(conversationId);
    }
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (conversationId) {
      logger.messaging.debug('useSocketIOMessaging: Arrêt frappe', { conversationId });
      meeshySocketIOService.stopTyping(conversationId);
    }
  }, [conversationId]);

  const reconnect = useCallback(() => {
    logger.messaging.info('useSocketIOMessaging: Reconnexion forcée');
    meeshySocketIOService.reconnect();
  }, []);

  const getDiagnostics = useCallback(() => {
    return meeshySocketIOService.getConnectionDiagnostics();
  }, []);

  return {
    sendMessage,
    sendMessageWithAttachments,
    editMessage,
    deleteMessage,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
    reconnect,
    getDiagnostics,
    connectionStatus,
  };
};
