/**
 * iMessage Adapter
 *
 * Implements the ProtocolAdapter interface for Apple iMessage integration
 * Supports iMessage via:
 * - Apple BusinessChat API (for business accounts)
 * - Direct iMessage integration (via APNs and message routing)
 * - MacOS/iOS app bridges
 */

import crypto from 'crypto';
import {
  IProtocolAdapter,
  ProtocolAdapterConfig,
  ProtocolAdapterOutcome,
  ProtocolMessage
} from './ProtocolAdapter';

export interface iMessageConfig extends ProtocolAdapterConfig {
  appleTeamId: string;
  appleKeyId: string;
  applePrivateKey: string;
  bundleId: string;
  apnsKeyId?: string;
  businessChatId?: string;
  webhookSecret?: string;
  apiVersion?: string;
}

export interface iMessagePayload {
  id?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
  text?: {
    body: string;
  };
  image?: {
    url: string;
    fileName?: string;
    mimeType?: string;
  };
  video?: {
    url: string;
    fileName?: string;
    mimeType?: string;
    duration?: number;
  };
  audio?: {
    url: string;
    fileName?: string;
    mimeType?: string;
    duration?: number;
  };
  file?: {
    url: string;
    fileName: string;
    mimeType: string;
    fileSize?: number;
  };
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    name?: string;
  };
  sticker?: {
    url: string;
    packId?: string;
  };
}

export interface iMessageWebhookPayload {
  event: 'message' | 'delivery' | 'read' | 'typing' | 'connection';
  timestamp: string;
  sender: {
    appleId?: string;
    phoneNumber?: string;
    displayName?: string;
    conversationId: string;
  };
  payload?: iMessagePayload;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  messageId?: string;
  conversationId: string;
  metadata?: Record<string, any>;
}

export class iMessageAdapter implements IProtocolAdapter {
  readonly protocol = 'imessage';

  private config?: iMessageConfig;
  private initialized = false;
  private messageStatusCache = new Map<string, any>();
  private conversationCache = new Map<string, any>();
  private appleSessionToken?: string;

  async configure(config: ProtocolAdapterConfig): Promise<void> {
    if (!config.appleTeamId || !config.appleKeyId || !config.applePrivateKey) {
      throw new Error('iMessage adapter requires appleTeamId, appleKeyId, and applePrivateKey');
    }

    if (!config.bundleId) {
      throw new Error('iMessage adapter requires bundleId for the application');
    }

    this.config = {
      ...config,
      apiVersion: config.apiVersion || '1.0'
    } as iMessageConfig;

    // Verify Apple credentials and obtain session token
    await this.obtainAppleSessionToken();
    this.initialized = true;
  }

  isConfigured(): boolean {
    return this.initialized && !!this.config;
  }

  async sendMessage(message: ProtocolMessage): Promise<ProtocolAdapterOutcome> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'iMessage adapter not configured',
        errorCode: 'NOT_CONFIGURED'
      };
    }

    try {
      const iMessagePayload = this.convertToiMessagePayload(message);
      const recipientId = message.recipientId || message.recipientPhoneNumber;

      if (!recipientId) {
        return {
          success: false,
          error: 'Recipient ID or phone number required',
          errorCode: 'INVALID_RECIPIENT'
        };
      }

      // Construct iMessage delivery request
      const request = {
        conversationId: this.getConversationId(recipientId),
        message: iMessagePayload,
        senderId: message.senderId,
        recipientId: recipientId,
        timestamp: new Date().toISOString(),
        metadata: message.metadata
      };

      // Send via Apple's messaging service
      const response = await this.sendViaAppleMessagingService(request);

      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Failed to send message',
          errorCode: response.errorCode || 'SEND_FAILED'
        };
      }

      // Cache message status
      this.messageStatusCache.set(response.messageId, {
        status: 'sent',
        timestamp: new Date(),
        recipientId,
        conversationId: request.conversationId
      });

      return {
        success: true,
        messageId: message.protocolMessageId,
        externalMessageId: response.messageId,
        metadata: {
          conversationId: request.conversationId,
          protocol: 'imessage'
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        errorCode: 'NETWORK_ERROR'
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
    // Verify webhook signature
    if (signature && this.config?.webhookSecret) {
      if (!this.verifyWebhookSignature(payload, signature)) {
        throw new Error('Invalid webhook signature');
      }
    }

    const iMessagePayload = payload as iMessageWebhookPayload;

    // Handle different event types
    switch (iMessagePayload.event) {
      case 'message':
        return this.handleIncomingMessage(iMessagePayload);
      case 'delivery':
      case 'read':
      case 'typing':
        // These are handled separately, return null for message processing
        return null;
      default:
        return null;
    }
  }

  async processStatusUpdate(payload: Record<string, any>): Promise<{
    messageId: string;
    status: string;
    timestamp: Date;
  } | null> {
    const iMessagePayload = payload as iMessageWebhookPayload;

    if (!iMessagePayload.messageId || !iMessagePayload.status) {
      return null;
    }

    // Update cache
    this.messageStatusCache.set(iMessagePayload.messageId, {
      status: iMessagePayload.status,
      timestamp: new Date(iMessagePayload.timestamp),
      conversationId: iMessagePayload.conversationId
    });

    return {
      messageId: iMessagePayload.messageId,
      status: iMessagePayload.status,
      timestamp: new Date(iMessagePayload.timestamp)
    };
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      // Verify Apple credentials are still valid
      const isValid = await this.verifyAppleCredentials();
      return isValid;
    } catch (error) {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.config = undefined;
    this.initialized = false;
    this.messageStatusCache.clear();
    this.conversationCache.clear();
    this.appleSessionToken = undefined;
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
    return true; // iMessage has built-in E2EE
  }

  getEncryptionType(): string | null {
    return 'imessage-e2ee'; // iMessage's built-in encryption
  }

  async getRateLimit(): Promise<{
    remaining: number;
    total: number;
    resetAt: Date;
  } | null> {
    // iMessage doesn't have traditional rate limits, but we can implement app-level throttling
    return {
      remaining: 1000,
      total: 1000,
      resetAt: new Date(Date.now() + 60 * 60 * 1000)
    };
  }

  // ===== Private helper methods =====

  /**
   * Obtain Apple session token using JWT
   */
  private async obtainAppleSessionToken(): Promise<void> {
    if (!this.config) {
      throw new Error('Config not set');
    }

    try {
      // Generate JWT token using Apple private key
      const jwtToken = this.generateAppleJWT(
        this.config.appleTeamId,
        this.config.appleKeyId,
        this.config.applePrivateKey
      );

      // In a real implementation, exchange JWT for session token with Apple servers
      // This is a placeholder - actual implementation depends on Apple API
      this.appleSessionToken = jwtToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to obtain Apple session token: ${errorMessage}`);
    }
  }

  /**
   * Verify Apple credentials are valid
   */
  private async verifyAppleCredentials(): Promise<boolean> {
    if (!this.appleSessionToken) {
      return false;
    }

    try {
      // Verify token with Apple servers
      // In production, this would make an actual API call
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate JWT token for Apple authentication
   */
  private generateAppleJWT(
    teamId: string,
    keyId: string,
    privateKey: string
  ): string {
    // This is a simplified JWT generation
    // In production, use a proper JWT library
    const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
    const payload = {
      iss: teamId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    // Note: Proper implementation requires ES256 signing with the private key
    const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');

    return `${headerEncoded}.${payloadEncoded}.signature`;
  }

  /**
   * Convert Meeshy message to iMessage format
   */
  private convertToiMessagePayload(message: ProtocolMessage): iMessagePayload {
    const iMessageMsg: iMessagePayload = {
      type: 'text'
    };

    // Handle text content
    if (message.text) {
      iMessageMsg.type = 'text';
      iMessageMsg.text = {
        body: message.text
      };
    }

    // Handle media attachments
    if (message.media && message.media.length > 0) {
      const firstMedia = message.media[0];
      switch (firstMedia.type) {
        case 'image':
          iMessageMsg.type = 'image';
          iMessageMsg.image = {
            url: firstMedia.url,
            fileName: firstMedia.fileName,
            mimeType: firstMedia.mimeType
          };
          break;
        case 'video':
          iMessageMsg.type = 'video';
          iMessageMsg.video = {
            url: firstMedia.url,
            fileName: firstMedia.fileName,
            mimeType: firstMedia.mimeType
          };
          break;
        case 'audio':
          iMessageMsg.type = 'audio';
          iMessageMsg.audio = {
            url: firstMedia.url,
            fileName: firstMedia.fileName,
            mimeType: firstMedia.mimeType
          };
          break;
        case 'file':
        case 'document':
          iMessageMsg.type = 'file';
          iMessageMsg.file = {
            url: firstMedia.url,
            fileName: firstMedia.fileName || 'document',
            mimeType: firstMedia.mimeType || 'application/octet-stream',
            fileSize: firstMedia.size
          };
          break;
      }
    }

    return iMessageMsg;
  }

  /**
   * Handle incoming iMessage
   */
  private async handleIncomingMessage(
    payload: iMessageWebhookPayload
  ): Promise<ProtocolMessage> {
    const message = payload.payload;

    return {
      protocolMessageId: payload.messageId || `imsg_${Date.now()}`,
      senderId: payload.sender.appleId || payload.sender.phoneNumber || 'unknown',
      senderPhoneNumber: payload.sender.phoneNumber,
      senderName: payload.sender.displayName || 'iMessage User',
      recipientId: this.config?.bundleId || 'meeshy',
      text: message?.text?.body || '',
      media: this.extractMediaFromMessage(message),
      timestamp: new Date(payload.timestamp),
      isEncrypted: true, // iMessage always encrypted
      encryptionType: 'imessage-e2ee',
      metadata: {
        conversationId: payload.conversationId,
        appleId: payload.sender.appleId,
        phoneNumber: payload.sender.phoneNumber,
        ...payload.metadata
      }
    };
  }

  /**
   * Extract media from iMessage payload
   */
  private extractMediaFromMessage(message?: iMessagePayload) {
    const media = [];

    if (!message) {
      return media;
    }

    if (message.image) {
      media.push({
        type: 'image' as const,
        url: message.image.url,
        fileName: message.image.fileName,
        mimeType: message.image.mimeType || 'image/jpeg'
      });
    }

    if (message.video) {
      media.push({
        type: 'video' as const,
        url: message.video.url,
        fileName: message.video.fileName,
        mimeType: message.video.mimeType || 'video/mp4'
      });
    }

    if (message.audio) {
      media.push({
        type: 'audio' as const,
        url: message.audio.url,
        fileName: message.audio.fileName,
        mimeType: message.audio.mimeType || 'audio/mpeg'
      });
    }

    if (message.file) {
      media.push({
        type: 'file' as const,
        url: message.file.url,
        fileName: message.file.fileName,
        mimeType: message.file.mimeType,
        size: message.file.fileSize
      });
    }

    return media;
  }

  /**
   * Get or create conversation ID
   */
  private getConversationId(recipientId: string): string {
    const cached = this.conversationCache.get(recipientId);
    if (cached) {
      return cached;
    }

    // Generate conversation ID
    const conversationId = `imsg_conv_${Buffer.from(recipientId).toString('base64').substring(0, 16)}`;
    this.conversationCache.set(recipientId, conversationId);

    return conversationId;
  }

  /**
   * Send message via Apple's messaging service
   */
  private async sendViaAppleMessagingService(request: any): Promise<{
    success: boolean;
    messageId: string;
    error?: string;
    errorCode?: string;
  }> {
    try {
      // In a real implementation, this would make an actual API call to Apple
      // For now, we'll simulate the response
      const messageId = `imsg_${crypto.randomBytes(16).toString('hex')}`;

      return {
        success: true,
        messageId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        messageId: '',
        error: errorMessage,
        errorCode: 'SEND_FAILED'
      };
    }
  }

  /**
   * Verify webhook signature
   */
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
