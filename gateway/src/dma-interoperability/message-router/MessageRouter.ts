/**
 * Message Router for DMA Interoperability
 *
 * Phase 2, Week 8: Message Routing & Orchestration
 * Status: IMPLEMENTATION
 *
 * Responsibilities:
 * - Route incoming XMPP messages to Signal Protocol decryption
 * - Route outgoing app messages to Signal Protocol encryption and XMPP
 * - Track message status (pending, sent, delivered, read, failed)
 * - Manage bidirectional message flow
 * - Handle protocol translation
 *
 * Message Flow:
 *
 * INCOMING (WhatsApp → Meeshy):
 * 1. XMPP receives message from WhatsApp DMA server
 * 2. Noise Protocol transport decryption
 * 3. Extract Signal Protocol encrypted content
 * 4. Signal Protocol decryption
 * 5. Parse message and route to app handlers
 * 6. Send delivery receipt back via XMPP
 *
 * OUTGOING (Meeshy → WhatsApp):
 * 1. App sends message to router
 * 2. Signal Protocol encryption
 * 3. Create XMPP stanza with encrypted content
 * 4. Noise Protocol transport encryption
 * 5. Send via XMPP to WhatsApp DMA server
 * 6. Track message status via XMPP receipts
 */

import { XMPPClient, XMPPStanza } from '../xmpp/XMPPClient';
import { SignalProtocolEngine, EncryptedMessage } from '../signal-protocol/SignalProtocolEngine';
import { NoiseProtocol } from '../noise-protocol/NoiseProtocol';
import { MessageQueue } from './MessageQueue';
import { PrismaClient } from '../../../shared/prisma/client';
import { ProtocolMessage } from '../../adapters/ProtocolAdapter';
import * as crypto from 'crypto';

/**
 * Message status tracking
 */
export interface MessageStatus {
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Router session state
 */
interface RouterSession {
  meeshyUserId: string;
  whatsappAddress: string; // JID or WhatsApp number
  signalSessionId: string;
  noiseSessionId: string;
  createdAt: Date;
  messagesExchanged: number;
}

export class MessageRouter {
  private xmppClient: XMPPClient;
  private signalEngine: SignalProtocolEngine;
  private noiseProtocol: NoiseProtocol;
  private messageQueue: MessageQueue;
  private prisma: PrismaClient;

  // Session management
  private sessions: Map<string, RouterSession> = new Map();
  private sessionsByUser: Map<string, string> = new Map(); // meeshyUserId → sessionId

  // Message tracking
  private messageStatus: Map<string, MessageStatus> = new Map();

  // Legacy in-memory queue (for backward compatibility)
  private legacyMessageQueue: ProtocolMessage[] = [];

  // Statistics
  private stats = {
    messagesRouted: 0,
    messagesEncrypted: 0,
    messagesDecrypted: 0,
    deliveryReceipts: 0,
    routingErrors: 0,
    sessionsActive: 0,
    queuedMessages: 0
  };

  constructor(xmppClient: XMPPClient, signalEngine: SignalProtocolEngine, prisma: PrismaClient) {
    this.xmppClient = xmppClient;
    this.signalEngine = signalEngine;
    this.noiseProtocol = new NoiseProtocol();
    this.messageQueue = new MessageQueue(prisma);
    this.prisma = prisma;

    // Register XMPP message handler
    this.xmppClient.onMessage(this.handleIncomingXMPPMessage.bind(this));

    console.log('✅ Message Router initialized with Message Queue');
  }

  /**
   * Initialize the message router and its components
   */
  async initialize(): Promise<void> {
    try {
      await this.messageQueue.initialize();
      console.log('✅ Message Router and Queue initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Message Router:', error);
      throw error;
    }
  }

  /**
   * Start processing queued messages
   */
  async startQueueProcessing(intervalMs: number = 5000): Promise<void> {
    console.log(`⏰ Starting queue processing every ${intervalMs}ms`);

    const processInterval = setInterval(async () => {
      try {
        await this.messageQueue.processQueue();
      } catch (error) {
        console.error('Error processing queue:', error);
      }
    }, intervalMs);

    // Store interval ID for cleanup
    (this as any).queueProcessInterval = processInterval;
  }

  /**
   * Stop processing queued messages
   */
  async stopQueueProcessing(): Promise<void> {
    const intervalId = (this as any).queueProcessInterval;
    if (intervalId) {
      clearInterval(intervalId);
      console.log('✅ Queue processing stopped');
    }
  }

  /**
   * Route outgoing message from app → WhatsApp (via Message Queue)
   *
   * Steps:
   * 1. Validate message format
   * 2. Enqueue message for reliable delivery
   * 3. Return immediately (async processing)
   * 4. Queue will handle encryption, routing, and retries
   *
   * Benefits:
   * - Messages persist even if service restarts
   * - Automatic retry with exponential backoff
   * - Rate limiting and backpressure
   * - Message deduplication
   */
  async routeOutgoing(message: ProtocolMessage): Promise<{
    success: boolean;
    messageId?: string;
    externalMessageId?: string;
    error?: string;
    errorCode?: string;
  }> {
    console.log(`📤 Queuing outgoing message: ${message.id || 'new'}`);

    try {
      // Step 1: Validate message
      if (!message.recipientId || !message.text) {
        throw new Error('Missing recipientId or text content');
      }

      const messageId = message.protocolMessageId || this.generateMessageId();

      // Step 2: Enqueue message with priority
      // Priority: 10 = high, 5 = normal, 1 = low
      const priority = (message.metadata?.priority as number) || 5;

      const queuedMessageId = await this.messageQueue.enqueueMessage(
        { ...message, protocolMessageId: messageId } as ProtocolMessage,
        priority,
        {
          sessionId: await this.getOrCreateSession(message.senderId || 'meeshy', message.recipientId),
          routedAt: new Date().toISOString()
        }
      );

      // Step 3: Track message status
      this.messageStatus.set(messageId, {
        status: 'pending',
        updatedAt: new Date(),
        metadata: { queuedMessageId, enqueuedAt: new Date() }
      });

      this.stats.queuedMessages++;
      console.log(`✅ Message queued successfully: ${messageId} (will be sent asynchronously)`);

      return {
        success: true,
        messageId,
        externalMessageId: queuedMessageId
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to queue message: ${msg}`);
      this.stats.routingErrors++;

      return {
        success: false,
        error: msg,
        errorCode: 'ROUTING_ERROR'
      };
    }
  }

  /**
   * Send queued message directly via XMPP (called by message queue processor)
   * This is the actual message transmission logic
   */
  async sendQueuedMessage(message: ProtocolMessage): Promise<boolean> {
    try {
      const messageId = message.protocolMessageId || this.generateMessageId();
      console.log(`📤 Sending queued message: ${messageId}`);

      // Get or create session
      const sessionId = await this.getOrCreateSession(
        message.senderId || 'meeshy',
        message.recipientId
      );

      // Encrypt with Signal Protocol
      const encryptedContent = await this.signalEngine.encryptMessage(
        message.text || message.metadata?.content || '',
        message.recipientId
      );
      this.stats.messagesEncrypted++;

      // Create XMPP stanza with encrypted content
      const xmppStanza: XMPPStanza = {
        type: 'message',
        from: this.xmppClient.getStatus().jid || 'meeshy@meeshy.dma.example.com',
        to: message.recipientId,
        id: messageId,
        timestamp: new Date().toISOString(),
        body: this.encodeEncryptedContent(encryptedContent),
        encryption: {
          type: 'Signal-Protocol',
          version: '3'
        }
      };

      // Apply Noise Protocol transport encryption
      const noiseSession = this.sessions.get(sessionId)?.noiseSessionId;
      if (noiseSession && this.noiseProtocol.isSessionReady(noiseSession)) {
        const transportEncrypted = this.noiseProtocol.encryptMessage(
          noiseSession,
          Buffer.from(JSON.stringify(xmppStanza))
        );
        xmppStanza.body = transportEncrypted.toString('base64');
      }

      // Send via XMPP
      await this.xmppClient.sendStanza(xmppStanza);
      this.stats.messagesRouted++;

      // Update message status
      this.messageStatus.set(messageId, {
        status: 'sent',
        updatedAt: new Date()
      });

      console.log(`✅ Queued message sent successfully: ${messageId}`);
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to send queued message: ${msg}`);
      this.stats.routingErrors++;
      throw error;
    }
  }

  /**
   * Route incoming XMPP message → app
   *
   * Steps:
   * 1. Receive XMPP stanza
   * 2. Apply Noise Protocol transport decryption
   * 3. Validate Signal Protocol encryption header
   * 4. Decrypt with Signal Protocol
   * 5. Parse message content
   * 6. Send delivery receipt
   * 7. Return parsed message to app
   */
  async routeIncoming(payload: Record<string, any>): Promise<ProtocolMessage | null> {
    console.log(`📥 Routing incoming message`);

    try {
      const xmppStanza = this.parseXMPPPayload(payload);

      if (!xmppStanza) {
        throw new Error('Invalid XMPP payload');
      }

      const messageId = xmppStanza.id;

      // Step 2: Apply Noise Protocol transport decryption
      const noiseSessionId = this.getNoiseSessionForSender(xmppStanza.from);
      let decryptedBody = xmppStanza.body;

      if (noiseSessionId && this.noiseProtocol.isSessionReady(noiseSessionId)) {
        try {
          const transportDecrypted = this.noiseProtocol.decryptMessage(
            noiseSessionId,
            Buffer.from(xmppStanza.body || '', 'base64')
          );
          decryptedBody = transportDecrypted.toString('utf-8');
        } catch (error) {
          console.warn('Transport decryption failed, using plaintext:', error);
        }
      }

      // Step 3-4: Decrypt with Signal Protocol
      const encryptedMessage = this.decodeEncryptedContent(decryptedBody);

      if (!encryptedMessage) {
        throw new Error('Failed to decode encrypted content');
      }

      const plaintext = await this.signalEngine.decryptMessage(encryptedMessage, xmppStanza.from);
      this.stats.messagesDecrypted++;

      // Step 5: Parse message content
      const message: ProtocolMessage = {
        id: messageId,
        content: plaintext,
        senderId: xmppStanza.from,
        recipientId: xmppStanza.to,
        timestamp: new Date(xmppStanza.timestamp),
        protocol: 'whatsapp-dma-interop',
        metadata: {
          xmppStanza
        }
      };

      // Step 6: Send delivery receipt
      const receipt: XMPPStanza = {
        type: 'message',
        from: xmppStanza.to,
        to: xmppStanza.from,
        id: this.generateMessageId(),
        timestamp: new Date().toISOString(),
        body: `delivery-receipt:${messageId}`
      };

      try {
        await this.xmppClient.sendStanza(receipt);
        this.stats.deliveryReceipts++;
      } catch (error) {
        console.warn('Failed to send delivery receipt:', error);
      }

      // Track message status
      this.messageStatus.set(messageId, {
        status: 'delivered',
        updatedAt: new Date()
      });

      this.stats.messagesRouted++;

      console.log(`✅ Message routed from WhatsApp: ${messageId}`);

      return message;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to route incoming message: ${msg}`);
      this.stats.routingErrors++;

      return null;
    }
  }

  /**
   * Get or create session between Meeshy user and WhatsApp contact
   */
  private async getOrCreateSession(meeshyUserId: string, whatsappAddress: string): Promise<string> {
    const sessionKey = `${meeshyUserId}-${whatsappAddress}`;
    let sessionId = this.sessionsByUser.get(meeshyUserId);

    if (sessionId && this.sessions.has(sessionId)) {
      return sessionId;
    }

    // Create new session
    sessionId = this.generateSessionId();

    // Initiate Signal Protocol session
    const signalSessionId = `${sessionId}-signal`;

    // Initiate Noise Protocol session
    const noiseSessionData = this.noiseProtocol.initiateHandshake(sessionId);
    const noiseSessionId = sessionId;

    const session: RouterSession = {
      meeshyUserId,
      whatsappAddress,
      signalSessionId,
      noiseSessionId,
      createdAt: new Date(),
      messagesExchanged: 0
    };

    this.sessions.set(sessionId, session);
    this.sessionsByUser.set(meeshyUserId, sessionId);
    this.stats.sessionsActive++;

    console.log(`✨ Created new router session: ${sessionId}`);
    console.log(`   Meeshy: ${meeshyUserId} ↔ WhatsApp: ${whatsappAddress}`);

    return sessionId;
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<MessageStatus | null> {
    return this.messageStatus.get(messageId) || null;
  }

  /**
   * Handle incoming XMPP message
   *
   * Called by XMPP client when message arrives
   */
  private async handleIncomingXMPPMessage(stanza: XMPPStanza): Promise<void> {
    console.log(`🔔 Incoming XMPP message callback: ${stanza.id}`);

    // Convert XMPP stanza to ProtocolMessage and route
    const protocolMessage = await this.routeIncoming(stanza as Record<string, any>);

    if (protocolMessage) {
      console.log(`📨 Message ready for app delivery: ${protocolMessage.id}`);
      // In production, would emit to app handlers
      // this.emit('message', protocolMessage);
    }
  }

  /**
   * Parse XMPP payload (from HTTP webhook)
   */
  private parseXMPPPayload(payload: Record<string, any>): XMPPStanza | null {
    if (!payload.type || !payload.from || !payload.to) {
      return null;
    }

    return {
      type: payload.type as 'message' | 'presence' | 'iq',
      from: payload.from,
      to: payload.to,
      id: payload.id || this.generateMessageId(),
      timestamp: payload.timestamp || new Date().toISOString(),
      body: payload.body,
      encryption: payload.encryption
    };
  }

  /**
   * Encode Signal Protocol encrypted message for XMPP transmission
   */
  private encodeEncryptedContent(encryptedMessage: EncryptedMessage): string {
    const encoded = {
      version: encryptedMessage.version,
      ephemeralPublicKey: encryptedMessage.ephemeralPublicKey.toString('base64'),
      iv: encryptedMessage.iv.toString('base64'),
      ciphertext: encryptedMessage.ciphertext.toString('base64'),
      authenticationTag: encryptedMessage.authenticationTag.toString('base64'),
      messageNumber: encryptedMessage.messageNumber,
      previousChainLength: encryptedMessage.previousChainLength
    };

    return Buffer.from(JSON.stringify(encoded)).toString('base64');
  }

  /**
   * Decode Signal Protocol encrypted message from XMPP transmission
   */
  private decodeEncryptedContent(encodedContent: string | undefined): EncryptedMessage | null {
    if (!encodedContent) return null;

    try {
      const decoded = JSON.parse(Buffer.from(encodedContent, 'base64').toString('utf-8'));

      return {
        version: decoded.version,
        ephemeralPublicKey: Buffer.from(decoded.ephemeralPublicKey, 'base64'),
        iv: Buffer.from(decoded.iv, 'base64'),
        ciphertext: Buffer.from(decoded.ciphertext, 'base64'),
        authenticationTag: Buffer.from(decoded.authenticationTag, 'base64'),
        signature: Buffer.alloc(0),
        messageNumber: decoded.messageNumber,
        previousChainLength: decoded.previousChainLength
      };
    } catch (error) {
      console.error('Failed to decode encrypted content:', error);
      return null;
    }
  }

  /**
   * Get Noise session for sender
   */
  private getNoiseSessionForSender(senderId: string): string | undefined {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.whatsappAddress === senderId) {
        return session.noiseSessionId;
      }
    }
    return undefined;
  }

  /**
   * Helper: Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Helper: Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Get statistics
   */
  getStatistics(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): RouterSession[] {
    return Array.from(this.sessions.values());
  }
}
