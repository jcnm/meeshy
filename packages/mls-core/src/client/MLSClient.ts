/**
 * MLS Client - Main interface for end-to-end encryption
 *
 * Provides high-level API for:
 * - Establishing encrypted conversations
 * - Encrypting/decrypting messages
 * - Managing conversation state
 *
 * Phase 1: Simple 1:1 conversations with TweetNaCl
 * Phase 2+: Full MLS protocol with OpenMLS
 */

import type {
  EncryptedData,
  EncryptionType,
  MLSCipherSuite,
} from '@meeshy/shared/types/mls';
import { KeyPackageManager } from './KeyPackageManager.js';
import * as crypto from '../utils/crypto.js';

/**
 * Conversation state for a 1:1 encrypted conversation
 */
interface ConversationState {
  readonly conversationId: string;
  readonly myKeyPackageId: string;
  readonly theirPublicKey: Uint8Array;
  readonly sharedSecret: Uint8Array;
  readonly established: boolean;
  readonly epoch: number;
}

/**
 * MLS Client
 *
 * Main entry point for MLS operations
 */
export class MLSClient {
  private conversationStates: Map<string, ConversationState> = new Map();
  private keyPackageManager: KeyPackageManager;

  constructor(
    private readonly userId: string,
    private readonly cipherSuite: MLSCipherSuite = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'
  ) {
    this.keyPackageManager = new KeyPackageManager(userId);
  }

  /**
   * Generate KeyPackages for this user
   *
   * @param count - Number of KeyPackages to generate
   * @returns Array of KeyPackageInfo
   */
  generateKeyPackages(count: number = 5) {
    return this.keyPackageManager.generateKeyPackages(count, this.cipherSuite);
  }

  /**
   * Get available KeyPackages
   *
   * @returns Array of available KeyPackageInfo
   */
  getAvailableKeyPackages() {
    return this.keyPackageManager.getAvailableKeyPackages();
  }

  /**
   * Establish a 1:1 encrypted conversation
   *
   * @param conversationId - ID of the conversation
   * @param myKeyPackageId - ID of my KeyPackage to use
   * @param theirPublicKey - Their public key (Base64)
   */
  async establishConversation(
    conversationId: string,
    myKeyPackageId: string,
    theirPublicKey: string
  ): Promise<void> {
    // Get my secret key
    const mySecretKey = this.keyPackageManager.getSecretKey(myKeyPackageId);
    if (!mySecretKey) {
      throw new Error(`KeyPackage ${myKeyPackageId} not found`);
    }

    // Decode their public key
    const theirPubKey = crypto.decodeBase64(theirPublicKey);

    // Compute shared secret using ECDH
    const sharedSecret = crypto.computeSharedSecret(theirPubKey, mySecretKey);

    // Store conversation state
    const state: ConversationState = {
      conversationId,
      myKeyPackageId,
      theirPublicKey: theirPubKey,
      sharedSecret,
      established: true,
      epoch: 0,
    };

    this.conversationStates.set(conversationId, state);
  }

  /**
   * Check if a conversation is established
   *
   * @param conversationId - ID of the conversation
   * @returns true if conversation is established
   */
  isConversationEstablished(conversationId: string): boolean {
    const state = this.conversationStates.get(conversationId);
    return state?.established ?? false;
  }

  /**
   * Encrypt a message for a conversation
   *
   * @param conversationId - ID of the conversation
   * @param plaintext - Message to encrypt
   * @returns Encrypted data
   */
  async encryptMessage(
    conversationId: string,
    plaintext: string
  ): Promise<EncryptedData> {
    const state = this.conversationStates.get(conversationId);
    if (!state || !state.established) {
      throw new Error(`Conversation ${conversationId} not established`);
    }

    // Convert plaintext to bytes
    const plaintextBytes = crypto.stringToBytes(plaintext);

    // Encrypt with shared secret
    const { ciphertext, nonce } = crypto.encryptWithSharedSecret(
      plaintextBytes,
      state.sharedSecret
    );

    // Compute hash of my public key (sender key hash)
    const myPublicKey = this.keyPackageManager.getPublicKey(state.myKeyPackageId);
    if (!myPublicKey) {
      throw new Error('Failed to get my public key');
    }

    const myPublicKeyBytes = crypto.decodeBase64(myPublicKey);
    const senderKeyHash = crypto.encodeBase64(crypto.hash(myPublicKeyBytes));

    return {
      ciphertext: crypto.encodeBase64(ciphertext),
      nonce: crypto.encodeBase64(nonce),
      senderKeyHash,
      encryptionType: 'mls_1to1' as EncryptionType,
      groupEpoch: state.epoch,
    };
  }

  /**
   * Decrypt a message from a conversation
   *
   * @param conversationId - ID of the conversation
   * @param ciphertext - Encrypted message (Base64)
   * @param nonce - Nonce used for encryption (Base64)
   * @returns Decrypted plaintext
   */
  async decryptMessage(
    conversationId: string,
    ciphertext: string,
    nonce: string
  ): Promise<string> {
    const state = this.conversationStates.get(conversationId);
    if (!state || !state.established) {
      throw new Error(`Conversation ${conversationId} not established`);
    }

    // Decode ciphertext and nonce
    const ciphertextBytes = crypto.decodeBase64(ciphertext);
    const nonceBytes = crypto.decodeBase64(nonce);

    // Decrypt with shared secret
    const plaintextBytes = crypto.decryptWithSharedSecret(
      ciphertextBytes,
      nonceBytes,
      state.sharedSecret
    );

    if (!plaintextBytes) {
      throw new Error('Decryption failed');
    }

    // Convert bytes to string
    return crypto.bytesToString(plaintextBytes);
  }

  /**
   * Get conversation state
   *
   * @param conversationId - ID of the conversation
   * @returns Conversation state or undefined
   */
  getConversationState(conversationId: string): {
    conversationId: string;
    established: boolean;
    epoch: number;
  } | undefined {
    const state = this.conversationStates.get(conversationId);
    if (!state) {
      return undefined;
    }

    return {
      conversationId: state.conversationId,
      established: state.established,
      epoch: state.epoch,
    };
  }

  /**
   * Close a conversation (cleanup state)
   *
   * @param conversationId - ID of the conversation
   */
  closeConversation(conversationId: string): void {
    const state = this.conversationStates.get(conversationId);
    if (state) {
      // Securely wipe shared secret
      crypto.secureWipe(state.sharedSecret);
      this.conversationStates.delete(conversationId);
    }
  }

  /**
   * Export conversation states (encrypted with password)
   *
   * @param password - Password to encrypt the export
   * @returns Encrypted export data
   */
  exportConversations(password: string): string {
    const data = {
      userId: this.userId,
      conversations: Array.from(this.conversationStates.entries()).map(
        ([id, state]) => ({
          conversationId: id,
          myKeyPackageId: state.myKeyPackageId,
          theirPublicKey: crypto.encodeBase64(state.theirPublicKey),
          sharedSecret: crypto.encodeBase64(state.sharedSecret),
          established: state.established,
          epoch: state.epoch,
        })
      ),
    };

    const jsonData = JSON.stringify(data);
    const dataBytes = crypto.stringToBytes(jsonData);

    const encrypted = crypto.encryptWithPassword(dataBytes, password);

    return JSON.stringify(encrypted);
  }

  /**
   * Import conversation states from encrypted export
   *
   * @param encryptedData - Encrypted export data
   * @param password - Password to decrypt the export
   * @returns Number of conversations imported
   */
  importConversations(encryptedData: string, password: string): number {
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
      throw new Error('Failed to decrypt conversation states');
    }

    const jsonData = crypto.bytesToString(decrypted);
    const data = JSON.parse(jsonData) as {
      userId: string;
      conversations: Array<{
        conversationId: string;
        myKeyPackageId: string;
        theirPublicKey: string;
        sharedSecret: string;
        established: boolean;
        epoch: number;
      }>;
    };

    if (data.userId !== this.userId) {
      throw new Error('Conversation states belong to a different user');
    }

    let imported = 0;

    for (const conv of data.conversations) {
      const state: ConversationState = {
        conversationId: conv.conversationId,
        myKeyPackageId: conv.myKeyPackageId,
        theirPublicKey: crypto.decodeBase64(conv.theirPublicKey),
        sharedSecret: crypto.decodeBase64(conv.sharedSecret),
        established: conv.established,
        epoch: conv.epoch,
      };

      this.conversationStates.set(conv.conversationId, state);
      imported++;
    }

    return imported;
  }

  /**
   * Get statistics about conversations
   *
   * @returns Statistics object
   */
  getConversationStats(): {
    total: number;
    established: number;
  } {
    let total = 0;
    let established = 0;

    for (const state of this.conversationStates.values()) {
      total++;
      if (state.established) {
        established++;
      }
    }

    return { total, established };
  }

  /**
   * Cleanup expired KeyPackages
   *
   * @returns Number of KeyPackages deleted
   */
  cleanupExpiredKeyPackages(): number {
    return this.keyPackageManager.cleanupExpired();
  }

  /**
   * Get KeyPackage statistics
   */
  getKeyPackageStats() {
    return this.keyPackageManager.getStats();
  }

  /**
   * Clear all data (conversations and KeyPackages)
   * WARNING: This will destroy all encryption keys
   */
  clearAll(): void {
    // Clear conversations
    for (const state of this.conversationStates.values()) {
      crypto.secureWipe(state.sharedSecret);
    }
    this.conversationStates.clear();

    // Clear KeyPackages
    this.keyPackageManager.clear();
  }
}
