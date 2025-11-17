import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CallService } from '../../services/CallService';
import { TURNCredentialService } from '../../services/TURNCredentialService';
import { createMockPrismaClient } from '../helpers/prisma-mock';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../services/TURNCredentialService');

describe('CallService', () => {
  let service: CallService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let mockTurnService: jest.Mocked<TURNCredentialService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = new CallService(mockPrisma as any);

    mockTurnService = {
      generateCredentials: jest.fn().mockReturnValue([
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' }
      ])
    } as any;

    (service as any).turnCredentialService = mockTurnService;

    jest.clearAllMocks();
  });

  describe('initiateCall', () => {
    it('should initiate call successfully', async () => {
      const mockConversation = {
        id: 'conv-123',
        type: 'direct',
        identifier: 'conv-123'
      };

      const mockMembership = {
        userId: 'user-123',
        conversationId: 'conv-123',
        isActive: true
      };

      const mockCall = {
        id: 'call-123',
        conversationId: 'conv-123',
        initiatorId: 'user-123',
        mode: 'p2p',
        status: 'initiated',
        startedAt: new Date()
      };

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMembership);
      mockPrisma.callSession.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.$transaction = jest.fn().mockResolvedValue(mockCall);
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        ...mockCall,
        participants: [],
        initiator: { id: 'user-123', username: 'test' },
        conversation: mockConversation
      });

      const result = await service.initiateCall({
        conversationId: 'conv-123',
        initiatorId: 'user-123',
        type: 'video'
      });

      expect(result).toBeDefined();
      expect(result.initiatorId).toBe('user-123');
    });

    it('should reject call for non-existent conversation', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.initiateCall({
        conversationId: 'invalid-id',
        initiatorId: 'user-123',
        type: 'video'
      })).rejects.toThrow('Conversation not found');
    });

    it('should reject call for unsupported conversation type', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue({
        id: 'conv-123',
        type: 'public'
      });

      await expect(service.initiateCall({
        conversationId: 'conv-123',
        initiatorId: 'user-123',
        type: 'video'
      })).rejects.toThrow('only supported for DIRECT and GROUP');
    });

    it('should reject if user not a member', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue({
        id: 'conv-123',
        type: 'direct'
      });
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.initiateCall({
        conversationId: 'conv-123',
        initiatorId: 'user-123',
        type: 'video'
      })).rejects.toThrow('not a participant');
    });

    it('should reject if call already active', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue({
        id: 'conv-123',
        type: 'direct'
      });
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue({
        userId: 'user-123',
        isActive: true
      });
      mockPrisma.callSession.findFirst = jest.fn().mockResolvedValue({
        id: 'existing-call',
        status: 'active',
        participants: [{ userId: 'user-123', leftAt: null }]
      });

      await expect(service.initiateCall({
        conversationId: 'conv-123',
        initiatorId: 'user-123',
        type: 'video'
      })).rejects.toThrow('already active');
    });

    it('should clean up zombie calls before initiating new call', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue({
        id: 'conv-123',
        type: 'direct'
      });
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue({
        userId: 'user-123',
        isActive: true
      });
      mockPrisma.callSession.findFirst = jest.fn().mockResolvedValue({
        id: 'zombie-call',
        status: 'active',
        startedAt: new Date(),
        participants: [{ userId: 'user-456', leftAt: new Date() }] // All left
      });
      mockPrisma.callSession.update = jest.fn().mockResolvedValue({});
      mockPrisma.$transaction = jest.fn().mockResolvedValue({ id: 'new-call' });
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        id: 'new-call',
        participants: [],
        initiator: {},
        conversation: {}
      });

      await service.initiateCall({
        conversationId: 'conv-123',
        initiatorId: 'user-123',
        type: 'video'
      });

      expect(mockPrisma.callSession.update).toHaveBeenCalled();
    });
  });

  describe('joinCall', () => {
    it('should join call successfully', async () => {
      const mockCall = {
        id: 'call-123',
        conversationId: 'conv-123',
        status: 'initiated',
        conversation: { id: 'conv-123' },
        participants: []
      };

      const mockMembership = {
        userId: 'user-456',
        conversationId: 'conv-123',
        isActive: true
      };

      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue(mockCall);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMembership);
      mockPrisma.$transaction = jest.fn().mockResolvedValue(undefined);
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        ...mockCall,
        participants: [],
        initiator: {},
        conversation: {}
      });

      const result = await service.joinCall({
        callId: 'call-123',
        userId: 'user-456'
      });

      expect(result.callSession).toBeDefined();
      expect(result.iceServers).toBeDefined();
      expect(mockTurnService.generateCredentials).toHaveBeenCalledWith('user-456');
    });

    it('should reject joining non-existent call', async () => {
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.joinCall({
        callId: 'invalid-id',
        userId: 'user-123'
      })).rejects.toThrow('Call session not found');
    });

    it('should reject joining ended call', async () => {
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        id: 'call-123',
        status: 'ended',
        conversation: {}
      });

      await expect(service.joinCall({
        callId: 'call-123',
        userId: 'user-123'
      })).rejects.toThrow('already ended');
    });

    it('should reject if user not a member', async () => {
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        id: 'call-123',
        conversationId: 'conv-123',
        status: 'active',
        conversation: {},
        participants: []
      });
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.joinCall({
        callId: 'call-123',
        userId: 'user-123'
      })).rejects.toThrow('not a participant');
    });

    it('should handle user already in call', async () => {
      mockPrisma.callSession.findUnique = jest.fn()
        .mockResolvedValueOnce({
          id: 'call-123',
          conversationId: 'conv-123',
          status: 'active',
          conversation: {},
          participants: [{ userId: 'user-123', leftAt: null }]
        })
        .mockResolvedValueOnce({
          id: 'call-123',
          participants: [],
          initiator: {},
          conversation: {}
        });
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue({
        userId: 'user-123',
        isActive: true
      });

      const result = await service.joinCall({
        callId: 'call-123',
        userId: 'user-123'
      });

      expect(result.callSession).toBeDefined();
    });

    it('should reject if max participants reached', async () => {
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        id: 'call-123',
        conversationId: 'conv-123',
        status: 'active',
        conversation: {},
        participants: [
          { userId: 'user-1', leftAt: null },
          { userId: 'user-2', leftAt: null }
        ]
      });
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue({
        userId: 'user-123',
        isActive: true
      });

      await expect(service.joinCall({
        callId: 'call-123',
        userId: 'user-123'
      })).rejects.toThrow('Maximum participants');
    });
  });

  describe('leaveCall', () => {
    it('should leave call successfully', async () => {
      const mockParticipant = {
        id: 'participant-123',
        callSessionId: 'call-123',
        userId: 'user-123',
        leftAt: null
      };

      const mockCall = {
        id: 'call-123',
        startedAt: new Date(),
        participants: [mockParticipant, { id: 'p2', userId: 'user-456', leftAt: null }]
      };

      mockPrisma.callParticipant.findFirst = jest.fn().mockResolvedValue(mockParticipant);
      mockPrisma.callSession.findUnique = jest.fn()
        .mockResolvedValueOnce(mockCall)
        .mockResolvedValueOnce({
          ...mockCall,
          participants: [],
          initiator: {},
          conversation: {}
        });
      mockPrisma.$transaction = jest.fn().mockResolvedValue(undefined);

      const result = await service.leaveCall({
        callId: 'call-123',
        userId: 'user-123'
      });

      expect(result).toBeDefined();
    });

    it('should end call when last participant leaves', async () => {
      const mockParticipant = {
        id: 'participant-123',
        callSessionId: 'call-123',
        userId: 'user-123',
        leftAt: null
      };

      const mockCall = {
        id: 'call-123',
        startedAt: new Date(),
        participants: [mockParticipant] // Only one participant
      };

      mockPrisma.callParticipant.findFirst = jest.fn().mockResolvedValue(mockParticipant);
      mockPrisma.callSession.findUnique = jest.fn()
        .mockResolvedValueOnce(mockCall)
        .mockResolvedValueOnce({
          ...mockCall,
          participants: [],
          initiator: {},
          conversation: {}
        });
      mockPrisma.$transaction = jest.fn().mockResolvedValue(undefined);

      await service.leaveCall({
        callId: 'call-123',
        userId: 'user-123'
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should reject if participant not found', async () => {
      mockPrisma.callParticipant.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.leaveCall({
        callId: 'call-123',
        userId: 'user-123'
      })).rejects.toThrow('not in this call');
    });
  });

  describe('endCall', () => {
    it('should end call successfully', async () => {
      const mockCall = {
        id: 'call-123',
        initiatorId: 'user-123',
        status: 'active',
        startedAt: new Date(),
        participants: [
          { userId: 'user-123', role: 'initiator', leftAt: null }
        ],
        metadata: {}
      };

      mockPrisma.callSession.findUnique = jest.fn()
        .mockResolvedValueOnce(mockCall)
        .mockResolvedValueOnce({
          ...mockCall,
          participants: [],
          initiator: {},
          conversation: {}
        });
      mockPrisma.$transaction = jest.fn().mockResolvedValue(undefined);

      const result = await service.endCall('call-123', 'user-123');

      expect(result).toBeDefined();
    });

    it('should reject if anonymous user tries to end call', async () => {
      await expect(service.endCall('call-123', 'anon-123', true))
        .rejects.toThrow('Anonymous users cannot end calls');
    });

    it('should reject if user not in call', async () => {
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        id: 'call-123',
        status: 'active',
        participants: []
      });

      await expect(service.endCall('call-123', 'user-123'))
        .rejects.toThrow('not in this call');
    });

    it('should reject if non-initiator tries to end call', async () => {
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        id: 'call-123',
        status: 'active',
        participants: [
          { userId: 'user-123', role: 'participant', leftAt: null }
        ]
      });

      await expect(service.endCall('call-123', 'user-123'))
        .rejects.toThrow('Only the call initiator');
    });

    it('should handle already ended call', async () => {
      mockPrisma.callSession.findUnique = jest.fn()
        .mockResolvedValueOnce({
          id: 'call-123',
          status: 'ended',
          participants: []
        })
        .mockResolvedValueOnce({
          id: 'call-123',
          participants: [],
          initiator: {},
          conversation: {}
        });

      const result = await service.endCall('call-123', 'user-123');

      expect(result).toBeDefined();
    });
  });

  describe('getCallSession', () => {
    it('should return call session', async () => {
      const mockCall = {
        id: 'call-123',
        conversationId: 'conv-123',
        participants: [],
        initiator: {},
        conversation: {}
      };

      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue(mockCall);

      const result = await service.getCallSession('call-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('call-123');
    });

    it('should throw error for non-existent call', async () => {
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getCallSession('invalid-id'))
        .rejects.toThrow('Call session not found');
    });

    it('should authorize user access', async () => {
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        id: 'call-123',
        conversationId: 'conv-123',
        participants: [{ userId: 'user-123' }],
        initiator: {},
        conversation: {}
      });

      const result = await service.getCallSession('call-123', 'user-123');

      expect(result).toBeDefined();
    });

    it('should reject unauthorized access', async () => {
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        id: 'call-123',
        conversationId: 'conv-123',
        participants: [],
        initiator: {},
        conversation: {}
      });
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.getCallSession('call-123', 'user-999'))
        .rejects.toThrow('do not have access');
    });
  });

  describe('updateParticipantMedia', () => {
    it('should update audio state', async () => {
      const mockParticipant = {
        id: 'participant-123',
        callSessionId: 'call-123',
        userId: 'user-123',
        leftAt: null
      };

      mockPrisma.callParticipant.findFirst = jest.fn().mockResolvedValue(mockParticipant);
      mockPrisma.callParticipant.update = jest.fn().mockResolvedValue(mockParticipant);
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        id: 'call-123',
        participants: [],
        initiator: {},
        conversation: {}
      });

      const result = await service.updateParticipantMedia(
        'call-123',
        'user-123',
        'audio',
        false
      );

      expect(result).toBeDefined();
      expect(mockPrisma.callParticipant.update).toHaveBeenCalledWith({
        where: { id: 'participant-123' },
        data: { isAudioEnabled: false }
      });
    });

    it('should update video state', async () => {
      const mockParticipant = {
        id: 'participant-123',
        callSessionId: 'call-123',
        userId: 'user-123',
        leftAt: null
      };

      mockPrisma.callParticipant.findFirst = jest.fn().mockResolvedValue(mockParticipant);
      mockPrisma.callParticipant.update = jest.fn().mockResolvedValue(mockParticipant);
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        id: 'call-123',
        participants: [],
        initiator: {},
        conversation: {}
      });

      await service.updateParticipantMedia('call-123', 'user-123', 'video', true);

      expect(mockPrisma.callParticipant.update).toHaveBeenCalledWith({
        where: { id: 'participant-123' },
        data: { isVideoEnabled: true }
      });
    });
  });

  describe('markCallAsMissed', () => {
    it('should mark call as missed', async () => {
      mockPrisma.callSession.findUnique = jest.fn()
        .mockResolvedValueOnce({
          id: 'call-123',
          startedAt: new Date(),
          participants: [],
          initiator: {}
        })
        .mockResolvedValueOnce({
          id: 'call-123',
          participants: [],
          initiator: {},
          conversation: {}
        });
      mockPrisma.callSession.update = jest.fn().mockResolvedValue({});

      const result = await service.markCallAsMissed('call-123');

      expect(result).toBeDefined();
      expect(mockPrisma.callSession.update).toHaveBeenCalled();
    });
  });

  describe('markCallAsRejected', () => {
    it('should mark call as rejected', async () => {
      mockPrisma.callSession.findUnique = jest.fn()
        .mockResolvedValueOnce({
          id: 'call-123',
          startedAt: new Date(),
          participants: []
        })
        .mockResolvedValueOnce({
          id: 'call-123',
          participants: [],
          initiator: {},
          conversation: {}
        });
      mockPrisma.callSession.update = jest.fn().mockResolvedValue({});

      const result = await service.markCallAsRejected('call-123');

      expect(result).toBeDefined();
    });
  });

  describe('getActiveCallForConversation', () => {
    it('should return active call', async () => {
      mockPrisma.callSession.findFirst = jest.fn().mockResolvedValue({
        id: 'call-123',
        status: 'active',
        participants: [],
        initiator: {},
        conversation: {}
      });

      const result = await service.getActiveCallForConversation('conv-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('call-123');
    });

    it('should return null if no active call', async () => {
      mockPrisma.callSession.findFirst = jest.fn().mockResolvedValue(null);

      const result = await service.getActiveCallForConversation('conv-123');

      expect(result).toBeNull();
    });
  });

  describe('getUnrespondedParticipants', () => {
    it('should return unresponded participants', async () => {
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue({
        id: 'call-123',
        initiatorId: 'initiator-id',
        participants: [
          { userId: 'participant-1' }
        ],
        conversation: {
          members: [
            { userId: 'initiator-id', isActive: true },
            { userId: 'participant-1', isActive: true },
            { userId: 'participant-2', isActive: true }
          ]
        }
      });

      const result = await service.getUnrespondedParticipants('call-123');

      expect(result).toContain('participant-2');
      expect(result).not.toContain('initiator-id');
      expect(result).not.toContain('participant-1');
    });

    it('should return empty array for non-existent call', async () => {
      mockPrisma.callSession.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.getUnrespondedParticipants('invalid-id');

      expect(result).toEqual([]);
    });
  });
});
