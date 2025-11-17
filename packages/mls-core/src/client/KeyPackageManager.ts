/**
 * KeyPackage Manager
 *
 * Manages generation, storage, and lifecycle of MLS KeyPackages
 * KeyPackages are pre-keys used to establish encrypted conversations
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  KeyPackageInfo,
  MLSCipherSuite,
} from '@meeshy/shared/types/mls';
import { calculateKeyPackageExpiration } from '@meeshy/shared/types/mls';
import * as crypto from '../utils/crypto.js';

/**
 * In-memory storage for KeyPackages
 * In production, this would be persisted to database
 */
interface StoredKeyPackage {
  readonly keyPackageId: string;
  readonly publicKey: Uint8Array;
  readonly secretKey: Uint8Array;
  readonly cipherSuite: MLSCipherSuite;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export class KeyPackageManager {
  private keyPackages: Map<string, StoredKeyPackage> = new Map();

  constructor(private readonly userId: string) {}

  /**
   * Generate a new KeyPackage
   *
   * @param cipherSuite - Cipher suite to use (default: MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519)
   * @returns KeyPackageInfo with public key and metadata
   */
  generateKeyPackage(
    cipherSuite: MLSCipherSuite = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'
  ): KeyPackageInfo {
    // Generate key pair
    const keyPair = crypto.generateKeyPair();

    // Generate unique ID
    const keyPackageId = uuidv4();

    // Calculate expiration (30 days)
    const expiresAt = calculateKeyPackageExpiration();
    const createdAt = new Date();

    // Store the KeyPackage
    const stored: StoredKeyPackage = {
      keyPackageId,
      publicKey: keyPair.publicKey,
      secretKey: keyPair.secretKey,
      cipherSuite,
      expiresAt,
      createdAt,
    };

    this.keyPackages.set(keyPackageId, stored);

    // Return public info only
    return {
      keyPackageId,
      publicKey: crypto.encodeBase64(keyPair.publicKey),
      cipherSuite,
      expiresAt,
      createdAt,
    };
  }

  /**
   * Generate multiple KeyPackages at once
   *
   * @param count - Number of KeyPackages to generate
   * @param cipherSuite - Cipher suite to use
   * @returns Array of KeyPackageInfo
   */
  generateKeyPackages(
    count: number,
    cipherSuite: MLSCipherSuite = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'
  ): readonly KeyPackageInfo[] {
    const keyPackages: KeyPackageInfo[] = [];

    for (let i = 0; i < count; i++) {
      keyPackages.push(this.generateKeyPackage(cipherSuite));
    }

    return keyPackages;
  }

  /**
   * Get a KeyPackage by ID
   *
   * @param keyPackageId - ID of the KeyPackage
   * @returns Stored KeyPackage or undefined
   */
  getKeyPackage(keyPackageId: string): StoredKeyPackage | undefined {
    return this.keyPackages.get(keyPackageId);
  }

  /**
   * Get the secret key for a KeyPackage
   *
   * @param keyPackageId - ID of the KeyPackage
   * @returns Secret key or undefined
   */
  getSecretKey(keyPackageId: string): Uint8Array | undefined {
    const keyPackage = this.keyPackages.get(keyPackageId);
    return keyPackage?.secretKey;
  }

  /**
   * Get the public key for a KeyPackage
   *
   * @param keyPackageId - ID of the KeyPackage
   * @returns Public key (Base64) or undefined
   */
  getPublicKey(keyPackageId: string): string | undefined {
    const keyPackage = this.keyPackages.get(keyPackageId);
    return keyPackage ? crypto.encodeBase64(keyPackage.publicKey) : undefined;
  }

  /**
   * Check if a KeyPackage is expired
   *
   * @param keyPackageId - ID of the KeyPackage
   * @returns true if expired, false otherwise
   */
  isExpired(keyPackageId: string): boolean {
    const keyPackage = this.keyPackages.get(keyPackageId);
    if (!keyPackage) {
      return true;
    }

    return new Date() > keyPackage.expiresAt;
  }

  /**
   * Delete a KeyPackage (after it's been used or expired)
   *
   * @param keyPackageId - ID of the KeyPackage to delete
   */
  deleteKeyPackage(keyPackageId: string): void {
    const keyPackage = this.keyPackages.get(keyPackageId);
    if (keyPackage) {
      // Securely wipe the secret key before deletion
      crypto.secureWipe(keyPackage.secretKey);
      this.keyPackages.delete(keyPackageId);
    }
  }

  /**
   * Clean up expired KeyPackages
   *
   * @returns Number of KeyPackages deleted
   */
  cleanupExpired(): number {
    let deleted = 0;
    const now = new Date();

    for (const [keyPackageId, keyPackage] of this.keyPackages.entries()) {
      if (now > keyPackage.expiresAt) {
        this.deleteKeyPackage(keyPackageId);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Get all available (non-expired) KeyPackages
   *
   * @returns Array of KeyPackageInfo
   */
  getAvailableKeyPackages(): readonly KeyPackageInfo[] {
    const available: KeyPackageInfo[] = [];
    const now = new Date();

    for (const keyPackage of this.keyPackages.values()) {
      if (now <= keyPackage.expiresAt) {
        available.push({
          keyPackageId: keyPackage.keyPackageId,
          publicKey: crypto.encodeBase64(keyPackage.publicKey),
          cipherSuite: keyPackage.cipherSuite,
          expiresAt: keyPackage.expiresAt,
          createdAt: keyPackage.createdAt,
        });
      }
    }

    return available;
  }

  /**
   * Export KeyPackages for persistence (encrypted with password)
   *
   * @param password - Password to encrypt the export
   * @returns Encrypted export data
   */
  exportEncrypted(password: string): string {
    const data = {
      userId: this.userId,
      keyPackages: Array.from(this.keyPackages.entries()).map(
        ([id, kp]) => ({
          keyPackageId: id,
          publicKey: crypto.encodeBase64(kp.publicKey),
          secretKey: crypto.encodeBase64(kp.secretKey),
          cipherSuite: kp.cipherSuite,
          expiresAt: kp.expiresAt.toISOString(),
          createdAt: kp.createdAt.toISOString(),
        })
      ),
    };

    const jsonData = JSON.stringify(data);
    const dataBytes = crypto.stringToBytes(jsonData);

    const encrypted = crypto.encryptWithPassword(dataBytes, password);

    return JSON.stringify(encrypted);
  }

  /**
   * Import KeyPackages from encrypted export
   *
   * @param encryptedData - Encrypted export data
   * @param password - Password to decrypt the export
   * @returns Number of KeyPackages imported
   */
  importEncrypted(encryptedData: string, password: string): number {
    const encrypted = JSON.parse(encryptedData) as {
      ciphertext: string;
      nonce: string;
      salt: string;
    };

    const decrypted = crypto.decryptWithPassword(
      encrypted.ciphertext,
      encrypted.nonce,
      encrypted.salt,
      password
    );

    if (!decrypted) {
      throw new Error('Failed to decrypt KeyPackages');
    }

    const jsonData = crypto.bytesToString(decrypted);
    const data = JSON.parse(jsonData) as {
      userId: string;
      keyPackages: Array<{
        keyPackageId: string;
        publicKey: string;
        secretKey: string;
        cipherSuite: MLSCipherSuite;
        expiresAt: string;
        createdAt: string;
      }>;
    };

    if (data.userId !== this.userId) {
      throw new Error('KeyPackages belong to a different user');
    }

    let imported = 0;

    for (const kp of data.keyPackages) {
      const stored: StoredKeyPackage = {
        keyPackageId: kp.keyPackageId,
        publicKey: crypto.decodeBase64(kp.publicKey),
        secretKey: crypto.decodeBase64(kp.secretKey),
        cipherSuite: kp.cipherSuite,
        expiresAt: new Date(kp.expiresAt),
        createdAt: new Date(kp.createdAt),
      };

      this.keyPackages.set(kp.keyPackageId, stored);
      imported++;
    }

    return imported;
  }

  /**
   * Get statistics about KeyPackages
   *
   * @returns Statistics object
   */
  getStats(): {
    total: number;
    available: number;
    expired: number;
  } {
    let total = 0;
    let available = 0;
    let expired = 0;
    const now = new Date();

    for (const keyPackage of this.keyPackages.values()) {
      total++;
      if (now <= keyPackage.expiresAt) {
        available++;
      } else {
        expired++;
      }
    }

    return { total, available, expired };
  }

  /**
   * Clear all KeyPackages (securely)
   */
  clear(): void {
    for (const keyPackage of this.keyPackages.values()) {
      crypto.secureWipe(keyPackage.secretKey);
    }
    this.keyPackages.clear();
  }
}
