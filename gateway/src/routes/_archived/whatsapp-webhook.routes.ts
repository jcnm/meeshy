/**
 * WhatsApp Webhook Routes (Fastify)
 *
 * Fastify routes for handling WhatsApp webhooks
 * - Webhook verification (GET)
 * - Message/status updates (POST)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '../../shared/prisma/client';
import { MessagingService } from '../services/MessagingService';
import { TranslationService } from '../services/TranslationService';

export async function registerWhatsAppWebhookRoutes(
  fastify: FastifyInstance,
  prisma: PrismaClient
): Promise<void> {
  // Initialize services
  const translationService = new TranslationService(prisma);
  const messagingService = new MessagingService(prisma, translationService);

  // Note: WhatsAppWebhookService is archived - can be restored with Fastify migration
  // const webhookService = new WhatsAppWebhookService(
  //   prisma,
  //   messagingService,
  //   process.env.WHATSAPP_VERIFY_TOKEN || 'meeshy-whatsapp-verify'
  // );

  /**
   * GET /webhooks/whatsapp
   * Webhook verification endpoint
   * WhatsApp calls this to verify the webhook URL
   */
  fastify.get('/webhooks/whatsapp', async (
    request: FastifyRequest<{
      Querystring: {
        'hub.mode'?: string;
        'hub.challenge'?: string;
        'hub.verify_token'?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const hubMode = request.query['hub.mode'];
      const hubChallenge = request.query['hub.challenge'];
      const hubVerifyToken = request.query['hub.verify_token'];

      if (!hubMode || !hubChallenge || !hubVerifyToken) {
        return reply.code(400).send({
          error: 'Missing required parameters: hub.mode, hub.challenge, hub.verify_token'
        });
      }

      // Verify webhook (placeholder - would need WhatsAppWebhookService)
      const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'meeshy-whatsapp-verify';

      if (hubVerifyToken === expectedToken) {
        reply.code(200).send(hubChallenge);
      } else {
        reply.code(403).send({ error: 'Invalid verification token' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error('Webhook verification error:', errorMessage);
      reply.code(403).send({ error: 'Verification failed' });
    }
  });

  /**
   * POST /webhooks/whatsapp
   * Incoming webhook handler
   * Receives messages, status updates, etc. from WhatsApp
   */
  fastify.post('/webhooks/whatsapp', async (
    request: FastifyRequest<{
      Headers: {
        'x-hub-signature-256'?: string;
      };
      Body: Record<string, any>;
    }>,
    reply: FastifyReply
  ) => {
    try {
      // Get the signature for verification
      const signature = request.headers['x-hub-signature-256'];

      // Immediately respond with 200 OK to prevent WhatsApp retries
      reply.code(200).send({ success: true });

      // Process the webhook asynchronously (fire and forget)
      processWebhookAsync(request.body, signature).catch((error) => {
        fastify.log.error('Webhook async processing failed:', error);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error('Webhook processing error:', errorMessage);
      // Still return 200 to prevent WhatsApp retries
      reply.code(200).send({ success: true });
    }
  });

  /**
   * GET /webhooks/whatsapp/status
   * Check webhook service health and configuration status
   */
  fastify.get('/webhooks/whatsapp/status', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const isConfigured = !!process.env.WHATSAPP_API_KEY;
      const hasPhoneNumber = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
      const hasWebhookSecret = !!process.env.WHATSAPP_WEBHOOK_SECRET;

      reply.code(200).send({
        status: 'ok',
        whatsapp: {
          configured: isConfigured,
          hasPhoneNumber,
          hasWebhookSecret,
          verifyTokenSet: !!process.env.WHATSAPP_VERIFY_TOKEN
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(500).send({ status: 'error', error: errorMessage });
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
      // Would use WhatsAppWebhookService when restored
      fastify.log.info(
        `WhatsApp webhook received with ${payload.entry?.length || 0} entries`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error('Webhook async processing failed:', errorMessage);
    }
  }
}
