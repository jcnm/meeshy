/**
 * NotificationService - Gestion centralisée des notifications
 *
 * Responsabilités :
 * - Créer des notifications pour différents événements (messages, appels manqués, etc.)
 * - Émettre les notifications via Socket.IO en temps réel
 * - Gérer le formatage et la troncature du contenu
 */

import { PrismaClient } from '../../shared/client';
import { logger } from '../utils/logger';
import type { Server as SocketIOServer } from 'socket.io';

export interface CreateNotificationData {
  userId: string;
  type: 'new_message' | 'missed_call' | 'new_conversation' | 'message_edited' | 'system';
  title: string;
  content: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  // Informations de l'expéditeur
  senderId?: string;
  senderUsername?: string;
  senderAvatar?: string;

  // Aperçu du message
  messagePreview?: string;

  // Références pour navigation
  conversationId?: string;
  messageId?: string;
  callSessionId?: string;

  // Données supplémentaires
  data?: any;
  expiresAt?: Date;
}

export interface NotificationEventData {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  priority: string;
  isRead: boolean;
  createdAt: Date;

  // Informations enrichies
  senderId?: string;
  senderUsername?: string;
  senderAvatar?: string;
  messagePreview?: string;
  conversationId?: string;
  messageId?: string;
  callSessionId?: string;
  data?: any;
}

export class NotificationService {
  private io: SocketIOServer | null = null;
  private userSocketsMap: Map<string, Set<string>> = new Map();

  constructor(private prisma: PrismaClient) {}

  /**
   * Initialiser le service avec Socket.IO
   */
  setSocketIO(io: SocketIOServer, userSocketsMap: Map<string, Set<string>>) {
    this.io = io;
    this.userSocketsMap = userSocketsMap;
    logger.info('📢 NotificationService: Socket.IO initialized');
  }

  /**
   * Tronquer un message à une longueur maximale
   */
  private truncateMessage(message: string, maxLength: number = 32): string {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength - 3) + '...';
  }

  /**
   * Vérifier si l'utilisateur a activé ce type de notification
   */
  private async shouldSendNotification(userId: string, type: string): Promise<boolean> {
    try {
      const preferences = await this.prisma.notificationPreference.findUnique({
        where: { userId }
      });

      // Si aucune préférence, envoyer par défaut
      if (!preferences) {
        return true;
      }

      // Vérifier Do Not Disturb
      if (preferences.dndEnabled && preferences.dndStartTime && preferences.dndEndTime) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        if (currentTime >= preferences.dndStartTime && currentTime <= preferences.dndEndTime) {
          logger.debug('📢 Notification supprimée (Do Not Disturb)', { userId, type });
          return false;
        }
      }

      // Vérifier les préférences par type
      switch (type) {
        case 'new_message':
          return preferences.newMessageEnabled;
        case 'missed_call':
          return preferences.missedCallEnabled;
        case 'system':
          return preferences.systemEnabled;
        case 'new_conversation':
        case 'message_edited':
          return preferences.conversationEnabled;
        default:
          return true;
      }
    } catch (error) {
      logger.error('❌ Error checking notification preferences:', error);
      // En cas d'erreur, envoyer quand même
      return true;
    }
  }

  /**
   * Créer une notification et l'émettre en temps réel
   */
  async createNotification(data: CreateNotificationData): Promise<NotificationEventData | null> {
    try {
      // Vérifier les préférences de l'utilisateur
      const shouldSend = await this.shouldSendNotification(data.userId, data.type);
      if (!shouldSend) {
        logger.debug('📢 Notification skipped due to user preferences', {
          type: data.type,
          userId: data.userId
        });
        return null;
      }

      logger.info('📢 Creating notification', {
        type: data.type,
        userId: data.userId,
        conversationId: data.conversationId
      });

      // Créer la notification en base de données
      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          content: data.content,
          priority: data.priority || 'normal',
          senderId: data.senderId,
          senderUsername: data.senderUsername,
          senderAvatar: data.senderAvatar,
          messagePreview: data.messagePreview,
          conversationId: data.conversationId,
          messageId: data.messageId,
          callSessionId: data.callSessionId,
          data: data.data ? JSON.stringify(data.data) : null,
          expiresAt: data.expiresAt,
          isRead: false
        }
      });

      // Créer l'événement pour Socket.IO
      const notificationEvent: NotificationEventData = {
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        priority: notification.priority,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        senderId: notification.senderId || undefined,
        senderUsername: notification.senderUsername || undefined,
        senderAvatar: notification.senderAvatar || undefined,
        messagePreview: notification.messagePreview || undefined,
        conversationId: notification.conversationId || undefined,
        messageId: notification.messageId || undefined,
        callSessionId: notification.callSessionId || undefined,
        data: notification.data ? JSON.parse(notification.data) : undefined
      };

      // Émettre via Socket.IO si disponible
      this.emitNotification(data.userId, notificationEvent);

      logger.info('✅ Notification created and emitted', {
        notificationId: notification.id,
        type: notification.type
      });

      return notificationEvent;
    } catch (error) {
      logger.error('❌ Error creating notification:', error);
      return null;
    }
  }

  /**
   * Créer une notification pour un nouveau message
   */
  async createMessageNotification(data: {
    recipientId: string;
    senderId: string;
    senderUsername: string;
    senderAvatar?: string;
    messageContent: string;
    conversationId: string;
    messageId: string;
    conversationIdentifier?: string;
  }): Promise<NotificationEventData | null> {
    const messagePreview = this.truncateMessage(data.messageContent, 32);

    return this.createNotification({
      userId: data.recipientId,
      type: 'new_message',
      title: `Nouveau message de ${data.senderUsername}`,
      content: messagePreview,
      priority: 'normal',
      senderId: data.senderId,
      senderUsername: data.senderUsername,
      senderAvatar: data.senderAvatar,
      messagePreview,
      conversationId: data.conversationId,
      messageId: data.messageId,
      data: {
        conversationIdentifier: data.conversationIdentifier
      }
    });
  }

  /**
   * Créer une notification pour un appel manqué
   */
  async createMissedCallNotification(data: {
    recipientId: string;
    callerId: string;
    callerUsername: string;
    callerAvatar?: string;
    conversationId: string;
    callSessionId: string;
    callType?: 'video' | 'audio';
  }): Promise<NotificationEventData | null> {
    const callTypeLabel = data.callType === 'audio' ? 'audio' : 'vidéo';

    return this.createNotification({
      userId: data.recipientId,
      type: 'missed_call',
      title: `Appel ${callTypeLabel} manqué`,
      content: `Appel manqué de ${data.callerUsername}`,
      priority: 'high',
      senderId: data.callerId,
      senderUsername: data.callerUsername,
      senderAvatar: data.callerAvatar,
      conversationId: data.conversationId,
      callSessionId: data.callSessionId,
      data: {
        callType: data.callType || 'video'
      }
    });
  }

  /**
   * Émettre une notification via Socket.IO
   */
  private emitNotification(userId: string, notification: NotificationEventData) {
    if (!this.io) {
      logger.warn('⚠️ Socket.IO not initialized, cannot emit notification');
      return;
    }

    // Récupérer tous les sockets de l'utilisateur
    const userSockets = this.userSocketsMap.get(userId);

    if (!userSockets || userSockets.size === 0) {
      logger.debug('📢 User not connected, notification saved for later', { userId });
      return;
    }

    // Émettre la notification à tous les sockets de l'utilisateur
    userSockets.forEach(socketId => {
      this.io!.to(socketId).emit('notification', notification);
      logger.debug('📢 Notification emitted to socket', {
        socketId,
        notificationId: notification.id,
        type: notification.type
      });
    });

    logger.info('📢 Notification broadcasted to user', {
      userId,
      socketCount: userSockets.size,
      notificationId: notification.id
    });
  }

  /**
   * Marquer une notification comme lue
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      await this.prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId
        },
        data: {
          isRead: true
        }
      });
      return true;
    } catch (error) {
      logger.error('❌ Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Marquer toutes les notifications d'un utilisateur comme lues
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      await this.prisma.notification.updateMany({
        where: {
          userId,
          isRead: false
        },
        data: {
          isRead: true
        }
      });
      return true;
    } catch (error) {
      logger.error('❌ Error marking all notifications as read:', error);
      return false;
    }
  }

  /**
   * Supprimer une notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      await this.prisma.notification.deleteMany({
        where: {
          id: notificationId,
          userId
        }
      });
      return true;
    } catch (error) {
      logger.error('❌ Error deleting notification:', error);
      return false;
    }
  }

  /**
   * Récupérer le nombre de notifications non lues
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.prisma.notification.count({
        where: {
          userId,
          isRead: false
        }
      });
    } catch (error) {
      logger.error('❌ Error getting unread count:', error);
      return 0;
    }
  }
}
