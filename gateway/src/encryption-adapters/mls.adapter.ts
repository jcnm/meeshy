/**
 * MLS Adapter
 *
 * Wraps the existing @meeshy/mls-core package to conform to
 * the EncryptionAdapter interface
 */

import { MLSClient } from '@meeshy/mls-core';
import {
  EncryptionAdapter,
  EncryptedMessage,
  KeyBundle,
} from './base.adapter';

/**
 * MLS Encryption Adapter
 *
 * Wraps @meeshy/mls-core to provide E2E encryption via MLS protocol
 */
export class MLSAdapter implements EncryptionAdapter {
  private mlsClient: MLSClient | null = null;
  private userId: string = '';

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    this.mlsClient = new MLSClient(userId);

    // Generate initial KeyPackages
    this.mlsClient.generateKeyPackages(10);
  }

  async encrypt(
    recipientId: string,
    message: string
  ): Promise<EncryptedMessage> {
    if (!this.mlsClient) {
      throw new Error('MLS adapter not initialized');
    }

    // Use recipientId as conversationId (1:1 conversation)
    const conversationId = this.generateConversationId(this.userId, recipientId);

    // Check if conversation is established
    if (!this.mlsClient.isConversationEstablished(conversationId)) {
      throw new Error(
        `No MLS conversation established with ${recipientId}. Call processKeyBundle first.`
      );
    }

    // Encrypt the message
    const encrypted = await this.mlsClient.encryptMessage(
      conversationId,
      message
    );

    // Convert to EncryptedMessage format
    return {
      type: 0, // MLS message type
      body: new TextEncoder().encode(
        JSON.stringify({
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          senderKeyHash: encrypted.senderKeyHash,
          groupEpoch: encrypted.groupEpoch,
        })
      ),
      recipientId,
      timestamp: Date.now(),
      metadata: {
        encryptionType: encrypted.encryptionType,
      },
    };
  }

  async decrypt(
    senderId: string,
    encrypted: EncryptedMessage
  ): Promise<string> {
    if (!this.mlsClient) {
      throw new Error('MLS adapter not initialized');
    }

    // Use senderId as conversationId (1:1 conversation)
    const conversationId = this.generateConversationId(senderId, this.userId);

    // Check if conversation is established
    if (!this.mlsClient.isConversationEstablished(conversationId)) {
      throw new Error(
        `No MLS conversation established with ${senderId}. Call processKeyBundle first.`
      );
    }

    // Parse the encrypted data
    const encryptedData = JSON.parse(
      new TextDecoder().decode(encrypted.body)
    ) as {
      ciphertext: string;
      nonce: string;
      senderKeyHash: string;
      groupEpoch: number;
    };

    // Decrypt the message
    const plaintext = await this.mlsClient.decryptMessage(
      conversationId,
      encryptedData.ciphertext,
      encryptedData.nonce
    );

    return plaintext;
  }

  getProtocolName(): 'signal' | 'mls' {
    return 'mls';
  }

  async getKeyBundle(): Promise<KeyBundle> {
    if (!this.mlsClient) {
      throw new Error('MLS adapter not initialized');
    }

    // Get available KeyPackages
    const keyPackages = this.mlsClient.getAvailableKeyPackages();

    if (keyPackages.length === 0) {
      throw new Error('No KeyPackages available. Generate KeyPackages first.');
    }

    // Convert first KeyPackage to KeyBundle format
    // Note: MLS KeyPackage structure is different from Signal
    // This is a simplified conversion for compatibility
    const firstKeyPackage = keyPackages[0];

    return {
      identityKey: new TextEncoder().encode(firstKeyPackage.publicKey),
      registrationId: 0, // MLS doesn't use registration ID
      signedPreKey: {
        keyId: 0,
        publicKey: new TextEncoder().encode(firstKeyPackage.publicKey),
        signature: new Uint8Array(64), // Placeholder
      },
      preKeys: keyPackages.slice(1, 11).map((kp, index) => ({
        keyId: index,
        publicKey: new TextEncoder().encode(kp.publicKey),
      })),
    };
  }

  async processKeyBundle(
    userId: string,
    keyBundle: KeyBundle
  ): Promise<void> {
    if (!this.mlsClient) {
      throw new Error('MLS adapter not initialized');
    }

    // Generate conversationId
    const conversationId = this.generateConversationId(this.userId, userId);

    // Get my KeyPackage
    const myKeyPackages = this.mlsClient.getAvailableKeyPackages();
    if (myKeyPackages.length === 0) {
      throw new Error('No KeyPackages available');
    }

    const myKeyPackageId = myKeyPackages[0].keyPackageId;

    // Decode their public key
    const theirPublicKey = new TextDecoder().decode(keyBundle.identityKey);

    // Establish conversation
    await this.mlsClient.establishConversation(
      conversationId,
      myKeyPackageId,
      theirPublicKey
    );
  }

  async cleanup(): Promise<void> {
    if (this.mlsClient) {
      this.mlsClient.clearAll();
      this.mlsClient = null;
    }
    this.userId = '';
  }

  /**
   * Generate a deterministic conversation ID from two user IDs
   * Ensures both parties use the same conversation ID
   */
  private generateConversationId(userId1: string, userId2: string): string {
    // Sort to ensure deterministic ID regardless of order
    const [user1, user2] = [userId1, userId2].sort();
    return `conv_${user1}_${user2}`;
  }

  /**
   * Get MLS-specific statistics
   */
  getMLSStats() {
    if (!this.mlsClient) {
      throw new Error('MLS adapter not initialized');
    }

    return {
      conversations: this.mlsClient.getConversationStats(),
      keyPackages: this.mlsClient.getKeyPackageStats(),
    };
  }

  /**
   * Generate additional KeyPackages
   */
  generateKeyPackages(count: number) {
    if (!this.mlsClient) {
      throw new Error('MLS adapter not initialized');
    }

    return this.mlsClient.generateKeyPackages(count);
  }

  /**
   * Cleanup expired KeyPackages
   */
  cleanupExpiredKeyPackages(): number {
    if (!this.mlsClient) {
      throw new Error('MLS adapter not initialized');
    }

    return this.mlsClient.cleanupExpiredKeyPackages();
  }

  /**
   * Export conversations (for backup/restore)
   */
  exportConversations(password: string): string {
    if (!this.mlsClient) {
      throw new Error('MLS adapter not initialized');
    }

    return this.mlsClient.exportConversations(password);
  }

  /**
   * Import conversations (for backup/restore)
   */
  importConversations(encryptedData: string, password: string): number {
    if (!this.mlsClient) {
      throw new Error('MLS adapter not initialized');
    }

    return this.mlsClient.importConversations(encryptedData, password);
  }
}
