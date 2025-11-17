import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MessagingService } from '../../services/MessagingService';
import { TranslationService } from '../../services/TranslationService';
import { createMockPrismaClient, createMockUser, createMockConversation, createMockMessage, createMockConversationMember } from '../helpers/prisma-mock';

// Mock dependencies
jest.mock('../../services/TranslationService');
jest.mock('../../services/TrackingLinkService');
jest.mock('../../services/MentionService');
jest.mock('../../services/ConversationStatsService');
jest.mock('../../services/MLSService');
jest.mock('../../services/ServerKeyManager');
jest.mock('../../utils/logger');

describe('MessagingService', () => {
  let service: MessagingService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let mockTranslationService: jest.Mocked<TranslationService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    mockTranslationService = {
      handleNewMessage: jest.fn().mockResolvedValue({ status: 'pending' })
    } as any;
    service = new MessagingService(mockPrisma as any, mockTranslationService);
    jest.clearAllMocks();
  });

  describe('handleMessage', () => {
    it('should handle a plaintext message successfully', async () => {
      const mockConversation = createMockConversation({ encryptionMode: 'none' });
      const mockMessage = createMockMessage();
      const mockMember = createMockConversationMember();

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMember);
      mockPrisma.message.create = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.conversation.update = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.messageStatus.upsert = jest.fn().mockResolvedValue({});
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([mockMember]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([]);

      const request = {
        conversationId: 'conv-123',
        content: 'Test message',
        originalLanguage: 'en'
      };

      const result = await service.handleMessage(request, 'user-123', true, 'jwt-token');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockPrisma.message.create).toHaveBeenCalled();
    });

    it('should reject message with empty content', async () => {
      const request = {
        conversationId: 'conv-123',
        content: '',
        originalLanguage: 'en'
      };

      const result = await service.handleMessage(request, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject message exceeding length limit', async () => {
      const request = {
        conversationId: 'conv-123',
        content: 'a'.repeat(2001),
        originalLanguage: 'en'
      };

      const result = await service.handleMessage(request, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('2000');
    });

    it('should handle conversation not found', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(null);

      const request = {
        conversationId: 'invalid-id',
        content: 'Test',
        originalLanguage: 'en'
      };

      const result = await service.handleMessage(request, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Conversation non trouvée');
    });

    it('should handle insufficient permissions', async () => {
      const mockConversation = createMockConversation({ encryptionMode: 'none' });
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(null);

      const request = {
        conversationId: 'conv-123',
        content: 'Test message',
        originalLanguage: 'en'
      };

      const result = await service.handleMessage(request, 'user-123', true, 'jwt-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('permissions');
    });
  });

  describe('handlePlaintextMessage', () => {
    it('should process plaintext message with mentions', async () => {
      const mockConversation = createMockConversation({ encryptionMode: 'none' });
      const mockMessage = createMockMessage({ content: 'Hello @user' });
      const mockMember = createMockConversationMember();

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMember);
      mockPrisma.message.create = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.conversation.update = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.messageStatus.upsert = jest.fn().mockResolvedValue({});
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([mockMember]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([]);

      const request = {
        conversationId: 'conv-123',
        content: 'Hello @user',
        originalLanguage: 'en',
        mentionedUserIds: ['user-456']
      };

      const result = await service.handleMessage(request, 'user-123', true, 'jwt-token');

      expect(result.success).toBe(true);
      expect(mockPrisma.message.create).toHaveBeenCalled();
    });
  });

  describe('handleHybridMessage', () => {
    it('should fallback to plaintext when no encrypted data provided', async () => {
      const mockConversation = createMockConversation({ encryptionMode: 'hybrid' });
      const mockMessage = createMockMessage();
      const mockMember = createMockConversationMember();

      mockPrisma.conversation.findUnique = jest.fn()
        .mockResolvedValueOnce({ ...mockConversation, members: [{ user: { allowServerSideTranslationAt: new Date() } }] })
        .mockResolvedValueOnce(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMember);
      mockPrisma.message.create = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.conversation.update = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.messageStatus.upsert = jest.fn().mockResolvedValue({});
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([mockMember]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([]);

      const request = {
        conversationId: 'conv-123',
        content: 'Test message',
        originalLanguage: 'en',
        encrypted: false
      };

      const result = await service.handleMessage(request, 'user-123', true, 'jwt-token');

      expect(result.success).toBe(true);
    });
  });

  describe('handleE2EOnlyMessage', () => {
    it('should reject E2E message without encrypted data', async () => {
      const mockConversation = createMockConversation({ encryptionMode: 'e2e_only' });
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(createMockConversationMember());

      const request = {
        conversationId: 'conv-123',
        content: 'Test',
        originalLanguage: 'en',
        encrypted: false
      };

      const result = await service.handleMessage(request, 'user-123', true, 'jwt-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('chiffré');
    });

    it('should handle E2E message with encrypted data', async () => {
      const mockConversation = createMockConversation({ encryptionMode: 'e2e_only' });
      const mockMessage = createMockMessage({ content: '[Message chiffré E2E]' });
      const mockMember = createMockConversationMember();

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMember);
      mockPrisma.message.create = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.conversation.update = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.messageStatus.upsert = jest.fn().mockResolvedValue({});
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([mockMember]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([]);

      const request = {
        conversationId: 'conv-123',
        content: 'Test',
        originalLanguage: 'en',
        encrypted: true,
        encryptedData: {
          ciphertext: 'encrypted',
          nonce: 'nonce',
          senderKeyHash: 'hash',
          encryptionType: 'mls_1_1' as const
        }
      };

      const result = await service.handleMessage(request, 'user-123', true, 'jwt-token');

      expect(result.success).toBe(true);
      expect(mockPrisma.message.create).toHaveBeenCalled();
    });
  });

  describe('validateRequest', () => {
    it('should validate request with attachments but no content', async () => {
      const mockConversation = createMockConversation({ encryptionMode: 'none' });
      const mockMessage = createMockMessage();
      const mockMember = createMockConversationMember();

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMember);
      mockPrisma.message.create = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.conversation.update = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.messageStatus.upsert = jest.fn().mockResolvedValue({});
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([mockMember]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([]);

      const request = {
        conversationId: 'conv-123',
        content: '',
        originalLanguage: 'en',
        attachments: [{ filename: 'test.jpg' }]
      };

      const result = await service.handleMessage(request, 'user-123', true, 'jwt-token');

      expect(result.success).toBe(true);
    });

    it('should reject anonymous message without display name', async () => {
      const request = {
        conversationId: 'conv-123',
        content: 'Test',
        isAnonymous: true
      };

      const result = await service.handleMessage(request, 'anon-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('display name');
    });

    it('should reject message with too many attachments', async () => {
      const attachments = Array(11).fill({ filename: 'test.jpg' });
      const request = {
        conversationId: 'conv-123',
        content: 'Test',
        attachments
      };

      const result = await service.handleMessage(request, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('10 attachments');
    });
  });

  describe('checkPermissions', () => {
    it('should allow sending in global conversation', async () => {
      const mockConversation = createMockConversation({ type: 'global', encryptionMode: 'none' });
      const mockMessage = createMockMessage();
      const mockMember = createMockConversationMember();

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMember);
      mockPrisma.message.create = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.conversation.update = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.messageStatus.upsert = jest.fn().mockResolvedValue({});
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([mockMember]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([]);

      const request = {
        conversationId: 'conv-123',
        content: 'Test message',
        originalLanguage: 'en'
      };

      const result = await service.handleMessage(request, 'user-123', true, 'jwt-token');

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockRejectedValue(new Error('Database error'));

      const request = {
        conversationId: 'conv-123',
        content: 'Test',
        originalLanguage: 'en'
      };

      const result = await service.handleMessage(request, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
