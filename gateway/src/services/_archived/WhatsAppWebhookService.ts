/**
 * WhatsApp Webhook Service (Fastify Compatible)
 *
 * Handles incoming webhooks from WhatsApp Business API
 * Routes messages to the messaging system and updates message status
 *
 * Status: ARCHIVED - Requires WhatsAppDMAAdapter restoration for full functionality
 */

import { PrismaClient } from '../../shared/prisma/client';
import { MessagingService } from './MessagingService';

/**
 * Webhook verification parameters from WhatsApp
 */
export interface WebhookVerificationParams {
  'hub.mode': string;
  'hub.challenge': string;
  'hub.verify_token': string;
}

/**
 * WhatsApp webhook payload structure
 */
export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product?: string;
        phone_number_id?: string;
        display_phone_number?: string;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          [key: string]: any;
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id?: string;
          [key: string]: any;
        }>;
      };
    }>;
  }>;
}

/**
 * WhatsApp Webhook Service - Handles incoming webhook events
 *
 * Responsibilities:
 * - Verify webhook authenticity with WhatsApp
 * - Parse incoming messages and status updates
 * - Route to messaging service for processing
 * - Log and handle errors
 */
export class WhatsAppWebhookService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly messagingService: MessagingService,
    private readonly verifyToken: string
  ) {}

  /**
   * Handle webhook verification from WhatsApp
   * Called when WhatsApp validates the webhook endpoint
   *
   * WhatsApp sends: GET /webhook?hub.mode=subscribe&hub.challenge=<token>&hub.verify_token=<token>
   * We respond with: challenge value to confirm webhook
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
   *
   * Returns: { processed: number of events processed, errors: array of error messages }
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
   * Handle incoming message from WhatsApp
   * PLACEHOLDER: Requires WhatsAppDMAAdapter for full implementation
   */
  private async handleIncomingMessage(
    message: any,
    value: any,
    entry: any
  ): Promise<void> {
    // Placeholder: Would convert WhatsApp message to Meeshy MessageRequest
    // and route through messagingService
    console.log(`[WhatsApp] Incoming message from ${message.from}: ${message.id}`);

    // TODO: Restore WhatsAppDMAAdapter
    // const protocolMessage = WhatsAppDMAAdapter.parseIncomingMessage(message, value);
    // const messageRequest = this.convertToMessageRequest(protocolMessage);
    // await this.messagingService.processMessage(messageRequest);
  }

  /**
   * Handle status update from WhatsApp
   * PLACEHOLDER: Requires implementation
   */
  private async handleStatusUpdate(
    status: any,
    value: any
  ): Promise<void> {
    // Placeholder: Would update message delivery status in database
    console.log(`[WhatsApp] Status update for ${status.id}: ${status.status}`);

    // TODO: Implement status update logic
    // Map WhatsApp status to Meeshy message status
    // Update database with new status
  }
}
