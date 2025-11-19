/**
 * Unit Tests for EncryptionService
 *
 * Tests encryption/decryption, key management, and service methods.
 */

import { encryptionService } from '../../services/EncryptionService';
import type { EncryptedPayload, EncryptionMode } from '../../../shared/types/encryption';
import crypto from 'crypto';

describe('EncryptionService Unit Tests', () => {
  describe('Server-Encrypted Mode', () => {
    it('should encrypt and decrypt content successfully', async () => {
      const plaintext = 'Hello, this is a test message!';

      // Encrypt
      const encrypted = await encryptionService.encryptMessage(plaintext, 'server');

      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.metadata.mode).toBe('server');
      expect(encrypted.metadata.protocol).toBe('aes-256-gcm');
      expect(encrypted.metadata.keyId).toBeTruthy();
      expect(encrypted.metadata.iv).toBeTruthy();
      expect(encrypted.metadata.authTag).toBeTruthy();

      // Decrypt
      const decrypted = await encryptionService.decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters in encryption', async () => {
      const specialText = '🔐 Héllo Wörld! 你好世界 مرحبا بالعالم';

      const encrypted = await encryptionService.encryptMessage(specialText, 'server');
      const decrypted = await encryptionService.decryptMessage(encrypted);

      expect(decrypted).toBe(specialText);
    });

    it('should handle empty strings', async () => {
      const empty = '';

      const encrypted = await encryptionService.encryptMessage(empty, 'server');
      const decrypted = await encryptionService.decryptMessage(encrypted);

      expect(decrypted).toBe(empty);
    });

    it('should handle very long messages', async () => {
      const longText = 'A'.repeat(10000);

      const encrypted = await encryptionService.encryptMessage(longText, 'server');
      const decrypted = await encryptionService.decryptMessage(encrypted);

      expect(decrypted).toBe(longText);
      expect(decrypted.length).toBe(10000);
    });

    it('should fail decryption with wrong key', async () => {
      const plaintext = 'Secret message';
      const encrypted = await encryptionService.encryptMessage(plaintext, 'server');

      // Tamper with keyId to simulate wrong key
      encrypted.metadata.keyId = 'wrong_key_id';

      await expect(
        encryptionService.decryptMessage(encrypted)
      ).rejects.toThrow();
    });

    it('should fail decryption with tampered ciphertext', async () => {
      const plaintext = 'Secret message';
      const encrypted = await encryptionService.encryptMessage(plaintext, 'server');

      // Tamper with ciphertext
      encrypted.ciphertext = encrypted.ciphertext.slice(0, -5) + 'XXXXX';

      await expect(
        encryptionService.decryptMessage(encrypted)
      ).rejects.toThrow();
    });

    it('should fail decryption with tampered auth tag', async () => {
      const plaintext = 'Secret message';
      const encrypted = await encryptionService.encryptMessage(plaintext, 'server');

      // Tamper with auth tag
      encrypted.metadata.authTag = crypto.randomBytes(16).toString('base64');

      await expect(
        encryptionService.decryptMessage(encrypted)
      ).rejects.toThrow();
    });
  });

  describe('E2EE Mode', () => {
    it('should store E2EE content without decrypting', async () => {
      const clientEncrypted: EncryptedPayload = {
        ciphertext: Buffer.from('Client encrypted content').toString('base64'),
        metadata: {
          mode: 'e2ee',
          protocol: 'signal_v3',
          keyId: 'client_key_123',
          iv: crypto.randomBytes(12).toString('base64'),
          authTag: crypto.randomBytes(16).toString('base64'),
          messageNumber: 1,
          preKeyId: 42,
        }
      };

      const encrypted = await encryptionService.encryptMessage(
        'ignored_content',
        'e2ee',
        clientEncrypted
      );

      expect(encrypted.ciphertext).toBe(clientEncrypted.ciphertext);
      expect(encrypted.metadata.mode).toBe('e2ee');
      expect(encrypted.metadata.protocol).toBe('signal_v3');
      expect(encrypted.metadata.messageNumber).toBe(1);
      expect(encrypted.metadata.preKeyId).toBe(42);
    });

    it('should reject E2EE encryption without client payload', async () => {
      await expect(
        encryptionService.encryptMessage('test', 'e2ee')
      ).rejects.toThrow('E2EE mode requires client-encrypted payload');
    });

    it('should reject server decryption of E2EE messages', async () => {
      const e2eePayload: EncryptedPayload = {
        ciphertext: 'encrypted_by_client',
        metadata: {
          mode: 'e2ee',
          protocol: 'signal_v3',
          keyId: 'client_key',
          iv: 'test_iv',
          authTag: 'test_tag',
        }
      };

      await expect(
        encryptionService.decryptMessage(e2eePayload)
      ).rejects.toThrow('Cannot decrypt E2EE messages on server');
    });
  });

  describe('Translation and Re-encryption', () => {
    it('should decrypt, translate, and re-encrypt', async () => {
      const originalText = 'Hello world';
      const translatedText = 'Bonjour le monde';

      // Encrypt original
      const encrypted = await encryptionService.encryptMessage(originalText, 'server');

      // Simulate translation
      const reEncrypted = await encryptionService.translateAndReEncrypt(
        encrypted,
        translatedText
      );

      expect(reEncrypted.metadata.mode).toBe('server');
      expect(reEncrypted.metadata.keyId).toBe(encrypted.metadata.keyId); // Same key

      // Decrypt translated
      const decrypted = await encryptionService.decryptMessage(reEncrypted);
      expect(decrypted).toBe(translatedText);
    });

    it('should reject translation of E2EE messages', async () => {
      const e2eePayload: EncryptedPayload = {
        ciphertext: 'e2ee_encrypted',
        metadata: {
          mode: 'e2ee',
          protocol: 'signal_v3',
          keyId: 'client_key',
          iv: 'iv',
          authTag: 'tag',
        }
      };

      await expect(
        encryptionService.translateAndReEncrypt(e2eePayload, 'translated text')
      ).rejects.toThrow('Translation only supported in server-encrypted mode');
    });
  });

  describe('Key Management', () => {
    it('should generate unique key IDs', async () => {
      const keyId1 = await encryptionService.getOrCreateConversationKey();
      const keyId2 = await encryptionService.getOrCreateConversationKey();

      // Should reuse the same key
      expect(keyId1).toBe(keyId2);
    });

    it('should rotate encryption keys', async () => {
      const oldKeyId = await encryptionService.getOrCreateConversationKey();
      const newKey = await encryptionService.rotateKey(oldKeyId);

      expect(newKey.id).toBeTruthy();
      expect(newKey.id).not.toBe(oldKeyId);
      expect(newKey.algorithm).toBe('aes-256-gcm');
      expect(newKey.rotatedAt).toBeUndefined(); // New key, not rotated
    });

    it('should identify decryptable messages', () => {
      const serverMetadata = {
        mode: 'server' as const,
        protocol: 'aes-256-gcm' as const,
        keyId: 'key123',
        iv: 'iv',
        authTag: 'tag',
      };

      const e2eeMetadata = {
        mode: 'e2ee' as const,
        protocol: 'signal_v3' as const,
        keyId: 'key456',
        iv: 'iv',
        authTag: 'tag',
      };

      expect(encryptionService.canDecrypt(serverMetadata)).toBe(true);
      expect(encryptionService.canDecrypt(e2eeMetadata)).toBe(false);
    });
  });

  describe('Storage Helpers', () => {
    it('should parse encrypted content from database', () => {
      const encryptedContent = 'base64_encrypted_content';
      const metadata = {
        mode: 'server',
        protocol: 'aes-256-gcm',
        keyId: 'key123',
        iv: 'iv_base64',
        authTag: 'tag_base64',
      };

      const parsed = encryptionService.parseEncryptedContent(encryptedContent, metadata);

      expect(parsed).toBeTruthy();
      expect(parsed?.ciphertext).toBe(encryptedContent);
      expect(parsed?.metadata.mode).toBe('server');
    });

    it('should return null for null encrypted content', () => {
      const parsed = encryptionService.parseEncryptedContent(null, null);
      expect(parsed).toBeNull();
    });

    it('should prepare payload for storage', async () => {
      const plaintext = 'Test message';
      const encrypted = await encryptionService.encryptMessage(plaintext, 'server');

      const storage = encryptionService.prepareForStorage(encrypted);

      expect(storage.encryptedContent).toBe(encrypted.ciphertext);
      expect(storage.encryptionMetadata).toEqual(encrypted.metadata);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent encryption requests', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        encryptionService.encryptMessage(`Message ${i}`, 'server')
      );

      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result.ciphertext).toBeTruthy();
        expect(result.metadata.mode).toBe('server');
      });

      // All should be decryptable
      const decrypted = await Promise.all(
        results.map(r => encryptionService.decryptMessage(r))
      );

      decrypted.forEach((text, i) => {
        expect(text).toBe(`Message ${i}`);
      });
    });

    it('should handle encryption of JSON data', async () => {
      const jsonData = JSON.stringify({
        user: 'Alice',
        message: 'Hello',
        timestamp: new Date().toISOString(),
        metadata: { important: true }
      });

      const encrypted = await encryptionService.encryptMessage(jsonData, 'server');
      const decrypted = await encryptionService.decryptMessage(encrypted);

      expect(decrypted).toBe(jsonData);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
    });

    it('should handle multiline text', async () => {
      const multiline = `Line 1
Line 2
Line 3
With special chars: 🚀 ✨ 🔐`;

      const encrypted = await encryptionService.encryptMessage(multiline, 'server');
      const decrypted = await encryptionService.decryptMessage(encrypted);

      expect(decrypted).toBe(multiline);
    });
  });

  describe('Performance', () => {
    it('should encrypt/decrypt within reasonable time', async () => {
      const text = 'Performance test message';
      const iterations = 100;

      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        const encrypted = await encryptionService.encryptMessage(text, 'server');
        const decrypted = await encryptionService.decryptMessage(encrypted);
        expect(decrypted).toBe(text);
      }

      const duration = Date.now() - start;
      const avgTime = duration / iterations;

      console.log(`Average encryption+decryption time: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(50); // Should be fast (< 50ms per round trip)
    });
  });
});
