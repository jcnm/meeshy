import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logError } from '../utils/logger';

// Schéma pour valider les paramètres de la route chat
const chatParamsSchema = z.object({
  linkId: z.string().min(1, 'Link ID requis')
});

const sessionHeaderSchema = z.object({
  'x-session-token': z.string().min(1, 'Session token requis')
});

export async function chatAnonymousRoutes(fastify: FastifyInstance) {
  
  // Route pour accéder à la page de chat avec un lien anonyme
  fastify.get('/chat/:linkId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = chatParamsSchema.parse(request.params);
      
      // Vérifier que le lien existe et est valide
      const shareLink = await fastify.prisma.conversationShareLink.findUnique({
        where: { linkId },
        include: {
          conversation: {
            select: {
              id: true,
              title: true,
              description: true,
              type: true
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

      // Retourner les informations de base pour la page de chat
      return reply.send({
        success: true,
        data: {
          linkId: shareLink.linkId,
          conversationId: shareLink.conversationId,
          conversation: shareLink.conversation,
          allowViewHistory: shareLink.allowViewHistory,
          requiresSession: true
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: 'Paramètres invalides',
          errors: error.errors
        });
      }

      logError(fastify.log, 'Chat anonymous access error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Route pour obtenir les messages d'une conversation via un lien anonyme
  fastify.get('/chat/:linkId/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = chatParamsSchema.parse(request.params);
      const sessionToken = request.headers['x-session-token'] as string;

      if (!sessionToken) {
        return reply.status(401).send({
          success: false,
          message: 'Session token requis'
        });
      }

      // Vérifier la session anonyme
      const participant = await fastify.prisma.anonymousParticipant.findUnique({
        where: { sessionToken },
        include: {
          shareLink: {
            include: {
              conversation: {
                select: { id: true }
              }
            }
          }
        }
      });

      if (!participant || !participant.isActive) {
        return reply.status(401).send({
          success: false,
          message: 'Session invalide ou expirée'
        });
      }

      // Vérifier que le lien correspond
      if (participant.shareLink.linkId !== linkId) {
        return reply.status(403).send({
          success: false,
          message: 'Accès non autorisé à cette conversation'
        });
      }

      // Vérifier les droits de visualisation de l'historique
      if (!participant.shareLink.allowViewHistory) {
        return reply.send({
          success: true,
          data: {
            messages: [],
            hasMore: false,
            userLanguage: participant.language
          }
        });
      }

      // Récupérer les messages de la conversation
      const query = request.query as { limit?: string; offset?: string };
      const limit = parseInt(query?.limit || '50') || 50;
      const offset = parseInt(query?.offset || '0') || 0;

      const messages = await fastify.prisma.message.findMany({
        where: {
          conversationId: participant.shareLink.conversationId,
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
              targetLanguage: participant.language
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      });

      return reply.send({
        success: true,
        data: {
          messages: messages.reverse(), // Inverser pour avoir l'ordre chronologique
          hasMore: messages.length === limit,
          userLanguage: participant.language
        }
      });

    } catch (error) {
      logError(fastify.log, 'Chat anonymous messages error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Route pour envoyer un message via une session anonyme
  fastify.post('/chat/:linkId/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = chatParamsSchema.parse(request.params);
      const sessionToken = request.headers['x-session-token'] as string;
      const { content, originalLanguage, messageType = 'text' } = request.body as any;

      if (!sessionToken) {
        return reply.status(401).send({
          success: false,
          message: 'Session token requis'
        });
      }

      if (!content || content.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'Le contenu du message ne peut pas être vide'
        });
      }

      // Vérifier la session anonyme
      const participant = await fastify.prisma.anonymousParticipant.findUnique({
        where: { sessionToken },
        include: {
          shareLink: true
        }
      });

      if (!participant || !participant.isActive) {
        return reply.status(401).send({
          success: false,
          message: 'Session invalide ou expirée'
        });
      }

      // Vérifier que le lien correspond
      if (participant.shareLink.linkId !== linkId) {
        return reply.status(403).send({
          success: false,
          message: 'Accès non autorisé à cette conversation'
        });
      }

      // Vérifier les droits d'envoi de messages
      if (!participant.canSendMessages) {
        return reply.status(403).send({
          success: false,
          message: 'Vous n\'avez pas le droit d\'envoyer des messages'
        });
      }

      // Créer le message
      const message = await fastify.prisma.message.create({
        data: {
          conversationId: participant.shareLink.conversationId,
          anonymousSenderId: participant.id,
          content: content.trim(),
          originalLanguage: originalLanguage || participant.language,
          messageType: messageType
        },
        include: {
          anonymousSender: {
            select: {
              id: true,
              nickname: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Mettre à jour l'activité du participant
      await fastify.prisma.anonymousParticipant.update({
        where: { id: participant.id },
        data: {
          lastActiveAt: new Date(),
          lastSeenAt: new Date()
        }
      });

      return reply.status(201).send({
        success: true,
        data: {
          messageId: message.id,
          message: message
        }
      });

    } catch (error) {
      logError(fastify.log, 'Chat anonymous send message error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });
}
