/**
 * Hook custom pour les notifications v2
 * Intègre Socket.IO real-time avec polling fallback
 */

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/auth-store';
import {
  useNotificationStoreV2,
  useNotificationsV2,
  useUnreadCountV2,
  useNotificationCountsV2,
  useNotificationActionsV2
} from '@/stores/notification-store-v2';
import type { NotificationV2 } from '@/types/notification-v2';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import { APP_CONFIG } from '@/lib/config';

/**
 * Configuration du hook
 */
const HOOK_CONFIG = {
  POLLING_INTERVAL: 30000, // 30 secondes
  RECONNECT_DELAY: 5000,   // 5 secondes
  MAX_RECONNECT_ATTEMPTS: 5,
  TOAST_DURATION: 4000
};

/**
 * Hook pour gérer les notifications v2
 */
export function useNotificationsManager() {
  const { user, authToken, isAuthenticated } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef(false);

  // Sélecteurs du store
  const notifications = useNotificationsV2();
  const unreadCount = useUnreadCountV2();
  const counts = useNotificationCountsV2();
  const actions = useNotificationActionsV2();
  const storeState = useNotificationStoreV2(
    useShallow(state => ({
      isLoading: state.isLoading,
      isLoadingMore: state.isLoadingMore,
      hasMore: state.hasMore,
      error: state.error,
      filters: state.filters,
      isConnected: state.isConnected
    }))
  );

  /**
   * Affiche un toast pour une nouvelle notification
   */
  const showNotificationToast = useCallback((notification: NotificationV2) => {
    // Désactiver les toasts sur mobile pour éviter les doublons avec les push notifications
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (isMobile) {
      return;
    }

    // Import dynamique pour éviter les circular deps
    import('@/utils/notification-formatters').then(({ getNotificationIcon, generateNotificationTitle }) => {
      const icon = getNotificationIcon(notification);
      const title = generateNotificationTitle(notification);

      toast.info(`${icon.emoji} ${title}`, {
        description: notification.content,
        duration: HOOK_CONFIG.TOAST_DURATION,
        action: notification.context?.conversationId ? {
          label: 'View',
          onClick: () => {
            if (notification.context?.conversationId) {
              window.location.href = `/chat/${notification.context.conversationId}`;
            }
          }
        } : undefined
      });
    });
  }, []);

  /**
   * Initialise Socket.IO pour les notifications en temps réel
   */
  const initializeSocket = useCallback(() => {
    if (!authToken || !isAuthenticated || socket?.connected) {
      return;
    }

    console.log('[useNotificationsV2] Initializing Socket.IO...');

    const newSocket = io(APP_CONFIG.getBackendUrl(), {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: HOOK_CONFIG.MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: HOOK_CONFIG.RECONNECT_DELAY
    });

    // Événement: Connexion établie
    newSocket.on('connect', () => {
      console.log('[useNotificationsV2] Socket.IO connected');
      setIsSocketConnected(true);
      reconnectAttempts.current = 0;

      // Arrêter le polling si actif
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    });

    // Événement: Déconnexion
    newSocket.on('disconnect', (reason) => {
      console.warn('[useNotificationsV2] Socket.IO disconnected:', reason);
      setIsSocketConnected(false);

      // Démarrer le polling en fallback si déconnexion involontaire
      if (reason !== 'io client disconnect') {
        startPolling();
      }
    });

    // Événement: Erreur de connexion
    newSocket.on('connect_error', (error) => {
      console.error('[useNotificationsV2] Socket.IO connection error:', error);
      reconnectAttempts.current++;

      if (reconnectAttempts.current >= HOOK_CONFIG.MAX_RECONNECT_ATTEMPTS) {
        console.warn('[useNotificationsV2] Max reconnection attempts reached, starting polling...');
        startPolling();
      }
    });

    // Événement: Nouvelle notification
    newSocket.on('notification', (data: any) => {
      console.log('[useNotificationsV2] Received notification:', data);

      // Parser et ajouter la notification
      import('@/services/notifications-v2.service').then(({ notificationServiceV2 }) => {
        // Utiliser le même parser que le service
        const notification: NotificationV2 = {
          id: data.id,
          userId: data.userId,
          type: data.type,
          title: data.title,
          content: data.content || data.message,
          priority: data.priority || 'normal',
          isRead: data.isRead || false,
          readAt: data.readAt ? new Date(data.readAt) : undefined,
          createdAt: new Date(data.createdAt || Date.now()),
          sender: data.senderId ? {
            id: data.senderId,
            username: data.senderUsername || 'Unknown',
            avatar: data.senderAvatar
          } : undefined,
          messagePreview: data.messagePreview,
          context: {
            conversationId: data.conversationId,
            conversationTitle: data.data?.conversationTitle,
            conversationType: data.data?.conversationType,
            messageId: data.messageId,
            originalMessageId: data.data?.originalMessageId,
            callSessionId: data.callSessionId,
            friendRequestId: data.friendRequestId,
            reactionId: data.reactionId
          },
          metadata: {
            attachments: data.data?.attachments,
            reactionEmoji: data.data?.emoji || data.data?.reactionEmoji,
            action: data.data?.action
          },
          data: data.data
        };

        actions.addNotification(notification);
        showNotificationToast(notification);
      });
    });

    // Événement: Notification marquée comme lue
    newSocket.on('notification:read', (data: { notificationId: string }) => {
      console.log('[useNotificationsV2] Notification marked as read:', data.notificationId);
      // La mise à jour est déjà faite localement via markAsRead
    });

    // Événement: Notification supprimée
    newSocket.on('notification:deleted', (data: { notificationId: string }) => {
      console.log('[useNotificationsV2] Notification deleted:', data.notificationId);
      actions.removeNotification(data.notificationId);
    });

    // Événement: Mise à jour des compteurs
    newSocket.on('notification:counts', (data: any) => {
      console.log('[useNotificationsV2] Counts updated:', data);
      actions.updateCounts(data);
    });

    setSocket(newSocket);
  }, [authToken, isAuthenticated, socket]);

  /**
   * Démarre le polling en fallback
   */
  const startPolling = useCallback(() => {
    if (pollingInterval.current) {
      return;
    }

    console.log('[useNotificationsV2] Starting polling fallback...');

    pollingInterval.current = setInterval(() => {
      console.log('[useNotificationsV2] Polling notifications...');
      actions.refresh().catch(error => {
        console.error('[useNotificationsV2] Polling error:', error);
      });
    }, HOOK_CONFIG.POLLING_INTERVAL);
  }, []);

  /**
   * Arrête le polling
   */
  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
      console.log('[useNotificationsV2] Polling stopped');
    }
  }, []);

  /**
   * Initialise le hook au montage
   */
  useEffect(() => {
    if (!isAuthenticated || !authToken || isInitialized.current) {
      return;
    }

    console.log('[useNotificationsV2] Initializing...');
    isInitialized.current = true;

    // Initialiser le store (charge les notifications depuis l'API)
    actions.initialize().then(() => {
      // Initialiser Socket.IO après le chargement initial
      initializeSocket();
    });

    // Cleanup à la déconnexion
    return () => {
      console.log('[useNotificationsV2] Cleaning up...');

      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('notification');
        socket.off('notification:read');
        socket.off('notification:deleted');
        socket.off('notification:counts');
        socket.disconnect();
        setSocket(null);
      }

      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }

      actions.disconnect();
      isInitialized.current = false;
    };
  }, [isAuthenticated, authToken]);

  /**
   * Reconnecter Socket.IO si déconnecté
   */
  useEffect(() => {
    if (isAuthenticated && authToken && !isSocketConnected && isInitialized.current) {
      const timer = setTimeout(() => {
        console.log('[useNotificationsV2] Attempting to reconnect Socket.IO...');
        initializeSocket();
      }, HOOK_CONFIG.RECONNECT_DELAY);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, authToken, isSocketConnected]);

  return {
    // Données
    notifications,
    unreadCount,
    counts,

    // État
    isLoading: storeState.isLoading,
    isLoadingMore: storeState.isLoadingMore,
    hasMore: storeState.hasMore,
    error: storeState.error,
    filters: storeState.filters,

    // Connexion
    isConnected: storeState.isConnected,
    isSocketConnected,
    isPolling: !!pollingInterval.current,

    // Actions
    ...actions,

    // Utilitaires
    reconnect: initializeSocket
  };
}

export default useNotificationsManager;
