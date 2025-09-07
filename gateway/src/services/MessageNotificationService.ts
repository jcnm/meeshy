/**
 * Service de gestion des notifications de messages
 * Gère l'envoi de notifications avec traductions pour les conversations directes
 */

import { PrismaClient } from '@prisma/client';
import { MeeshySocketIOManager } from '../socketio/MeeshySocketIOManager';
import { SERVER_EVENTS, NewMessageNotificationData } from '../../shared/types/socketio-events';

export class MessageNotificationService {
  private prisma: PrismaClient;
  private socketIOManager: MeeshySocketIOManager;

  constructor(prisma: PrismaClient, socketIOManager: MeeshySocketIOManager) {
    this.prisma = prisma;
    this.socketIOManager = socketIOManager;
  }

  /**
   * Envoie une notification de nouveau message à tous les participants de la conversation
   * qui ne sont pas l'expéditeur et qui ne sont pas actuellement dans la conversation
   */
  async sendMessageNotification(
    messageId: string,
    conversationId: string,
    senderId: string,
    isAnonymousSender: boolean = false
  ): Promise<void> {
    try {
      console.log(`🔔 Envoi notification message ${messageId} pour conversation ${conversationId}`);

      // Récupérer le message avec les informations nécessaires
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true
            }
          },
          anonymousSender: {
            select: {
              id: true,
              displayName: true,
              sessionToken: true
            }
          },
          conversation: {
            select: {
              id: true,
              type: true,
              title: true
            }
          },
          translations: {
            where: {
              targetLanguage: {
                in: ['fr', 'en', 'es']
              }
            },
            select: {
              targetLanguage: true,
              translatedContent: true
            }
          }
        }
      });

      if (!message) {
        console.error(`❌ Message ${messageId} non trouvé`);
        return;
      }

      // Construire les données de notification
      const notificationData = await this.buildNotificationData(message, isAnonymousSender);
      
      // Récupérer tous les participants de la conversation
      const participants = await this.getConversationParticipants(conversationId);
      
      // Envoyer la notification à chaque participant (sauf l'expéditeur)
      for (const participant of participants) {
        if (participant.id !== senderId) {
          await this.sendNotificationToParticipant(participant, notificationData);
        }
      }

      console.log(`✅ Notifications envoyées pour le message ${messageId}`);
    } catch (error) {
      console.error(`❌ Erreur envoi notification message ${messageId}:`, error);
    }
  }

  /**
   * Construit les données de notification avec les traductions
   */
  private async buildNotificationData(message: any, isAnonymousSender: boolean): Promise<NewMessageNotificationData> {
    // Déterminer le nom de l'expéditeur
    let senderName: string;
    if (isAnonymousSender && message.anonymousSender) {
      senderName = message.anonymousSender.displayName || 'Utilisateur anonyme';
    } else if (message.sender) {
      senderName = message.sender.displayName || 
                  `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() ||
                  message.sender.username ||
                  'Utilisateur';
    } else {
      senderName = 'Utilisateur inconnu';
    }

    // Construire les traductions
    const translations: { fr?: string; en?: string; es?: string } = {};
    for (const translation of message.translations) {
      if (translation.targetLanguage === 'fr') {
        translations.fr = translation.translatedContent;
      } else if (translation.targetLanguage === 'en') {
        translations.en = translation.translatedContent;
      } else if (translation.targetLanguage === 'es') {
        translations.es = translation.translatedContent;
      }
    }

    return {
      messageId: message.id,
      senderId: isAnonymousSender ? message.anonymousSenderId : message.senderId,
      senderName,
      content: message.content,
      conversationId: message.conversationId,
      conversationType: message.conversation.type,
      timestamp: message.createdAt.toISOString(),
      translations: Object.keys(translations).length > 0 ? translations : undefined
    };
  }

  /**
   * Récupère tous les participants d'une conversation
   */
  private async getConversationParticipants(conversationId: string): Promise<Array<{ id: string; isAnonymous: boolean }>> {
    const participants: Array<{ id: string; isAnonymous: boolean }> = [];

    // Récupérer les utilisateurs authentifiés
    const members = await this.prisma.conversationMember.findMany({
      where: {
        conversationId,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            isActive: true
          }
        }
      }
    });

    for (const member of members) {
      if (member.user.isActive) {
        participants.push({
          id: member.user.id,
          isAnonymous: false
        });
      }
    }

    // Récupérer les participants anonymes
    const anonymousParticipants = await this.prisma.anonymousParticipant.findMany({
      where: {
        conversationId,
        isActive: true
      },
      select: {
        id: true
      }
    });

    for (const anonymous of anonymousParticipants) {
      participants.push({
        id: anonymous.id,
        isAnonymous: true
      });
    }

    return participants;
  }

  /**
   * Envoie une notification à un participant spécifique
   */
  private async sendNotificationToParticipant(
    participant: { id: string; isAnonymous: boolean },
    notificationData: NewMessageNotificationData
  ): Promise<void> {
    try {
      // Vérifier si le participant est connecté
      const isConnected = this.socketIOManager.isUserConnected(participant.id);
      
      if (isConnected) {
        // Envoyer la notification via Socket.IO
        this.socketIOManager.sendToUser(participant.id, SERVER_EVENTS.NEW_MESSAGE_NOTIFICATION, notificationData);
        console.log(`📱 Notification envoyée à ${participant.isAnonymous ? 'participant anonyme' : 'utilisateur'} ${participant.id}`);
      } else {
        console.log(`⚠️ ${participant.isAnonymous ? 'Participant anonyme' : 'Utilisateur'} ${participant.id} non connecté`);
      }
    } catch (error) {
      console.error(`❌ Erreur envoi notification à ${participant.id}:`, error);
    }
  }

  /**
   * Envoie une notification de message avec traductions en temps réel
   * (appelé quand les traductions sont disponibles)
   */
  async sendTranslationNotification(
    messageId: string,
    conversationId: string,
    translations: { fr?: string; en?: string; es?: string }
  ): Promise<void> {
    try {
      console.log(`🌍 Envoi notification traduction pour message ${messageId}`);

      // Récupérer le message
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true
            }
          },
          anonymousSender: {
            select: {
              id: true,
              displayName: true
            }
          },
          conversation: {
            select: {
              type: true
            }
          }
        }
      });

      if (!message) {
        console.error(`❌ Message ${messageId} non trouvé pour notification traduction`);
        return;
      }

      // Construire les données de notification avec les nouvelles traductions
      const notificationData = await this.buildNotificationData(message, !!message.anonymousSenderId);
      notificationData.translations = translations;

      // Récupérer tous les participants de la conversation
      const participants = await this.getConversationParticipants(conversationId);
      
      // Envoyer la notification mise à jour à chaque participant (sauf l'expéditeur)
      const senderId = message.anonymousSenderId || message.senderId;
      for (const participant of participants) {
        if (participant.id !== senderId) {
          await this.sendNotificationToParticipant(participant, notificationData);
        }
      }

      console.log(`✅ Notifications de traduction envoyées pour le message ${messageId}`);
    } catch (error) {
      console.error(`❌ Erreur envoi notification traduction ${messageId}:`, error);
    }
  }
}

