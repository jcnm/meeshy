/**
 * NotificationService - Gestion centralisée des notifications
 *
 * Responsabilités :
 * - Créer des notifications pour différents événements (messages, appels manqués, etc.)
 * - Émettre les notifications via Socket.IO en temps réel
 * - Gérer le formatage et la troncature du contenu
 */

import { PrismaClient } from '../../shared/prisma/client';
import { logger } from '../utils/logger';
import type { Server as SocketIOServer } from 'socket.io';

export interface CreateNotificationData {
  userId: string;
  type: 'new_message' | 'missed_call' | 'new_conversation' | 'message_edited' | 'user_mentioned' | 'system';
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
   * Tronquer un message à une longueur maximale (en mots pour le texte)
   */
  private truncateMessage(message: string, maxWords: number = 25): string {
    if (!message) return '';

    const words = message.trim().split(/\s+/);
    if (words.length <= maxWords) {
      return message;
    }
    return words.slice(0, maxWords).join(' ') + '...';
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
        case 'user_mentioned':
          // Les mentions utilisent la même préférence que les messages
          return preferences.newMessageEnabled && preferences.conversationEnabled;
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
    conversationType?: string;
    conversationTitle?: string;
    attachments?: Array<{ id: string; filename: string; mimeType: string; fileSize: number }>;
  }): Promise<NotificationEventData | null> {
    let messagePreview: string;
    let attachmentInfo: any = null;

    // Si le message a des attachments, créer un aperçu spécial
    if (data.attachments && data.attachments.length > 0) {
      const attachment = data.attachments[0];
      const attachmentType = attachment.mimeType.split('/')[0]; // image, video, audio, application

      // Créer une description de l'attachment
      let attachmentDescription = '';
      switch (attachmentType) {
        case 'image':
          attachmentDescription = '📷 Photo';
          break;
        case 'video':
          attachmentDescription = '🎥 Vidéo';
          break;
        case 'audio':
          attachmentDescription = '🎵 Audio';
          break;
        case 'application':
          if (attachment.mimeType === 'application/pdf') {
            attachmentDescription = '📄 PDF';
          } else {
            attachmentDescription = '📎 Document';
          }
          break;
        default:
          attachmentDescription = '📎 Fichier';
      }

      // Si plusieurs attachments
      if (data.attachments.length > 1) {
        attachmentDescription += ` (+${data.attachments.length - 1})`;
      }

      // Combiner le texte du message (s'il y en a) avec l'aperçu d'attachment
      if (data.messageContent && data.messageContent.trim().length > 0) {
        const textPreview = this.truncateMessage(data.messageContent, 15);
        messagePreview = `${textPreview} ${attachmentDescription}`;
      } else {
        messagePreview = attachmentDescription;
      }

      // Ajouter les infos d'attachment pour le frontend
      attachmentInfo = {
        count: data.attachments.length,
        firstType: attachmentType,
        firstFilename: attachment.filename,
        firstMimeType: attachment.mimeType
      };
    } else {
      messagePreview = this.truncateMessage(data.messageContent, 25);
    }

    // Titre simple pour tous les types: "Nouveau message de Xena"
    // Le nom de la conversation est affiché dans le timestamp côté frontend
    const title = `Nouveau message de ${data.senderUsername}`;

    return this.createNotification({
      userId: data.recipientId,
      type: 'new_message',
      title,
      content: messagePreview,
      priority: 'normal',
      senderId: data.senderId,
      senderUsername: data.senderUsername,
      senderAvatar: data.senderAvatar,
      messagePreview,
      conversationId: data.conversationId,
      messageId: data.messageId,
      data: {
        conversationIdentifier: data.conversationIdentifier,
        conversationType: data.conversationType,
        conversationTitle: data.conversationTitle,
        attachments: attachmentInfo
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
   * Créer une notification pour une nouvelle conversation / invitation
   */
  async createConversationInviteNotification(data: {
    invitedUserId: string;
    inviterId: string;
    inviterUsername: string;
    inviterAvatar?: string;
    conversationId: string;
    conversationTitle?: string | null;
    conversationType: string;
  }): Promise<NotificationEventData | null> {
    // Déterminer le contenu selon le type de conversation
    let title: string;
    let content: string;

    if (data.conversationType === 'direct') {
      // Conversation directe: juste le nom de l'inviteur
      title = `Nouvelle conversation avec ${data.inviterUsername}`;
      content = `${data.inviterUsername} a démarré une conversation avec vous`;
    } else {
      // Conversation de groupe: nom de l'inviteur + titre de la conversation
      const conversationName = data.conversationTitle || 'une conversation';
      title = `Invitation à "${conversationName}"`;
      content = `${data.inviterUsername} vous a invité à rejoindre "${conversationName}"`;
    }

    return this.createNotification({
      userId: data.invitedUserId,
      type: 'new_conversation',
      title,
      content,
      priority: 'normal',
      senderId: data.inviterId,
      senderUsername: data.inviterUsername,
      senderAvatar: data.inviterAvatar,
      conversationId: data.conversationId,
      data: {
        conversationTitle: data.conversationTitle,
        conversationType: data.conversationType,
        action: 'view_conversation'
      }
    });
  }

  /**
   * Créer une notification pour une mention d'utilisateur
   */
  async createMentionNotification(data: {
    mentionedUserId: string;
    senderId: string;
    senderUsername: string;
    senderAvatar?: string;
    messageContent: string;
    conversationId: string;
    conversationTitle?: string | null;
    messageId: string;
    isMemberOfConversation: boolean;
  }): Promise<NotificationEventData | null> {
    // Tronquer le message à 20 mots pour l'aperçu
    const messagePreview = this.truncateMessage(data.messageContent, 20);

    // Titre: "@username vous a mentionné dans "Titre de conversation""
    const conversationName = data.conversationTitle || 'une conversation';
    const title = `${data.senderUsername} vous a mentionné dans "${conversationName}"`;

    // Déterminer le contenu et les données selon si l'utilisateur est membre
    let content: string;
    let notificationData: any;

    if (data.isMemberOfConversation) {
      // Utilisateur est membre: afficher l'aperçu du message
      content = messagePreview;
      notificationData = {
        conversationTitle: data.conversationTitle,
        isMember: true,
        action: 'view_message'
      };
    } else {
      // Utilisateur n'est pas membre: invitation à rejoindre
      content = `${messagePreview}\n\nVous n'êtes pas membre de cette conversation. Cliquez pour la rejoindre.`;
      notificationData = {
        conversationTitle: data.conversationTitle,
        isMember: false,
        action: 'join_conversation'
      };
    }

    return this.createNotification({
      userId: data.mentionedUserId,
      type: 'user_mentioned',
      title,
      content,
      priority: 'normal',
      senderId: data.senderId,
      senderUsername: data.senderUsername,
      senderAvatar: data.senderAvatar,
      messagePreview,
      conversationId: data.conversationId,
      messageId: data.messageId,
      data: notificationData
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
