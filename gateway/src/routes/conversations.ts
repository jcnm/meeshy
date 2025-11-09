import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TranslationService } from '../services/TranslationService';
import { TrackingLinkService } from '../services/TrackingLinkService';
import { AttachmentService } from '../services/AttachmentService';
import { conversationStatsService } from '../services/ConversationStatsService';
import { UserRoleEnum, ErrorCode } from '../../shared/types';
import { createError, sendErrorResponse } from '../../shared/utils/errors';
import { ConversationSchemas, validateSchema } from '../../shared/utils/validation';
import { 
  resolveUserLanguage, 
  generateConversationIdentifier as sharedGenerateConversationIdentifier,
  isValidMongoId,
  generateDefaultConversationTitle
} from '../../shared/utils/conversation-helpers';
import { createUnifiedAuthMiddleware, UnifiedAuthRequest } from '../middleware/auth';

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
 * @deprecated Utiliser sharedGenerateConversationIdentifier de shared/utils/conversation-helpers
 */
function generateConversationIdentifier(title?: string): string {
  return sharedGenerateConversationIdentifier(title);
}

/**
 * Vérifie l'unicité d'un identifiant de conversation et génère une variante avec suffixe hexadécimal si nécessaire
 */
async function ensureUniqueConversationIdentifier(prisma: any, baseIdentifier: string): Promise<string> {
  // Si l'identifiant a déjà un suffixe hexadécimal (8 caractères après le dernier tiret)
  const hexPattern = /-[a-f0-9]{8}$/;
  const hasHexSuffix = hexPattern.test(baseIdentifier);
  
  // Si pas de suffixe hex, vérifier l'unicité de l'identifiant tel quel
  let identifier = baseIdentifier;
  
  const existing = await prisma.conversation.findFirst({
    where: { identifier }
  });
  
  if (!existing) {
    return identifier;
  }
  
  // Si l'identifiant existe, ajouter/régénérer un suffixe hexadécimal aléatoire de 4 bytes (8 caractères)
  // Enlever l'ancien suffixe s'il existe
  const baseWithoutSuffix = hasHexSuffix ? baseIdentifier.replace(hexPattern, '') : baseIdentifier;
  
  // Générer un nouveau suffixe hexadécimal
  const crypto = require('crypto');
  const hexSuffix = crypto.randomBytes(4).toString('hex'); // 4 bytes = 8 caractères hex
  
  identifier = `${baseWithoutSuffix}-${hexSuffix}`;
  
  // Vérifier que le nouvel identifiant avec hex suffix n'existe pas non plus
  const existingWithHex = await prisma.conversation.findFirst({
    where: { identifier }
  });
  
  if (!existingWithHex) {
    return identifier;
  }
  
  // Si par une chance extrême le hex existe aussi, régénérer récursivement
  return ensureUniqueConversationIdentifier(prisma, baseWithoutSuffix);
}

/**
 * Vérifie l'unicité d'un identifiant de ConversationShareLink et génère une variante avec timestamp si nécessaire
 */
async function ensureUniqueShareLinkIdentifier(prisma: any, baseIdentifier: string): Promise<string> {
  // Si l'identifiant est vide, générer un identifiant par défaut
  if (!baseIdentifier || baseIdentifier.trim() === '') {
    const timestamp = Date.now().toString();
    const randomPart = Math.random().toString(36).substring(2, 8);
    baseIdentifier = `mshy_link-${timestamp}-${randomPart}`;
  }
  
  let identifier = baseIdentifier.trim();
  
  // Vérifier si l'identifiant existe déjà
  const existing = await prisma.conversationShareLink.findFirst({
    where: { identifier }
  });
  
  if (!existing) {
    return identifier;
  }
  
  // Si l'identifiant existe, ajouter un suffixe timestamp YYYYmmddHHMMSS
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');
  
  identifier = `${baseIdentifier}-${timestamp}`;
  
  // Vérifier que le nouvel identifiant avec timestamp n'existe pas non plus
  const existingWithTimestamp = await prisma.conversationShareLink.findFirst({
    where: { identifier }
  });
  
  if (!existingWithTimestamp) {
    return identifier;
  }
  
  // Si même avec le timestamp il y a un conflit, ajouter un suffixe numérique
  let counter = 1;
  while (true) {
    const newIdentifier = `${baseIdentifier}-${timestamp}-${counter}`;
    const existingWithCounter = await prisma.conversationShareLink.findFirst({
      where: { identifier: newIdentifier }
    });
    
    if (!existingWithCounter) {
      return newIdentifier;
    }
    
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
  const trackingLinkService = new TrackingLinkService(prisma);
  const attachmentService = new AttachmentService(prisma);
  const socketIOHandler = fastify.socketIOHandler;
  
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
    if (isValidMongoId(identifier)) {
      return identifier;
    }

    // Sinon, chercher par le champ identifier
    const conversation = await prisma.conversation.findFirst({
      where: { identifier: identifier }
    });

    return conversation ? conversation.id : null;
  }

  // Route pour vérifier la disponibilité d'un identifiant de conversation
  fastify.get('/conversations/check-identifier/:identifier', { preValidation: [requiredAuth] }, async (request, reply) => {
    try {
      const { identifier } = request.params as { identifier: string };

      // Vérifier si l'identifiant existe déjà
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          identifier: {
            equals: identifier,
            mode: 'insensitive'
          }
        }
      });

      return reply.send({
        success: true,
        available: !existingConversation,
        identifier
      });
    } catch (error) {
      console.error('[CONVERSATIONS] Error checking identifier availability:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to check identifier availability'
      });
    }
  });

  // Route pour obtenir toutes les conversations de l'utilisateur
  fastify.get<{ Querystring: { limit?: string; offset?: string; includeCount?: string } }>('/conversations', {
    preValidation: [optionalAuth]
  }, async (request: FastifyRequest<{ Querystring: { limit?: string; offset?: string; includeCount?: string } }>, reply) => {
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

      // Paramètres de pagination (réduit à 15 par défaut pour améliorer la performance)
      const limit = Math.min(parseInt(request.query.limit || '15', 10), 50); // Max 50
      const offset = parseInt(request.query.offset || '0', 10);
      const includeCount = request.query.includeCount === 'true';

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
        skip: offset,
        take: limit,
        select: {
          id: true,
          title: true,
          type: true,
          identifier: true,
          isActive: true,
          createdAt: true,
          lastMessageAt: true,
          image: true,
          avatar: true,
          communityId: true,
          members: {
            take: 5, // Réduit à 5 membres au lieu de 10
            select: {
              userId: true,
              role: true,
              isActive: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
                  isOnline: true,
                  lastActiveAt: true,
                  lastSeen: true
                }
              }
            }
          },
          anonymousParticipants: {
            take: 3, // Réduit à 3 participants anonymes
            where: {
              isActive: true
            },
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              isOnline: true
            }
          },
          messages: {
            where: {
              isDeleted: false
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              createdAt: true,
              senderId: true,
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
        },
        orderBy: { lastMessageAt: 'desc' }
      });

      // Optimisation : Calculer tous les unreadCounts en une seule requête groupée au lieu de N+1
      const conversationIds = conversations.map(c => c.id);

      const unreadCounts = await prisma.message.groupBy({
        by: ['conversationId'],
        where: {
          conversationId: { in: conversationIds },
          isDeleted: false,
          NOT: {
            status: {
              some: {
                userId: userId
              }
            }
          }
        },
        _count: {
          id: true
        }
      });

      // Créer un map pour un accès O(1)
      const unreadCountMap = new Map(
        unreadCounts.map(uc => [uc.conversationId, uc._count.id])
      );

      // Compter le nombre total de conversations (optionnel pour performance)
      let totalCount = 0;
      let hasMore = true;

      if (includeCount || offset === 0) {
        totalCount = await prisma.conversation.count({
          where: {
            OR: [
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
          }
        });
        hasMore = offset + conversations.length < totalCount;
      } else {
        // Si on ne compte pas, on estime hasMore en vérifiant si on a reçu le nombre limit
        hasMore = conversations.length === limit;
      }

      // Mapper les conversations avec unreadCount (sans Promise.all - tout est déjà chargé)
      const conversationsWithUnreadCount = conversations.map((conversation) => {
        const unreadCount = unreadCountMap.get(conversation.id) || 0;

        // S'assurer qu'un titre existe toujours
        const displayTitle = conversation.title && conversation.title.trim() !== ''
          ? conversation.title
          : generateDefaultConversationTitle(
              conversation.members.map((m: any) => ({
                id: m.userId,
                displayName: m.user?.displayName,
                username: m.user?.username,
                firstName: m.user?.firstName,
                lastName: m.user?.lastName
              })),
              userId
            );

        return {
          ...conversation,
          title: displayTitle,
          lastMessage: conversation.messages[0] || null,
          unreadCount
        };
      });

      reply.send({
        success: true,
        data: conversationsWithUnreadCount,
        pagination: {
          limit,
          offset,
          total: totalCount,
          hasMore
        }
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
                  lastActiveAt: true,
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

      // S'assurer qu'un titre existe toujours
      const displayTitle = conversation.title && conversation.title.trim() !== ''
        ? conversation.title
        : generateDefaultConversationTitle(
            conversation.members.map((m: any) => ({
              id: m.userId,
              displayName: m.user?.displayName,
              username: m.user?.username,
              firstName: m.user?.firstName,
              lastName: m.user?.lastName
            })),
            userId
          );

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
          title: displayTitle,
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
      // Valider les données avec Zod
      const validatedData = validateSchema(
        ConversationSchemas.create,
        request.body,
        'create-conversation'
      );
      
      const { type, title, description, participantIds = [], communityId, identifier } = validatedData;
      
      // Utiliser le nouveau système d'authentification unifié
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
        throw createError(ErrorCode.UNAUTHORIZED, 'Authentication required to create conversation');
      }
      
      const userId = authContext.userId;

      // Prevent creating conversation with oneself
      if (type === 'direct' && participantIds.length === 1 && participantIds[0] === userId) {
        throw createError(ErrorCode.INVALID_OPERATION, 'Vous ne pouvez pas créer une conversation avec vous-même');
      }

      // Also check if userId is in participantIds (in case of manipulation)
      if (participantIds.includes(userId)) {
        throw createError(ErrorCode.INVALID_OPERATION, 'Vous ne devez pas vous inclure dans la liste des participants');
      }

      // Note: La validation de l'identifier est maintenant gérée par CommonSchemas.conversationIdentifier dans Zod

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

      // S'assurer que participantIds ne contient pas de doublons, n'inclut pas le créateur,
      // et ne contient pas de valeurs null/undefined/empty
      const uniqueParticipantIds = [...new Set(participantIds)]
        .filter((id: any) => id && id !== userId && typeof id === 'string' && id.trim().length > 0);

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

      // S'assurer qu'un titre existe toujours
      const displayTitle = conversation.title && conversation.title.trim() !== ''
        ? conversation.title
        : generateDefaultConversationTitle(
            conversation.members.map((m: any) => ({
              id: m.userId,
              displayName: m.user?.displayName,
              username: m.user?.username,
              firstName: m.user?.firstName,
              lastName: m.user?.lastName
            })),
            userId
          );

      reply.status(201).send({
        success: true,
        data: {
          ...conversation,
          title: displayTitle
        }
      });

    } catch (error) {
      sendErrorResponse(reply, error as Error, 'create-conversation');
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
        select: {
          id: true,
          content: true,
          originalLanguage: true,
          createdAt: true,
          updatedAt: true,
          editedAt: true,
          senderId: true,
          anonymousSenderId: true,
          conversationId: true,
          isDeleted: true,
          replyToId: true,
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
          attachments: {
            select: {
              id: true,
              fileName: true,
              originalName: true,
              mimeType: true,
              fileSize: true,
              fileUrl: true,
              thumbnailUrl: true,
              width: true,
              height: true,
              createdAt: true
            }
          },
          status: {
            where: {
              userId: userId // Charger seulement le status de l'utilisateur courant
            },
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
              translationModel: true
            }
          },
          reactions: {
            select: {
              id: true,
              emoji: true,
              userId: true,
              anonymousUserId: true,
              createdAt: true
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 20 // Limiter à 20 réactions par message
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              originalLanguage: true,
              createdAt: true,
              senderId: true,
              anonymousSenderId: true,
              sender: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true
                }
              },
              anonymousSender: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true
                }
              },
              attachments: {
                select: {
                  id: true,
                  fileName: true,
                  mimeType: true,
                  fileUrl: true,
                  thumbnailUrl: true
                },
                take: 3 // Limiter à 3 attachments dans le replyTo
              },
              // Ne pas charger les translations/reactions du replyTo pour optimiser
              _count: {
                select: {
                  reactions: true
                }
              }
            }
          },
          _count: {
            select: {
              reactions: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit), 50), // Max 50 messages
        skip: before ? 0 : parseInt(offset)
      });

      // Optimisation : Récupérer les préférences linguistiques seulement si nécessaire
      // (le frontend peut aussi utiliser ses préférences locales en cache)
      let userPreferredLanguage = 'en';

      if (authRequest.authContext.isAuthenticated && !authRequest.authContext.isAnonymous) {
        const user = await prisma.user.findFirst({
          where: { id: userId },
          select: {
            systemLanguage: true,
            regionalLanguage: true,
            customDestinationLanguage: true
          }
        });

        // Déterminer la langue préférée de l'utilisateur (pour information au frontend)
        userPreferredLanguage = resolveUserLanguage(user || { systemLanguage: 'en' });
      }

      // Retourner les messages avec toutes leurs traductions
      // Le frontend se chargera d'afficher la bonne traduction
      const messagesWithAllTranslations = messages.map(message => {
        // Adapter le message de réponse également
        let adaptedReplyTo = null;
        if (message.replyTo) {
          adaptedReplyTo = {
            ...message.replyTo,
            originalLanguage: message.replyTo.originalLanguage || 'fr' // Garantir une langue par défaut
            // Note: translations non chargées dans replyTo pour optimisation
          };
        }

        return {
          ...message,
          originalLanguage: message.originalLanguage || 'fr', // Garantir une langue par défaut
          translations: message.translations, // Garder toutes les traductions
          replyTo: adaptedReplyTo,
          userPreferredLanguage: userPreferredLanguage // Indiquer au frontend la langue préférée
        };
      });

      // Marquer les messages comme lus (optimisé - ne marquer que les messages non lus)
      if (messages.length > 0 && !authRequest.authContext.isAnonymous) {
        const messageIds = messages.map(m => m.id);

        try {
          // Optimisation : Créer les status seulement si pas déjà marqué comme lu
          // On utilise createMany pour créer les statuts de lecture
          // Note: On ignore les erreurs de duplication car certains messages peuvent déjà être lus
          for (const messageId of messageIds) {
            try {
              await prisma.messageStatus.create({
                data: {
                  messageId,
                  userId
                }
              });
            } catch (err) {
              // Ignorer les erreurs de duplication (message déjà lu)
              if ((err as any)?.code !== 'P2002') {
                console.warn('[GATEWAY] Error creating message status:', err);
              }
            }
          }
        } catch (error) {
          console.warn('[GATEWAY] Error marking messages as read:', error);
        }
      }

      reply.send({
        success: true,
        data: {
          messages: messagesWithAllTranslations,
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

  // Route pour marquer tous les messages d'une conversation comme lus
  fastify.post<{ 
    Params: ConversationParams;
  }>('/conversations/:id/mark-read', {
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
      const canAccess = await canAccessConversation(prisma, authRequest.authContext, conversationId, id);
      if (!canAccess) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Récupérer tous les messages non lus de cette conversation pour cet utilisateur
      const unreadMessages = await prisma.message.findMany({
        where: {
          conversationId: conversationId,
          isDeleted: false,
          senderId: { not: userId }, // Ne pas marquer ses propres messages
          status: {
            none: {
              userId: userId
            }
          }
        },
        select: {
          id: true
        }
      });

      if (unreadMessages.length === 0) {
        return reply.send({
          success: true,
          message: 'Aucun message non lu à marquer',
          markedCount: 0
        });
      }

      // Marquer tous les messages comme lus
      const statusData = unreadMessages.map(message => ({
        messageId: message.id,
        userId: userId,
        readAt: new Date()
      }));

      await prisma.messageStatus.createMany({
        data: statusData
      });

      return reply.send({
        success: true,
        message: `${unreadMessages.length} message(s) marqué(s) comme lu(s)`,
        markedCount: unreadMessages.length
      });

    } catch (error) {
      console.error('[GATEWAY] Error marking conversation as read:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors du marquage des messages comme lus'
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

      // ÉTAPE 1: Traiter les liens dans le message AVANT la sauvegarde
      const { processedContent, trackingLinks } = await trackingLinkService.processMessageLinks({
        content: content.trim(),
        conversationId,
        createdBy: userId
      });

      // ÉTAPE 2: Créer le message avec le contenu transformé
      const message = await prisma.message.create({
        data: {
          conversationId: conversationId, // Utiliser l'ID résolu
          senderId: userId,
          content: processedContent, // Utiliser le contenu avec les liens remplacés par mshy://<token>
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

      // ÉTAPE 3: Mettre à jour les messageIds des TrackingLinks
      if (trackingLinks.length > 0) {
        const tokens = trackingLinks.map(link => link.token);
        await trackingLinkService.updateTrackingLinksMessageId(tokens, message.id);
        console.log(`[CONVERSATION] Updated messageId for ${tokens.length} tracking link(s)`);
      }

      // Mettre à jour le timestamp de la conversation
      await prisma.conversation.update({
        where: { id: conversationId }, // Utiliser l'ID résolu
        data: { lastMessageAt: new Date() }
      });

      // Marquer le message comme lu pour l'expéditeur
      await prisma.messageStatus.create({
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
          status: { none: { userId } }
        },
        select: { id: true }
      });

      if (unreadMessages.length > 0) {
        await prisma.messageStatus.createMany({
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

      // Transformer les conversations pour garantir qu'un titre existe toujours
      const conversationsWithTitle = conversations.map((conversation) => {
        const displayTitle = conversation.title && conversation.title.trim() !== ''
          ? conversation.title
          : generateDefaultConversationTitle(
              conversation.members.map((m: any) => ({
                id: m.userId,
                displayName: m.user?.displayName,
                username: m.user?.username,
                firstName: m.user?.firstName,
                lastName: m.user?.lastName
              })),
              userId
            );

        return {
          ...conversation,
          title: displayTitle,
          lastMessage: conversation.messages[0] || null
        };
      });

      reply.send({ success: true, data: conversationsWithTitle });
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
        // Support both MODO and MODERATOR for backward compatibility
        const hasSpecialPrivileges = userRole === 'MODO' || userRole === 'MODERATOR' || userRole === 'ADMIN' || userRole === 'CREATOR' || userRole === 'BIGBOSS';
        
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
          // Support both MODO and MODERATOR for backward compatibility
          canModify = userRole === 'MODO' || userRole === 'MODERATOR' || userRole === 'ADMIN' || userRole === 'CREATOR' || userRole === 'BIGBOSS';
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

      // Diffuser la mise à jour via Socket.IO
      try {
        const socketIOManager = socketIOHandler.getManager();
        if (socketIOManager) {
          const room = `conversation_${conversationId}`;
          (socketIOManager as any).io.to(room).emit('message:edited', {
            ...updatedMessage,
            conversationId
          });
          console.log(`✅ [CONVERSATIONS] Message édité diffusé à la conversation ${conversationId}`);
        }
      } catch (socketError) {
        console.error('[CONVERSATIONS] Erreur lors de la diffusion Socket.IO:', socketError);
        // Ne pas faire échouer l'édition si la diffusion échoue
      }

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
          },
          attachments: {
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
          // Support both MODO and MODERATOR for backward compatibility
          canDelete = userRole === 'MODO' || userRole === 'MODERATOR' || userRole === 'ADMIN' || userRole === 'CREATOR' || userRole === 'BIGBOSS';
        }
      }

      if (!canDelete) {
        return reply.status(403).send({
          success: false,
          error: 'Vous n\'êtes pas autorisé à supprimer ce message'
        });
      }

      // Supprimer les attachments et leurs fichiers physiques
      if (existingMessage.attachments && existingMessage.attachments.length > 0) {
        console.log(`🗑️ [CONVERSATIONS] Suppression de ${existingMessage.attachments.length} attachments pour le message ${messageId}`);
        for (const attachment of existingMessage.attachments) {
          try {
            await attachmentService.deleteAttachment(attachment.id);
            console.log(`✅ [CONVERSATIONS] Attachment ${attachment.id} supprimé avec succès`);
          } catch (error) {
            console.error(`❌ [CONVERSATIONS] Erreur lors de la suppression de l'attachment ${attachment.id}:`, error);
            // Continuer même en cas d'erreur pour supprimer les autres
          }
        }
      }

      // Supprimer les traductions du message
      const deletedTranslations = await prisma.messageTranslation.deleteMany({
        where: {
          messageId: messageId
        }
      });

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

      // Diffuser la suppression via Socket.IO
      try {
        const socketIOManager = socketIOHandler.getManager();
        if (socketIOManager) {
          const room = `conversation_${conversationId}`;
          (socketIOManager as any).io.to(room).emit('message:deleted', {
            messageId,
            conversationId
          });
          console.log(`✅ [CONVERSATIONS] Message supprimé diffusé à la conversation ${conversationId}`);
        }
      } catch (socketError) {
        console.error('[CONVERSATIONS] Erreur lors de la diffusion Socket.IO:', socketError);
        // Ne pas faire échouer la suppression si la diffusion échoue
      }

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
      const allParticipants = [...formattedParticipants, ...formattedAnonymousParticipants];

      console.log('[GATEWAY] 📊 Participants récupérés pour conversation:', conversationId, {
        authenticated: formattedParticipants.length,
        anonymous: formattedAnonymousParticipants.length,
        total: allParticipants.length
      });
      console.log('[GATEWAY] 👥 Liste des participants:', allParticipants.map(p => ({
        id: p.id,
        username: p.username,
        displayName: p.displayName, 
      })));

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
            error: 'You do not have the necessary rights to perform this operation'
          });
        }
      }

      // Pour tous les autres types de conversations (group, public, etc.),
      // n'importe qui ayant accès à la conversation peut créer des liens
      // L'utilisateur doit juste être membre de la conversation (déjà vérifié plus haut)

      // Générer le linkId initial
      const initialLinkId = generateInitialLinkId();

      // Générer un identifiant unique (basé sur le nom du lien, ou le titre, ou généré)
      let baseIdentifier: string;
      if (body.name) {
        baseIdentifier = `mshy_${body.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
      } else if (body.description) {
        // Utiliser la description comme base si pas de nom
        baseIdentifier = `mshy_${body.description.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 30)}`;
      } else {
        // Générer un identifiant unique si ni nom ni description
        const timestamp = Date.now().toString();
        const randomPart = Math.random().toString(36).substring(2, 8);
        baseIdentifier = `mshy_link-${timestamp}-${randomPart}`;
      }
      const uniqueIdentifier = await ensureUniqueShareLinkIdentifier(prisma, baseIdentifier);

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
          allowedIpRanges: body.allowedIpRanges ?? [],
          identifier: uniqueIdentifier
        }
      });

      // Mettre à jour avec le linkId final
      const finalLinkId = generateFinalLinkId(shareLink.id, initialLinkId);
      await prisma.conversationShareLink.update({
        where: { id: shareLink.id },
        data: { linkId: finalLinkId }
      });

      // Retour compatible avec le frontend de service conversations (string du lien complet)
      const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3100'}/join/${finalLinkId}`;
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

      // Vérifier que l'utilisateur est membre de la conversation
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId,
          userId,
          isActive: true
        }
      });

      if (!membership) {
        return reply.status(403).send({
          success: false,
          error: 'Vous devez être membre de cette conversation pour voir ses liens de partage'
        });
      }

      // Vérifier si l'utilisateur est modérateur/admin de la conversation
      const isModerator = ['CREATOR', 'ADMIN', 'MODERATOR'].includes(membership.role as string);

      // Filtrer les liens selon les droits:
      // - Modérateurs: voient TOUS les liens
      // - Membres normaux: voient uniquement leurs propres liens
      const links = await prisma.conversationShareLink.findMany({
        where: {
          conversationId,
          ...(isModerator ? {} : { creatorId: userId }) // Si pas modérateur, filtrer par créateur
        },
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

      return reply.send({
        success: true,
        data: links,
        isModerator // Indiquer au frontend si l'utilisateur peut gérer les liens
      });
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

  // Route pour inviter un utilisateur à une conversation
  fastify.post('/conversations/:id/invite', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = (request as any).authContext;
      if (!authContext || !authContext.isAuthenticated || !authContext.registeredUser) {
        return reply.status(401).send({
          success: false,
          error: 'Utilisateur non authentifié'
        });
      }

      const { id: conversationId } = request.params as { id: string };
      const { userId } = request.body as { userId: string };
      const inviterId = authContext.userId;

      // Vérifier que la conversation existe
      const conversation = await fastify.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          members: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
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
          error: 'Conversation non trouvée'
        });
      }

      // Vérifier que l'inviteur est membre de la conversation
      const inviterMember = conversation.members.find(m => m.userId === inviterId);
      if (!inviterMember) {
        return reply.status(403).send({
          success: false,
          error: 'Vous n\'êtes pas membre de cette conversation'
        });
      }

      // Vérifier que l'inviteur a les permissions pour inviter
      const canInvite = 
        inviterMember.role === 'ADMIN' ||
        inviterMember.role === 'CREATOR' ||
        authContext.registeredUser.role === 'ADMIN' ||
        authContext.registeredUser.role === 'BIGBOSS';

      if (!canInvite) {
        return reply.status(403).send({
          success: false,
          error: 'Vous n\'avez pas les permissions pour inviter des utilisateurs'
        });
      }

      // Vérifier que l'utilisateur à inviter existe
      const userToInvite = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          firstName: true,
          lastName: true
        }
      });

      if (!userToInvite) {
        return reply.status(404).send({
          success: false,
          error: 'Utilisateur non trouvé'
        });
      }

      // Vérifier que l'utilisateur n'est pas déjà membre
      const existingMember = conversation.members.find(m => m.userId === userId);
      if (existingMember) {
        return reply.status(400).send({
          success: false,
          error: 'Cet utilisateur est déjà membre de la conversation'
        });
      }

      // Ajouter l'utilisateur à la conversation
      const newMember = await fastify.prisma.conversationMember.create({
        data: {
          conversationId: conversationId,
          userId: userId,
          role: 'MEMBER',
          joinedAt: new Date(),
          isActive: true
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatar: true,
              isOnline: true
            }
          }
        }
      });

      return reply.send({
        success: true,
        data: newMember,
        message: `${userToInvite.displayName || userToInvite.username} a été invité à la conversation`
      });

    } catch (error) {
      console.error('Erreur lors de l\'invitation:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  });


}
