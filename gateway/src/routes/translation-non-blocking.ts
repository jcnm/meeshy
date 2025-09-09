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
  // Récupérer les services depuis l'instance fastify (comme dans translation.ts)
  const translationService = (fastify as any).translationService;
  const messagingService = (fastify as any).messagingService;
  
  if (!translationService) {
    throw new Error('TranslationService not provided to translation routes');
  }
  
  if (!messagingService) {
    throw new Error('MessagingService not provided to translation routes');
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

        // Résoudre l'ID de conversation réel
        let resolvedConversationId = validatedData.conversation_id;
        
        // Si ce n'est pas un ObjectId MongoDB, chercher par identifier
        if (!/^[0-9a-fA-F]{24}$/.test(validatedData.conversation_id)) {
          const conversation = await fastify.prisma.conversation.findFirst({
            where: { identifier: validatedData.conversation_id }
          });
          
          if (!conversation) {
            return reply.status(404).send({
              success: false,
              error: `Conversation with identifier '${validatedData.conversation_id}' not found`
            });
          }
          
          resolvedConversationId = conversation.id;
          console.log(`🔍 [GATEWAY] Conversation ID résolu: ${validatedData.conversation_id} -> ${resolvedConversationId}`);
        }

        // Utiliser le MessagingService pour sauvegarder le message (même pipeline que WebSocket)
        const messageRequest = {
          conversationId: resolvedConversationId,
          content: validatedData.text,
          originalLanguage: validatedData.source_language || 'auto',
          messageType: 'text',
          isAnonymous: false, // TODO: Détecter depuis l'auth
          anonymousDisplayName: undefined
        };

        console.log(`📤 [GATEWAY] Utilisation du MessagingService pour nouveau message:`, messageRequest);

        // DÉCLENCHEMENT NON-BLOQUANT - pas d'await !
        messagingService.handleMessage(
          messageRequest,
          'system', // TODO: Récupérer l'ID utilisateur depuis l'auth
          true,
          undefined, // JWT token
          undefined  // Session token
        ).catch((error: any) => {
          console.error(`❌ [GATEWAY] Erreur lors du traitement asynchrone:`, error);
        });

        // RÉPONSE IMMÉDIATE - pas d'attente
        return reply.send({
          success: true,
          message: 'New message submitted for processing',
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

  // ===== ROUTE POUR RÉCUPÉRER UNE CONVERSATION PAR IDENTIFIANT =====
  fastify.get<{ Params: { identifier: string } }>('/conversation/:identifier', async (request: FastifyRequest<{ Params: { identifier: string } }>, reply: FastifyReply) => {
    try {
      const { identifier } = request.params;
      
      console.log(`🔍 [GATEWAY] Recherche conversation avec identifiant: ${identifier}`);
      
      // Chercher la conversation par identifiant
      const conversation = await fastify.prisma.conversation.findFirst({
        where: { identifier: identifier },
        select: {
          id: true,
          identifier: true,
          title: true,
          type: true,
          createdAt: true,
          lastMessageAt: true,
          _count: {
            select: {
              messages: true,
              members: true
            }
          }
        }
      });
      
      if (!conversation) {
        return reply.status(404).send({
          success: false,
          error: `Conversation avec l'identifiant '${identifier}' non trouvée`
        });
      }
      
      console.log(`✅ [GATEWAY] Conversation trouvée: ${conversation.id}`);
      
      return reply.send({
        success: true,
        data: {
          id: conversation.id, // ObjectId MongoDB
          identifier: conversation.identifier,
          title: conversation.title,
          type: conversation.type,
          createdAt: conversation.createdAt,
          lastMessageAt: conversation.lastMessageAt,
          messageCount: conversation._count.messages,
          memberCount: conversation._count.members
        }
      });
      
    } catch (error) {
      console.error('❌ [GATEWAY] Erreur lors de la récupération de la conversation:', error);
      
      return reply.status(500).send({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  });

  console.log('✅ [GATEWAY] Routes de traduction NON-BLOQUANTES initialisées');
}
