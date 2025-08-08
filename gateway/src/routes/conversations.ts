import { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '../../libs/prisma/client';

const prisma = new PrismaClient();

interface ConversationParams {
  id: string;
}

interface CreateConversationBody {
  type: 'direct' | 'group' | 'public' | 'global';
  title?: string;
  description?: string;
  participantIds?: string[];
  communityId?: string;
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

export async function conversationRoutes(fastify: FastifyInstance) {
  
  // Route pour obtenir toutes les conversations de l'utilisateur
  fastify.get('/conversations', {
    preValidation: [fastify.authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).user.id;

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
            },
            // Conversation globale "any" accessible à tous les utilisateurs connectés
            {
              id: 'any',
              type: 'global'
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
      console.error('Error fetching conversations:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération des conversations'
      });
    }
  });

  // Route pour obtenir une conversation par ID
  fastify.get<{ Params: ConversationParams }>('/conversations/:id', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = (request as any).user.id;

      // Vérifier les permissions d'accès
      let canAccess = false;
      
      if (id === 'any') {
        // Conversation globale accessible à tous les utilisateurs connectés
        canAccess = true;
      } else {
        // Vérifier si l'utilisateur est membre de la conversation
        const membership = await prisma.conversationMember.findFirst({
          where: {
            conversationId: id,
            userId: userId,
            isActive: true
          }
        });
        canAccess = !!membership;
      }

      if (!canAccess) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id },
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
          error: 'Conversation introuvable'
        });
      }

      reply.send({
        success: true,
        data: conversation
      });

    } catch (error) {
      console.error('Error fetching conversation:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération de la conversation'
      });
    }
  });

  // Route pour créer une nouvelle conversation
  fastify.post<{ Body: CreateConversationBody }>('/conversations', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { type, title, description, participantIds = [], communityId } = request.body;
      const userId = (request as any).user.id;

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

      const conversation = await prisma.conversation.create({
        data: {
          type,
          title,
          description,
          members: {
            create: [
              // Créateur de la conversation
              {
                userId,
                role: type === 'direct' ? 'member' : 'admin'
              },
              // Autres participants
              ...participantIds.map((participantId: string) => ({
                userId: participantId,
                role: 'member'
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

      reply.status(201).send({
        success: true,
        data: conversation
      });

    } catch (error) {
      console.error('Error creating conversation:', error);
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
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { limit = '20', offset = '0', before } = request.query;
      const userId = (request as any).user.id;

      // Vérifier les permissions d'accès
      let canAccess = false;
      
      if (id === 'any') {
        canAccess = true;
      } else {
        const membership = await prisma.conversationMember.findFirst({
          where: {
            conversationId: id,
            userId: userId,
            isActive: true
          }
        });
        canAccess = !!membership;
      }

      if (!canAccess) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

      // Construire la requête avec pagination
      const whereClause: any = {
        conversationId: id,
        isDeleted: false
      };

      if (before) {
        // Pagination par curseur (pour défilement historique)
        const beforeMessage = await prisma.message.findUnique({
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
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: before ? 0 : parseInt(offset)
      });

      // Marquer les messages comme lus
      if (messages.length > 0) {
        const messageIds = messages.map(m => m.id);
        await prisma.messageReadStatus.createMany({
          data: messageIds.map(messageId => ({
            messageId,
            userId
          }))
        });
      }

      reply.send({
        success: true,
        data: {
          messages: messages.reverse(), // Inverser pour avoir l'ordre chronologique
          hasMore: messages.length === parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Error fetching messages:', error);
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
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { content, originalLanguage = 'fr', messageType = 'text', replyToId } = request.body;
      const userId = (request as any).user.id;

      // Vérifier les permissions d'accès et d'écriture
      let canSend = false;
      
      if (id === 'any') {
        canSend = true; // Tous les utilisateurs connectés peuvent écrire dans la conversation globale
      } else {
        const membership = await prisma.conversationMember.findFirst({
          where: {
            conversationId: id,
            userId: userId,
            isActive: true
          }
        });
        canSend = !!membership; // Dans l'ancien schéma, pas de canSendMessage, on assume que tous les membres peuvent envoyer
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
          conversationId: id,
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
        where: { id },
        data: { lastMessageAt: new Date() }
      });

      // Marquer le message comme lu pour l'expéditeur
      await prisma.messageReadStatus.create({
        data: {
          messageId: message.id,
          userId
        }
      });

      reply.status(201).send({
        success: true,
        data: message
      });

    } catch (error) {
      console.error('Error sending message:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de l\'envoi du message'
      });
    }
  });

  // Route pour mettre à jour une conversation
  fastify.put<{ 
    Params: ConversationParams;
    Body: Partial<CreateConversationBody>;
  }>('/conversations/:id', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { title, description } = request.body;
      const userId = (request as any).user.id;

      // Vérifier les permissions d'administration
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: id,
          userId: userId,
          role: { in: ['admin', 'moderator'] },
          isActive: true
        }
      });

      if (!membership && id !== 'any') {
        return reply.status(403).send({
          success: false,
          error: 'Vous n\'êtes pas autorisé à modifier cette conversation'
        });
      }

      // Interdire la modification de la conversation globale
      if (id === 'any') {
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
      console.error('Error updating conversation:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la mise à jour de la conversation'
      });
    }
  });

  // Route pour supprimer une conversation
  fastify.delete<{ Params: ConversationParams }>('/conversations/:id', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = (request as any).user.id;

      // Interdire la suppression de la conversation globale
      if (id === 'any') {
        return reply.status(403).send({
          success: false,
          error: 'La conversation globale ne peut pas être supprimée'
        });
      }

      // Vérifier les permissions d'administration
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: id,
          userId: userId,
          role: 'admin',
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
        where: { id },
        data: { isActive: false }
      });

      reply.send({
        success: true,
        message: 'Conversation supprimée avec succès'
      });

    } catch (error) {
      console.error('Error deleting conversation:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la suppression de la conversation'
      });
    }
  });
}
