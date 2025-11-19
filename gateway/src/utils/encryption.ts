/**
 * Server-Side Encryption Utilities
 *
 * Provides AES-256-GCM encryption/decryption for server-encrypted mode.
 * For E2EE mode, the server only stores encrypted blobs without decryption capability.
 */

import crypto from 'crypto';
import { EncryptionMetadata, EncryptedPayload } from '../../shared/types/encryption';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Generate a random encryption key
 */
export function generateEncryptionKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Generate a random IV (Initialization Vector)
 */
export function generateIV(): Buffer {
  return crypto.randomBytes(IV_LENGTH);
}

/**
 * Generate a unique key ID
 */
export function generateKeyId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Encrypt content using AES-256-GCM
 *
 * @param plaintext - The content to encrypt
 * @param key - The encryption key (32 bytes)
 * @param keyId - The key identifier for metadata
 * @returns Encrypted payload with metadata
 */
export function encryptContent(
  plaintext: string,
  key: Buffer,
  keyId: string
): EncryptedPayload {
  // Generate random IV
  const iv = generateIV();

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Build metadata
  const metadata: EncryptionMetadata = {
    mode: 'server',
    protocol: 'aes-256-gcm',
    keyId,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };

  return {
    ciphertext,
    metadata,
  };
}

/**
 * Decrypt content using AES-256-GCM
 *
 * @param encryptedPayload - The encrypted payload with metadata
 * @param key - The decryption key (32 bytes)
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong key, tampered data)
 */
export function decryptContent(
  encryptedPayload: EncryptedPayload,
  key: Buffer
): string {
  const { ciphertext, metadata } = encryptedPayload;

  // Verify protocol
  if (metadata.protocol !== 'aes-256-gcm') {
    throw new Error(`Unsupported encryption protocol: ${metadata.protocol}`);
  }

  // Parse IV and auth tag
  const iv = Buffer.from(metadata.iv, 'base64');
  const authTag = Buffer.from(metadata.authTag, 'base64');

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Encrypt content for E2EE mode (client-side encrypted)
 * Server only stores the encrypted blob without decryption capability.
 *
 * @param encryptedContent - Base64 encoded encrypted content from client
 * @param metadata - Encryption metadata from client
 * @returns Encrypted payload for storage
 */
export function storeE2EEContent(
  encryptedContent: string,
  metadata: EncryptionMetadata
): EncryptedPayload {
  // Verify it's E2EE mode
  if (metadata.mode !== 'e2ee') {
    throw new Error('This function is only for E2EE mode');
  }

  // Verify protocol
  if (metadata.protocol !== 'signal_v3') {
    throw new Error(`Unsupported E2EE protocol: ${metadata.protocol}`);
  }

  // Server just stores the encrypted blob as-is
  return {
    ciphertext: encryptedContent,
    metadata,
  };
}

/**
 * Derive a key from a master key and salt
 * Used for key derivation from vault keys
 */
export function deriveKey(masterKey: Buffer, salt: string): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a key for storage in vault (key encryption key)
 *
 * @param keyToEncrypt - The key to encrypt
 * @param kek - Key Encryption Key
 * @returns Encrypted key with IV and auth tag
 */
export function encryptKey(
  keyToEncrypt: Buffer,
  kek: Buffer
): { encryptedKey: string; iv: string; authTag: string } {
  const iv = generateIV();
  const cipher = crypto.createCipheriv(ALGORITHM, kek, iv);

  let encryptedKey = cipher.update(keyToEncrypt).toString('base64');
  encryptedKey += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return {
    encryptedKey,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypt a key from vault storage
 *
 * @param encryptedKeyData - Encrypted key data from vault
 * @param kek - Key Encryption Key
 * @returns Decrypted key
 */
export function decryptKey(
  encryptedKeyData: { encryptedKey: string; iv: string; authTag: string },
  kek: Buffer
): Buffer {
  const iv = Buffer.from(encryptedKeyData.iv, 'base64');
  const authTag = Buffer.from(encryptedKeyData.authTag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv);
  decipher.setAuthTag(authTag);

  const decryptedKey = Buffer.concat([
    decipher.update(Buffer.from(encryptedKeyData.encryptedKey, 'base64')),
    decipher.final(),
  ]);

  return decryptedKey;
}

/**
 * Validate encryption metadata structure
 */
export function validateEncryptionMetadata(metadata: any): metadata is EncryptionMetadata {
  if (!metadata || typeof metadata !== 'object') return false;

  if (!['e2ee', 'server'].includes(metadata.mode)) return false;
  if (!['signal_v3', 'aes-256-gcm'].includes(metadata.protocol)) return false;
  if (typeof metadata.keyId !== 'string') return false;
  if (typeof metadata.iv !== 'string') return false;
  if (typeof metadata.authTag !== 'string') return false;

  // Optional fields
  if (metadata.messageNumber !== undefined && typeof metadata.messageNumber !== 'number') {
    return false;
  }
  if (metadata.preKeyId !== undefined && typeof metadata.preKeyId !== 'number') {
    return false;
  }

  return true;
}

/**
 * Safe comparison of two buffers (timing attack resistant)
 */
export function constantTimeCompare(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
