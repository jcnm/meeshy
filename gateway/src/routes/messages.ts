import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createUnifiedAuthMiddleware, UnifiedAuthRequest } from '../middleware/auth.js';

interface MessageParams {
  messageId: string;
}

interface UpdateMessageBody {
  content?: string;
  isEdited?: boolean;
}

interface MessageStatusBody {
  status: 'read' | 'delivered';
  timestamp?: string;
}

export default async function messageRoutes(fastify: FastifyInstance) {
  // Récupérer prisma décoré par le serveur
  const prisma = fastify.prisma;
  
  // Middleware d'authentification requis pour les messages
  const requiredAuth = createUnifiedAuthMiddleware(prisma, { 
    requireAuth: true, 
    allowAnonymous: false 
  });

  // Route pour récupérer un message spécifique
  fastify.get<{
    Params: MessageParams;
  }>('/messages/:messageId', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { messageId } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Récupérer le message avec ses détails
      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          isDeleted: false
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatar: true,
              isOnline: true
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
          conversation: {
            include: {
              members: {
                where: { userId: userId },
                select: { userId: true, role: true }
              }
            }
          },
          status: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          },
          translations: {
            select: {
              id: true,
              targetLanguage: true,
              translatedContent: true,
              sourceLanguage: true
            }
          }
        }
      });

      if (!message) {
        return reply.status(404).send({
          success: false,
          error: 'Message non trouvé'
        });
      }

      // Vérifier que l'utilisateur a accès à cette conversation
      if (!message.conversation.members.length) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à ce message'
        });
      }

      return reply.send({
        success: true,
        data: message
      });

    } catch (error) {
      console.error('[MESSAGES] Error fetching message:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération du message'
      });
    }
  });

  // Route pour éditer un message
  fastify.put<{
    Params: MessageParams;
    Body: UpdateMessageBody;
  }>('/messages/:messageId', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { messageId } = request.params;
      const { content } = request.body;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      if (!content || content.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Le contenu du message ne peut pas être vide'
        });
      }

      // Vérifier que le message existe et appartient à l'utilisateur
      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          senderId: userId,
          isDeleted: false
        },
        include: {
          conversation: {
            include: {
              members: {
                where: { userId: userId },
                select: { userId: true }
              }
            }
          }
        }
      });

      if (!message) {
        return reply.status(404).send({
          success: false,
          error: 'Message non trouvé ou vous n\'êtes pas autorisé à le modifier'
        });
      }

      // Mettre à jour le message
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
              avatar: true
            }
          }
        }
      });

      // TODO: Diffuser la mise à jour via WebSocket quand websocketManager sera disponible
      // if (fastify.websocketManager) {
      //   fastify.websocketManager.broadcastToConversation(message.conversationId, {
      //     type: 'message_updated',
      //     data: updatedMessage
      //   }, userId);
      // }

      return reply.send({
        success: true,
        data: updatedMessage,
        message: 'Message modifié avec succès'
      });

    } catch (error) {
      console.error('[MESSAGES] Error updating message:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la modification du message'
      });
    }
  });

  // Route pour supprimer un message (soft delete)
  fastify.delete<{
    Params: MessageParams;
  }>('/messages/:messageId', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { messageId } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Vérifier que le message existe
      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          isDeleted: false
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true
            }
          },
          conversation: {
            include: {
              members: {
                where: { userId: userId },
                select: { userId: true, role: true }
              }
            }
          }
        }
      });

      if (!message) {
        return reply.status(404).send({
          success: false,
          error: 'Message non trouvé'
        });
      }

      // Vérifier les permissions de suppression
      const userMembership = message.conversation.members[0];
      const canDelete = 
        // L'auteur du message peut le supprimer
        message.senderId === userId ||
        // Les administrateurs et modérateurs peuvent supprimer
        userMembership?.role === 'admin' ||
        userMembership?.role === 'moderator' ||
        authRequest.authContext.registeredUser?.role === 'ADMIN' ||
        authRequest.authContext.registeredUser?.role === 'BIGBOSS' ||
        authRequest.authContext.registeredUser?.role === 'MODERATOR' ||
        authRequest.authContext.registeredUser?.role === 'CREATOR';

      if (!canDelete) {
        return reply.status(403).send({
          success: false,
          error: 'Vous n\'êtes pas autorisé à supprimer ce message'
        });
      }

      // Marquer le message comme supprimé (soft delete)
      const deletedMessage = await prisma.message.update({
        where: { id: messageId },
        data: { 
          isDeleted: true,
          deletedAt: new Date()
          // Note: deletedBy n'existe pas dans le schéma Prisma actuel
        }
      });

      // Mettre à jour le lastMessageAt de la conversation avec le dernier message non supprimé
      const lastNonDeletedMessage = await prisma.message.findFirst({
        where: {
          conversationId: message.conversationId,
          isDeleted: false
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      });

      await prisma.conversation.update({
        where: { id: message.conversationId },
        data: { 
          lastMessageAt: lastNonDeletedMessage?.createdAt || message.conversation.createdAt
        }
      });

      // TODO: Diffuser la suppression via WebSocket quand websocketManager sera disponible
      // if (fastify.websocketManager) {
      //   fastify.websocketManager.broadcastToConversation(message.conversationId, {
      //     type: 'message_deleted',
      //     data: { messageId, deletedBy: userId }
      //   }, userId);
      // }

      return reply.send({
        success: true,
        message: 'Message supprimé avec succès'
      });

    } catch (error) {
      console.error('[MESSAGES] Error deleting message:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la suppression du message'
      });
    }
  });

  // Route pour marquer un message comme lu
  fastify.post<{
    Params: MessageParams;
    Body: MessageStatusBody;
  }>('/messages/:messageId/status', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { messageId } = request.params;
      const { status } = request.body;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      if (!status || !['read', 'delivered'].includes(status)) {
        return reply.status(400).send({
          success: false,
          error: 'Statut invalide'
        });
      }

      // Vérifier que le message existe et que l'utilisateur a accès
      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          isDeleted: false
        },
        include: {
          conversation: {
            include: {
              members: {
                where: { userId: userId },
                select: { userId: true }
              }
            }
          }
        }
      });

      if (!message || !message.conversation.members.length) {
        return reply.status(404).send({
          success: false,
          error: 'Message non trouvé ou accès non autorisé'
        });
      }

      // Ne pas marquer ses propres messages comme lus
      if (message.senderId === userId) {
        return reply.status(400).send({
          success: false,
          error: 'Vous ne pouvez pas marquer vos propres messages comme lus'
        });
      }

      if (status === 'read') {
        // Vérifier si le statut de lecture existe déjà
        const existingReadStatus = await prisma.messageStatus.findFirst({
          where: {
            messageId: messageId,
            userId: userId
          }
        });

        let status;
        if (existingReadStatus) {
          // Mettre à jour
          status = await prisma.messageStatus.update({
            where: { id: existingReadStatus.id },
            data: { readAt: new Date() },
            include: {
              user: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          });
        } else {
          // Créer nouveau
          status = await prisma.messageStatus.create({
            data: {
              messageId: messageId,
              userId: userId,
              readAt: new Date()
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          });
        }

        // TODO: Diffuser le statut de lecture via WebSocket quand websocketManager sera disponible
        // if (fastify.websocketManager) {
        //   fastify.websocketManager.broadcastToConversation(message.conversationId, {
        //     type: 'message_read',
        //     data: { messageId, userId, readAt: status.readAt }
        //   });
        // }

        return reply.send({
          success: true,
          data: status,
          message: 'Message marqué comme lu'
        });
      }

    } catch (error) {
      console.error('[MESSAGES] Error updating message status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la mise à jour du statut du message'
      });
    }
  });

  // Route pour récupérer l'historique des modifications d'un message
  fastify.get<{
    Params: MessageParams;
  }>('/messages/:messageId/history', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { messageId } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Vérifier que le message existe et que l'utilisateur a accès
      const message = await prisma.message.findFirst({
        where: {
          id: messageId
        },
        include: {
          conversation: {
            include: {
              members: {
                where: { userId: userId },
                select: { userId: true, role: true }
              }
            }
          }
        }
      });

      if (!message || !message.conversation.members.length) {
        return reply.status(404).send({
          success: false,
          error: 'Message non trouvé ou accès non autorisé'
        });
      }

      // Seuls les modérateurs/admins ou l'auteur peuvent voir l'historique
      const userMembership = message.conversation.members[0];
      const canViewHistory = 
        message.senderId === userId ||
        userMembership?.role === 'admin' ||
        userMembership?.role === 'moderator' ||
        authRequest.authContext.registeredUser?.role === 'ADMIN' ||
        authRequest.authContext.registeredUser?.role === 'BIGBOSS' ||
        authRequest.authContext.registeredUser?.role === 'MODERATOR';

      if (!canViewHistory) {
        return reply.status(403).send({
          success: false,
          error: 'Vous n\'êtes pas autorisé à voir l\'historique de ce message'
        });
      }

      // Pour l'instant, retourner les informations de base
      // TODO: Implémenter un système d'historique des modifications si nécessaire
      const history = {
        messageId: message.id,
        originalContent: message.content,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
        createdAt: message.createdAt,
        deletedAt: message.deletedAt,
        // Note: deletedBy n'existe pas dans le schéma actuel
        isDeleted: message.isDeleted
      };

      return reply.send({
        success: true,
        data: history
      });

    } catch (error) {
      console.error('[MESSAGES] Error fetching message history:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération de l\'historique du message'
      });
    }
  });

  // Route pour récupérer les traductions d'un message
  fastify.get<{
    Params: MessageParams;
  }>('/messages/:messageId/translations', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { messageId } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Vérifier que le message existe et que l'utilisateur a accès
      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          isDeleted: false
        },
        include: {
          conversation: {
            include: {
              members: {
                where: { userId: userId },
                select: { userId: true }
              }
            }
          },
          translations: {
            select: {
              id: true,
              sourceLanguage: true,
              targetLanguage: true,
              translatedContent: true,
              translationModel: true,
              confidenceScore: true,
              createdAt: true
            }
          }
        }
      });

      if (!message || !message.conversation.members.length) {
        return reply.status(404).send({
          success: false,
          error: 'Message non trouvé ou accès non autorisé'
        });
      }

      return reply.send({
        success: true,
        data: {
          messageId: message.id,
          originalContent: message.content,
          originalLanguage: message.originalLanguage,
          translations: message.translations
        }
      });

    } catch (error) {
      console.error('[MESSAGES] Error fetching message translations:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération des traductions du message'
      });
    }
  });
}
