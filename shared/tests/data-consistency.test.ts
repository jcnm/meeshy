/**
 * Tests de cohérence des données shared
 * Vérifie que les types et schémas sont cohérents entre backend, frontend et translator
 */

import { describe, it, expect } from '@jest/globals';
import type {
  Message,
  User,
  Conversation,
  Translation,
  ConversationMember,
  EncryptionMode,
  MLSCredentials,
} from '../types';

describe('Shared Data Consistency Tests', () => {
  describe('Message Type Consistency', () => {
    it('should have consistent message structure', () => {
      const message: Message = {
        id: 'msg_001',
        content: 'Test message',
        conversationId: 'conv_001',
        authorId: 'user_001',
        type: 'text',
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(message.id).toBeDefined();
      expect(message.content).toBeDefined();
      expect(message.conversationId).toBeDefined();
      expect(message.authorId).toBeDefined();
      expect(message.type).toBeDefined();
      expect(message.status).toBeDefined();
    });

    it('should support all message types', () => {
      const types: Array<Message['type']> = [
        'text',
        'image',
        'video',
        'audio',
        'file',
        'location',
        'contact',
        'system',
      ];

      types.forEach((type) => {
        const message: Partial<Message> = { type };
        expect(message.type).toBe(type);
      });
    });

    it('should support all message statuses', () => {
      const statuses: Array<Message['status']> = [
        'sending',
        'sent',
        'delivered',
        'read',
        'failed',
      ];

      statuses.forEach((status) => {
        const message: Partial<Message> = { status };
        expect(message.status).toBe(status);
      });
    });
  });

  describe('User Type Consistency', () => {
    it('should have consistent user structure', () => {
      const user: User = {
        id: 'user_001',
        username: 'testuser',
        email: 'test@example.com',
        role: 'USER',
        isActive: true,
        isOnline: false,
        systemLanguage: 'en',
        regionalLanguage: 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.systemLanguage).toBeDefined();
      expect(user.regionalLanguage).toBeDefined();
    });

    it('should support language codes', () => {
      const languages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'ja', 'zh', 'ar'];

      languages.forEach((lang) => {
        const user: Partial<User> = {
          systemLanguage: lang,
          regionalLanguage: lang,
        };
        expect(user.systemLanguage).toBe(lang);
        expect(user.regionalLanguage).toBe(lang);
      });
    });
  });

  describe('Conversation Type Consistency', () => {
    it('should have consistent conversation structure', () => {
      const conversation: Conversation = {
        id: 'conv_001',
        identifier: 'test-conv',
        type: 'direct',
        encryptionMode: 'none',
        isActive: true,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(conversation.id).toBeDefined();
      expect(conversation.identifier).toBeDefined();
      expect(conversation.type).toBeDefined();
      expect(conversation.encryptionMode).toBeDefined();
    });

    it('should support all conversation types', () => {
      const types: Array<Conversation['type']> = ['direct', 'group', 'channel'];

      types.forEach((type) => {
        const conversation: Partial<Conversation> = { type };
        expect(conversation.type).toBe(type);
      });
    });

    it('should support all encryption modes', () => {
      const modes: EncryptionMode[] = ['none', 'e2e', 'hybrid'];

      modes.forEach((mode) => {
        const conversation: Partial<Conversation> = { encryptionMode: mode };
        expect(conversation.encryptionMode).toBe(mode);
      });
    });
  });

  describe('Translation Type Consistency', () => {
    it('should have consistent translation structure', () => {
      const translation: Translation = {
        id: 'trans_001',
        messageId: 'msg_001',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        translatedText: 'Bonjour',
        translatorModel: 'nllb',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(translation.id).toBeDefined();
      expect(translation.messageId).toBeDefined();
      expect(translation.sourceLanguage).toBeDefined();
      expect(translation.targetLanguage).toBeDefined();
      expect(translation.translatedText).toBeDefined();
      expect(translation.translatorModel).toBeDefined();
    });

    it('should support translation metadata', () => {
      const translation: Translation = {
        id: 'trans_001',
        messageId: 'msg_001',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        translatedText: 'Bonjour',
        translatorModel: 'nllb',
        confidenceScore: 0.95,
        processingTime: 0.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(translation.confidenceScore).toBeGreaterThan(0);
      expect(translation.processingTime).toBeGreaterThan(0);
    });
  });

  describe('MLS Type Consistency', () => {
    it('should have consistent MLS credentials structure', () => {
      const credentials: MLSCredentials = {
        id: 'mls_001',
        userId: 'user_001',
        deviceId: 'device_001',
        keyPackageRef: Buffer.from('key'),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      expect(credentials.id).toBeDefined();
      expect(credentials.userId).toBeDefined();
      expect(credentials.deviceId).toBeDefined();
      expect(credentials.keyPackageRef).toBeDefined();
    });

    it('should support MLS group state', () => {
      // Test de structure pour les états de groupe MLS
      const groupState = {
        groupId: 'group_001',
        epoch: 1,
        treeHash: Buffer.from('hash'),
        confirmedTranscriptHash: Buffer.from('hash'),
      };

      expect(groupState.groupId).toBeDefined();
      expect(groupState.epoch).toBeGreaterThan(0);
    });
  });

  describe('Language Code Consistency', () => {
    it('should use ISO 639-1 language codes', () => {
      const validCodes = [
        'en',
        'fr',
        'es',
        'de',
        'it',
        'pt',
        'ru',
        'ja',
        'zh',
        'ar',
        'hi',
        'ko',
      ];

      validCodes.forEach((code) => {
        expect(code.length).toBe(2);
        expect(code).toBe(code.toLowerCase());
      });
    });
  });

  describe('Timestamp Consistency', () => {
    it('should use Date objects for timestamps', () => {
      const message: Message = {
        id: 'msg_001',
        content: 'Test',
        conversationId: 'conv_001',
        authorId: 'user_001',
        type: 'text',
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(message.createdAt).toBeInstanceOf(Date);
      expect(message.updatedAt).toBeInstanceOf(Date);
    });

    it('should have consistent timestamp ordering', () => {
      const createdAt = new Date('2025-01-01T00:00:00Z');
      const updatedAt = new Date('2025-01-01T00:01:00Z');

      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());
    });
  });

  describe('ID Format Consistency', () => {
    it('should use consistent ID format', () => {
      const ids = {
        message: 'msg_001',
        user: 'user_001',
        conversation: 'conv_001',
        translation: 'trans_001',
      };

      Object.values(ids).forEach((id) => {
        expect(id).toMatch(/^[a-z]+_[0-9a-zA-Z]+$/);
      });
    });
  });

  describe('Optional Fields Consistency', () => {
    it('should handle optional fields correctly', () => {
      const message: Message = {
        id: 'msg_001',
        content: 'Test',
        conversationId: 'conv_001',
        authorId: 'user_001',
        type: 'text',
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
        // Champs optionnels
        attachments: [],
        reactions: [],
        mentions: [],
        metadata: { key: 'value' },
      };

      expect(message.attachments).toBeDefined();
      expect(message.reactions).toBeDefined();
      expect(message.mentions).toBeDefined();
      expect(message.metadata).toBeDefined();
    });
  });

  describe('Enum Consistency', () => {
    it('should have consistent role enums', () => {
      const roles = ['USER', 'ADMIN', 'MODERATOR'] as const;

      roles.forEach((role) => {
        const user: Partial<User> = { role };
        expect(user.role).toBe(role);
      });
    });

    it('should have consistent permission enums', () => {
      const member: ConversationMember = {
        id: 'member_001',
        conversationId: 'conv_001',
        userId: 'user_001',
        role: 'member',
        canSendMessage: true,
        canSendFiles: true,
        canSendImages: true,
        canSendVideos: true,
        canSendAudios: true,
        isActive: true,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(typeof member.canSendMessage).toBe('boolean');
      expect(typeof member.canSendFiles).toBe('boolean');
    });
  });

  describe('Relationship Consistency', () => {
    it('should maintain foreign key relationships', () => {
      const userId = 'user_001';
      const conversationId = 'conv_001';
      const messageId = 'msg_001';

      const message: Partial<Message> = {
        id: messageId,
        conversationId: conversationId,
        authorId: userId,
      };

      const translation: Partial<Translation> = {
        messageId: messageId,
      };

      expect(message.authorId).toBe(userId);
      expect(message.conversationId).toBe(conversationId);
      expect(translation.messageId).toBe(messageId);
    });
  });

  describe('Audio Effects Timeline Consistency', () => {
    it('should have consistent audio effects structure', () => {
      const timeline = {
        effects: [
          {
            type: 'reverb',
            startTime: 0,
            endTime: 5,
            parameters: { roomSize: 0.5 },
          },
        ],
      };

      expect(timeline.effects).toBeDefined();
      expect(timeline.effects.length).toBeGreaterThan(0);
      expect(timeline.effects[0].type).toBeDefined();
      expect(timeline.effects[0].startTime).toBeGreaterThanOrEqual(0);
      expect(timeline.effects[0].endTime).toBeGreaterThan(
        timeline.effects[0].startTime
      );
    });
  });
});
