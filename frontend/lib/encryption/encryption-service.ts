/**
 * Frontend Encryption Service
 *
 * Main service for handling encryption/decryption on the client side.
 * Supports both server-encrypted and E2EE modes.
 */

import type {
  EncryptedPayload,
  EncryptionMode,
  EncryptionMetadata,
  SignalKeyBundle,
} from '@/shared/types/encryption';
import {
  generateEncryptionKey,
  encryptContent,
  decryptContent,
  generateSignalKeyPair,
  performKeyAgreement,
  generateKeyId,
  generateRegistrationId,
  exportKey,
} from './crypto-utils';
import { keyStorage } from './key-storage';

class EncryptionService {
  private currentUserId: string | null = null;
  private isInitialized = false;

  /**
   * Initialize encryption service for current user
   */
  async initialize(userId: string): Promise<void> {
    if (this.isInitialized && this.currentUserId === userId) {
      return;
    }

    this.currentUserId = userId;
    await keyStorage.init();

    // Check if user has Signal Protocol keys
    const userKeys = await keyStorage.getUserKeys(userId);
    if (!userKeys) {
      console.log('[EncryptionService] User has no encryption keys. Generate them via settings.');
    }

    this.isInitialized = true;
    console.log(`[EncryptionService] Initialized for user ${userId}`);
  }

  /**
   * Generate Signal Protocol keys for current user
   */
  async generateUserKeys(): Promise<SignalKeyBundle> {
    if (!this.currentUserId) {
      throw new Error('Encryption service not initialized');
    }

    const { publicKey, privateKey } = await generateSignalKeyPair();
    const registrationId = generateRegistrationId();

    // Store keys
    await keyStorage.storeUserKeys({
      userId: this.currentUserId,
      publicKey,
      privateKey, // TODO: Encrypt private key with user password
      registrationId,
      identityKey: publicKey, // Simplified: using same key
      preKeyBundleVersion: 1,
      createdAt: Date.now(),
    });

    return {
      identityKey: publicKey,
      signedPreKey: {
        keyId: 1,
        publicKey: publicKey,
        signature: '', // TODO: Sign pre-key with identity key
      },
      registrationId,
    };
  }

  /**
   * Get user's public key bundle
   */
  async getUserKeyBundle(userId?: string): Promise<SignalKeyBundle | null> {
    const targetUserId = userId || this.currentUserId;
    if (!targetUserId) return null;

    const keys = await keyStorage.getUserKeys(targetUserId);
    if (!keys) return null;

    return {
      identityKey: keys.publicKey,
      signedPreKey: {
        keyId: 1,
        publicKey: keys.publicKey,
        signature: '',
      },
      registrationId: keys.registrationId,
    };
  }

  /**
   * Encrypt message based on conversation mode
   */
  async encryptMessage(
    plaintext: string,
    conversationId: string,
    mode: EncryptionMode
  ): Promise<EncryptedPayload> {
    if (!this.currentUserId) {
      throw new Error('Encryption service not initialized');
    }

    // Get or create conversation key
    let conversationKey = await keyStorage.getConversationKey(conversationId);

    if (!conversationKey) {
      // Generate new key for this conversation
      const key = await generateEncryptionKey();
      const keyId = await keyStorage.storeKey(key, undefined, conversationId);
      await keyStorage.storeConversationKey(conversationId, keyId, mode);
      conversationKey = { conversationId, keyId, mode, createdAt: Date.now() };
    }

    // Get the actual key
    const key = await keyStorage.getKey(conversationKey.keyId);
    if (!key) {
      throw new Error('Encryption key not found');
    }

    // Encrypt content
    const encrypted = await encryptContent(plaintext, key, conversationKey.keyId);

    // Set correct mode
    encrypted.metadata.mode = mode;
    if (mode === 'e2ee') {
      encrypted.metadata.protocol = 'signal_v3';
    }

    return encrypted;
  }

  /**
   * Decrypt message
   */
  async decryptMessage(payload: EncryptedPayload): Promise<string> {
    if (!this.currentUserId) {
      throw new Error('Encryption service not initialized');
    }

    const { metadata } = payload;

    // Get decryption key
    const key = await keyStorage.getKey(metadata.keyId);
    if (!key) {
      throw new Error(`Decryption key not found: ${metadata.keyId}`);
    }

    // Decrypt
    return await decryptContent(payload, key);
  }

  /**
   * Establish E2EE session with another user
   * Performs ECDH key agreement
   */
  async establishE2EESession(
    conversationId: string,
    recipientUserId: string
  ): Promise<string> {
    if (!this.currentUserId) {
      throw new Error('Encryption service not initialized');
    }

    // Get own private key
    const ownKeys = await keyStorage.getUserKeys(this.currentUserId);
    if (!ownKeys) {
      throw new Error('User has no encryption keys. Generate them first.');
    }

    // Get recipient's public key (would come from API)
    // For now, we'll use a simplified approach
    const recipientKeys = await keyStorage.getUserKeys(recipientUserId);
    if (!recipientKeys) {
      throw new Error('Recipient has no encryption keys');
    }

    // Perform key agreement
    const sharedKey = await performKeyAgreement(
      ownKeys.privateKey,
      recipientKeys.publicKey
    );

    // Store shared key
    const keyId = await keyStorage.storeKey(sharedKey, undefined, conversationId);
    await keyStorage.storeConversationKey(conversationId, keyId, 'e2ee');

    return keyId;
  }

  /**
   * Check if conversation has encryption enabled
   */
  async hasConversationKey(conversationId: string): Promise<boolean> {
    const key = await keyStorage.getConversationKey(conversationId);
    return !!key;
  }

  /**
   * Get conversation encryption mode
   */
  async getConversationMode(conversationId: string): Promise<EncryptionMode | null> {
    const key = await keyStorage.getConversationKey(conversationId);
    return key?.mode || null;
  }

  /**
   * Prepare message for sending
   * Returns encrypted payload if conversation is encrypted
   */
  async prepareMessage(
    content: string,
    conversationId: string,
    encryptionMode?: EncryptionMode
  ): Promise<{
    content: string;
    encryptedPayload?: EncryptedPayload;
  }> {
    // Check if conversation is encrypted
    const conversationKey = await keyStorage.getConversationKey(conversationId);
    const mode = encryptionMode || conversationKey?.mode;

    if (!mode) {
      // Plaintext conversation
      return { content };
    }

    // Encrypted conversation
    const encrypted = await this.encryptMessage(content, conversationId, mode);

    return {
      content: mode === 'e2ee' ? '[Encrypted]' : content, // E2EE: placeholder, Server: plaintext
      encryptedPayload: encrypted,
    };
  }

  /**
   * Process received message
   * Decrypts if encrypted
   */
  async processReceivedMessage(message: {
    content: string;
    encryptedContent?: string | null;
    encryptionMetadata?: any;
  }): Promise<string> {
    // Check if message is encrypted
    if (!message.encryptedContent || !message.encryptionMetadata) {
      return message.content;
    }

    // Parse encrypted payload
    const payload: EncryptedPayload = {
      ciphertext: message.encryptedContent,
      metadata: message.encryptionMetadata,
    };

    try {
      // Decrypt
      return await this.decryptMessage(payload);
    } catch (error) {
      console.error('[EncryptionService] Failed to decrypt message:', error);
      return '[Encrypted message - Unable to decrypt]';
    }
  }

  /**
   * Clear all encryption keys (for logout)
   */
  async clearKeys(): Promise<void> {
    await keyStorage.clearAll();
    this.currentUserId = null;
    this.isInitialized = false;
    console.log('[EncryptionService] All keys cleared');
  }

  /**
   * Export keys for backup
   */
  async exportKeys(password: string): Promise<string> {
    return await keyStorage.exportKeys(password);
  }

  /**
   * Import keys from backup
   */
  async importKeys(backup: string, password: string): Promise<void> {
    await keyStorage.importKeys(backup, password);
  }

  /**
   * Check if encryption is available
   */
  isAvailable(): boolean {
    return (
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined' &&
      typeof indexedDB !== 'undefined'
    );
  }

  /**
   * Get initialization status
   */
  getStatus(): {
    isInitialized: boolean;
    userId: string | null;
    isAvailable: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      userId: this.currentUserId,
      isAvailable: this.isAvailable(),
    };
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

// Export for testing
export { EncryptionService };
