/**
 * Gateway Encryption Service
 *
 * Backend encryption service for server-side encryption (AES-256-GCM)
 * and Signal Protocol pre-key bundle management.
 */

import { PrismaClient } from '@meeshy/shared/prisma/client';
import * as crypto from 'crypto';

/**
 * Encryption mode types
 */
type EncryptionMode = 'e2ee' | 'server';

/**
 * Encrypted payload structure
 */
interface EncryptedPayload {
  ciphertext: string;
  metadata: {
    mode: EncryptionMode;
    protocol: string;
    keyId: string;
    iv: string;
    authTag: string;
    messageType?: number;
    registrationId?: number;
  };
}

/**
 * Pre-Key Bundle interface (compatible with Signal Protocol)
 */
interface PreKeyBundle {
  identityKey: Uint8Array;
  registrationId: number;
  deviceId: number;
  preKeyId: number | null;
  preKeyPublic: Uint8Array | null;
  signedPreKeyId: number;
  signedPreKeyPublic: Uint8Array;
  signedPreKeySignature: Uint8Array;
  kyberPreKeyId: number | null;
  kyberPreKeyPublic: Uint8Array | null;
  kyberPreKeySignature: Uint8Array | null;
}

/**
 * In-memory key vault for server-side encryption keys
 * In production, this should be replaced with a secure key management service (KMS)
 */
class ServerKeyVault {
  private keys: Map<string, Buffer> = new Map();
  private conversationKeys: Map<string, string> = new Map();

  generateKey(): { keyId: string; key: Buffer } {
    const keyId = crypto.randomUUID();
    const key = crypto.randomBytes(32); // AES-256
    this.keys.set(keyId, key);
    return { keyId, key };
  }

  getKey(keyId: string): Buffer | undefined {
    return this.keys.get(keyId);
  }

  setConversationKey(conversationId: string, keyId: string): void {
    this.conversationKeys.set(conversationId, keyId);
  }

  getConversationKeyId(conversationId: string): string | undefined {
    return this.conversationKeys.get(conversationId);
  }
}

/**
 * Gateway Encryption Service
 *
 * Provides encryption functionality for the backend:
 * - Server-side encryption (AES-256-GCM) for messages
 * - Key management for conversations
 * - Signal Protocol pre-key bundle generation
 */
export class EncryptionService {
  private prisma: PrismaClient;
  private keyVault: ServerKeyVault;
  private signalService: any = null; // Will be initialized when @signalapp/libsignal-client is available

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.keyVault = new ServerKeyVault();
  }

  /**
   * Get or create encryption key for a conversation (server mode)
   */
  async getOrCreateConversationKey(): Promise<string> {
    const { keyId } = this.keyVault.generateKey();
    return keyId;
  }

  /**
   * Encrypt message content (server mode)
   */
  async encryptMessage(
    plaintext: string,
    mode: EncryptionMode,
    conversationId?: string
  ): Promise<EncryptedPayload> {
    if (mode === 'e2ee') {
      throw new Error('E2EE messages must be encrypted client-side');
    }

    // Get or create key for conversation
    let keyId: string;
    if (conversationId) {
      const existingKeyId = this.keyVault.getConversationKeyId(conversationId);
      if (existingKeyId) {
        keyId = existingKeyId;
      } else {
        const { keyId: newKeyId } = this.keyVault.generateKey();
        this.keyVault.setConversationKey(conversationId, newKeyId);
        keyId = newKeyId;
      }
    } else {
      const { keyId: newKeyId } = this.keyVault.generateKey();
      keyId = newKeyId;
    }

    const key = this.keyVault.getKey(keyId);
    if (!key) {
      throw new Error('Encryption key not found');
    }

    // Generate IV
    const iv = crypto.randomBytes(12);

    // Encrypt using AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString('base64'),
      metadata: {
        mode: 'server',
        protocol: 'aes-256-gcm',
        keyId,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
      },
    };
  }

  /**
   * Decrypt message content (server mode only)
   */
  async decryptMessage(payload: EncryptedPayload): Promise<string> {
    const { metadata } = payload;

    if (metadata.mode === 'e2ee') {
      throw new Error('Cannot decrypt E2EE messages on server');
    }

    const key = this.keyVault.getKey(metadata.keyId);
    if (!key) {
      throw new Error(`Decryption key not found: ${metadata.keyId}`);
    }

    const iv = Buffer.from(metadata.iv, 'base64');
    const authTag = Buffer.from(metadata.authTag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    // Decrypt using AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }

  /**
   * Decrypt, translate, and re-encrypt message (server mode)
   * Used for auto-translation in server-encrypted conversations
   */
  async translateAndReEncrypt(
    payload: EncryptedPayload,
    translatedContent: string
  ): Promise<EncryptedPayload> {
    const { metadata } = payload;

    if (metadata.mode === 'e2ee') {
      throw new Error('Cannot translate E2EE messages');
    }

    // Re-encrypt the translated content with the same key
    const key = this.keyVault.getKey(metadata.keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${metadata.keyId}`);
    }

    // Generate new IV for the re-encrypted content
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(translatedContent, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString('base64'),
      metadata: {
        ...metadata,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
      },
    };
  }

  /**
   * Generate Signal Protocol pre-key bundle
   */
  async generatePreKeyBundle(): Promise<PreKeyBundle> {
    // Generate random keys (placeholder implementation)
    const identityKey = crypto.randomBytes(32);
    const registrationId = crypto.randomInt(1, 16380);
    const deviceId = 1;
    const preKeyId = crypto.randomInt(1, 16777215);
    const preKeyPublic = crypto.randomBytes(32);
    const signedPreKeyId = crypto.randomInt(1, 16777215);
    const signedPreKeyPublic = crypto.randomBytes(32);
    const signedPreKeySignature = crypto.randomBytes(64);

    return {
      identityKey: new Uint8Array(identityKey),
      registrationId,
      deviceId,
      preKeyId,
      preKeyPublic: new Uint8Array(preKeyPublic),
      signedPreKeyId,
      signedPreKeyPublic: new Uint8Array(signedPreKeyPublic),
      signedPreKeySignature: new Uint8Array(signedPreKeySignature),
      kyberPreKeyId: null,
      kyberPreKeyPublic: null,
      kyberPreKeySignature: null,
    };
  }

  /**
   * Get Signal Protocol service (for routes)
   */
  getSignalService(): any {
    return this.signalService;
  }

  /**
   * Check if Signal Protocol is available
   */
  isSignalProtocolAvailable(): boolean {
    return this.signalService !== null;
  }

  /**
   * Prepare encrypted payload for database storage
   */
  prepareForStorage(payload: EncryptedPayload): {
    encryptedContent: string;
    encryptionMetadata: Record<string, any>;
    encryptionMode: string;
    isEncrypted: boolean;
  } {
    return {
      encryptedContent: payload.ciphertext,
      encryptionMetadata: payload.metadata,
      encryptionMode: payload.metadata.mode,
      isEncrypted: true,
    };
  }

  /**
   * Reconstruct encrypted payload from storage
   */
  reconstructPayload(
    encryptedContent: string,
    encryptionMetadata: Record<string, any>
  ): EncryptedPayload {
    return {
      ciphertext: encryptedContent,
      metadata: encryptionMetadata as EncryptedPayload['metadata'],
    };
  }
}

// Singleton instance (initialized with Prisma client)
let encryptionServiceInstance: EncryptionService | null = null;

/**
 * Get or create the encryption service singleton
 */
export function getEncryptionService(prisma: PrismaClient): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService(prisma);
  }
  return encryptionServiceInstance;
}

/**
 * Export singleton for routes (requires initialization)
 */
export const encryptionService = {
  getOrCreateConversationKey: async () => {
    if (!encryptionServiceInstance) {
      throw new Error('Encryption service not initialized. Call getEncryptionService(prisma) first.');
    }
    return encryptionServiceInstance.getOrCreateConversationKey();
  },
  generatePreKeyBundle: async () => {
    if (!encryptionServiceInstance) {
      throw new Error('Encryption service not initialized. Call getEncryptionService(prisma) first.');
    }
    return encryptionServiceInstance.generatePreKeyBundle();
  },
  getSignalService: () => {
    if (!encryptionServiceInstance) {
      return null;
    }
    return encryptionServiceInstance.getSignalService();
  },
};
