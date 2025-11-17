/**
 * MLS Routes - REST API endpoints for MLS operations
 *
 * Provides HTTP API for:
 * - KeyPackage management
 * - Conversation initialization
 * - MLS statistics and health
 * - Audit logs
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MLSService } from '../services/MLSService';
import { createUnifiedAuthMiddleware } from '../middleware/auth';

/**
 * Register MLS routes
 *
 * @param fastify - Fastify instance
 */
export async function mlsRoutes(fastify: FastifyInstance) {
  // Create MLS service instance
  const mlsService = new MLSService((fastify as any).prisma);

  // Create auth middleware
  const authenticate = createUnifiedAuthMiddleware((fastify as any).prisma);

  // ============================================================================
  // KEYPACKAGE ROUTES
  // ============================================================================

  /**
   * GET /api/mls/key-packages/me
   * Get my available KeyPackages
   */
  fastify.get(
    '/key-packages/me',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: 'Not authenticated',
          });
        }

        const keyPackages = await mlsService.getAvailableKeyPackages(userId);

        return reply.send({
          success: true,
          data: keyPackages,
        });
      } catch (error: any) {
        console.error('[MLS] Error fetching KeyPackages:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Internal server error',
        });
      }
    }
  );

  /**
   * POST /api/mls/key-packages/generate
   * Generate new KeyPackages for current user
   */
  fastify.post(
    '/key-packages/generate',
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            count: { type: 'number', minimum: 1, maximum: 10 },
            cipherSuite: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: { count?: number; cipherSuite?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = (request as any).user?.id;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: 'Not authenticated',
          });
        }

        const { count, cipherSuite } = request.body;

        const result = await mlsService.generateKeyPackages({
          userId,
          count,
          cipherSuite: cipherSuite as any,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        console.error('[MLS] Error generating KeyPackages:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /api/mls/key-packages/:userId
   * Get an available KeyPackage for a specific user
   */
  fastify.get(
    '/key-packages/:userId',
    {
      preHandler: [authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { userId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.params;

        const keyPackage = await mlsService.fetchKeyPackage(userId);

        if (!keyPackage) {
          return reply.status(404).send({
            success: false,
            error: 'No available KeyPackage for this user',
          });
        }

        return reply.send({
          success: true,
          data: keyPackage,
        });
      } catch (error: any) {
        console.error('[MLS] Error fetching KeyPackage:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Internal server error',
        });
      }
    }
  );

  // ============================================================================
  // CONVERSATION ROUTES
  // ============================================================================

  /**
   * POST /api/mls/conversations/init
   * Initialize a conversation with MLS encryption
   */
  fastify.post(
    '/conversations/init',
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['recipientUserId'],
          properties: {
            recipientUserId: { type: 'string' },
            conversationId: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          recipientUserId: string;
          conversationId?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const initiatorUserId = (request as any).user?.id;

        if (!initiatorUserId) {
          return reply.status(401).send({
            success: false,
            error: 'Not authenticated',
          });
        }

        const { recipientUserId, conversationId: providedConvId } = request.body;

        let conversationId = providedConvId;

        // If no conversationId provided, create a new conversation
        if (!conversationId) {
          const conversation = await (fastify as any).prisma.conversation.create({
            data: {
              identifier: `dm_${initiatorUserId}_${recipientUserId}`,
              type: 'direct',
              members: {
                create: [
                  { userId: initiatorUserId, role: 'member' },
                  { userId: recipientUserId, role: 'member' },
                ],
              },
            },
          });
          conversationId = conversation.id;
        }

        // Initialize MLS for the conversation
        const mlsInfo = await mlsService.initializeOneToOneConversation({
          conversationId,
          initiatorUserId,
          recipientUserId,
        });

        return reply.send({
          success: true,
          data: mlsInfo,
        });
      } catch (error: any) {
        console.error('[MLS] Error initializing conversation:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /api/mls/conversations/:conversationId/group-state
   * Get MLS group state for a conversation
   */
  fastify.get(
    '/conversations/:conversationId/group-state',
    {
      preHandler: [authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { conversationId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { conversationId } = request.params;

        const groupState = await mlsService.getGroupState(conversationId);

        if (!groupState) {
          return reply.status(404).send({
            success: false,
            error: 'No MLS group state for this conversation',
          });
        }

        return reply.send({
          success: true,
          data: groupState,
        });
      } catch (error: any) {
        console.error('[MLS] Error fetching group state:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /api/mls/conversations/:conversationId/encrypted
   * Check if a conversation is encrypted
   */
  fastify.get(
    '/conversations/:conversationId/encrypted',
    {
      preHandler: [authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { conversationId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { conversationId } = request.params;

        const isEncrypted = await mlsService.isConversationEncrypted(
          conversationId
        );

        return reply.send({
          success: true,
          data: {
            conversationId,
            isEncrypted,
          },
        });
      } catch (error: any) {
        console.error('[MLS] Error checking encryption status:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Internal server error',
        });
      }
    }
  );

  // ============================================================================
  // STATISTICS AND MONITORING ROUTES
  // ============================================================================

  /**
   * GET /api/mls/stats
   * Get MLS statistics
   */
  fastify.get(
    '/stats',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // TODO: Add admin check
        const stats = await mlsService.getStatistics();

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error: any) {
        console.error('[MLS] Error fetching statistics:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /api/mls/health
   * Get MLS health status
   */
  fastify.get(
    '/health',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // TODO: Add admin check
        const health = await mlsService.getHealthStatus();

        return reply.send({
          success: true,
          data: health,
        });
      } catch (error: any) {
        console.error('[MLS] Error fetching health status:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /api/mls/audit/:conversationId
   * Get audit events for a conversation
   */
  fastify.get(
    '/audit/:conversationId',
    {
      preHandler: [authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 1000 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { conversationId: string };
        Querystring: { limit?: number };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { conversationId } = request.params;
        const { limit } = request.query;

        const events = await mlsService.getAuditEventsForConversation(
          conversationId,
          limit
        );

        return reply.send({
          success: true,
          data: events,
        });
      } catch (error: any) {
        console.error('[MLS] Error fetching audit events:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Internal server error',
        });
      }
    }
  );

  // ============================================================================
  // MAINTENANCE ROUTES
  // ============================================================================

  /**
   * POST /api/mls/maintenance
   * Run maintenance tasks (admin only)
   */
  fastify.post(
    '/maintenance',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // TODO: Add admin check
        const result = await mlsService.runMaintenance();

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        console.error('[MLS] Error running maintenance:', error);
        return reply.status(500).send({
          success: false,
          error: error.message || 'Internal server error',
        });
      }
    }
  );
}
