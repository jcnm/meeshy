/**
 * Encryption Service
 *
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
  generateEncryptionKey,
  generateKeyId,
  encryptContent,
  decryptContent,
  storeE2EEContent,
  encryptKey,
  decryptKey,
} from '../utils/encryption';

/**
 * Simple in-memory key vault
 * In production, this should be replaced with a proper vault service (HashiCorp Vault, AWS KMS, etc.)
 */
class KeyVault {
  private keys: Map<string, Buffer> = new Map();
  private keyMetadata: Map<string, ServerEncryptionKey> = new Map();
  private masterKey: Buffer;

  constructor() {
    // In production, this should come from environment variable or secure storage
    const masterKeyEnv = process.env.ENCRYPTION_MASTER_KEY;
    if (masterKeyEnv) {
      this.masterKey = Buffer.from(masterKeyEnv, 'base64');
    } else {
      // Generate a temporary master key (NOT for production!)
      this.masterKey = generateEncryptionKey();
      console.warn(
        'WARNING: Using temporary encryption master key. Set ENCRYPTION_MASTER_KEY environment variable in production!'
      );
    }
  }

  /**
   * Create and store a new server encryption key
   */
  async createKey(): Promise<ServerEncryptionKey> {
    const keyId = generateKeyId();
    const key = generateEncryptionKey();

    // Encrypt the key with master key for storage
    const encryptedKeyData = encryptKey(key, this.masterKey);

    const keyMetadata: ServerEncryptionKey = {
      id: keyId,
      algorithm: 'aes-256-gcm',
      publicKey: key.toString('base64'), // For symmetric encryption, this is just the key
      privateKey: encryptedKeyData.encryptedKey, // Encrypted with master key
      createdAt: new Date(),
    };

    // Store in memory
    this.keys.set(keyId, key);
    this.keyMetadata.set(keyId, keyMetadata);

    return keyMetadata;
  }

  /**
   * Get a key by ID
   */
  async getKey(keyId: string): Promise<Buffer | null> {
    // Check in-memory cache
    if (this.keys.has(keyId)) {
      return this.keys.get(keyId)!;
    }

    // Try to load from metadata (in production, this would load from vault)
    const metadata = this.keyMetadata.get(keyId);
    if (!metadata) {
      return null;
    }

    // Decrypt the key
    const encryptedKeyData = {
      encryptedKey: metadata.privateKey,
      iv: '', // Would be stored with metadata
      authTag: '', // Would be stored with metadata
    };

    // For simplicity, we'll keep the key in memory
    // In production, decrypt from vault storage
    return this.keys.get(keyId) || null;
  }

  /**
   * Get current active key (or create one if none exists)
   */
  async getCurrentKey(): Promise<{ keyId: string; key: Buffer }> {
    // For simplicity, return the first key or create a new one
    if (this.keys.size === 0) {
      const metadata = await this.createKey();
      return {
        keyId: metadata.id,
        key: this.keys.get(metadata.id)!,
      };
    }

    const firstKeyId = Array.from(this.keys.keys())[0];
    return {
      keyId: firstKeyId,
      key: this.keys.get(firstKeyId)!,
    };
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(oldKeyId: string): Promise<ServerEncryptionKey> {
    const newKey = await this.createKey();

    // Mark old key metadata as rotated
    const oldMetadata = this.keyMetadata.get(oldKeyId);
    if (oldMetadata) {
      oldMetadata.rotatedAt = new Date();
    }

    return newKey;
  }
}

// Singleton instance
const keyVault = new KeyVault();

/**
 * Encryption Service
 */
export class EncryptionService {
  /**
   * Encrypt message content based on conversation mode
   *
   * @param content - Plaintext message content
   * @param mode - Encryption mode (e2ee or server)
   * @param existingPayload - For E2EE mode, the client provides encrypted content
   * @returns Encrypted payload for storage
   */
  async encryptMessage(
    content: string,
    mode: EncryptionMode,
    existingPayload?: EncryptedPayload
  ): Promise<EncryptedPayload> {
    if (mode === 'e2ee') {
      // E2EE mode: Client already encrypted the content
      if (!existingPayload) {
        throw new Error('E2EE mode requires client-encrypted payload');
      }
      return storeE2EEContent(existingPayload.ciphertext, existingPayload.metadata);
    } else {
      // Server mode: Encrypt on server for translation capability
      const { keyId, key } = await keyVault.getCurrentKey();
      return encryptContent(content, key, keyId);
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
    const { metadata } = encryptedPayload;

    // Check if server can decrypt
    if (metadata.mode === 'e2ee') {
      throw new Error('Cannot decrypt E2EE messages on server');
    }

    // Get decryption key
    const key = await keyVault.getKey(metadata.keyId);
    if (!key) {
      throw new Error(`Decryption key not found: ${metadata.keyId}`);
    }

    // Decrypt
    return decryptContent(encryptedPayload, key);
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
    const { metadata } = encryptedPayload;

    // Verify this is server mode
    if (metadata.mode !== 'server') {
      throw new Error('Translation only supported in server-encrypted mode');
    }

    // Re-encrypt with same key
    const key = await keyVault.getKey(metadata.keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${metadata.keyId}`);
    }

    return encryptContent(translatedContent, key, metadata.keyId);
  }

  /**
   * Get or create server encryption key for a conversation
   */
  async getOrCreateConversationKey(): Promise<string> {
    const { keyId } = await keyVault.getCurrentKey();
    return keyId;
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(currentKeyId: string): Promise<ServerEncryptionKey> {
    return keyVault.rotateKey(currentKeyId);
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

    return {
      ciphertext: encryptedContent,
      metadata: encryptionMetadata as EncryptionMetadata,
    };
  }

  /**
   * Prepare encrypted content for database storage
   */
  prepareForStorage(payload: EncryptedPayload): {
    encryptedContent: string;
    encryptionMetadata: EncryptionMetadata;
  } {
    return {
      encryptedContent: payload.ciphertext,
      encryptionMetadata: payload.metadata,
    };
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();
