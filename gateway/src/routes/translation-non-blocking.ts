import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { TranslationService } from '../services/TranslationService';
import { logError } from '../utils/logger';

// ===== SCHÉMAS DE VALIDATION =====
const TranslateRequestSchema = z.object({
  text: z.string().min(1).max(1000).optional(),
  source_language: z.string().min(2).max(5).optional(),
  target_language: z.string().min(2).max(5),
  model_type: z.enum(['basic', 'medium', 'premium']).optional(),
  message_id: z.string().optional(),
  conversation_id: z.string().optional()
}).refine((data) => {
  return (data.text !== undefined && data.text.length > 0) || (data.message_id !== undefined);
}, {
  message: "Either 'text' or 'message_id' must be provided"
});

// ===== TYPES =====
interface TranslateRequest {
  text?: string;
  source_language?: string;
  target_language: string;
  model_type?: 'basic' | 'medium' | 'premium';
  message_id?: string;
  conversation_id?: string;
}

// ===== ROUTE NON-BLOQUANTE =====
export async function translationRoutes(fastify: FastifyInstance, options: any) {
  const translationService = options?.translationService;
  
  if (!translationService) {
    throw new Error('TranslationService not provided to translation routes');
  }

  console.log('🚀 [GATEWAY] Initialisation des routes de traduction NON-BLOQUANTES...');

  // ===== ROUTE PRINCIPALE NON-BLOQUANTE =====
  fastify.post<{ Body: TranslateRequest }>('/translate', async (request: FastifyRequest<{ Body: TranslateRequest }>, reply: FastifyReply) => {
    try {
      const validatedData = TranslateRequestSchema.parse(request.body);
      
      console.log(`🌐 [GATEWAY] Nouvelle requête de traduction reçue (non-bloquante):`, {
        text: validatedData.text?.substring(0, 50) + (validatedData.text?.length > 50 ? '...' : ''),
        sourceLanguage: validatedData.source_language,
        targetLanguage: validatedData.target_language,
        modelType: validatedData.model_type || 'basic',
        messageId: validatedData.message_id,
        conversationId: validatedData.conversation_id
      });

      // ===== CAS 1: RETRADUCTION D'UN MESSAGE EXISTANT =====
      if (validatedData.message_id) {
        console.log(`🔄 [GATEWAY] Retraduction du message ${validatedData.message_id}`);
        
        // Récupérer le message depuis la base de données
        const existingMessage = await fastify.prisma.message.findUnique({
          where: { id: validatedData.message_id },
          include: {
            conversation: { include: { members: true } }
          }
        });

        if (!existingMessage) {
          console.error(`❌ [GATEWAY] Message ${validatedData.message_id} non trouvé`);
          return reply.status(404).send({
            success: false,
            error: 'Message not found'
          });
        }

        console.log(`📄 [GATEWAY] Message récupéré de la BDD:`, {
          id: existingMessage.id,
          content: existingMessage.content,
          originalLanguage: existingMessage.originalLanguage,
          conversationId: existingMessage.conversationId,
          senderId: existingMessage.senderId
        });

        // Préparer les données de traduction
        const messageData = {
          id: validatedData.message_id,
          conversationId: existingMessage.conversationId,
          content: validatedData.text || existingMessage.content,
          originalLanguage: validatedData.source_language || existingMessage.originalLanguage,
          targetLanguage: validatedData.target_language,
          modelType: validatedData.model_type || 'basic'
        };

        console.log(`📤 [GATEWAY] Transmission vers Translator (retraduction):`, messageData);

        // DÉCLENCHEMENT NON-BLOQUANT - pas d'await !
        translationService.handleNewMessage(messageData).catch((error: any) => {
          console.error(`❌ [GATEWAY] Erreur lors de la retraduction asynchrone:`, error);
        });

        // RÉPONSE IMMÉDIATE - pas d'attente
        return reply.send({
          success: true,
          message: 'Translation request submitted successfully',
          messageId: validatedData.message_id,
          targetLanguage: validatedData.target_language,
          status: 'processing'
        });
      }

      // ===== CAS 2: NOUVEAU MESSAGE =====
      else {
        console.log(`✨ [GATEWAY] Nouveau message pour conversation ${validatedData.conversation_id}`);
        
        if (!validatedData.conversation_id) {
          return reply.status(400).send({
            success: false,
            error: 'conversation_id is required when message_id is not provided'
          });
        }

        const messageData = {
          conversationId: validatedData.conversation_id,
          content: validatedData.text,
          originalLanguage: validatedData.source_language || 'auto',
          targetLanguage: validatedData.target_language,
          modelType: validatedData.model_type || 'basic'
        };

        console.log(`📤 [GATEWAY] Transmission vers Translator (nouveau message):`, messageData);

        // DÉCLENCHEMENT NON-BLOQUANT - pas d'await !
        translationService.handleNewMessage(messageData).catch((error: any) => {
          console.error(`❌ [GATEWAY] Erreur lors du traitement asynchrone:`, error);
        });

        // RÉPONSE IMMÉDIATE - pas d'attente
        return reply.send({
          success: true,
          message: 'New message submitted for translation',
          conversationId: validatedData.conversation_id,
          targetLanguage: validatedData.target_language,
          status: 'processing'
        });
      }

    } catch (error) {
      console.error('❌ [GATEWAY] Erreur lors de la validation de la requête:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        });
      }
      
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // ===== ROUTE UTILITAIRE POUR RÉCUPÉRER LE STATUT =====
  fastify.get('/status/:messageId/:language', async (request: any, reply: FastifyReply) => {
    try {
      const { messageId, language } = request.params;
      
      const result = await translationService.getTranslation(messageId, language);
      
      if (result) {
        return reply.send({
          success: true,
          status: 'completed',
          translation: result
        });
      } else {
        return reply.send({
          success: true,
          status: 'processing'
        });
      }
    } catch (error) {
      console.error('❌ [GATEWAY] Erreur lors de la récupération du statut:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get translation status'
      });
    }
  });

  console.log('✅ [GATEWAY] Routes de traduction NON-BLOQUANTES initialisées');
}
