/**
 * Shared Encryption Service
 *
 * Platform-agnostic encryption service that works on both backend and frontend.
 * Uses dependency injection for platform-specific crypto operations and key storage.
 */

import type {
  EncryptedPayload,
  EncryptionMode,
  SignalKeyBundle,
} from '../types/encryption';
import type { CryptoAdapter, CryptoKey } from './crypto-adapter';
import {
  encryptContent,
  decryptContent,
  generateSignalKeyPair,
  performKeyAgreement,
  generateKeyId,
  generateRegistrationId,
  exportKeyToString,
  importKeyFromString,
  prepareForStorage,
  reconstructPayload,
} from './encryption-utils';

/**
 * Key Storage Interface
 * Platform-specific implementations (IndexedDB for browser, in-memory for Node.js)
 */
export interface KeyStorageAdapter {
  /**
   * Store an encryption key
   */
  storeKey(
    keyId: string,
    keyData: string,
    conversationId?: string,
    userId?: string
  ): Promise<void>;

  /**
   * Retrieve an encryption key
   */
  getKey(keyId: string): Promise<string | null>;

  /**
   * Store conversation key mapping
   */
  storeConversationKey(
    conversationId: string,
    keyId: string,
    mode: EncryptionMode
  ): Promise<void>;

  /**
   * Get conversation key mapping
   */
  getConversationKey(conversationId: string): Promise<{
    keyId: string;
    mode: EncryptionMode;
    createdAt: number;
  } | null>;

  /**
   * Store user Signal Protocol keys
   */
  storeUserKeys(keys: {
    userId: string;
    publicKey: string;
    privateKey: string;
    registrationId: number;
    identityKey: string;
    preKeyBundleVersion: number;
    createdAt: number;
  }): Promise<void>;

  /**
   * Get user Signal Protocol keys
   */
  getUserKeys(userId: string): Promise<{
    userId: string;
    publicKey: string;
    privateKey: string;
    registrationId: number;
    identityKey: string;
    preKeyBundleVersion: number;
    createdAt: number;
  } | null>;

  /**
   * Clear all keys (for logout)
   */
  clearAll(): Promise<void>;

  /**
   * Export keys for backup
   */
  exportKeys(password: string): Promise<string>;

  /**
   * Import keys from backup
   */
  importKeys(backup: string, password: string): Promise<void>;
}

/**
 * Shared Encryption Service Configuration
 */
export interface EncryptionServiceConfig {
  cryptoAdapter: CryptoAdapter;
  keyStorage: KeyStorageAdapter;
}

/**
 * Shared Encryption Service
 *
 * This service can be used on both backend and frontend by injecting
 * platform-specific adapters for crypto operations and key storage.
 */
export class SharedEncryptionService {
  private currentUserId: string | null = null;
  private isInitialized = false;
  private cryptoAdapter: CryptoAdapter;
  private keyStorage: KeyStorageAdapter;

  constructor(config: EncryptionServiceConfig) {
    this.cryptoAdapter = config.cryptoAdapter;
    this.keyStorage = config.keyStorage;
  }

  /**
   * Initialize encryption service for current user
   */
  async initialize(userId: string): Promise<void> {
    if (this.isInitialized && this.currentUserId === userId) {
      return;
    }

    this.currentUserId = userId;

    // Check if user has Signal Protocol keys
    const userKeys = await this.keyStorage.getUserKeys(userId);
    if (!userKeys) {
      console.log(
        '[EncryptionService] User has no encryption keys. Generate them via settings.'
      );
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

    const { publicKey, privateKey } = await generateSignalKeyPair(
      this.cryptoAdapter
    );
    const registrationId = generateRegistrationId(this.cryptoAdapter);

    // Store keys
    await this.keyStorage.storeUserKeys({
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

    const keys = await this.keyStorage.getUserKeys(targetUserId);
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
    let conversationKey = await this.keyStorage.getConversationKey(
      conversationId
    );

    if (!conversationKey) {
      // Generate new key for this conversation
      const key = await this.cryptoAdapter.generateEncryptionKey();
      const keyId = generateKeyId(this.cryptoAdapter);
      const keyData = await exportKeyToString(key, this.cryptoAdapter);

      await this.keyStorage.storeKey(keyId, keyData, conversationId);
      await this.keyStorage.storeConversationKey(conversationId, keyId, mode);
      conversationKey = { keyId, mode, createdAt: Date.now() };
    }

    // Get the actual key
    const keyData = await this.keyStorage.getKey(conversationKey.keyId);
    if (!keyData) {
      throw new Error('Encryption key not found');
    }

    const key = await importKeyFromString(keyData, this.cryptoAdapter);

    // Encrypt content
    const encrypted = await encryptContent(
      plaintext,
      key,
      conversationKey.keyId,
      this.cryptoAdapter
    );

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

    // Check if this is an E2EE message
    if (metadata.mode === 'e2ee') {
      // E2EE messages should be decrypted on the client only
      // Server should never see the plaintext
      throw new Error('Cannot decrypt E2EE messages on server');
    }

    // Get decryption key
    const keyData = await this.keyStorage.getKey(metadata.keyId);
    if (!keyData) {
      throw new Error(`Decryption key not found: ${metadata.keyId}`);
    }

    const key = await importKeyFromString(keyData, this.cryptoAdapter);

    // Decrypt
    return await decryptContent(payload, key, this.cryptoAdapter);
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
    const ownKeys = await this.keyStorage.getUserKeys(this.currentUserId);
    if (!ownKeys) {
      throw new Error('User has no encryption keys. Generate them first.');
    }

    // Get recipient's public key (would come from API)
    const recipientKeys = await this.keyStorage.getUserKeys(recipientUserId);
    if (!recipientKeys) {
      throw new Error('Recipient has no encryption keys');
    }

    // Perform key agreement
    const sharedKey = await performKeyAgreement(
      ownKeys.privateKey,
      recipientKeys.publicKey,
      this.cryptoAdapter
    );

    // Store shared key
    const keyId = generateKeyId(this.cryptoAdapter);
    const keyData = await exportKeyToString(sharedKey, this.cryptoAdapter);

    await this.keyStorage.storeKey(keyId, keyData, conversationId);
    await this.keyStorage.storeConversationKey(conversationId, keyId, 'e2ee');

    return keyId;
  }

  /**
   * Check if conversation has encryption enabled
   */
  async hasConversationKey(conversationId: string): Promise<boolean> {
    const key = await this.keyStorage.getConversationKey(conversationId);
    return !!key;
  }

  /**
   * Get conversation encryption mode
   */
  async getConversationMode(
    conversationId: string
  ): Promise<EncryptionMode | null> {
    const key = await this.keyStorage.getConversationKey(conversationId);
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
    const conversationKey = await this.keyStorage.getConversationKey(
      conversationId
    );
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

    // Reconstruct encrypted payload
    const payload = reconstructPayload(
      message.encryptedContent,
      message.encryptionMetadata
    );

    try {
      // Decrypt
      return await this.decryptMessage(payload);
    } catch (error) {
      console.error('[EncryptionService] Failed to decrypt message:', error);
      return '[Encrypted message - Unable to decrypt]';
    }
  }

  /**
   * Prepare encrypted payload for storage
   */
  prepareForStorage(payload: EncryptedPayload): {
    encryptedContent: string;
    encryptionMetadata: Record<string, any>;
  } {
    return prepareForStorage(payload);
  }

  /**
   * Clear all encryption keys (for logout)
   */
  async clearKeys(): Promise<void> {
    await this.keyStorage.clearAll();
    this.currentUserId = null;
    this.isInitialized = false;
    console.log('[EncryptionService] All keys cleared');
  }

  /**
   * Export keys for backup
   */
  async exportKeys(password: string): Promise<string> {
    return await this.keyStorage.exportKeys(password);
  }

  /**
   * Import keys from backup
   */
  async importKeys(backup: string, password: string): Promise<void> {
    await this.keyStorage.importKeys(backup, password);
  }

  /**
   * Check if encryption is available
   */
  isAvailable(): boolean {
    return true; // Platform-specific adapters will handle availability
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
