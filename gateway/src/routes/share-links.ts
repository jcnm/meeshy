import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logError } from '../utils/logger';

// Schémas de validation
const createShareLinkSchema = z.object({
  conversationId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional()
});

export async function shareLinksRoutes(fastify: FastifyInstance) {
  // Créer un lien de partage pour une conversation
  fastify.post('/share-links', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createShareLinkSchema.parse(request.body);
      const { userId } = request.user as any;

      // Vérifier que l'utilisateur est membre de la conversation
      const member = await fastify.prisma.conversationMember.findFirst({
        where: {
          conversationId: body.conversationId,
          userId,
          isActive: true
        }
      });

      if (!member) {
        return reply.status(403).send({
          success: false,
          message: 'Vous n\'êtes pas membre de cette conversation'
        });
      }

      // Vérifier les permissions (admin ou moderator peuvent créer des liens)
      if (member.role !== 'admin' && member.role !== 'moderator') {
        return reply.status(403).send({
          success: false,
          message: 'Seuls les administrateurs et modérateurs peuvent créer des liens de partage'
        });
      }

      // Générer un ID de lien unique
      const linkId = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const shareLink = await fastify.prisma.conversationShareLink.create({
        data: {
          linkId,
          conversationId: body.conversationId,
          createdBy: userId,
          name: body.name,
          description: body.description,
          maxUses: body.maxUses,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined
        },
        include: {
          conversation: {
            select: {
              id: true,
              type: true,
              title: true,
              description: true
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

      return reply.status(201).send({
        success: true,
        data: shareLink
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      logError(fastify.log, 'Create share link error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Récupérer les informations d'un lien de partage
  fastify.get('/share-links/:linkId', async (request: FastifyRequest, reply: FastifyReply) => {
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
                select: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      avatar: true
                    }
                  }
                },
                take: 5 // Afficher seulement quelques membres
              }
            }
          },
          creator: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true
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

      // Vérifier si le lien est encore valide
      if (!shareLink.isActive) {
        return reply.status(410).send({
          success: false,
          message: 'Ce lien de partage n\'est plus actif'
        });
      }

      if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
        return reply.status(410).send({
          success: false,
          message: 'Ce lien de partage a expiré'
        });
      }

      if (shareLink.maxUses && shareLink.currentUses >= shareLink.maxUses) {
        return reply.status(410).send({
          success: false,
          message: 'Ce lien de partage a atteint sa limite d\'utilisation'
        });
      }

      return reply.send({
        success: true,
        data: shareLink
      });

    } catch (error) {
      logError(fastify.log, 'Get share link error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Rejoindre une conversation via un lien de partage
  fastify.post('/share-links/:linkId/join', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const { userId } = request.user as any;

      const shareLink = await fastify.prisma.conversationShareLink.findUnique({
        where: { linkId },
        include: {
          conversation: true
        }
      });

      if (!shareLink) {
        return reply.status(404).send({
          success: false,
          message: 'Lien de partage non trouvé'
        });
      }

      // Vérifications de validité
      if (!shareLink.isActive) {
        return reply.status(410).send({
          success: false,
          message: 'Ce lien de partage n\'est plus actif'
        });
      }

      if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
        return reply.status(410).send({
          success: false,
          message: 'Ce lien de partage a expiré'
        });
      }

      if (shareLink.maxUses && shareLink.currentUses >= shareLink.maxUses) {
        return reply.status(410).send({
          success: false,
          message: 'Ce lien de partage a atteint sa limite d\'utilisation'
        });
      }

      // Vérifier si l'utilisateur est déjà membre
      const existingMember = await fastify.prisma.conversationMember.findFirst({
        where: {
          conversationId: shareLink.conversationId,
          userId
        }
      });

      if (existingMember) {
        if (existingMember.isActive) {
          return reply.status(409).send({
            success: false,
            message: 'Vous êtes déjà membre de cette conversation'
          });
        } else {
          // Réactiver le membre
          await fastify.prisma.conversationMember.update({
            where: { id: existingMember.id },
            data: {
              isActive: true,
              joinedAt: new Date(),
              leftAt: null
            }
          });
        }
      } else {
        // Ajouter l'utilisateur à la conversation
        await fastify.prisma.conversationMember.create({
          data: {
            conversationId: shareLink.conversationId,
            userId,
            role: 'member'
          }
        });
      }

      // Incrémenter le compteur d'utilisations
      await fastify.prisma.conversationShareLink.update({
        where: { linkId },
        data: {
          currentUses: {
            increment: 1
          }
        }
      });

      // Récupérer la conversation mise à jour
      const conversation = await fastify.prisma.conversation.findUnique({
        where: { id: shareLink.conversationId },
        include: {
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
                  isOnline: true
                }
              }
            }
          }
        }
      });

      return reply.send({
        success: true,
        data: {
          conversation,
          message: 'Vous avez rejoint la conversation avec succès'
        }
      });

    } catch (error) {
      logError(fastify.log, 'Join via share link error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Récupérer les liens de partage créés par l'utilisateur
  fastify.get('/share-links', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user as any;

      const shareLinks = await fastify.prisma.conversationShareLink.findMany({
        where: { createdBy: userId },
        include: {
          conversation: {
            select: {
              id: true,
              type: true,
              title: true,
              description: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({
        success: true,
        data: shareLinks
      });

    } catch (error) {
      logError(fastify.log, 'Get user share links error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Désactiver un lien de partage
  fastify.patch('/share-links/:linkId/deactivate', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const { userId } = request.user as any;

      // Vérifier que l'utilisateur est le créateur du lien
      const shareLink = await fastify.prisma.conversationShareLink.findUnique({
        where: { linkId }
      });

      if (!shareLink) {
        return reply.status(404).send({
          success: false,
          message: 'Lien de partage non trouvé'
        });
      }

      if (shareLink.createdBy !== userId) {
        // Vérifier si l'utilisateur est admin de la conversation
        const member = await fastify.prisma.conversationMember.findFirst({
          where: {
            conversationId: shareLink.conversationId,
            userId,
            role: 'admin',
            isActive: true
          }
        });

        if (!member) {
          return reply.status(403).send({
            success: false,
            message: 'Vous n\'avez pas l\'autorisation de désactiver ce lien'
          });
        }
      }

      // Désactiver le lien
      await fastify.prisma.conversationShareLink.update({
        where: { linkId },
        data: { isActive: false }
      });

      return reply.send({
        success: true,
        message: 'Lien de partage désactivé'
      });

    } catch (error) {
      logError(fastify.log, 'Deactivate share link error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Supprimer un lien de partage
  fastify.delete('/share-links/:linkId', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const { userId } = request.user as any;

      // Vérifier que l'utilisateur est le créateur du lien
      const shareLink = await fastify.prisma.conversationShareLink.findUnique({
        where: { linkId }
      });

      if (!shareLink) {
        return reply.status(404).send({
          success: false,
          message: 'Lien de partage non trouvé'
        });
      }

      if (shareLink.createdBy !== userId) {
        // Vérifier si l'utilisateur est admin de la conversation
        const member = await fastify.prisma.conversationMember.findFirst({
          where: {
            conversationId: shareLink.conversationId,
            userId,
            role: 'admin',
            isActive: true
          }
        });

        if (!member) {
          return reply.status(403).send({
            success: false,
            message: 'Vous n\'avez pas l\'autorisation de supprimer ce lien'
          });
        }
      }

      // Supprimer le lien
      await fastify.prisma.conversationShareLink.delete({
        where: { linkId }
      });

      return reply.send({
        success: true,
        message: 'Lien de partage supprimé'
      });

    } catch (error) {
      logError(fastify.log, 'Delete share link error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });
}
