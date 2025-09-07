/**
 * Service de gestion des messages - Version simplifiée Phase 2.2
 * 
 * Centralise la logique de messaging avec les champs disponibles dans le schéma
 */

import { PrismaClient, Message } from '../../shared/prisma/client';
import type { 
  MessageRequest, 
  MessageResponse, 
  MessageValidationResult,
  MessagePermissionResult,
  MessageResponseMetadata,
  AuthenticationContext,
  AuthenticationType
} from '../../shared/types';
import { TranslationService } from './TranslationService';
import { conversationStatsService } from './ConversationStatsService';

export class MessagingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly translationService: TranslationService
  ) {}

  /**
   * Crée le contexte d'authentification basé sur les tokens
   * JWT Token = utilisateur enregistré
   * Session Token = utilisateur anonyme
   */
  private createAuthenticationContext(
    senderId: string,
    jwtToken?: string,
    sessionToken?: string
  ): AuthenticationContext {
    // Déterminer le type d'authentification
    if (jwtToken) {
      return {
        type: 'jwt',
        userId: senderId,
        jwtToken: jwtToken,
        isAnonymous: false
      };
    } else if (sessionToken) {
      return {
        type: 'session',
        sessionToken: sessionToken,
        isAnonymous: true
      };
    } else {
      // Fallback: détecter selon le format du senderId
      if (senderId.startsWith('anon_') || senderId.length > 24) {
        return {
          type: 'session',
          sessionToken: senderId,
          isAnonymous: true
        };
      } else {
        return {
          type: 'jwt',
          userId: senderId,
          isAnonymous: false
        };
      }
    }
  }

  /**
   * Point d'entrée principal pour l'envoi de messages
   * Utilisé par REST et WebSocket endpoints
   */
  async handleMessage(
    request: MessageRequest,
    senderId: string,
    isAuthenticated: boolean = true,
    jwtToken?: string,
    sessionToken?: string
  ): Promise<MessageResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // 1. Création du contexte d'authentification robuste
      const authContext = this.createAuthenticationContext(senderId, jwtToken, sessionToken);
      
      // Enrichir la requête avec le contexte d'authentification
      const enrichedRequest: MessageRequest = {
        ...request,
        authContext,
        isAnonymous: authContext.isAnonymous  // Override pour compatibilité
      };

      console.log(`[MessagingService] Message de ${authContext.type} user: ${authContext.isAnonymous ? 'Anonyme' : 'Enregistré'}`);

      // 2. Validation de la requête
      const validationResult = await this.validateRequest(enrichedRequest);
      if (!validationResult.isValid) {
        return this.createErrorResponse(validationResult.errors[0].message, requestId);
      }

      // 3. Résolution de l'ID de conversation
      const conversationId = await this.resolveConversationId(enrichedRequest.conversationId);
      if (!conversationId) {
        return this.createErrorResponse('Conversation non trouvée', requestId);
      }

      // 4. Vérification des permissions avec contexte d'authentification
      const permissionResult = await this.checkPermissions(
        authContext, 
        conversationId, 
        enrichedRequest
      );
      if (!permissionResult.canSend) {
        return this.createErrorResponse(
          permissionResult.reason || 'Permissions insuffisantes pour envoyer des messages',
          requestId
        );
      }

      // 4. Détection de langue automatique si nécessaire
      const originalLanguage = enrichedRequest.originalLanguage || await this.detectLanguage(enrichedRequest.content);

      // 5. Déterminer les IDs pour la sauvegarde selon le type d'authentification
      let actualSenderId: string | undefined = undefined;
      let actualAnonymousSenderId: string | undefined = undefined;

      if (authContext.isAnonymous) {
        // Récupérer l'ID de l'AnonymousParticipant via le sessionToken
        const identifier = authContext.sessionToken || senderId;
        
        const anonymousParticipant = await this.prisma.anonymousParticipant.findFirst({
          where: {
            sessionToken: identifier,
            conversationId: conversationId,
            isActive: true
          },
          select: { id: true }
        });

        if (anonymousParticipant) {
          actualAnonymousSenderId = anonymousParticipant.id;
        } else {
          throw new Error('Participant anonyme non trouvé pour la sauvegarde');
        }
      } else {
        // Utilisateur enregistré - utiliser l'ID depuis le JWT
        actualSenderId = authContext.userId || senderId;
      }

      // 6. Sauvegarde du message en base avec les bons IDs
      const message = await this.saveMessage({
        ...request,
        originalLanguage,
        conversationId,
        senderId: actualSenderId,
        anonymousSenderId: actualAnonymousSenderId
      });

      // 7. Mise à jour de la conversation
      await this.updateConversation(conversationId);

      // 8. Marquer comme lu pour l'expéditeur (User ou AnonymousParticipant)
      await this.markAsRead(message.id, actualSenderId || actualAnonymousSenderId || senderId);

      // 9. Queue de traduction (async)
      const translationStatus = await this.queueTranslation(message, originalLanguage);

      // 10. Mise à jour des statistiques (async)
      const stats = await this.updateStats(conversationId, originalLanguage);

      // 11. Génération de la réponse unifiée
      const response = await this.createSuccessResponse(
        message,
        requestId,
        startTime,
        stats,
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
    const warnings: MessageValidationResult['warnings'] = [];

    // Validation du contenu
    if (!request.content || request.content.trim().length === 0) {
      errors.push({
        field: 'content',
        message: 'Le contenu du message ne peut pas être vide',
        code: 'CONTENT_EMPTY'
      });
    }

    if (request.content && request.content.length > 4000) {
      errors.push({
        field: 'content',
        message: 'Le contenu du message ne peut pas dépasser 4000 caractères',
        code: 'CONTENT_TOO_LONG'
      });
    }

    // Validation conversationId
    if (!request.conversationId) {
      errors.push({
        field: 'conversationId',
        message: 'L\'ID de conversation est requis',
        code: 'CONVERSATION_ID_REQUIRED'
      });
    }

    // Validation messaging anonyme
    if (request.isAnonymous && !request.anonymousDisplayName) {
      errors.push({
        field: 'anonymousDisplayName',
        message: 'Le nom d\'affichage anonyme est requis pour les messages anonymes',
        code: 'ANONYMOUS_NAME_REQUIRED'
      });
    }

    // Validation des pièces jointes
    if (request.attachments && request.attachments.length > 10) {
      errors.push({
        field: 'attachments',
        message: 'Maximum 10 pièces jointes par message',
        code: 'TOO_MANY_ATTACHMENTS'
      });
    }

    // Warnings pour optimisation
    if (request.content && request.content.length > 1000) {
      warnings.push({
        field: 'content',
        message: 'Message long - traduction premium recommandée',
        code: 'LONG_CONTENT_WARNING'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Vérification des permissions d'envoi de message
   * PHASE 3.1.1: Support authentication context robuste
   */
  private async checkPermissions(
    authContext: AuthenticationContext,
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
        select: { type: true, identifier: true }
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
          canSendAnonymous: authContext.isAnonymous,
          canAttachFiles: !authContext.isAnonymous, // Seuls les enregistrés peuvent attacher dans les conversations globales
          canMentionUsers: !authContext.isAnonymous,
          canUseHighPriority: false
        };
      }

      if (authContext.isAnonymous) {
        // LOGIQUE ANONYME: Vérifier via AnonymousParticipant et ShareLink
        const identifier = authContext.sessionToken || authContext.userId || '';
        
        console.log('[MessagingService] Checking anonymous permissions:', {
          identifier,
          conversationId,
          authContextType: authContext.type,
          sessionToken: authContext.sessionToken ? 'present' : 'missing'
        });
        
        const anonymousParticipant = await this.prisma.anonymousParticipant.findFirst({
          where: {
            sessionToken: identifier,
            conversationId: conversationId,
            isActive: true
          },
          include: {
            shareLink: {
              select: {
                id: true,
                isActive: true,
                allowAnonymousMessages: true,
                allowAnonymousFiles: true,
                allowAnonymousImages: true,
                maxUses: true,
                currentUses: true,
                expiresAt: true,
                maxConcurrentUsers: true,
                currentConcurrentUsers: true
              }
            }
          }
        });

        console.log('[MessagingService] Anonymous participant found:', {
          found: !!anonymousParticipant,
          participantId: anonymousParticipant?.id,
          hasShareLink: !!anonymousParticipant?.shareLink,
          shareLinkId: anonymousParticipant?.shareLink?.id,
          isActive: anonymousParticipant?.shareLink?.isActive,
          allowMessages: anonymousParticipant?.shareLink?.allowAnonymousMessages
        });

        if (!anonymousParticipant || !anonymousParticipant.shareLink) {
          return {
            canSend: false,
            reason: 'Utilisateur anonyme non autorisé dans cette conversation ou lien invalide'
          };
        }

        const shareLink = anonymousParticipant.shareLink;

        // Vérifier si le lien est toujours actif et valide
        if (!shareLink.isActive) {
          return {
            canSend: false,
            reason: 'Le lien de partage a été désactivé'
          };
        }

        // Vérifier la date d'expiration
        if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
          return {
            canSend: false,
            reason: 'Le lien de partage a expiré'
          };
        }

        // Vérifier les limites d'utilisation
        if (shareLink.maxUses && shareLink.currentUses >= shareLink.maxUses) {
          return {
            canSend: false,
            reason: 'Limite d\'utilisation du lien atteinte'
          };
        }

        // Vérifier les permissions spécifiques du lien pour l'envoi de messages
        if (!shareLink.allowAnonymousMessages) {
          return {
            canSend: false,
            reason: 'Ce lien ne permet pas l\'envoi de messages'
          };
        }

        // Vérifier les permissions spécifiques du participant
        if (!anonymousParticipant.canSendMessages) {
          return {
            canSend: false,
            reason: 'Vos permissions d\'envoi de messages ont été révoquées'
          };
        }

        // Permissions accordées selon le lien et les capacités du participant
        return {
          canSend: true,
          canSendAnonymous: true,
          canAttachFiles: shareLink.allowAnonymousFiles && anonymousParticipant.canSendFiles,
          canMentionUsers: false, // Les anonymes ne peuvent pas mentionner par défaut
          canUseHighPriority: false,
          restrictions: {
            maxContentLength: 1000, // Limite pour anonymes
            maxAttachments: shareLink.allowAnonymousFiles ? 3 : 0,
            allowedAttachmentTypes: shareLink.allowAnonymousFiles ? 
              (shareLink.allowAnonymousImages ? ['image', 'file'] : ['file']) : [],
            rateLimitRemaining: 20 // Rate limit pour anonymes
          }
        };
      } else {
        // LOGIQUE UTILISATEUR ENREGISTRÉ: Vérifier via ConversationMember
        const userId = authContext.userId!;
        
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

      // Récupérer les infos de la conversation pour les permissions
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { type: true }
      });

      if (!conversation) {
        return {
          canSend: false,
          reason: 'Conversation non trouvée'
        };
      }

        return {
          canSend: membership.canSendMessage,
          canSendAnonymous: false,
          canAttachFiles: membership.canSendFiles,
          canMentionUsers: true,
          canUseHighPriority: conversation.type !== 'public',
          restrictions: {
            maxContentLength: 4000,
            maxAttachments: 10,
            allowedAttachmentTypes: ['image', 'file', 'audio', 'video'],
            rateLimitRemaining: 100
          }
        };
      }

    } catch (error) {
      console.error('[MessagingService] Error checking permissions:', error);
      console.error('[MessagingService] Auth context:', {
        type: authContext.type,
        isAnonymous: authContext.isAnonymous,
        userId: authContext.userId,
        sessionToken: authContext.sessionToken ? 'present' : 'missing'
      });
      console.error('[MessagingService] Conversation ID:', conversationId);
      console.error('[MessagingService] Request:', {
        conversationId: request.conversationId,
        isAnonymous: request.isAnonymous,
        contentLength: request.content?.length
      });
      
      return {
        canSend: false,
        reason: `Erreur lors de la vérification des permissions: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      };
    }
  }

  /**
   * Résout l'ID de conversation réel à partir de différents formats
   */
  private async resolveConversationId(identifier: string): Promise<string | null> {
    console.log('[MessagingService] Resolving conversation ID:', identifier);
    
    // Si c'est déjà un ObjectId MongoDB, on le retourne
    if (/^[0-9a-fA-F]{24}$/.test(identifier)) {
      console.log('[MessagingService] Identifier is already an ObjectId');
      return identifier;
    }

    // Sinon, chercher par le champ identifier
    const conversation = await this.prisma.conversation.findFirst({
      where: { identifier: identifier }
    });
    
    console.log('[MessagingService] Conversation found by identifier:', {
      found: !!conversation,
      conversationId: conversation?.id,
      conversationType: conversation?.type
    });
    
    return conversation ? conversation.id : null;
  }

  /**
   * Détection automatique de la langue
   */
  private async detectLanguage(content: string): Promise<string> {
    try {
      // TODO: Implémenter détection via service de traduction
      // Pour l'instant, return default français
      return 'fr';
    } catch (error) {
      console.error('[UnifiedMessageHandler] Language detection failed:', error);
      return 'fr'; // Fallback
    }
  }

  /**
   * Sauvegarde du message en base avec toutes les relations
   */
  private async saveMessage(data: {
    conversationId: string;
    senderId?: string;
    anonymousSenderId?: string;
    content: string;
    originalLanguage: string;
    messageType?: string;
    replyToId?: string;
    encrypted?: boolean;
  }): Promise<Message> {
    const message = await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        anonymousSenderId: data.anonymousSenderId,
        content: data.content.trim(),
        originalLanguage: data.originalLanguage,
        messageType: data.messageType || 'text',
        replyToId: data.replyToId
        // Note: priority et encrypted ne sont pas dans le schéma actuel
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
        anonymousSender: {
          select: {
            id: true,
            conversationId: true
          }
        },
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

    // Convertir au format unifié avec timestamp
    return {
      ...message,
      timestamp: message.createdAt,
      // Tous les autres champs sont déjà compatibles
    } as Message;
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
      await this.prisma.messageReadStatus.create({
        data: {
          messageId,
          userId,
          readAt: new Date()
        }
      });
    } catch (error) {
      // Ignore les erreurs de contrainte unique (déjà lu)
      if (!error.code || error.code !== 'P2002') {
        console.error('[UnifiedMessageHandler] Error marking message as read:', error);
      }
    }
  }

  /**
   * Queue le message pour traduction asynchrone
   */
  private async queueTranslation(message: Message, originalLanguage: string): Promise<any> {
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
        languagesRequested: [], // TODO: Déterminer depuis participants
        languagesCompleted: [],
        languagesFailed: [],
        estimatedCompletionTime: 1000 // 1 seconde
      };

    } catch (error) {
      console.error('[UnifiedMessageHandler] Error queuing translation:', error);
      return {
        status: 'failed',
        languagesRequested: [],
        languagesCompleted: [],
        languagesFailed: ['unknown']
      };
    }
  }

  /**
   * Met à jour les statistiques de conversation
   */
  private async updateStats(conversationId: string, language: string): Promise<any> {
    try {
      // Note: ConversationStats du service existant ne correspond pas à notre interface
      // On utilise any pour l'instant et on retourne juste undefined
      return await conversationStatsService.updateOnNewMessage(
        this.prisma,
        conversationId,
        language,
        () => [] // TODO: Récupérer les langues des participants
      );
    } catch (error) {
      console.error('[MessagingService] Error updating stats:', error);
      return undefined;
    }
  }

  /**
   * Génère une réponse de succès
   */
  private async createSuccessResponse(
    message: Message,
    requestId: string,
    startTime: number,
    stats?: any,
    translationStatus?: any
  ): Promise<MessageResponse> {
    const processingTime = Date.now() - startTime;

    const metadata: MessageResponseMetadata = {
      conversationStats: stats,
      translationStatus,
      deliveryStatus: {
        status: 'sent',
        sentAt: message.createdAt,
        recipientCount: 1, // TODO: Calculer depuis participants
        deliveredCount: 1,
        readCount: 1
      },
      performance: {
        processingTime,
        dbQueryTime: processingTime * 0.6, // Estimation
        translationQueueTime: processingTime * 0.2,
        validationTime: processingTime * 0.1
      },
      context: {
        isFirstMessage: false, // TODO: Vérifier
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
      data: { ...message, timestamp: message.createdAt } as any,
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
      data: null as any, // Sera géré par le type union
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
