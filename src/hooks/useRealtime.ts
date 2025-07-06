'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@/context/AppContext';
import realtimeService, { 
  NotificationEvent, 
  PresenceEvent, 
  AdminEvent, 
  TypingEvent,
  MessageEvent 
} from '@/services/realtimeService';
import { toast } from 'sonner';

interface UseRealtimeOptions {
  autoConnect?: boolean;
  enableNotifications?: boolean;
  enablePresence?: boolean;
  enableTyping?: boolean;
  enableAdmin?: boolean;
}

interface RealtimeState {
  isConnected: boolean;
  onlineUsers: string[];
  typingUsers: Record<string, string[]>; // conversationId -> usernames[]
  notifications: NotificationEvent[];
  adminEvents: AdminEvent[];
}

/**
 * Hook React pour gérer les connexions temps réel
 */
export const useRealtime = (options: UseRealtimeOptions = {}) => {
  const { user } = useUser();
  const {
    autoConnect = true,
    enableNotifications = true,
    enablePresence = true,
    enableTyping = true,
    enableAdmin = false,
  } = options;

  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    onlineUsers: [],
    typingUsers: {},
    notifications: [],
    adminEvents: [],
  });

  // Connexion automatique
  useEffect(() => {
    if (autoConnect && user) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        connectToRealtime(token);
      }
    }

    return () => {
      if (realtimeService.isSocketConnected()) {
        realtimeService.disconnect();
      }
    };
  }, [user, autoConnect]);

  // Configuration des écouteurs d'événements
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    if (enableNotifications) {
      const unsubNotifications = realtimeService.onNotification((notification) => {
        setState(prev => ({
          ...prev,
          notifications: [notification, ...prev.notifications.slice(0, 49)], // Garder les 50 dernières
        }));
      });
      unsubscribers.push(unsubNotifications);
    }

    if (enablePresence) {
      const unsubPresence = realtimeService.onPresenceChange((presence) => {
        setState(prev => ({
          ...prev,
          onlineUsers: presence.isOnline 
            ? [...new Set([...prev.onlineUsers, presence.userId])]
            : prev.onlineUsers.filter(id => id !== presence.userId),
        }));
      });
      unsubscribers.push(unsubPresence);

      const unsubOnlineUsers = realtimeService.onOnlineUsers((users) => {
        setState(prev => ({ ...prev, onlineUsers: users }));
      });
      unsubscribers.push(unsubOnlineUsers);
    }

    if (enableTyping) {
      const unsubTyping = realtimeService.onTyping((typing) => {
        setState(prev => {
          const conversationTyping = prev.typingUsers[typing.conversationId] || [];
          
          if (typing.isTyping) {
            // Ajouter l'utilisateur à la liste de frappe
            const newTyping = [...conversationTyping];
            if (!newTyping.includes(typing.username)) {
              newTyping.push(typing.username);
            }
            return {
              ...prev,
              typingUsers: {
                ...prev.typingUsers,
                [typing.conversationId]: newTyping,
              },
            };
          } else {
            // Retirer l'utilisateur de la liste de frappe
            const newTyping = conversationTyping.filter(name => name !== typing.username);
            return {
              ...prev,
              typingUsers: {
                ...prev.typingUsers,
                [typing.conversationId]: newTyping,
              },
            };
          }
        });
      });
      unsubscribers.push(unsubTyping);
    }

    if (enableAdmin) {
      const unsubAdmin = realtimeService.onAdminEvent((event) => {
        setState(prev => ({
          ...prev,
          adminEvents: [event, ...prev.adminEvents.slice(0, 99)], // Garder les 100 derniers
        }));
        
        // Notifications spéciales pour les événements admin
        if (event.type === 'user_role_changed' && event.targetUserId === user?.id) {
          toast.success('🎭 Votre rôle a été modifié', {
            description: `Nouveau rôle: ${event.data.newRole}`,
          });
        }
      });
      unsubscribers.push(unsubAdmin);
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [enableNotifications, enablePresence, enableTyping, enableAdmin, user]);

  // Méthodes pour se connecter
  const connectToRealtime = useCallback(async (token: string) => {
    try {
      await realtimeService.connect(token);
      setState(prev => ({ ...prev, isConnected: true }));
      
      if (enablePresence) {
        realtimeService.getOnlineUsers();
      }
      
      if (enableAdmin && user?.permissions?.canAccessAdmin) {
        realtimeService.joinAdminRoom();
      }
      
      toast.success('🔗 Connexion temps réel établie');
    } catch (error) {
      console.error('Erreur de connexion temps réel:', error);
      setState(prev => ({ ...prev, isConnected: false }));
      toast.error('❌ Impossible de se connecter au temps réel');
    }
  }, [enablePresence, enableAdmin, user]);

  const disconnect = useCallback(() => {
    realtimeService.disconnect();
    setState(prev => ({ ...prev, isConnected: false }));
  }, []);

  // Méthodes pour les conversations
  const joinConversation = useCallback((conversationId: string) => {
    realtimeService.joinConversation(conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    realtimeService.leaveConversation(conversationId);
  }, []);

  // Méthodes pour la frappe
  const startTyping = useCallback((conversationId: string) => {
    realtimeService.startTyping(conversationId);
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    realtimeService.stopTyping(conversationId);
  }, []);

  // Méthodes pour l'activité
  const updateActivity = useCallback((activity: string) => {
    realtimeService.updateActivity(activity);
  }, []);

  // Méthodes pour les notifications
  const markNotificationRead = useCallback((notificationId: string) => {
    realtimeService.markNotificationRead(notificationId);
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== notificationId),
    }));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notifications: [] }));
  }, []);

  // Obtenir les utilisateurs qui tapent dans une conversation
  const getTypingUsers = useCallback((conversationId: string): string[] => {
    return state.typingUsers[conversationId] || [];
  }, [state.typingUsers]);

  // Vérifier si un utilisateur est en ligne
  const isUserOnline = useCallback((userId: string): boolean => {
    return state.onlineUsers.includes(userId);
  }, [state.onlineUsers]);

  return {
    // État
    isConnected: state.isConnected,
    onlineUsers: state.onlineUsers,
    notifications: state.notifications,
    adminEvents: state.adminEvents,
    
    // Méthodes de connexion
    connect: connectToRealtime,
    disconnect,
    
    // Méthodes de conversation
    joinConversation,
    leaveConversation,
    
    // Méthodes de frappe
    startTyping,
    stopTyping,
    getTypingUsers,
    
    // Méthodes de présence
    updateActivity,
    isUserOnline,
    
    // Méthodes de notifications
    markNotificationRead,
    clearAllNotifications,
    
    // Statistiques
    stats: {
      totalNotifications: state.notifications.length,
      unreadNotifications: state.notifications.filter(n => !n.data?.read).length,
      connectedUsers: state.onlineUsers.length,
    },
  };
};

/**
 * Hook simplifié pour les notifications temps réel
 */
export const useRealtimeNotifications = () => {
  return useRealtime({
    enableNotifications: true,
    enablePresence: false,
    enableTyping: false,
    enableAdmin: false,
  });
};

/**
 * Hook pour la présence utilisateur
 */
export const useRealtimePresence = () => {
  return useRealtime({
    enableNotifications: false,
    enablePresence: true,
    enableTyping: false,
    enableAdmin: false,
  });
};

/**
 * Hook pour les indicateurs de frappe
 */
export const useRealtimeTyping = () => {
  return useRealtime({
    enableNotifications: false,
    enablePresence: false,
    enableTyping: true,
    enableAdmin: false,
  });
};

/**
 * Hook pour l'administration temps réel
 */
export const useRealtimeAdmin = () => {
  return useRealtime({
    enableNotifications: true,
    enablePresence: true,
    enableTyping: false,
    enableAdmin: true,
  });
};

/**
 * Hook pour les conversations temps réel
 */
export const useRealtimeConversation = (conversationId?: string) => {
  const realtime = useRealtime({
    enableNotifications: true,
    enablePresence: true,
    enableTyping: true,
    enableAdmin: false,
  });

  // Auto-join/leave conversation
  useEffect(() => {
    if (conversationId && realtime.isConnected) {
      realtime.joinConversation(conversationId);
      
      return () => {
        realtime.leaveConversation(conversationId);
      };
    }
  }, [conversationId, realtime.isConnected]);

  return realtime;
};
