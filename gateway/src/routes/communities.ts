/**
 * Routes Communautés
 *
 * Ce module regroupe les endpoints liés à la gestion des communautés.
 * Une communauté est un conteneur logique permettant de rassembler des membres,
 * d'organiser des permissions et d'agréger des conversations associées.
 *
 * Points clés:
 * - Les routes sont préfixées par `/communities`.
 * - Les conversations d'une communauté sont exposées via `GET /communities/:id/conversations`.
 * - Le schéma Prisma définit une relation Community → Conversation.
 */
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// Schémas de validation
const CreateCommunitySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  avatar: z.string().optional(),
  isPrivate: z.boolean().default(true)
});

const UpdateCommunitySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  avatar: z.string().optional(),
  isPrivate: z.boolean().optional()
});

const AddMemberSchema = z.object({
  userId: z.string()
});

/**
 * Enregistre les routes de gestion des communautés.
 * @param fastify Instance Fastify injectée par le serveur
 */
export async function communityRoutes(fastify: FastifyInstance) {
  
  // Route pour obtenir toutes les communautés de l'utilisateur connecté
  fastify.get('/communities', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      
      const communities = await fastify.prisma.community.findMany({
        where: {
          OR: [
            { createdBy: userId },
            { members: { some: { userId: userId } } }
          ]
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true
            }
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
                  isOnline: true
                }
              }
            }
          },
          _count: {
            select: {
              members: true,
              Conversation: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      reply.send({
        success: true,
        data: communities
      });
    } catch (error) {
      console.error('Error fetching communities:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch communities'
      });
    }
  });

  // Route pour obtenir une communauté par ID
  fastify.get('/communities/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = (request as any).user.id;
      
      const community = await fastify.prisma.community.findFirst({
        where: { id },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true
            }
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
                  isOnline: true
                }
              }
            }
          },
          _count: {
            select: {
              members: true,
              Conversation: true
            }
          }
        }
      });

      if (!community) {
        return reply.status(404).send({
          success: false,
          error: 'Community not found'
        });
      }

      // Vérifier l'accès (créateur ou membre)
      const hasAccess = community.createdBy === userId || 
                       community.members.some(member => member.userId === userId);
      
      if (!hasAccess && community.isPrivate) {
        return reply.status(403).send({
          success: false,
          error: 'Access denied to this community'
        });
      }

      reply.send({
        success: true,
        data: community
      });
    } catch (error) {
      console.error('Error fetching community:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch community'
      });
    }
  });

  // Route pour créer une nouvelle communauté
  fastify.post('/communities', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const validatedData = CreateCommunitySchema.parse(request.body);
      const userId = (request as any).user.id;
      
      const community = await fastify.prisma.community.create({
        data: {
          name: validatedData.name,
          description: validatedData.description,
          avatar: validatedData.avatar,
          isPrivate: validatedData.isPrivate ?? true,
          createdBy: userId
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true
            }
          },
          _count: {
            select: {
              members: true,
              Conversation: true
            }
          }
        }
      });

      reply.status(201).send({
        success: true,
        data: community
      });
    } catch (error) {
      console.error('Error creating community:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to create community'
      });
    }
  });

  // Route pour obtenir les membres d'une communauté
  fastify.get('/communities/:id/members', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = (request as any).user.id;
      
      // Vérifier l'accès à la communauté
      const community = await fastify.prisma.community.findFirst({
        where: { id },
        select: {
          createdBy: true,
          isPrivate: true,
          members: { select: { userId: true } }
        }
      });

      if (!community) {
        return reply.status(404).send({
          success: false,
          error: 'Community not found'
        });
      }

      const hasAccess = community.createdBy === userId || 
                       community.members.some(member => member.userId === userId);
      
      if (!hasAccess && community.isPrivate) {
        return reply.status(403).send({
          success: false,
          error: 'Access denied to this community'
        });
      }

      const members = await fastify.prisma.communityMember.findMany({
        where: { communityId: id },
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
        },
        orderBy: {
          joinedAt: 'asc'
        }
      });

      reply.send({
        success: true,
        data: members
      });
    } catch (error) {
      console.error('Error fetching community members:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch community members'
      });
    }
  });

  // Route pour ajouter un membre à la communauté
  fastify.post('/communities/:id/members', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const validatedData = AddMemberSchema.parse(request.body);
      const userId = (request as any).user.id;
      
      // Vérifier que l'utilisateur est le créateur de la communauté
      const community = await fastify.prisma.community.findFirst({
        where: { id },
        select: { createdBy: true }
      });

      if (!community) {
        return reply.status(404).send({
          success: false,
          error: 'Community not found'
        });
      }

      if (community.createdBy !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Only community creator can add members'
        });
      }

      // Vérifier que l'utilisateur à ajouter existe
      const userToAdd = await fastify.prisma.user.findFirst({
        where: { id: validatedData.userId },
        select: { id: true }
      });

      if (!userToAdd) {
        return reply.status(404).send({
          success: false,
          error: 'User to add not found'
        });
      }

      // Vérifier si le membre existe déjà
      const existingMember = await fastify.prisma.communityMember.findFirst({
        where: {
          communityId: id,
          userId: validatedData.userId
        }
      });

      let member;
      if (existingMember) {
        member = existingMember;
      } else {
        // Ajouter le membre
        member = await fastify.prisma.communityMember.create({
          data: {
            communityId: id,
            userId: validatedData.userId
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isOnline: true
              }
            }
          }
        });
      }

      reply.send({
        success: true,
        data: member
      });
    } catch (error) {
      console.error('Error adding community member:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to add community member'
      });
    }
  });

  // Route pour retirer un membre de la communauté
  fastify.delete('/communities/:id/members/:memberId', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id, memberId } = request.params as { id: string; memberId: string };
      const userId = (request as any).user.id;
      
      // Vérifier que l'utilisateur est le créateur de la communauté
      const community = await fastify.prisma.community.findFirst({
        where: { id },
        select: { createdBy: true }
      });

      if (!community) {
        return reply.status(404).send({
          success: false,
          error: 'Community not found'
        });
      }

      if (community.createdBy !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Only community creator can remove members'
        });
      }

      // Supprimer le membre
      await fastify.prisma.communityMember.deleteMany({
        where: {
          communityId: id,
          userId: memberId
        }
      });

      reply.send({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      console.error('Error removing community member:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to remove community member'
      });
    }
  });

  // Route pour mettre à jour une communauté
  fastify.put('/communities/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const validatedData = UpdateCommunitySchema.parse(request.body);
      const userId = (request as any).user.id;
      
      // Vérifier que l'utilisateur est le créateur de la communauté
      const community = await fastify.prisma.community.findFirst({
        where: { id },
        select: { createdBy: true }
      });

      if (!community) {
        return reply.status(404).send({
          success: false,
          error: 'Community not found'
        });
      }

      if (community.createdBy !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Only community creator can update community'
        });
      }

      const updatedCommunity = await fastify.prisma.community.update({
        where: { id },
        data: validatedData,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true
            }
          },
          _count: {
            select: {
              members: true,
              Conversation: true
            }
          }
        }
      });

      reply.send({
        success: true,
        data: updatedCommunity
      });
    } catch (error) {
      console.error('Error updating community:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to update community'
      });
    }
  });

  // Route pour supprimer une communauté
  fastify.delete('/communities/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = (request as any).user.id;
      
      // Vérifier que l'utilisateur est le créateur de la communauté
      const community = await fastify.prisma.community.findFirst({
        where: { id },
        select: { createdBy: true }
      });

      if (!community) {
        return reply.status(404).send({
          success: false,
          error: 'Community not found'
        });
      }

      if (community.createdBy !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Only community creator can delete community'
        });
      }

      await fastify.prisma.community.delete({
        where: { id }
      });

      reply.send({
        success: true,
        message: 'Community deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting community:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to delete community'
      });
    }
  });

  // Conversations d'une communauté
  fastify.get('/communities/:id/conversations', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = (request as any).user.id;
      
      // Vérifier l'accès à la communauté
      const community = await fastify.prisma.community.findFirst({
        where: { id },
        select: {
          createdBy: true,
          isPrivate: true,
          members: { select: { userId: true } }
        }
      });

      if (!community) {
        return reply.status(404).send({
          success: false,
          error: 'Community not found'
        });
      }

      const hasAccess = community.createdBy === userId || 
                       community.members.some(member => member.userId === userId);
      
      if (!hasAccess && community.isPrivate) {
        return reply.status(403).send({
          success: false,
          error: 'Access denied to this community'
        });
      }

      // Récupérer les conversations de la communauté
      const conversations = await fastify.prisma.conversation.findMany({
        where: { 
          communityId: id,
          // S'assurer que l'utilisateur est membre de la conversation
          members: {
            some: { userId: userId }
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
                  avatar: true,
                  isOnline: true
                }
              }
            }
          },
          _count: {
            select: {
              messages: true,
              members: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });

      reply.send({
        success: true,
        data: conversations
      });
    } catch (error) {
      console.error('Error fetching community conversations:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch community conversations'
      });
    }
  });
}
