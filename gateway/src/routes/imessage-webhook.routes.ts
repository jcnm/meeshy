/**
 * iMessage Webhook Routes
 *
 * Express routes for handling iMessage webhooks
 * - Message events
 * - Delivery/read receipts
 * - Typing indicators
 * - Connection status
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../shared/prisma/client';
import { MessagingService } from '../services/MessagingService';
import { iMessageWebhookService } from '../services/iMessageWebhookService';
import { TranslationService } from '../services/TranslationService';

export function createiMessageWebhookRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize services
  const translationService = new TranslationService(prisma);
  const messagingService = new MessagingService(prisma, translationService);
  const webhookService = new iMessageWebhookService(prisma, messagingService);

  /**
   * POST /webhooks/imessage
   * Incoming webhook handler
   * Receives messages, status updates, typing indicators, etc. from iMessage
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      // Get the signature for verification (if provided by Apple)
      const signature = req.headers['x-signature'] as string;

      // Immediately respond with 200 OK to prevent retries
      res.status(200).json({ success: true });

      // Process the webhook asynchronously
      await processWebhookAsync(req.body, signature);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Webhook processing error:', errorMessage);
      // Still return 200 to prevent retries
      res.status(200).json({ success: true });
    }

    async function processWebhookAsync(
      payload: Record<string, any>,
      signature?: string
    ): Promise<void> {
      try {
        const result = await webhookService.handleWebhook(payload, signature);

        console.log(
          `iMessage webhook processed: ${result.processed} events, ${result.errors.length} errors`
        );

        if (result.errors.length > 0) {
          console.warn('iMessage webhook processing errors:', result.errors);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Webhook async processing failed:', errorMessage);
      }
    }
  });

  /**
   * GET /webhooks/imessage/status
   * Check webhook service health and configuration status
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const isConfigured = !!process.env.APPLE_TEAM_ID;
      const hasKeyId = !!process.env.APPLE_KEY_ID;
      const hasBundleId = !!process.env.APPLE_BUNDLE_ID;

      res.status(200).json({
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
      res.status(500).json({ status: 'error', error: errorMessage });
    }
  });

  /**
   * GET /webhooks/imessage/health
   * Health check endpoint
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'iMessage Webhook Service'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ status: 'unhealthy', error: errorMessage });
    }
  });

  return router;
}
