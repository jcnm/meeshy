/**
 * Call Routes - REST API for video/audio calls (Phase 1A: P2P MVP)
 *
 * Endpoints:
 * - POST   /api/calls                          - Initiate new call
 * - GET    /api/calls/:callId                  - Get call details
 * - DELETE /api/calls/:callId                  - End call
 * - POST   /api/calls/:callId/participants     - Join call
 * - DELETE /api/calls/:callId/participants/:participantId - Leave call
 * - GET    /api/conversations/:conversationId/active-call - Get active call
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createUnifiedAuthMiddleware, UnifiedAuthRequest } from '../middleware/auth.js';
import { CallService } from '../services/CallService.js';
import { logger } from '../utils/logger.js';

interface CallParams {
  callId: string;
}

interface ParticipantParams {
  callId: string;
  participantId: string;
}

interface ConversationParams {
  conversationId: string;
}

interface InitiateCallBody {
  conversationId: string;
  type: 'video' | 'audio';
  settings?: {
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    screenShareEnabled?: boolean;
  };
}

interface JoinCallBody {
  settings?: {
    audioEnabled?: boolean;
    videoEnabled?: boolean;
  };
}

export default async function callRoutes(fastify: FastifyInstance) {
  // Get decorated prisma instance
  const prisma = fastify.prisma;

  // Initialize CallService
  const callService = new CallService(prisma);

  // Authentication middleware (required for all routes)
  const requiredAuth = createUnifiedAuthMiddleware(prisma, {
    requireAuth: true,
    allowAnonymous: false
  });

  /**
   * POST /api/calls
   * Initiate a new call
   */
  fastify.post<{
    Body: InitiateCallBody;
  }>('/calls', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { conversationId, type, settings } = request.body;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      // Validate required fields
      if (!conversationId || !type) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'conversationId and type are required'
          }
        });
      }

      // Validate call type
      if (type !== 'video' && type !== 'audio') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'type must be "video" or "audio"'
          }
        });
      }

      logger.info('📞 REST: Initiating call', { conversationId, userId, type });

      const callSession = await callService.initiateCall({
        conversationId,
        initiatorId: userId,
        type,
        settings
      });

      return reply.status(201).send({
        success: true,
        data: callSession
      });
    } catch (error: any) {
      logger.error('❌ REST: Error initiating call', error);

      // Extract error code if present
      const errorMessage = error.message || 'Failed to initiate call';
      const errorCode = errorMessage.split(':')[0];
      const message = errorMessage.includes(':')
        ? errorMessage.split(':').slice(1).join(':').trim()
        : errorMessage;

      return reply.status(400).send({
        success: false,
        error: {
          code: errorCode,
          message,
          details: error.details || undefined
        }
      });
    }
  });

  /**
   * GET /api/calls/:callId
   * Get call details
   */
  fastify.get<{
    Params: CallParams;
  }>('/calls/:callId', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { callId } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      logger.info('📞 REST: Getting call details', { callId, userId });

      const callSession = await callService.getCallSession(callId);

      // Verify user has access to this call (is member of conversation)
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: callSession.conversationId,
          userId,
          isActive: true
        }
      });

      if (!membership) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'NOT_A_PARTICIPANT',
            message: 'You do not have access to this call'
          }
        });
      }

      return reply.send({
        success: true,
        data: callSession
      });
    } catch (error: any) {
      logger.error('❌ REST: Error getting call', error);

      const errorMessage = error.message || 'Failed to get call';
      const errorCode = errorMessage.split(':')[0];
      const message = errorMessage.includes(':')
        ? errorMessage.split(':').slice(1).join(':').trim()
        : errorMessage;

      const statusCode = errorCode === 'CALL_NOT_FOUND' ? 404 : 400;

      return reply.status(statusCode).send({
        success: false,
        error: {
          code: errorCode,
          message
        }
      });
    }
  });

  /**
   * DELETE /api/calls/:callId
   * End call (force end)
   */
  fastify.delete<{
    Params: CallParams;
  }>('/calls/:callId', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { callId } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      logger.info('📞 REST: Ending call', { callId, userId });

      // Get call to verify permissions
      const call = await callService.getCallSession(callId);

      // Verify user is initiator or admin/moderator of conversation
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: call.conversationId,
          userId,
          isActive: true
        }
      });

      if (!membership) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'NOT_A_PARTICIPANT',
            message: 'You do not have access to this call'
          }
        });
      }

      // Only initiator or admin/moderator can end call
      const canEndCall =
        call.initiatorId === userId ||
        membership.role === 'admin' ||
        membership.role === 'moderator';

      if (!canEndCall) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Only the call initiator or conversation moderators can end the call'
          }
        });
      }

      const callSession = await callService.endCall(callId, userId);

      return reply.send({
        success: true,
        data: callSession
      });
    } catch (error: any) {
      logger.error('❌ REST: Error ending call', error);

      const errorMessage = error.message || 'Failed to end call';
      const errorCode = errorMessage.split(':')[0];
      const message = errorMessage.includes(':')
        ? errorMessage.split(':').slice(1).join(':').trim()
        : errorMessage;

      const statusCode = errorCode === 'CALL_NOT_FOUND' ? 404 : 400;

      return reply.status(statusCode).send({
        success: false,
        error: {
          code: errorCode,
          message
        }
      });
    }
  });

  /**
   * POST /api/calls/:callId/participants
   * Join call
   */
  fastify.post<{
    Params: CallParams;
    Body: JoinCallBody;
  }>('/calls/:callId/participants', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { callId } = request.params;
      const { settings } = request.body;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      logger.info('📞 REST: Joining call', { callId, userId });

      const callSession = await callService.joinCall({
        callId,
        userId,
        settings
      });

      return reply.send({
        success: true,
        data: callSession
      });
    } catch (error: any) {
      logger.error('❌ REST: Error joining call', error);

      const errorMessage = error.message || 'Failed to join call';
      const errorCode = errorMessage.split(':')[0];
      const message = errorMessage.includes(':')
        ? errorMessage.split(':').slice(1).join(':').trim()
        : errorMessage;

      const statusCode = errorCode === 'CALL_NOT_FOUND' ? 404 : 400;

      return reply.status(statusCode).send({
        success: false,
        error: {
          code: errorCode,
          message
        }
      });
    }
  });

  /**
   * DELETE /api/calls/:callId/participants/:participantId
   * Leave call
   */
  fastify.delete<{
    Params: ParticipantParams;
  }>('/calls/:callId/participants/:participantId', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { callId, participantId } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      logger.info('📞 REST: Leaving call', { callId, participantId, userId });

      // Verify user is leaving their own participation or has moderator rights
      if (participantId !== userId) {
        // Check if user is moderator
        const call = await callService.getCallSession(callId);
        const membership = await prisma.conversationMember.findFirst({
          where: {
            conversationId: call.conversationId,
            userId,
            isActive: true
          }
        });

        const isModerator =
          membership?.role === 'admin' || membership?.role === 'moderator';

        if (!isModerator) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'You can only leave your own participation'
            }
          });
        }
      }

      const callSession = await callService.leaveCall({
        callId,
        userId: participantId
      });

      return reply.send({
        success: true,
        data: callSession
      });
    } catch (error: any) {
      logger.error('❌ REST: Error leaving call', error);

      const errorMessage = error.message || 'Failed to leave call';
      const errorCode = errorMessage.split(':')[0];
      const message = errorMessage.includes(':')
        ? errorMessage.split(':').slice(1).join(':').trim()
        : errorMessage;

      const statusCode = errorCode === 'CALL_NOT_FOUND' ? 404 : 400;

      return reply.status(statusCode).send({
        success: false,
        error: {
          code: errorCode,
          message
        }
      });
    }
  });

  /**
   * GET /api/conversations/:conversationId/active-call
   * Get active call for conversation
   */
  fastify.get<{
    Params: ConversationParams;
  }>('/conversations/:conversationId/active-call', {
    preValidation: [requiredAuth]
  }, async (request, reply) => {
    try {
      const { conversationId } = request.params;
      const authRequest = request as UnifiedAuthRequest;
      const userId = authRequest.authContext.userId;

      logger.info('📞 REST: Getting active call for conversation', {
        conversationId,
        userId
      });

      // Verify user is member of conversation
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId,
          userId,
          isActive: true
        }
      });

      if (!membership) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'NOT_A_PARTICIPANT',
            message: 'You are not a member of this conversation'
          }
        });
      }

      const callSession = await callService.getActiveCallForConversation(
        conversationId
      );

      return reply.send({
        success: true,
        data: callSession
      });
    } catch (error: any) {
      logger.error('❌ REST: Error getting active call', error);

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get active call'
        }
      });
    }
  });
}
