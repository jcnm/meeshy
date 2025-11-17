/**
 * Tests unitaires pour ServerKeyManager
 *
 * Ce fichier teste:
 * - Chiffrement/déchiffrement AES-256-GCM
 * - Génération et gestion de clés de conversation
 * - Rotation de clés serveur
 * - Secure wipe de mémoire
 * - Validation de la master key
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@meeshy/shared/client';
import { ServerKeyManager } from '../../services/ServerKeyManager';
import * as crypto from 'crypto';

// Mock du logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ServerKeyManager - Hybrid Encryption Key Management', () => {
  let prisma: PrismaClient;
  let serverKeyManager: ServerKeyManager;
  let testConversationId: string;
  const testMasterKey = crypto.randomBytes(32).toString('hex'); // 64 char hex

  beforeEach(async () => {
    prisma = new PrismaClient();

    // Set master key env var
    process.env.MLS_MASTER_KEY = testMasterKey;

    serverKeyManager = new ServerKeyManager(prisma);

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
  });

  afterEach(async () => {
    // Cleanup
    if (testConversationId) {
      await prisma.conversation.delete({ where: { id: testConversationId } }).catch(() => {});
    }
    await prisma.$disconnect();
    delete process.env.MLS_MASTER_KEY;
  });

  describe('Master Key Validation', () => {
    it('should validate correct master key format', () => {
      expect(() => new ServerKeyManager(prisma, { masterKeyHex: testMasterKey })).not.toThrow();
    });

    it('should reject invalid master key length', () => {
      const invalidKey = 'abc123'; // Too short
      expect(() => new ServerKeyManager(prisma, { masterKeyHex: invalidKey })).toThrow('64-character hexadecimal');
    });

    it('should reject non-hexadecimal master key', () => {
      const invalidKey = 'z'.repeat(64); // Invalid hex chars
      expect(() => new ServerKeyManager(prisma, { masterKeyHex: invalidKey })).toThrow('64-character hexadecimal');
    });
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const plaintext = Buffer.from('Hello, World! This is a test message.', 'utf8');
      const key = crypto.randomBytes(32);
      const nonce = crypto.randomBytes(12);

      const ciphertext = await serverKeyManager.encrypt(plaintext, nonce, key);
      expect(ciphertext).toBeDefined();
      expect(ciphertext.length).toBeGreaterThan(plaintext.length); // Includes auth tag

      const decrypted = await serverKeyManager.decrypt(ciphertext, nonce, key);
      expect(decrypted.toString('utf8')).toBe(plaintext.toString('utf8'));

      // Cleanup
      serverKeyManager.secureWipe(key);
      serverKeyManager.secureWipe(decrypted);
    });

    it('should fail decryption with wrong key', async () => {
      const plaintext = Buffer.from('Secret message', 'utf8');
      const key1 = crypto.randomBytes(32);
      const key2 = crypto.randomBytes(32);
      const nonce = crypto.randomBytes(12);

      const ciphertext = await serverKeyManager.encrypt(plaintext, nonce, key1);

      await expect(serverKeyManager.decrypt(ciphertext, nonce, key2)).rejects.toThrow('Decryption failed');

      serverKeyManager.secureWipe(key1);
      serverKeyManager.secureWipe(key2);
    });

    it('should fail decryption with wrong nonce', async () => {
      const plaintext = Buffer.from('Secret message', 'utf8');
      const key = crypto.randomBytes(32);
      const nonce1 = crypto.randomBytes(12);
      const nonce2 = crypto.randomBytes(12);

      const ciphertext = await serverKeyManager.encrypt(plaintext, nonce1, key);

      await expect(serverKeyManager.decrypt(ciphertext, nonce2, key)).rejects.toThrow('Decryption failed');

      serverKeyManager.secureWipe(key);
    });

    it('should reject invalid nonce size', async () => {
      const plaintext = Buffer.from('Test', 'utf8');
      const key = crypto.randomBytes(32);
      const invalidNonce = crypto.randomBytes(16); // Should be 12

      await expect(serverKeyManager.encrypt(plaintext, invalidNonce, key)).rejects.toThrow('Nonce must be exactly 12 bytes');

      serverKeyManager.secureWipe(key);
    });

    it('should reject invalid key size', async () => {
      const plaintext = Buffer.from('Test', 'utf8');
      const invalidKey = crypto.randomBytes(16); // Should be 32
      const nonce = crypto.randomBytes(12);

      await expect(serverKeyManager.encrypt(plaintext, nonce, invalidKey)).rejects.toThrow('Key must be exactly 32 bytes');

      serverKeyManager.secureWipe(invalidKey);
    });
  });

  describe('Conversation Key Management', () => {
    it('should generate and store conversation key', async () => {
      const key = await serverKeyManager.getConversationKey(testConversationId);

      expect(key).toBeDefined();
      expect(key.length).toBe(32);

      // Verify stored in DB
      const conversation = await prisma.conversation.findUnique({
        where: { id: testConversationId },
        select: { serverEncryptionKey: true, serverKeyCreatedAt: true, serverKeyExpiresAt: true }
      });

      expect(conversation?.serverEncryptionKey).toBeDefined();
      expect(conversation?.serverKeyCreatedAt).toBeDefined();
      expect(conversation?.serverKeyExpiresAt).toBeDefined();

      // Verify expiration is 30 days
      const expirationDiff = conversation!.serverKeyExpiresAt!.getTime() - conversation!.serverKeyCreatedAt!.getTime();
      const expectedDiff = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
      expect(Math.abs(expirationDiff - expectedDiff)).toBeLessThan(1000); // Within 1 second

      serverKeyManager.secureWipe(key);
    });

    it('should reuse existing conversation key', async () => {
      const key1 = await serverKeyManager.getConversationKey(testConversationId);
      const key2 = await serverKeyManager.getConversationKey(testConversationId);

      expect(key1.toString('hex')).toBe(key2.toString('hex'));

      serverKeyManager.secureWipe(key1);
      serverKeyManager.secureWipe(key2);
    });

    it('should cache conversation keys', async () => {
      const startTime = Date.now();
      const key1 = await serverKeyManager.getConversationKey(testConversationId);
      const firstCallTime = Date.now() - startTime;

      const startTime2 = Date.now();
      const key2 = await serverKeyManager.getConversationKey(testConversationId);
      const secondCallTime = Date.now() - startTime2;

      // Second call should be faster (from cache)
      expect(secondCallTime).toBeLessThan(firstCallTime);

      serverKeyManager.secureWipe(key1);
      serverKeyManager.secureWipe(key2);
    });
  });

  describe('Secure Wipe', () => {
    it('should wipe buffer memory', () => {
      const buffer = Buffer.from('sensitive data', 'utf8');
      const originalContent = buffer.toString('utf8');

      expect(buffer.toString('utf8')).toBe(originalContent);

      serverKeyManager.secureWipe(buffer);

      // Buffer should be zeroed out
      expect(buffer.every(byte => byte === 0)).toBe(true);
    });
  });

  describe('Key Rotation', () => {
    it('should rotate conversation key', async () => {
      // Get initial key
      const oldKey = await serverKeyManager.getConversationKey(testConversationId);

      const conversation = await prisma.conversation.findUnique({
        where: { id: testConversationId },
        select: { serverEncryptionKey: true }
      });
      const oldEncryptedKey = conversation!.serverEncryptionKey;

      // Rotate
      const newEncryptedKey = await serverKeyManager.rotateConversationKey(testConversationId);

      expect(newEncryptedKey).toBeDefined();
      expect(newEncryptedKey).not.toBe(oldEncryptedKey);

      // Verify new key is different
      const newKey = await serverKeyManager.getConversationKey(testConversationId);
      expect(newKey.toString('hex')).not.toBe(oldKey.toString('hex'));

      serverKeyManager.secureWipe(oldKey);
      serverKeyManager.secureWipe(newKey);
    });
  });
});
