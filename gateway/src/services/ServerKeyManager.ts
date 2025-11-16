/**
 * Server Key Manager - Gestion des clés serveur pour chiffrement hybride
 *
 * Responsabilités:
 * - Charger la master key (depuis env var ou AWS KMS en production)
 * - Générer et gérer les clés de chiffrement par conversation
 * - Chiffrer/déchiffrer avec AES-256-GCM
 * - Cache en mémoire avec expiration
 * - Rotation automatique des clés
 *
 * Sécurité:
 * - Master key JAMAIS loggée ou persistée en clair
 * - Clés conversation chiffrées avec master key
 * - Cache en mémoire avec TTL de 24h
 * - Plaintext wiped immédiatement après usage
 *
 * @see docs/dma-interoperability/HYBRID_ENCRYPTION_ARCHITECTURE.md
 */

import * as crypto from 'crypto';
import { PrismaClient } from '@meeshy/shared/client';
import type {
  EncryptionMode,
} from '@meeshy/shared/types/mls';

// Constants defined locally to avoid import issues
const SERVER_KEY_ROTATION_DAYS = 30;
const SERVER_KEY_CACHE_HOURS = 24;

/**
 * Configuration for ServerKeyManager
 */
export interface ServerKeyManagerConfig {
  /** Master key as hex string (from env var or KMS) */
  masterKeyHex?: string;
  /** Cache TTL in hours (default: 24h) */
  cacheTTLHours?: number;
}

/**
 * Cached key entry
 */
interface CachedKey {
  key: Buffer;
  expiresAt: Date;
}

/**
 * Server Key Manager
 *
 * Manages server-side encryption keys for hybrid encryption mode.
 */
export class ServerKeyManager {
  private masterKey: Buffer;
  private keyCache: Map<string, CachedKey>;
  private cacheTTLMs: number;

  constructor(
    private readonly prisma: PrismaClient,
    config?: ServerKeyManagerConfig
  ) {
    // Load master key
    this.masterKey = this.loadMasterKey(config?.masterKeyHex);

    // Initialize cache
    this.keyCache = new Map();
    this.cacheTTLMs = (config?.cacheTTLHours || SERVER_KEY_CACHE_HOURS) * 60 * 60 * 1000;

    // Start cache cleanup interval (every hour)
    this.startCacheCleanup();
  }

  /**
   * Get or create server encryption key for a conversation
   *
   * @param conversationId - ID of the conversation
   * @param encryptedKey - Existing encrypted key from database (if any)
   * @returns Decrypted server key ready for use
   */
  async getConversationKey(
    conversationId: string,
    encryptedKey?: string | null
  ): Promise<Buffer> {
    // Check cache first
    const cached = this.keyCache.get(conversationId);
    if (cached && cached.expiresAt > new Date()) {
      return cached.key;
    }

    if (encryptedKey) {
      // Decrypt existing key with master key
      const key = await this.decryptWithMasterKey(encryptedKey);
      this.cacheKey(conversationId, key);
      return key;
    }

    // Generate new key for conversation
    const newKey = crypto.randomBytes(32); // AES-256 requires 32 bytes
    const encryptedNewKey = await this.encryptWithMasterKey(newKey);

    // Calculate expiration date (30 days from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SERVER_KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000);

    // Store in database
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        serverEncryptionKey: encryptedNewKey,
        serverKeyCreatedAt: now,
        serverKeyExpiresAt: expiresAt,
      },
    });

    this.cacheKey(conversationId, newKey);
    return newKey;
  }

  /**
   * Encrypt data with server key (AES-256-GCM)
   *
   * @param plaintext - Data to encrypt
   * @param nonce - 12-byte nonce (IV)
   * @param key - Server key
   * @returns Encrypted data with auth tag appended
   */
  async encrypt(plaintext: Buffer, nonce: Buffer, key: Buffer): Promise<Buffer> {
    if (nonce.length !== 12) {
      throw new Error('Nonce must be exactly 12 bytes for AES-256-GCM');
    }

    if (key.length !== 32) {
      throw new Error('Key must be exactly 32 bytes for AES-256');
    }

    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Return encrypted data + auth tag (16 bytes)
    return Buffer.concat([encrypted, authTag]);
  }

  /**
   * Decrypt data with server key (AES-256-GCM)
   *
   * @param ciphertext - Encrypted data with auth tag appended
   * @param nonce - 12-byte nonce (IV)
   * @param key - Server key
   * @returns Decrypted plaintext
   */
  async decrypt(ciphertext: Buffer, nonce: Buffer, key: Buffer): Promise<Buffer> {
    if (nonce.length !== 12) {
      throw new Error('Nonce must be exactly 12 bytes for AES-256-GCM');
    }

    if (key.length !== 32) {
      throw new Error('Key must be exactly 32 bytes for AES-256');
    }

    const authTagLength = 16; // GCM auth tag is always 16 bytes
    if (ciphertext.length < authTagLength) {
      throw new Error('Ciphertext too short to contain auth tag');
    }

    const encrypted = ciphertext.slice(0, -authTagLength);
    const authTag = ciphertext.slice(-authTagLength);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);

    try {
      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (error) {
      throw new Error('Decryption failed: Invalid ciphertext or auth tag');
    }
  }

  /**
   * Securely wipe a buffer from memory
   *
   * Uses multi-pass overwrite to prevent memory dumps from revealing sensitive data:
   * 1. Random data overwrite (crypto-secure)
   * 2. Zero-fill
   * 3. 0xFF fill
   *
   * @param buffer - Buffer to wipe
   */
  secureWipe(buffer: Buffer): void {
    try {
      // Pass 1: Overwrite with cryptographically secure random data
      crypto.randomFillSync(buffer);

      // Pass 2: Zero-fill
      buffer.fill(0x00);

      // Pass 3: Fill with 0xFF
      buffer.fill(0xFF);

      // Pass 4: Final zero-fill
      buffer.fill(0x00);
    } catch (error) {
      // If secure wipe fails, at least zero it out
      console.error('[ServerKeyManager] Secure wipe failed, falling back to zero-fill:', error);
      buffer.fill(0);
    }
  }

  /**
   * Rotate server key for a conversation
   *
   * Generates a new server key and updates the database.
   * Old key is securely wiped from cache.
   *
   * @param conversationId - ID of the conversation
   * @returns New encrypted key
   */
  async rotateConversationKey(conversationId: string): Promise<string> {
    // Generate new key
    const newKey = crypto.randomBytes(32);
    const encryptedNewKey = await this.encryptWithMasterKey(newKey);

    // Calculate new expiration
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SERVER_KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000);

    // Update database
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        serverEncryptionKey: encryptedNewKey,
        serverKeyCreatedAt: now,
        serverKeyExpiresAt: expiresAt,
      },
    });

    // Wipe old key from cache
    const oldCached = this.keyCache.get(conversationId);
    if (oldCached) {
      this.secureWipe(oldCached.key);
      this.keyCache.delete(conversationId);
    }

    // Cache new key
    this.cacheKey(conversationId, newKey);

    return encryptedNewKey;
  }

  /**
   * Check if a conversation's server key needs rotation
   *
   * @param conversationId - ID of the conversation
   * @returns true if key needs rotation (expired or missing)
   */
  async needsRotation(conversationId: string): Promise<boolean> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        serverKeyExpiresAt: true,
        serverEncryptionKey: true,
      },
    });

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // No key exists
    if (!conversation.serverEncryptionKey) {
      return true;
    }

    // No expiration date (legacy key)
    if (!conversation.serverKeyExpiresAt) {
      return true;
    }

    // Key expired
    return conversation.serverKeyExpiresAt < new Date();
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Load master key from environment variable or KMS
   *
   * In production, this should load from AWS KMS, HashiCorp Vault, or similar.
   * In development, loads from MLS_MASTER_KEY environment variable.
   *
   * @param masterKeyHex - Optional master key as hex string (overrides env var)
   * @returns Master key as Buffer
   */
  private loadMasterKey(masterKeyHex?: string): Buffer {
    const keyHex = masterKeyHex || process.env.MLS_MASTER_KEY;

    if (!keyHex) {
      throw new Error(
        'MLS_MASTER_KEY environment variable not set. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    // Validate hex format
    if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
      throw new Error(
        'MLS_MASTER_KEY must be a 64-character hexadecimal string (32 bytes). ' +
        'Current length: ' + keyHex.length
      );
    }

    const key = Buffer.from(keyHex, 'hex');

    if (key.length !== 32) {
      throw new Error(`Master key must be exactly 32 bytes for AES-256, got ${key.length} bytes`);
    }

    console.log('[ServerKeyManager] ✅ Master key loaded successfully');
    return key;
  }

  /**
   * Encrypt data with master key
   *
   * Format: [12-byte nonce][encrypted data][16-byte auth tag]
   * All concatenated and encoded as base64.
   *
   * @param data - Data to encrypt
   * @returns Base64-encoded encrypted data with nonce and auth tag
   */
  private async encryptWithMasterKey(data: Buffer): Promise<string> {
    const nonce = crypto.randomBytes(12); // GCM standard nonce size
    const encrypted = await this.encrypt(data, nonce, this.masterKey);

    // Concatenate: nonce + encrypted + authTag
    return Buffer.concat([nonce, encrypted]).toString('base64');
  }

  /**
   * Decrypt data with master key
   *
   * @param encryptedData - Base64-encoded data with nonce and auth tag
   * @returns Decrypted plaintext
   */
  private async decryptWithMasterKey(encryptedData: string): Promise<Buffer> {
    const buffer = Buffer.from(encryptedData, 'base64');

    if (buffer.length < 12 + 16) {
      throw new Error('Encrypted data too short (must contain nonce + ciphertext + auth tag)');
    }

    const nonce = buffer.slice(0, 12);
    const ciphertext = buffer.slice(12);

    return this.decrypt(ciphertext, nonce, this.masterKey);
  }

  /**
   * Cache a conversation key in memory
   *
   * @param conversationId - ID of the conversation
   * @param key - Server key
   */
  private cacheKey(conversationId: string, key: Buffer): void {
    this.keyCache.set(conversationId, {
      key,
      expiresAt: new Date(Date.now() + this.cacheTTLMs),
    });
  }

  /**
   * Start cache cleanup interval
   *
   * Runs every hour to remove expired keys from cache.
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = new Date();

      // First pass: collect expired conversation IDs
      const toDelete: string[] = [];
      const entries = Array.from(this.keyCache.entries());
      for (const [conversationId, cached] of entries) {
        if (cached.expiresAt < now) {
          toDelete.push(conversationId);
        }
      }

      // Second pass: securely wipe and delete
      for (const conversationId of toDelete) {
        const cached = this.keyCache.get(conversationId);
        if (cached) {
          // Securely wipe key before removing from cache
          this.secureWipe(cached.key);
          this.keyCache.delete(conversationId);
        }
      }

      if (toDelete.length > 0) {
        console.log(`[ServerKeyManager] 🧹 Cleaned ${toDelete.length} expired key(s) from cache`);
      }
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics
   */
  getStats(): {
    cachedKeys: number;
    cacheHitRate: number;
  } {
    // TODO: Track cache hits/misses for hit rate calculation
    return {
      cachedKeys: this.keyCache.size,
      cacheHitRate: 0, // Placeholder
    };
  }
}
