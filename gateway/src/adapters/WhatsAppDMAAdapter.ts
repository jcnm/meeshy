/**
 * WhatsApp DMA (Direct Message API) Adapter
 *
 * Implements the ProtocolAdapter interface for WhatsApp Business API integration
 * Supports end-to-end encryption via Signal Protocol
 */

import crypto from 'crypto';
import {
  IProtocolAdapter,
  ProtocolAdapterConfig,
  ProtocolAdapterOutcome,
  ProtocolMessage
} from './ProtocolAdapter';

export interface WhatsAppDMAConfig extends ProtocolAdapterConfig {
  phoneNumberId: string;
  businessAccountId: string;
  apiKey: string;
  webhookSecret: string;
  accessToken?: string;
  apiVersion?: string;
}

export interface WhatsAppMessage {
  id?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'template';
  text?: {
    body: string;
    preview_url?: boolean;
  };
  image?: {
    link: string;
    caption?: string;
  };
  video?: {
    link: string;
    caption?: string;
  };
  audio?: {
    link: string;
  };
  document?: {
    link: string;
    filename?: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
      policy?: string;
    };
    parameters?: {
      body: {
        parameters: Array<{ type: string; text: string }>;
      };
    };
  };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; sha256: string };
          video?: { id: string; mime_type: string; sha256: string };
          audio?: { id: string; mime_type: string };
          document?: {
            id: string;
            mime_type: string;
            sha256: string;
            filename: string;
          };
          media?: { id: string };
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id?: string;
          errors?: Array<{ code: number; message: string; error_data: any }>;
        }>;
      };
      field: string;
    }>;
  }>;
}

/**
 * Retry configuration for exponential backoff
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

export class WhatsAppDMAAdapter implements IProtocolAdapter {
  readonly protocol = 'whatsapp-dma';

  private config?: WhatsAppDMAConfig;
  private initialized = false;
  private baseUrl = 'https://graph.instagram.com';
  private apiVersion = 'v18.0';
  private messageStatusCache = new Map<string, any>();

  // Retry configuration with exponential backoff
  private retryConfig: RetryConfig = {
    maxRetries: 5,
    initialDelayMs: 100, // Start with 100ms
    maxDelayMs: 32000, // Cap at 32 seconds
    backoffMultiplier: 2, // Double delay each retry
    jitterFactor: 0.1 // 10% jitter to prevent thundering herd
  };

  async configure(config: ProtocolAdapterConfig): Promise<void> {
    if (!config.phoneNumberId || !config.businessAccountId || !config.apiKey) {
      throw new Error('WhatsApp DMA requires phoneNumberId, businessAccountId, and apiKey');
    }

    this.config = {
      ...config,
      apiVersion: config.apiVersion || 'v18.0'
    } as WhatsAppDMAConfig;

    this.apiVersion = this.config.apiVersion || 'v18.0';
    this.initialized = true;
  }

  isConfigured(): boolean {
    return this.initialized && !!this.config;
  }

  async sendMessage(message: ProtocolMessage): Promise<ProtocolAdapterOutcome> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'WhatsApp adapter not configured',
        errorCode: 'NOT_CONFIGURED'
      };
    }

    try {
      return await this.sendMessageWithRetry(message, 0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        errorCode: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Send message with exponential backoff retry logic
   * Retries on transient errors (network issues, rate limits, temporary failures)
   */
  private async sendMessageWithRetry(
    message: ProtocolMessage,
    attemptNumber: number
  ): Promise<ProtocolAdapterOutcome> {
    const whatsappMessage = this.convertToWhatsAppMessage(message);
    const endpoint = `${this.baseUrl}/${this.apiVersion}/${this.config!.phoneNumberId}/messages`;

    try {
      console.log(`📤 WhatsApp send attempt ${attemptNumber + 1}/${this.retryConfig.maxRetries + 1}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config!.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: message.recipientPhoneNumber || message.recipientId,
          type: whatsappMessage.type,
          ...whatsappMessage
        })
      });

      const data: any = await response.json();

      // Success case
      if (response.ok) {
        // Cache message status
        if (data.messages?.[0]?.id) {
          this.messageStatusCache.set(data.messages[0].id, {
            status: 'sent',
            timestamp: new Date(),
            externalMessageId: data.messages[0].id
          });
        }

        console.log(`✅ Message sent successfully on attempt ${attemptNumber + 1}`);
        return {
          success: true,
          messageId: message.protocolMessageId,
          externalMessageId: data.messages?.[0]?.id,
          metadata: {
            contacts: data.contacts,
            messaging_product: 'whatsapp',
            retryAttempts: attemptNumber
          }
        };
      }

      // Check if error is retryable
      const errorCode = data.error?.code;
      const isRetryable = this.isRetryableError(response.status, errorCode);

      if (isRetryable && attemptNumber < this.retryConfig.maxRetries) {
        const delayMs = this.calculateExponentialBackoff(attemptNumber);
        console.warn(
          `⚠️  Retryable error (${response.status}/${errorCode}), ` +
          `waiting ${delayMs}ms before retry...`
        );

        await this.sleep(delayMs);
        return this.sendMessageWithRetry(message, attemptNumber + 1);
      }

      // Non-retryable or max retries exceeded
      console.error(`❌ Send failed: ${data.error?.message || 'Unknown error'}`);
      return {
        success: false,
        error: data.error?.message || 'Failed to send message',
        errorCode: data.error?.code?.toString() || 'SEND_FAILED',
        metadata: {
          ...data.error,
          retryAttempts: attemptNumber,
          isRetryable
        }
      };
    } catch (error) {
      // Network error - potentially retryable
      if (attemptNumber < this.retryConfig.maxRetries) {
        const delayMs = this.calculateExponentialBackoff(attemptNumber);
        console.warn(
          `⚠️  Network error (${error instanceof Error ? error.message : 'unknown'}), ` +
          `waiting ${delayMs}ms before retry...`
        );

        await this.sleep(delayMs);
        return this.sendMessageWithRetry(message, attemptNumber + 1);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Send failed after ${attemptNumber + 1} attempts: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   * Formula: min(maxDelay, initialDelay * (multiplier ^ attempt) * (1 ± jitter))
   */
  private calculateExponentialBackoff(attemptNumber: number): number {
    const exponentialDelay = this.retryConfig.initialDelayMs *
      Math.pow(this.retryConfig.backoffMultiplier, attemptNumber);

    const cappedDelay = Math.min(exponentialDelay, this.retryConfig.maxDelayMs);

    // Add random jitter (±10%) to prevent thundering herd
    const jitterAmount = cappedDelay * this.retryConfig.jitterFactor;
    const jitter = (Math.random() - 0.5) * 2 * jitterAmount;

    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Determine if error is retryable (transient)
   * Retryable: 429 (rate limit), 500-599 (server errors), network timeouts
   * Non-retryable: 401 (auth), 403 (forbidden), 400 (bad request)
   */
  private isRetryableError(statusCode: number, errorCode?: number): boolean {
    // HTTP status codes that are retryable
    if (statusCode === 429 || statusCode >= 500) {
      return true;
    }

    // WhatsApp API error codes that are retryable
    const retryableErrorCodes = [
      80003, // Rate limiting
      80005, // Not available
      80007, // Not allowed
    ];

    if (errorCode && retryableErrorCodes.includes(errorCode)) {
      return true;
    }

    return false;
  }

  /**
   * Sleep helper for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendBulkMessages(messages: ProtocolMessage[]): Promise<ProtocolAdapterOutcome[]> {
    return Promise.all(messages.map(msg => this.sendMessage(msg)));
  }

  async processIncomingWebhook(
    payload: Record<string, any>,
    signature?: string
  ): Promise<ProtocolMessage | null> {
    // Verify webhook signature
    if (signature && this.config?.webhookSecret) {
      if (!this.verifyWebhookSignature(payload, signature)) {
        throw new Error('Invalid webhook signature');
      }
    }

    const whatsappPayload = payload as WhatsAppWebhookPayload;

    // Handle webhook verification
    if (payload.hub?.mode === 'subscribe') {
      return null;
    }

    if (!whatsappPayload.entry?.[0]?.changes?.[0]?.value?.messages) {
      return null;
    }

    const message = whatsappPayload.entry[0].changes[0].value.messages[0];
    const contact = whatsappPayload.entry[0].changes[0].value.contacts?.[0];
    const metadata = whatsappPayload.entry[0].changes[0].value.metadata;

    // Extract media attachments
    const media = await this.extractMediaFromMessage(message);

    return {
      protocolMessageId: message.id,
      senderId: message.from,
      senderPhoneNumber: message.from,
      senderName: contact?.profile?.name || `User ${message.from}`,
      recipientId: metadata?.display_phone_number || 'unknown',
      recipientPhoneNumber: metadata?.display_phone_number,
      text: message.text?.body || '',
      media,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      isEncrypted: false, // Will be set if Signal Protocol is used
      encryptionType: undefined,
      metadata: {
        type: message.type,
        waId: contact?.wa_id,
        phoneNumberId: metadata?.phone_number_id,
        messaging_product: 'whatsapp',
        rawMessage: message
      }
    };
  }

  async processStatusUpdate(
    payload: Record<string, any>
  ): Promise<{ messageId: string; status: string; timestamp: Date } | null> {
    const whatsappPayload = payload as WhatsAppWebhookPayload;

    if (!whatsappPayload.entry?.[0]?.changes?.[0]?.value?.statuses) {
      return null;
    }

    const status = whatsappPayload.entry[0].changes[0].value.statuses[0];

    // Update cache
    this.messageStatusCache.set(status.id, {
      status: status.status,
      timestamp: new Date(parseInt(status.timestamp) * 1000),
      recipientId: status.recipient_id
    });

    return {
      messageId: status.id,
      status: status.status,
      timestamp: new Date(parseInt(status.timestamp) * 1000)
    };
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${this.config!.phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`
          }
        }
      );

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.config = undefined;
    this.initialized = false;
    this.messageStatusCache.clear();
  }

  async getMessageStatus(externalMessageId: string): Promise<{
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    updatedAt: Date;
    metadata?: Record<string, any>;
  } | null> {
    const cached = this.messageStatusCache.get(externalMessageId);
    if (cached) {
      return {
        status: cached.status,
        updatedAt: cached.timestamp,
        metadata: cached
      };
    }

    return null;
  }

  supportsEncryption(): boolean {
    return true; // WhatsApp supports end-to-end encryption
  }

  getEncryptionType(): string | null {
    return 'whatsapp-e2ee'; // WhatsApp's built-in encryption
  }

  async getRateLimit(): Promise<{
    remaining: number;
    total: number;
    resetAt: Date;
  } | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${this.config!.phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`
          }
        }
      );

      const headers = response.headers;
      const remaining = parseInt(headers.get('x-app-usage-[app_id]-rate-limit-remaining') || '0');
      const total = parseInt(headers.get('x-app-usage-[app_id]-rate-limit-total') || '60');

      return {
        remaining,
        total,
        resetAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      };
    } catch (error) {
      return null;
    }
  }

  // Private helper methods

  private convertToWhatsAppMessage(message: ProtocolMessage): WhatsAppMessage {
    const whatsappMessage: WhatsAppMessage = {
      type: 'text'
    };

    // Handle text content
    if (message.text) {
      whatsappMessage.type = 'text';
      whatsappMessage.text = {
        body: message.text,
        preview_url: false
      };
    }

    // Handle media attachments
    if (message.media && message.media.length > 0) {
      const firstMedia = message.media[0];
      switch (firstMedia.type) {
        case 'image':
          whatsappMessage.type = 'image';
          whatsappMessage.image = {
            link: firstMedia.url,
            caption: message.text
          };
          break;
        case 'video':
          whatsappMessage.type = 'video';
          whatsappMessage.video = {
            link: firstMedia.url,
            caption: message.text
          };
          break;
        case 'audio':
          whatsappMessage.type = 'audio';
          whatsappMessage.audio = {
            link: firstMedia.url
          };
          break;
        case 'document':
        case 'file':
          whatsappMessage.type = 'document';
          whatsappMessage.document = {
            link: firstMedia.url,
            filename: firstMedia.fileName
          };
          break;
      }
    }

    return whatsappMessage;
  }

  private async extractMediaFromMessage(message: any) {
    const media = [];

    if (message.image) {
      media.push({
        type: 'image' as const,
        url: message.image.link || '',
        mimeType: message.image.mime_type,
        size: message.image.file_size
      });
    }

    if (message.video) {
      media.push({
        type: 'video' as const,
        url: message.video.link || '',
        mimeType: message.video.mime_type,
        size: message.video.file_size
      });
    }

    if (message.audio) {
      media.push({
        type: 'audio' as const,
        url: message.audio.link || '',
        mimeType: message.audio.mime_type
      });
    }

    if (message.document) {
      media.push({
        type: 'document' as const,
        url: message.document.link || '',
        fileName: message.document.filename,
        mimeType: message.document.mime_type,
        size: message.document.file_size
      });
    }

    return media;
  }

  private verifyWebhookSignature(payload: Record<string, any>, signature: string): boolean {
    if (!this.config?.webhookSecret) {
      return false;
    }

    const payloadString = JSON.stringify(payload);
    const hash = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payloadString)
      .digest('hex');

    return hash === signature;
  }
}
