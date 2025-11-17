import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReactionService } from '../../services/ReactionService';
import { createMockPrismaClient } from '../helpers/prisma-mock';

// Mock dependencies
jest.mock('../../shared/types/reaction', () => ({
  sanitizeEmoji: jest.fn((emoji: string) => emoji),
  isValidEmoji: jest.fn(() => true)
}));

describe('ReactionService', () => {
  let service: ReactionService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = new ReactionService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('addReaction', () => {
    it('should add reaction successfully', async () => {
      const mockMessage = {
        id: 'msg-123',
        conversationId: 'conv-123',
        conversation: {
          members: [{ userId: 'user-123' }],
          anonymousParticipants: []
        }
      };

      const mockReaction = {
        id: 'reaction-123',
        messageId: 'msg-123',
        userId: 'user-123',
        anonymousUserId: null,
        emoji: '👍',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.message.findUnique = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.reaction.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.reaction.create = jest.fn().mockResolvedValue(mockReaction);

      const result = await service.addReaction({
        messageId: 'msg-123',
        userId: 'user-123',
        emoji: '👍'
      });

      expect(result).toBeDefined();
      expect(result?.emoji).toBe('👍');
      expect(mockPrisma.reaction.create).toHaveBeenCalled();
    });

    it('should return existing reaction if already exists', async () => {
      const mockMessage = {
        id: 'msg-123',
        conversationId: 'conv-123',
        conversation: {
          members: [{ userId: 'user-123' }],
          anonymousParticipants: []
        }
      };

      const existingReaction = {
        id: 'reaction-123',
        messageId: 'msg-123',
        userId: 'user-123',
        anonymousUserId: null,
        emoji: '👍',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.message.findUnique = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.reaction.findFirst = jest.fn().mockResolvedValue(existingReaction);

      const result = await service.addReaction({
        messageId: 'msg-123',
        userId: 'user-123',
        emoji: '👍'
      });

      expect(result).toBeDefined();
      expect(mockPrisma.reaction.create).not.toHaveBeenCalled();
    });

    it('should throw error if message not found', async () => {
      mockPrisma.message.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.addReaction({
        messageId: 'invalid-id',
        userId: 'user-123',
        emoji: '👍'
      })).rejects.toThrow('Message not found');
    });

    it('should throw error if user not a member', async () => {
      const mockMessage = {
        id: 'msg-123',
        conversationId: 'conv-123',
        conversation: {
          members: [{ userId: 'other-user' }],
          anonymousParticipants: []
        }
      };

      mockPrisma.message.findUnique = jest.fn().mockResolvedValue(mockMessage);

      await expect(service.addReaction({
        messageId: 'msg-123',
        userId: 'user-123',
        emoji: '👍'
      })).rejects.toThrow('not a member');
    });

    it('should support anonymous reactions', async () => {
      const mockMessage = {
        id: 'msg-123',
        conversationId: 'conv-123',
        conversation: {
          members: [],
          anonymousParticipants: [{ id: 'anon-123' }]
        }
      };

      const mockReaction = {
        id: 'reaction-123',
        messageId: 'msg-123',
        userId: null,
        anonymousUserId: 'anon-123',
        emoji: '👍',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.message.findUnique = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.reaction.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.reaction.create = jest.fn().mockResolvedValue(mockReaction);

      const result = await service.addReaction({
        messageId: 'msg-123',
        anonymousUserId: 'anon-123',
        emoji: '👍'
      });

      expect(result).toBeDefined();
      expect(result?.anonymousUserId).toBe('anon-123');
    });
  });

  describe('removeReaction', () => {
    it('should remove reaction successfully', async () => {
      mockPrisma.reaction.deleteMany = jest.fn().mockResolvedValue({ count: 1 });

      const result = await service.removeReaction({
        messageId: 'msg-123',
        userId: 'user-123',
        emoji: '👍'
      });

      expect(result).toBe(true);
      expect(mockPrisma.reaction.deleteMany).toHaveBeenCalledWith({
        where: {
          messageId: 'msg-123',
          userId: 'user-123',
          emoji: '👍'
        }
      });
    });

    it('should return false if no reaction found', async () => {
      mockPrisma.reaction.deleteMany = jest.fn().mockResolvedValue({ count: 0 });

      const result = await service.removeReaction({
        messageId: 'msg-123',
        userId: 'user-123',
        emoji: '👍'
      });

      expect(result).toBe(false);
    });
  });

  describe('getMessageReactions', () => {
    it('should return aggregated reactions', async () => {
      const mockReactions = [
        {
          id: 'r1',
          messageId: 'msg-123',
          userId: 'user-1',
          anonymousUserId: null,
          emoji: '👍',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'r2',
          messageId: 'msg-123',
          userId: 'user-2',
          anonymousUserId: null,
          emoji: '👍',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'r3',
          messageId: 'msg-123',
          userId: 'user-3',
          anonymousUserId: null,
          emoji: '❤️',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.reaction.findMany = jest.fn().mockResolvedValue(mockReactions);

      const result = await service.getMessageReactions({
        messageId: 'msg-123',
        currentUserId: 'user-1'
      });

      expect(result.messageId).toBe('msg-123');
      expect(result.reactions).toHaveLength(2); // Two different emojis
      expect(result.totalCount).toBe(3);
      expect(result.userReactions).toContain('👍');

      const thumbsUp = result.reactions.find(r => r.emoji === '👍');
      expect(thumbsUp?.count).toBe(2);
      expect(thumbsUp?.hasCurrentUser).toBe(true);
    });

    it('should handle empty reactions', async () => {
      mockPrisma.reaction.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.getMessageReactions({ messageId: 'msg-123' });

      expect(result.reactions).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should track anonymous user reactions', async () => {
      const mockReactions = [
        {
          id: 'r1',
          messageId: 'msg-123',
          userId: null,
          anonymousUserId: 'anon-1',
          emoji: '👍',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.reaction.findMany = jest.fn().mockResolvedValue(mockReactions);

      const result = await service.getMessageReactions({
        messageId: 'msg-123',
        currentAnonymousUserId: 'anon-1'
      });

      const thumbsUp = result.reactions.find(r => r.emoji === '👍');
      expect(thumbsUp?.hasCurrentUser).toBe(true);
      expect(thumbsUp?.anonymousUserIds).toContain('anon-1');
    });
  });

  describe('getEmojiAggregation', () => {
    it('should return aggregation for specific emoji', async () => {
      const mockReactions = [
        {
          id: 'r1',
          messageId: 'msg-123',
          userId: 'user-1',
          anonymousUserId: null,
          emoji: '👍',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'r2',
          messageId: 'msg-123',
          userId: 'user-2',
          anonymousUserId: null,
          emoji: '👍',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.reaction.findMany = jest.fn().mockResolvedValue(mockReactions);

      const result = await service.getEmojiAggregation('msg-123', '👍', 'user-1');

      expect(result.emoji).toBe('👍');
      expect(result.count).toBe(2);
      expect(result.hasCurrentUser).toBe(true);
      expect(result.userIds).toContain('user-1');
      expect(result.userIds).toContain('user-2');
    });
  });

  describe('getUserReactions', () => {
    it('should return user reactions', async () => {
      const mockReactions = [
        {
          id: 'r1',
          messageId: 'msg-1',
          userId: 'user-123',
          anonymousUserId: null,
          emoji: '👍',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.reaction.findMany = jest.fn().mockResolvedValue(mockReactions);

      const results = await service.getUserReactions('user-123');

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('user-123');
    });
  });

  describe('hasUserReacted', () => {
    it('should return true if user has reacted', async () => {
      mockPrisma.reaction.findFirst = jest.fn().mockResolvedValue({
        id: 'r1',
        messageId: 'msg-123',
        userId: 'user-123',
        emoji: '👍'
      });

      const result = await service.hasUserReacted('msg-123', '👍', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false if user has not reacted', async () => {
      mockPrisma.reaction.findFirst = jest.fn().mockResolvedValue(null);

      const result = await service.hasUserReacted('msg-123', '👍', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('deleteMessageReactions', () => {
    it('should delete all reactions for a message', async () => {
      mockPrisma.reaction.deleteMany = jest.fn().mockResolvedValue({ count: 5 });

      const count = await service.deleteMessageReactions('msg-123');

      expect(count).toBe(5);
      expect(mockPrisma.reaction.deleteMany).toHaveBeenCalledWith({
        where: { messageId: 'msg-123' }
      });
    });
  });

  describe('createUpdateEvent', () => {
    it('should create update event for WebSocket', async () => {
      const mockReactions = [
        {
          id: 'r1',
          messageId: 'msg-123',
          userId: 'user-123',
          anonymousUserId: null,
          emoji: '👍',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.reaction.findMany = jest.fn().mockResolvedValue(mockReactions);

      const event = await service.createUpdateEvent('msg-123', '👍', 'add', 'user-123');

      expect(event.messageId).toBe('msg-123');
      expect(event.emoji).toBe('👍');
      expect(event.action).toBe('add');
      expect(event.userId).toBe('user-123');
      expect(event.aggregation).toBeDefined();
    });
  });

  describe('validation', () => {
    it('should validate add reaction options', () => {
      expect(() => service.validateAddReactionOptions({
        messageId: 'msg-123',
        userId: 'user-123',
        emoji: '👍'
      })).not.toThrow();
    });

    it('should throw error for missing messageId', () => {
      expect(() => service.validateAddReactionOptions({
        messageId: '',
        userId: 'user-123',
        emoji: '👍'
      })).toThrow('messageId is required');
    });

    it('should throw error for missing userId and anonymousUserId', () => {
      expect(() => service.validateAddReactionOptions({
        messageId: 'msg-123',
        emoji: '👍'
      })).toThrow('Either userId or anonymousUserId must be provided');
    });

    it('should validate remove reaction options', () => {
      expect(() => service.validateRemoveReactionOptions({
        messageId: 'msg-123',
        userId: 'user-123',
        emoji: '👍'
      })).not.toThrow();
    });
  });
});
