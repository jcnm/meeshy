/**
 * CallService - Business logic for video/audio calls (Phase 1A: P2P MVP)
 *
 * Handles:
 * - Call initiation (P2P mode only)
 * - Participant joining/leaving
 * - Call state management
 * - Validation (DIRECT/GROUP conversations only)
 */

import { PrismaClient, CallMode, CallStatus, ParticipantRole, Prisma } from '../../shared/prisma/client';
import { logger } from '../utils/logger';
import { CALL_ERROR_CODES } from '../../shared/types/video-call';

// Type for CallSession with populated participants
type CallSessionWithParticipants = Prisma.CallSessionGetPayload<{
  include: {
    participants: {
      include: {
        user: {
          select: {
            id: true;
            username: true;
            displayName: true;
            avatar: true;
          };
        };
      };
    };
    initiator: {
      select: {
        id: true;
        username: true;
        displayName: true;
        avatar: true;
      };
    };
    conversation: {
      select: {
        id: true;
        identifier: true;
        type: true;
      };
    };
  };
}>;

interface InitiateCallData {
  conversationId: string;
  initiatorId: string;
  type: 'video' | 'audio';
  settings?: {
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    screenShareEnabled?: boolean;
  };
}

interface JoinCallData {
  callId: string;
  userId: string;
  settings?: {
    audioEnabled?: boolean;
    videoEnabled?: boolean;
  };
}

interface LeaveCallData {
  callId: string;
  userId: string;
}

export class CallService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Initiate a new video call
   * - Validates conversation exists and type is DIRECT or GROUP
   * - Creates CallSession with mode='p2p' and status='initiated'
   * - Creates CallParticipant for initiator
   * - Returns CallSession with participants
   */
  async initiateCall(data: InitiateCallData): Promise<CallSessionWithParticipants> {
    const { conversationId, initiatorId, type, settings } = data;

    logger.info('📞 Initiating call', { conversationId, initiatorId, type });

    // Validate conversation exists
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, type: true, identifier: true }
    });

    if (!conversation) {
      logger.error('❌ Conversation not found', { conversationId });
      throw new Error(`${CALL_ERROR_CODES.CONVERSATION_NOT_FOUND}: Conversation not found`);
    }

    // Validate conversation type (only DIRECT and GROUP support video calls)
    if (conversation.type !== 'direct' && conversation.type !== 'group') {
      logger.error('❌ Video calls not supported for this conversation type', {
        conversationId,
        type: conversation.type
      });
      throw new Error(
        `${CALL_ERROR_CODES.VIDEO_CALLS_NOT_SUPPORTED}: Video calls are only supported for DIRECT and GROUP conversations`
      );
    }

    // Check if user is member of conversation
    const membership = await this.prisma.conversationMember.findFirst({
      where: {
        conversationId,
        userId: initiatorId,
        isActive: true
      }
    });

    if (!membership) {
      logger.error('❌ User is not a participant in conversation', {
        conversationId,
        initiatorId
      });
      throw new Error(`${CALL_ERROR_CODES.NOT_A_PARTICIPANT}: You are not a participant in this conversation`);
    }

    // Check if there's already an active call
    const activeCall = await this.prisma.callSession.findFirst({
      where: {
        conversationId,
        status: { in: ['initiated', 'ringing', 'active'] }
      }
    });

    if (activeCall) {
      logger.error('❌ Call already active', { conversationId, callId: activeCall.id });
      throw new Error(`${CALL_ERROR_CODES.CALL_ALREADY_ACTIVE}: A call is already active in this conversation`);
    }

    // Create call session with participant in a transaction
    const callSession = await this.prisma.$transaction(async (tx) => {
      // Create call session
      const session = await tx.callSession.create({
        data: {
          conversationId,
          initiatorId,
          mode: CallMode.p2p, // Phase 1A: P2P only
          status: CallStatus.initiated,
          metadata: {
            type, // 'video' or 'audio'
            ...settings
          }
        }
      });

      // Create participant for initiator
      await tx.callParticipant.create({
        data: {
          callSessionId: session.id,
          userId: initiatorId,
          role: ParticipantRole.initiator,
          isAudioEnabled: settings?.audioEnabled ?? true,
          isVideoEnabled: type === 'video' ? (settings?.videoEnabled ?? true) : false
        }
      });

      return session;
    });

    logger.info('✅ Call initiated successfully', {
      callId: callSession.id,
      conversationId,
      initiatorId
    });

    // Fetch and return complete call session with participants
    return this.getCallSession(callSession.id);
  }

  /**
   * Join an existing call
   * - Validates call exists and status is 'initiated' or 'active'
   * - Validates user is participant of conversation
   * - Creates CallParticipant for joiner
   * - Updates call status to 'active' if was 'initiated'
   * - Returns updated CallSession
   */
  async joinCall(data: JoinCallData): Promise<CallSessionWithParticipants> {
    const { callId, userId, settings } = data;

    logger.info('📞 User joining call', { callId, userId });

    // Validate call exists
    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      include: { conversation: true, participants: true }
    });

    if (!call) {
      logger.error('❌ Call not found', { callId });
      throw new Error(`${CALL_ERROR_CODES.CALL_NOT_FOUND}: Call session not found`);
    }

    // Validate call is not ended
    if (call.status === CallStatus.ended) {
      logger.error('❌ Call has ended', { callId });
      throw new Error(`${CALL_ERROR_CODES.CALL_ENDED}: This call has already ended`);
    }

    // Check if user is member of conversation
    const membership = await this.prisma.conversationMember.findFirst({
      where: {
        conversationId: call.conversationId,
        userId,
        isActive: true
      }
    });

    if (!membership) {
      logger.error('❌ User is not a participant in conversation', {
        conversationId: call.conversationId,
        userId
      });
      throw new Error(`${CALL_ERROR_CODES.NOT_A_PARTICIPANT}: You are not a participant in this conversation`);
    }

    // Check if user is already in the call
    const existingParticipant = call.participants.find(
      (p) => p.userId === userId && !p.leftAt
    );

    if (existingParticipant) {
      logger.warn('⚠️ User already in call', { callId, userId });
      // Return current state
      return this.getCallSession(callId);
    }

    // Phase 1A: Enforce P2P mode (max 2 participants)
    const activeParticipants = call.participants.filter((p) => !p.leftAt);
    if (activeParticipants.length >= 2) {
      logger.error('❌ Max participants reached for P2P call', {
        callId,
        activeParticipants: activeParticipants.length
      });
      throw new Error(
        `${CALL_ERROR_CODES.MAX_PARTICIPANTS_REACHED}: Maximum participants (2) reached for P2P calls`
      );
    }

    // Join call in transaction
    await this.prisma.$transaction(async (tx) => {
      // Create participant
      await tx.callParticipant.create({
        data: {
          callSessionId: callId,
          userId,
          role: ParticipantRole.participant,
          isAudioEnabled: settings?.audioEnabled ?? true,
          isVideoEnabled: settings?.videoEnabled ?? true
        }
      });

      // Update call status to 'active' if it was 'initiated'
      if (call.status === CallStatus.initiated) {
        await tx.callSession.update({
          where: { id: callId },
          data: {
            status: CallStatus.active,
            answeredAt: new Date()
          }
        });
      }
    });

    logger.info('✅ User joined call successfully', { callId, userId });

    return this.getCallSession(callId);
  }

  /**
   * Leave a call
   * - Updates CallParticipant.leftAt
   * - If last participant, end call (status='ended', endedAt=now)
   * - Returns updated CallSession
   */
  async leaveCall(data: LeaveCallData): Promise<CallSessionWithParticipants> {
    const { callId, userId } = data;

    logger.info('📞 User leaving call', { callId, userId });

    // Find the participant
    const participant = await this.prisma.callParticipant.findFirst({
      where: {
        callSessionId: callId,
        userId,
        leftAt: null
      }
    });

    if (!participant) {
      logger.error('❌ Participant not found or already left', { callId, userId });
      throw new Error(`${CALL_ERROR_CODES.CALL_NOT_FOUND}: You are not in this call`);
    }

    // Get call with all participants
    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      include: { participants: true }
    });

    if (!call) {
      logger.error('❌ Call not found', { callId });
      throw new Error(`${CALL_ERROR_CODES.CALL_NOT_FOUND}: Call session not found`);
    }

    const leftAt = new Date();

    // Check if this is the last active participant
    const activeParticipants = call.participants.filter((p) => !p.leftAt && p.id !== participant.id);
    const isLastParticipant = activeParticipants.length === 0;

    // Update in transaction
    await this.prisma.$transaction(async (tx) => {
      // Update participant left time
      await tx.callParticipant.update({
        where: { id: participant.id },
        data: { leftAt }
      });

      // If last participant, end the call
      if (isLastParticipant) {
        const duration = Math.floor(
          (leftAt.getTime() - call.startedAt.getTime()) / 1000
        );

        await tx.callSession.update({
          where: { id: callId },
          data: {
            status: CallStatus.ended,
            endedAt: leftAt,
            duration
          }
        });

        logger.info('✅ Call ended - last participant left', { callId, duration });
      }
    });

    logger.info('✅ User left call successfully', { callId, userId });

    return this.getCallSession(callId);
  }

  /**
   * Get call session details with participants
   */
  async getCallSession(callId: string): Promise<CallSessionWithParticipants> {
    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      include: {
        participants: {
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
        },
        initiator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true
          }
        },
        conversation: {
          select: {
            id: true,
            identifier: true,
            type: true
          }
        }
      }
    });

    if (!call) {
      logger.error('❌ Call not found', { callId });
      throw new Error(`${CALL_ERROR_CODES.CALL_NOT_FOUND}: Call session not found`);
    }

    return call;
  }

  /**
   * End call (force end by moderator or system)
   */
  async endCall(callId: string, endedBy: string): Promise<CallSessionWithParticipants> {
    logger.info('📞 Ending call', { callId, endedBy });

    const call = await this.prisma.callSession.findUnique({
      where: { id: callId }
    });

    if (!call) {
      logger.error('❌ Call not found', { callId });
      throw new Error(`${CALL_ERROR_CODES.CALL_NOT_FOUND}: Call session not found`);
    }

    if (call.status === CallStatus.ended) {
      logger.warn('⚠️ Call already ended', { callId });
      return this.getCallSession(callId);
    }

    const endedAt = new Date();
    const duration = Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000);

    // End call in transaction
    await this.prisma.$transaction(async (tx) => {
      // Update all active participants
      await tx.callParticipant.updateMany({
        where: {
          callSessionId: callId,
          leftAt: null
        },
        data: { leftAt: endedAt }
      });

      // Update call status
      await tx.callSession.update({
        where: { id: callId },
        data: {
          status: CallStatus.ended,
          endedAt,
          duration,
          metadata: {
            ...(call.metadata as any),
            endedBy
          }
        }
      });
    });

    logger.info('✅ Call ended successfully', { callId, duration, endedBy });

    return this.getCallSession(callId);
  }

  /**
   * Get active call for conversation
   */
  async getActiveCallForConversation(conversationId: string): Promise<CallSessionWithParticipants | null> {
    const call = await this.prisma.callSession.findFirst({
      where: {
        conversationId,
        status: { in: [CallStatus.initiated, CallStatus.ringing, CallStatus.active] }
      },
      include: {
        participants: {
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
        },
        initiator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true
          }
        },
        conversation: {
          select: {
            id: true,
            identifier: true,
            type: true
          }
        }
      }
    });

    return call;
  }

  /**
   * Update participant media state (audio/video toggle)
   */
  async updateParticipantMedia(
    callId: string,
    userId: string,
    mediaType: 'audio' | 'video',
    enabled: boolean
  ): Promise<CallSessionWithParticipants> {
    logger.info('📞 Updating participant media state', {
      callId,
      userId,
      mediaType,
      enabled
    });

    // Find the participant
    const participant = await this.prisma.callParticipant.findFirst({
      where: {
        callSessionId: callId,
        userId,
        leftAt: null
      }
    });

    if (!participant) {
      logger.error('❌ Participant not found or already left', { callId, userId });
      throw new Error(`${CALL_ERROR_CODES.CALL_NOT_FOUND}: You are not in this call`);
    }

    // Update media state
    await this.prisma.callParticipant.update({
      where: { id: participant.id },
      data:
        mediaType === 'audio'
          ? { isAudioEnabled: enabled }
          : { isVideoEnabled: enabled }
    });

    logger.info('✅ Participant media state updated', {
      callId,
      userId,
      mediaType,
      enabled
    });

    return this.getCallSession(callId);
  }
}
