/**
 * Service de gestion des messages - Version simplifiée Phase 2.2
 * 
 * Centralise la logique de messaging avec les champs disponibles dans le schéma
 */

import type { PrismaClient } from '../../shared/prisma/client';
import type { 
  MessageRequest, 
  MessageResponse, 
  MessageValidationResult,
  MessagePermissionResult,
  MessageResponseMetadata
} from '../../shared/types';
import { TranslationService } from './TranslationService';

export class MessagingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly translationService: TranslationService
  ) {}

  /**
   * Point d'entrée principal pour l'envoi de messages
   */
  async handleMessage(
    request: MessageRequest,
    senderId: string,
    isAuthenticated: boolean = true
  ): Promise<MessageResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // 1. Validation de la requête
      const validationResult = await this.validateRequest(request);
      if (!validationResult.isValid) {
        return this.createErrorResponse(validationResult.errors[0].message, requestId);
      }

      // 2. Résolution de l'ID de conversation
      const conversationId = await this.resolveConversationId(request.conversationId);
      if (!conversationId) {
        return this.createErrorResponse('Conversation non trouvée', requestId);
      }

      // 3. Vérification des permissions
      const permissionResult = await this.checkPermissions(senderId, conversationId, request);
      if (!permissionResult.canSend) {
        return this.createErrorResponse(
          permissionResult.reason || 'Permissions insuffisantes',
          requestId
        );
      }

      // 4. Détection de langue automatique si nécessaire
      const originalLanguage = request.originalLanguage || 'fr';

      // 5. Sauvegarde du message en base
      const message = await this.saveMessage({
        conversationId,
        senderId: request.isAnonymous ? undefined : senderId,
        anonymousSenderId: request.isAnonymous ? senderId : undefined,
        content: request.content,
        originalLanguage,
        messageType: request.messageType || 'text',
        replyToId: request.replyToId
      });

      // 6. Mise à jour de la conversation
      await this.updateConversation(conversationId);

      // 7. Marquer comme lu pour l'expéditeur
      await this.markAsRead(message.id, senderId);

      // 8. Queue de traduction (async)
      const translationStatus = await this.queueTranslation(message, originalLanguage);

      // 9. Génération de la réponse
      const response = await this.createSuccessResponse(
        message,
        requestId,
        startTime,
        translationStatus
      );

      return response;

    } catch (error) {
      console.error('[MessagingService] Error handling message:', error);
      return this.createErrorResponse(
        'Erreur interne lors de l\'envoi du message',
        requestId
      );
    }
  }

  /**
   * Validation complète d'une requête de message
   */
  private async validateRequest(request: MessageRequest): Promise<MessageValidationResult> {
    const errors: MessageValidationResult['errors'] = [];

    // Validation du contenu - permettre les messages sans contenu si il y a des attachements
    if ((!request.content || request.content.trim().length === 0) && (!request.attachments || request.attachments.length === 0)) {
      errors.push({
        field: 'content',
        message: 'Message content cannot be empty (unless attachments are included)',
        code: 'CONTENT_EMPTY'
      });
    }

    if (request.content && request.content.length > 2000) {
      errors.push({
        field: 'content',
        message: 'Message content cannot exceed 2000 characters',
        code: 'CONTENT_TOO_LONG'
      });
    }

    // Validation conversationId
    if (!request.conversationId) {
      errors.push({
        field: 'conversationId',
        message: 'Conversation ID is required',
        code: 'CONVERSATION_ID_REQUIRED'
      });
    }

    // Validation messaging anonyme
    if (request.isAnonymous && !request.anonymousDisplayName) {
      errors.push({
        field: 'anonymousDisplayName',
        message: 'Anonymous display name is required for anonymous messages',
        code: 'ANONYMOUS_NAME_REQUIRED'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Vérification des permissions d'envoi de message
   */
  private async checkPermissions(
    userId: string,
    conversationId: string,
    request: MessageRequest
  ): Promise<MessagePermissionResult> {
    try {
      // Résoudre l'ID de conversation d'abord
      const resolvedConversationId = await this.resolveConversationId(request.conversationId);
      if (!resolvedConversationId) {
        return {
          canSend: false,
          canSendAnonymous: false,
          canAttachFiles: false,
          canMentionUsers: false,
          canUseHighPriority: false,
          reason: 'Conversation non trouvée'
        };
      }

      // Récupérer les informations de la conversation
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: resolvedConversationId },
        select: { type: true }
      });

      if (!conversation) {
        return {
          canSend: false,
          canSendAnonymous: false,
          canAttachFiles: false,
          canMentionUsers: false,
          canUseHighPriority: false,
          reason: 'Conversation non trouvée'
        };
      }

      // Cas spécial : conversation globale
      if (conversation.type === 'global') {
        return {
          canSend: true,
          canSendAnonymous: false,
          canAttachFiles: true,
          canMentionUsers: true,
          canUseHighPriority: false
        };
      }

      // Vérifier l'appartenance à la conversation
      const membership = await this.prisma.conversationMember.findFirst({
        where: {
          conversationId,
          userId,
          isActive: true
        }
      });

      if (!membership) {
        return {
          canSend: false,
          reason: 'Vous n\'êtes pas membre de cette conversation'
        };
      }

      return {
        canSend: true,
        canSendAnonymous: false,
        canAttachFiles: true,
        canMentionUsers: true,
        canUseHighPriority: true
      };

    } catch (error) {
      console.error('[MessagingService] Error checking permissions:', error);
      return {
        canSend: false,
        reason: 'Erreur lors de la vérification des permissions'
      };
    }
  }

  /**
   * Résout l'ID de conversation réel à partir de différents formats
   */
  private async resolveConversationId(identifier: string): Promise<string | null> {
    // Si c'est déjà un ObjectId MongoDB, on le retourne
    if (/^[0-9a-fA-F]{24}$/.test(identifier)) {
      return identifier;
    }

    // Sinon, chercher par le champ identifier
    const conversation = await this.prisma.conversation.findFirst({
      where: { identifier: identifier }
    });
    
    return conversation ? conversation.id : null;
  }

  /**
   * Sauvegarde du message en base
   */
  private async saveMessage(data: {
    conversationId: string;
    senderId?: string;
    anonymousSenderId?: string;
    content: string;
    originalLanguage: string;
    messageType: string;
    replyToId?: string;
  }): Promise<any> {
    const message = await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        anonymousSenderId: data.anonymousSenderId,
        content: data.content.trim(),
        originalLanguage: data.originalLanguage,
        messageType: data.messageType,
        replyToId: data.replyToId
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            role: true,
            isOnline: true
          }
        },
        anonymousSender: true,
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    // Ajouter timestamp pour compatibilité
    return {
      ...message,
      timestamp: message.createdAt
    };
  }

  /**
   * Met à jour le timestamp de dernière activité de la conversation
   */
  private async updateConversation(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() }
    });
  }

  /**
   * Marque le message comme lu pour l'expéditeur
   */
  private async markAsRead(messageId: string, userId: string): Promise<void> {
    try {
      await this.prisma.messageStatus.create({
        data: {
          messageId,
          userId,
          readAt: new Date()
        }
      });
    } catch (error) {
      // Ignore les erreurs de contrainte unique (déjà lu)
      console.error('[MessagingService] Error marking message as read:', error);
    }
  }

  /**
   * Queue le message pour traduction asynchrone
   */
  private async queueTranslation(message: any, originalLanguage: string): Promise<any> {
    try {
      await this.translationService.handleNewMessage({
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        anonymousSenderId: message.anonymousSenderId,
        content: message.content,
        originalLanguage,
        messageType: message.messageType,
        replyToId: message.replyToId
      } as any);

      return {
        status: 'pending',
        languagesRequested: [],
        languagesCompleted: [],
        languagesFailed: []
      };

    } catch (error) {
      console.error('[MessagingService] Error queuing translation:', error);
      return {
        status: 'failed',
        languagesRequested: [],
        languagesCompleted: [],
        languagesFailed: ['unknown']
      };
    }
  }

  /**
   * Génère une réponse de succès
   */
  private async createSuccessResponse(
    message: any,
    requestId: string,
    startTime: number,
    translationStatus?: any
  ): Promise<MessageResponse> {
    const processingTime = Date.now() - startTime;

    const metadata: MessageResponseMetadata = {
      translationStatus,
      deliveryStatus: {
        status: 'sent',
        sentAt: message.createdAt,
        recipientCount: 1,
        deliveredCount: 1,
        readCount: 1
      },
      performance: {
        processingTime,
        dbQueryTime: processingTime * 0.6,
        translationQueueTime: processingTime * 0.2,
        validationTime: processingTime * 0.1
      },
      context: {
        isFirstMessage: false,
        triggerNotifications: true,
        mentionedUsers: this.extractMentions(message.content),
        containsLinks: this.containsLinks(message.content)
      },
      debug: {
        requestId,
        serverTime: new Date(),
        userId: message.senderId || message.anonymousSenderId || '',
        conversationId: message.conversationId,
        messageId: message.id
      }
    };

    return {
      success: true,
      data: message as any,
      message: 'Message envoyé avec succès',
      metadata
    };
  }

  /**
   * Génère une réponse d'erreur
   */
  private createErrorResponse(error: string, requestId: string): MessageResponse {
    return {
      success: false,
      error,
      data: null as any,
      metadata: {
        debug: {
          requestId,
          serverTime: new Date(),
          userId: '',
          conversationId: '',
          messageId: ''
        }
      }
    };
  }

  /**
   * Utilitaires
   */
  private generateRequestId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private extractMentions(content: string): string[] {
    const mentions = content.match(/@(\w+)/g);
    return mentions ? mentions.map(mention => mention.slice(1)) : [];
  }

  private containsLinks(content: string): boolean {
    return /https?:\/\/[^\s]+/.test(content);
  }
}
