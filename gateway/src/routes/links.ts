import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logError } from '../utils/logger';
import { UserRoleEnum } from '@shared/types';

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
  allowedIpRanges: z.array(z.string()).optional()
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
  // Créer un lien (avec ou sans conversation)
  fastify.post('/links', { onRequest: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createLinkSchema.parse(request.body);
      const { userId } = request.user as any;

      let conversationId = body.conversationId;

      if (conversationId) {
        // Vérifier que l'utilisateur est admin/modo de la conversation
        const member = await fastify.prisma.conversationMember.findFirst({
          where: { conversationId, userId, isActive: true }
        });

        if (!member) {
          return reply.status(403).send({ success: false, message: "Vous n'êtes pas membre de cette conversation" });
        }

        if (member.role !== UserRoleEnum.ADMIN && member.role !== UserRoleEnum.MODERATOR) {
          return reply.status(403).send({ success: false, message: 'Seuls les administrateurs et modérateurs peuvent créer des liens' });
        }
      } else {
        // Créer la conversation de type public
        const conversation = await fastify.prisma.conversation.create({
          data: {
            type: 'public',
            title: body.name || 'Conversation partagée',
            description: body.description,
            members: { create: [{ userId, role: UserRoleEnum.ADMIN }] }
          }
        });
        conversationId = conversation.id;
      }

      // Générer un linkId avec le format link_<yymmddhhm>_<random>
      // Fonction utilitaire pour générer le linkId avec le format link_<conversationShareLink.Id>_yymmddhhm
      function generateLinkId(): string {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hour = now.getHours().toString().padStart(2, '0');
        const minute = now.getMinutes().toString().padStart(2, '0');
        
        const timestamp = `${year}${month}${day}${hour}${minute}`;
        const randomSuffix = Math.random().toString(36).slice(2, 10);
        
        return `link_${timestamp}_${randomSuffix}`;
      }

      const linkId = generateLinkId();

      await fastify.prisma.conversationShareLink.create({
        data: {
          linkId,
          conversationId: conversationId!,
          createdBy: userId,
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

      return reply.status(201).send({
        link: { token: linkId, expiresAt: body.expiresAt || null },
        conversationId
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, message: 'Données invalides', errors: error.errors });
      }
      logError(fastify.log, 'Create link error:', error);
      return reply.status(500).send({ success: false, message: 'Erreur interne du serveur' });
    }
  });

  // Récupérer les informations d'un lien
  fastify.get('/links/:linkId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };

      const shareLink = await fastify.prisma.conversationShareLink.findUnique({
        where: { linkId },
        include: {
          conversation: {
            select: {
              id: true,
              type: true,
              title: true,
              description: true,
              members: {
                select: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
                take: 5
              }
            }
          },
          creator: { select: { id: true, username: true, firstName: true, lastName: true, displayName: true, avatar: true } }
        }
      });

      if (!shareLink) {
        return reply.status(404).send({ success: false, message: 'Lien non trouvé' });
      }

      // Vérifier si le lien est expiré
      if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
        return reply.status(410).send({ success: false, message: 'Ce lien a expiré' });
      }

      // Vérifier le nombre d'utilisations
      if (shareLink.maxUses && shareLink.currentUses >= shareLink.maxUses) {
        return reply.status(410).send({ success: false, message: 'Ce lien a atteint sa limite d\'utilisations' });
      }

      return reply.send({
        success: true,
        data: {
          link: shareLink,
          inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3100'}/join/${linkId}`
        }
      });
    } catch (error) {
      logError(fastify.log, 'Get link error:', error);
      return reply.status(500).send({ success: false, message: 'Erreur interne du serveur' });
    }
  });

  // Charger les messages d'un lien partagé
  fastify.get('/links/:linkId/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const { limit = 50, offset = 0 } = request.query as { limit?: string; offset?: string };
      const sessionToken = request.headers['x-session-token'] as string;

      // Vérifier que le lien existe
      const shareLink = await fastify.prisma.conversationShareLink.findUnique({
        where: { linkId },
        include: {
          conversation: {
            select: { id: true, title: true, type: true }
          }
        }
      });

      if (!shareLink) {
        return reply.status(404).send({ success: false, message: 'Lien non trouvé' });
      }

      // Vérifier si le lien est actif
      if (!shareLink.isActive) {
        return reply.status(410).send({ success: false, message: 'Ce lien n\'est plus actif' });
      }

      // Vérifier si le lien est expiré
      if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
        return reply.status(410).send({ success: false, message: 'Ce lien a expiré' });
      }

      // Si une session token est fournie, vérifier qu'elle est valide
      if (sessionToken) {
        const anonymousParticipant = await fastify.prisma.anonymousParticipant.findFirst({
          where: { sessionToken, isActive: true }
        });

        if (!anonymousParticipant) {
          return reply.status(401).send({ success: false, message: 'Session invalide' });
        }
      } else {
        // Si pas de session token, vérifier si le lien permet l'accès sans authentification
        if (shareLink.requireEmail || shareLink.requireNickname) {
          return reply.status(401).send({ success: false, message: 'Session requise pour accéder aux messages' });
        }
      }

      // Charger les messages avec les informations des expéditeurs
      const messages = await fastify.prisma.message.findMany({
        where: { conversationId: shareLink.conversationId },
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
              nickname: true,
              firstName: true,
              lastName: true,
              language: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit.toString()),
        skip: parseInt(offset.toString())
      });

      // Compter le total de messages
      const totalMessages = await fastify.prisma.message.count({
        where: { conversationId: shareLink.conversationId }
      });

      return reply.send({
        success: true,
        data: {
          messages: messages.reverse(), // Remettre dans l'ordre chronologique
          conversation: shareLink.conversation,
          hasMore: totalMessages > parseInt(offset.toString()) + messages.length,
          total: totalMessages
        }
      });
    } catch (error) {
      logError(fastify.log, 'Get link messages error:', error);
      return reply.status(500).send({ success: false, message: 'Erreur interne du serveur' });
    }
  });

  // Envoyer un message via un lien partagé
  fastify.post('/links/:linkId/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const body = sendMessageSchema.parse(request.body);

      // Vérifier que le lien existe et est actif
      const shareLink = await fastify.prisma.conversationShareLink.findUnique({
        where: { linkId },
        include: {
          conversation: {
            select: { id: true, title: true, type: true }
          }
        }
      });

      if (!shareLink) {
        return reply.status(404).send({ success: false, message: 'Lien non trouvé' });
      }

      if (!shareLink.isActive) {
        return reply.status(410).send({ success: false, message: 'Ce lien n\'est plus actif' });
      }

      if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
        return reply.status(410).send({ success: false, message: 'Ce lien a expiré' });
      }

      // Vérifier que les messages anonymes sont autorisés
      if (!shareLink.allowAnonymousMessages) {
        return reply.status(403).send({ success: false, message: 'Les messages anonymes ne sont pas autorisés pour ce lien' });
      }

      // Vérifier la session anonyme via le header X-Session-Token
      const sessionToken = request.headers['x-session-token'] as string;
      
      if (!sessionToken) {
        return reply.status(401).send({ success: false, message: 'Session token requis' });
      }

      const anonymousParticipant = await fastify.prisma.anonymousParticipant.findFirst({
        where: { sessionToken, isActive: true }
      });

      if (!anonymousParticipant) {
        return reply.status(401).send({ success: false, message: 'Session invalide' });
      }

      // Créer le message
      const message = await fastify.prisma.message.create({
        data: {
          conversationId: shareLink.conversationId,
          senderId: anonymousParticipant.id,
          content: body.content,
          originalLanguage: body.originalLanguage,
          messageType: body.messageType,
          anonymousSenderId: anonymousParticipant.id
        },
        include: {
          anonymousSender: {
            select: {
              id: true,
              nickname: true,
              firstName: true,
              lastName: true,
              language: true
            }
          }
        }
      });

      // Émettre l'événement WebSocket pour les participants
      const socketManager = (fastify as any).socketManager;
      if (socketManager) {
        socketManager.emitToConversation(shareLink.conversationId, 'link:message:new', {
          message: {
            id: message.id,
            content: message.content,
            originalLanguage: message.originalLanguage,
            createdAt: message.createdAt,
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
            createdAt: message.createdAt,
            anonymousSender: message.anonymousSender
          }
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, message: 'Données invalides', errors: error.errors });
      }
      logError(fastify.log, 'Send link message error:', error);
      return reply.status(500).send({ success: false, message: 'Erreur interne du serveur' });
    }
  });

  // Mettre à jour un lien
  fastify.put('/links/:linkId', { onRequest: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const body = updateLinkSchema.parse(request.body);
      const { userId } = request.user as any;

      // Vérifier que le lien existe
      const shareLink = await fastify.prisma.conversationShareLink.findUnique({
        where: { linkId },
        include: {
          conversation: {
            select: { id: true }
          }
        }
      });

      if (!shareLink) {
        return reply.status(404).send({ success: false, message: 'Lien non trouvé' });
      }

      // Vérifier les permissions
      const member = await fastify.prisma.conversationMember.findFirst({
        where: { conversationId: shareLink.conversationId, userId, isActive: true }
      });

      if (!member) {
        return reply.status(403).send({ success: false, message: "Vous n'êtes pas membre de cette conversation" });
      }

      if (member.role !== UserRoleEnum.ADMIN && member.role !== UserRoleEnum.MODERATOR) {
        return reply.status(403).send({ success: false, message: 'Seuls les administrateurs et modérateurs peuvent modifier des liens' });
      }

      // Mettre à jour le lien
      const updatedLink = await fastify.prisma.conversationShareLink.update({
        where: { linkId },
        data: {
          name: body.name,
          description: body.description,
          maxUses: body.maxUses,
          maxConcurrentUsers: body.maxConcurrentUsers,
          maxUniqueSessions: body.maxUniqueSessions,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : body.expiresAt,
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
        data: { link: updatedLink }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, message: 'Données invalides', errors: error.errors });
      }
      logError(fastify.log, 'Update link error:', error);
      return reply.status(500).send({ success: false, message: 'Erreur interne du serveur' });
    }
  });

    // Supprimer un lien
  fastify.delete('/links/:linkId', { onRequest: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const { userId } = request.user as any;

      // Vérifier que le lien existe
      const shareLink = await fastify.prisma.conversationShareLink.findUnique({
        where: { linkId },
        include: {
          conversation: {
            select: { id: true }
          }
        }
      });

      if (!shareLink) {
        return reply.status(404).send({ success: false, message: 'Lien non trouvé' });
      }

      // Vérifier les permissions
      const member = await fastify.prisma.conversationMember.findFirst({
        where: { conversationId: shareLink.conversationId, userId, isActive: true }
      });

      if (!member) {
        return reply.status(403).send({ success: false, message: "Vous n'êtes pas membre de cette conversation" });
      }

      if (member.role !== UserRoleEnum.ADMIN && member.role !== UserRoleEnum.MODERATOR) {
        return reply.status(403).send({ success: false, message: 'Seuls les administrateurs et modérateurs peuvent supprimer des liens' });
      }

      // Supprimer le lien
      await fastify.prisma.conversationShareLink.delete({
        where: { linkId }
      });

      return reply.send({
        success: true,
        message: 'Lien supprimé avec succès'
      });
    } catch (error) {
      logError(fastify.log, 'Delete link error:', error);
      return reply.status(500).send({ success: false, message: 'Erreur interne du serveur' });
    }
  });

  // Récupérer les données complètes d'une conversation via un lien de partage
  // Inclut : messages, stats, membres anonymes et utilisateurs inscrits
  fastify.get('/links/:linkId/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const { limit = 50, offset = 0 } = request.query as { limit?: string; offset?: string };
      const sessionToken = request.headers['x-session-token'] as string;
      const authToken = request.headers.authorization?.replace('Bearer ', '');

      // Vérifier que le lien existe et est valide
      const shareLink = await fastify.prisma.conversationShareLink.findUnique({
        where: { linkId },
        include: {
          conversation: {
            select: {
              id: true,
              title: true,
              description: true,
              type: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });

      if (!shareLink) {
        return reply.status(404).send({ 
          success: false, 
          message: 'Lien de conversation introuvable' 
        });
      }

      if (!shareLink.isActive) {
        return reply.status(410).send({ 
          success: false, 
          message: 'Ce lien n\'est plus actif' 
        });
      }

      if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
        return reply.status(410).send({ 
          success: false, 
          message: 'Ce lien a expiré' 
        });
      }

      // Vérifier l'authentification (session anonyme ou token d'auth)
      let participant = null;
      let user = null;

      if (sessionToken) {
        // Session anonyme
        participant = await fastify.prisma.anonymousParticipant.findUnique({
          where: { sessionToken },
          include: {
            shareLink: {
              select: { linkId: true }
            }
          }
        });

        if (!participant || !participant.isActive) {
          return reply.status(401).send({ 
            success: false, 
            message: 'Session anonyme invalide ou expirée' 
          });
        }

        // Vérifier que la session correspond au bon lien
        if (participant.shareLink.linkId !== linkId) {
          return reply.status(403).send({ 
            success: false, 
            message: 'Accès non autorisé à cette conversation' 
          });
        }
      } else if (authToken) {
        // Token d'authentification normale
        try {
          const jwtSecret = process.env.JWT_SECRET || 'default-secret';
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(authToken, jwtSecret) as any;
          
          user = await fastify.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              systemLanguage: true
            }
          });

          if (!user) {
            return reply.status(401).send({ 
              success: false, 
              message: 'Utilisateur non trouvé' 
            });
          }

          // Vérifier que l'utilisateur est membre de la conversation
          const membership = await fastify.prisma.conversationMember.findFirst({
            where: {
              conversationId: shareLink.conversationId,
              userId: user.id,
              isActive: true
            }
          });

          if (!membership) {
            return reply.status(403).send({ 
              success: false, 
              message: 'Vous n\'êtes pas membre de cette conversation' 
            });
          }
        } catch (error) {
          return reply.status(401).send({ 
            success: false, 
            message: 'Token d\'authentification invalide' 
          });
        }
      } else {
        return reply.status(401).send({ 
          success: false, 
          message: 'Authentification requise' 
        });
      }

      // Récupérer les messages de la conversation
      const messagesLimit = Math.min(parseInt(limit as string) || 50, 100);
      const messagesOffset = parseInt(offset as string) || 0;

      const messages = await fastify.prisma.message.findMany({
        where: {
          conversationId: shareLink.conversationId,
          isDeleted: false
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true
            }
          },
          anonymousSender: {
            select: {
              id: true,
              nickname: true,
              firstName: true,
              lastName: true
            }
          },
          translations: {
            where: {
              targetLanguage: participant?.language || user?.systemLanguage || 'fr'
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: messagesOffset,
        take: messagesLimit
      });

      // Récupérer les statistiques de la conversation
      const stats = await fastify.prisma.$transaction([
        // Nombre total de messages
        fastify.prisma.message.count({
          where: {
            conversationId: shareLink.conversationId,
            isDeleted: false
          }
        }),
        // Nombre de membres inscrits
        fastify.prisma.conversationMember.count({
          where: {
            conversationId: shareLink.conversationId,
            isActive: true
          }
        }),
        // Nombre de participants anonymes actifs
        fastify.prisma.anonymousParticipant.count({
          where: {
            shareLinkId: shareLink.id,
            isActive: true
          }
        }),
        // Nombre de participants anonymes en ligne
        fastify.prisma.anonymousParticipant.count({
          where: {
            shareLinkId: shareLink.id,
            isActive: true,
            isOnline: true
          }
        })
      ]);

      // Récupérer les membres inscrits
      const members = await fastify.prisma.conversationMember.findMany({
        where: {
          conversationId: shareLink.conversationId,
          isActive: true
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              isOnline: true,
              lastSeen: true
            }
          }
        },
        orderBy: { joinedAt: 'asc' }
      });

      // Récupérer les participants anonymes actifs
      const anonymousParticipants = await fastify.prisma.anonymousParticipant.findMany({
        where: {
          shareLinkId: shareLink.id,
          isActive: true
        },
        select: {
          id: true,
          nickname: true,
          firstName: true,
          lastName: true,
          language: true,
          isOnline: true,
          lastActiveAt: true,
          joinedAt: true,
          canSendMessages: true,
          canSendFiles: true,
          canSendImages: true
        },
        orderBy: { joinedAt: 'asc' }
      });

      return reply.send({
        success: true,
        data: {
          conversation: shareLink.conversation,
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
            expiresAt: shareLink.expiresAt,
            isActive: shareLink.isActive
          },
          messages: messages.reverse(), // Inverser pour avoir l'ordre chronologique
          stats: {
            totalMessages: stats[0],
            totalMembers: stats[1],
            totalAnonymousParticipants: stats[2],
            onlineAnonymousParticipants: stats[3],
            hasMore: messages.length === messagesLimit
          },
          members: members.map(member => ({
            id: member.id,
            role: member.role,
            joinedAt: member.joinedAt,
            user: member.user
          })),
          anonymousParticipants: anonymousParticipants,
          currentUser: participant ? {
            id: participant.id,
            type: 'anonymous',
            nickname: participant.nickname,
            firstName: participant.firstName,
            lastName: participant.lastName,
            language: participant.language,
            permissions: {
              canSendMessages: participant.canSendMessages,
              canSendFiles: participant.canSendFiles,
              canSendImages: participant.canSendImages
            }
          } : {
            id: user!.id,
            type: 'authenticated',
            username: user!.username,
            firstName: user!.firstName,
            lastName: user!.lastName,
            displayName: user!.displayName,
            language: user!.systemLanguage
          }
        }
      });

    } catch (error) {
      logError(fastify.log, 'Get link conversation error:', error);
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur interne du serveur' 
      });
    }
  });
}


