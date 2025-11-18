/**
 * WhatsApp Webhook Service
 *
 * Handles incoming webhooks from WhatsApp Business API
 * Routes messages to the messaging system and updates message status
 */

import { PrismaClient } from '../../shared/prisma/client';
import { MessagingService } from './MessagingService';
import { WhatsAppDMAAdapter, WhatsAppWebhookPayload } from '../adapters/WhatsAppDMAAdapter';
import type { MessageRequest } from '../../shared/types';

export interface WebhookVerificationParams {
  'hub.mode': string;
  'hub.challenge': string;
  'hub.verify_token': string;
}

export class WhatsAppWebhookService {
  private whatsappAdapter: WhatsAppDMAAdapter;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly messagingService: MessagingService,
    private readonly verifyToken: string
  ) {
    this.whatsappAdapter = new WhatsAppDMAAdapter();
  }

  /**
   * Handle webhook verification from WhatsApp
   * Called when WhatsApp validates the webhook endpoint
   */
  verifyWebhook(params: WebhookVerificationParams): string | null {
    if (params['hub.mode'] !== 'subscribe') {
      return null;
    }

    if (params['hub.verify_token'] !== this.verifyToken) {
      throw new Error('Invalid verification token');
    }

    return params['hub.challenge'];
  }

  /**
   * Handle incoming webhook events from WhatsApp
   * Process messages, status updates, etc.
   */
  async handleWebhook(
    payload: Record<string, any>,
    signature?: string
  ): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      const whatsappPayload = payload as WhatsAppWebhookPayload;

      // Process each entry in the webhook
      for (const entry of whatsappPayload.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;

          // Handle incoming messages
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              try {
                await this.handleIncomingMessage(message, value, entry);
                processed++;
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                errors.push(`Failed to process message ${message.id}: ${errorMsg}`);
              }
            }
          }

          // Handle status updates
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              try {
                await this.handleStatusUpdate(status, value);
                processed++;
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                errors.push(`Failed to process status ${status.id}: ${errorMsg}`);
              }
            }
          }
        }
      }

      return { processed, errors };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Webhook processing failed: ${errorMsg}`);
    }
  }

  /**
   * Process an incoming WhatsApp message
   */
  private async handleIncomingMessage(
    message: any,
    value: any,
    entry: any
  ): Promise<void> {
    // Convert WhatsApp message to Meeshy message format
    const protocolMessage = await this.whatsappAdapter.processIncomingWebhook({
      entry: [{ changes: [{ value }], id: entry.id }],
      object: 'whatsapp_business_account'
    });

    if (!protocolMessage) {
      return;
    }

    // Get or create the sender user
    const sender = await this.prisma.user.upsert({
      where: { whatsAppPhoneNumber: protocolMessage.senderPhoneNumber },
      update: {
        whatsAppId: protocolMessage.senderId,
        displayName: protocolMessage.senderName
      },
      create: {
        whatsAppId: protocolMessage.senderId,
        whatsAppPhoneNumber: protocolMessage.senderPhoneNumber,
        displayName: protocolMessage.senderName || `WhatsApp User ${protocolMessage.senderPhoneNumber}`,
        email: `whatsapp+${protocolMessage.senderId}@meeshy.local`,
        protocol: 'whatsapp-dma'
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
        protocol: 'whatsapp-dma',
        protocolMessageId: protocolMessage.protocolMessageId,
        senderPhoneNumber: protocolMessage.senderPhoneNumber,
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
      'whatsapp-dma'
    );
  }

  /**
   * Process a message status update from WhatsApp
   */
  private async handleStatusUpdate(
    status: any,
    value: any
  ): Promise<void> {
    const statusUpdate = await this.whatsappAdapter.processStatusUpdate({
      entry: [
        {
          changes: [{ value }],
          id: value.metadata?.phone_number_id || ''
        }
      ],
      object: 'whatsapp_business_account'
    });

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
   * Get or create a conversation for a WhatsApp user
   */
  private async getOrCreateConversation(
    userId: string,
    message: any
  ): Promise<string> {
    const conversationKey = `whatsapp:${message.senderPhoneNumber}`;

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
          title: `WhatsApp - ${message.senderName || message.senderPhoneNumber}`,
          description: `Direct message conversation with ${message.senderName}`,
          members: {
            connect: [{ id: userId }]
          },
          protocol: 'whatsapp-dma',
          isPrivate: true,
          metadata: {
            protocolConversationKey: conversationKey,
            protocolSenderId: message.senderId,
            senderPhoneNumber: message.senderPhoneNumber,
            senderName: message.senderName,
            createdVia: 'whatsapp-dma'
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
    // Store in a protocol_message_mapping table or in message metadata
    // This allows us to track messages across protocols
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
}
