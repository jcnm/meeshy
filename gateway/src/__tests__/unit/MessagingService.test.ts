/**
 * Tests unitaires RÉELS pour MessagingService
 * Ces tests instancient et exécutent réellement le service
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { MessagingService } from '../../services/MessagingService';
import { createMockPrismaClient, createMockUser, createMockConversation, createMockMessage, createMockConversationMember } from '../helpers/prisma-mock';
import { createMockTranslationService, createMockLogger } from '../helpers/service-mocks';

// Mock uniquement les dépendances externes
jest.mock('../../utils/logger', () => ({
  logger: createMockLogger(),
}));

jest.mock('../../services/TrackingLinkService');
jest.mock('../../services/MentionService');
jest.mock('../../services/MLSService');
jest.mock('../../services/ServerKeyManager');

describe('MessagingService - Real Service Tests', () => {
  let service: MessagingService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let mockTranslationService: ReturnType<typeof createMockTranslationService>;

  beforeEach(() => {
    // Créer les mocks
    mockPrisma = createMockPrismaClient();
    mockTranslationService = createMockTranslationService();

    // Instancier le VRAI service avec les mocks
    service = new MessagingService(
      mockPrisma as any,
      mockTranslationService as any
    );

    jest.clearAllMocks();
  });

  describe('handleMessage - Plaintext', () => {
    it('should process a plaintext message successfully', async () => {
      // Setup - Préparer les données cohérentes
      const mockUser = createMockUser({ id: 'user-123' });
      const mockConversation = createMockConversation({
        id: 'conv-123',
        encryptionMode: 'none',
      });
      const mockMember = createMockConversationMember({
        userId: 'user-123',
        conversationId: 'conv-123',
        canSendMessage: true,
      });
      const mockMessage = createMockMessage({
        id: 'msg-123',
        conversationId: 'conv-123',
        senderId: 'user-123',
        content: 'Hello world',
      });

      // Mock Prisma responses avec données cohérentes
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMember);
      mockPrisma.message.create = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.conversation.update = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([mockMember]);
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      // Execute - Appeler la VRAIE méthode du service
      const result = await service.handleMessage(
        {
          conversationId: 'conv-123',
          content: 'Hello world',
          originalLanguage: 'en',
        },
        'user-123',
        true,
        'jwt-token'
      );

      // Assert - Vérifier le résultat
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message?.id).toBe('msg-123');
      expect(result.message?.content).toBe('Hello world');

      // Vérifier que Prisma a été appelé correctement
      expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'conv-123' },
        include: expect.any(Object),
      });
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'conv-123',
          senderId: 'user-123',
          content: 'Hello world',
          originalLanguage: 'en',
          messageType: 'text',
        }),
        include: expect.any(Object),
      });

      // Vérifier que le service de traduction a été appelé
      expect(mockTranslationService.handleNewMessage).toHaveBeenCalledWith(
        'msg-123',
        'Hello world',
        'en'
      );
    });

    it('should reject message if user has no permission', async () => {
      // Setup
      const mockConversation = createMockConversation({ id: 'conv-123' });
      const mockMember = createMockConversationMember({
        userId: 'user-123',
        conversationId: 'conv-123',
        canSendMessage: false, // Pas de permission !
      });

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMember);

      // Execute & Assert
      await expect(
        service.handleMessage(
          {
            conversationId: 'conv-123',
            content: 'Hello',
            originalLanguage: 'en',
          },
          'user-123',
          true,
          'jwt-token'
        )
      ).rejects.toThrow(/permission/i);

      // Vérifier que le message n'a PAS été créé
      expect(mockPrisma.message.create).not.toHaveBeenCalled();
    });

    it('should reject message for non-existent conversation', async () => {
      // Setup - Conversation n'existe pas
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(null);

      // Execute & Assert
      await expect(
        service.handleMessage(
          {
            conversationId: 'conv-nonexistent',
            content: 'Hello',
            originalLanguage: 'en',
          },
          'user-123',
          true,
          'jwt-token'
        )
      ).rejects.toThrow(/not found|introuvable/i);
    });

    it('should reject message if user is not a member', async () => {
      // Setup
      const mockConversation = createMockConversation({ id: 'conv-123' });

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(null); // Pas membre !

      // Execute & Assert
      await expect(
        service.handleMessage(
          {
            conversationId: 'conv-123',
            content: 'Hello',
            originalLanguage: 'en',
          },
          'user-123',
          true,
          'jwt-token'
        )
      ).rejects.toThrow(/member|membre/i);
    });
  });

  describe('handleMessage - With Attachments', () => {
    it('should process message with image attachment', async () => {
      // Setup
      const mockConversation = createMockConversation({ id: 'conv-123', encryptionMode: 'none' });
      const mockMember = createMockConversationMember({
        userId: 'user-123',
        conversationId: 'conv-123',
        canSendImages: true,
      });
      const mockMessage = createMockMessage({
        id: 'msg-123',
        conversationId: 'conv-123',
        messageType: 'image',
        content: '',
      });

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMember);
      mockPrisma.message.create = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.conversation.update = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([mockMember]);

      // Execute
      const result = await service.handleMessage(
        {
          conversationId: 'conv-123',
          content: '',
          originalLanguage: 'en',
          messageType: 'image',
          attachmentIds: ['att-1'],
        },
        'user-123',
        true,
        'jwt-token'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message?.messageType).toBe('image');
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          messageType: 'image',
          attachmentIds: ['att-1'],
        }),
        include: expect.any(Object),
      });
    });

    it('should reject image message if user cannot send images', async () => {
      // Setup
      const mockConversation = createMockConversation({ id: 'conv-123' });
      const mockMember = createMockConversationMember({
        userId: 'user-123',
        canSendImages: false, // Interdit !
      });

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMember);

      // Execute & Assert
      await expect(
        service.handleMessage(
          {
            conversationId: 'conv-123',
            content: '',
            originalLanguage: 'en',
            messageType: 'image',
            attachmentIds: ['att-1'],
          },
          'user-123',
          true,
          'jwt-token'
        )
      ).rejects.toThrow(/permission.*image/i);
    });
  });

  describe('handleMessage - Validation', () => {
    it('should reject empty message content', async () => {
      // Setup
      const mockConversation = createMockConversation({ id: 'conv-123' });
      const mockMember = createMockConversationMember({ userId: 'user-123' });

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMember);

      // Execute & Assert
      await expect(
        service.handleMessage(
          {
            conversationId: 'conv-123',
            content: '',
            originalLanguage: 'en',
            messageType: 'text',
          },
          'user-123',
          true,
          'jwt-token'
        )
      ).rejects.toThrow(/content.*empty|vide/i);
    });

    it('should reject message with content too long', async () => {
      // Setup
      const mockConversation = createMockConversation({ id: 'conv-123' });
      const mockMember = createMockConversationMember({ userId: 'user-123' });

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findFirst = jest.fn().mockResolvedValue(mockMember);

      // Créer un message de 10001 caractères
      const longContent = 'a'.repeat(10001);

      // Execute & Assert
      await expect(
        service.handleMessage(
          {
            conversationId: 'conv-123',
            content: longContent,
            originalLanguage: 'en',
          },
          'user-123',
          true,
          'jwt-token'
        )
      ).rejects.toThrow(/length|long|taille/i);
    });

    it('should reject invalid conversation ID format', async () => {
      // Execute & Assert
      await expect(
        service.handleMessage(
          {
            conversationId: '', // ID vide
            content: 'Hello',
            originalLanguage: 'en',
          },
          'user-123',
          true,
          'jwt-token'
        )
      ).rejects.toThrow(/invalid.*conversation/i);
    });
  });

  describe('handleMessage - Anonymous Users', () => {
    it('should process message from anonymous user', async () => {
      // Setup
      const mockConversation = createMockConversation({
        id: 'conv-123',
        type: 'public', // Public conversation permet anonymes
      });
      const mockMessage = createMockMessage({
        id: 'msg-123',
        senderId: 'anon_session123',
      });

      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.anonymousParticipant.findFirst = jest.fn().mockResolvedValue({
        id: 'anon-part-1',
        sessionToken: 'anon_session123',
        conversationId: 'conv-123',
      });
      mockPrisma.message.create = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.conversation.update = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([{
        id: 'anon-part-1',
        sessionToken: 'anon_session123',
        conversationId: 'conv-123',
      }]);

      // Execute
      const result = await service.handleMessage(
        {
          conversationId: 'conv-123',
          content: 'Hello from anonymous',
          originalLanguage: 'en',
        },
        'anon_session123',
        false, // Non authentifié
        undefined,
        'anon_session123' // Session token
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message?.senderId).toBe('anon_session123');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Setup - Prisma throw error
      mockPrisma.conversation.findUnique = jest.fn().mockRejectedValue(
        new Error('Database connection error')
      );

      // Execute & Assert
      await expect(
        service.handleMessage(
          {
            conversationId: 'conv-123',
            content: 'Hello',
            originalLanguage: 'en',
          },
          'user-123',
          true,
          'jwt-token'
        )
      ).rejects.toThrow(/database/i);
    });
  });
});
