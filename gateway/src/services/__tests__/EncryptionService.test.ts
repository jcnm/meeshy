/**
 * Encryption Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  EncryptionService,
  createEncryptionService,
  createSignalEncryptionService,
  createMLSEncryptionService,
} from '../EncryptionService';
import type { KeyBundle } from '../../encryption-adapters/base.adapter';

describe('EncryptionService', () => {
  let aliceService: EncryptionService;
  let bobService: EncryptionService;

  beforeEach(async () => {
    aliceService = await createSignalEncryptionService('alice');
    bobService = await createSignalEncryptionService('bob');
  });

  afterEach(async () => {
    await aliceService.destroy();
    await bobService.destroy();
  });

  describe('initialization', () => {
    it('should initialize with Signal protocol', async () => {
      const service = await createSignalEncryptionService('test-user');
      expect(service.isInitialized()).toBe(true);
      expect(service.getCurrentProtocol()).toBe('signal');
      await service.destroy();
    });

    it('should initialize with MLS protocol', async () => {
      const service = await createMLSEncryptionService('test-user');
      expect(service.isInitialized()).toBe(true);
      expect(service.getCurrentProtocol()).toBe('mls');
      await service.destroy();
    });

    it('should initialize with custom config', async () => {
      const service = await createEncryptionService({
        userId: 'custom-user',
        defaultProtocol: 'signal',
        allowProtocolSwitch: false,
      });

      expect(service.isInitialized()).toBe(true);
      expect(service.getCurrentProtocol()).toBe('signal');
      await service.destroy();
    });

    it('should throw when using service before initialization', async () => {
      const service = new EncryptionService({
        userId: 'test',
        defaultProtocol: 'signal',
      });

      await expect(service.encrypt('bob', 'test')).rejects.toThrow(
        'EncryptionService not initialized'
      );
    });
  });

  describe('key exchange', () => {
    it('should get key bundle', async () => {
      const keyBundle = await aliceService.getKeyBundle();

      expect(keyBundle).toBeDefined();
      expect(keyBundle.identityKey).toBeInstanceOf(Uint8Array);
      expect(keyBundle.registrationId).toBeGreaterThanOrEqual(0);
    });

    it('should process key bundle from another user', async () => {
      const bobKeyBundle = await bobService.getKeyBundle();

      await expect(
        aliceService.processKeyBundle('bob', bobKeyBundle)
      ).resolves.not.toThrow();
    });

    it('should exchange keys between two users', async () => {
      const bobKeyBundle = await bobService.getKeyBundle();
      const aliceKeyBundle = await aliceService.exchangeKeys('bob', bobKeyBundle);

      expect(aliceKeyBundle).toBeDefined();
      expect(aliceKeyBundle.identityKey).toBeInstanceOf(Uint8Array);
    });
  });

  describe('encryption and decryption with Signal Protocol', () => {
    beforeEach(async () => {
      // Setup sessions
      const aliceKeyBundle = await aliceService.getKeyBundle();
      const bobKeyBundle = await bobService.getKeyBundle();

      await aliceService.processKeyBundle('bob', bobKeyBundle);
      await bobService.processKeyBundle('alice', aliceKeyBundle);
    });

    it('should encrypt and decrypt a message', async () => {
      const message = 'Hello from Alice to Bob!';

      const encrypted = await aliceService.encrypt('bob', message);
      expect(encrypted).toBeDefined();
      expect(encrypted.recipientId).toBe('bob');

      const decrypted = await bobService.decrypt('alice', encrypted);
      expect(decrypted).toBe(message);
    });

    it('should handle bidirectional communication', async () => {
      // Alice to Bob
      const msg1 = 'Hi Bob!';
      const enc1 = await aliceService.encrypt('bob', msg1);
      const dec1 = await bobService.decrypt('alice', enc1);
      expect(dec1).toBe(msg1);

      // Bob to Alice
      const msg2 = 'Hi Alice!';
      const enc2 = await bobService.encrypt('alice', msg2);
      const dec2 = await aliceService.decrypt('bob', enc2);
      expect(dec2).toBe(msg2);
    });

    it('should handle multiple messages', async () => {
      const messages = ['Message 1', 'Message 2', 'Message 3'];

      for (const msg of messages) {
        const encrypted = await aliceService.encrypt('bob', msg);
        const decrypted = await bobService.decrypt('alice', encrypted);
        expect(decrypted).toBe(msg);
      }
    });
  });

  describe('protocol switching', () => {
    it('should switch from Signal to MLS', async () => {
      const service = await createEncryptionService({
        userId: 'test-user',
        defaultProtocol: 'signal',
        allowProtocolSwitch: true,
      });

      expect(service.getCurrentProtocol()).toBe('signal');

      await service.switchProtocol('mls');
      expect(service.getCurrentProtocol()).toBe('mls');

      await service.destroy();
    });

    it('should switch from MLS to Signal', async () => {
      const service = await createEncryptionService({
        userId: 'test-user',
        defaultProtocol: 'mls',
        allowProtocolSwitch: true,
      });

      expect(service.getCurrentProtocol()).toBe('mls');

      await service.switchProtocol('signal');
      expect(service.getCurrentProtocol()).toBe('signal');

      await service.destroy();
    });

    it('should throw when switching is disabled', async () => {
      const service = await createEncryptionService({
        userId: 'test-user',
        defaultProtocol: 'signal',
        allowProtocolSwitch: false,
      });

      await expect(service.switchProtocol('mls')).rejects.toThrow(
        'Protocol switching is disabled'
      );

      await service.destroy();
    });

    it('should not switch if already using the protocol', async () => {
      const service = await createSignalEncryptionService('test-user');

      // Should not throw
      await service.switchProtocol('signal');
      expect(service.getCurrentProtocol()).toBe('signal');

      await service.destroy();
    });

    it('should reinitialize after protocol switch', async () => {
      const service = await createEncryptionService({
        userId: 'test-user',
        defaultProtocol: 'signal',
        allowProtocolSwitch: true,
      });

      // Switch to MLS
      await service.switchProtocol('mls');

      // Should be able to use the service after switch
      const keyBundle = await service.getKeyBundle();
      expect(keyBundle).toBeDefined();

      await service.destroy();
    });
  });

  describe('current protocol', () => {
    it('should return current protocol name', () => {
      expect(aliceService.getCurrentProtocol()).toBe('signal');
    });
  });

  describe('destruction', () => {
    it('should destroy service and cleanup keys', async () => {
      const service = await createSignalEncryptionService('test-user');

      await service.destroy();
      expect(service.isInitialized()).toBe(false);

      // Should throw after destruction
      await expect(service.getKeyBundle()).rejects.toThrow();
    });

    it('should handle multiple destroy calls', async () => {
      const service = await createSignalEncryptionService('test-user');

      await service.destroy();
      await service.destroy(); // Should not throw

      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('adapter access', () => {
    it('should provide access to underlying adapter', () => {
      const adapter = aliceService.getAdapter();

      expect(adapter).toBeDefined();
      expect(adapter.getProtocolName()).toBe('signal');
    });

    it('should throw when accessing adapter before initialization', () => {
      const service = new EncryptionService({
        userId: 'test',
        defaultProtocol: 'signal',
      });

      expect(() => service.getAdapter()).toThrow(
        'EncryptionService not initialized'
      );
    });
  });

  describe('factory functions', () => {
    it('should create Signal service with factory', async () => {
      const service = await createSignalEncryptionService('factory-test');

      expect(service.isInitialized()).toBe(true);
      expect(service.getCurrentProtocol()).toBe('signal');

      await service.destroy();
    });

    it('should create MLS service with factory', async () => {
      const service = await createMLSEncryptionService('factory-test');

      expect(service.isInitialized()).toBe(true);
      expect(service.getCurrentProtocol()).toBe('mls');

      await service.destroy();
    });
  });

  describe('error scenarios', () => {
    it('should handle encryption errors gracefully', async () => {
      // Try to encrypt without establishing session
      await expect(aliceService.encrypt('unknown-user', 'test')).rejects.toThrow();
    });

    it('should handle decryption errors gracefully', async () => {
      const fakeEncrypted = {
        type: 0,
        body: new Uint8Array([1, 2, 3]),
        recipientId: 'alice',
        timestamp: Date.now(),
      };

      // Try to decrypt invalid message
      await expect(
        bobService.decrypt('alice', fakeEncrypted)
      ).rejects.toThrow();
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple concurrent encryptions', async () => {
      // Setup session
      const bobKeyBundle = await bobService.getKeyBundle();
      await aliceService.processKeyBundle('bob', bobKeyBundle);

      // Encrypt multiple messages concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(aliceService.encrypt('bob', `Message ${i}`));
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(10);

      // Each should have unique ciphertext
      const ciphertexts = results.map((r) => r.body.toString());
      const uniqueCiphertexts = new Set(ciphertexts);
      expect(uniqueCiphertexts.size).toBe(10);
    });
  });
});
