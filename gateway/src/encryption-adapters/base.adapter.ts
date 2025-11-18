/**
 * Base Encryption Adapter Interface
 *
 * Provides a unified interface for different E2E encryption protocols
 * (Signal Protocol, MLS, etc.)
 */

export interface EncryptedMessage {
  /**
   * Type of message (prekey, normal, etc.)
   */
  type: number;

  /**
   * Encrypted message body
   */
  body: Uint8Array;

  /**
   * Recipient identifier
   */
  recipientId: string;

  /**
   * Timestamp when encrypted
   */
  timestamp: number;

  /**
   * Optional metadata
   */
  metadata?: Record<string, any>;
}

export interface KeyBundle {
  /**
   * Identity key
   */
  identityKey: Uint8Array;

  /**
   * Registration ID
   */
  registrationId: number;

  /**
   * Signed pre-key
   */
  signedPreKey: {
    keyId: number;
    publicKey: Uint8Array;
    signature: Uint8Array;
  };

  /**
   * One-time pre-keys
   */
  preKeys: Array<{
    keyId: number;
    publicKey: Uint8Array;
  }>;
}

export interface EncryptionAdapter {
  /**
   * Initialize the encryption adapter
   * @param userId - Unique identifier for this user
   */
  initialize(userId: string): Promise<void>;

  /**
   * Encrypt a message for a recipient
   * @param recipientId - Recipient's unique identifier
   * @param message - Plaintext message to encrypt
   * @returns Encrypted message
   */
  encrypt(recipientId: string, message: string): Promise<EncryptedMessage>;

  /**
   * Decrypt a received message
   * @param senderId - Sender's unique identifier
   * @param encrypted - Encrypted message to decrypt
   * @returns Decrypted plaintext message
   */
  decrypt(senderId: string, encrypted: EncryptedMessage): Promise<string>;

  /**
   * Get the protocol name
   * @returns Protocol identifier
   */
  getProtocolName(): 'signal' | 'mls';

  /**
   * Get public key bundle for registration
   * @returns Key bundle for distribution
   */
  getKeyBundle(): Promise<KeyBundle>;

  /**
   * Process a received key bundle from another user
   * @param userId - User identifier
   * @param keyBundle - Their public key bundle
   */
  processKeyBundle(userId: string, keyBundle: KeyBundle): Promise<void>;

  /**
   * Clean up resources
   */
  cleanup(): Promise<void>;
}

/**
 * Encryption adapter factory
 */
export type EncryptionAdapterType = 'signal' | 'mls';

export interface EncryptionAdapterConfig {
  type: EncryptionAdapterType;
  userId: string;
  storage?: any; // Storage backend for keys
}
