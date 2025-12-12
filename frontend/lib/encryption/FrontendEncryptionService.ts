/**
 * Frontend Encryption Service
 *
 * Manages encryption for the browser environment with Signal Protocol support.
 */

import { SharedEncryptionService } from '@/shared/encryption/SharedEncryptionService';
import { SignalProtocolService } from '@/shared/encryption/signal/signal-protocol-service';
import { webCryptoAdapter } from './adapters/web-crypto-adapter';
import { indexedDBKeyStorageAdapter } from './adapters/indexeddb-key-storage-adapter';
import { createBrowserSignalStores } from './adapters/browser-signal-stores';
import type { EncryptionMode, EncryptedPayload } from '@/shared/types/encryption';
import type { PreKeyBundle } from '@/shared/encryption/signal/signal-types';

/**
 * Frontend Encryption Service
 * Wraps SharedEncryptionService with browser-specific initialization
 */
class FrontendEncryptionService {
  private sharedService?: SharedEncryptionService;
  private signalService?: SignalProtocolService;
  private isInitialized = false;
  private currentUserId?: string;

  /**
   * Initialize encryption service for the current user
   * Must be called after user login
   */
  async initialize(userId: string): Promise<void> {
    if (this.isInitialized && this.currentUserId === userId) {
      return; // Already initialized for this user
    }

    console.log('[FrontendEncryptionService] Initializing for user:', userId);

    // Create Signal Protocol stores
    const signalStores = await createBrowserSignalStores({ userId });

    // Create Signal Protocol service
    this.signalService = new SignalProtocolService(signalStores, 1);

    // Create shared service with Signal Protocol support
    this.sharedService = new SharedEncryptionService({
      cryptoAdapter: webCryptoAdapter,
      keyStorage: indexedDBKeyStorageAdapter,
      signalProtocolService: this.signalService,
    });

    await this.sharedService.initialize(userId);

    this.currentUserId = userId;
    this.isInitialized = true;

    console.log('[FrontendEncryptionService] Initialized successfully');
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized && !!this.sharedService;
  }

  /**
   * Encrypt message content
   *
   * @param content - Plaintext message content
   * @param conversationId - Conversation ID
   * @param mode - Encryption mode (e2ee or server)
   * @returns Encrypted payload
   */
  async encryptMessage(
    content: string,
    conversationId: string,
    mode: EncryptionMode
  ): Promise<EncryptedPayload> {
    if (!this.sharedService) {
      throw new Error('Encryption service not initialized. Call initialize() first.');
    }

    return await this.sharedService.encryptMessage(content, conversationId, mode);
  }

  /**
   * Decrypt message content
   *
   * @param encryptedPayload - Encrypted message payload
   * @returns Decrypted plaintext
   */
  async decryptMessage(encryptedPayload: EncryptedPayload): Promise<string> {
    if (!this.sharedService) {
      throw new Error('Encryption service not initialized. Call initialize() first.');
    }

    return await this.sharedService.decryptMessage(encryptedPayload);
  }

  /**
   * Generate pre-key bundle for this user
   * Used for establishing E2EE sessions with other users
   */
  async generatePreKeyBundle(): Promise<PreKeyBundle> {
    if (!this.signalService) {
      throw new Error('Signal Protocol service not initialized');
    }

    return await this.signalService.generatePreKeyBundle();
  }

  /**
   * Establish E2EE session with another user
   *
   * @param recipientUserId - User ID of the recipient
   * @param preKeyBundle - Recipient's pre-key bundle
   */
  async establishSession(recipientUserId: string, preKeyBundle: PreKeyBundle): Promise<void> {
    if (!this.signalService) {
      throw new Error('Signal Protocol service not initialized');
    }

    const { ProtocolAddress } = await import('@signalapp/libsignal-client');
    const recipientAddress = ProtocolAddress.new(recipientUserId, preKeyBundle.deviceId);

    await this.signalService.processPreKeyBundle(recipientAddress, preKeyBundle);
  }

  /**
   * Get Signal Protocol service (for advanced usage)
   */
  getSignalService(): SignalProtocolService | undefined {
    return this.signalService;
  }

  /**
   * Reset encryption service (e.g., on logout)
   */
  reset(): void {
    this.sharedService = undefined;
    this.signalService = undefined;
    this.isInitialized = false;
    this.currentUserId = undefined;
    console.log('[FrontendEncryptionService] Reset');
  }
}

// Export singleton instance
export const frontendEncryptionService = new FrontendEncryptionService();

// Export class for testing
export { FrontendEncryptionService };
