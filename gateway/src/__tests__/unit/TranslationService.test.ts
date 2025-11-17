import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TranslationService } from '../../services/TranslationService';
import { createMockPrismaClient } from '../helpers/prisma-mock';

// Mock dependencies
jest.mock('../../services/zmq-translation-client');
jest.mock('../../services/zmq-singleton');

describe('TranslationService', () => {
  let service: TranslationService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let mockZmqClient: any;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = new TranslationService(mockPrisma as any);

    mockZmqClient = {
      sendTranslationRequest: jest.fn().mockResolvedValue('task-123'),
      on: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      healthCheck: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(undefined),
      testReception: jest.fn().mockResolvedValue(undefined)
    };

    (service as any).zmqClient = mockZmqClient;
    (service as any).isInitialized = true;

    jest.clearAllMocks();
  });

  describe('handleNewMessage', () => {
    it('should save new message and queue translation', async () => {
      const mockMessage = {
        id: 'msg-123',
        conversationId: 'conv-123',
        senderId: 'user-123',
        content: 'Test message',
        originalLanguage: 'en',
        messageType: 'text',
        createdAt: new Date()
      };

      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.conversation.create = jest.fn().mockResolvedValue({
        id: 'conv-123',
        identifier: 'mshy_test',
        title: 'Test'
      });
      mockPrisma.message.create = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.conversation.update = jest.fn().mockResolvedValue({});
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.handleNewMessage({
        conversationId: 'conv-123',
        senderId: 'user-123',
        content: 'Test message',
        originalLanguage: 'en'
      });

      expect(result.status).toBe('message_saved');
      expect(result.messageId).toBeDefined();
      expect(mockPrisma.message.create).toHaveBeenCalled();
    });

    it('should handle retranslation for existing message', async () => {
      const mockMessage = {
        id: 'msg-123',
        conversationId: 'conv-123',
        content: 'Test',
        originalLanguage: 'en',
        createdAt: new Date()
      };

      mockPrisma.message.findFirst = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.messageTranslation.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.handleNewMessage({
        id: 'msg-123',
        conversationId: 'conv-123',
        content: 'Test',
        originalLanguage: 'en',
        targetLanguage: 'fr'
      });

      expect(result.status).toBe('retranslation_queued');
      expect(result.messageId).toBe('msg-123');
    });

    it('should throw error for non-existent message retranslation', async () => {
      mockPrisma.message.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.handleNewMessage({
        id: 'invalid-id',
        conversationId: 'conv-123',
        content: 'Test',
        originalLanguage: 'en'
      })).rejects.toThrow('non trouvé');
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.conversation.findFirst = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(service.handleNewMessage({
        conversationId: 'conv-123',
        content: 'Test',
        originalLanguage: 'en'
      })).rejects.toThrow();
    });
  });

  describe('getTranslation', () => {
    it('should return cached translation', async () => {
      const cachedTranslation = {
        messageId: 'msg-123',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        translatedText: 'Message de test',
        translatorModel: 'basic',
        confidenceScore: 0.9,
        processingTime: 100,
        modelType: 'basic'
      };

      (service as any).memoryCache.set('msg-123_en_fr', cachedTranslation);

      const result = await service.getTranslation('msg-123', 'fr', 'en');

      expect(result).toEqual(cachedTranslation);
    });

    it('should fetch from database if not in cache', async () => {
      const dbTranslation = {
        id: 'trans-123',
        messageId: 'msg-123',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        translatedContent: 'Message de test',
        translationModel: 'basic',
        confidenceScore: 0.9,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.messageTranslation.findFirst = jest.fn().mockResolvedValue(dbTranslation);

      const result = await service.getTranslation('msg-123', 'fr');

      expect(result).toBeDefined();
      expect(result?.translatedText).toBe('Message de test');
    });

    it('should return null if translation not found', async () => {
      mockPrisma.messageTranslation.findFirst = jest.fn().mockResolvedValue(null);

      const result = await service.getTranslation('msg-123', 'fr');

      expect(result).toBeNull();
    });

    it('should handle errors and return null', async () => {
      mockPrisma.messageTranslation.findFirst = jest.fn().mockRejectedValue(new Error('DB error'));

      const result = await service.getTranslation('msg-123', 'fr');

      expect(result).toBeNull();
    });
  });

  describe('translateTextDirectly', () => {
    it('should translate text and return result', async () => {
      const translationResult = {
        messageId: 'rest_123',
        translatedText: 'Message de test',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        confidenceScore: 0.95,
        processingTime: 150,
        modelType: 'basic'
      };

      mockZmqClient.sendTranslationRequest.mockResolvedValue('task-123');

      // Simulate translation completion event
      setTimeout(() => {
        const handler = mockZmqClient.on.mock.calls.find((call: any) =>
          call[0] === 'translationCompleted'
        )?.[1];
        if (handler) {
          handler({
            taskId: 'task-123',
            result: translationResult
          });
        }
      }, 10);

      const result = await service.translateTextDirectly(
        'Test message',
        'en',
        'fr',
        'basic'
      );

      expect(result).toBeDefined();
      expect(result.translatedText).toBe('Message de test');
    });

    it('should handle translation timeout', async () => {
      mockZmqClient.sendTranslationRequest.mockResolvedValue('task-timeout');

      const promise = service.translateTextDirectly('Test', 'en', 'fr', 'basic');

      await expect(promise).rejects.toThrow('Timeout');
    }, 15000);

    it('should return fallback on error', async () => {
      mockZmqClient.sendTranslationRequest.mockRejectedValue(new Error('ZMQ error'));

      const result = await service.translateTextDirectly('Test', 'en', 'fr');

      expect(result.modelType).toBe('fallback');
      expect(result.translatedText).toContain('[FR]');
    });
  });

  describe('getStats', () => {
    it('should return service statistics', () => {
      (service as any).stats = {
        messages_saved: 10,
        translation_requests_sent: 20,
        translations_received: 18,
        errors: 2,
        pool_full_rejections: 1,
        avg_processing_time: 150
      };

      const stats = service.getStats();

      expect(stats.messages_saved).toBe(10);
      expect(stats.translation_requests_sent).toBe(20);
      expect(stats.translations_received).toBe(18);
      expect(stats.uptime_seconds).toBeGreaterThan(0);
      expect(stats.memory_usage_mb).toBeGreaterThan(0);
    });
  });

  describe('healthCheck', () => {
    it('should return true if ZMQ client is healthy', async () => {
      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockZmqClient.healthCheck).toHaveBeenCalled();
    });

    it('should return false on health check failure', async () => {
      mockZmqClient.healthCheck.mockRejectedValue(new Error('Health check failed'));

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('close', () => {
    it('should close ZMQ client', async () => {
      await service.close();

      expect(mockZmqClient.close).toHaveBeenCalled();
    });

    it('should handle close errors', async () => {
      mockZmqClient.close.mockRejectedValue(new Error('Close error'));

      await expect(service.close()).resolves.not.toThrow();
    });
  });

  describe('translation processing', () => {
    it('should filter out same source-target language', async () => {
      const mockMessage = {
        id: 'msg-123',
        conversationId: 'conv-123',
        content: 'Test',
        originalLanguage: 'en',
        createdAt: new Date()
      };

      mockPrisma.message.findFirst = jest.fn().mockResolvedValue(mockMessage);
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([
        {
          user: {
            systemLanguage: 'en', // Same as source
            autoTranslateEnabled: true,
            translateToSystemLanguage: true
          }
        }
      ]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([]);

      await service.handleNewMessage({
        conversationId: 'conv-123',
        content: 'Test',
        originalLanguage: 'en'
      });

      // Should not send translation request for same language
      expect(mockZmqClient.sendTranslationRequest).not.toHaveBeenCalled();
    });

    it('should extract multiple target languages from conversation', async () => {
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([
        {
          user: {
            systemLanguage: 'fr',
            regionalLanguage: 'es',
            autoTranslateEnabled: true,
            translateToSystemLanguage: true,
            translateToRegionalLanguage: true
          }
        },
        {
          user: {
            systemLanguage: 'de',
            autoTranslateEnabled: true,
            translateToSystemLanguage: true
          }
        }
      ]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([]);

      const languages = await (service as any)._extractConversationLanguages('conv-123');

      expect(languages).toContain('fr');
      expect(languages).toContain('es');
      expect(languages).toContain('de');
    });
  });

  describe('cache management', () => {
    it('should cache conversation languages', async () => {
      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([
        { user: { systemLanguage: 'en' } }
      ]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([]);

      await (service as any)._extractConversationLanguages('conv-123');
      await (service as any)._extractConversationLanguages('conv-123');

      // Second call should use cache
      expect(mockPrisma.conversationMember.findMany).toHaveBeenCalledTimes(1);
    });

    it('should clean up cache when size exceeds limit', async () => {
      const cache = (service as any).conversationLanguagesCache;

      for (let i = 0; i < 110; i++) {
        cache.set(`conv-${i}`, {
          languages: ['en'],
          timestamp: Date.now()
        });
      }

      mockPrisma.conversationMember.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.anonymousParticipant.findMany = jest.fn().mockResolvedValue([]);

      await (service as any)._extractConversationLanguages('conv-new');

      expect(cache.size).toBeLessThanOrEqual(101);
    });
  });
});
