import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TranslationService } from '../services/TranslationService';
import { conversationStatsService } from '../services/ConversationStatsService';
import { z } from 'zod';
import { UserRoleEnum } from '../../shared/types';
import { createUnifiedAuthMiddleware, UnifiedAuthRequest } from '../middleware/auth';
import * as path from 'path';

/**
 * Vérifie si un utilisateur peut accéder à une conversation
 * @param prisma - Instance Prisma
 * @param authContext - Contexte d'authentification
 * @param conversationId - ID de la conversation
 * @param conversationIdentifier - Identifiant de la conversation (peut avoir le préfixe mshy_)
 * @returns Promise<boolean>
 */
async function canAccessConversation(
  prisma: any,
  authContext: any,
  conversationId: string,
  conversationIdentifier: string
): Promise<boolean> {
  // Si l'utilisateur n'est pas authentifié (pas de session token, pas de JWT token), aucun accès
  if (!authContext.isAuthenticated) {
    return false;
  }
  
  // Cas spécial : conversation globale "meeshy" - vérifier l'appartenance
  if (conversationIdentifier === "meeshy" || conversationId === "meeshy") {
    // Pour la conversation meeshy, vérifier que l'utilisateur est membre
    if (authContext.isAnonymous) {
      // Les utilisateurs anonymes n'ont pas accès à la conversation globale meeshy
      return false;
    } else {
      // Vérifier l'appartenance à la conversation meeshy
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: conversationId,
          userId: authContext.userId,
          isActive: true
        }
      });
      return !!membership;
    }
  }
  
  if (authContext.isAnonymous) {
    // Utilisateurs anonymes authentifiés : vérifier l'accès via liens d'invitation
    // Le userId pour les anonymes est l'ID du participant anonyme
    const anonymousAccess = await prisma.anonymousParticipant.findFirst({
      where: {
        id: authContext.userId,
        isActive: true,
        conversationId: conversationId
      }
    });
    return !!anonymousAccess;
  } else {
    // Vérifier le préfixe mshy_ pour les identifiants de conversation
    if (conversationIdentifier.startsWith('mshy_')) {
      // Identifiant avec préfixe mshy_ - résoudre l'ID réel
      const conversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { id: conversationId },
            { identifier: conversationIdentifier }
          ]
        }
      });
      
      if (!conversation) {
        return false;
      } else {
        // Vérifier l'appartenance à la conversation
        const membership = await prisma.conversationMember.findFirst({
          where: {
            conversationId: conversation.id,
            userId: authContext.userId,
            isActive: true
          }
        });
        return !!membership;
      }
    } else {
      // Identifiant direct - vérifier l'appartenance à la conversation
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: conversationId,
          userId: authContext.userId,
          isActive: true
        }
      });
      return !!membership;
    }
  }
}

// Fonction utilitaire pour générer le linkId avec le format demandé
// Étape 1: génère yymmddhhm_<random>
// Étape 2: sera mis à jour avec mshy_<conversationShareLink.Id>.yymmddhhm_<random> après création
function generateInitialLinkId(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  
  const timestamp = `${year}${month}${day}${hour}${minute}`;
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  
  return `${timestamp}_${randomSuffix}`;
}

function generateFinalLinkId(conversationShareLinkId: string, initialId: string): string {
  return `mshy_${conversationShareLinkId}.${initialId}`;
}

/**
 * Génère un identifiant unique pour une conversation
 * Format: mshy_<titre_sanitisé>-YYYYMMDDHHMMSS ou mshy_<unique_id>-YYYYMMDDHHMMSS si pas de titre
 */
function generateConversationIdentifier(title?: string): string {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');
  
  if (title) {
    // Sanitiser le titre : enlever les caractères spéciaux, remplacer les espaces par des tirets
    const sanitizedTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Garder seulement lettres, chiffres, espaces et tirets
      .replace(/\s+/g, '-') // Remplacer les espaces par des tirets
      .replace(/-+/g, '-') // Remplacer les tirets multiples par un seul
      .replace(/^-|-$/g, ''); // Enlever les tirets en début/fin
    
    if (sanitizedTitle.length > 0) {
      return `mshy_${sanitizedTitle}-${timestamp}`;
    }
  }
  
  // Fallback: générer un identifiant unique avec préfixe mshy_
  const uniqueId = Math.random().toString(36).slice(2, 10);
  return `mshy_${uniqueId}-${timestamp}`;
}

/**
 * Vérifie l'unicité d'un identifiant de conversation et génère une variante si nécessaire
 */
async function ensureUniqueConversationIdentifier(prisma: any, baseIdentifier: string): Promise<string> {
  let identifier = baseIdentifier;
  let counter = 1;
  
  while (true) {
    const existing = await prisma.conversation.findFirst({
      where: { identifier }
    });
    
    if (!existing) {
      return identifier;
    }
    
    // Ajouter un suffixe numérique pour assurer l'unicité
    identifier = `${baseIdentifier}-${counter}`;
    counter++;
  }
}

// Prisma et TranslationService sont décorés et fournis par le serveur principal



// Fonction utilitaire pour prédire le type de modèle
function getPredictedModelType(textLength: number): 'basic' | 'medium' | 'premium' {
  if (textLength < 20) return 'basic';
  if (textLength <= 100) return 'medium';
  return 'premium';
}

interface EditMessageBody {
  content: string;
  originalLanguage?: string;
}

interface ConversationParams {
  id: string;
}

interface CreateConversationBody {
  type: 'direct' | 'group' | 'public' | 'global';
  title?: string;
  description?: string;
  participantIds?: string[];
  communityId?: string;
  identifier?: string;
}

interface SendMessageBody {
  content: string;
  originalLanguage?: string;
  messageType?: 'text' | 'image' | 'file' | 'system';
  replyToId?: string;
}

interface MessagesQuery {
  limit?: string;
  offset?: string;
  before?: string; // messageId pour pagination
}

interface SearchQuery {
  q?: string;
}

export async function conversationRoutes(fastify: FastifyInstance) {
  // Récupérer prisma et le service de traduction décorés par le serveur
  const prisma = fastify.prisma;
  const translationService: TranslationService = (fastify as any).translationService;
  
  // Middleware d'authentification optionnel pour les conversations
  const optionalAuth = createUnifiedAuthMiddleware(prisma, { 
    requireAuth: false, 
    allowAnonymous: true 
  });
  
  // Middleware d'authentification requis pour les conversations
  const requiredAuth = createUnifiedAuthMiddleware(prisma, { 
    requireAuth: true, 
    allowAnonymous: false 
  });

  /**
   * Résout l'ID de conversation réel à partir d'un identifiant (peut être un ObjectID ou un identifier)
   */
  async function resolveConversationId(identifier: string): Promise<string | null> {
    // Si c'est déjà un ObjectID valide (24 caractères hexadécimaux), le retourner directement
    if (/^[0-9a-fA-F]{24}$/.test(identifier)) {
      return identifier;
    }
    
    // Sinon, chercher par le champ identifier
    const conversation = await prisma.conversation.findFirst({
      where: { identifier: identifier }
    });
    
    return conversation ? conversation.id : null;
  }
  
  // Route pour obtenir toutes les conversations de l'utilisateur
  fastify.get('/conversations', {
    preValidation: [optionalAuth]
  }, async (request: FastifyRequest, reply) => {
    try {
      const authRequest = request as UnifiedAuthRequest;
      
      // Vérifier que l'utilisateur est authentifié
      if (!authRequest.authContext.isAuthenticated) {
        return reply.status(403).send({
          success: false,
          error: 'Authentification requise pour accéder aux conversations'
        });
      }
      
      const userId = authRequest.authContext.userId;

      const conversations = await prisma.conversation.findMany({
        where: {
          OR: [
            // Conversations dont l'utilisateur est membre
            {
              members: {
                some: {
                  userId: userId,
                  isActive: true
                }
              }
            }
          ],
          isActive: true
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
                  isOnline: true,
                  lastSeen: true
                }
              }
            }
          },
          anonymousParticipants: {
            where: {
              isActive: true
            },
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              isOnline: true,
              lastSeenAt: true,
              joinedAt: true
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
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
          },
          _count: {
            select: {
              messages: true
            }
          }
        },
        orderBy: { lastMessageAt: 'desc' }
      });

      // Calculer le nombre de messages non lus pour chaque conversation
      const conversationsWithUnreadCount = await Promise.all(
        conversations.map(async (conversation) => {
          const unreadCount = await prisma.message.count({
            where: {
              conversationId: conversation.id,
              NOT: {
                readStatus: {
                  some: {
                    userId: userId
                  }
                }
              }
            }
          });

          return {
            ...conversation,
            lastMessage: conversation.messages[0] || null,
            unreadCount
          };
        })
      );

      reply.send({
        success: true,
        data: conversationsWithUnreadCount
      });

    } catch (error) {
      console.error('[GATEWAY] Error fetching conversations:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération des conversations'
      });
    }
  });

  // Route pour obtenir une conversation par ID
  fastify.get<{ Params: ConversationParams }>('/conversations/:id', {
    preValidation: [optionalAuth]
  }, async (request, reply) => {
    try {
      const authRequest = request as UnifiedAuthRequest;
      
      // Vérifier que l'utilisateur est authentifié
      if (!authRequest.authContext.isAuthenticated) {
        return reply.status(403).send({
          success: false,
          error: 'Authentification requise pour accéder à cette conversation'
        });
      }
      
      const { id } = request.params;
      const userId = authRequest.authContext.userId;

      // Résoudre l'ID de conversation réel
      const conversationId = await resolveConversationId(id);
      if (!conversationId) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation not found'
        });
      }

      // Vérifier les permissions d'accès
      const canAccess = await canAccessConversation(prisma, authRequest.authContext, conversationId, id);

      if (!canAccess) {
          return reply.status(403).send({
          success: false,
          error: 'Unauthorized access to this conversation'
        });
      }

      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
                  isOnline: true,
                  lastSeen: true,
                  role: true
                }
              }
            }
          }
        }
      });

      if (!conversation) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation not found'
        });
      }

      // Ajouter les statistiques de conversation dans les métadonnées (via cache 1h)
      const stats = await conversationStatsService.getOrCompute(
        prisma,
        id,
        () => [] // REST ne connaît pas les sockets ici; la partie onlineUsers sera vide si non connue par cache
      );

      reply.send({
        success: true,
        data: {
          ...conversation,
          meta: {
            conversationStats: stats
          }
        }
      });

    } catch (error) {
      console.error('[GATEWAY] Error fetching conversation:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération de la conversation'
      });
    }
  });

  // Route pour créer une nouvelle conversation
  fastify.post<{ Body: CreateConversationBody }>('/conversations', {
    preValidation: [optionalAuth]
  }, async (request, reply) => {
    try {
      const { type, title, description, participantIds = [], communityId, identifier } = request.body;
      
      // Utiliser le nouveau système d'authentification unifié
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required to create conversation'
        });
      }
      
      const userId = authContext.userId;

      // Validation des données
      if (!['direct', 'group', 'public', 'global'].includes(type)) {
        return reply.status(400).send({
          success: false,
          error: 'Type de conversation invalide'
        });
      }

      if (type !== 'direct' && !title) {
        return reply.status(400).send({
          success: false,
          error: 'Le titre est requis pour les conversations non directes'
        });
      }

      // Validate custom identifier if provided
      if (identifier) {
        const identifierRegex = /^[a-zA-Z0-9\-_@]*$/;
        if (!identifierRegex.test(identifier)) {
          return reply.status(400).send({
            success: false,
            error: 'L\'identifiant ne peut contenir que des lettres, chiffres, tirets, underscores et @'
          });
        }
      }

      // Validate community access if communityId is provided
      if (communityId) {
        const community = await prisma.community.findFirst({
          where: { id: communityId },
          include: { members: true }
        });

        if (!community) {
          return reply.status(404).send({
            success: false,
            error: 'Communauté non trouvée'
          });
        }

        // Check if user is member of the community
        const isMember = community.createdBy === userId || 
                        community.members.some(member => member.userId === userId);
        
        if (!isMember) {
          return reply.status(403).send({
            success: false,
            error: 'Vous devez être membre de cette communauté pour y créer une conversation'
          });
        }
      }

      // Generate identifier
      let finalIdentifier: string;
      if (identifier) {
        // Use custom identifier with mshy_ prefix
        finalIdentifier = `mshy_${identifier}`;
        // Ensure uniqueness
        finalIdentifier = await ensureUniqueConversationIdentifier(prisma, finalIdentifier);
      } else {
        // Generate automatic identifier
        const identifierTitle = type === 'direct' ? `direct-${userId}-${participantIds[0] || 'unknown'}` : title;
        const baseIdentifier = generateConversationIdentifier(identifierTitle);
        finalIdentifier = await ensureUniqueConversationIdentifier(prisma, baseIdentifier);
      }

      // S'assurer que participantIds ne contient pas de doublons et n'inclut pas le créateur
      const uniqueParticipantIds = [...new Set(participantIds)].filter(id => id !== userId);

      const conversation = await prisma.conversation.create({
        data: {
          identifier: finalIdentifier,
          type,
          title,
          description,
          communityId: communityId || null,
          members: {
            create: [
              // Créateur de la conversation
              {
                userId,
                role: UserRoleEnum.CREATOR
              },
              // Autres participants (sans doublons et sans le créateur)
              ...uniqueParticipantIds.map((participantId: string) => ({
                userId: participantId,
                role: UserRoleEnum.MEMBER
              }))
            ]
          }
        },
        include: {
          members: {
            include: {
              user: {
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

      // Si la conversation est créée dans une communauté, ajouter automatiquement 
      // tous les participants à la communauté s'ils n'y sont pas déjà
      if (communityId) {
        const allUserIds = [userId, ...uniqueParticipantIds];
        
        // Récupérer les membres actuels de la communauté
        const existingMembers = await prisma.communityMember.findMany({
          where: {
            communityId,
            userId: { in: allUserIds }
          },
          select: { userId: true }
        });
        
        const existingUserIds = existingMembers.map(member => member.userId);
        const newUserIds = allUserIds.filter(id => !existingUserIds.includes(id));
        
        // Ajouter les nouveaux membres à la communauté
        if (newUserIds.length > 0) {
          await prisma.communityMember.createMany({
            data: newUserIds.map(userId => ({
              communityId,
              userId
            }))
          });
        }
      }

      reply.status(201).send({
        success: true,
        data: conversation
      });

    } catch (error) {
      console.error('[GATEWAY] Error creating conversation:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la création de la conversation'
      });
    }
  });

  // Route pour obtenir les messages d'une conversation avec pagination
  fastify.get<{ 
    Params: ConversationParams;
    Querystring: MessagesQuery;
  }>('/conversations/:id/messages', {
    preValidation: [optionalAuth]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { limit = '20', offset = '0', before } = request.query;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Résoudre l'ID de conversation réel
      const conversationId = await resolveConversationId(id);
      if (!conversationId) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Vérifier les permissions d'accès
      const canAccess = await canAccessConversation(prisma, authRequest.authContext, conversationId, id);

      if (!canAccess) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Construire la requête avec pagination
      const whereClause: any = {
        conversationId: conversationId, // Utiliser l'ID résolu
        isDeleted: false
      };

      if (before) {
        // Pagination par curseur (pour défilement historique)
        const beforeMessage = await prisma.message.findFirst({
          where: { id: before },
          select: { createdAt: true }
        });
        
        if (beforeMessage) {
          whereClause.createdAt = {
            lt: beforeMessage.createdAt
          };
        }
      }

      const messages = await prisma.message.findMany({
        where: whereClause,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
              role: true
            }
          },
          anonymousSender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              language: true
            }
          },
          readStatus: {
            select: {
              userId: true,
              readAt: true
            }
          },
          translations: {
            select: {
              id: true,
              targetLanguage: true,
              translatedContent: true,
              translationModel: true,
              cacheKey: true
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
              },
              readStatus: {
                select: {
                  userId: true,
                  readAt: true
                }
              },
              translations: {
                select: {
                  id: true,
                  targetLanguage: true,
                  translatedContent: true,
                  translationModel: true,
                  cacheKey: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: before ? 0 : parseInt(offset)
      });

      // Récupérer les préférences linguistiques de l'utilisateur (pour information)
      const user = await prisma.user.findFirst({
        where: { id: userId },
        select: {
          systemLanguage: true,
          regionalLanguage: true,
          customDestinationLanguage: true,
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: true,
          useCustomDestination: true
        }
      });

      // Déterminer la langue préférée de l'utilisateur (pour information au frontend)
      function resolveUserLanguage(user: any): string {
        if (!user) return 'fr';
        
        if (user.useCustomDestination && user.customDestinationLanguage) {
          return user.customDestinationLanguage;
        }
        
        if (user.translateToSystemLanguage) {
          return user.systemLanguage;
        }
        
        if (user.translateToRegionalLanguage) {
          return user.regionalLanguage;
        }
        
        return user.systemLanguage; // fallback
      }

      const userPreferredLanguage = resolveUserLanguage(user);

      // Retourner les messages avec toutes leurs traductions
      // Le frontend se chargera d'afficher la bonne traduction
      const messagesWithAllTranslations = messages.map(message => {
        // Adapter le message de réponse également
        let adaptedReplyTo = null;
        if (message.replyTo) {
          adaptedReplyTo = {
            ...message.replyTo,
            translations: message.replyTo.translations // Garder toutes les traductions
          };
        }

        return {
          ...message,
          translations: message.translations, // Garder toutes les traductions
          replyTo: adaptedReplyTo,
          userPreferredLanguage: userPreferredLanguage // Indiquer au frontend la langue préférée
        };
      });

      // Marquer les messages comme lus
      if (messages.length > 0) {
        const messageIds = messages.map(m => m.id);
        try {
          // Vérifier que l'utilisateur existe avant de marquer les messages comme lus
          const userExists = await prisma.user.findFirst({
            where: { id: userId },
            select: { id: true }
          });
          
          if (!userExists) {
            console.warn('[GATEWAY] Cannot mark messages as read: user not found:', userId);
          } else {
            // Vérifier quels messages ne sont pas encore marqués comme lus
            const existingReadStatus = await prisma.messageReadStatus.findMany({
              where: {
                messageId: { in: messageIds },
                userId: userId
              },
              select: { messageId: true }
            });
            
            const alreadyReadMessageIds = new Set(existingReadStatus.map(r => r.messageId));
            const unreadMessageIds = messageIds.filter(id => !alreadyReadMessageIds.has(id));
            
            if (unreadMessageIds.length > 0) {
              await prisma.messageReadStatus.createMany({
                data: unreadMessageIds.map(messageId => ({
                  messageId,
                  userId
                }))
              });
            }
          }
        } catch (error) {
          console.warn('[GATEWAY] Error marking messages as read:', error);
        }
      }

      reply.send({
        success: true,
        data: {
          messages: messagesWithAllTranslations.reverse(), // Inverser pour avoir l'ordre chronologique
          hasMore: messages.length === parseInt(limit),
          userLanguage: userPreferredLanguage
        }
      });

    } catch (error) {
      console.error('[GATEWAY] Error fetching messages:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération des messages'
      });
    }
  });

  // Route pour envoyer un message dans une conversation
  fastify.post<{ 
    Params: ConversationParams;
    Body: SendMessageBody;
  }>('/conversations/:id/messages', {
    preValidation: [optionalAuth]
  }, async (request, reply) => {
    try {
      const authRequest = request as UnifiedAuthRequest;
      
      // Vérifier que l'utilisateur est authentifié
      if (!authRequest.authContext.isAuthenticated) {
        return reply.status(403).send({
          success: false,
          error: 'Authentification requise pour envoyer des messages'
        });
      }
      
      const { id } = request.params;
      const { content, originalLanguage = 'fr', messageType = 'text', replyToId } = request.body;
      const userId = authRequest.authContext.userId;

      // Résoudre l'ID de conversation réel
      const conversationId = await resolveConversationId(id);
      if (!conversationId) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Vérifier les permissions d'accès et d'écriture
      let canSend = false;
      
      // Règle simple : seuls les utilisateurs faisant partie de la conversation peuvent y écrire
      const canAccess = await canAccessConversation(prisma, authRequest.authContext, conversationId, id);
      if (!canAccess) {
        canSend = false;
      } else {
        // Vérifier les permissions d'écriture spécifiques
        if (authRequest.authContext.isAnonymous) {
          // Pour les utilisateurs anonymes, vérifier les permissions d'écriture
          const anonymousParticipant = await prisma.anonymousParticipant.findFirst({
            where: {
              id: authRequest.authContext.userId,
              isActive: true,
              canSendMessages: true
            }
          });
          canSend = !!anonymousParticipant;
        } else {
          // Pour les utilisateurs connectés, l'accès implique l'écriture
          canSend = true;
        }
      }

      if (!canSend) {
        return reply.status(403).send({
          success: false,
          error: 'Vous n\'êtes pas autorisé à envoyer des messages dans cette conversation'
        });
      }

      // Validation du contenu
      if (!content || content.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Le contenu du message ne peut pas être vide'
        });
      }

      // Créer le message
      const message = await prisma.message.create({
        data: {
          conversationId: conversationId, // Utiliser l'ID résolu
          senderId: userId,
          content: content.trim(),
          originalLanguage,
          messageType,
          replyToId
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
              role: true
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

      // Mettre à jour le timestamp de la conversation
      await prisma.conversation.update({
        where: { id: conversationId }, // Utiliser l'ID résolu
        data: { lastMessageAt: new Date() }
      });

      // Marquer le message comme lu pour l'expéditeur
      await prisma.messageReadStatus.create({
        data: {
          messageId: message.id,
          userId
        }
      });

      // Déclencher les traductions via le TranslationService (gère les langues des participants)
      try {
        await translationService.handleNewMessage({
          id: message.id,
          conversationId: conversationId, // Utiliser l'ID résolu
          senderId: userId,
          content: message.content,
          originalLanguage,
          messageType,
          replyToId
        } as any);
        console.log(`Translations queued via TranslationService for message ${message.id} in conversation ${conversationId}`);
      } catch (error) {
        console.error('[GATEWAY] Error queuing translations via TranslationService:', error);
        // Ne pas faire échouer l'envoi du message si la traduction échoue
      }

      // Mettre à jour les stats dans le cache (et les calculer si entrée absente)
      const stats = await conversationStatsService.updateOnNewMessage(
        prisma,
        conversationId, // Utiliser l'ID résolu
        originalLanguage,
        () => []
      );

      reply.status(201).send({
        success: true,
        data: {
          ...message,
          meta: { conversationStats: stats }
        }
      });

    } catch (error) {
      console.error('[GATEWAY] Error sending message:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de l\'envoi du message'
      });
    }
  });

  // Marquer une conversation comme lue (tous les messages non lus)
  fastify.post<{ Params: ConversationParams }>('/conversations/:id/read', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Résoudre l'ID de conversation réel
      const conversationId = await resolveConversationId(id);
      if (!conversationId) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Vérifier les permissions d'accès
      let canAccess = false;
      
      if (id === "meeshy") {
        canAccess = true; // Conversation globale accessible à tous les utilisateurs connectés
      } else {
        const membership = await prisma.conversationMember.findFirst({
          where: { conversationId: conversationId, userId, isActive: true }
        });
        canAccess = !!membership;
      }
      
      if (!canAccess) {
        return reply.status(403).send({ success: false, error: 'Accès non autorisé à cette conversation' });
      }

      // Récupérer les messages non lus
      const unreadMessages = await prisma.message.findMany({
        where: {
          conversationId: conversationId, // Utiliser l'ID résolu
          isDeleted: false,
          readStatus: { none: { userId } }
        },
        select: { id: true }
      });

      if (unreadMessages.length > 0) {
        await prisma.messageReadStatus.createMany({
          data: unreadMessages.map(m => ({ messageId: m.id, userId }))
        });
      }

      reply.send({ success: true, data: { markedCount: unreadMessages.length } });
    } catch (error) {
      console.error('[GATEWAY] Error marking conversation as read:', error);
      reply.status(500).send({ success: false, error: 'Erreur lors du marquage comme lu' });
    }
  });

  // Recherche de conversations accessibles par l'utilisateur courant
  fastify.get<{ Querystring: SearchQuery }>('/conversations/search', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { q } = request.query;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      if (!q || q.trim().length === 0) {
        return reply.send({ success: true, data: [] });
      }

      const conversations = await prisma.conversation.findMany({
        where: {
          isActive: true,
          members: { some: { userId, isActive: true } },
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            {
              members: {
                some: {
                  user: {
                    OR: [
                      { firstName: { contains: q, mode: 'insensitive' } },
                      { lastName: { contains: q, mode: 'insensitive' } },
                      { username: { contains: q, mode: 'insensitive' } },
                      { displayName: { contains: q, mode: 'insensitive' } }
                    ],
                    isActive: true
                  }
                }
              }
            }
          ]
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
                  isOnline: true,
                  lastSeen: true
                }
              }
            }
          },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 }
        },
        orderBy: { lastMessageAt: 'desc' }
      });

      reply.send({ success: true, data: conversations });
    } catch (error) {
      console.error('[GATEWAY] Error searching conversations:', error);
      reply.status(500).send({ success: false, error: 'Erreur lors de la recherche de conversations' });
    }
  });

  // NOTE: route déplacée vers communities.ts → GET /communities/:id/conversations

  // Route pour modifier un message (permis depuis la gateway)
  fastify.put<{
    Params: ConversationParams & { messageId: string };
    Body: EditMessageBody;
  }>('/conversations/:id/messages/:messageId', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { id, messageId } = request.params;
      const { content, originalLanguage = 'fr' } = request.body;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Résoudre l'ID de conversation réel
      const conversationId = await resolveConversationId(id);
      if (!conversationId) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation non trouvée'
        });
      }

      // Vérifier que le message existe
      const existingMessage = await prisma.message.findFirst({
        where: {
          id: messageId,
          conversationId: conversationId,
          isDeleted: false
        },
        include: {
          sender: {
            select: { id: true, role: true }
          }
        }
      });

      if (!existingMessage) {
        return reply.status(404).send({
          success: false,
          error: 'Message non trouvé'
        });
      }

      // Vérifier la restriction temporelle (1 heure max pour les utilisateurs normaux)
      const isAuthor = existingMessage.senderId === userId;
      const messageAge = Date.now() - new Date(existingMessage.createdAt).getTime();
      const oneHourInMs = 60 * 60 * 1000; // 1 heure en millisecondes
      
      if (isAuthor && messageAge > oneHourInMs) {
        // Vérifier si l'utilisateur a des privilèges spéciaux
        const userRole = existingMessage.sender.role;
        const hasSpecialPrivileges = userRole === 'MODERATOR' || userRole === 'ADMIN' || userRole === 'CREATOR' || userRole === 'BIGBOSS';
        
        if (!hasSpecialPrivileges) {
          return reply.status(403).send({
            success: false,
            error: 'Vous ne pouvez plus modifier ce message (délai de 1 heure dépassé)'
          });
        }
      }

      // Vérifier les permissions : l'auteur peut modifier, ou les modérateurs/admins/créateurs
      let canModify = isAuthor;

      if (!canModify) {
        // Vérifier si l'utilisateur est modérateur/admin/créateur dans cette conversation
        const membership = await prisma.conversationMember.findFirst({
          where: {
            conversationId: conversationId,
            userId: userId,
            isActive: true
          },
          include: {
            user: {
              select: { role: true }
            }
          }
        });

        if (membership) {
          const userRole = membership.user.role;
          canModify = userRole === 'MODERATOR' || userRole === 'ADMIN' || userRole === 'CREATOR' || userRole === 'BIGBOSS';
        }
      }

      if (!canModify) {
        return reply.status(403).send({
          success: false,
          error: 'Vous n\'êtes pas autorisé à modifier ce message'
        });
      }

      // Validation du contenu
      if (!content || content.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Le contenu du message ne peut pas être vide'
        });
      }

      // Mettre à jour le message
      const updatedMessage = await prisma.message.update({
        where: { id: messageId },
        data: {
          content: content.trim(),
          originalLanguage,
          isEdited: true,
          editedAt: new Date()
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
              role: true
            }
          },
          anonymousSender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              language: true
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

      // Déclencher la retraduction automatique du message modifié
      try {
        // Utiliser les instances déjà disponibles dans le contexte Fastify
        const translationService: TranslationService = (fastify as any).translationService;
        
        // Invalider les traductions existantes en base de données
        const deletedCount = await prisma.messageTranslation.deleteMany({
          where: {
            messageId: messageId
          }
        });
        console.log(`🗑️ [GATEWAY] ${deletedCount} traductions supprimées pour le message ${messageId}`);
        
        // Créer un objet message pour la retraduction
        const messageForRetranslation = {
          id: messageId,
          content: content.trim(),
          originalLanguage: originalLanguage,
          conversationId: conversationId,
          senderId: userId
        };
        
        // Déclencher la retraduction via la méthode privée existante
        await (translationService as any)._processRetranslationAsync(messageId, messageForRetranslation);
        console.log('[GATEWAY] Retraduction initiée pour le message:', messageId);

      } catch (translationError) {
        console.error('[GATEWAY] Erreur lors de la retraduction:', translationError);
        // Ne pas faire échouer l'édition si la retraduction échoue
      }

      // Invalider et recalculer les stats pour refléter l'édition
      const stats = await conversationStatsService.getOrCompute(
        prisma,
        id,
        () => []
      );

      reply.send({
        success: true,
        data: { ...updatedMessage, meta: { conversationStats: stats } }
      });

    } catch (error) {
      console.error('[GATEWAY] Error updating message:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la modification du message'
      });
    }
  });

  // Route pour supprimer un message (soft delete)
  fastify.delete<{
    Params: ConversationParams & { messageId: string };
  }>('/conversations/:id/messages/:messageId', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { id, messageId } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Résoudre l'ID de conversation réel
      const conversationId = await resolveConversationId(id);
      if (!conversationId) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation non trouvée'
        });
      }

      // Vérifier que le message existe
      const existingMessage = await prisma.message.findFirst({
        where: {
          id: messageId,
          conversationId: conversationId,
          isDeleted: false
        },
        include: {
          sender: {
            select: { id: true }
          }
        }
      });

      if (!existingMessage) {
        return reply.status(404).send({
          success: false,
          error: 'Message non trouvé'
        });
      }

      // Vérifier les permissions : l'auteur peut supprimer, ou les modérateurs/admins/créateurs
      const isAuthor = existingMessage.senderId === userId;
      let canDelete = isAuthor;

      if (!canDelete) {
        // Vérifier si l'utilisateur est modérateur/admin/créateur dans cette conversation
        const membership = await prisma.conversationMember.findFirst({
          where: {
            conversationId: conversationId,
            userId: userId,
            isActive: true
          },
          include: {
            user: {
              select: { role: true }
            }
          }
        });

        if (membership) {
          const userRole = membership.user.role;
          canDelete = userRole === 'MODERATOR' || userRole === 'ADMIN' || userRole === 'CREATOR' || userRole === 'BIGBOSS';
        }
      }

      if (!canDelete) {
        return reply.status(403).send({
          success: false,
          error: 'Vous n\'êtes pas autorisé à supprimer ce message'
        });
      }

      // Soft delete du message
      await prisma.message.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedAt: new Date()
        }
      });

      // Invalider et recalculer les stats
      const stats = await conversationStatsService.getOrCompute(
        prisma,
        conversationId,
        () => []
      );

      reply.send({
        success: true,
        data: { messageId, deleted: true, meta: { conversationStats: stats } }
      });

    } catch (error) {
      console.error('[GATEWAY] Error deleting message:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la suppression du message'
      });
    }
  });

  // NOTE: ancienne route /conversations/create-link supprimée (remplacée par /links)

  // Route pour mettre à jour une conversation
  fastify.put<{ 
    Params: ConversationParams;
    Body: Partial<CreateConversationBody>;
  }>('/conversations/:id', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { title, description } = request.body;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Vérifier les permissions d'administration
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: id,
          userId: userId,
          role: { in: ['CREATOR', 'ADMIN', 'MODERATOR'] },
          isActive: true
        }
      });

      if (!membership && id !== "meeshy") {
        return reply.status(403).send({
          success: false,
          error: 'Vous n\'êtes pas autorisé à modifier cette conversation'
        });
      }

      // Interdire la modification de la conversation globale
      if (id === "meeshy") {
        return reply.status(403).send({
          success: false,
          error: 'La conversation globale ne peut pas être modifiée'
        });
      }

      const updatedConversation = await prisma.conversation.update({
        where: { id },
        data: {
          title,
          description
        },
        include: {
          members: {
            include: {
              user: {
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

      reply.send({
        success: true,
        data: updatedConversation
      });

    } catch (error) {
      console.error('[GATEWAY] Error updating conversation:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la mise à jour de la conversation'
      });
    }
  });

  // Route pour supprimer une conversation
  fastify.delete<{ Params: ConversationParams }>('/conversations/:id', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Interdire la suppression de la conversation globale
      if (id === "meeshy") {
        return reply.status(403).send({
          success: false,
          error: 'La conversation globale ne peut pas être supprimée'
        });
      }

      // Résoudre l'ID de conversation réel
      const conversationId = await resolveConversationId(id);
      if (!conversationId) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Vérifier les permissions d'administration
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: conversationId,
          userId: userId,
          role: { in: ['CREATOR', 'ADMIN'] },
          isActive: true
        }
      });

      if (!membership) {
        return reply.status(403).send({
          success: false,
          error: 'Vous n\'êtes pas autorisé à supprimer cette conversation'
        });
      }

      // Marquer la conversation comme inactive plutôt que de la supprimer
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { isActive: false }
      });

      reply.send({
        success: true,
        message: 'Conversation supprimée avec succès'
      });

    } catch (error) {
      console.error('[GATEWAY] Error deleting conversation:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la suppression de la conversation'
      });
    }
  });

  // Route pour modifier un message
  fastify.patch<{
    Params: { messageId: string };
    Body: { content: string };
  }>('/messages/:messageId', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { messageId } = request.params;
      const { content } = request.body;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Vérifier que le message existe et appartient à l'utilisateur
      const message = await prisma.message.findFirst({
        where: { id: messageId },
        include: {
          conversation: {
            include: {
              members: {
                where: {
                  userId: userId,
                  isActive: true
                }
              }
            }
          }
        }
      });

      if (!message) {
        return reply.status(404).send({
          success: false,
          error: 'Message introuvable'
        });
      }

      // Vérifier que l'utilisateur est l'auteur du message
      if (message.senderId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Vous ne pouvez modifier que vos propres messages'
        });
      }

      // Vérifier que l'utilisateur est membre de la conversation
      // Pour la conversation globale "meeshy", l'accès est autorisé
      if (message.conversation.identifier !== "meeshy") {
        const membership = await prisma.conversationMember.findFirst({
          where: {
            conversationId: message.conversationId,
            userId: userId,
            isActive: true
          }
        });
        
        if (!membership) {
          return reply.status(403).send({
            success: false,
            error: 'Accès non autorisé à cette conversation'
          });
        }
      }

      // Mettre à jour le contenu du message
      const updatedMessage = await prisma.message.update({
        where: { id: messageId },
        data: {
          content: content.trim(),
          isEdited: true,
          editedAt: new Date()
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
              role: true
            }
          }
        }
      });

      // Note: Les traductions existantes restent inchangées
      // Le service de traduction sera notifié si nécessaire via WebSocket

      reply.send({
        success: true,
        data: updatedMessage
      });

    } catch (error) {
      console.error('[GATEWAY] Error updating message:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la modification du message'
      });
    }
  });

  // Route pour récupérer les participants d'une conversation
  fastify.get<{
    Params: { id: string };
    Querystring: { 
      onlineOnly?: string;
      role?: string;
      search?: string;
      limit?: string;
    };
  }>('/conversations/:id/participants', {
    preValidation: [optionalAuth]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { onlineOnly, role, search, limit } = request.query;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Résoudre l'ID de conversation réel
      const conversationId = await resolveConversationId(id);
      if (!conversationId) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Vérifier que l'utilisateur a accès à cette conversation
      const canAccess = await canAccessConversation(prisma, authRequest.authContext, conversationId, id);
      if (!canAccess) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Construire les filtres dynamiquement
      const whereConditions: any = {
        conversationId: conversationId,
        isActive: true,
        user: {
          isActive: true
        }
      };

      // Filtre par statut en ligne
      if (onlineOnly === 'true') {
        whereConditions.user.isOnline = true;
      }

      // Filtre par rôle
      if (role) {
        whereConditions.user.role = role.toUpperCase();
      }

      // Filtre par recherche (nom, prénom, username, email)
      if (search && search.trim().length > 0) {
        const searchTerm = search.trim();
        whereConditions.user.OR = [
          {
            firstName: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          },
          {
            lastName: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          },
          {
            username: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          },
          {
            email: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          },
          {
            displayName: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          }
        ];
      }

      // Récupérer les participants avec filtres
      const participants = await prisma.conversationMember.findMany({
        where: whereConditions,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              email: true,
              role: true,
              isOnline: true,
              lastSeen: true,
              lastActiveAt: true,
              systemLanguage: true,
              regionalLanguage: true,
              customDestinationLanguage: true,
              autoTranslateEnabled: true,
              translateToSystemLanguage: true,
              translateToRegionalLanguage: true,
              useCustomDestination: true,
              isActive: true,
              createdAt: true,
              updatedAt: true
            }
          }
        },
        orderBy: [
          { user: { isOnline: 'desc' } }, // Utilisateurs en ligne en premier
          { user: { firstName: 'asc' } },  // Puis par prénom
          { user: { lastName: 'asc' } },   // Puis par nom
          { joinedAt: 'asc' }              // Enfin par date d'entrée
        ],
        ...(limit && { take: parseInt(limit, 10) }) // Limite optionnelle
      });

      // Transformer les données pour correspondre au format attendu
      const formattedParticipants = participants.map(participant => ({
        id: participant.user.id,
        userId: participant.userId, // Ajouter l'ID utilisateur pour la correspondance
        username: participant.user.username,
        firstName: participant.user.firstName,
        lastName: participant.user.lastName,
        displayName: participant.user.displayName,
        avatar: participant.user.avatar,
        email: participant.user.email,
        role: participant.user.role, // Rôle global de l'utilisateur
        conversationRole: participant.role, // Rôle dans cette conversation spécifique
        isOnline: participant.user.isOnline,
        lastSeen: participant.user.lastSeen,
        lastActiveAt: participant.user.lastActiveAt,
        systemLanguage: participant.user.systemLanguage,
        regionalLanguage: participant.user.regionalLanguage,
        customDestinationLanguage: participant.user.customDestinationLanguage,
        autoTranslateEnabled: participant.user.autoTranslateEnabled,
        translateToSystemLanguage: participant.user.translateToSystemLanguage,
        translateToRegionalLanguage: participant.user.translateToRegionalLanguage,
        useCustomDestination: participant.user.useCustomDestination,
        isActive: participant.user.isActive,
        createdAt: participant.user.createdAt,
        updatedAt: participant.user.updatedAt,
        // Permissions par défaut si non définies
        permissions: {
          canAccessAdmin: participant.user.role === 'ADMIN' || participant.user.role === 'BIGBOSS',
          canManageUsers: participant.user.role === 'ADMIN' || participant.user.role === 'BIGBOSS',
          canManageGroups: participant.user.role === 'ADMIN' || participant.user.role === 'BIGBOSS',
          canManageConversations: participant.user.role === 'ADMIN' || participant.user.role === 'BIGBOSS',
          canViewAnalytics: participant.user.role === 'ADMIN' || participant.user.role === 'BIGBOSS',
          canModerateContent: participant.user.role === 'ADMIN' || participant.user.role === 'BIGBOSS',
          canViewAuditLogs: participant.user.role === 'ADMIN' || participant.user.role === 'BIGBOSS',
          canManageNotifications: participant.user.role === 'ADMIN' || participant.user.role === 'BIGBOSS',
          canManageTranslations: participant.user.role === 'ADMIN' || participant.user.role === 'BIGBOSS',
        }
      }));

      // Récupérer les participants anonymes
      const anonymousParticipants = await prisma.anonymousParticipant.findMany({
        where: {
          conversationId: conversationId, // Utiliser l'ID résolu
          isActive: true
        },
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            language: true,
            isOnline: true,
            joinedAt: true,
            canSendMessages: true,
            canSendFiles: true,
            canSendImages: true
          },
          orderBy: { joinedAt: 'desc' }
        });

      // Transformer les participants anonymes pour correspondre au format attendu
      const formattedAnonymousParticipants = anonymousParticipants.map(participant => ({
        id: participant.id,
        username: participant.username,
        firstName: participant.firstName,
        lastName: participant.lastName,
        displayName: participant.username, // Utiliser username comme displayName pour les anonymes
        avatar: null,
        email: '',
        role: 'MEMBER',
        isOnline: participant.isOnline,
        lastSeen: participant.joinedAt,
        lastActiveAt: participant.joinedAt,
        systemLanguage: participant.language,
        regionalLanguage: participant.language,
        customDestinationLanguage: participant.language,
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isActive: true,
        createdAt: participant.joinedAt,
        updatedAt: participant.joinedAt,
        // Permissions pour les participants anonymes
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false,
        },
        // Propriétés spécifiques aux participants anonymes
        isAnonymous: true,
        canSendMessages: participant.canSendMessages,
        canSendFiles: participant.canSendFiles,
        canSendImages: participant.canSendImages
      }));

      // Combiner les participants authentifiés et anonymes
      const allParticipants = [...formattedParticipants, ...anonymousParticipants];

      reply.send({
        success: true,
        data: allParticipants
      });

    } catch (error) {
      console.error('[GATEWAY] Error fetching conversation participants:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération des participants'
      });
    }
  });

  // Route pour ajouter un participant à une conversation
  fastify.post<{
    Params: { id: string };
    Body: { userId: string };
  }>('/conversations/:id/participants', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { userId } = request.body;
      const authRequest = request as UnifiedAuthRequest;
      const currentUserId = authRequest.authContext.userId;

      // Résoudre l'ID de conversation réel
      const conversationId = await resolveConversationId(id);
      if (!conversationId) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Vérifier que l'utilisateur actuel a les droits pour ajouter des participants
      const currentUserMembership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: conversationId,
          userId: currentUserId,
          isActive: true
        }
      });

      if (!currentUserMembership) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Vérifier que l'utilisateur à ajouter existe
      const userToAdd = await prisma.user.findFirst({
        where: { id: userId }
      });

      if (!userToAdd) {
        return reply.status(404).send({
          success: false,
          error: 'Utilisateur non trouvé'
        });
      }

      // Vérifier que l'utilisateur n'est pas déjà membre
      const existingMembership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: conversationId,
          userId: userId,
          isActive: true
        }
      });

      if (existingMembership) {
        return reply.status(400).send({
          success: false,
          error: 'L\'utilisateur est déjà membre de cette conversation'
        });
      }

      // Ajouter le participant
      await prisma.conversationMember.create({
        data: {
          conversationId: conversationId,
          userId: userId,
          role: 'MEMBER',
          joinedAt: new Date()
        }
      });

      reply.send({
        success: true,
        message: 'Participant ajouté avec succès'
      });

    } catch (error) {
      console.error('[GATEWAY] Error adding participant:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de l\'ajout du participant'
      });
    }
  });

  // Route pour supprimer un participant d'une conversation
  fastify.delete<{
    Params: { id: string; userId: string };
  }>('/conversations/:id/participants/:userId', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { id, userId } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const currentUserId = authRequest.authContext.userId;

      // Résoudre l'ID de conversation réel
      const conversationId = await resolveConversationId(id);
      if (!conversationId) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Vérifier que l'utilisateur actuel a les droits pour supprimer des participants
      const currentUserMembership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: conversationId,
          userId: currentUserId,
          isActive: true
        },
        include: {
          user: true
        }
      });

      if (!currentUserMembership) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Seuls les admins ou le créateur peuvent supprimer des participants
      const isAdmin = currentUserMembership.user.role === 'ADMIN' || currentUserMembership.user.role === 'BIGBOSS';
      const isCreator = currentUserMembership.role === 'CREATOR';

      if (!isAdmin && !isCreator) {
        return reply.status(403).send({
          success: false,
          error: 'Vous n\'avez pas les droits pour supprimer des participants'
        });
      }

      // Empêcher de se supprimer soi-même
      if (userId === currentUserId) {
        return reply.status(400).send({
          success: false,
          error: 'Vous ne pouvez pas vous supprimer de la conversation'
        });
      }

      // Supprimer le participant
      await prisma.conversationMember.updateMany({
        where: {
          conversationId: conversationId,
          userId: userId,
          isActive: true
        },
        data: {
          isActive: false,
          leftAt: new Date()
        }
      });

      reply.send({
        success: true,
        message: 'Participant supprimé avec succès'
      });

    } catch (error) {
      console.error('[GATEWAY] Error removing participant:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la suppression du participant'
      });
    }
  });

  // Route pour créer un nouveau lien pour une conversation existante
  fastify.post<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      maxUses?: number;
      maxConcurrentUsers?: number;
      maxUniqueSessions?: number;
      expiresAt?: string;
      allowAnonymousMessages?: boolean;
      allowAnonymousFiles?: boolean;
      allowAnonymousImages?: boolean;
      allowViewHistory?: boolean;
      requireNickname?: boolean;
      requireEmail?: boolean;
      allowedCountries?: string[];
      allowedLanguages?: string[];
      allowedIpRanges?: string[];
    };
  }>('/conversations/:id/new-link', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const body = request.body || {};
      const authRequest = request as UnifiedAuthRequest;
      const currentUserId = authRequest.authContext.userId;

      // Résoudre l'ID de conversation réel
      const conversationId = await resolveConversationId(id);
      if (!conversationId) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Récupérer les informations de la conversation et du membre
      const [conversation, membership] = await Promise.all([
        prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { id: true, type: true, title: true }
        }),
        prisma.conversationMember.findFirst({
          where: {
            conversationId: conversationId,
            userId: currentUserId,
            isActive: true
          }
        })
      ]);

      if (!conversation) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation non trouvée'
        });
      }

      if (!membership) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Récupérer le rôle de l'utilisateur
      const user = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { role: true }
      });

      if (!user) {
        return reply.status(403).send({
          success: false,
          error: 'Utilisateur non trouvé'
        });
      }

      // Vérifier les permissions pour créer des liens de partage
      const conversationType = conversation.type;
      const userRole = user.role as UserRoleEnum;

      // Interdire la création de liens pour les conversations directes
      if (conversationType === 'direct') {
        return reply.status(403).send({
          success: false,
          error: 'Cannot create share links for direct conversations'
        });
      }

      // Pour les conversations globales, seuls les BIGBOSS peuvent créer des liens
      if (conversationType === 'global') {
        if (userRole !== UserRoleEnum.BIGBOSS) {
          return reply.status(403).send({
            success: false,
            error: 'You must have BIGBOSS rights to create share links for global conversations'
          });
        }
      }

      // Pour tous les autres types de conversations (group, public, etc.),
      // n'importe qui ayant accès à la conversation peut créer des liens
      // L'utilisateur doit juste être membre de la conversation (déjà vérifié plus haut)

      // Générer le linkId initial
      const initialLinkId = generateInitialLinkId();

      // Créer le lien avec toutes les options configurables
      const shareLink = await prisma.conversationShareLink.create({
        data: {
          linkId: initialLinkId, // Temporaire
          conversationId: conversationId,
          createdBy: currentUserId,
          name: body.name,
          description: body.description,
          maxUses: body.maxUses ?? undefined,
          maxConcurrentUsers: body.maxConcurrentUsers ?? undefined,
          maxUniqueSessions: body.maxUniqueSessions ?? undefined,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
          allowAnonymousMessages: body.allowAnonymousMessages ?? true,
          allowAnonymousFiles: body.allowAnonymousFiles ?? false,
          allowAnonymousImages: body.allowAnonymousImages ?? true,
          allowViewHistory: body.allowViewHistory ?? true,
          requireNickname: body.requireNickname ?? true,
          requireEmail: body.requireEmail ?? false,
          allowedCountries: body.allowedCountries ?? [],
          allowedLanguages: body.allowedLanguages ?? [],
          allowedIpRanges: body.allowedIpRanges ?? []
        }
      });

      // Mettre à jour avec le linkId final
      const finalLinkId = generateFinalLinkId(shareLink.id, initialLinkId);
      await prisma.conversationShareLink.update({
        where: { id: shareLink.id },
        data: { linkId: finalLinkId }
      });

      // Retour compatible avec le frontend de service conversations (string du lien complet)
      const inviteLink = `${process.env.FRONTEND_URL || 'http://meeshy.me'}/join/${finalLinkId}`;
      reply.send({
        success: true,
        data: {
          link: inviteLink,
          code: finalLinkId,
          shareLink: {
            id: shareLink.id,
            linkId: finalLinkId,
            name: shareLink.name,
            description: shareLink.description,
            maxUses: shareLink.maxUses,
            expiresAt: shareLink.expiresAt,
            allowAnonymousMessages: shareLink.allowAnonymousMessages,
            allowAnonymousFiles: shareLink.allowAnonymousFiles,
            allowAnonymousImages: shareLink.allowAnonymousImages,
            allowViewHistory: shareLink.allowViewHistory,
            requireNickname: shareLink.requireNickname,
            requireEmail: shareLink.requireEmail
          }
        }
      });

    } catch (error) {
      console.error('[GATEWAY] Error creating new conversation link:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la création du lien'
      });
    }
  });

  // Route pour mettre à jour une conversation
  fastify.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      description?: string;
      type?: 'direct' | 'group' | 'public' | 'global';
    };
  }>('/conversations/:id', {
    preValidation: [optionalAuth]
  }, async (request, reply) => {
    const { id } = request.params;
    const { title, description, type } = request.body;
    const authRequest = request as UnifiedAuthRequest;
    
    try {
      // Vérifier que l'utilisateur est authentifié
      if (!authRequest.authContext.isAuthenticated) {
        return reply.status(401).send({
          success: false,
          error: 'Authentification requise'
        });
      }
      
      const currentUserId = authRequest.authContext.userId;

      console.log('[GATEWAY] Update conversation request:', {
        conversationId: id,
        currentUserId,
        title,
        description,
        type
      });

      // Résoudre l'ID de conversation réel
      const conversationId = await resolveConversationId(id);
      if (!conversationId) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Vérifier que l'utilisateur a accès à cette conversation
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: conversationId,
          userId: currentUserId,
          isActive: true
        },
        include: {
          user: true
        }
      });

      if (!membership) {
        console.log('[GATEWAY] User not found in conversation members:', {
          conversationId: id,
          currentUserId,
          membership: null
        });
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      console.log('[GATEWAY] User membership found:', {
        conversationId: id,
        currentUserId,
        userRole: membership.user.role,
        memberRole: membership.role,
        isActive: membership.isActive
      });

      // Pour la modification du nom, permettre à tous les membres de la conversation
      // Seuls les admins ou créateurs peuvent modifier le type de conversation
      if (type !== undefined) {
        const isAdmin = membership.user.role === 'ADMIN' || membership.user.role === 'BIGBOSS';
        const isCreator = membership.role === 'CREATOR';
        
        if (!isAdmin && !isCreator) {
          return reply.status(403).send({
            success: false,
            error: 'Seuls les administrateurs peuvent modifier le type de conversation'
          });
        }
      }

      // Préparer les données de mise à jour
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (type !== undefined) updateData.type = type;

      // Mettre à jour la conversation
      const updatedConversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: updateData,
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  systemLanguage: true,
                  isOnline: true,
                  lastSeen: true,
                  role: true
                }
              }
            }
          }
        }
      });

      reply.send({
        success: true,
        data: updatedConversation
      });

    } catch (error) {
      console.error('[GATEWAY] Error updating conversation:', error);
      
      // Gestion d'erreur améliorée avec détails spécifiques
      let errorMessage = 'Erreur lors de la mise à jour de la conversation';
      let statusCode = 500;
      
      if (error.code === 'P2002') {
        errorMessage = 'Une conversation avec ce nom existe déjà';
        statusCode = 409;
      } else if (error.code === 'P2025') {
        errorMessage = 'Conversation non trouvée';
        statusCode = 404;
      } else if (error.code === 'P2003') {
        errorMessage = 'Erreur de référence - conversation invalide';
        statusCode = 400;
      } else if (error.name === 'ValidationError') {
        errorMessage = 'Données de mise à jour invalides';
        statusCode = 400;
      }
      
      console.error('[GATEWAY] Detailed error info:', {
        code: error.code,
        message: error.message,
        meta: error.meta,
        conversationId: id,
        currentUserId: authRequest.authContext.userId,
        updateData: { title, description, type }
      });
      
      reply.status(statusCode).send({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          code: error.code,
          message: error.message,
          meta: error.meta
        } : undefined
      });
    }
  });

  // Récupérer les liens de partage d'une conversation (pour les admins)
  fastify.get('/conversations/:conversationId/links', { preValidation: [requiredAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { conversationId } = request.params as { conversationId: string };
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Vérifier que l'utilisateur est admin ou modérateur de la conversation
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId,
          userId,
          role: { in: ['CREATOR', 'ADMIN', 'MODERATOR'] },
          isActive: true
        }
      });

      if (!membership) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Accès non autorisé - droits administrateur ou modérateur requis' 
        });
      }

      const links = await prisma.conversationShareLink.findMany({
        where: { conversationId },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true
            }
          },
          conversation: {
            select: {
              id: true,
              title: true,
              type: true
            }
          },
          _count: {
            select: {
              anonymousParticipants: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({ success: true, data: links });
    } catch (error) {
      console.error('[GATEWAY] Error fetching conversation links:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Erreur lors de la récupération des liens de la conversation' 
      });
    }
  });

  // Route pour rejoindre une conversation via un lien partagé (utilisateurs authentifiés)
  fastify.post('/conversations/join/:linkId', {
    preValidation: [requiredAuth]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const authRequest = request as UnifiedAuthRequest;
      const userToken = authRequest.authContext;

      if (!userToken) {
        return reply.status(401).send({
          success: false,
          error: 'Authentification requise'
        });
      }

      // Vérifier que le lien existe et est valide
      const shareLink = await prisma.conversationShareLink.findFirst({
        where: { linkId },
        include: {
          conversation: true
        }
      });

      if (!shareLink) {
        return reply.status(404).send({
          success: false,
          error: 'Lien de conversation introuvable'
        });
      }

      if (!shareLink.isActive) {
        return reply.status(410).send({
          success: false,
          error: 'Ce lien n\'est plus actif'
        });
      }

      if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
        return reply.status(410).send({
          success: false,
          error: 'Ce lien a expiré'
        });
      }

      // Vérifier si l'utilisateur est déjà membre de la conversation
      const existingMember = await prisma.conversationMember.findFirst({
        where: {
          conversationId: shareLink.conversationId,
          userId: userToken.userId
        }
      });

      if (existingMember) {
        return reply.send({
          success: true,
          message: 'Vous êtes déjà membre de cette conversation',
          data: { conversationId: shareLink.conversationId }
        });
      }

      // Ajouter l'utilisateur à la conversation
      await prisma.conversationMember.create({
        data: {
          conversationId: shareLink.conversationId,
          userId: userToken.userId,
          role: UserRoleEnum.MEMBER,
          joinedAt: new Date()
        }
      });

      // Incrémenter le compteur d'utilisation du lien
      await prisma.conversationShareLink.update({
        where: { id: shareLink.id },
        data: { currentUses: { increment: 1 } }
      });

      return reply.send({
        success: true,
        message: 'Vous avez rejoint la conversation avec succès',
        data: { conversationId: shareLink.conversationId }
      });

    } catch (error) {
      console.error('[GATEWAY] Error joining conversation via link:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la jointure de la conversation'
      });
    }
  });


}
