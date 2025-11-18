/**
 * Protocol Adapter Interface
 *
 * Defines the interface for integrating different messaging protocols
 * (WhatsApp, iMessage, Telegram, Signal, etc.) with Meeshy
 */

export interface ProtocolMessage {
  // Protocol-specific message identifier
  protocolMessageId: string;

  // Sender information
  senderId: string;
  senderName?: string;
  senderPhoneNumber?: string;
  senderEmail?: string;

  // Recipient information
  recipientId: string;
  recipientPhoneNumber?: string;
  recipientEmail?: string;

  // Message content
  text: string;

  // Media attachments
  media?: {
    type: 'image' | 'video' | 'audio' | 'document' | 'file';
    url: string;
    mimeType?: string;
    fileName?: string;
    size?: number;
  }[];

  // Message metadata
  timestamp: Date;
  isEncrypted: boolean;
  encryptionType?: string;

  // Protocol-specific metadata
  metadata: Record<string, any>;
}

export interface ProtocolAdapterConfig {
  enabled: boolean;
  apiKey: string;
  apiSecret?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  phoneNumberId?: string;
  businessAccountId?: string;

  // Optional configuration
  [key: string]: any;
}

export interface ProtocolAdapterOutcome {
  success: boolean;
  messageId?: string;
  externalMessageId?: string;
  error?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
}

export interface IProtocolAdapter {
  // Protocol identifier
  readonly protocol: string;

  // Configuration
  configure(config: ProtocolAdapterConfig): Promise<void>;
  isConfigured(): boolean;

  // Message sending
  sendMessage(message: ProtocolMessage): Promise<ProtocolAdapterOutcome>;
  sendBulkMessages(messages: ProtocolMessage[]): Promise<ProtocolAdapterOutcome[]>;

  // Message receiving (webhook handling)
  processIncomingWebhook(payload: Record<string, any>, signature?: string): Promise<ProtocolMessage | null>;

  // Connection management
  verifyConnection(): Promise<boolean>;
  disconnect(): Promise<void>;

  // Message status tracking
  getMessageStatus(externalMessageId: string): Promise<{
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    updatedAt: Date;
    metadata?: Record<string, any>;
  } | null>;

  // Encryption support
  supportsEncryption(): boolean;
  getEncryptionType(): string | null;

  // Rate limiting and quotas
  getRateLimit(): Promise<{
    remaining: number;
    total: number;
    resetAt: Date;
  } | null>;
}
