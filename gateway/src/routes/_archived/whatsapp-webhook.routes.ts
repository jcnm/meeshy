/**
 * WhatsApp Webhook Routes
 *
 * Express routes for handling WhatsApp webhooks
 * - Webhook verification (GET)
 * - Message/status updates (POST)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '../../shared/prisma/client';
import { MessagingService } from '../services/MessagingService';
import { WhatsAppWebhookService } from '../services/WhatsAppWebhookService';
import { TranslationService } from '../services/TranslationService';

export function createWhatsAppWebhookRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Initialize services
  const translationService = new TranslationService(prisma);
  const messagingService = new MessagingService(prisma, translationService);
  const webhookService = new WhatsAppWebhookService(
    prisma,
    messagingService,
    process.env.WHATSAPP_VERIFY_TOKEN || 'meeshy-whatsapp-verify'
  );

  /**
   * GET /webhooks/whatsapp
   * Webhook verification endpoint
   * WhatsApp calls this to verify the webhook URL
   */
  router.get('/', (req: Request, res: Response) => {
    try {
      const hubMode = req.query['hub.mode'] as string;
      const hubChallenge = req.query['hub.challenge'] as string;
      const hubVerifyToken = req.query['hub.verify_token'] as string;

      if (!hubMode || !hubChallenge || !hubVerifyToken) {
        return res.status(400).json({
          error: 'Missing required parameters: hub.mode, hub.challenge, hub.verify_token'
        });
      }

      const challenge = webhookService.verifyWebhook({
        'hub.mode': hubMode,
        'hub.challenge': hubChallenge,
        'hub.verify_token': hubVerifyToken
      });

      if (challenge) {
        res.status(200).send(challenge);
      } else {
        res.status(403).json({ error: 'Invalid verification token' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Webhook verification error:', errorMessage);
      res.status(403).json({ error: 'Verification failed' });
    }
  });

  /**
   * POST /webhooks/whatsapp
   * Incoming webhook handler
   * Receives messages, status updates, etc. from WhatsApp
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      // Get the signature for verification
      const signature = req.headers['x-hub-signature-256'] as string;

      // Immediately respond with 200 OK to prevent WhatsApp retries
      res.status(200).json({ success: true });

      // Process the webhook asynchronously
      await processWebhookAsync(req.body, signature);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Webhook processing error:', errorMessage);
      // Still return 200 to prevent WhatsApp retries
      res.status(200).json({ success: true });
    }

    async function processWebhookAsync(
      payload: Record<string, any>,
      signature?: string
    ): Promise<void> {
      try {
        const result = await webhookService.handleWebhook(payload, signature);

        console.log(
          `WhatsApp webhook processed: ${result.processed} events, ${result.errors.length} errors`
        );

        if (result.errors.length > 0) {
          console.warn('WhatsApp webhook processing errors:', result.errors);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Webhook async processing failed:', errorMessage);
      }
    }
  });

  /**
   * GET /webhooks/whatsapp/status
   * Check webhook service health and configuration status
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const isConfigured = !!process.env.WHATSAPP_API_KEY;
      const hasPhoneNumber = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
      const hasWebhookSecret = !!process.env.WHATSAPP_WEBHOOK_SECRET;

      res.status(200).json({
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
      res.status(500).json({ status: 'error', error: errorMessage });
    }
  });

  return router;
}
