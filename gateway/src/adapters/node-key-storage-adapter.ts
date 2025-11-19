/**
 * Node.js Key Storage Adapter
 *
 * Implementation of KeyStorageAdapter interface using in-memory storage.
 * For production, this should be replaced with a secure key management service (KMS).
 */

import type {
  KeyStorageAdapter,
} from '../../shared/encryption/encryption-service';
import type { EncryptionMode } from '../../shared/types/encryption';

interface StoredKey {
  keyId: string;
  keyData: string;
  createdAt: number;
  conversationId?: string;
  userId?: string;
}

interface ConversationKeyMapping {
  conversationId: string;
  keyId: string;
  mode: EncryptionMode;
  createdAt: number;
}

interface UserSignalKeys {
  userId: string;
  publicKey: string;
  privateKey: string;
  registrationId: number;
  identityKey: string;
  preKeyBundleVersion: number;
  createdAt: number;
}

/**
 * In-Memory Key Storage (Backend)
 *
 * WARNING: This is a simplified implementation for development.
 * In production, use a proper Key Management Service (KMS) like:
 * - AWS KMS
 * - Google Cloud KMS
 * - Azure Key Vault
 * - HashiCorp Vault
 */
export class NodeKeyStorageAdapter implements KeyStorageAdapter {
  private keys: Map<string, StoredKey> = new Map();
  private conversationKeys: Map<string, ConversationKeyMapping> = new Map();
  private userKeys: Map<string, UserSignalKeys> = new Map();

  /**
   * Store an encryption key
   */
  async storeKey(
    keyId: string,
    keyData: string,
    conversationId?: string,
    userId?: string
  ): Promise<void> {
    this.keys.set(keyId, {
      keyId,
      keyData,
      createdAt: Date.now(),
      conversationId,
      userId,
    });
  }

  /**
   * Retrieve an encryption key
   */
  async getKey(keyId: string): Promise<string | null> {
    const storedKey = this.keys.get(keyId);
    return storedKey?.keyData || null;
  }

  /**
   * Store conversation key mapping
   */
  async storeConversationKey(
    conversationId: string,
    keyId: string,
    mode: EncryptionMode
  ): Promise<void> {
    this.conversationKeys.set(conversationId, {
      conversationId,
      keyId,
      mode,
      createdAt: Date.now(),
    });
  }

  /**
   * Get conversation key mapping
   */
  async getConversationKey(conversationId: string): Promise<{
    keyId: string;
    mode: EncryptionMode;
    createdAt: number;
  } | null> {
    return this.conversationKeys.get(conversationId) || null;
  }

  /**
   * Store user Signal Protocol keys
   */
  async storeUserKeys(keys: {
    userId: string;
    publicKey: string;
    privateKey: string;
    registrationId: number;
    identityKey: string;
    preKeyBundleVersion: number;
    createdAt: number;
  }): Promise<void> {
    this.userKeys.set(keys.userId, keys);
  }

  /**
   * Get user Signal Protocol keys
   */
  async getUserKeys(userId: string): Promise<{
    userId: string;
    publicKey: string;
    privateKey: string;
    registrationId: number;
    identityKey: string;
    preKeyBundleVersion: number;
    createdAt: number;
  } | null> {
    return this.userKeys.get(userId) || null;
  }

  /**
   * Clear all keys
   */
  async clearAll(): Promise<void> {
    this.keys.clear();
    this.conversationKeys.clear();
    this.userKeys.clear();
  }

  /**
   * Export keys for backup (encrypted with password)
   */
  async exportKeys(password: string): Promise<string> {
    const backup = {
      keys: Array.from(this.keys.values()),
      conversationKeys: Array.from(this.conversationKeys.values()),
      userKeys: Array.from(this.userKeys.values()),
      exportedAt: Date.now(),
    };

    // TODO: Encrypt backup with password
    return Buffer.from(JSON.stringify(backup)).toString('base64');
  }

  /**
   * Import keys from backup
   */
  async importKeys(encryptedBackup: string, password: string): Promise<void> {
    // TODO: Decrypt backup with password
    const backup = JSON.parse(
      Buffer.from(encryptedBackup, 'base64').toString('utf-8')
    );

    // Import keys
    for (const key of backup.keys) {
      this.keys.set(key.keyId, key);
    }

    for (const conv of backup.conversationKeys) {
      this.conversationKeys.set(conv.conversationId, conv);
    }

    for (const userKey of backup.userKeys) {
      this.userKeys.set(userKey.userId, userKey);
    }
  }

  /**
   * Get all conversation keys (for debugging/testing)
   */
  getAllConversationKeys(): ConversationKeyMapping[] {
    return Array.from(this.conversationKeys.values());
  }

  /**
   * Delete a specific key
   */
  async deleteKey(keyId: string): Promise<void> {
    this.keys.delete(keyId);
  }

  /**
   * Delete conversation key mapping
   */
  async deleteConversationKey(conversationId: string): Promise<void> {
    const mapping = this.conversationKeys.get(conversationId);
    if (mapping) {
      await this.deleteKey(mapping.keyId);
      this.conversationKeys.delete(conversationId);
    }
  }
}

// Export singleton instance
export const nodeKeyStorageAdapter = new NodeKeyStorageAdapter();
