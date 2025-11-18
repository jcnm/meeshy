/**
 * Signal Protocol Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SignalProtocolAdapter } from '../signal.adapter';
import type { EncryptedMessage, KeyBundle } from '../base.adapter';

describe('SignalProtocolAdapter', () => {
  let aliceAdapter: SignalProtocolAdapter;
  let bobAdapter: SignalProtocolAdapter;

  beforeEach(async () => {
    aliceAdapter = new SignalProtocolAdapter();
    bobAdapter = new SignalProtocolAdapter();

    await aliceAdapter.initialize('alice');
    await bobAdapter.initialize('bob');
  });

  afterEach(async () => {
    await aliceAdapter.cleanup();
    await bobAdapter.cleanup();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const adapter = new SignalProtocolAdapter();
      await adapter.initialize('test-user');

      expect(adapter.getProtocolName()).toBe('signal');

      await adapter.cleanup();
    });

    it('should generate key bundle after initialization', async () => {
      const keyBundle = await aliceAdapter.getKeyBundle();

      expect(keyBundle).toBeDefined();
      expect(keyBundle.identityKey).toBeInstanceOf(Uint8Array);
      expect(keyBundle.registrationId).toBeGreaterThanOrEqual(0);
      expect(keyBundle.signedPreKey).toBeDefined();
      expect(keyBundle.preKeys.length).toBeGreaterThan(0);
    });
  });

  describe('key exchange', () => {
    it('should exchange key bundles between two users', async () => {
      const aliceKeyBundle = await aliceAdapter.getKeyBundle();
      const bobKeyBundle = await bobAdapter.getKeyBundle();

      expect(aliceKeyBundle.identityKey).not.toEqual(bobKeyBundle.identityKey);
      expect(aliceKeyBundle.registrationId).not.toEqual(
        bobKeyBundle.registrationId
      );
    });

    it('should process key bundle from another user', async () => {
      const bobKeyBundle = await bobAdapter.getKeyBundle();

      await expect(
        aliceAdapter.processKeyBundle('bob', bobKeyBundle)
      ).resolves.not.toThrow();
    });

    it('should establish session after processing key bundle', async () => {
      const bobKeyBundle = await bobAdapter.getKeyBundle();
      await aliceAdapter.processKeyBundle('bob', bobKeyBundle);

      // Now Alice should be able to encrypt messages to Bob
      const encrypted = await aliceAdapter.encrypt('bob', 'Hello Bob!');
      expect(encrypted).toBeDefined();
      expect(encrypted.recipientId).toBe('bob');
    });
  });

  describe('encryption and decryption', () => {
    beforeEach(async () => {
      // Setup sessions between Alice and Bob
      const aliceKeyBundle = await aliceAdapter.getKeyBundle();
      const bobKeyBundle = await bobAdapter.getKeyBundle();

      await aliceAdapter.processKeyBundle('bob', bobKeyBundle);
      await bobAdapter.processKeyBundle('alice', aliceKeyBundle);
    });

    it('should encrypt a message', async () => {
      const message = 'Hello, this is a secret message!';
      const encrypted = await aliceAdapter.encrypt('bob', message);

      expect(encrypted).toBeDefined();
      expect(encrypted.type).toBeDefined();
      expect(encrypted.body).toBeInstanceOf(Uint8Array);
      expect(encrypted.body.length).toBeGreaterThan(0);
      expect(encrypted.recipientId).toBe('bob');
      expect(encrypted.timestamp).toBeGreaterThan(0);
    });

    it('should decrypt a message', async () => {
      const originalMessage = 'Secret message from Alice to Bob';

      // Alice encrypts
      const encrypted = await aliceAdapter.encrypt('bob', originalMessage);

      // Bob decrypts
      const decrypted = await bobAdapter.decrypt('alice', encrypted);

      expect(decrypted).toBe(originalMessage);
    });

    it('should handle multiple messages in sequence', async () => {
      const messages = [
        'First message',
        'Second message',
        'Third message with more content',
      ];

      for (const msg of messages) {
        const encrypted = await aliceAdapter.encrypt('bob', msg);
        const decrypted = await bobAdapter.decrypt('alice', encrypted);
        expect(decrypted).toBe(msg);
      }
    });

    it('should handle bidirectional communication', async () => {
      // Alice to Bob
      const aliceToBob = 'Hello Bob, this is Alice';
      const encrypted1 = await aliceAdapter.encrypt('bob', aliceToBob);
      const decrypted1 = await bobAdapter.decrypt('alice', encrypted1);
      expect(decrypted1).toBe(aliceToBob);

      // Bob to Alice
      const bobToAlice = 'Hi Alice, Bob here!';
      const encrypted2 = await bobAdapter.encrypt('alice', bobToAlice);
      const decrypted2 = await aliceAdapter.decrypt('bob', encrypted2);
      expect(decrypted2).toBe(bobToAlice);

      // Alice to Bob again
      const aliceToBob2 = 'How are you doing?';
      const encrypted3 = await aliceAdapter.encrypt('bob', aliceToBob2);
      const decrypted3 = await bobAdapter.decrypt('alice', encrypted3);
      expect(decrypted3).toBe(aliceToBob2);
    });

    it('should handle Unicode characters', async () => {
      const messages = [
        'Hello 👋 World 🌍',
        'Français: Bonjour!',
        'Español: ¡Hola!',
        '中文: 你好',
        'العربية: مرحبا',
        'Emoji party: 🎉🎊🎈🎁',
      ];

      for (const msg of messages) {
        const encrypted = await aliceAdapter.encrypt('bob', msg);
        const decrypted = await bobAdapter.decrypt('alice', encrypted);
        expect(decrypted).toBe(msg);
      }
    });

    it('should handle long messages', async () => {
      const longMessage = 'A'.repeat(10000); // 10KB message

      const encrypted = await aliceAdapter.encrypt('bob', longMessage);
      const decrypted = await bobAdapter.decrypt('alice', encrypted);

      expect(decrypted).toBe(longMessage);
      expect(decrypted.length).toBe(10000);
    });

    it('should handle empty messages', async () => {
      const emptyMessage = '';

      const encrypted = await aliceAdapter.encrypt('bob', emptyMessage);
      const decrypted = await bobAdapter.decrypt('alice', encrypted);

      expect(decrypted).toBe(emptyMessage);
    });
  });

  describe('error handling', () => {
    it('should throw when encrypting without session', async () => {
      await expect(
        aliceAdapter.encrypt('unknown-user', 'test')
      ).rejects.toThrow();
    });

    it('should throw when adapter not initialized', async () => {
      const uninitializedAdapter = new SignalProtocolAdapter();

      await expect(
        uninitializedAdapter.encrypt('bob', 'test')
      ).rejects.toThrow('Signal adapter not initialized');
    });

    it('should throw when getting key bundle before initialization', async () => {
      const uninitializedAdapter = new SignalProtocolAdapter();

      await expect(uninitializedAdapter.getKeyBundle()).rejects.toThrow(
        'Signal adapter not initialized'
      );
    });
  });

  describe('protocol name', () => {
    it('should return "signal" as protocol name', () => {
      expect(aliceAdapter.getProtocolName()).toBe('signal');
    });
  });

  describe('cleanup', () => {
    it('should cleanup successfully', async () => {
      const adapter = new SignalProtocolAdapter();
      await adapter.initialize('test-user');
      await adapter.cleanup();

      // After cleanup, should not be able to use adapter
      await expect(adapter.getKeyBundle()).rejects.toThrow();
    });

    it('should clear all sessions after cleanup', async () => {
      const bobKeyBundle = await bobAdapter.getKeyBundle();
      await aliceAdapter.processKeyBundle('bob', bobKeyBundle);

      // Should be able to encrypt before cleanup
      await expect(
        aliceAdapter.encrypt('bob', 'test')
      ).resolves.toBeDefined();

      // Cleanup
      await aliceAdapter.cleanup();

      // Should not be able to encrypt after cleanup
      await expect(aliceAdapter.encrypt('bob', 'test')).rejects.toThrow();
    });
  });

  describe('forward secrecy', () => {
    it('should use different keys for each message (ratcheting)', async () => {
      // Setup session
      const bobKeyBundle = await bobAdapter.getKeyBundle();
      await aliceAdapter.processKeyBundle('bob', bobKeyBundle);

      // Encrypt multiple messages and check they produce different ciphertexts
      const message = 'Same message';
      const encrypted1 = await aliceAdapter.encrypt('bob', message);
      const encrypted2 = await aliceAdapter.encrypt('bob', message);

      // Same plaintext should produce different ciphertexts due to ratcheting
      expect(encrypted1.body).not.toEqual(encrypted2.body);
    });
  });

  describe('concurrent sessions', () => {
    it('should handle multiple concurrent sessions', async () => {
      // Create Charlie
      const charlieAdapter = new SignalProtocolAdapter();
      await charlieAdapter.initialize('charlie');

      // Alice sets up sessions with both Bob and Charlie
      const bobKeyBundle = await bobAdapter.getKeyBundle();
      const charlieKeyBundle = await charlieAdapter.getKeyBundle();

      await aliceAdapter.processKeyBundle('bob', bobKeyBundle);
      await aliceAdapter.processKeyBundle('charlie', charlieKeyBundle);

      // Alice sends different messages to Bob and Charlie
      const toBob = 'Hello Bob';
      const toCharlie = 'Hello Charlie';

      const encryptedToBob = await aliceAdapter.encrypt('bob', toBob);
      const encryptedToCharlie = await aliceAdapter.encrypt(
        'charlie',
        toCharlie
      );

      // Setup reverse sessions
      const aliceKeyBundle = await aliceAdapter.getKeyBundle();
      await bobAdapter.processKeyBundle('alice', aliceKeyBundle);
      await charlieAdapter.processKeyBundle('alice', aliceKeyBundle);

      // Bob and Charlie should decrypt their respective messages
      const bobReceived = await bobAdapter.decrypt('alice', encryptedToBob);
      const charlieReceived = await charlieAdapter.decrypt(
        'alice',
        encryptedToCharlie
      );

      expect(bobReceived).toBe(toBob);
      expect(charlieReceived).toBe(toCharlie);

      await charlieAdapter.cleanup();
    });
  });
});
