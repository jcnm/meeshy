/**
 * Helper pour créer des mocks Prisma réutilisables
 * Utilisé dans tous les tests unitaires nécessitant Prisma
 */

import { jest } from '@jest/globals';
import { PrismaClient } from '@meeshy/shared/client';

export type MockedPrismaClient = {
  [K in keyof PrismaClient]: PrismaClient[K] extends object
    ? {
        [M in keyof PrismaClient[K]]: jest.Mock;
      }
    : jest.Mock;
};

export function createMockPrismaClient(): MockedPrismaClient {
  return {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    conversationMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
    },
    message: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    attachment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createMany: jest.fn(),
    },
    reaction: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    mention: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createMany: jest.fn(),
    },
    notification: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    call: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    callParticipant: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createMany: jest.fn(),
    },
    $disconnect: jest.fn(),
    $connect: jest.fn(),
    $transaction: jest.fn(),
  } as any;
}

/**
 * Créer un mock User standard pour les tests
 */
export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    password: '$2a$10$testhashedpassword',
    firstName: 'Test',
    lastName: 'User',
    displayName: 'Test User',
    avatar: null,
    bio: null,
    phoneNumber: null,
    role: 'USER',
    isOnline: false,
    isActive: true,
    lastSeen: new Date(),
    lastActiveAt: new Date(),
    systemLanguage: 'en',
    regionalLanguage: 'en',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Créer un mock Conversation standard pour les tests
 */
export function createMockConversation(overrides: Partial<any> = {}) {
  return {
    id: 'conv-123',
    identifier: 'test-conversation',
    type: 'direct',
    title: 'Test Conversation',
    description: null,
    image: null,
    avatar: null,
    communityId: null,
    isActive: true,
    isArchived: false,
    lastMessageAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    encryptionMode: 'none',
    serverEncryptionKey: null,
    serverKeyCreatedAt: null,
    serverKeyExpiresAt: null,
    ...overrides,
  };
}

/**
 * Créer un mock Message standard pour les tests
 */
export function createMockMessage(overrides: Partial<any> = {}) {
  return {
    id: 'msg-123',
    conversationId: 'conv-123',
    senderId: 'user-123',
    content: 'Test message',
    originalLanguage: 'en',
    messageType: 'text',
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Créer un mock ConversationMember standard pour les tests
 */
export function createMockConversationMember(overrides: Partial<any> = {}) {
  return {
    id: 'member-123',
    conversationId: 'conv-123',
    userId: 'user-123',
    role: 'member',
    canSendMessage: true,
    canSendFiles: true,
    canSendImages: true,
    canSendVideos: true,
    canSendAudios: true,
    canSendLocations: true,
    canSendLinks: true,
    joinedAt: new Date(),
    leftAt: null,
    isActive: true,
    ...overrides,
  };
}
