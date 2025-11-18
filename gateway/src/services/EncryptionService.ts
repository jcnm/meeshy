/**
 * Encryption Service
 *
 * Unified service for managing E2E encryption across different protocols
 * Supports both Signal Protocol and MLS
 */

import {
  EncryptionAdapter,
  EncryptedMessage,
  KeyBundle,
  EncryptionAdapterType,
  EncryptionAdapterConfig,
} from '../encryption-adapters/base.adapter';
import { SignalProtocolAdapter } from '../encryption-adapters/signal.adapter';
import { MLSAdapter } from '../encryption-adapters/mls.adapter';

/**
 * Encryption Service Configuration
 */
export interface EncryptionServiceConfig {
  /**
   * Default protocol to use
   */
  defaultProtocol: EncryptionAdapterType;

  /**
   * User ID
   */
  userId: string;

  /**
   * Allow protocol switching
   */
  allowProtocolSwitch?: boolean;

  /**
   * Storage backend for keys (optional)
   */
  storage?: any;
}

/**
 * Encryption Service
 *
 * Manages encryption adapters and provides a unified interface
 */
export class EncryptionService {
  private currentAdapter: EncryptionAdapter;
  private config: EncryptionServiceConfig;
  private initialized: boolean = false;

  constructor(config: EncryptionServiceConfig) {
    this.config = config;

    // Create initial adapter based on default protocol
    if (config.defaultProtocol === 'signal') {
      this.currentAdapter = new SignalProtocolAdapter();
    } else {
      this.currentAdapter = new MLSAdapter();
    }
  }

  /**
   * Initialize the encryption service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.currentAdapter.initialize(this.config.userId);
    this.initialized = true;
  }

  /**
   * Encrypt a message
   *
   * @param recipientId - Recipient's user ID
   * @param message - Plaintext message
   * @returns Encrypted message
   */
  async encrypt(
    recipientId: string,
    message: string
  ): Promise<EncryptedMessage> {
    this.ensureInitialized();
    return await this.currentAdapter.encrypt(recipientId, message);
  }

  /**
   * Decrypt a message
   *
   * @param senderId - Sender's user ID
   * @param encrypted - Encrypted message
   * @returns Decrypted plaintext
   */
  async decrypt(
    senderId: string,
    encrypted: EncryptedMessage
  ): Promise<string> {
    this.ensureInitialized();
    return await this.currentAdapter.decrypt(senderId, encrypted);
  }

  /**
   * Get the current protocol being used
   */
  getCurrentProtocol(): EncryptionAdapterType {
    return this.currentAdapter.getProtocolName();
  }

  /**
   * Switch to a different encryption protocol
   *
   * @param protocol - Protocol to switch to
   */
  async switchProtocol(protocol: EncryptionAdapterType): Promise<void> {
    if (!this.config.allowProtocolSwitch) {
      throw new Error('Protocol switching is disabled');
    }

    if (protocol === this.currentAdapter.getProtocolName()) {
      // Already using this protocol
      return;
    }

    // Cleanup current adapter
    await this.currentAdapter.cleanup();

    // Create new adapter
    if (protocol === 'signal') {
      this.currentAdapter = new SignalProtocolAdapter();
    } else {
      this.currentAdapter = new MLSAdapter();
    }

    // Initialize new adapter
    await this.currentAdapter.initialize(this.config.userId);
  }

  /**
   * Get public key bundle for this user
   */
  async getKeyBundle(): Promise<KeyBundle> {
    this.ensureInitialized();
    return await this.currentAdapter.getKeyBundle();
  }

  /**
   * Process a key bundle from another user
   *
   * @param userId - Other user's ID
   * @param keyBundle - Their public key bundle
   */
  async processKeyBundle(
    userId: string,
    keyBundle: KeyBundle
  ): Promise<void> {
    this.ensureInitialized();
    await this.currentAdapter.processKeyBundle(userId, keyBundle);
  }

  /**
   * Exchange keys with another user (convenience method)
   *
   * This method should be called before the first encrypted message
   *
   * @param userId - Other user's ID
   * @param theirKeyBundle - Their public key bundle
   * @returns Our key bundle to send to them
   */
  async exchangeKeys(
    userId: string,
    theirKeyBundle: KeyBundle
  ): Promise<KeyBundle> {
    this.ensureInitialized();

    // Process their keys
    await this.currentAdapter.processKeyBundle(userId, theirKeyBundle);

    // Return our keys
    return await this.currentAdapter.getKeyBundle();
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup and destroy all encryption keys
   * WARNING: This is irreversible
   */
  async destroy(): Promise<void> {
    if (this.initialized) {
      await this.currentAdapter.cleanup();
      this.initialized = false;
    }
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'EncryptionService not initialized. Call initialize() first.'
      );
    }
  }

  /**
   * Get adapter-specific features (for advanced usage)
   */
  getAdapter(): EncryptionAdapter {
    this.ensureInitialized();
    return this.currentAdapter;
  }
}

/**
 * Factory function to create and initialize an EncryptionService
 */
export async function createEncryptionService(
  config: EncryptionServiceConfig
): Promise<EncryptionService> {
  const service = new EncryptionService(config);
  await service.initialize();
  return service;
}

/**
 * Helper to create a Signal Protocol service
 */
export async function createSignalEncryptionService(
  userId: string
): Promise<EncryptionService> {
  return await createEncryptionService({
    userId,
    defaultProtocol: 'signal',
    allowProtocolSwitch: true,
  });
}

/**
 * Helper to create an MLS service
 */
export async function createMLSEncryptionService(
  userId: string
): Promise<EncryptionService> {
  return await createEncryptionService({
    userId,
    defaultProtocol: 'mls',
    allowProtocolSwitch: true,
  });
}
