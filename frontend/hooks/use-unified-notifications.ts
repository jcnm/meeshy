/**
 * Hook pour la gestion des notifications
 * Centralise toutes les notifications et synchronise les compteurs
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { notificationService, type Notification, type NotificationCounts } from '@/services/notification.service';
import { useAuth } from './use-auth';

export interface UseNotificationsReturn {
  // Notifications
  notifications: Notification[];
  unreadNotifications: Notification[];
  
  // Compteurs
  counts: NotificationCounts;
  unreadCount: number;
  totalCount: number;
  
  // Actions
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAll: () => void;
  
  // État de connexion
  isConnected: boolean;
  
  // Actions de notification
  showToast: (notification: Notification) => void;
}

export const useNotifications = (): UseNotificationsReturn => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({
    total: 0,
    unread: 0,
    byType: {
      message: 0,
      system: 0,
      user_action: 0,
      conversation: 0,
      translation: 0
    }
  });
  const [isConnected, setIsConnected] = useState(false);

  // Initialiser le service de notifications
  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        console.log('🔔 Initialisation du service de notifications pour:', user.username);
        
        notificationService.initialize({
          token,
          userId: user.id,
          onConnect: () => {
            console.log('🔔 Service de notifications connecté');
            setIsConnected(true);
          },
          onDisconnect: () => {
            console.log('🔔 Service de notifications déconnecté');
            setIsConnected(false);
          },
          onError: (error) => {
            console.error('❌ Erreur service de notifications:', error);
            setIsConnected(false);
          },
          onNotificationReceived: (notification) => {
            console.log('📱 Nouvelle notification reçue:', notification);
            updateNotifications();
            showToast(notification);
          },
          onCountsUpdated: (newCounts) => {
            console.log('📊 Compteurs de notifications mis à jour:', newCounts);
            setCounts(newCounts);
          }
        });
      }
    }

    return () => {
      notificationService.disconnect();
      setIsConnected(false);
    };
  }, [isAuthenticated, user]);

  // Mettre à jour les notifications
  const updateNotifications = useCallback(() => {
    const allNotifications = notificationService.getNotifications();
    const unread = notificationService.getUnreadNotifications();
    
    setNotifications(allNotifications);
    setUnreadNotifications(unread);
  }, []);

  // Marquer une notification comme lue
  const markAsRead = useCallback((notificationId: string) => {
    notificationService.markAsRead(notificationId);
    updateNotifications();
  }, [updateNotifications]);

  // Marquer toutes les notifications comme lues
  const markAllAsRead = useCallback(() => {
    notificationService.markAllAsRead();
    updateNotifications();
  }, [updateNotifications]);

  // Supprimer une notification
  const removeNotification = useCallback((notificationId: string) => {
    notificationService.removeNotification(notificationId);
    updateNotifications();
  }, [updateNotifications]);

  // Supprimer toutes les notifications
  const clearAll = useCallback(() => {
    notificationService.clearAll();
    updateNotifications();
  }, [updateNotifications]);

  // Afficher un toast pour une notification
  const showToast = useCallback((notification: Notification) => {
    // Désactiver les toasts sur mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (isMobile) {
      return;
    }

    const getToastIcon = (type: string) => {
      switch (type) {
        case 'message':
          return '💬';
        case 'system':
          return '🔔';
        case 'conversation':
          return '👥';
        case 'translation':
          return '🌍';
        default:
          return '📢';
      }
    };

    const getToastType = (type: string) => {
      switch (type) {
        case 'message':
          return 'success';
        case 'system':
          return 'info';
        case 'conversation':
          return 'info';
        case 'translation':
          return 'success';
        default:
          return 'info';
      }
    };

    const toastType = getToastType(notification.type);
    const icon = getToastIcon(notification.type);
    const duration = notification.translations ? 6000 : 4000;

    const toastConfig: any = {
      description: notification.message,
      duration,
    };

    // Ajouter une action si c'est une notification de message
    if (notification.type === 'message' && notification.conversationId) {
      toastConfig.action = {
        label: 'Voir',
        onClick: () => {
          window.location.href = `/chat/${notification.conversationId}`;
        },
      };
    }

    toast[toastType](`${icon} ${notification.title}`, toastConfig);
  }, []);

  // Mettre à jour les notifications au montage
  useEffect(() => {
    updateNotifications();
    setCounts(notificationService.getCounts());
  }, [updateNotifications]);

  return {
    notifications,
    unreadNotifications,
    counts,
    unreadCount: counts.unread,
    totalCount: counts.total,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    isConnected,
    showToast
  };
};
