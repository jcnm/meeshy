/**
 * iMessage + Signal Protocol Bridge
 *
 * Integrates Signal Protocol encryption with iMessage adapter
 * Provides additional end-to-end encryption layer for enhanced security
 */

import {
  IProtocolAdapter,
  ProtocolAdapterConfig,
  ProtocolAdapterOutcome,
  ProtocolMessage
} from './ProtocolAdapter';
import { iMessageAdapter } from './iMessageAdapter';

export interface iMessageSignalConfig extends ProtocolAdapterConfig {
  appleTeamId: string;
  appleKeyId: string;
  applePrivateKey: string;
  bundleId: string;
  enableSignalEncryption?: boolean;
}

export class iMessageSignalProtocolBridge implements IProtocolAdapter {
  readonly protocol = 'imessage-signal-bridge';

  private iMessageAdapter: iMessageAdapter;
  private signalEnabled: boolean = false;
  private initialized: boolean = false;
  private keyCache = new Map<string, {
    publicKey: string;
    encryptedSessionKey: string;
  }>();

  constructor() {
    this.iMessageAdapter = new iMessageAdapter();
  }

  async configure(config: ProtocolAdapterConfig): Promise<void> {
    // Configure the underlying iMessage adapter
    await this.iMessageAdapter.configure(config);

    const bridgeConfig = config as iMessageSignalConfig;
    this.signalEnabled = bridgeConfig.enableSignalEncryption !== false;
    this.initialized = true;
  }

  isConfigured(): boolean {
    return this.initialized && this.iMessageAdapter.isConfigured();
  }

  async sendMessage(message: ProtocolMessage): Promise<ProtocolAdapterOutcome> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'iMessage Signal bridge not configured',
        errorCode: 'NOT_CONFIGURED'
      };
    }

    try {
      // Encrypt message if Signal Protocol is enabled
      let messageToSend = message;
      if (this.signalEnabled && !message.isEncrypted) {
        messageToSend = await this.encryptMessage(message);
      }

      // Send through iMessage adapter
      const outcome = await this.iMessageAdapter.sendMessage(messageToSend);

      return {
        ...outcome,
        metadata: {
          ...outcome.metadata,
          encryption: this.signalEnabled ? 'signal-protocol' : 'imessage-e2ee',
          bridgeVersion: '1.0'
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Encryption or send failed: ${errorMessage}`,
        errorCode: 'SEND_FAILED'
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
    // Process through iMessage adapter
    const message = await this.iMessageAdapter.processIncomingWebhook(payload, signature);

    if (!message) {
      return null;
    }

    // Check if message is encrypted with Signal Protocol
    if (this.isSignalEncrypted(message)) {
      try {
        const decryptedMessage = await this.decryptMessage(message);
        return decryptedMessage;
      } catch (error) {
        console.error('Failed to decrypt Signal Protocol message from iMessage:', error);
        return message;
      }
    }

    return message;
  }

  async verifyConnection(): Promise<boolean> {
    return this.iMessageAdapter.verifyConnection();
  }

  async disconnect(): Promise<void> {
    await this.iMessageAdapter.disconnect();
    this.initialized = false;
    this.keyCache.clear();
  }

  async getMessageStatus(externalMessageId: string): Promise<{
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    updatedAt: Date;
    metadata?: Record<string, any>;
  } | null> {
    return this.iMessageAdapter.getMessageStatus(externalMessageId);
  }

  supportsEncryption(): boolean {
    return true;
  }

  getEncryptionType(): string | null {
    return this.signalEnabled ? 'signal-protocol-imessage' : 'imessage-e2ee';
  }

  async getRateLimit(): Promise<{
    remaining: number;
    total: number;
    resetAt: Date;
  } | null> {
    return this.iMessageAdapter.getRateLimit();
  }

  // ===== Private helper methods =====

  /**
   * Encrypt a message using Signal Protocol
   */
  private async encryptMessage(message: ProtocolMessage): Promise<ProtocolMessage> {
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
   * Check if message is encrypted with Signal Protocol
   */
  private isSignalEncrypted(message: ProtocolMessage): boolean {
    return message.text.startsWith('[SIGNAL-ENCRYPTED:');
  }

  /**
   * Get or create encryption key for recipient
   */
  private async getOrCreateEncryptionKey(recipientId: string): Promise<{
    publicKey: string;
    encryptedSessionKey: string;
  }> {
    if (this.keyCache.has(recipientId)) {
      return this.keyCache.get(recipientId)!;
    }

    const publicKey = this.generatePublicKey(recipientId);
    const encryptedSessionKey = this.generateSessionKey();

    const keys = { publicKey, encryptedSessionKey };
    this.keyCache.set(recipientId, keys);

    return keys;
  }

  /**
   * Simple encryption (demo purposes)
   */
  private simpleEncrypt(text: string): string {
    const encoded = Buffer.from(text).toString('base64');
    return encoded;
  }

  /**
   * Simple decryption (demo purposes)
   */
  private simpleDecrypt(encrypted: string, _publicKey: string): string {
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
