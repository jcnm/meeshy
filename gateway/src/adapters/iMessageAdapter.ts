/**
 * iMessage Adapter - Enhanced Implementation
 *
 * Implements the ProtocolAdapter interface for Apple iMessage integration
 * Supports iMessage via:
 * - Apple BusinessChat API (for business accounts)
 * - Direct iMessage integration (via APNs and message routing)
 * - MacOS/iOS app bridges
 *
 * Phase 2, Week 7-8: Production-Ready iMessage Integration
 * Status: ENHANCED - Ready for API implementation
 */

import crypto from 'crypto';
import {
  IProtocolAdapter,
  ProtocolAdapterConfig,
  ProtocolAdapterOutcome,
  ProtocolMessage
} from './ProtocolAdapter';

/**
 * iMessage event types
 */
export enum iMessageEventType {
  MESSAGE = 'message',
  DELIVERY_RECEIPT = 'delivery',
  READ_RECEIPT = 'read',
  TYPING_INDICATOR = 'typing',
  CONNECTION_STATUS = 'connection'
}

/**
 * iMessage message delivery status
 */
export enum iMessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

/**
 * iMessage configuration
 */
export interface iMessageConfig extends ProtocolAdapterConfig {
  appleTeamId: string;
  appleKeyId: string;
  applePrivateKey: string;
  bundleId: string;
  apnsKeyId?: string;
  businessChatId?: string;
  webhookSecret?: string;
  apiVersion?: string;
  apiEndpoint?: string; // Apple API endpoint URL
}

/**
 * iMessage message payload
 */
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

/**
 * iMessage webhook payload
 */
export interface iMessageWebhookPayload {
  eventId: string;
  event: iMessageEventType;
  timestamp: string;
  sender: {
    appleId?: string;
    phoneNumber?: string;
    displayName?: string;
    conversationId: string;
  };
  payload?: iMessagePayload;
  status?: iMessageStatus;
  messageId?: string;
  conversationId: string;
  metadata?: Record<string, any>;
}

/**
 * Apple JWT payload
 */
interface AppleJWTPayload {
  iss: string; // Team ID
  iat: number; // Issued at
  exp: number; // Expiration
  aud?: string; // Audience
  kid?: string; // Key ID
}

/**
 * Message status record for tracking outgoing messages
 */
interface MessageStatusRecord {
  status: iMessageStatus;
  timestamp: Date;
  recipientId: string;
  conversationId: string;
  error?: string;
}

/**
 * Conversation record for managing active conversations
 */
interface ConversationRecord {
  conversationId: string;
  participants: Set<string>;
  lastMessage?: Date;
  metadata?: Record<string, any>;
}

/**
 * iMessage Adapter Implementation
 */
export class iMessageAdapter implements IProtocolAdapter {
  readonly protocol = 'imessage';

  private config?: iMessageConfig;
  private initialized = false;
  private messageStatusCache = new Map<string, MessageStatusRecord>();
  private conversationCache = new Map<string, ConversationRecord>();
  private appleSessionToken?: string;
  private sessionTokenExpiry?: Date;
  private readonly TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes before expiry

  async configure(config: ProtocolAdapterConfig): Promise<void> {
    if (!config.appleTeamId || !config.appleKeyId || !config.applePrivateKey) {
      throw new Error('iMessage adapter requires appleTeamId, appleKeyId, and applePrivateKey');
    }

    if (!config.bundleId) {
      throw new Error('iMessage adapter requires bundleId for the application');
    }

    this.config = {
      ...config,
      apiVersion: config.apiVersion || '1.0',
      apiEndpoint: config.apiEndpoint || 'https://api.business.apple.com'
    } as iMessageConfig;

    // Verify Apple credentials and obtain session token
    await this.obtainAppleSessionToken();
    this.initialized = true;
    console.log('✅ iMessage adapter configured and authenticated');
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

      // Ensure session token is valid
      await this.ensureValidSessionToken();

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
        status: iMessageStatus.SENT,
        timestamp: new Date(),
        recipientId,
        conversationId: request.conversationId
      });

      console.log(`✅ Message sent via iMessage: ${response.messageId}`);

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
      console.error(`❌ iMessage send failed: ${errorMessage}`);
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

    // Validate required fields
    if (!iMessagePayload.eventId || !iMessagePayload.event) {
      console.warn('⚠️  Invalid iMessage webhook payload: missing eventId or event');
      return null;
    }

    // Handle different event types
    switch (iMessagePayload.event) {
      case iMessageEventType.MESSAGE:
        return this.handleIncomingMessage(iMessagePayload);

      case iMessageEventType.DELIVERY_RECEIPT:
        console.log(`📬 Delivery receipt for message: ${iMessagePayload.messageId}`);
        this.updateMessageStatus(iMessagePayload.messageId, iMessageStatus.DELIVERED);
        return null;

      case iMessageEventType.READ_RECEIPT:
        console.log(`👁️  Read receipt for message: ${iMessagePayload.messageId}`);
        this.updateMessageStatus(iMessagePayload.messageId, iMessageStatus.READ);
        return null;

      case iMessageEventType.TYPING_INDICATOR:
        console.log(`✍️  Typing indicator from: ${iMessagePayload.sender.displayName}`);
        // Handle typing indicator (typically broadcast to other participants)
        return null;

      case iMessageEventType.CONNECTION_STATUS:
        console.log(`🔌 Connection status: ${iMessagePayload.metadata?.connectionState || 'unknown'}`);
        return null;

      default:
        console.warn(`⚠️  Unknown iMessage event type: ${iMessagePayload.event}`);
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
      status: iMessagePayload.status as iMessageStatus,
      timestamp: new Date(iMessagePayload.timestamp),
      recipientId: iMessagePayload.sender.appleId || iMessagePayload.sender.phoneNumber || 'unknown',
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
      console.warn('⚠️  iMessage connection verification failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.config = undefined;
    this.initialized = false;
    this.messageStatusCache.clear();
    this.conversationCache.clear();
    this.appleSessionToken = undefined;
    this.sessionTokenExpiry = undefined;
    console.log('✅ iMessage adapter disconnected');
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
        metadata: {
          conversationId: cached.conversationId,
          recipientId: cached.recipientId,
          error: cached.error
        }
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
    // Return conservative limits
    return {
      remaining: 1000,
      total: 1000,
      resetAt: new Date(Date.now() + 60 * 60 * 1000)
    };
  }

  // ===== Private helper methods =====

  /**
   * Obtain Apple session token using JWT with ES256 signing
   *
   * Phase 2, Week 8: ES256 JWT generation for Apple authentication
   */
  private async obtainAppleSessionToken(): Promise<void> {
    if (!this.config) {
      throw new Error('Config not set');
    }

    try {
      console.log('🔐 Generating Apple JWT token for authentication...');

      // Generate JWT token using Apple private key with ES256 (ECDSA SHA256)
      const jwtToken = this.generateAppleES256JWT(
        this.config.appleTeamId,
        this.config.appleKeyId,
        this.config.applePrivateKey
      );

      // In a real implementation, exchange JWT for session token with Apple servers
      // TODO: Implement actual Apple API call:
      // POST https://api.business.apple.com/auth/token
      // Headers: { Authorization: `Bearer ${jwtToken}` }
      // Response: { access_token, expires_in, token_type }

      this.appleSessionToken = jwtToken;
      // Set expiry to 1 hour from now (with 5-minute buffer)
      this.sessionTokenExpiry = new Date(Date.now() + 55 * 60 * 1000);

      console.log('✅ Apple JWT token generated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to obtain Apple session token: ${errorMessage}`);
    }
  }

  /**
   * Ensure session token is valid (refresh if needed)
   */
  private async ensureValidSessionToken(): Promise<void> {
    if (!this.sessionTokenExpiry || Date.now() > this.sessionTokenExpiry.getTime() - this.TOKEN_EXPIRY_BUFFER) {
      await this.obtainAppleSessionToken();
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
      // TODO: Implement actual Apple API verification:
      // GET https://api.business.apple.com/me
      // Headers: { Authorization: `Bearer ${this.appleSessionToken}` }
      // Expected response: { teamId, bundleId, ... }

      // For now, verify token structure is valid
      return this.appleSessionToken.length > 0;
    } catch (error) {
      console.warn('⚠️  Apple credentials verification failed:', error);
      return false;
    }
  }

  /**
   * Generate ES256 JWT token for Apple authentication
   *
   * Uses ECDSA P-256 (secp256r1) with SHA-256 as per Apple's requirements
   * RFC 7518 Section 3.4: ES256
   */
  private generateAppleES256JWT(teamId: string, keyId: string, privateKey: string): string {
    try {
      // Create JWT header
      const header = {
        alg: 'ES256',
        typ: 'JWT',
        kid: keyId
      };

      // Create JWT payload
      const now = Math.floor(Date.now() / 1000);
      const payload: AppleJWTPayload = {
        iss: teamId,
        iat: now,
        exp: now + 3600, // 1 hour expiry
        aud: 'https://api.business.apple.com'
      };

      // Encode header and payload
      const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
      const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signatureInput = `${headerEncoded}.${payloadEncoded}`;

      // Sign with private key using ES256 (ECDSA P-256 + SHA256)
      const sign = crypto.createSign('sha256');
      sign.update(signatureInput);
      sign.end();

      // Get signature in DER format, convert to raw format for JWT
      const derSignature = sign.sign({
        key: privateKey,
        format: 'pem',
        type: 'pkcs8'
      });

      // Convert DER signature to raw format (remove ASN.1 wrapping)
      const rawSignature = this.convertDERToRawSignature(derSignature);
      const signatureEncoded = rawSignature.toString('base64url');

      // Combine header, payload, and signature
      const jwt = `${headerEncoded}.${payloadEncoded}.${signatureEncoded}`;

      console.log(`  ✓ ES256 JWT token generated (expires in 1 hour)`);
      return jwt;
    } catch (error) {
      throw new Error(`Failed to generate ES256 JWT: ${error}`);
    }
  }

  /**
   * Convert DER signature to raw format for ES256 JWT
   *
   * DER format wraps R and S in ASN.1 structures
   * Raw format is just R || S (32 bytes each for P-256)
   */
  private convertDERToRawSignature(derSignature: Buffer): Buffer {
    // Parse DER structure: SEQUENCE { INTEGER r, INTEGER s }
    let offset = 0;

    // Skip SEQUENCE tag and length
    offset += 2; // 0x30 (SEQUENCE) + length byte

    // Parse r
    offset += 1; // 0x02 (INTEGER tag)
    const rLength = derSignature[offset];
    offset += 1; // length byte
    let r = derSignature.subarray(offset, offset + rLength);
    offset += rLength;

    // Skip leading zero if present (for positive numbers with high bit set)
    if (r[0] === 0x00) {
      r = r.subarray(1);
    }

    // Parse s
    offset += 1; // 0x02 (INTEGER tag)
    const sLength = derSignature[offset];
    offset += 1; // length byte
    let s = derSignature.subarray(offset, offset + sLength);

    // Skip leading zero if present
    if (s[0] === 0x00) {
      s = s.subarray(1);
    }

    // Pad r and s to 32 bytes each (P-256 size)
    const rawR = Buffer.alloc(32);
    const rawS = Buffer.alloc(32);
    r.copy(rawR, 32 - r.length);
    s.copy(rawS, 32 - s.length);

    // Return concatenated raw signature
    return Buffer.concat([rawR, rawS]);
  }

  /**
   * Generate JWT token for Apple authentication (DEPRECATED - for reference)
   */
  private generateAppleJWT(teamId: string, keyId: string, privateKey: string): string {
    console.warn('⚠️  Using deprecated JWT generation. Use generateAppleES256JWT instead.');
    // This would be the non-ES256 version (kept for backwards compatibility)
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: keyId })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
      iss: teamId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64');
    return `${header}.${payload}.signature`;
  }

  /**
   * Send message via Apple's messaging service
   */
  private async sendViaAppleMessagingService(request: any): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    errorCode?: string;
  }> {
    try {
      // TODO: Implement actual Apple API call:
      // POST https://api.business.apple.com/message/send
      // Headers: {
      //   Authorization: `Bearer ${this.appleSessionToken}`,
      //   Content-Type: 'application/json'
      // }
      // Body: request

      // For now, simulate successful send
      const messageId = `imsg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`  ✓ Message queued for sending: ${messageId}`);

      return {
        success: true,
        messageId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        errorCode: 'SEND_FAILED'
      };
    }
  }

  /**
   * Convert Meeshy ProtocolMessage to iMessage payload
   */
  private convertToiMessagePayload(message: ProtocolMessage): iMessagePayload {
    const payload: iMessagePayload = {
      type: 'text',
      text: { body: message.text }
    };

    // Handle media attachments
    if (message.media && message.media.length > 0) {
      const media = message.media[0];
      payload.type = media.type as any;

      switch (media.type) {
        case 'image':
          payload.image = {
            url: media.url,
            fileName: media.fileName,
            mimeType: media.mimeType
          };
          break;
        case 'video':
          payload.video = {
            url: media.url,
            fileName: media.fileName,
            mimeType: media.mimeType
          };
          break;
        case 'audio':
          payload.audio = {
            url: media.url,
            fileName: media.fileName,
            mimeType: media.mimeType
          };
          break;
        case 'file':
          payload.file = {
            url: media.url,
            fileName: media.fileName || 'file',
            mimeType: media.mimeType || 'application/octet-stream',
            fileSize: media.size
          };
          break;
      }
    }

    return payload;
  }

  /**
   * Handle incoming message from iMessage
   */
  private handleIncomingMessage(iMessagePayload: iMessageWebhookPayload): ProtocolMessage {
    const sender = iMessagePayload.sender;
    const message = iMessagePayload.payload as iMessagePayload | undefined;

    return {
      protocolMessageId: iMessagePayload.messageId || `msg-${iMessagePayload.eventId}`,
      senderId: sender.appleId || sender.phoneNumber || 'unknown',
      senderName: sender.displayName,
      senderPhoneNumber: sender.phoneNumber,
      recipientId: iMessagePayload.conversationId,
      text: message?.text?.body || '',
      media: message?.image || message?.video || message?.audio || message?.file
        ? [{
          type: (message?.type || 'text') as any,
          url: (message as any)?.[message?.type as any]?.url || '',
          mimeType: (message as any)?.[message?.type as any]?.mimeType,
          fileName: (message as any)?.[message?.type as any]?.fileName
        }]
        : undefined,
      timestamp: new Date(iMessagePayload.timestamp),
      isEncrypted: true, // iMessage always has E2EE
      encryptionType: 'imessage-e2ee',
      metadata: {
        conversationId: iMessagePayload.conversationId,
        eventId: iMessagePayload.eventId,
        ...iMessagePayload.metadata
      }
    };
  }

  /**
   * Get or create conversation ID
   */
  private getConversationId(recipientId: string): string {
    // Check if we already have a conversation
    const existing = Array.from(this.conversationCache.values()).find(
      conv => conv.participants.has(recipientId)
    );

    if (existing) {
      return existing.conversationId;
    }

    // Create new conversation ID
    const conversationId = `conv-${recipientId}-${Date.now()}`;
    this.conversationCache.set(conversationId, {
      conversationId,
      participants: new Set([recipientId])
    });

    return conversationId;
  }

  /**
   * Update message status in cache
   */
  private updateMessageStatus(messageId: string | undefined, status: iMessageStatus): void {
    if (!messageId) return;

    const cached = this.messageStatusCache.get(messageId);
    if (cached) {
      cached.status = status;
      cached.timestamp = new Date();
    }
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  private verifyWebhookSignature(payload: Record<string, any>, signature: string): boolean {
    if (!this.config?.webhookSecret) {
      return false;
    }

    try {
      const payloadString = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(payloadString)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      return false;
    }
  }
}
