/**
 * Backend Encryption Service
 *
 * Wraps the shared encryption service with Node.js-specific adapters.
 * Handles encryption/decryption for both modes:
 * - E2EE mode: Server only stores encrypted blobs (cannot decrypt)
 * - Server mode: Server can decrypt for translation (decrypt → translate → re-encrypt)
 */

import {
  EncryptionMode,
  EncryptedPayload,
  EncryptionMetadata,
  ServerEncryptionKey,
} from '../../shared/types/encryption';
import {
  SharedEncryptionService,
  prepareForStorage,
  reconstructPayload,
} from '../../shared/encryption/index';
import { SignalProtocolService } from '../../shared/encryption/signal/signal-protocol-service';
import type { PreKeyBundle } from '../../shared/encryption/signal/signal-types';
import { nodeCryptoAdapter } from '../adapters/node-crypto-adapter';
import { nodeKeyStorageAdapter } from '../adapters/node-key-storage-adapter';
import { createNodeSignalStores } from '../adapters/node-signal-stores';

/**
 * Backend Encryption Service
 *
 * Uses shared encryption logic with Node.js-specific crypto and storage adapters.
 * Includes full Signal Protocol support for E2EE messaging.
 */
class BackendEncryptionService {
  private sharedService!: SharedEncryptionService;
  private signalService?: SignalProtocolService;
  private isInitialized = false;

  constructor() {
    // Will be initialized in initialize()
  }

  /**
   * Initialize encryption service
   * For backend, we initialize with a "system" user and create Signal Protocol stores
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create Signal Protocol stores for E2EE support
    const signalStores = await createNodeSignalStores({ userId: 'system' });

    // Create Signal Protocol service
    this.signalService = new SignalProtocolService(signalStores, 1);

    // Initialize shared service with Signal Protocol support
    this.sharedService = new SharedEncryptionService({
      cryptoAdapter: nodeCryptoAdapter,
      keyStorage: nodeKeyStorageAdapter,
      signalProtocolService: this.signalService,
    });

    // Backend uses "system" as the user context
    await this.sharedService.initialize('system');
    this.isInitialized = true;

    console.log('[BackendEncryptionService] Initialized with Signal Protocol support');
  }

  /**
   * Encrypt message content based on conversation mode
   *
   * @param content - Plaintext message content
   * @param mode - Encryption mode (e2ee or server)
   * @param conversationId - Conversation ID for key derivation
   * @param existingPayload - For E2EE mode, the client provides encrypted content
   * @returns Encrypted payload for storage
   */
  async encryptMessage(
    content: string,
    mode: EncryptionMode,
    conversationId?: string,
    existingPayload?: EncryptedPayload
  ): Promise<EncryptedPayload> {
    await this.initialize();

    if (mode === 'e2ee') {
      // E2EE mode: Client already encrypted the content
      if (!existingPayload) {
        throw new Error('E2EE mode requires client-encrypted payload');
      }
      // Just pass through the client-encrypted payload
      return existingPayload;
    } else {
      // Server mode: Encrypt on server for translation capability
      // Use conversation-specific key for better security
      const keyId = conversationId || 'server-key';

      return await this.sharedService.encryptMessage(content, keyId, mode);
    }
  }

  /**
   * Decrypt message content (only works for server mode)
   *
   * @param encryptedPayload - Encrypted message payload
   * @returns Decrypted plaintext
   * @throws Error if message is E2EE mode (server cannot decrypt)
   */
  async decryptMessage(encryptedPayload: EncryptedPayload): Promise<string> {
    await this.initialize();

    const { metadata } = encryptedPayload;

    // Check if server can decrypt
    if (metadata.mode === 'e2ee') {
      throw new Error('Cannot decrypt E2EE messages on server');
    }

    // Use shared service to decrypt
    return await this.sharedService.decryptMessage(encryptedPayload);
  }

  /**
   * Decrypt for translation, then re-encrypt
   * Used for server-side translation in server-encrypted mode
   *
   * @param encryptedPayload - Original encrypted message
   * @param translatedContent - Translated plaintext
   * @returns Re-encrypted payload with translated content
   */
  async translateAndReEncrypt(
    encryptedPayload: EncryptedPayload,
    translatedContent: string
  ): Promise<EncryptedPayload> {
    await this.initialize();

    const { metadata } = encryptedPayload;

    // Verify this is server mode
    if (metadata.mode !== 'server') {
      throw new Error('Translation only supported in server-encrypted mode');
    }

    // Re-encrypt with same key
    const conversationId = 'server-key';
    return await this.sharedService.encryptMessage(
      translatedContent,
      conversationId,
      'server'
    );
  }

  /**
   * Get or create server encryption key for a conversation
   */
  async getOrCreateConversationKey(): Promise<string> {
    await this.initialize();

    // Check if we have a server key
    const conversationKey = await nodeKeyStorageAdapter.getConversationKey('server-key');

    if (conversationKey) {
      return conversationKey.keyId;
    }

    // Generate new server key
    const key = await nodeCryptoAdapter.generateEncryptionKey();
    const keyId = `server-key-${Date.now()}`;
    const keyData = await nodeCryptoAdapter.exportKey(key);
    const keyString = Buffer.from(keyData).toString('base64');

    await nodeKeyStorageAdapter.storeKey(keyId, keyString);
    await nodeKeyStorageAdapter.storeConversationKey('server-key', keyId, 'server');

    return keyId;
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(currentKeyId: string): Promise<ServerEncryptionKey> {
    await this.initialize();

    // Generate new key
    const key = await nodeCryptoAdapter.generateEncryptionKey();
    const newKeyId = `server-key-${Date.now()}`;
    const keyData = await nodeCryptoAdapter.exportKey(key);
    const keyString = Buffer.from(keyData).toString('base64');

    await nodeKeyStorageAdapter.storeKey(newKeyId, keyString);

    return {
      id: newKeyId,
      algorithm: 'aes-256-gcm',
      publicKey: keyString,
      privateKey: keyString, // For symmetric encryption, public/private are the same
      createdAt: new Date(),
      rotatedAt: new Date(),
    };
  }

  /**
   * Check if message can be decrypted by server
   */
  canDecrypt(metadata: EncryptionMetadata): boolean {
    return metadata.mode === 'server';
  }

  /**
   * Parse encrypted content from database
   */
  parseEncryptedContent(
    encryptedContent: string | null,
    encryptionMetadata: any
  ): EncryptedPayload | null {
    if (!encryptedContent || !encryptionMetadata) {
      return null;
    }

    try {
      return reconstructPayload(encryptedContent, encryptionMetadata);
    } catch (error) {
      console.error('[EncryptionService] Failed to parse encrypted content:', error);
      return null;
    }
  }

  /**
   * Prepare encrypted content for database storage
   */
  prepareForStorage(payload: EncryptedPayload): {
    encryptedContent: string;
    encryptionMetadata: Record<string, any>;
  } {
    return prepareForStorage(payload);
  }

  /**
   * Get encryption service status
   */
  getStatus() {
    return this.sharedService.getStatus();
  }

  /**
   * Generate Signal Protocol pre-key bundle for a user
   * Used for E2EE session establishment
   */
  async generatePreKeyBundle(): Promise<PreKeyBundle> {
    await this.initialize();

    if (!this.signalService) {
      throw new Error('Signal Protocol service not initialized');
    }

    return await this.signalService.generatePreKeyBundle();
  }

  /**
   * Get Signal Protocol service for direct access
   * Used by routes that need fine-grained control
   */
  getSignalService(): SignalProtocolService | undefined {
    return this.signalService;
  }
}

// Export singleton instance
export const encryptionService = new BackendEncryptionService();
export { BackendEncryptionService as EncryptionService };
