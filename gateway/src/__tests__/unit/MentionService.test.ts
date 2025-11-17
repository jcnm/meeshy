import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MentionService } from '../../services/MentionService';
import { createMockPrismaClient, createMockUser } from '../helpers/prisma-mock';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK')
  }));
});

describe('MentionService', () => {
  let service: MentionService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = new MentionService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('extractMentions', () => {
    it('should extract mentions from content', () => {
      const content = 'Hello @user1 and @user2!';
      const mentions = service.extractMentions(content);

      expect(mentions).toContain('user1');
      expect(mentions).toContain('user2');
      expect(mentions).toHaveLength(2);
    });

    it('should return unique mentions', () => {
      const content = '@user1 @user1 @user1';
      const mentions = service.extractMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toBe('user1');
    });

    it('should normalize mentions to lowercase', () => {
      const content = '@User1 @USER2';
      const mentions = service.extractMentions(content);

      expect(mentions).toContain('user1');
      expect(mentions).toContain('user2');
    });

    it('should reject invalid username formats', () => {
      const content = '@user-invalid @user.invalid @user@invalid';
      const mentions = service.extractMentions(content);

      expect(mentions).toHaveLength(0);
    });

    it('should handle empty content', () => {
      const mentions = service.extractMentions('');

      expect(mentions).toHaveLength(0);
    });

    it('should limit mentions to maximum allowed', () => {
      const content = Array(60).fill(0).map((_, i) => `@user${i}`).join(' ');
      const mentions = service.extractMentions(content);

      expect(mentions.length).toBeLessThanOrEqual(50);
    });

    it('should reject content exceeding max length', () => {
      const content = 'a'.repeat(10001) + '@user1';
      const mentions = service.extractMentions(content);

      expect(mentions).toHaveLength(0);
    });
  });

  describe('resolveUsernames', () => {
    it('should resolve usernames to users', async () => {
      const mockUsers = [
        createMockUser({ username: 'user1' }),
        createMockUser({ username: 'user2', id: 'user-456' })
      ];

      mockPrisma.user.findMany = jest.fn().mockResolvedValue(mockUsers);

      const result = await service.resolveUsernames(['user1', 'user2']);

      expect(result.size).toBe(2);
      expect(result.has('user1')).toBe(true);
      expect(result.has('user2')).toBe(true);
    });

    it('should handle case-insensitive resolution', async () => {
      const mockUsers = [createMockUser({ username: 'User1' })];

      mockPrisma.user.findMany = jest.fn().mockResolvedValue(mockUsers);

      const result = await service.resolveUsernames(['user1']);

      expect(result.size).toBe(1);
      expect(result.has('user1')).toBe(true);
    });

    it('should return empty map for empty input', async () => {
      const result = await service.resolveUsernames([]);

      expect(result.size).toBe(0);
    });
  });

  describe('getUserSuggestionsForConversation', () => {
    it('should return conversation members first', async () => {
      const mockMembers = [
        {
          userId: 'user-1',
          user: createMockUser({ id: 'user-1', username: 'member1' })
        }
      ];

      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue(mockMembers);
      mockPrisma.friendRequest.findMany = jest.fn().mockResolvedValue([]);

      const suggestions = await service.getUserSuggestionsForConversation(
        'conv-123',
        'current-user',
        ''
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].badge).toBe('conversation');
    });

    it('should exclude current user from suggestions', async () => {
      const mockMembers = [
        {
          userId: 'current-user',
          user: createMockUser({ id: 'current-user', username: 'current' })
        },
        {
          userId: 'other-user',
          user: createMockUser({ id: 'other-user', username: 'other' })
        }
      ];

      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue(mockMembers);
      mockPrisma.friendRequest.findMany = jest.fn().mockResolvedValue([]);

      const suggestions = await service.getUserSuggestionsForConversation(
        'conv-123',
        'current-user',
        ''
      );

      const hasCurrentUser = suggestions.some(s => s.id === 'current-user');
      expect(hasCurrentUser).toBe(false);
    });

    it('should include friends not in conversation', async () => {
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.friendRequest.findMany = jest.fn().mockResolvedValue([
        {
          senderId: 'current-user',
          receiverId: 'friend-1',
          status: 'accepted',
          receiver: createMockUser({ id: 'friend-1', username: 'friend' })
        }
      ]);

      const suggestions = await service.getUserSuggestionsForConversation(
        'conv-123',
        'current-user',
        ''
      );

      const friendSuggestion = suggestions.find(s => s.id === 'friend-1');
      expect(friendSuggestion).toBeDefined();
      expect(friendSuggestion?.badge).toBe('friend');
    });

    it('should filter suggestions by query', async () => {
      const mockMembers = [
        {
          userId: 'user-1',
          user: createMockUser({ id: 'user-1', username: 'alice' })
        },
        {
          userId: 'user-2',
          user: createMockUser({ id: 'user-2', username: 'bob' })
        }
      ];

      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue(mockMembers);
      mockPrisma.friendRequest.findMany = jest.fn().mockResolvedValue([]);

      const suggestions = await service.getUserSuggestionsForConversation(
        'conv-123',
        'current-user',
        'ali'
      );

      expect(suggestions.length).toBe(1);
      expect(suggestions[0].username).toBe('alice');
    });

    it('should limit suggestions to maximum', async () => {
      const mockMembers = Array(20).fill(0).map((_, i) => ({
        userId: `user-${i}`,
        user: createMockUser({ id: `user-${i}`, username: `user${i}` })
      }));

      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue(mockMembers);
      mockPrisma.friendRequest.findMany = jest.fn().mockResolvedValue([]);

      const suggestions = await service.getUserSuggestionsForConversation(
        'conv-123',
        'current-user',
        ''
      );

      expect(suggestions.length).toBeLessThanOrEqual(10);
    });
  });

  describe('validateMentionPermissions', () => {
    it('should validate mentions in direct conversation', async () => {
      const mockConversation = {
        id: 'conv-123',
        type: 'direct',
        members: [
          { userId: 'sender', isActive: true },
          { userId: 'recipient', isActive: true }
        ]
      };

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);

      const result = await service.validateMentionPermissions(
        'conv-123',
        ['recipient'],
        'sender'
      );

      expect(result.isValid).toBe(true);
      expect(result.validUserIds).toContain('recipient');
    });

    it('should reject mentions of non-members in group', async () => {
      const mockConversation = {
        id: 'conv-123',
        type: 'group',
        members: [
          { userId: 'member1', isActive: true }
        ]
      };

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);

      const result = await service.validateMentionPermissions(
        'conv-123',
        ['member1', 'non-member'],
        'member1'
      );

      expect(result.isValid).toBe(false);
      expect(result.validUserIds).toContain('member1');
      expect(result.validUserIds).not.toContain('non-member');
    });

    it('should allow mentions of all users in public conversation', async () => {
      const mockConversation = {
        id: 'conv-123',
        type: 'public',
        members: []
      };

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.user.findMany = jest.fn().mockResolvedValue([
        { id: 'user1' },
        { id: 'user2' }
      ]);

      const result = await service.validateMentionPermissions(
        'conv-123',
        ['user1', 'user2'],
        'sender'
      );

      expect(result.isValid).toBe(true);
      expect(result.validUserIds).toHaveLength(2);
    });

    it('should return error for non-existent conversation', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.validateMentionPermissions(
        'invalid-id',
        ['user1'],
        'sender'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Conversation non trouvée');
    });

    it('should handle empty mention list', async () => {
      const result = await service.validateMentionPermissions(
        'conv-123',
        [],
        'sender'
      );

      expect(result.isValid).toBe(true);
      expect(result.validUserIds).toHaveLength(0);
    });
  });

  describe('createMentions', () => {
    it('should create mention records', async () => {
      mockPrisma.mention.create = jest.fn().mockResolvedValue({
        id: 'mention-1',
        messageId: 'msg-123',
        mentionedUserId: 'user-1'
      });

      await service.createMentions('msg-123', ['user-1', 'user-2']);

      expect(mockPrisma.mention.create).toHaveBeenCalledTimes(2);
    });

    it('should handle empty user list', async () => {
      await service.createMentions('msg-123', []);

      expect(mockPrisma.mention.create).not.toHaveBeenCalled();
    });

    it('should ignore duplicate errors', async () => {
      mockPrisma.mention.create = jest.fn()
        .mockRejectedValueOnce({ code: 'P2002' })
        .mockResolvedValueOnce({ id: 'mention-2' });

      await service.createMentions('msg-123', ['user-1', 'user-2']);

      expect(mockPrisma.mention.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMentionsForMessage', () => {
    it('should return mentioned users', async () => {
      const mockMentions = [
        {
          mentionedUser: createMockUser({ id: 'user-1', username: 'user1' })
        },
        {
          mentionedUser: createMockUser({ id: 'user-2', username: 'user2' })
        }
      ];

      mockPrisma.mention.findMany = jest.fn().mockResolvedValue(mockMentions);

      const users = await service.getMentionsForMessage('msg-123');

      expect(users).toHaveLength(2);
      expect(users[0].username).toBe('user1');
    });
  });

  describe('getRecentMentionsForUser', () => {
    it('should return recent mentions', async () => {
      const mockMentions = [
        {
          message: {
            id: 'msg-1',
            content: 'Test',
            conversationId: 'conv-1',
            senderId: 'sender-1',
            createdAt: new Date(),
            sender: createMockUser({ id: 'sender-1' }),
            conversation: {
              id: 'conv-1',
              title: 'Test Conv',
              type: 'group'
            }
          }
        }
      ];

      mockPrisma.mention.findMany = jest.fn().mockResolvedValue(mockMentions);

      const mentions = await service.getRecentMentionsForUser('user-123', 10);

      expect(mentions).toHaveLength(1);
    });
  });

  describe('canMentionUser', () => {
    it('should allow mentioning members in private conversation', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue({
        type: 'group'
      });
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue({
        userId: 'user-1',
        isActive: true
      });

      const canMention = await service.canMentionUser('conv-123', 'user-1');

      expect(canMention).toBe(true);
    });

    it('should allow mentioning any active user in public conversation', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue({
        type: 'public'
      });
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        isActive: true,
        deletedAt: null
      });

      const canMention = await service.canMentionUser('conv-123', 'user-1');

      expect(canMention).toBe(true);
    });

    it('should reject mentioning non-members in private conversation', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue({
        type: 'group'
      });
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(null);

      const canMention = await service.canMentionUser('conv-123', 'user-1');

      expect(canMention).toBe(false);
    });

    it('should return false for non-existent conversation', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(null);

      const canMention = await service.canMentionUser('invalid-id', 'user-1');

      expect(canMention).toBe(false);
    });
  });

  describe('invalidateCacheForConversation', () => {
    it('should invalidate cache entries', async () => {
      const mockRedis = {
        keys: jest.fn().mockResolvedValue(['key1', 'key2']),
        del: jest.fn().mockResolvedValue(2)
      };

      (service as any).redis = mockRedis;

      await service.invalidateCacheForConversation('conv-123');

      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});
