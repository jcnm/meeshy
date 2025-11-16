/**
 * Tests unitaires pour EncryptionPreferencesService
 *
 * Ce fichier teste:
 * - Mise à jour des préférences de chiffrement utilisateur
 * - Récupération du statut de chiffrement d'une conversation
 * - Validation des requêtes
 * - Gestion des erreurs (404, 403, 400)
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@meeshy/shared/client';
import { EncryptionPreferencesService } from '../../services/EncryptionPreferencesService';

// Mock du logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('EncryptionPreferencesService - Encryption Preferences Management', () => {
  let prisma: PrismaClient;
  let service: EncryptionPreferencesService;
  let testUserId: string;
  let testConversationId: string;

  beforeEach(async () => {
    prisma = new PrismaClient();
    service = new EncryptionPreferencesService(prisma);

    // Create test user
    const user = await prisma.user.create({
      data: {
        username: `test-user-${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        password: 'hashed-password',
        systemLanguage: 'fr',
        regionalLanguage: 'fr',
        allowServerSideTranslationAt: null,
        defaultEncryptionMode: 'none',
      }
    });
    testUserId = user.id;

    // Create test conversation
    const conversation = await prisma.conversation.create({
      data: {
        identifier: `test-conv-${Date.now()}`,
        type: 'direct',
        title: 'Test Conversation',
        encryptionMode: 'hybrid',
      }
    });
    testConversationId = conversation.id;

    // Add user as member
    await prisma.conversationMember.create({
      data: {
        conversationId: testConversationId,
        userId: testUserId,
        isActive: true,
      }
    });
  });

  afterEach(async () => {
    // Cleanup
    if (testUserId) {
      await prisma.conversationMember.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    if (testConversationId) {
      await prisma.conversation.delete({ where: { id: testConversationId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('updateUserEncryptionPreferences', () => {
    it('should enable server-side translation', async () => {
      const result = await service.updateUserEncryptionPreferences({
        userId: testUserId,
        allowServerSideTranslation: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.allowServerSideTranslationAt).toBeDefined();
      expect(result.data?.allowServerSideTranslationAt).not.toBeNull();
      expect(result.statusCode).toBe(200);
    });

    it('should disable server-side translation', async () => {
      // First enable
      await service.updateUserEncryptionPreferences({
        userId: testUserId,
        allowServerSideTranslation: true,
      });

      // Then disable
      const result = await service.updateUserEncryptionPreferences({
        userId: testUserId,
        allowServerSideTranslation: false,
      });

      expect(result.success).toBe(true);
      expect(result.data?.allowServerSideTranslationAt).toBeNull();
      expect(result.statusCode).toBe(200);
    });

    it('should update default encryption mode', async () => {
      const result = await service.updateUserEncryptionPreferences({
        userId: testUserId,
        defaultEncryptionMode: 'hybrid',
      });

      expect(result.success).toBe(true);
      expect(result.data?.defaultEncryptionMode).toBe('hybrid');
      expect(result.statusCode).toBe(200);
    });

    it('should update both preferences at once', async () => {
      const result = await service.updateUserEncryptionPreferences({
        userId: testUserId,
        allowServerSideTranslation: true,
        defaultEncryptionMode: 'e2e_only',
      });

      expect(result.success).toBe(true);
      expect(result.data?.allowServerSideTranslationAt).toBeDefined();
      expect(result.data?.defaultEncryptionMode).toBe('e2e_only');
      expect(result.statusCode).toBe(200);
    });

    it('should reject invalid userId format', async () => {
      const result = await service.updateUserEncryptionPreferences({
        userId: 'invalid-id',
        allowServerSideTranslation: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.[0].code).toBe('USER_ID_INVALID_FORMAT');
      expect(result.statusCode).toBe(400);
    });

    it('should reject invalid encryption mode', async () => {
      const result = await service.updateUserEncryptionPreferences({
        userId: testUserId,
        defaultEncryptionMode: 'invalid_mode' as any,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some(e => e.code === 'ENCRYPTION_MODE_INVALID')).toBe(true);
      expect(result.statusCode).toBe(400);
    });

    it('should reject request with no fields', async () => {
      const result = await service.updateUserEncryptionPreferences({
        userId: testUserId,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some(e => e.code === 'NO_FIELDS_PROVIDED')).toBe(true);
      expect(result.statusCode).toBe(400);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = '507f1f77bcf86cd799439011'; // Valid ObjectId format

      const result = await service.updateUserEncryptionPreferences({
        userId: fakeUserId,
        allowServerSideTranslation: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Utilisateur non trouvé');
      expect(result.statusCode).toBe(404);
    });
  });

  describe('getConversationEncryptionStatus', () => {
    it('should return encryption status for conversation member', async () => {
      const result = await service.getConversationEncryptionStatus(
        testConversationId,
        testUserId
      );

      expect(result.success).toBe(true);
      expect(result.data?.conversationId).toBe(testConversationId);
      expect(result.data?.encryptionMode).toBe('hybrid');
      expect(result.data?.isEncrypted).toBe(true);
      expect(result.data?.totalMembers).toBe(1);
      expect(result.statusCode).toBe(200);
    });

    it('should calculate server translation permissions', async () => {
      // Enable server translation for user
      await prisma.user.update({
        where: { id: testUserId },
        data: { allowServerSideTranslationAt: new Date() }
      });

      const result = await service.getConversationEncryptionStatus(
        testConversationId,
        testUserId
      );

      expect(result.success).toBe(true);
      expect(result.data?.membersAllowingServerTranslation).toBe(1);
      expect(result.data?.allMembersAllowServerTranslation).toBe(true);
    });

    it('should detect when not all members allow server translation', async () => {
      // Create second user without server translation
      const user2 = await prisma.user.create({
        data: {
          username: `test-user-2-${Date.now()}`,
          email: `test-2-${Date.now()}@example.com`,
          password: 'hashed-password',
          systemLanguage: 'fr',
          regionalLanguage: 'fr',
          allowServerSideTranslationAt: null,
        }
      });

      await prisma.conversationMember.create({
        data: {
          conversationId: testConversationId,
          userId: user2.id,
          isActive: true,
        }
      });

      const result = await service.getConversationEncryptionStatus(
        testConversationId,
        testUserId
      );

      expect(result.success).toBe(true);
      expect(result.data?.totalMembers).toBe(2);
      expect(result.data?.membersAllowingServerTranslation).toBe(0);
      expect(result.data?.allMembersAllowServerTranslation).toBe(false);

      // Cleanup
      await prisma.conversationMember.deleteMany({ where: { userId: user2.id } });
      await prisma.user.delete({ where: { id: user2.id } });
    });

    it('should reject invalid conversationId format', async () => {
      const result = await service.getConversationEncryptionStatus(
        'invalid-id',
        testUserId
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('ID de conversation invalide');
      expect(result.statusCode).toBe(400);
    });

    it('should reject invalid userId format', async () => {
      const result = await service.getConversationEncryptionStatus(
        testConversationId,
        'invalid-id'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('ID utilisateur invalide');
      expect(result.statusCode).toBe(400);
    });

    it('should return 404 for non-existent conversation', async () => {
      const fakeConvId = '507f1f77bcf86cd799439011';

      const result = await service.getConversationEncryptionStatus(
        fakeConvId,
        testUserId
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Conversation non trouvée');
      expect(result.statusCode).toBe(404);
    });

    it('should return 403 for non-member', async () => {
      // Create another user who is not a member
      const user2 = await prisma.user.create({
        data: {
          username: `test-user-nonmember-${Date.now()}`,
          email: `test-nonmember-${Date.now()}@example.com`,
          password: 'hashed-password',
          systemLanguage: 'fr',
          regionalLanguage: 'fr',
        }
      });

      const result = await service.getConversationEncryptionStatus(
        testConversationId,
        user2.id
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Vous n\'êtes pas membre de cette conversation');
      expect(result.statusCode).toBe(403);

      // Cleanup
      await prisma.user.delete({ where: { id: user2.id } });
    });
  });
});
