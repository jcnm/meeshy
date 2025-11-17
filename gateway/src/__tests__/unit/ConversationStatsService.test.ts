import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConversationStatsService } from '../../services/ConversationStatsService';
import { createMockPrismaClient } from '../helpers/prisma-mock';

describe('ConversationStatsService', () => {
  let service: ConversationStatsService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = ConversationStatsService.getInstance();
    service.invalidate('conv-123'); // Clear cache between tests
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ConversationStatsService.getInstance();
      const instance2 = ConversationStatsService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('getActiveConversationIds', () => {
    it('should return active conversation IDs', () => {
      const ids = service.getActiveConversationIds();

      expect(Array.isArray(ids)).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('should invalidate cache for conversation', async () => {
      mockPrisma.message.groupBy = jest.fn().mockResolvedValue([]);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue({
        id: 'conv-123'
      });

      await service.getOrCompute(mockPrisma as any, 'conv-123', () => []);

      service.invalidate('conv-123');

      const ids = service.getActiveConversationIds();
      expect(ids).not.toContain('conv-123');
    });
  });

  describe('getOrCompute', () => {
    it('should compute stats for normal conversation', async () => {
      const mockMessages = [
        { originalLanguage: 'en', _count: { _all: 5 } },
        { originalLanguage: 'fr', _count: { _all: 3 } }
      ];

      const mockMembers = [
        { user: { id: 'user-1', systemLanguage: 'en' } },
        { user: { id: 'user-2', systemLanguage: 'fr' } }
      ];

      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue({
        id: 'conv-123'
      });
      mockPrisma.message.groupBy = jest.fn().mockResolvedValue(mockMessages);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue(mockMembers);

      const stats = await service.getOrCompute(
        mockPrisma as any,
        'conv-123',
        () => ['user-1']
      );

      expect(stats.messagesPerLanguage.en).toBe(5);
      expect(stats.messagesPerLanguage.fr).toBe(3);
      expect(stats.participantCount).toBe(2);
      expect(stats.participantsPerLanguage.en).toBe(1);
      expect(stats.participantsPerLanguage.fr).toBe(1);
    });

    it('should return cached stats on second call', async () => {
      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue({
        id: 'conv-123'
      });
      mockPrisma.message.groupBy = jest.fn().mockResolvedValue([]);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);

      await service.getOrCompute(mockPrisma as any, 'conv-123', () => []);
      await service.getOrCompute(mockPrisma as any, 'conv-123', () => []);

      expect(mockPrisma.message.groupBy).toHaveBeenCalledTimes(1);
    });

    it('should handle global conversation', async () => {
      const mockUsers = [
        { id: 'user-1', systemLanguage: 'en' },
        { id: 'user-2', systemLanguage: 'fr' }
      ];

      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue({
        id: 'global-id',
        identifier: 'meeshy'
      });
      mockPrisma.message.groupBy = jest.fn().mockResolvedValue([]);
      mockPrisma.user.findMany = jest.fn().mockResolvedValue(mockUsers);

      const stats = await service.getOrCompute(
        mockPrisma as any,
        'meeshy',
        () => []
      );

      expect(stats.participantCount).toBe(2);
      expect(stats.participantsPerLanguage).toBeDefined();
    });

    it('should return empty stats for non-existent conversation', async () => {
      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue(null);

      const stats = await service.getOrCompute(
        mockPrisma as any,
        'invalid-id',
        () => []
      );

      expect(stats.participantCount).toBe(0);
      expect(Object.keys(stats.messagesPerLanguage)).toHaveLength(0);
    });

    it('should include online users in stats', async () => {
      const mockMembers = [
        { user: { id: 'user-1', systemLanguage: 'en' }, userId: 'user-1' }
      ];

      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue({
        id: 'conv-123'
      });
      mockPrisma.message.groupBy = jest.fn().mockResolvedValue([]);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue(mockMembers);
      mockPrisma.user.findMany = jest.fn().mockResolvedValue([
        {
          id: 'user-1',
          username: 'user1',
          firstName: 'Test',
          lastName: 'User'
        }
      ]);

      const stats = await service.getOrCompute(
        mockPrisma as any,
        'conv-123',
        () => ['user-1']
      );

      expect(stats.onlineUsers).toHaveLength(1);
      expect(stats.onlineUsers[0].username).toBe('user1');
    });
  });

  describe('updateOnNewMessage', () => {
    it('should update message count incrementally', async () => {
      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue({
        id: 'conv-123'
      });
      mockPrisma.message.groupBy = jest.fn().mockResolvedValue([
        { originalLanguage: 'en', _count: { _all: 5 } }
      ]);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);

      await service.getOrCompute(mockPrisma as any, 'conv-123', () => []);

      const updatedStats = await service.updateOnNewMessage(
        mockPrisma as any,
        'conv-123',
        'en',
        () => []
      );

      expect(updatedStats.messagesPerLanguage.en).toBe(6);
    });

    it('should add new language if not present', async () => {
      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue({
        id: 'conv-123'
      });
      mockPrisma.message.groupBy = jest.fn().mockResolvedValue([]);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);

      await service.getOrCompute(mockPrisma as any, 'conv-123', () => []);

      const updatedStats = await service.updateOnNewMessage(
        mockPrisma as any,
        'conv-123',
        'es',
        () => []
      );

      expect(updatedStats.messagesPerLanguage.es).toBe(1);
    });

    it('should recompute if cache expired', async () => {
      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue({
        id: 'conv-123'
      });
      mockPrisma.message.groupBy = jest.fn().mockResolvedValue([]);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);

      service.invalidate('conv-123');

      const stats = await service.updateOnNewMessage(
        mockPrisma as any,
        'conv-123',
        'en',
        () => []
      );

      expect(stats).toBeDefined();
    });
  });

  describe('recompute', () => {
    it('should force recompute stats', async () => {
      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue({
        id: 'conv-123'
      });
      mockPrisma.message.groupBy = jest.fn().mockResolvedValue([]);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);

      await service.getOrCompute(mockPrisma as any, 'conv-123', () => []);
      await service.recompute(mockPrisma as any, 'conv-123', () => []);

      expect(mockPrisma.message.groupBy).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue({
        id: 'conv-123'
      });
      mockPrisma.message.groupBy = jest.fn().mockRejectedValue(new Error('DB error'));
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);

      const stats = await service.getOrCompute(
        mockPrisma as any,
        'conv-123',
        () => []
      );

      expect(stats.messagesPerLanguage).toEqual({});
    });

    it('should handle member query errors', async () => {
      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue({
        id: 'conv-123'
      });
      mockPrisma.message.groupBy = jest.fn().mockResolvedValue([]);
      mockPrisma.conversationMember.findMany = jest.fn().mockRejectedValue(new Error('DB error'));

      const stats = await service.getOrCompute(
        mockPrisma as any,
        'conv-123',
        () => []
      );

      expect(stats.participantCount).toBe(0);
    });

    it('should handle online users query errors', async () => {
      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue({
        id: 'conv-123'
      });
      mockPrisma.message.groupBy = jest.fn().mockResolvedValue([]);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.user.findMany = jest.fn().mockRejectedValue(new Error('DB error'));

      const stats = await service.getOrCompute(
        mockPrisma as any,
        'conv-123',
        () => ['user-1']
      );

      expect(stats.onlineUsers).toHaveLength(0);
    });
  });
});
