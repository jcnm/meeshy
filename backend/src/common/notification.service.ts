import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

export enum NotificationType {
  MESSAGE_RECEIVED = 'message_received',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  CONVERSATION_CREATED = 'conversation_created',
  CONVERSATION_UPDATED = 'conversation_updated',
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  USER_ONLINE = 'user_online',
  USER_OFFLINE = 'user_offline',
}

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  timestamp: Date;
  expiresAt?: Date;
}

export interface UserNotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  types: {
    [NotificationType.MESSAGE_RECEIVED]: boolean;
    [NotificationType.USER_JOINED]: boolean;
    [NotificationType.USER_LEFT]: boolean;
    [NotificationType.CONVERSATION_CREATED]: boolean;
    [NotificationType.CONVERSATION_UPDATED]: boolean;
    [NotificationType.TYPING_START]: boolean;
    [NotificationType.TYPING_STOP]: boolean;
    [NotificationType.USER_ONLINE]: boolean;
    [NotificationType.USER_OFFLINE]: boolean;
  };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private notificationQueue = new Map<string, NotificationPayload[]>();

  constructor(private cache: CacheService) {}

  /**
   * Crée une notification
   */
  createNotification(
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, unknown> = {},
    expiresAt?: Date
  ): NotificationPayload {
    return {
      id: this.generateNotificationId(),
      type,
      title,
      body,
      data,
      timestamp: new Date(),
      expiresAt,
    };
  }

  /**
   * Envoie une notification à un utilisateur spécifique
   */
  async sendToUser(
    userId: string,
    notification: NotificationPayload
  ): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);
      
      if (!this.shouldSendNotification(notification.type, preferences)) {
        this.logger.debug(`Notification ${notification.id} skipped for user ${userId} (preferences)`);
        return;
      }

      // Ajouter à la queue des notifications de l'utilisateur
      this.addToUserQueue(userId, notification);

      // Marquer comme envoyée dans le cache pour éviter les doublons
      this.cache.set(
        `notification:sent:${notification.id}:${userId}`,
        true,
        60 * 60 * 1000 // 1 heure
      );

      this.logger.debug(`Notification ${notification.id} sent to user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to send notification to user ${userId}:`, error);
    }
  }

  /**
   * Envoie une notification à plusieurs utilisateurs
   */
  async sendToUsers(
    userIds: string[],
    notification: NotificationPayload
  ): Promise<void> {
    const sendPromises = userIds.map(userId => 
      this.sendToUser(userId, notification)
    );

    await Promise.allSettled(sendPromises);
    this.logger.log(`Notification ${notification.id} sent to ${userIds.length} users`);
  }

  /**
   * Envoie une notification à tous les participants d'une conversation
   */
  async sendToConversation(
    conversationId: string,
    notification: NotificationPayload,
    excludeUserId?: string
  ): Promise<void> {
    try {
      // Récupérer les participants de la conversation (avec cache)
      const participants = await this.cache.getOrSet(
        `conversation:${conversationId}:participants`,
        async () => {
          // Ici, on pourrait appeler le service de conversation
          // Pour l'instant, on retourne un tableau vide
          return [];
        },
        CacheService.TTL.MEDIUM
      );

      const targetUserIds = (participants as { userId: string }[])
        .filter(p => p.userId !== excludeUserId)
        .map(p => p.userId);

      await this.sendToUsers(targetUserIds, notification);
    } catch (error) {
      this.logger.error(`Failed to send notification to conversation ${conversationId}:`, error);
    }
  }

  /**
   * Récupère les notifications en attente pour un utilisateur
   */
  getUserNotifications(userId: string): NotificationPayload[] {
    const userQueue = this.notificationQueue.get(userId) || [];
    
    // Filtrer les notifications expirées
    const now = new Date();
    const validNotifications = userQueue.filter(notification => 
      !notification.expiresAt || notification.expiresAt > now
    );

    // Mettre à jour la queue
    this.notificationQueue.set(userId, validNotifications);

    return validNotifications;
  }

  /**
   * Marque une notification comme lue
   */
  markAsRead(userId: string, notificationId: string): boolean {
    const userQueue = this.notificationQueue.get(userId);
    if (!userQueue) return false;

    const notificationIndex = userQueue.findIndex(n => n.id === notificationId);
    if (notificationIndex === -1) return false;

    // Supprimer la notification de la queue
    userQueue.splice(notificationIndex, 1);
    this.notificationQueue.set(userId, userQueue);

    this.logger.debug(`Notification ${notificationId} marked as read for user ${userId}`);
    return true;
  }

  /**
   * Marque toutes les notifications comme lues pour un utilisateur
   */
  markAllAsRead(userId: string): number {
    const userQueue = this.notificationQueue.get(userId);
    if (!userQueue) return 0;

    const count = userQueue.length;
    this.notificationQueue.set(userId, []);

    this.logger.log(`${count} notifications marked as read for user ${userId}`);
    return count;
  }

  /**
   * Récupère les préférences de notification d'un utilisateur
   */
  private async getUserPreferences(userId: string): Promise<UserNotificationPreferences> {
    const cacheKey = `user:${userId}:notification_preferences`;
    
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Préférences par défaut
        return {
          userId,
          pushEnabled: true,
          emailEnabled: false,
          types: {
            [NotificationType.MESSAGE_RECEIVED]: true,
            [NotificationType.USER_JOINED]: true,
            [NotificationType.USER_LEFT]: false,
            [NotificationType.CONVERSATION_CREATED]: true,
            [NotificationType.CONVERSATION_UPDATED]: false,
            [NotificationType.TYPING_START]: false,
            [NotificationType.TYPING_STOP]: false,
            [NotificationType.USER_ONLINE]: false,
            [NotificationType.USER_OFFLINE]: false,
          },
        };
      },
      CacheService.TTL.LONG
    );
  }

  /**
   * Met à jour les préférences de notification d'un utilisateur
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserNotificationPreferences>
  ): Promise<UserNotificationPreferences> {
    const currentPreferences = await this.getUserPreferences(userId);
    const updatedPreferences = { ...currentPreferences, ...preferences };

    const cacheKey = `user:${userId}:notification_preferences`;
    this.cache.set(cacheKey, updatedPreferences, CacheService.TTL.LONG);

    this.logger.log(`Notification preferences updated for user ${userId}`);
    return updatedPreferences;
  }

  /**
   * Vérifie si une notification doit être envoyée selon les préférences
   */
  private shouldSendNotification(
    type: NotificationType,
    preferences: UserNotificationPreferences
  ): boolean {
    return preferences.types[type] === true;
  }

  /**
   * Ajoute une notification à la queue d'un utilisateur
   */
  private addToUserQueue(userId: string, notification: NotificationPayload): void {
    const userQueue = this.notificationQueue.get(userId) || [];
    userQueue.push(notification);

    // Limiter la taille de la queue à 100 notifications
    if (userQueue.length > 100) {
      userQueue.shift(); // Supprimer la plus ancienne
    }

    this.notificationQueue.set(userId, userQueue);
  }

  /**
   * Génère un ID unique pour une notification
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Nettoie les notifications expirées (appelé périodiquement)
   */
  cleanupExpiredNotifications(): void {
    const now = new Date();
    let totalCleaned = 0;

    for (const [userId, notifications] of this.notificationQueue.entries()) {
      const validNotifications = notifications.filter(notification => 
        !notification.expiresAt || notification.expiresAt > now
      );

      const cleanedCount = notifications.length - validNotifications.length;
      totalCleaned += cleanedCount;

      this.notificationQueue.set(userId, validNotifications);
    }

    if (totalCleaned > 0) {
      this.logger.log(`Cleaned up ${totalCleaned} expired notifications`);
    }
  }

  /**
   * Récupère les statistiques des notifications
   */
  getStats(): {
    totalUsers: number;
    totalNotifications: number;
    averagePerUser: number;
  } {
    const totalUsers = this.notificationQueue.size;
    const totalNotifications = Array.from(this.notificationQueue.values())
      .reduce((total, queue) => total + queue.length, 0);

    return {
      totalUsers,
      totalNotifications,
      averagePerUser: totalUsers > 0 ? Math.round(totalNotifications / totalUsers) : 0,
    };
  }
}
