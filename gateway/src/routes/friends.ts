import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// Schémas de validation
const createFriendRequestSchema = z.object({
  receiverId: z.string()
});

const updateFriendRequestSchema = z.object({
  status: z.enum(['accepted', 'rejected'])
});

export async function friendRequestRoutes(fastify: FastifyInstance) {
  // Envoyer une demande d'ami
  fastify.post('/friend-requests', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createFriendRequestSchema.parse(request.body);
      const { userId } = request.user as any;

      // Vérifier que l'utilisateur cible existe
      const targetUser = await fastify.prisma.user.findUnique({
        where: { id: body.receiverId }
      });

      if (!targetUser) {
        return reply.status(404).send({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Vérifier qu'il n'y a pas déjà une demande
      const existingRequest = await fastify.prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: body.receiverId },
            { senderId: body.receiverId, receiverId: userId }
          ]
        }
      });

      if (existingRequest) {
        return reply.status(409).send({
          success: false,
          message: 'Une demande d\'ami existe déjà entre vous'
        });
      }

      // Créer la demande d'ami
      const friendRequest = await fastify.prisma.friendRequest.create({
        data: {
          senderId: userId,
          receiverId: body.receiverId
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
          receiver: {
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

      return reply.status(201).send({
        success: true,
        data: friendRequest
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      fastify.log.error('Create friend request error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Récupérer les demandes d'ami reçues
  fastify.get('/friend-requests/received', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user as any;

      const friendRequests = await fastify.prisma.friendRequest.findMany({
        where: {
          receiverId: userId,
          status: 'pending'
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
              isOnline: true,
              lastSeen: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return reply.send({
        success: true,
        data: friendRequests
      });

    } catch (error) {
      fastify.log.error('Get received friend requests error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Récupérer les demandes d'ami envoyées
  fastify.get('/friend-requests/sent', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user as any;

      const friendRequests = await fastify.prisma.friendRequest.findMany({
        where: {
          senderId: userId
        },
        include: {
          receiver: {
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
        orderBy: {
          createdAt: 'desc'
        }
      });

      return reply.send({
        success: true,
        data: friendRequests
      });

    } catch (error) {
      fastify.log.error('Get sent friend requests error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Répondre à une demande d'ami
  fastify.patch('/friend-requests/:id', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = updateFriendRequestSchema.parse(request.body);
      const { userId } = request.user as any;

      // Vérifier que la demande existe et appartient à l'utilisateur
      const friendRequest = await fastify.prisma.friendRequest.findFirst({
        where: {
          id,
          receiverId: userId,
          status: 'pending'
        }
      });

      if (!friendRequest) {
        return reply.status(404).send({
          success: false,
          message: 'Demande d\'ami non trouvée ou déjà traitée'
        });
      }

      // Mettre à jour le statut
      const updatedRequest = await fastify.prisma.friendRequest.update({
        where: { id },
        data: { status: body.status },
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
          receiver: {
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

      // Si acceptée, créer une conversation directe entre les utilisateurs
      if (body.status === 'accepted') {
        const existingConversation = await fastify.prisma.conversation.findFirst({
          where: {
            type: 'direct',
            members: {
              every: {
                userId: {
                  in: [friendRequest.senderId, friendRequest.receiverId]
                }
              }
            }
          }
        });

        if (!existingConversation) {
          const conversation = await fastify.prisma.conversation.create({
            data: {
              type: 'direct',
              members: {
                create: [
                  { userId: friendRequest.senderId, role: 'member' },
                  { userId: friendRequest.receiverId, role: 'member' }
                ]
              }
            }
          });

          // Ajouter la conversation à la réponse
          (updatedRequest as any).conversation = conversation;
        }
      }

      return reply.send({
        success: true,
        data: updatedRequest
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: 'Données invalides',
          errors: error.errors
        });
      }

      fastify.log.error('Update friend request error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });

  // Supprimer une demande d'ami
  fastify.delete('/friend-requests/:id', {
    onRequest: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.user as any;

      // Vérifier que la demande existe et appartient à l'utilisateur (envoyée ou reçue)
      const friendRequest = await fastify.prisma.friendRequest.findFirst({
        where: {
          id,
          OR: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      });

      if (!friendRequest) {
        return reply.status(404).send({
          success: false,
          message: 'Demande d\'ami non trouvée'
        });
      }

      // Supprimer la demande
      await fastify.prisma.friendRequest.delete({
        where: { id }
      });

      return reply.send({
        success: true,
        message: 'Demande d\'ami supprimée'
      });

    } catch (error) {
      fastify.log.error('Delete friend request error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });
}
