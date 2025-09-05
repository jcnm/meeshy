import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TranslationService } from '../services/TranslationService';
import { conversationStatsService } from '../services/ConversationStatsService';
import { z } from 'zod';
import { UserRoleEnum } from '../../shared/types';

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
            // Conversation globale "meeshy" accessible à tous les utilisateurs connectés
            {
              identifier: "meeshy",
              type: 'GLOBAL'
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
      console.error('[GATEWAY] Error fetching conversations:', error);
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
      let conversationId = id;
      
      // Si l'ID est "meeshy", chercher par identifiant lisible
      if (id === "meeshy") {
        const globalConversation = await prisma.conversation.findFirst({
          where: { identifier: "meeshy" }
        });
        if (globalConversation) {
          conversationId = globalConversation.id;
          canAccess = true; // Conversation globale accessible à tous les utilisateurs connectés
        }
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
      console.error('[GATEWAY] Error creating conversation:', error);
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
      
      if (id === "meeshy") {
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
      const user = await prisma.user.findFirst({
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
          // Vérifier que l'utilisateur existe avant de marquer les messages comme lus
          const userExists = await prisma.user.findFirst({
            where: { id: userId },
            select: { id: true }
          });
          
          if (!userExists) {
            console.warn('[GATEWAY] Cannot mark messages as read: user not found:', userId);
          } else {
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
          }
        } catch (error) {
          console.warn('[GATEWAY] Error marking messages as read:', error);
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
      console.error('[GATEWAY] Error fetching messages:', error);
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
      
      if (id === "meeshy") {
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

      // Déclencher les traductions via le TranslationService (gère les langues des participants)
      try {
        await translationService.handleNewMessage({
          id: message.id,
          conversationId: id,
          senderId: userId,
          content: message.content,
          originalLanguage,
          messageType,
          replyToId
        } as any);
        console.log(`Translations queued via TranslationService for message ${message.id} in conversation ${id}`);
      } catch (error) {
        console.error('[GATEWAY] Error queuing translations via TranslationService:', error);
        // Ne pas faire échouer l'envoi du message si la traduction échoue
      }

      // Mettre à jour les stats dans le cache (et les calculer si entrée absente)
      const stats = await conversationStatsService.updateOnNewMessage(
        prisma,
        id,
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
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = (request as any).user.userId || (request as any).user.id;

      // Accès à la conversation
      let canAccess = false;
      if (id === "meeshy") {
        canAccess = true;
      } else {
        const membership = await prisma.conversationMember.findFirst({
          where: { conversationId: id, userId, isActive: true }
        });
        canAccess = !!membership;
      }
      if (!canAccess) {
        return reply.status(403).send({ success: false, error: 'Accès non autorisé à cette conversation' });
      }

      // Récupérer les messages non lus
      const unreadMessages = await prisma.message.findMany({
        where: {
          conversationId: id,
          isDeleted: false,
          readStatus: { none: { userId } }
        },
        select: { id: true }
      });

      if (unreadMessages.length > 0) {
        await prisma.messageReadStatus.createMany({
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
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { q } = request.query;
      const userId = (request as any).user.userId || (request as any).user.id;

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

      reply.send({ success: true, data: conversations });
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

      // Invalider et recalculer les stats pour refléter l'édition
      const stats = await conversationStatsService.getOrCompute(
        prisma,
        id,
        () => []
      );

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

      // Invalider et recalculer les stats
      const stats = await conversationStatsService.getOrCompute(
        prisma,
        id,
        () => []
      );

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
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = (request as any).user.id;

      // Interdire la suppression de la conversation globale
      if (id === "meeshy") {
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
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { messageId } = request.params;
      const { content } = request.body;
      const userId = (request as any).user.userId || (request as any).user.id;

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
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { onlineOnly, role, search, limit } = request.query;
      const userId = (request as any).user.userId || (request as any).user.id;

      // Vérifier que l'utilisateur a accès à cette conversation
      let conversationId = id;
      
      if (id === "meeshy") {
        // Pour la conversation globale, chercher par identifiant
        const globalConversation = await prisma.conversation.findFirst({
          where: { identifier: "meeshy" }
        });
        if (globalConversation) {
          conversationId = globalConversation.id;
        }
      } else {
        const membership = await prisma.conversationMember.findFirst({
          where: {
            conversationId: id,
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
        username: participant.user.username,
        firstName: participant.user.firstName,
        lastName: participant.user.lastName,
        displayName: participant.user.displayName,
        avatar: participant.user.avatar,
        email: participant.user.email,
        role: participant.user.role,
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
          conversationId: id,
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
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { userId } = request.body;
      const currentUserId = (request as any).user.userId || (request as any).user.id;

      // Vérifier que l'utilisateur actuel a les droits pour ajouter des participants
      const currentUserMembership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: id,
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
          conversationId: id,
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
          conversationId: id,
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
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id, userId } = request.params;
      const currentUserId = (request as any).user.userId || (request as any).user.id;

      // Vérifier que l'utilisateur actuel a les droits pour supprimer des participants
      const currentUserMembership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: id,
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
          conversationId: id,
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
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const body = request.body || {};
      const currentUserId = (request as any).user.userId || (request as any).user.id;

      // Vérifier que l'utilisateur a accès à cette conversation
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: id,
          userId: currentUserId,
          isActive: true
        }
      });

      if (!membership) {
        return reply.status(403).send({
          success: false,
          error: 'Accès non autorisé à cette conversation'
        });
      }

                      // Vérifier que l'utilisateur est membre de la conversation
                      // Permettre à tous les membres de créer des liens pour les conversations partagées
                      if (membership.role !== UserRoleEnum.ADMIN && membership.role !== UserRoleEnum.CREATOR && membership.role !== UserRoleEnum.MODERATOR && membership.role !== UserRoleEnum.MEMBER) {
                        return reply.status(403).send({
                          success: false,
                          error: 'Vous devez être membre de cette conversation pour créer des liens'
                        });
                      }

      // Générer le linkId initial
      const initialLinkId = generateInitialLinkId();

      // Créer le lien avec toutes les options configurables
      const shareLink = await prisma.conversationShareLink.create({
        data: {
          linkId: initialLinkId, // Temporaire
          conversationId: id,
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
          allowedIpRanges: body.allowedIpRanges ?? []
        }
      });

      // Mettre à jour avec le linkId final
      const finalLinkId = generateFinalLinkId(shareLink.id, initialLinkId);
      await prisma.conversationShareLink.update({
        where: { id: shareLink.id },
        data: { linkId: finalLinkId }
      });

      // Retour compatible avec le frontend de service conversations (string du lien complet)
      const inviteLink = `${process.env.FRONTEND_URL || 'http://meeshy.me'}/join/${finalLinkId}`;
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
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { title, description, type } = request.body;
      const currentUserId = (request as any).user.userId || (request as any).user.id;

      console.log('[GATEWAY] Update conversation request:', {
        conversationId: id,
        currentUserId,
        title,
        description,
        type
      });

      // Vérifier que l'utilisateur a accès à cette conversation
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: id,
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
        where: { id },
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
      reply.status(500).send({
        success: false,
        error: 'Erreur lors de la mise à jour de la conversation'
      });
    }
  });

  // Récupérer les liens de partage d'une conversation (pour les admins)
  fastify.get('/conversations/:conversationId/links', { onRequest: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { conversationId } = request.params as { conversationId: string };
      const userId = (request as any).user.userId || (request as any).user.id;

      // Vérifier que l'utilisateur est admin ou modérateur de la conversation
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId,
          userId,
          role: { in: ['admin', 'moderator'] },
          isActive: true
        }
      });

      if (!membership) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Accès non autorisé - droits administrateur ou modérateur requis' 
        });
      }

      const links = await prisma.conversationShareLink.findMany({
        where: { conversationId },
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

      return reply.send({ success: true, data: links });
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
    preValidation: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const userToken = (request as any).user;

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
          userId: userToken.userId || userToken.id
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
          userId: userToken.userId || userToken.id,
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


}
