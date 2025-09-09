import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logError } from '../utils/logger';
import { UserRoleEnum } from '../../shared/types';
import { 
  createUnifiedAuthMiddleware,
  UnifiedAuthRequest,
  isRegisteredUser,
  getUserPermissions
} from '../middleware/auth';

// Schémas de validation
const createLinkSchema = z.object({
  conversationId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  maxUses: z.number().int().positive().optional(),
  maxConcurrentUsers: z.number().int().positive().optional(),
  maxUniqueSessions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  allowAnonymousMessages: z.boolean().optional(),
  allowAnonymousFiles: z.boolean().optional(),
  allowAnonymousImages: z.boolean().optional(),
  allowViewHistory: z.boolean().optional(),
  requireNickname: z.boolean().optional(),
  requireEmail: z.boolean().optional(),
  allowedCountries: z.array(z.string()).optional(),
  allowedLanguages: z.array(z.string()).optional(),
  allowedIpRanges: z.array(z.string()).optional(),
  // Nouveau: données pour créer une nouvelle conversation
  newConversation: z.object({
    title: z.string().min(1, 'Le titre de la conversation est requis'),
    description: z.string().optional(),
    memberIds: z.array(z.string()).optional()
  }).optional()
});

const updateLinkSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  maxConcurrentUsers: z.number().int().positive().nullable().optional(),
  maxUniqueSessions: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  allowAnonymousMessages: z.boolean().optional(),
  allowAnonymousFiles: z.boolean().optional(),
  allowAnonymousImages: z.boolean().optional(),
  allowViewHistory: z.boolean().optional(),
  requireNickname: z.boolean().optional(),
  requireEmail: z.boolean().optional(),
  allowedCountries: z.array(z.string()).optional(),
  allowedLanguages: z.array(z.string()).optional(),
  allowedIpRanges: z.array(z.string()).optional()
});

// Schéma pour l'envoi de messages via lien
const sendMessageSchema = z.object({
  content: z.string().min(1, 'Le message ne peut pas être vide').max(1000, 'Le message est trop long'),
  originalLanguage: z.string().default('fr'),
  messageType: z.string().default('text')
});

export async function linksRoutes(fastify: FastifyInstance) {
  // Middlewares d'authentification unifiés
  const authOptional = createUnifiedAuthMiddleware(fastify.prisma, { 
    requireAuth: false, 
    allowAnonymous: true 
  });
  const authRequired = createUnifiedAuthMiddleware(fastify.prisma, { 
    requireAuth: true, 
    allowAnonymous: false 
  });

  /**
   * Adapte le nouveau contexte d'authentification unifié au format legacy
   */
  function createLegacyHybridRequest(request: UnifiedAuthRequest): any {
    const authContext = request.authContext;
    
    if (isRegisteredUser(authContext)) {
      return {
        isAuthenticated: true,
        isAnonymous: false,
        user: authContext.registeredUser,
        anonymousParticipant: null
      };
    } else if (authContext.type === 'session' && authContext.anonymousUser) {
      // Pour les utilisateurs anonymes, nous devons simuler l'ancienne structure
      return {
        isAuthenticated: true,
        isAnonymous: true,
        user: null,
        anonymousParticipant: {
          id: authContext.anonymousUser.sessionToken,
          username: authContext.anonymousUser.username,
          firstName: authContext.anonymousUser.firstName,
          lastName: authContext.anonymousUser.lastName,
          language: authContext.anonymousUser.language,
          shareLinkId: authContext.anonymousUser.shareLinkId,
          canSendMessages: authContext.anonymousUser.permissions.canSendMessages,
          canSendFiles: authContext.anonymousUser.permissions.canSendFiles,
          canSendImages: authContext.anonymousUser.permissions.canSendImages
        }
      };
    } else {
      return {
        isAuthenticated: false,
        isAnonymous: false,
        user: null,
        anonymousParticipant: null
      };
    }
  }

  /**
   * Résout l'ID de ConversationShareLink réel à partir d'un identifiant (peut être un ObjectID ou un identifier)
   */
  async function resolveShareLinkId(identifier: string): Promise<string | null> {
    // Si c'est déjà un ObjectID valide (24 caractères hexadécimaux), le retourner directement
    if (/^[0-9a-fA-F]{24}$/.test(identifier)) {
      return identifier;
    }
    
    // Sinon, chercher par le champ identifier
    const shareLink = await fastify.prisma.conversationShareLink.findFirst({
      where: { identifier: identifier }
    });
    
    return shareLink ? shareLink.id : null;
  }

  // Fonction utilitaire pour générer le linkId avec le format demandé
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
    
    // Si pas de titre ou titre vide après sanitisation, utiliser un ID unique
    const uniqueId = Math.random().toString(36).slice(2, 10);
    return `mshy_${uniqueId}-${timestamp}`;
  }

  function generateFinalLinkId(conversationShareLinkId: string, initialId: string): string {
    return `mshy_${conversationShareLinkId}.${initialId}`;
  }

  // 1. Créer un lien - Les utilisateurs authentifiés peuvent créer des liens pour leurs conversations
  fastify.post('/links', { 
    onRequest: [authRequired] 
  }, async (request: UnifiedAuthRequest, reply: FastifyReply) => {
    try {
      const body = createLinkSchema.parse(request.body);
      
      if (!isRegisteredUser(request.authContext)) {
        return reply.status(403).send({
          error: 'Utilisateur enregistré requis pour créer un lien'
        });
      }
      
      const user = request.authContext.registeredUser!;
      const userId = user.id;
      const userRole = user.role;

      console.log('[CREATE_LINK] Tentative création lien:', {
        userId,
        userRole,
        body: {
          conversationId: body.conversationId,
          name: body.name,
          hasDescription: !!body.description
        }
      });

      let conversationId = body.conversationId;

      if (conversationId) {
        // Vérifier que l'utilisateur est membre de la conversation
        // Support pour les conversations avec identifiants (comme "meeshy")
        let member;
        
        if (conversationId === "meeshy") {
          // Pour la conversation globale "meeshy", chercher par identifiant
          const globalConversation = await fastify.prisma.conversation.findFirst({
            where: { identifier: "meeshy" }
          });
          
          if (globalConversation) {
            member = await fastify.prisma.conversationMember.findFirst({
              where: { 
                conversationId: globalConversation.id, 
                userId, 
                isActive: true 
              }
            });
          }
        } else {
          // Pour les autres conversations, chercher directement par ID
          member = await fastify.prisma.conversationMember.findFirst({
            where: { conversationId, userId, isActive: true }
          });
        }

        if (!member) {
          console.log('[CREATE_LINK] Utilisateur non membre de la conversation:', { userId, conversationId });
          return reply.status(403).send({ 
            success: false, 
            message: "Vous n'êtes pas membre de cette conversation" 
          });
        }

        // Récupérer les informations de la conversation pour vérifier le type
        const conversation = await fastify.prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { id: true, type: true, title: true }
        });

        if (!conversation) {
          return reply.status(404).send({
            success: false,
            message: 'Conversation non trouvée'
          });
        }

        // Vérifier les permissions selon le type de conversation
        const conversationType = conversation.type;

        // Interdire la création de liens pour les conversations directes
        if (conversationType === 'direct') {
          return reply.status(403).send({
            success: false,
            message: 'Cannot create share links for direct conversations'
          });
        }

        // Pour les conversations globales, seuls les BIGBOSS peuvent créer des liens
        if (conversationType === 'global') {
          if (userRole !== UserRoleEnum.BIGBOSS) {
            return reply.status(403).send({
              success: false,
              message: 'You must have BIGBOSS rights to create share links for global conversations'
            });
          }
        }

        // Pour tous les autres types de conversations (group, public, etc.),
        // n'importe qui ayant accès à la conversation peut créer des liens
        console.log('[CREATE_LINK] Utilisateur autorisé à créer un lien:', { 
          userId, 
          conversationId, 
          conversationType,
          memberRole: member.role 
        });
      } else if (body.newConversation) {
        // Créer une nouvelle conversation avec les données fournies
        console.log('[CREATE_LINK] Création nouvelle conversation avec données:', { 
          userId, 
          userRole,
          newConversation: body.newConversation
        });
        
        // Préparer les membres (créateur + membres ajoutés)
        const membersToCreate = [
          { userId, role: UserRoleEnum.CREATOR }
        ];
        
        // Ajouter les membres spécifiés (sans doublons et sans le créateur)
        if (body.newConversation.memberIds && body.newConversation.memberIds.length > 0) {
          // Filtrer les doublons et exclure le créateur
          const uniqueMemberIds = [...new Set(body.newConversation.memberIds)].filter(id => id !== userId);
          
          for (const memberId of uniqueMemberIds) {
            // Vérifier que l'utilisateur existe
            const userExists = await fastify.prisma.user.findUnique({
              where: { id: memberId }
            });
            
            if (userExists) {
              membersToCreate.push({
                userId: memberId,
                role: UserRoleEnum.MEMBER
              });
            }
          }
        }
        
        // Générer un identifiant unique pour la conversation
        const conversationIdentifier = generateConversationIdentifier(body.newConversation.title);
        
        const conversation = await fastify.prisma.conversation.create({
          data: {
            identifier: conversationIdentifier,
            type: 'public',
            title: body.newConversation.title,
            description: body.newConversation.description || null,
            members: { 
              create: membersToCreate
            }
          }
        });
        conversationId = conversation.id;
        
        console.log('[CREATE_LINK] Nouvelle conversation créée:', { 
          conversationId, 
          title: conversation.title,
          membersCount: membersToCreate.length,
          creatorRole: UserRoleEnum.CREATOR 
        });
      } else {
        // Créer une nouvelle conversation de type public (legacy)
        console.log('[CREATE_LINK] Création nouvelle conversation legacy pour utilisateur:', { userId, userRole });
        
        // Générer un identifiant unique pour la conversation
        const conversationIdentifier = generateConversationIdentifier(body.name || 'Shared Conversation');
        
        const conversation = await fastify.prisma.conversation.create({
          data: {
            identifier: conversationIdentifier,
            type: 'public',
            title: body.name || 'Conversation partagée',
            description: body.description,
            members: { 
              create: [{ 
                userId, 
                role: UserRoleEnum.CREATOR 
              }] 
            }
          }
        });
        conversationId = conversation.id;
        
        console.log('[CREATE_LINK] Nouvelle conversation créée:', { 
          conversationId, 
          title: conversation.title,
          creatorRole: UserRoleEnum.CREATOR 
        });
      }

      // Générer le linkId initial
      const initialLinkId = generateInitialLinkId();

      // Créer le lien de partage
      const shareLink = await fastify.prisma.conversationShareLink.create({
        data: {
          linkId: initialLinkId, // Temporaire
          conversationId: conversationId!,
          createdBy: userId,
          name: body.name,
          description: body.description,
          maxUses: body.maxUses,
          maxConcurrentUsers: body.maxConcurrentUsers,
          maxUniqueSessions: body.maxUniqueSessions,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
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
      await fastify.prisma.conversationShareLink.update({
        where: { id: shareLink.id },
        data: { linkId: finalLinkId }
      });

      return reply.status(201).send({
        success: true,
        data: {
          linkId: finalLinkId,
          conversationId,
          shareLink: {
            id: shareLink.id,
            linkId: finalLinkId,
            name: shareLink.name,
            description: shareLink.description,
            expiresAt: shareLink.expiresAt,
            isActive: shareLink.isActive
          }
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          success: false, 
          message: 'Données invalides', 
          errors: error.errors 
        });
      }
      logError(fastify.log, 'Create link error:', error);
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur interne du serveur' 
      });
    }
  });

  // 2. Récupérer les informations d'un lien par linkId ou conversationShareLinkId
  // Vérification accessToken ou sessionToken requise
  fastify.get('/links/:identifier', { 
    onRequest: [authOptional] 
  }, async (request: UnifiedAuthRequest, reply: FastifyReply) => {
    try {
      const { identifier } = request.params as { identifier: string };
      
      // Créer un objet compatible avec l'ancien système
      const hybridRequest = createLegacyHybridRequest(request);

      // Détecter le type d'identifiant
      const isLinkId = identifier.startsWith('mshy_');
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier); // ObjectId MongoDB
      
      let shareLink;
      
      if (isLinkId) {
        // Rechercher par linkId
        shareLink = await fastify.prisma.conversationShareLink.findUnique({
          where: { linkId: identifier },
        include: {
          conversation: {
            select: {
              id: true,
              identifier: true, // Ajouter l'identifiant pour la vérification Meeshy
              title: true,
              description: true,
              type: true,
              createdAt: true,
              // Inclure les membres de la conversation
              members: {
                where: { isActive: true },
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      firstName: true,
                      lastName: true,
                      displayName: true,
                      avatar: true,
                      systemLanguage: true
                    }
                  }
                }
              },
              // Inclure les participants anonymes
              anonymousParticipants: {
                where: { isActive: true },
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  language: true,
                  isOnline: true,
                  canSendMessages: true,
                  canSendFiles: true,
                  canSendImages: true,
                  joinedAt: true
                }
              }
            }
          },
          creator: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true
            }
          }
        }
      });
      } else if (isObjectId) {
        // Rechercher par conversationShareLinkId (ID de base de données)
        shareLink = await fastify.prisma.conversationShareLink.findUnique({
          where: { id: identifier },
          include: {
            conversation: {
              select: {
                id: true,
                identifier: true, // Ajouter l'identifiant pour la vérification Meeshy
                title: true,
                description: true,
                type: true,
                createdAt: true,
                // Inclure les membres de la conversation
                members: {
                  where: { isActive: true },
                  include: {
                    user: {
                      select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        displayName: true,
                        avatar: true,
                        systemLanguage: true
                      }
                    }
                  }
                },
                // Inclure les participants anonymes
                anonymousParticipants: {
                  where: { isActive: true },
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    language: true,
                    isOnline: true,
                    canSendMessages: true,
                    canSendFiles: true,
                    canSendImages: true,
                    joinedAt: true
                  }
                }
              }
            },
            creator: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                displayName: true
              }
            }
          }
        });
      } else {
        // Rechercher par identifier du ConversationShareLink
        shareLink = await fastify.prisma.conversationShareLink.findFirst({
          where: {
            identifier: identifier
          },
          include: {
            conversation: {
              select: {
                id: true,
                identifier: true,
                title: true,
                description: true,
                type: true,
                createdAt: true,
                // Inclure les membres de la conversation
                members: {
                  where: { isActive: true },
                  include: {
                    user: {
                      select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        displayName: true,
                        avatar: true,
                        systemLanguage: true
                      }
                    }
                  }
                },
                // Inclure les participants anonymes
                anonymousParticipants: {
                  where: { isActive: true },
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    language: true,
                    isOnline: true,
                    canSendMessages: true,
                    canSendFiles: true,
                    canSendImages: true,
                    joinedAt: true
                  }
                }
              }
            },
            creator: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                displayName: true
              }
            }
          }
        });
      }

      if (!shareLink) {
        return reply.status(404).send({ 
          success: false, 
          message: 'Lien de partage non trouvé' 
        });
      }

      // Vérifier les permissions d'accès
      let hasAccess = false;

      if (hybridRequest.isAuthenticated && hybridRequest.user) {
        // Utilisateur authentifié - vérifier s'il est membre de la conversation
        // Pour les conversations Meeshy, tous les utilisateurs connectés ont accès
        if (shareLink.conversation.identifier === "meeshy") {
          hasAccess = true; // Conversation globale accessible à tous les utilisateurs connectés
        } else {
          const isMember = shareLink.conversation.members.some(
            member => member.userId === hybridRequest.user.id && member.isActive
          );
          hasAccess = isMember;
        }
      } else if (hybridRequest.isAnonymous && hybridRequest.anonymousParticipant) {
        // Participant anonyme - vérifier s'il appartient à ce lien
        hasAccess = hybridRequest.anonymousParticipant.shareLinkId === shareLink.id;
      } else {
        // Accès public - vérifier que le lien est actif et permet la consultation
        hasAccess = shareLink.isActive && shareLink.allowViewHistory;
      }

      if (!hasAccess) {
        return reply.status(403).send({ 
          success: false, 
          message: 'Accès non autorisé à ce lien' 
        });
      }

      // Récupérer les paramètres de requête pour les messages
      const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };
      
      // Récupérer les messages avec pagination
      const messages = await fastify.prisma.message.findMany({
        where: { 
          conversationId: shareLink.conversationId,
          isDeleted: false
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              systemLanguage: true
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
              translatedContent: true
            }
          }
        }
      });

      // Compter le total de messages
      const totalMessages = await fastify.prisma.message.count({
        where: { 
          conversationId: shareLink.conversationId,
          isDeleted: false
        }
      });

      // Formater les messages avec unification sender/anonymousSender
      const formattedMessages = messages.map((message: any) => ({
        id: message.id,
        content: message.content,
        originalLanguage: message.originalLanguage,
        createdAt: message.createdAt,
        readStatus: message.readStatus || [],
        sender: message.sender ? {
          id: message.sender.id,
          username: message.sender.username,
          firstName: message.sender.firstName,
          lastName: message.sender.lastName,
          displayName: message.sender.displayName,
          avatar: message.sender.avatar,
          isMeeshyer: true
        } : {
          id: message.anonymousSender!.id,
          username: message.anonymousSender!.username,
          firstName: message.anonymousSender!.firstName,
          lastName: message.anonymousSender!.lastName,
          displayName: undefined,
          avatar: undefined,
          isMeeshyer: false
        },
        translations: message.translations || []
      }));

      // Déterminer le type d'utilisateur et les données de l'utilisateur actuel
      let userType: 'anonymous' | 'member';
      let currentUser: any = null;

      console.log('[LINKS_GET] Debug authentification:', {
        isAuthenticated: hybridRequest.isAuthenticated,
        hasUser: !!hybridRequest.user,
        isAnonymous: hybridRequest.isAnonymous,
        hasAnonymousParticipant: !!hybridRequest.anonymousParticipant,
        user: hybridRequest.user ? {
          id: hybridRequest.user.id,
          username: hybridRequest.user.username
        } : null,
        anonymousParticipant: hybridRequest.anonymousParticipant ? {
          id: hybridRequest.anonymousParticipant.id,
          username: hybridRequest.anonymousParticipant.username
        } : null
      });

      if (hybridRequest.isAuthenticated && hybridRequest.user) {
        const isMember = shareLink.conversation.members.some(
          member => member.userId === hybridRequest.user.id && member.isActive
        );
        userType = isMember ? 'member' : 'anonymous';
        currentUser = {
          id: hybridRequest.user.id,
          username: hybridRequest.user.username,
          firstName: hybridRequest.user.firstName,
          lastName: hybridRequest.user.lastName,
          displayName: hybridRequest.user.displayName,
          language: hybridRequest.user.systemLanguage,
          isMeeshyer: true,
          permissions: {
            canSendMessages: true,
            canSendFiles: true,
            canSendImages: true
          }
        };
        console.log('[LINKS_GET] Utilisateur authentifié défini:', currentUser);
      } else if (hybridRequest.isAnonymous && hybridRequest.anonymousParticipant) {
        userType = 'anonymous';
        const participant = hybridRequest.anonymousParticipant;
        currentUser = {
          id: participant.id,
          username: participant.username,
          firstName: participant.firstName,
          lastName: participant.lastName,
          displayName: undefined,
          language: participant.language,
          isMeeshyer: false,
          permissions: {
            canSendMessages: participant.canSendMessages,
            canSendFiles: participant.canSendFiles,
            canSendImages: participant.canSendImages
          }
        };
        console.log('[LINKS_GET] Participant anonyme défini:', currentUser);
      } else {
        console.log('[LINKS_GET] Aucune authentification détectée, currentUser reste null');
        // Pour les utilisateurs non authentifiés, on peut quand même retourner les informations de base
        // mais sans currentUser
      }

      // Calculer les statistiques
      const stats = {
        totalMessages,
        totalMembers: shareLink.conversation.members.length,
        totalAnonymousParticipants: shareLink.conversation.anonymousParticipants.length,
        onlineAnonymousParticipants: shareLink.conversation.anonymousParticipants.filter(p => p.isOnline).length,
        hasMore: totalMessages > parseInt(offset) + messages.length
      };

      // Retourner les données complètes dans le format attendu par LinkConversationService
      return reply.send({
        success: true,
        data: {
          conversation: {
            id: shareLink.conversation.id,
            title: shareLink.conversation.title,
            description: shareLink.conversation.description,
            type: shareLink.conversation.type,
            createdAt: shareLink.conversation.createdAt,
            updatedAt: shareLink.conversation.createdAt // Utiliser createdAt comme fallback
          },
          link: {
            id: shareLink.id,
            linkId: shareLink.linkId,
            name: shareLink.name,
            description: shareLink.description,
            allowViewHistory: shareLink.allowViewHistory,
            allowAnonymousMessages: shareLink.allowAnonymousMessages,
            allowAnonymousFiles: shareLink.allowAnonymousFiles,
            allowAnonymousImages: shareLink.allowAnonymousImages,
            requireEmail: shareLink.requireEmail,
            requireNickname: shareLink.requireNickname,
            expiresAt: shareLink.expiresAt?.toISOString() || null,
            isActive: shareLink.isActive
          },
          userType,
          // Ajouter redirectTo pour les utilisateurs membres
          ...(userType === 'member' && {
            redirectTo: `/conversations/${shareLink.conversationId}`
          }),
          messages: formattedMessages.reverse(),
          stats,
          members: shareLink.conversation.members.map(member => ({
            id: member.id,
            role: member.role,
            joinedAt: member.joinedAt,
            user: {
              id: member.user.id,
              username: member.user.username,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              displayName: member.user.displayName,
              avatar: member.user.avatar,
              isOnline: false, // TODO: Implémenter le statut en ligne
              lastSeen: member.joinedAt // Utiliser joinedAt comme fallback
            }
          })),
          anonymousParticipants: shareLink.conversation.anonymousParticipants.map(participant => ({
            id: participant.id,
            username: participant.username,
            firstName: participant.firstName,
            lastName: participant.lastName,
            language: participant.language,
            isOnline: participant.isOnline,
            lastActiveAt: participant.joinedAt, // Utiliser joinedAt comme fallback
            joinedAt: participant.joinedAt,
            canSendMessages: participant.canSendMessages,
            canSendFiles: participant.canSendFiles,
            canSendImages: participant.canSendImages
          })),
          currentUser
        }
      });

    } catch (error) {
      logError(fastify.log, 'Get link info error:', error);
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur interne du serveur' 
      });
    }
  });

  // 3. Récupérer les messages d'un lien (avec sender et senderAnonymous distincts)
  fastify.get('/links/:identifier/messages', { 
    onRequest: [authOptional] 
  }, async (request: UnifiedAuthRequest, reply: FastifyReply) => {
    try {
      const { identifier } = request.params as { identifier: string };
      const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };
      const hybridRequest = createLegacyHybridRequest(request);

      // Déterminer si l'identifiant est un linkId ou un conversationShareLinkId
      const isLinkId = identifier.startsWith('mshy_');
      
      // Récupérer le lien de partage
      let shareLink;
      if (isLinkId) {
        // C'est un linkId au format mshy_...
        shareLink = await fastify.prisma.conversationShareLink.findUnique({
          where: { linkId: identifier },
          include: {
            conversation: {
              select: { id: true, title: true, type: true }
            }
          }
        });
      } else {
        // C'est un conversationShareLinkId (ID de base)
        shareLink = await fastify.prisma.conversationShareLink.findUnique({
          where: { id: identifier },
          include: {
            conversation: {
              select: { id: true, title: true, type: true }
            }
          }
        });
      }

      if (!shareLink) {
        return reply.status(404).send({ 
          success: false, 
          message: 'Lien de partage non trouvé' 
        });
      }

      // Vérifier les permissions d'accès
      let hasAccess = false;

      if (hybridRequest.isAuthenticated && hybridRequest.user) {
        // Vérifier si l'utilisateur est membre de la conversation
        const member = await fastify.prisma.conversationMember.findFirst({
          where: { 
            conversationId: shareLink.conversationId, 
            userId: hybridRequest.user.id, 
            isActive: true 
          }
        });
        hasAccess = !!member;
      }

      if (hybridRequest.isAnonymous && hybridRequest.anonymousParticipant) {
        // Vérifier si le participant anonyme appartient à ce lien
        hasAccess = hybridRequest.anonymousParticipant.shareLinkId === shareLink.id;
      }

      if (!hasAccess) {
        return reply.status(403).send({ 
          success: false, 
          message: 'Accès non autorisé à cette conversation' 
        });
      }

      // Récupérer les messages avec pagination
      const messages = await fastify.prisma.message.findMany({
        where: { 
          conversationId: shareLink.conversationId,
          isDeleted: false
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              systemLanguage: true
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
          }
        }
      });

      // Compter le total de messages
      const totalMessages = await fastify.prisma.message.count({
        where: { 
          conversationId: shareLink.conversationId,
          isDeleted: false
        }
      });

      // Retourner les messages avec sender et senderAnonymous distincts (pas d'unification)
      const formattedMessages = messages.map(message => ({
        id: message.id,
        content: message.content,
        originalLanguage: message.originalLanguage,
        messageType: message.messageType,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
        isDeleted: message.isDeleted,
        deletedAt: message.deletedAt,
        replyToId: message.replyToId,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        readStatus: message.readStatus || [],
        // Retourner sender et senderAnonymous distinctement
        sender: message.sender ? {
          id: message.sender.id,
          username: message.sender.username,
          firstName: message.sender.firstName,
          lastName: message.sender.lastName,
          displayName: message.sender.displayName,
          avatar: message.sender.avatar,
          systemLanguage: message.sender.systemLanguage
        } : null,
        anonymousSender: message.anonymousSender ? {
          id: message.anonymousSender.id,
          username: message.anonymousSender.username,
          firstName: message.anonymousSender.firstName,
          lastName: message.anonymousSender.lastName,
          language: message.anonymousSender.language
        } : null
      }));

      return reply.send({
        success: true,
        data: {
          messages: formattedMessages.reverse(),
          conversation: shareLink.conversation,
          hasMore: totalMessages > parseInt(offset.toString()) + messages.length,
          total: totalMessages
        }
      });

    } catch (error) {
      logError(fastify.log, 'Get link messages error:', error);
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur interne du serveur' 
      });
    }
  });

  // 4. Envoyer un message via un lien partagé (sessionToken uniquement)
  fastify.post('/links/:identifier/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { identifier } = request.params as { identifier: string };
      const body = sendMessageSchema.parse(request.body);

      // Vérifier le sessionToken uniquement
      const sessionToken = request.headers['x-session-token'] as string;
      
      if (!sessionToken) {
        return reply.status(401).send({ 
          success: false, 
          message: 'Session token requis pour envoyer un message' 
        });
      }

      // Déterminer si l'identifiant est un linkId ou un conversationShareLinkId
      const isLinkId = identifier.startsWith('mshy_');
      
      // Récupérer le lien de partage
      let shareLink;
      if (isLinkId) {
        // C'est un linkId au format mshy_...
        shareLink = await fastify.prisma.conversationShareLink.findUnique({
          where: { linkId: identifier }
        });
      } else {
        // C'est un conversationShareLinkId (ID de base)
        shareLink = await fastify.prisma.conversationShareLink.findUnique({
          where: { id: identifier }
        });
      }

      if (!shareLink) {
        return reply.status(404).send({ 
          success: false, 
          message: 'Lien de partage non trouvé' 
        });
      }

      // Récupérer le participant anonyme
      const anonymousParticipant = await fastify.prisma.anonymousParticipant.findFirst({
        where: { 
          sessionToken, 
          isActive: true,
          shareLinkId: shareLink.id
        },
        include: {
          shareLink: {
            select: {
              id: true,
              conversationId: true,
              isActive: true,
              allowAnonymousMessages: true,
              expiresAt: true
            }
          }
        }
      });

      if (!anonymousParticipant) {
        return reply.status(401).send({ 
          success: false, 
          message: 'Session invalide ou non autorisée pour ce lien' 
        });
      }

      if (!anonymousParticipant.shareLink.isActive) {
        return reply.status(410).send({ 
          success: false, 
          message: 'Ce lien n\'est plus actif' 
        });
      }

      if (anonymousParticipant.shareLink.expiresAt && new Date() > anonymousParticipant.shareLink.expiresAt) {
        return reply.status(410).send({ 
          success: false, 
          message: 'Ce lien a expiré' 
        });
      }

      if (!anonymousParticipant.shareLink.allowAnonymousMessages) {
        return reply.status(403).send({ 
          success: false, 
          message: 'Les messages anonymes ne sont pas autorisés pour ce lien' 
        });
      }

      if (!anonymousParticipant.canSendMessages) {
        return reply.status(403).send({ 
          success: false, 
          message: 'Vous n\'êtes pas autorisé à envoyer des messages' 
        });
      }

      // Créer le message
      const message = await fastify.prisma.message.create({
        data: {
          conversationId: anonymousParticipant.shareLink.conversationId,
          senderId: null, // Pas de sender authentifié
          content: body.content,
          originalLanguage: body.originalLanguage,
          messageType: body.messageType,
          anonymousSenderId: anonymousParticipant.id
        },
        include: {
          anonymousSender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              language: true
            }
          }
        }
      });

      // Émettre l'événement WebSocket
      const socketManager = (fastify as any).socketManager;
      if (socketManager) {
        socketManager.emitToConversation(anonymousParticipant.shareLink.conversationId, 'link:message:new', {
          message: {
            id: message.id,
            content: message.content,
            originalLanguage: message.originalLanguage,
            messageType: message.messageType,
            isEdited: message.isEdited,
            editedAt: message.editedAt,
            isDeleted: message.isDeleted,
            deletedAt: message.deletedAt,
            replyToId: message.replyToId,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            sender: null,
            anonymousSender: message.anonymousSender
          }
        });
      }

      return reply.status(201).send({
        success: true,
        data: {
          messageId: message.id,
          message: {
            id: message.id,
            content: message.content,
            originalLanguage: message.originalLanguage,
            messageType: message.messageType,
            isEdited: message.isEdited,
            editedAt: message.editedAt,
            isDeleted: message.isDeleted,
            deletedAt: message.deletedAt,
            replyToId: message.replyToId,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            sender: null,
            anonymousSender: message.anonymousSender
          }
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          success: false, 
          message: 'Données invalides', 
          errors: error.errors 
        });
      }
      logError(fastify.log, 'Send link message error:', error);
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur interne du serveur' 
      });
    }
  });

  // 6. Envoyer un message via un lien partagé (utilisateurs authentifiés)
  fastify.post('/links/:identifier/messages/auth', { 
    onRequest: [authRequired] 
  }, async (request: UnifiedAuthRequest, reply: FastifyReply) => {
    try {
      const { identifier } = request.params as { identifier: string };
      const body = sendMessageSchema.parse(request.body);
      
      if (!isRegisteredUser(request.authContext)) {
        return reply.status(403).send({
          error: 'Utilisateur enregistré requis'
        });
      }
      
      const userId = request.authContext.registeredUser!.id;

      // Déterminer si l'identifiant est un linkId ou un conversationShareLinkId
      const isLinkId = identifier.startsWith('mshy_');
      
      // Récupérer le lien de partage
      let shareLink;
      if (isLinkId) {
        // C'est un linkId au format mshy_...
        shareLink = await fastify.prisma.conversationShareLink.findUnique({
          where: { linkId: identifier },
          include: {
            conversation: {
              select: {
                id: true,
                identifier: true, // Pour la vérification Meeshy
                title: true,
                type: true
              }
            }
          }
        });
      } else {
        // C'est un conversationShareLinkId (ID de base)
        shareLink = await fastify.prisma.conversationShareLink.findUnique({
          where: { id: identifier },
          include: {
            conversation: {
              select: {
                id: true,
                identifier: true, // Pour la vérification Meeshy
                title: true,
                type: true
              }
            }
          }
        });
      }

      if (!shareLink) {
        return reply.status(404).send({ 
          success: false, 
          message: 'Lien de partage non trouvé' 
        });
      }

      if (!shareLink.isActive) {
        return reply.status(410).send({ 
          success: false, 
          message: 'Ce lien n\'est plus actif' 
        });
      }

      if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
        return reply.status(410).send({ 
          success: false, 
          message: 'Ce lien a expiré' 
        });
      }

      // Vérifier que l'utilisateur est membre de la conversation
      let isMember = false;
      
      if (shareLink.conversation.identifier === "meeshy") {
        // Pour les conversations Meeshy, tous les utilisateurs connectés ont accès
        isMember = true;
      } else {
        // Pour les autres conversations, vérifier l'appartenance
        const member = await fastify.prisma.conversationMember.findFirst({
          where: {
            conversationId: shareLink.conversationId,
            userId: userId,
            isActive: true
          }
        });
        isMember = !!member;
      }

      if (!isMember) {
        return reply.status(403).send({ 
          success: false, 
          message: 'Vous n\'êtes pas membre de cette conversation' 
        });
      }

      // Créer le message
      const message = await fastify.prisma.message.create({
        data: {
          conversationId: shareLink.conversationId,
          senderId: userId, // Utilisateur authentifié
          content: body.content,
          originalLanguage: body.originalLanguage,
          messageType: body.messageType,
          anonymousSenderId: null // Pas de sender anonyme
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              systemLanguage: true
            }
          }
        }
      });

      // Émettre l'événement WebSocket
      const socketManager = (fastify as any).socketManager;
      if (socketManager) {
        socketManager.emitToConversation(shareLink.conversationId, 'link:message:new', {
          message: {
            id: message.id,
            content: message.content,
            originalLanguage: message.originalLanguage,
            messageType: message.messageType,
            isEdited: message.isEdited,
            editedAt: message.editedAt,
            isDeleted: message.isDeleted,
            deletedAt: message.deletedAt,
            replyToId: message.replyToId,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            sender: message.sender,
            anonymousSender: null
          }
        });
      }

      return reply.status(201).send({
        success: true,
        data: {
          messageId: message.id,
          message: {
            id: message.id,
            content: message.content,
            originalLanguage: message.originalLanguage,
            messageType: message.messageType,
            isEdited: message.isEdited,
            editedAt: message.editedAt,
            isDeleted: message.isDeleted,
            deletedAt: message.deletedAt,
            replyToId: message.replyToId,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            sender: message.sender,
            anonymousSender: null
          }
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          success: false, 
          message: 'Données invalides', 
          errors: error.errors 
        });
      }
      logError(fastify.log, 'Send authenticated link message error:', error);
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur interne du serveur' 
      });
    }
  });

  // 5. Mettre à jour un lien (seuls les admins de conversation ou créateur du lien)
  fastify.put('/links/:conversationShareLinkId', { 
    onRequest: [authRequired] 
  }, async (request: UnifiedAuthRequest, reply: FastifyReply) => {
    try {
      const { conversationShareLinkId } = request.params as { conversationShareLinkId: string };
      const body = updateLinkSchema.parse(request.body);
      
      if (!isRegisteredUser(request.authContext)) {
        return reply.status(403).send({
          error: 'Utilisateur enregistré requis'
        });
      }
      
      const userId = request.authContext.registeredUser!.id;

      // Récupérer le lien de partage
      const shareLink = await fastify.prisma.conversationShareLink.findUnique({
        where: { id: conversationShareLinkId },
        include: {
          conversation: {
            include: {
              members: {
                where: { userId, isActive: true }
              }
            }
          }
        }
      });

      if (!shareLink) {
        return reply.status(404).send({ 
          success: false, 
          message: 'Lien de partage non trouvé' 
        });
      }

      // Vérifier les permissions : créateur du lien OU administrateur de la conversation
      const isCreator = shareLink.createdBy === userId;
      const member = shareLink.conversation.members[0];
      const isConversationAdmin = member && (
        member.role === UserRoleEnum.ADMIN || 
        member.role === UserRoleEnum.CREATOR
      );

      if (!isCreator && !isConversationAdmin) {
        return reply.status(403).send({ 
          success: false, 
          message: 'Seuls les créateurs du lien ou les administrateurs de la conversation peuvent le modifier' 
        });
      }

      // Mettre à jour le lien
      const updatedLink = await fastify.prisma.conversationShareLink.update({
        where: { id: conversationShareLinkId },
        data: {
          name: body.name,
          description: body.description,
          maxUses: body.maxUses,
          maxConcurrentUsers: body.maxConcurrentUsers,
          maxUniqueSessions: body.maxUniqueSessions,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
          isActive: body.isActive,
          allowAnonymousMessages: body.allowAnonymousMessages,
          allowAnonymousFiles: body.allowAnonymousFiles,
          allowAnonymousImages: body.allowAnonymousImages,
          allowViewHistory: body.allowViewHistory,
          requireNickname: body.requireNickname,
          requireEmail: body.requireEmail,
          allowedCountries: body.allowedCountries,
          allowedLanguages: body.allowedLanguages,
          allowedIpRanges: body.allowedIpRanges
        }
      });

      return reply.send({
        success: true,
        data: {
          shareLink: updatedLink
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          success: false, 
          message: 'Données invalides', 
          errors: error.errors 
        });
      }
      logError(fastify.log, 'Update link error:', error);
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur interne du serveur' 
      });
    }
  });
}


