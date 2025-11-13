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

  // Anti-spam: tracking des mentions récentes par paire (sender, recipient)
  // Structure: Map<"senderId:recipientId", timestamp[]>
  private recentMentions: Map<string, number[]> = new Map();

  // Limite: max 5 mentions par minute d'un sender vers un recipient
  private readonly MAX_MENTIONS_PER_MINUTE = 5;
  private readonly MENTION_WINDOW_MS = 60000; // 1 minute

  constructor(private prisma: PrismaClient) {
    // Nettoyer les mentions anciennes toutes les 2 minutes
    setInterval(() => this.cleanupOldMentions(), 120000);
  }

  /**
   * Initialiser le service avec Socket.IO
   */
  setSocketIO(io: SocketIOServer, userSocketsMap: Map<string, Set<string>>) {
    this.io = io;
    this.userSocketsMap = userSocketsMap;
    logger.info('📢 NotificationService: Socket.IO initialized');
  }

  /**
   * Nettoie les mentions anciennes du cache anti-spam
   */
  private cleanupOldMentions(): void {
    const now = Date.now();
    const cutoff = now - this.MENTION_WINDOW_MS;

    for (const [key, timestamps] of this.recentMentions.entries()) {
      // Filtrer les timestamps trop anciens
      const recent = timestamps.filter(ts => ts > cutoff);

      if (recent.length === 0) {
        this.recentMentions.delete(key);
      } else {
        this.recentMentions.set(key, recent);
      }
    }
  }

  /**
   * Vérifie si une notification de mention doit être créée (anti-spam)
   * @returns true si la notification doit être créée, false si rate-limitée
   */
  private shouldCreateMentionNotification(senderId: string, recipientId: string): boolean {
    const key = `${senderId}:${recipientId}`;
    const now = Date.now();
    const cutoff = now - this.MENTION_WINDOW_MS;

    // Récupérer les mentions récentes
    const timestamps = this.recentMentions.get(key) || [];

    // Filtrer les mentions dans la fenêtre temporelle
    const recentTimestamps = timestamps.filter(ts => ts > cutoff);

    // Vérifier la limite
    if (recentTimestamps.length >= this.MAX_MENTIONS_PER_MINUTE) {
      console.warn(
        `[NotificationService] Anti-spam: ${senderId} a déjà mentionné ${recipientId} ${recentTimestamps.length} fois dans la dernière minute`
      );
      return false;
    }

    // Ajouter le timestamp actuel
    recentTimestamps.push(now);
    this.recentMentions.set(key, recentTimestamps);

    return true;
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
   * Créer une notification pour rejoindre une conversation via lien
   */
  async createConversationJoinNotification(data: {
    userId: string;
    conversationId: string;
    conversationTitle?: string | null;
    conversationType: string;
    isJoiner: boolean; // true = utilisateur qui rejoint, false = admin qui est notifié
    joinerUsername?: string; // Nom de l'utilisateur qui rejoint (pour les admins)
    joinerAvatar?: string;
  }): Promise<NotificationEventData | null> {
    let title: string;
    let content: string;

    if (data.isJoiner) {
      // Notification de confirmation pour l'utilisateur qui rejoint
      const conversationName = data.conversationTitle || 'la conversation';
      title = `Bienvenue dans "${conversationName}"`;
      content = `Vous avez rejoint "${conversationName}" avec succès`;

      return this.createNotification({
        userId: data.userId,
        type: 'new_conversation',
        title,
        content,
        priority: 'normal',
        conversationId: data.conversationId,
        data: {
          conversationTitle: data.conversationTitle,
          conversationType: data.conversationType,
          action: 'view_conversation',
          joinType: 'via_link'
        }
      });
    } else {
      // Notification pour les admins qu'un nouveau membre a rejoint
      const conversationName = data.conversationTitle || 'la conversation';
      const joinerName = data.joinerUsername || 'Un utilisateur';
      title = `Nouveau membre dans "${conversationName}"`;
      content = `${joinerName} a rejoint "${conversationName}" via un lien partagé`;

      return this.createNotification({
        userId: data.userId,
        type: 'new_conversation',
        title,
        content,
        priority: 'low',
        senderUsername: data.joinerUsername,
        senderAvatar: data.joinerAvatar,
        conversationId: data.conversationId,
        data: {
          conversationTitle: data.conversationTitle,
          conversationType: data.conversationType,
          joinerUsername: data.joinerUsername,
          action: 'view_conversation',
          notificationType: 'member_joined'
        }
      });
    }
  }

  /**
   * PERFORMANCE: Créer des notifications de mention en batch (évite N+1 queries)
   * Crée toutes les notifications en une seule query avec createMany
   *
   * @param mentionedUserIds - Liste des IDs d'utilisateurs mentionnés
   * @param commonData - Données communes à toutes les notifications
   * @param memberIds - IDs des membres de la conversation (pour déterminer isMember)
   * @returns Nombre de notifications créées
   */
  async createMentionNotificationsBatch(
    mentionedUserIds: string[],
    commonData: {
      senderId: string;
      senderUsername: string;
      senderAvatar?: string;
      messageContent: string;
      conversationId: string;
      conversationTitle?: string | null;
      messageId: string;
      attachments?: Array<{ id: string; filename: string; mimeType: string; fileSize: number }>;
    },
    memberIds: string[]
  ): Promise<number> {
    if (mentionedUserIds.length === 0) {
      return 0;
    }

    try {
      // Préparer le messagePreview et attachmentInfo (une fois pour tous)
      let messagePreview: string;
      let attachmentInfo: any = null;

      if (commonData.attachments && commonData.attachments.length > 0) {
        const attachment = commonData.attachments[0];
        const attachmentType = attachment.mimeType.split('/')[0];

        let attachmentDescription = '';
        switch (attachmentType) {
          case 'image': attachmentDescription = '📷 Photo'; break;
          case 'video': attachmentDescription = '🎥 Vidéo'; break;
          case 'audio': attachmentDescription = '🎵 Audio'; break;
          case 'application':
            attachmentDescription = attachment.mimeType === 'application/pdf' ? '📄 PDF' : '📎 Document';
            break;
          default: attachmentDescription = '📎 Fichier';
        }

        if (commonData.attachments.length > 1) {
          attachmentDescription += ` (+${commonData.attachments.length - 1})`;
        }

        if (commonData.messageContent && commonData.messageContent.trim().length > 0) {
          const textPreview = this.truncateMessage(commonData.messageContent, 15);
          messagePreview = `${textPreview} ${attachmentDescription}`;
        } else {
          messagePreview = attachmentDescription;
        }

        attachmentInfo = {
          count: commonData.attachments.length,
          firstType: attachmentType,
          firstFilename: attachment.filename,
          firstMimeType: attachment.mimeType
        };
      } else {
        messagePreview = this.truncateMessage(commonData.messageContent, 20);
      }

      const conversationName = commonData.conversationTitle || 'une conversation';
      const title = `${commonData.senderUsername} vous a mentionné dans "${conversationName}"`;

      // Filtrer les utilisateurs qui ont dépassé le rate limit
      const validMentionedUserIds: string[] = [];
      for (const mentionedUserId of mentionedUserIds) {
        // Ne pas créer de notification pour le sender
        if (mentionedUserId === commonData.senderId) continue;

        // SÉCURITÉ: Vérifier le rate limit
        if (!this.shouldCreateMentionNotification(commonData.senderId, mentionedUserId)) {
          console.log(`[NotificationService] Notification de mention bloquée (rate limit): ${commonData.senderId} → ${mentionedUserId}`);
          continue;
        }

        validMentionedUserIds.push(mentionedUserId);
      }

      if (validMentionedUserIds.length === 0) {
        console.log('[NotificationService] Aucune notification de mention à créer après filtrage rate limit');
        return 0;
      }

      // Vérifier les préférences de notification pour chaque utilisateur
      const usersToNotify: string[] = [];
      await Promise.all(
        validMentionedUserIds.map(async (userId) => {
          const shouldSend = await this.shouldSendNotification(userId, 'user_mentioned');
          if (shouldSend) {
            usersToNotify.push(userId);
          }
        })
      );

      if (usersToNotify.length === 0) {
        console.log('[NotificationService] Aucune notification de mention à créer après vérification des préférences');
        return 0;
      }

      // Préparer les données pour createMany
      const notificationsData = usersToNotify.map(mentionedUserId => {
        const isMember = memberIds.includes(mentionedUserId);

        // Déterminer le contenu et les données selon si l'utilisateur est membre
        let content: string;
        let notificationData: any;

        if (isMember) {
          content = messagePreview;
          notificationData = {
            conversationTitle: commonData.conversationTitle,
            isMember: true,
            action: 'view_message',
            attachments: attachmentInfo
          };
        } else {
          content = `${messagePreview}\n\nVous n'êtes pas membre de cette conversation. Cliquez pour la rejoindre.`;
          notificationData = {
            conversationTitle: commonData.conversationTitle,
            isMember: false,
            action: 'join_conversation',
            attachments: attachmentInfo
          };
        }

        return {
          userId: mentionedUserId,
          type: 'user_mentioned',
          title,
          content,
          priority: 'normal',
          senderId: commonData.senderId,
          senderUsername: commonData.senderUsername,
          senderAvatar: commonData.senderAvatar,
          messagePreview,
          conversationId: commonData.conversationId,
          messageId: commonData.messageId,
          data: JSON.stringify(notificationData),
          isRead: false
        };
      });

      // PERFORMANCE: Créer toutes les notifications en une seule query
      // Note: skipDuplicates n'est pas supporté avec MongoDB
      const result = await this.prisma.notification.createMany({
        data: notificationsData
      });

      console.log(`[NotificationService] ✅ Created ${result.count} mention notifications in batch`);

      // Récupérer les notifications créées pour les émettre via Socket.IO
      // Note: createMany ne retourne pas les objets créés, on doit les récupérer
      const createdNotifications = await this.prisma.notification.findMany({
        where: {
          messageId: commonData.messageId,
          type: 'user_mentioned',
          userId: { in: usersToNotify }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: usersToNotify.length
      });

      // Émettre les notifications via Socket.IO
      for (const notification of createdNotifications) {
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
          data: notification.data ? JSON.parse(notification.data) : undefined
        };

        this.emitNotification(notification.userId, notificationEvent);
      }

      return result.count;
    } catch (error) {
      console.error('[NotificationService] ❌ Error creating batch mention notifications:', error);
      return 0;
    }
  }

  /**
   * Créer une notification pour une mention d'utilisateur
   * SÉCURITÉ: Limite à 5 mentions/minute d'un sender vers un recipient
   * NOTE: Préférer createMentionNotificationsBatch pour des performances optimales
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
    attachments?: Array<{ id: string; filename: string; mimeType: string; fileSize: number }>;
  }): Promise<NotificationEventData | null> {
    // SÉCURITÉ: Anti-spam - Vérifier le rate limit
    if (!this.shouldCreateMentionNotification(data.senderId, data.mentionedUserId)) {
      console.log(`[NotificationService] Notification de mention bloquée (rate limit): ${data.senderId} → ${data.mentionedUserId}`);
      return null;
    }
    // Traiter le message avec attachments si présents
    let messagePreview: string;
    let attachmentInfo: any = null;

    if (data.attachments && data.attachments.length > 0) {
      const attachment = data.attachments[0];
      const attachmentType = attachment.mimeType.split('/')[0];

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

      // Combiner le texte avec l'aperçu d'attachment
      if (data.messageContent && data.messageContent.trim().length > 0) {
        const textPreview = this.truncateMessage(data.messageContent, 15);
        messagePreview = `${textPreview} ${attachmentDescription}`;
      } else {
        messagePreview = attachmentDescription;
      }

      // Ajouter les infos d'attachment
      attachmentInfo = {
        count: data.attachments.length,
        firstType: attachmentType,
        firstFilename: attachment.filename,
        firstMimeType: attachment.mimeType
      };
    } else {
      // Tronquer le message à 20 mots pour l'aperçu
      messagePreview = this.truncateMessage(data.messageContent, 20);
    }

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
        action: 'view_message',
        attachments: attachmentInfo
      };
    } else {
      // Utilisateur n'est pas membre: invitation à rejoindre
      content = `${messagePreview}\n\nVous n'êtes pas membre de cette conversation. Cliquez pour la rejoindre.`;
      notificationData = {
        conversationTitle: data.conversationTitle,
        isMember: false,
        action: 'join_conversation',
        attachments: attachmentInfo
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
