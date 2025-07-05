'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

export interface NotificationData {
  id: string;
  type: 'message' | 'user_joined' | 'user_left' | 'conversation_updated';
  title: string;
  message: string;
  conversationId?: string;
  userId?: string;
  timestamp: Date;
}

interface MessageNotificationData {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  conversationId: string;
  timestamp: string;
}

interface UserConversationData {
  userId: string;
  username: string;
  conversationId: string;
  conversationName?: string;
}

interface UseNotificationsReturn {
  notifications: NotificationData[];
  connectToNotifications: (token: string, userId: string) => void;
  disconnectFromNotifications: () => void;
  markAsRead: (notificationId: string) => void;
  clearAll: () => void;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  const connectToNotifications = useCallback((token: string, userId: string) => {
    if (socket?.connected) return;

    const newSocket = io('http://localhost:3002', {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('🔔 Connecté au service de notifications');
    });

    // Nouvelle notification de message
    newSocket.on('newMessageNotification', (data: MessageNotificationData) => {
      if (data.senderId !== userId) { // Ne pas notifier pour ses propres messages
        const notification: NotificationData = {
          id: `msg-${data.messageId}`,
          type: 'message',
          title: `Nouveau message de ${data.senderName}`,
          message: data.content.substring(0, 50) + (data.content.length > 50 ? '...' : ''),
          conversationId: data.conversationId,
          userId: data.senderId,
          timestamp: new Date(data.timestamp),
        };

        setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Garder max 10 notifications
        
        // Toast pour notification immédiate
        toast.success(`💬 ${notification.title}`, {
          description: notification.message,
          action: {
            label: 'Voir',
            onClick: () => {
              window.location.href = `/chat/${data.conversationId}`;
            },
          },
        });
      }
    });

    // Utilisateur rejoint une conversation
    newSocket.on('userJoinedConversation', (data: UserConversationData) => {
      if (data.userId !== userId) {
        const notification: NotificationData = {
          id: `join-${data.userId}-${data.conversationId}`,
          type: 'user_joined',
          title: `${data.username} a rejoint la conversation`,
          message: data.conversationName || 'Conversation',
          conversationId: data.conversationId,
          userId: data.userId,
          timestamp: new Date(),
        };

        setNotifications(prev => [notification, ...prev.slice(0, 9)]);
        toast.info(`👋 ${notification.title}`);
      }
    });

    // Utilisateur quitte une conversation
    newSocket.on('userLeftConversation', (data: UserConversationData) => {
      if (data.userId !== userId) {
        const notification: NotificationData = {
          id: `leave-${data.userId}-${data.conversationId}`,
          type: 'user_left',
          title: `${data.username} a quitté la conversation`,
          message: data.conversationName || 'Conversation',
          conversationId: data.conversationId,
          userId: data.userId,
          timestamp: new Date(),
        };

        setNotifications(prev => [notification, ...prev.slice(0, 9)]);
        toast.info(`👋 ${notification.title}`);
      }
    });

    setSocket(newSocket);
  }, [socket]);

  const disconnectFromNotifications = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  }, [socket]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    return () => {
      disconnectFromNotifications();
    };
  }, [disconnectFromNotifications]);

  return {
    notifications,
    connectToNotifications,
    disconnectFromNotifications,
    markAsRead,
    clearAll,
  };
};
