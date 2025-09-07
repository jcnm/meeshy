/**
 * Service unifié de gestion des notifications backend
 * Dissocie complètement les notifications des messages
 */

import { PrismaClient } from '@prisma/client';
import { MeeshySocketIOManager } from '../socketio/MeeshySocketIOManager';

export interface NotificationData {
  id: string;
  type: 'message' | 'system' | 'user_action' | 'conversation' | 'translation';
  title: string;
  message: string;
  data?: any;
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  timestamp: Date;
  isRead: boolean;
  translations?: {
    fr?: string;
    en?: string;
    es?: string;
  };
}

export interface NotificationCounts {
  total: number;
  unread: number;
  byType: {
    message: number;
    system: number;
    user_action: number;
    conversation: number;
    translation: number;
  };
}

export class UnifiedNotificationService {
  private prisma: PrismaClient;
  private socketIOManager: MeeshySocketIOManager;

  constructor(prisma: PrismaClient, socketIOManager: MeeshySocketIOManager) {
    this.prisma = prisma;
    this.socketIOManager = socketIOManager;
  }

  /**
   * Envoie une notification de message
   */
  public async sendMessageNotification(
    messageId: string,
    conversationId: string,
    senderId: string,
    isAnonymousSender: boolean
  ): Promise<void> {
    try {
      // Récupérer les détails du message
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        include: {
          conversation: true,
          user: true,
          anonymousSender: true
        }
      });

      if (!message) {
        console.error(`❌ Message ${messageId} non trouvé`);
        return;
      }

      // Construire les données de notification
      const notificationData = await this.buildMessageNotificationData(
        message,
        isAnonymousSender
      );

      // Récupérer les membres de la conversation
      const conversationMembers = await this.getConversationMembers(conversationId);

      // Envoyer la notification à tous les membres sauf l'expéditeur
      const targetUsers = conversationMembers.filter(member => 
        member.userId !== senderId && 
        !this.socketIOManager.isUserInConversationRoom(member.userId, conversationId)
      );

      for (const member of targetUsers) {
        await this.sendNotificationToUser(member.userId, notificationData);
      }

      console.log(`✅ Notification de message envoyée à ${targetUsers.length} utilisateurs`);
    } catch (error) {
      console.error(`❌ Erreur envoi notification message ${messageId}:`, error);
    }
  }

  /**
   * Envoie une notification de traduction
   */
  public async sendTranslationNotification(
    messageId: string,
    conversationId: string,
    translations: { fr?: string; en?: string; es?: string }
  ): Promise<void> {
    try {
      // Récupérer les détails du message
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        include: {
          conversation: true,
          user: true,
          anonymousSender: true
        }
      });

      if (!message) {
        console.error(`❌ Message ${messageId} non trouvé pour la traduction`);
        return;
      }

      // Construire les données de notification de traduction
      const notificationData: NotificationData = {
        id: `trans-${messageId}`,
        type: 'translation',
        title: 'Traduction disponible',
        message: this.buildMultilingualMessage(message.content, translations),
        data: {
          messageId,
          conversationId,
          translations,
          originalContent: message.content
        },
        conversationId,
        senderId: message.senderId || message.anonymousSenderId,
        senderName: message.user?.username || message.anonymousSender?.name || 'Utilisateur',
        timestamp: new Date(),
        isRead: false,
        translations
      };

      // Récupérer les membres de la conversation
      const conversationMembers = await this.getConversationMembers(conversationId);

      // Envoyer la notification à tous les membres non connectés
      const targetUsers = conversationMembers.filter(member => 
        !this.socketIOManager.isUserInConversationRoom(member.userId, conversationId)
      );

      for (const member of targetUsers) {
        await this.sendNotificationToUser(member.userId, notificationData);
      }

      console.log(`✅ Notification de traduction envoyée à ${targetUsers.length} utilisateurs`);
    } catch (error) {
      console.error(`❌ Erreur envoi notification traduction ${messageId}:`, error);
    }
  }

  /**
   * Envoie une notification système
   */
  public async sendSystemNotification(
    userId: string,
    title: string,
    message: string,
    data?: any
  ): Promise<void> {
    try {
      const notificationData: NotificationData = {
        id: `sys-${Date.now()}-${userId}`,
        type: 'system',
        title,
        message,
        data,
        timestamp: new Date(),
        isRead: false
      };

      await this.sendNotificationToUser(userId, notificationData);
      console.log(`✅ Notification système envoyée à ${userId}`);
    } catch (error) {
      console.error(`❌ Erreur envoi notification système à ${userId}:`, error);
    }
  }

  /**
   * Envoie une notification de conversation
   */
  public async sendConversationNotification(
    conversationId: string,
    type: 'user_joined' | 'user_left' | 'conversation_created' | 'conversation_updated',
    data: any
  ): Promise<void> {
    try {
      const conversationMembers = await this.getConversationMembers(conversationId);
      
      const notificationData: NotificationData = {
        id: `conv-${conversationId}-${type}-${Date.now()}`,
        type: 'conversation',
        title: this.getConversationNotificationTitle(type, data),
        message: this.getConversationNotificationMessage(type, data),
        data: {
          conversationId,
          type,
          ...data
        },
        conversationId,
        timestamp: new Date(),
        isRead: false
      };

      // Envoyer à tous les membres sauf l'utilisateur qui a déclenché l'action
      const targetUsers = conversationMembers.filter(member => 
        member.userId !== data.userId
      );

      for (const member of targetUsers) {
        await this.sendNotificationToUser(member.userId, notificationData);
      }

      console.log(`✅ Notification de conversation envoyée à ${targetUsers.length} utilisateurs`);
    } catch (error) {
      console.error(`❌ Erreur envoi notification conversation ${conversationId}:`, error);
    }
  }

  /**
   * Construit les données de notification de message
   */
  private async buildMessageNotificationData(
    message: any,
    isAnonymousSender: boolean
  ): Promise<NotificationData> {
    const senderId = isAnonymousSender ? message.anonymousSenderId : message.senderId;
    const senderName = isAnonymousSender 
      ? message.anonymousSender?.name || 'Utilisateur anonyme'
      : message.user?.username || 'Utilisateur';

    // Récupérer les traductions existantes
    const translations = await this.getMessageTranslations(message.id);

    return {
      id: `msg-${message.id}`,
      type: 'message',
      title: this.getNotificationTitle('message', message.conversation.type, senderName),
      message: this.buildMultilingualMessage(message.content, translations),
      data: {
        messageId: message.id,
        conversationId: message.conversationId,
        conversationType: message.conversation.type,
        senderId,
        senderName,
        content: message.content,
        translations
      },
      conversationId: message.conversationId,
      senderId,
      senderName,
      timestamp: message.createdAt,
      isRead: false,
      translations
    };
  }

  /**
   * Récupère les traductions d'un message
   */
  private async getMessageTranslations(messageId: string): Promise<any> {
    try {
      const translations = await this.prisma.translation.findMany({
        where: { messageId },
        select: {
          targetLanguage: true,
          translatedText: true
        }
      });

      const result: any = {};
      translations.forEach(translation => {
        if (translation.targetLanguage === 'fr') {
          result.fr = translation.translatedText;
        } else if (translation.targetLanguage === 'en') {
          result.en = translation.translatedText;
        } else if (translation.targetLanguage === 'es') {
          result.es = translation.translatedText;
        }
      });

      return result;
    } catch (error) {
      console.error(`❌ Erreur récupération traductions message ${messageId}:`, error);
      return {};
    }
  }

  /**
   * Récupère les membres d'une conversation
   */
  private async getConversationMembers(conversationId: string): Promise<any[]> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            include: {
              user: true
            }
          }
        }
      });

      if (!conversation) {
        return [];
      }

      return conversation.participants
        .filter(participant => participant.user)
        .map(participant => ({
          userId: participant.user!.id,
          username: participant.user!.username
        }));
    } catch (error) {
      console.error(`❌ Erreur récupération membres conversation ${conversationId}:`, error);
      return [];
    }
  }

  /**
   * Envoie une notification à un utilisateur spécifique
   */
  private async sendNotificationToUser(userId: string, notificationData: NotificationData): Promise<void> {
    try {
      // Envoyer via Socket.IO si l'utilisateur est connecté
      if (this.socketIOManager.isUserConnected(userId)) {
        this.socketIOManager.sendToUser(userId, 'newNotification', notificationData);
      }

      // TODO: Sauvegarder en base de données pour les utilisateurs déconnectés
      // await this.saveNotificationToDatabase(userId, notificationData);
    } catch (error) {
      console.error(`❌ Erreur envoi notification à ${userId}:`, error);
    }
  }

  /**
   * Construit un message multilingue
   */
  private buildMultilingualMessage(content: string, translations?: any): string {
    const baseMessage = content.substring(0, 30) + (content.length > 30 ? '...' : '');
    
    if (translations && (translations.fr || translations.en || translations.es)) {
      const messages = [];
      
      messages.push(`🇫🇷 ${baseMessage}`);
      
      if (translations.en) {
        const enMessage = translations.en.substring(0, 30) + (translations.en.length > 30 ? '...' : '');
        messages.push(`🇺🇸 ${enMessage}`);
      }
      
      if (translations.es) {
        const esMessage = translations.es.substring(0, 30) + (translations.es.length > 30 ? '...' : '');
        messages.push(`🇪🇸 ${esMessage}`);
      }
      
      return messages.join('\n');
    }
    
    return baseMessage;
  }

  /**
   * Génère un titre de notification
   */
  private getNotificationTitle(type: string, conversationType: string, senderName: string): string {
    switch (type) {
      case 'message':
        switch (conversationType) {
          case 'direct':
            return `Message direct de ${senderName}`;
          case 'group':
            return `Message de groupe de ${senderName}`;
          case 'public':
            return `Message public de ${senderName}`;
          default:
            return `Nouveau message de ${senderName}`;
        }
      default:
        return 'Nouvelle notification';
    }
  }

  /**
   * Génère un titre de notification de conversation
   */
  private getConversationNotificationTitle(type: string, data: any): string {
    switch (type) {
      case 'user_joined':
        return `${data.username} a rejoint la conversation`;
      case 'user_left':
        return `${data.username} a quitté la conversation`;
      case 'conversation_created':
        return 'Nouvelle conversation créée';
      case 'conversation_updated':
        return 'Conversation mise à jour';
      default:
        return 'Mise à jour de conversation';
    }
  }

  /**
   * Génère un message de notification de conversation
   */
  private getConversationNotificationMessage(type: string, data: any): string {
    switch (type) {
      case 'user_joined':
        return `${data.username} a rejoint la conversation "${data.conversationName || 'Sans nom'}"`;
      case 'user_left':
        return `${data.username} a quitté la conversation "${data.conversationName || 'Sans nom'}"`;
      case 'conversation_created':
        return `Une nouvelle conversation "${data.conversationName || 'Sans nom'}" a été créée`;
      case 'conversation_updated':
        return `La conversation "${data.conversationName || 'Sans nom'}" a été mise à jour`;
      default:
        return 'Mise à jour de conversation';
    }
  }
}

