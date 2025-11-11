import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createUnifiedAuthMiddleware, UnifiedAuthRequest } from '../middleware/auth.js';
import { MentionService } from '../services/MentionService.js';
import type {
  MentionSuggestionsRequest,
  MentionSuggestionsResponse,
  GetMessageMentionsResponse,
  GetUserMentionsResponse
} from '../../../shared/types/mention.js';

interface MessageParams {
  messageId: string;
}

interface SuggestionsQuery {
  conversationId: string;
  query?: string;
}

interface UserMentionsQuery {
  limit?: number;
}

export default async function mentionRoutes(fastify: FastifyInstance) {
  // Récupérer prisma décoré par le serveur
  const prisma = fastify.prisma;

  // Instancier le service de mentions
  const mentionService = new MentionService(prisma);

  // Middleware d'authentification requis pour les mentions
  const requiredAuth = createUnifiedAuthMiddleware(prisma, {
    requireAuth: true,
    allowAnonymous: false
  });

  /**
   * GET /mentions/suggestions
   * Obtenir des suggestions d'utilisateurs pour l'autocomplete de mention
   */
  fastify.get<{
    Querystring: SuggestionsQuery;
  }>('/mentions/suggestions', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { conversationId, query } = request.query;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Authentification requise'
        });
      }

      if (!conversationId) {
        return reply.code(400).send({
          success: false,
          error: 'conversationId est requis'
        });
      }

      // Récupérer les suggestions
      const suggestions = await mentionService.getUserSuggestionsForConversation(
        conversationId,
        userId,
        query || ''
      );

      const response: MentionSuggestionsResponse = {
        success: true,
        data: suggestions
      };

      return reply.send(response);
    } catch (error) {
      fastify.log.error('Error getting mention suggestions:', error);
      return reply.code(500).send({
        success: false,
        error: 'Erreur lors de la récupération des suggestions'
      });
    }
  });

  /**
   * GET /mentions/messages/:messageId
   * Obtenir la liste des utilisateurs mentionnés dans un message
   */
  fastify.get<{
    Params: MessageParams;
  }>('/mentions/messages/:messageId', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { messageId } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Authentification requise'
        });
      }

      // Vérifier que le message existe et que l'utilisateur y a accès
      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          isDeleted: false,
          conversation: {
            members: {
              some: {
                userId,
                isActive: true
              }
            }
          }
        }
      });

      if (!message) {
        return reply.code(404).send({
          success: false,
          error: 'Message non trouvé ou accès refusé'
        });
      }

      // Récupérer les mentions
      const mentions = await mentionService.getMentionsForMessage(messageId);

      const response: GetMessageMentionsResponse = {
        success: true,
        data: mentions.map(user => ({
          id: user.id,
          messageId,
          mentionedUserId: user.id,
          mentionedAt: new Date(),
          mentionedUser: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar
          }
        }))
      };

      return reply.send(response);
    } catch (error) {
      fastify.log.error('Error getting message mentions:', error);
      return reply.code(500).send({
        success: false,
        error: 'Erreur lors de la récupération des mentions'
      });
    }
  });

  /**
   * GET /mentions/me
   * Obtenir les mentions récentes de l'utilisateur actuel
   */
  fastify.get<{
    Querystring: UserMentionsQuery;
  }>('/mentions/me', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { limit } = request.query;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Authentification requise'
        });
      }

      const mentions = await mentionService.getRecentMentionsForUser(
        userId,
        limit || 50
      );

      const response: GetUserMentionsResponse = {
        success: true,
        data: mentions.map(mention => ({
          id: mention.id,
          messageId: mention.messageId,
          mentionedAt: mention.mentionedAt,
          message: {
            id: mention.message.id,
            content: mention.message.content,
            conversationId: mention.message.conversationId,
            senderId: mention.message.senderId,
            createdAt: mention.message.createdAt,
            sender: mention.message.sender ? {
              id: mention.message.sender.id,
              username: mention.message.sender.username,
              displayName: mention.message.sender.displayName,
              avatar: mention.message.sender.avatar
            } : null,
            conversation: {
              id: mention.message.conversation.id,
              title: mention.message.conversation.title,
              type: mention.message.conversation.type
            }
          }
        }))
      };

      return reply.send(response);
    } catch (error) {
      fastify.log.error('Error getting user mentions:', error);
      return reply.code(500).send({
        success: false,
        error: 'Erreur lors de la récupération des mentions'
      });
    }
  });
}
