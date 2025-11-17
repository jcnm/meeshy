/**
 * Tests d'intégration Prisma pour Gateway
 * Teste les opérations de base de données avec MongoDB
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@meeshy/shared/client';
import { startTestDatabase, cleanTestDatabase, stopTestDatabase, seedTestData } from '../setup/test-database';

describe('Prisma Integration Tests', () => {
  let prisma: PrismaClient;
  let mongoUri: string;

  beforeAll(async () => {
    const setup = await startTestDatabase();
    prisma = setup.prisma;
    mongoUri = setup.mongoUri;
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestDatabase(prisma);
  });

  describe('User Operations', () => {
    it('should create a user', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'testuser',
          email: 'test@example.com',
          password: '$2a$10$hashedpassword',
          firstName: 'Test',
          lastName: 'User',
          displayName: 'Test User',
          role: 'USER',
          isActive: true,
          isOnline: false,
          systemLanguage: 'en',
          regionalLanguage: 'en',
          lastSeen: new Date(),
        },
      });

      expect(user.id).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
    });

    it('should find a user by email', async () => {
      await prisma.user.create({
        data: {
          username: 'findme',
          email: 'findme@example.com',
          password: '$2a$10$hashedpassword',
          role: 'USER',
          isActive: true,
          systemLanguage: 'en',
          regionalLanguage: 'en',
        },
      });

      const user = await prisma.user.findUnique({
        where: { email: 'findme@example.com' },
      });

      expect(user).toBeDefined();
      expect(user?.username).toBe('findme');
    });

    it('should update user status', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'updateme',
          email: 'updateme@example.com',
          password: '$2a$10$hashedpassword',
          role: 'USER',
          isActive: true,
          isOnline: false,
          systemLanguage: 'en',
          regionalLanguage: 'en',
        },
      });

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { isOnline: true, lastSeen: new Date() },
      });

      expect(updated.isOnline).toBe(true);
    });
  });

  describe('Conversation Operations', () => {
    it('should create a conversation with members', async () => {
      const { users } = await seedTestData(prisma);

      const conversation = await prisma.conversation.create({
        data: {
          identifier: 'test-conv-001',
          type: 'direct',
          title: 'Test Conversation',
          encryptionMode: 'none',
          isActive: true,
          isArchived: false,
          lastMessageAt: new Date(),
        },
      });

      await prisma.conversationMember.createMany({
        data: users.map((user) => ({
          conversationId: conversation.id,
          userId: user.id,
          role: 'member',
          canSendMessage: true,
          isActive: true,
          joinedAt: new Date(),
        })),
      });

      const members = await prisma.conversationMember.findMany({
        where: { conversationId: conversation.id },
      });

      expect(members.length).toBe(users.length);
    });

    it('should get conversation with members', async () => {
      const { users, conversation } = await seedTestData(prisma);

      const fullConversation = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      expect(fullConversation).toBeDefined();
      expect(fullConversation?.members.length).toBeGreaterThan(0);
    });
  });

  describe('Message Operations', () => {
    it('should create a message', async () => {
      const { users, conversation } = await seedTestData(prisma);

      const message = await prisma.message.create({
        data: {
          content: 'Test message',
          conversationId: conversation.id,
          authorId: users[0].id,
          type: 'text',
          status: 'sent',
        },
      });

      expect(message.id).toBeDefined();
      expect(message.content).toBe('Test message');
      expect(message.conversationId).toBe(conversation.id);
    });

    it('should get messages for a conversation', async () => {
      const { users, conversation } = await seedTestData(prisma);

      // Créer plusieurs messages
      await prisma.message.createMany({
        data: [
          {
            content: 'Message 1',
            conversationId: conversation.id,
            authorId: users[0].id,
            type: 'text',
            status: 'sent',
          },
          {
            content: 'Message 2',
            conversationId: conversation.id,
            authorId: users[1].id,
            type: 'text',
            status: 'sent',
          },
        ],
      });

      const messages = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(messages.length).toBe(2);
    });
  });

  describe('Translation Operations', () => {
    it('should save a translation', async () => {
      const { users, conversation } = await seedTestData(prisma);

      const message = await prisma.message.create({
        data: {
          content: 'Hello world',
          conversationId: conversation.id,
          authorId: users[0].id,
          type: 'text',
          status: 'sent',
        },
      });

      const translation = await prisma.translation.create({
        data: {
          messageId: message.id,
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          translatedText: 'Bonjour le monde',
          translatorModel: 'nllb',
          confidenceScore: 0.95,
          processingTime: 0.5,
        },
      });

      expect(translation.id).toBeDefined();
      expect(translation.messageId).toBe(message.id);
      expect(translation.translatedText).toBe('Bonjour le monde');
    });

    it('should upsert translation (update if exists)', async () => {
      const { users, conversation } = await seedTestData(prisma);

      const message = await prisma.message.create({
        data: {
          content: 'Test',
          conversationId: conversation.id,
          authorId: users[0].id,
          type: 'text',
          status: 'sent',
        },
      });

      // Première création
      const first = await prisma.translation.upsert({
        where: {
          messageId_targetLanguage: {
            messageId: message.id,
            targetLanguage: 'fr',
          },
        },
        create: {
          messageId: message.id,
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          translatedText: 'Premier',
          translatorModel: 'nllb',
        },
        update: {},
      });

      expect(first.translatedText).toBe('Premier');

      // Deuxième upsert (devrait mettre à jour)
      const second = await prisma.translation.upsert({
        where: {
          messageId_targetLanguage: {
            messageId: message.id,
            targetLanguage: 'fr',
          },
        },
        create: {
          messageId: message.id,
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          translatedText: 'Premier',
          translatorModel: 'nllb',
        },
        update: {
          translatedText: 'Deuxième',
          updatedAt: new Date(),
        },
      });

      expect(second.id).toBe(first.id);
      expect(second.translatedText).toBe('Deuxième');
    });

    it('should get all translations for a message', async () => {
      const { users, conversation } = await seedTestData(prisma);

      const message = await prisma.message.create({
        data: {
          content: 'Multilingual test',
          conversationId: conversation.id,
          authorId: users[0].id,
          type: 'text',
          status: 'sent',
        },
      });

      // Créer plusieurs traductions
      await prisma.translation.createMany({
        data: [
          {
            messageId: message.id,
            sourceLanguage: 'en',
            targetLanguage: 'fr',
            translatedText: 'Test multilingue',
            translatorModel: 'nllb',
          },
          {
            messageId: message.id,
            sourceLanguage: 'en',
            targetLanguage: 'es',
            translatedText: 'Prueba multilingüe',
            translatorModel: 'nllb',
          },
        ],
      });

      const translations = await prisma.translation.findMany({
        where: { messageId: message.id },
      });

      expect(translations.length).toBe(2);
    });
  });

  describe('Notification Operations', () => {
    it('should create a notification', async () => {
      const { users } = await seedTestData(prisma);

      const notification = await prisma.notification.create({
        data: {
          userId: users[0].id,
          type: 'message',
          title: 'New Message',
          body: 'You have a new message',
          isRead: false,
        },
      });

      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe(users[0].id);
      expect(notification.isRead).toBe(false);
    });

    it('should mark notification as read', async () => {
      const { users } = await seedTestData(prisma);

      const notification = await prisma.notification.create({
        data: {
          userId: users[0].id,
          type: 'message',
          title: 'Test',
          body: 'Test',
          isRead: false,
        },
      });

      const updated = await prisma.notification.update({
        where: { id: notification.id },
        data: { isRead: true, readAt: new Date() },
      });

      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeDefined();
    });
  });

  describe('Encryption Preferences', () => {
    it('should save user encryption preferences', async () => {
      const { users } = await seedTestData(prisma);

      const prefs = await prisma.encryptionPreference.create({
        data: {
          userId: users[0].id,
          preferredMode: 'e2e',
          allowServerSideTranslation: new Date(),
        },
      });

      expect(prefs.preferredMode).toBe('e2e');
    });

    it('should save conversation encryption preferences', async () => {
      const { conversation } = await seedTestData(prisma);

      const prefs = await prisma.conversationEncryptionPreference.create({
        data: {
          conversationId: conversation.id,
          mode: 'hybrid',
          allowServerSideTranslation: new Date(),
        },
      });

      expect(prefs.mode).toBe('hybrid');
    });
  });
});
