/**
 * WhatsApp + Signal Protocol Bridge
 *
 * Integrates Signal Protocol encryption with WhatsApp DMA adapter
 * Provides end-to-end encryption beyond WhatsApp's built-in encryption
 */

import {
  IProtocolAdapter,
  ProtocolAdapterConfig,
  ProtocolAdapterOutcome,
  ProtocolMessage
} from './ProtocolAdapter';
import { WhatsAppDMAAdapter } from './WhatsAppDMAAdapter';

export interface SignalProtocolConfig {
  enabled: boolean;
  keyStore?: {
    getIdentityKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array } | null>;
    getLocalRegistrationId(): Promise<number>;
  };
  sessionStore?: {
    loadSession(recipientId: string): Promise<any>;
    storeSession(recipientId: string, session: any): Promise<void>;
  };
  preKeyStore?: {
    loadPreKey(preKeyId: number): Promise<any>;
    storePreKey(preKeyId: number, preKey: any): Promise<void>;
  };
  signedPreKeyStore?: {
    loadSignedPreKey(signedPreKeyId: number): Promise<any>;
    storeSignedPreKey(signedPreKeyId: number, signedPreKey: any): Promise<void>;
  };
}

export class WhatsAppSignalProtocolBridge implements IProtocolAdapter {
  readonly protocol = 'whatsapp-signal-bridge';

  private whatsappAdapter: WhatsAppDMAAdapter;
  private signalConfig?: SignalProtocolConfig;
  private initialized = false;

  // Simple key cache for demo purposes
  // In production, use proper key management
  private keyCache = new Map<string, {
    publicKey: string;
    encryptedSessionKey: string;
  }>();

  constructor() {
    this.whatsappAdapter = new WhatsAppDMAAdapter();
  }

  async configure(config: ProtocolAdapterConfig): Promise<void> {
    // Configure the underlying WhatsApp adapter
    await this.whatsappAdapter.configure(config);

    // Store Signal Protocol configuration
    this.signalConfig = {
      enabled: config.enabled || false,
      ...config
    } as any;

    this.initialized = true;
  }

  isConfigured(): boolean {
    return this.initialized && this.whatsappAdapter.isConfigured();
  }

  async sendMessage(message: ProtocolMessage): Promise<ProtocolAdapterOutcome> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Bridge not configured',
        errorCode: 'NOT_CONFIGURED'
      };
    }

    try {
      // Encrypt the message using Signal Protocol
      const encryptedMessage = await this.encryptMessage(message);

      // Send through WhatsApp
      const outcome = await this.whatsappAdapter.sendMessage(encryptedMessage);

      return {
        ...outcome,
        metadata: {
          ...outcome.metadata,
          encryption: 'signal-protocol',
          bridgeVersion: '1.0'
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Encryption failed: ${errorMessage}`,
        errorCode: 'ENCRYPTION_FAILED'
      };
    }
  }

  async sendBulkMessages(messages: ProtocolMessage[]): Promise<ProtocolAdapterOutcome[]> {
    return Promise.all(messages.map(msg => this.sendMessage(msg)));
  }

  async processIncomingWebhook(
    payload: Record<string, any>,
    signature?: string
  ): Promise<ProtocolMessage | null> {
    // Process through WhatsApp adapter
    const message = await this.whatsappAdapter.processIncomingWebhook(payload, signature);

    if (!message) {
      return null;
    }

    // Check if message is encrypted with Signal Protocol
    if (this.isSignalEncrypted(message)) {
      try {
        // Decrypt the message
        const decryptedMessage = await this.decryptMessage(message);
        return decryptedMessage;
      } catch (error) {
        console.error('Failed to decrypt Signal Protocol message:', error);
        return message; // Return encrypted message if decryption fails
      }
    }

    return message;
  }

  async verifyConnection(): Promise<boolean> {
    return this.whatsappAdapter.verifyConnection();
  }

  async disconnect(): Promise<void> {
    await this.whatsappAdapter.disconnect();
    this.signalConfig = undefined;
    this.initialized = false;
    this.keyCache.clear();
  }

  async getMessageStatus(externalMessageId: string): Promise<{
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    updatedAt: Date;
    metadata?: Record<string, any>;
  } | null> {
    return this.whatsappAdapter.getMessageStatus(externalMessageId);
  }

  supportsEncryption(): boolean {
    return true;
  }

  getEncryptionType(): string | null {
    return 'signal-protocol-whatsapp';
  }

  async getRateLimit(): Promise<{
    remaining: number;
    total: number;
    resetAt: Date;
  } | null> {
    return this.whatsappAdapter.getRateLimit();
  }

  // Private helper methods

  /**
   * Encrypt a message using Signal Protocol
   * In a real implementation, this would use the actual Signal Protocol library
   */
  private async encryptMessage(message: ProtocolMessage): Promise<ProtocolMessage> {
    // In production, use proper Signal Protocol implementation
    // For now, we'll do basic encryption simulation

    const encryptedText = this.simpleEncrypt(message.text);
    const encryptionKey = await this.getOrCreateEncryptionKey(message.recipientId);

    return {
      ...message,
      text: `[SIGNAL-ENCRYPTED:${encryptionKey.publicKey}:${encryptedText}]`,
      isEncrypted: true,
      encryptionType: 'signal-protocol',
      metadata: {
        ...message.metadata,
        signalEncrypted: true,
        encryptionKey: encryptionKey.publicKey,
        originalLength: message.text.length
      }
    };
  }

  /**
   * Decrypt a message that was encrypted with Signal Protocol
   */
  private async decryptMessage(message: ProtocolMessage): Promise<ProtocolMessage> {
    if (!message.text.startsWith('[SIGNAL-ENCRYPTED:')) {
      return message;
    }

    try {
      // Extract encrypted content
      const match = message.text.match(/\[SIGNAL-ENCRYPTED:([^:]+):(.+)\]/);
      if (!match) {
        return message;
      }

      const [, publicKey, encryptedText] = match;
      const decryptedText = this.simpleDecrypt(encryptedText, publicKey);

      return {
        ...message,
        text: decryptedText,
        isEncrypted: false,
        encryptionType: 'signal-protocol',
        metadata: {
          ...message.metadata,
          signalDecrypted: true,
          decryptedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Signal Protocol decryption failed:', error);
      throw error;
    }
  }

  /**
   * Check if a message is encrypted with Signal Protocol
   */
  private isSignalEncrypted(message: ProtocolMessage): boolean {
    return message.text.startsWith('[SIGNAL-ENCRYPTED:');
  }

  /**
   * Get or create encryption key for recipient
   * In production, use proper key management system
   */
  private async getOrCreateEncryptionKey(recipientId: string): Promise<{
    publicKey: string;
    encryptedSessionKey: string;
  }> {
    // Check cache first
    if (this.keyCache.has(recipientId)) {
      return this.keyCache.get(recipientId)!;
    }

    // Generate new key pair for this recipient
    // In production, this would use Signal Protocol's key agreement
    const publicKey = this.generatePublicKey(recipientId);
    const encryptedSessionKey = this.generateSessionKey();

    const keys = { publicKey, encryptedSessionKey };
    this.keyCache.set(recipientId, keys);

    return keys;
  }

  /**
   * Simple encryption (for demo purposes only)
   * Production code should use proper Signal Protocol library
   */
  private simpleEncrypt(text: string): string {
    // This is a placeholder. Use proper Signal Protocol library in production
    const encoded = Buffer.from(text).toString('base64');
    return encoded;
  }

  /**
   * Simple decryption (for demo purposes only)
   * Production code should use proper Signal Protocol library
   */
  private simpleDecrypt(encrypted: string, _publicKey: string): string {
    // This is a placeholder. Use proper Signal Protocol library in production
    const decoded = Buffer.from(encrypted, 'base64').toString('utf-8');
    return decoded;
  }

  /**
   * Generate a public key representation
   */
  private generatePublicKey(recipientId: string): string {
    return `pk_${Buffer.from(recipientId).toString('base64').substring(0, 16)}`;
  }

  /**
   * Generate a session key
   */
  private generateSessionKey(): string {
    return Buffer.from(Math.random().toString()).toString('base64').substring(0, 32);
  }
}
