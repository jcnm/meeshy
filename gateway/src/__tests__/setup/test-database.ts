/**
 * Configuration de base de données de test MongoDB
 * Utilisé pour les tests d'intégration avec une vraie DB
 */

import { PrismaClient } from '@meeshy/shared/client';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | null = null;
let prisma: PrismaClient | null = null;

/**
 * Démarre un serveur MongoDB en mémoire pour les tests d'intégration
 */
export async function startTestDatabase(): Promise<{ prisma: PrismaClient; mongoUri: string }> {
  // Démarrer MongoDB en mémoire
  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'meeshy-test-integration',
    },
  });

  const mongoUri = mongoServer.getUri();

  // Créer Prisma Client avec l'URI MongoDB de test
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: mongoUri,
      },
    },
  });

  await prisma.$connect();

  return { prisma, mongoUri };
}

/**
 * Nettoie la base de données de test
 */
export async function cleanTestDatabase(prismaClient: PrismaClient): Promise<void> {
  // Supprimer toutes les données de toutes les collections
  const deletePromises = [
    prismaClient.message.deleteMany(),
    prismaClient.attachment.deleteMany(),
    prismaClient.reaction.deleteMany(),
    prismaClient.mention.deleteMany(),
    prismaClient.conversationMember.deleteMany(),
    prismaClient.conversation.deleteMany(),
    prismaClient.user.deleteMany(),
    prismaClient.notification.deleteMany(),
    prismaClient.call.deleteMany(),
    prismaClient.callParticipant.deleteMany(),
  ];

  await Promise.all(deletePromises);
}

/**
 * Arrête et nettoie le serveur MongoDB de test
 */
export async function stopTestDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

/**
 * Crée des données de test de base dans la DB
 */
export async function seedTestData(prismaClient: PrismaClient) {
  // Créer des utilisateurs de test
  const user1 = await prismaClient.user.create({
    data: {
      username: 'testuser1',
      email: 'test1@example.com',
      password: '$2a$10$hashedpassword',
      firstName: 'Test',
      lastName: 'User1',
      displayName: 'Test User1',
      role: 'USER',
      isActive: true,
      isOnline: false,
      systemLanguage: 'en',
      regionalLanguage: 'en',
      lastSeen: new Date(),
    },
  });

  const user2 = await prismaClient.user.create({
    data: {
      username: 'testuser2',
      email: 'test2@example.com',
      password: '$2a$10$hashedpassword',
      firstName: 'Test',
      lastName: 'User2',
      displayName: 'Test User2',
      role: 'USER',
      isActive: true,
      isOnline: false,
      systemLanguage: 'fr',
      regionalLanguage: 'fr',
      lastSeen: new Date(),
    },
  });

  // Créer une conversation de test
  const conversation = await prismaClient.conversation.create({
    data: {
      identifier: 'test-conversation-1',
      type: 'direct',
      title: 'Test Conversation',
      encryptionMode: 'none',
      isActive: true,
      isArchived: false,
      lastMessageAt: new Date(),
    },
  });

  // Créer les membres de la conversation
  await prismaClient.conversationMember.createMany({
    data: [
      {
        conversationId: conversation.id,
        userId: user1.id,
        role: 'member',
        canSendMessage: true,
        canSendFiles: true,
        canSendImages: true,
        canSendVideos: true,
        canSendAudios: true,
        canSendLocations: true,
        canSendLinks: true,
        joinedAt: new Date(),
        isActive: true,
      },
      {
        conversationId: conversation.id,
        userId: user2.id,
        role: 'member',
        canSendMessage: true,
        canSendFiles: true,
        canSendImages: true,
        canSendVideos: true,
        canSendAudios: true,
        canSendLocations: true,
        canSendLinks: true,
        joinedAt: new Date(),
        isActive: true,
      },
    ],
  });

  return {
    users: [user1, user2],
    conversation,
  };
}
