import { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '../../shared/prisma/client';
import { TranslationService } from '../services/TranslationService';
import { ZMQTranslationClient } from '../services/zmq-translation-client';

const prisma = new PrismaClient();
const zmqClient = new ZMQTranslationClient();
const translationService = new TranslationService(prisma, zmqClient);

// Initialiser le service de traduction
translationService.initialize().catch(console.error);

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
      const userId = (request as any).user.userId || (request as any).user.id;

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
      const userId = (request as any).user.userId || (request as any).user.id;

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
      const userId = (request as any).user.userId || (request as any).user.id;

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
      const userId = (request as any).user.userId || (request as any).user.id;

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
      const user = await prisma.user.findUnique({
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
        } catch (error) {
          console.warn('Error marking messages as read:', error);
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
      const userId = (request as any).user.userId || (request as any).user.id;

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

      // Traduire le message via le service Translator (qui gère les langues des participants)
      try {
        // Récupérer les IDs des participants
        let participantIds: string[] = [];
        
        if (id === 'any') {
          // Pour la conversation globale, récupérer tous les utilisateurs actifs
          const activeUsers = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true }
          });
          participantIds = activeUsers.map(u => u.id);
        } else {
          const participants = await prisma.conversationMember.findMany({
            where: {
              conversationId: id,
              isActive: true
            },
            select: { userId: true }
          });
          participantIds = participants.map(p => p.userId);
        }

        // Envoyer la demande de traduction au service Translator via ZMQ
        // Le Translator récupérera lui-même les langues des participants et traduira en conséquence
        const translationRequest = {
          messageId: message.id,
          text: message.content,
          sourceLanguage: originalLanguage,
          targetLanguage: originalLanguage, // Langue source (le Translator déterminera les cibles)
          modelType: getPredictedModelType(message.content.length),
          // Données supplémentaires pour le Translator
          conversationId: id, // Le Translator utilisera ceci pour récupérer les participants
          participantIds: participantIds, // Information optionnelle pour optimisation
          requestType: 'conversation_translation'
        };

        await zmqClient.translateText(translationRequest);

        console.log(`Translations requested for message ${message.id} in conversation ${id}`);
      } catch (error) {
        console.error('Error requesting translations:', error);
        // Ne pas faire échouer l'envoi du message si la traduction échoue
      }

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

  // Route pour modifier un message (permis depuis la gateway)
  fastify.put<{
    Params: ConversationParams & { messageId: string };
    Body: EditMessageBody;
  }>('/conversations/:id/messages/:messageId', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id, messageId } = request.params;
      const { content, originalLanguage = 'fr' } = request.body;
      const userId = (request as any).user.userId || (request as any).user.id;

      // Vérifier que le message existe et appartient à l'utilisateur
      const existingMessage = await prisma.message.findFirst({
        where: {
          id: messageId,
          conversationId: id,
          senderId: userId,
          isDeleted: false
        }
      });

      if (!existingMessage) {
        return reply.status(404).send({
          success: false,
          error: 'Message non trouvé ou vous n\'êtes pas autorisé à le modifier'
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

      // Note: Les traductions ne sont PAS modifiées ici - elles restent dans l'état du service Translator
      // Selon les instructions Copilot, seul le service Translator peut modifier les traductions

      reply.send({
        success: true,
        data: updatedMessage
      });

    } catch (error) {
      console.error('Error updating message:', error);
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
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id, messageId } = request.params;
      const userId = (request as any).user.userId || (request as any).user.id;

      // Vérifier que le message existe et appartient à l'utilisateur
      const existingMessage = await prisma.message.findFirst({
        where: {
          id: messageId,
          conversationId: id,
          senderId: userId,
          isDeleted: false
        }
      });

      if (!existingMessage) {
        return reply.status(404).send({
          success: false,
          error: 'Message non trouvé ou vous n\'êtes pas autorisé à le supprimer'
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

      reply.send({
        success: true,
        data: { messageId, deleted: true }
      });

    } catch (error) {
      console.error('Error deleting message:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la suppression du message'
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

  // Route pour modifier un message
  fastify.patch<{
    Params: { messageId: string };
    Body: { content: string };
  }>('/messages/:messageId', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { messageId } = request.params;
      const { content } = request.body;
      const userId = (request as any).user.userId || (request as any).user.id;

      // Vérifier que le message existe et appartient à l'utilisateur
      const message = await prisma.message.findUnique({
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
      if (message.conversationId !== 'any' && message.conversation.members.length === 0) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
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
      console.error('Error updating message:', error);
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la modification du message'
      });
    }
  });
}
