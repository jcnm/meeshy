/**
 * iMessage Webhook Service
 *
 * Handles incoming webhooks from iMessage
 * Routes messages to the messaging system and updates message status
 */

import { PrismaClient } from '../../shared/prisma/client';
import { MessagingService } from './MessagingService';
import { iMessageAdapter, iMessageWebhookPayload } from '../adapters/iMessageAdapter';
import type { MessageRequest } from '../../shared/types';

export class iMessageWebhookService {
  private iMessageAdapter: iMessageAdapter;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly messagingService: MessagingService
  ) {
    this.iMessageAdapter = new iMessageAdapter();
  }

  /**
   * Handle incoming webhook events from iMessage
   * Process messages, status updates, typing indicators, etc.
   */
  async handleWebhook(
    payload: Record<string, any>,
    signature?: string
  ): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      const iMessagePayload = payload as iMessageWebhookPayload;

      // Route by event type
      switch (iMessagePayload.event) {
        case 'message':
          try {
            await this.handleIncomingMessage(iMessagePayload);
            processed++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to process message: ${errorMsg}`);
          }
          break;

        case 'delivery':
        case 'read':
          try {
            await this.handleStatusUpdate(iMessagePayload);
            processed++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to process status update: ${errorMsg}`);
          }
          break;

        case 'typing':
          try {
            await this.handleTypingIndicator(iMessagePayload);
            processed++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to process typing indicator: ${errorMsg}`);
          }
          break;

        case 'connection':
          try {
            await this.handleConnectionEvent(iMessagePayload);
            processed++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to process connection event: ${errorMsg}`);
          }
          break;

        default:
          errors.push(`Unknown event type: ${iMessagePayload.event}`);
      }

      return { processed, errors };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Webhook processing failed: ${errorMsg}`);
    }
  }

  /**
   * Process an incoming iMessage
   */
  private async handleIncomingMessage(payload: iMessageWebhookPayload): Promise<void> {
    // Convert iMessage to Meeshy message format
    const protocolMessage = await this.iMessageAdapter.processIncomingWebhook(payload);

    if (!protocolMessage) {
      return;
    }

    // Get or create the sender user
    const sender = await this.prisma.user.upsert({
      where: { email: this.generateEmailFromAppleId(protocolMessage.senderId) },
      update: {
        displayName: protocolMessage.senderName,
        phoneNumber: protocolMessage.senderPhoneNumber
      },
      create: {
        username: this.generateUsernameFromAppleId(protocolMessage.senderId),
        email: this.generateEmailFromAppleId(protocolMessage.senderId),
        firstName: protocolMessage.senderName?.split(' ')[0] || 'iMessage',
        lastName: protocolMessage.senderName?.split(' ')[1] || 'User',
        displayName: protocolMessage.senderName,
        phoneNumber: protocolMessage.senderPhoneNumber,
        password: Buffer.from(Math.random().toString()).toString('base64'), // Temporary password
        role: 'USER'
      }
    });

    // Create a Meeshy message request
    const messageRequest: MessageRequest = {
      text: protocolMessage.text,
      conversationId: await this.getOrCreateConversation(sender.id, protocolMessage),
      recipientId: undefined,
      attachments: protocolMessage.media?.map(m => ({
        type: m.type,
        url: m.url,
        name: m.fileName || `${m.type}_${Date.now()}`,
        mimeType: m.mimeType
      })),
      metadata: {
        protocol: 'imessage',
        protocolMessageId: protocolMessage.protocolMessageId,
        senderId: protocolMessage.senderId,
        timestamp: protocolMessage.timestamp.toISOString(),
        ...protocolMessage.metadata
      }
    };

    // Route through the messaging service
    await this.messagingService.handleMessage(
      messageRequest,
      sender.id,
      true,
      sender.id
    );

    // Store the protocol message mapping
    await this.storeProtocolMessageMapping(
      protocolMessage.protocolMessageId,
      sender.id,
      'imessage'
    );
  }

  /**
   * Process a message status update from iMessage
   */
  private async handleStatusUpdate(payload: iMessageWebhookPayload): Promise<void> {
    if (!payload.messageId || !payload.status) {
      return;
    }

    const statusUpdate = await this.iMessageAdapter.processStatusUpdate(payload);

    if (!statusUpdate) {
      return;
    }

    // Update message status in database
    await this.prisma.message.updateMany({
      where: {
        metadata: {
          path: '$.protocolMessageId',
          equals: statusUpdate.messageId
        }
      },
      data: {
        status: statusUpdate.status as any,
        updatedAt: statusUpdate.timestamp
      }
    });
  }

  /**
   * Process typing indicator
   */
  private async handleTypingIndicator(payload: iMessageWebhookPayload): Promise<void> {
    const conversationId = payload.conversationId;
    const senderId = payload.sender.appleId || payload.sender.phoneNumber || 'unknown';

    // Store typing indicator (could broadcast via Socket.IO)
    // Implementation depends on your real-time system
    console.log(`User ${senderId} is typing in conversation ${conversationId}`);
  }

  /**
   * Process connection event (user came online/offline)
   */
  private async handleConnectionEvent(payload: iMessageWebhookPayload): Promise<void> {
    const senderId = payload.sender.appleId || payload.sender.phoneNumber || 'unknown';
    const isOnline = payload.metadata?.online === true;

    // Update user status
    const user = await this.prisma.user.findFirst({
      where: {
        email: this.generateEmailFromAppleId(senderId)
      }
    });

    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isOnline,
          lastActiveAt: new Date()
        }
      });
    }
  }

  /**
   * Get or create a conversation for an iMessage user
   */
  private async getOrCreateConversation(
    userId: string,
    message: any
  ): Promise<string> {
    const conversationKey = `imessage:${message.metadata.appleId || message.metadata.phoneNumber}`;

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        members: {
          some: { id: userId }
        },
        metadata: {
          path: '$.protocolConversationKey',
          equals: conversationKey
        }
      }
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          identifier: `imsg_${Date.now()}`,
          title: `iMessage - ${message.senderName || message.senderId}`,
          description: `Direct message conversation with ${message.senderName}`,
          type: 'direct',
          members: {
            connect: [{ id: userId }]
          },
          isActive: true,
          isArchived: false,
          metadata: {
            protocol: 'imessage',
            protocolConversationKey: conversationKey,
            protocolSenderId: message.senderId,
            senderAppleId: message.metadata.appleId,
            senderPhoneNumber: message.metadata.phoneNumber,
            senderName: message.senderName,
            createdVia: 'imessage'
          }
        },
        include: {
          members: true
        }
      });
    }

    return conversation.id;
  }

  /**
   * Store the mapping between protocol message ID and internal message ID
   */
  private async storeProtocolMessageMapping(
    protocolMessageId: string,
    userId: string,
    protocol: string
  ): Promise<void> {
    await this.prisma.message.updateMany({
      where: {
        authorId: userId,
        metadata: {
          path: '$.protocolMessageId',
          equals: protocolMessageId
        }
      },
      data: {
        metadata: {
          protocol,
          protocolMessageId,
          mappedAt: new Date().toISOString()
        }
      }
    });
  }

  /**
   * Generate email from Apple ID
   */
  private generateEmailFromAppleId(appleId: string): string {
    return `imessage+${appleId.replace(/[^a-zA-Z0-9]/g, '_')}@meeshy.local`;
  }

  /**
   * Generate username from Apple ID
   */
  private generateUsernameFromAppleId(appleId: string): string {
    return `imessage_${appleId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)}`;
  }
}
