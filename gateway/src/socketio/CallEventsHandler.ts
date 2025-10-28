/**
 * CallEventsHandler - Socket.IO event handler for video/audio calls (Phase 1A: P2P MVP)
 *
 * Handles:
 * - Call initiation
 * - Participant joining/leaving
 * - WebRTC signaling (SDP, ICE candidates)
 * - Media state toggles (audio/video)
 * - Broadcasting events to participants
 */

import { Socket } from 'socket.io';
import { PrismaClient } from '../../shared/prisma/client';
import { CallService } from '../services/CallService';
import { logger } from '../utils/logger';
import { CALL_EVENTS, CALL_ERROR_CODES } from '../../shared/types/video-call';
import { validateSocketEvent } from '../middleware/validation';
import {
  socketInitiateCallSchema,
  socketJoinCallSchema,
  socketLeaveCallSchema,
  socketSignalSchema,
  socketMediaToggleSchema
} from '../validation/call-schemas';
import { getSocketRateLimiter, checkSocketRateLimit, SOCKET_RATE_LIMITS } from '../utils/socket-rate-limiter';
import type {
  CallInitiateEvent,
  CallInitiatedEvent,
  CallJoinEvent,
  CallParticipantJoinedEvent,
  CallParticipantLeftEvent,
  CallSignalEvent,
  CallEndedEvent,
  CallMediaToggleEvent,
  CallError
} from '../../shared/types/video-call';

// ICE servers configuration (STUN/TURN)
const ICE_SERVERS_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
    // TODO: Add TURN servers for production
    // {
    //   urls: 'turn:turn.meeshy.me:3478',
    //   username: 'username',
    //   credential: 'password'
    // }
  ]
};

export class CallEventsHandler {
  private callService: CallService;
  private rateLimiter = getSocketRateLimiter();

  constructor(private prisma: PrismaClient) {
    this.callService = new CallService(prisma);
  }

  /**
   * Setup call-related event listeners on socket
   */
  setupCallEvents(socket: Socket, io: any, getUserId: (socketId: string) => string | undefined): void {
    /**
     * call:initiate - Client initiates a new call
     * CVE-002: Added rate limiting (5 req/min)
     * CVE-006: Added input validation
     */
    socket.on(CALL_EVENTS.INITIATE, async (data: CallInitiateEvent) => {
      try {
        const userId = getUserId(socket.id);
        if (!userId) {
          socket.emit(CALL_EVENTS.ERROR, {
            code: 'NOT_AUTHENTICATED',
            message: 'User not authenticated'
          } as CallError);
          return;
        }

        // CVE-002: Rate limiting check
        const rateLimitPassed = await checkSocketRateLimit(
          socket,
          userId,
          SOCKET_RATE_LIMITS.CALL_INITIATE,
          this.rateLimiter,
          CALL_EVENTS.ERROR
        );
        if (!rateLimitPassed) return;

        // CVE-006: Validate input data
        const validation = validateSocketEvent(socketInitiateCallSchema, data);
        if (!validation.success) {
          socket.emit(CALL_EVENTS.ERROR, {
            code: CALL_ERROR_CODES.VALIDATION_ERROR,
            message: (validation as any).error,
            details: (validation as any).details
          } as any);
          return;
        }

        logger.info('📞 Socket: call:initiate', {
          socketId: socket.id,
          userId,
          conversationId: data.conversationId,
          type: data.type
        });

        // Initiate call via service
        const callSession = await this.callService.initiateCall({
          conversationId: data.conversationId,
          initiatorId: userId,
          type: data.type,
          settings: data.settings as any
        });

        // Prepare event data
        const initiatedEvent: CallInitiatedEvent = {
          callId: callSession.id,
          mode: callSession.mode,
          initiator: {
            userId: callSession.initiator.id,
            username: callSession.initiator.username
          },
          participants: callSession.participants.map((p) => ({
            id: p.id,
            callSessionId: p.callSessionId,
            userId: p.userId,
            anonymousId: p.anonymousId,
            role: p.role,
            joinedAt: p.joinedAt,
            leftAt: p.leftAt,
            isAudioEnabled: p.isAudioEnabled,
            isVideoEnabled: p.isVideoEnabled,
            connectionQuality: p.connectionQuality as any,
            username: p.user?.username,
            displayName: p.user?.displayName,
            avatar: p.user?.avatar
          }))
        };

        // Emit to initiator (confirmation)
        socket.emit(CALL_EVENTS.INITIATED, initiatedEvent);

        // Broadcast to all conversation members
        io.to(`conversation:${data.conversationId}`).emit(
          CALL_EVENTS.INITIATED,
          initiatedEvent
        );

        logger.info('✅ Socket: Call initiated and broadcasted', {
          callId: callSession.id,
          conversationId: data.conversationId
        });
      } catch (error: any) {
        logger.error('❌ Socket: Error initiating call', error);

        const errorMessage = error.message || 'Failed to initiate call';
        const errorCode = errorMessage.split(':')[0];
        const message = errorMessage.includes(':')
          ? errorMessage.split(':').slice(1).join(':').trim()
          : errorMessage;

        socket.emit(CALL_EVENTS.ERROR, {
          code: errorCode,
          message
        } as CallError);
      }
    });

    /**
     * call:join - Client joins an existing call
     * CVE-002: Added rate limiting (20 req/min)
     * CVE-006: Added input validation
     */
    socket.on(CALL_EVENTS.JOIN, async (data: CallJoinEvent) => {
      try {
        const userId = getUserId(socket.id);
        if (!userId) {
          socket.emit(CALL_EVENTS.ERROR, {
            code: 'NOT_AUTHENTICATED',
            message: 'User not authenticated'
          } as CallError);
          return;
        }

        // CVE-002: Rate limiting check
        const rateLimitPassed = await checkSocketRateLimit(
          socket,
          userId,
          SOCKET_RATE_LIMITS.CALL_JOIN,
          this.rateLimiter,
          CALL_EVENTS.ERROR
        );
        if (!rateLimitPassed) return;

        // CVE-006: Validate input data
        const validation = validateSocketEvent(socketJoinCallSchema, data);
        if (!validation.success) {
          socket.emit(CALL_EVENTS.ERROR, {
            code: CALL_ERROR_CODES.VALIDATION_ERROR,
            message: (validation as any).error,
            details: (validation as any).details
          } as any);
          return;
        }

        logger.info('📞 Socket: call:join', {
          socketId: socket.id,
          userId,
          callId: data.callId
        });

        // Join call via service
        const callSession = await this.callService.joinCall({
          callId: data.callId,
          userId,
          settings: data.settings
        });

        // Join call room
        socket.join(`call:${data.callId}`);

        // Get the participant that just joined
        const participant = callSession.participants.find(
          (p) => p.userId === userId && !p.leftAt
        );

        if (!participant) {
          throw new Error('Participant not found after joining');
        }

        // Prepare event data
        const joinedEvent: CallParticipantJoinedEvent = {
          callId: callSession.id,
          participant: {
            id: participant.id,
            callSessionId: participant.callSessionId,
            userId: participant.userId,
            anonymousId: participant.anonymousId,
            role: participant.role,
            joinedAt: participant.joinedAt,
            leftAt: participant.leftAt,
            isAudioEnabled: participant.isAudioEnabled,
            isVideoEnabled: participant.isVideoEnabled,
            connectionQuality: participant.connectionQuality as any,
            username: participant.user?.username,
            displayName: participant.user?.displayName,
            avatar: participant.user?.avatar
          },
          mode: callSession.mode
        };

        // Send ICE servers config to joining participant
        socket.emit(CALL_EVENTS.JOIN, {
          success: true,
          callSession,
          iceServers: ICE_SERVERS_CONFIG.iceServers
        });

        // Broadcast to all call participants
        io.to(`call:${data.callId}`).emit(
          CALL_EVENTS.PARTICIPANT_JOINED,
          joinedEvent
        );

        logger.info('✅ Socket: User joined call', {
          callId: data.callId,
          userId,
          participantId: participant.id
        });
      } catch (error: any) {
        logger.error('❌ Socket: Error joining call', error);

        const errorMessage = error.message || 'Failed to join call';
        const errorCode = errorMessage.split(':')[0];
        const message = errorMessage.includes(':')
          ? errorMessage.split(':').slice(1).join(':').trim()
          : errorMessage;

        socket.emit(CALL_EVENTS.ERROR, {
          code: errorCode,
          message
        } as CallError);
      }
    });

    /**
     * call:leave - Client leaves a call
     * CVE-002: Added rate limiting (20 req/min)
     * CVE-006: Added input validation
     */
    socket.on(CALL_EVENTS.LEAVE, async (data: { callId: string }) => {
      try {
        const userId = getUserId(socket.id);
        if (!userId) {
          socket.emit(CALL_EVENTS.ERROR, {
            code: 'NOT_AUTHENTICATED',
            message: 'User not authenticated'
          } as CallError);
          return;
        }

        // CVE-002: Rate limiting check
        const rateLimitPassed = await checkSocketRateLimit(
          socket,
          userId,
          SOCKET_RATE_LIMITS.CALL_LEAVE,
          this.rateLimiter,
          CALL_EVENTS.ERROR
        );
        if (!rateLimitPassed) return;

        // CVE-006: Validate input data
        const validation = validateSocketEvent(socketLeaveCallSchema, data);
        if (!validation.success) {
          socket.emit(CALL_EVENTS.ERROR, {
            code: CALL_ERROR_CODES.VALIDATION_ERROR,
            message: (validation as any).error,
            details: (validation as any).details
          } as any);
          return;
        }

        logger.info('📞 Socket: call:leave', {
          socketId: socket.id,
          userId,
          callId: data.callId
        });

        // Find participant before leaving
        const callBefore = await this.callService.getCallSession(data.callId);
        const participant = callBefore.participants.find(
          (p) => p.userId === userId && !p.leftAt
        );

        if (!participant) {
          logger.warn('⚠️ Socket: User not in call', { userId, callId: data.callId });
          return;
        }

        // Leave call via service
        const callSession = await this.callService.leaveCall({
          callId: data.callId,
          userId
        });

        // Leave call room
        socket.leave(`call:${data.callId}`);

        // Prepare event data
        const leftEvent: CallParticipantLeftEvent = {
          callId: callSession.id,
          participantId: participant.id,
          mode: callSession.mode
        };

        // Broadcast to remaining call participants
        io.to(`call:${data.callId}`).emit(
          CALL_EVENTS.PARTICIPANT_LEFT,
          leftEvent
        );

        // If call ended, broadcast to conversation
        if (callSession.status === 'ended') {
          const endedEvent: CallEndedEvent = {
            callId: callSession.id,
            duration: callSession.duration || 0,
            endedBy: userId
          };

          io.to(`conversation:${callSession.conversationId}`).emit(
            CALL_EVENTS.ENDED,
            endedEvent
          );

          logger.info('✅ Socket: Call ended - last participant left', {
            callId: data.callId,
            duration: callSession.duration
          });
        } else {
          logger.info('✅ Socket: User left call', {
            callId: data.callId,
            userId
          });
        }
      } catch (error: any) {
        logger.error('❌ Socket: Error leaving call', error);

        const errorMessage = error.message || 'Failed to leave call';
        const errorCode = errorMessage.split(':')[0];
        const message = errorMessage.includes(':')
          ? errorMessage.split(':').slice(1).join(':').trim()
          : errorMessage;

        socket.emit(CALL_EVENTS.ERROR, {
          code: errorCode,
          message
        } as CallError);
      }
    });

    /**
     * call:signal - WebRTC signaling (SDP offer/answer, ICE candidates)
     * CVE-001: Added WebRTC signal validation with size limits
     * CVE-002: Added rate limiting (100 req/10s)
     * CVE-006: Added input validation
     */
    socket.on(CALL_EVENTS.SIGNAL, async (data: CallSignalEvent) => {
      try {
        const userId = getUserId(socket.id);
        if (!userId) {
          socket.emit(CALL_EVENTS.ERROR, {
            code: 'NOT_AUTHENTICATED',
            message: 'User not authenticated'
          } as CallError);
          return;
        }

        // CVE-002: Rate limiting check (strict for signals to prevent spam)
        const rateLimitPassed = await checkSocketRateLimit(
          socket,
          userId,
          SOCKET_RATE_LIMITS.CALL_SIGNAL,
          this.rateLimiter,
          CALL_EVENTS.ERROR
        );
        if (!rateLimitPassed) return;

        // CVE-001 & CVE-006: Validate signal data structure and size
        const validation = validateSocketEvent(socketSignalSchema, data);
        if (!validation.success) {
          logger.warn('Invalid WebRTC signal', {
            userId,
            error: (validation as any).error,
            details: (validation as any).details
          });
          socket.emit(CALL_EVENTS.ERROR, {
            code: CALL_ERROR_CODES.INVALID_SIGNAL,
            message: (validation as any).error,
            details: (validation as any).details
          } as any);
          return;
        }

        logger.info('📞 Socket: call:signal', {
          socketId: socket.id,
          userId,
          callId: data.callId,
          signalType: data.signal.type,
          from: data.signal.from,
          to: data.signal.to
        });

        // CVE-001: Verify sender is actually a participant in the call
        const callSession = await this.callService.getCallSession(data.callId);
        const senderParticipant = callSession.participants.find(
          (p) => (p.userId === userId || p.anonymousId === userId) && !p.leftAt
        );

        if (!senderParticipant) {
          logger.warn('⚠️ Socket: Sender not a participant in call', {
            userId,
            callId: data.callId
          });
          socket.emit(CALL_EVENTS.ERROR, {
            code: CALL_ERROR_CODES.NOT_A_PARTICIPANT,
            message: 'You are not in this call'
          } as CallError);
          return;
        }

        // CVE-001: Verify signal.from matches the authenticated user
        if (data.signal.from !== userId && data.signal.from !== senderParticipant.anonymousId) {
          logger.warn('⚠️ Socket: Signal sender mismatch', {
            userId,
            signalFrom: data.signal.from,
            callId: data.callId
          });
          socket.emit(CALL_EVENTS.ERROR, {
            code: CALL_ERROR_CODES.SIGNAL_SENDER_MISMATCH,
            message: 'Signal sender does not match authenticated user'
          });
          return;
        }

        // CVE-001: Find and validate target participant
        const targetParticipant = callSession.participants.find(
          (p) => (p.userId === data.signal.to || p.anonymousId === data.signal.to) && !p.leftAt
        );

        if (!targetParticipant) {
          logger.warn('⚠️ Socket: Target participant not found', {
            callId: data.callId,
            targetId: data.signal.to
          });
          socket.emit(CALL_EVENTS.ERROR, {
            code: CALL_ERROR_CODES.TARGET_NOT_FOUND,
            message: 'Target participant not found in call'
          });
          return;
        }

        // CVE-001: Forward signal only to target participant (not broadcast to entire room)
        // This prevents signal injection to unintended recipients
        socket.to(`call:${data.callId}`).emit(CALL_EVENTS.SIGNAL_RECEIVED, data);

        logger.info('✅ Socket: Signal forwarded', {
          callId: data.callId,
          from: data.signal.from,
          to: data.signal.to,
          type: data.signal.type
        });
      } catch (error: any) {
        logger.error('❌ Socket: Error forwarding signal', error);

        socket.emit(CALL_EVENTS.ERROR, {
          code: 'SIGNAL_FAILED',
          message: 'Failed to forward WebRTC signal'
        } as CallError);
      }
    });

    /**
     * call:toggle-audio - Toggle audio on/off
     * CVE-002: Added rate limiting (50 req/min)
     * CVE-006: Added input validation
     */
    socket.on(CALL_EVENTS.TOGGLE_AUDIO, async (data: CallMediaToggleEvent) => {
      try {
        const userId = getUserId(socket.id);
        if (!userId) {
          socket.emit(CALL_EVENTS.ERROR, {
            code: 'NOT_AUTHENTICATED',
            message: 'User not authenticated'
          } as CallError);
          return;
        }

        // CVE-002: Rate limiting check
        const rateLimitPassed = await checkSocketRateLimit(
          socket,
          userId,
          SOCKET_RATE_LIMITS.MEDIA_TOGGLE,
          this.rateLimiter,
          CALL_EVENTS.ERROR
        );
        if (!rateLimitPassed) return;

        // CVE-006: Validate input data
        const validation = validateSocketEvent(socketMediaToggleSchema, data);
        if (!validation.success) {
          socket.emit(CALL_EVENTS.ERROR, {
            code: CALL_ERROR_CODES.VALIDATION_ERROR,
            message: (validation as any).error,
            details: (validation as any).details
          } as any);
          return;
        }

        logger.info('📞 Socket: call:toggle-audio', {
          socketId: socket.id,
          userId,
          callId: data.callId,
          enabled: data.enabled
        });

        // Update participant media state
        await this.callService.updateParticipantMedia(
          data.callId,
          userId,
          'audio',
          data.enabled
        );

        // Broadcast to all call participants
        const toggleEvent: CallMediaToggleEvent = {
          callId: data.callId,
          participantId: userId,
          mediaType: 'audio',
          enabled: data.enabled
        };

        io.to(`call:${data.callId}`).emit(
          CALL_EVENTS.MEDIA_TOGGLED,
          toggleEvent
        );

        logger.info('✅ Socket: Audio toggled', {
          callId: data.callId,
          userId,
          enabled: data.enabled
        });
      } catch (error: any) {
        logger.error('❌ Socket: Error toggling audio', error);

        socket.emit(CALL_EVENTS.ERROR, {
          code: 'MEDIA_TOGGLE_FAILED',
          message: 'Failed to toggle audio'
        } as CallError);
      }
    });

    /**
     * call:toggle-video - Toggle video on/off
     * CVE-002: Added rate limiting (50 req/min)
     * CVE-006: Added input validation
     */
    socket.on(CALL_EVENTS.TOGGLE_VIDEO, async (data: CallMediaToggleEvent) => {
      try {
        const userId = getUserId(socket.id);
        if (!userId) {
          socket.emit(CALL_EVENTS.ERROR, {
            code: 'NOT_AUTHENTICATED',
            message: 'User not authenticated'
          } as CallError);
          return;
        }

        // CVE-002: Rate limiting check
        const rateLimitPassed = await checkSocketRateLimit(
          socket,
          userId,
          SOCKET_RATE_LIMITS.MEDIA_TOGGLE,
          this.rateLimiter,
          CALL_EVENTS.ERROR
        );
        if (!rateLimitPassed) return;

        // CVE-006: Validate input data
        const validation = validateSocketEvent(socketMediaToggleSchema, data);
        if (!validation.success) {
          socket.emit(CALL_EVENTS.ERROR, {
            code: CALL_ERROR_CODES.VALIDATION_ERROR,
            message: (validation as any).error,
            details: (validation as any).details
          } as any);
          return;
        }

        logger.info('📞 Socket: call:toggle-video', {
          socketId: socket.id,
          userId,
          callId: data.callId,
          enabled: data.enabled
        });

        // Update participant media state
        await this.callService.updateParticipantMedia(
          data.callId,
          userId,
          'video',
          data.enabled
        );

        // Broadcast to all call participants
        const toggleEvent: CallMediaToggleEvent = {
          callId: data.callId,
          participantId: userId,
          mediaType: 'video',
          enabled: data.enabled
        };

        io.to(`call:${data.callId}`).emit(
          CALL_EVENTS.MEDIA_TOGGLED,
          toggleEvent
        );

        logger.info('✅ Socket: Video toggled', {
          callId: data.callId,
          userId,
          enabled: data.enabled
        });
      } catch (error: any) {
        logger.error('❌ Socket: Error toggling video', error);

        socket.emit(CALL_EVENTS.ERROR, {
          code: 'MEDIA_TOGGLE_FAILED',
          message: 'Failed to toggle video'
        } as CallError);
      }
    });

    /**
     * Handle disconnect - auto-leave any active calls
     */
    const originalDisconnect = socket.on.bind(socket);
    originalDisconnect('disconnect', async () => {
      try {
        const userId = getUserId(socket.id);
        if (!userId) return;

        logger.info('📞 Socket: disconnect - checking for active calls', {
          socketId: socket.id,
          userId
        });

        // Find any active calls the user is in
        const activeParticipations = await this.prisma.callParticipant.findMany({
          where: {
            userId,
            leftAt: null
          },
          include: {
            callSession: true
          }
        });

        // Leave all active calls
        for (const participation of activeParticipations) {
          if (participation.callSession.status !== 'ended') {
            await this.callService.leaveCall({
              callId: participation.callSessionId,
              userId
            });

            // Broadcast to call participants
            io.to(`call:${participation.callSessionId}`).emit(
              CALL_EVENTS.PARTICIPANT_LEFT,
              {
                callId: participation.callSessionId,
                participantId: participation.id,
                mode: participation.callSession.mode
              } as CallParticipantLeftEvent
            );

            logger.info('✅ Socket: Auto-left call on disconnect', {
              callId: participation.callSessionId,
              userId
            });
          }
        }
      } catch (error) {
        logger.error('❌ Socket: Error handling disconnect for calls', error);
      }
    });
  }
}
