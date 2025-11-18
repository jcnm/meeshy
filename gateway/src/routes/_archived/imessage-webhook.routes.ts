/**
 * iMessage Webhook Routes (Fastify)
 *
 * Fastify routes for handling iMessage webhooks
 * - Message events
 * - Delivery/read receipts
 * - Typing indicators
 * - Connection status
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '../../shared/prisma/client';
import { MessagingService } from '../services/MessagingService';
import { TranslationService } from '../services/TranslationService';

export async function registeriMessageWebhookRoutes(
  fastify: FastifyInstance,
  prisma: PrismaClient
): Promise<void> {
  // Initialize services
  const translationService = new TranslationService(prisma);
  const messagingService = new MessagingService(prisma, translationService);

  // Note: iMessageWebhookService is archived - can be restored with Fastify migration
  // const webhookService = new iMessageWebhookService(prisma, messagingService);

  /**
   * POST /webhooks/imessage
   * Incoming webhook handler
   * Receives messages, status updates, typing indicators, etc. from iMessage
   */
  fastify.post('/webhooks/imessage', async (
    request: FastifyRequest<{
      Headers: {
        'x-signature'?: string;
      };
      Body: Record<string, any>;
    }>,
    reply: FastifyReply
  ) => {
    try {
      // Get the signature for verification (if provided by Apple)
      const signature = request.headers['x-signature'];

      // Immediately respond with 200 OK to prevent retries
      reply.code(200).send({ success: true });

      // Process the webhook asynchronously (fire and forget)
      processWebhookAsync(request.body, signature).catch((error) => {
        fastify.log.error('Webhook async processing failed:', error);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error('Webhook processing error:', errorMessage);
      // Still return 200 to prevent retries
      reply.code(200).send({ success: true });
    }
  });

  /**
   * GET /webhooks/imessage/status
   * Check webhook service health and configuration status
   */
  fastify.get('/webhooks/imessage/status', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const isConfigured = !!process.env.APPLE_TEAM_ID;
      const hasKeyId = !!process.env.APPLE_KEY_ID;
      const hasBundleId = !!process.env.APPLE_BUNDLE_ID;

      reply.code(200).send({
        status: 'ok',
        imessage: {
          configured: isConfigured,
          hasKeyId,
          hasBundleId,
          apiVersion: process.env.APPLE_API_VERSION || '1.0'
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(500).send({ status: 'error', error: errorMessage });
    }
  });

  /**
   * GET /webhooks/imessage/health
   * Health check endpoint
   */
  fastify.get('/webhooks/imessage/health', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      reply.code(200).send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'iMessage Webhook Service'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(500).send({ status: 'unhealthy', error: errorMessage });
    }
  });

  /**
   * Process webhook asynchronously
   */
  async function processWebhookAsync(
    payload: Record<string, any>,
    signature?: string
  ): Promise<void> {
    try {
      // Placeholder for webhook processing
      // Would use iMessageWebhookService when restored
      fastify.log.info(
        `iMessage webhook received with ${Object.keys(payload).length} properties`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error('Webhook async processing failed:', errorMessage);
    }
  }
}
