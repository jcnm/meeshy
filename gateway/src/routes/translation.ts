import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { TranslationService } from '../services/TranslationService';
import { logError } from '../utils/logger';

// Schémas de validation
const TranslateRequestSchema = z.object({
  text: z.string().min(1).max(1000),
  source_language: z.string().min(2).max(5).optional(),
  target_language: z.string().min(2).max(5),
  model_type: z.enum(['basic', 'medium', 'premium']).optional(), // Optional car on peut le prédire automatiquement
  message_id: z.string().optional(), // ID du message pour retraduction
  conversation_id: z.string().optional() // ID de conversation pour nouveaux messages
});

interface TranslateRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  modelType?: 'basic' | 'medium' | 'premium';
  messageId?: string;
  conversationId?: string;
}

interface TranslationResult {
  translated_text: string;
  source_language: string;
  target_language: string;
  original_text: string;
  model_used: string;
  confidence: number;
  processing_time: number;
  from_cache: boolean;
  cache_key?: string;
}

// Fonction pour prédire le type de modèle selon la taille du texte
function getPredictedModelType(textLength: number): 'basic' | 'medium' | 'premium' {
  if (textLength < 20) return 'basic';
  if (textLength <= 100) return 'medium';
  return 'premium';
}



export async function translationRoutes(fastify: FastifyInstance) {
  // Récupérer le service de traduction depuis les options
  const translationService = (fastify as any).translationService;
  
  if (!translationService) {
    throw new Error('TranslationService not provided to translation routes');
  }
  
  // Route principale de traduction
  fastify.post<{ Body: TranslateRequest }>('/translate', async (request: FastifyRequest<{ Body: TranslateRequest }>, reply: FastifyReply) => {
    try {
      const validatedData = TranslateRequestSchema.parse(request.body);
      
      console.log(`🌐 [GATEWAY] Nouvelle requête de traduction reçue:`, {
        text: validatedData.text,
        sourceLanguage: validatedData.source_language,
        targetLanguage: validatedData.target_language,
        modelType: validatedData.model_type || 'basic',
        messageId: validatedData.message_id,
        conversationId: validatedData.conversation_id
      });
      
      const startTime = Date.now();
      
      // Déterminer le type de modèle automatiquement si non spécifié ou si 'basic'
      const finalModelType = validatedData.model_type === 'basic'
        ? getPredictedModelType(validatedData.text.length)
        : (validatedData.model_type || 'basic');
      
      let result: any;
      let messageId: string;
      
      // Gérer les deux cas : nouveau message vs retraduction
      if (validatedData.message_id) {
        // Cas 1: Retraduction d'un message existant
        console.log(`🔄 [GATEWAY] Retraduction du message ${validatedData.message_id}`);
        
        // Utiliser le modèle medium pour les retraductions
        const retranslationModelType = 'medium';
        
        // Créer les données du message pour retraduction
        const messageData: any = {
          id: validatedData.message_id,
          conversationId: validatedData.conversation_id || 'rest-retranslation',
          content: validatedData.text,
          originalLanguage: validatedData.source_language || 'auto',
          targetLanguage: validatedData.target_language, // Passer la langue cible
          modelType: finalModelType
        };
        
        // Appeler handleNewMessage qui gère la retraduction
        const handleResult = await translationService.handleNewMessage(messageData);
        messageId = handleResult.messageId;
        
        // Attendre un peu pour que la traduction soit traitée
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Récupérer le résultat de traduction
        result = await translationService.getTranslation(messageId, validatedData.target_language);
        
        if (!result) {
          // Fallback si la traduction n'est pas encore disponible
          result = {
            translatedText: `[${validatedData.target_language.toUpperCase()}] ${validatedData.text}`,
            sourceLanguage: validatedData.source_language || 'auto',
            targetLanguage: validatedData.target_language,
            confidenceScore: 0.1,
            processingTime: 0.001,
            modelType: 'fallback'
          };
        }
        
      } else {
        // Cas 2: Nouveau message (comportement WebSocket)
        console.log(`📝 [GATEWAY] Nouveau message pour conversation ${validatedData.conversation_id}`);
        
        if (!validatedData.conversation_id) {
          return reply.status(400).send({
            success: false,
            error: 'conversation_id is required when message_id is not provided'
          });
        }
        
        // Créer les données du message
        const messageData: any = {
          conversationId: validatedData.conversation_id,
          content: validatedData.text,
          originalLanguage: validatedData.source_language || 'auto',
          targetLanguage: validatedData.target_language, // Passer la langue cible
          modelType: finalModelType
        };
        
        // Appeler handleNewMessage qui gère le nouveau message
        const handleResult = await translationService.handleNewMessage(messageData);
        messageId = handleResult.messageId;
        
        // Attendre un peu pour que la traduction soit traitée
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Récupérer le résultat de traduction
        result = await translationService.getTranslation(messageId, validatedData.target_language);
        
        if (!result) {
          // Fallback si la traduction n'est pas encore disponible
          result = {
            translatedText: `[${validatedData.target_language.toUpperCase()}] ${validatedData.text}`,
            sourceLanguage: validatedData.source_language || 'auto',
            targetLanguage: validatedData.target_language,
            confidenceScore: 0.1,
            processingTime: 0.001,
            modelType: 'fallback'
          };
        }
      }

      const processingTime = (Date.now() - startTime) / 1000;

      console.log(`✅ [GATEWAY] Traduction terminée en ${processingTime}s:`, {
        messageId: messageId,
        original: validatedData.text,
        translated: result.translatedText,
        modelUsed: result.modelType,
        confidence: result.confidenceScore
      });

      return {
        success: true,
        data: {
          message_id: messageId,
          translated_text: result.translatedText,
          original_text: validatedData.text,
          source_language: result.sourceLanguage,
          target_language: result.targetLanguage,
          confidence: result.confidenceScore,
          processing_time: processingTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(request.log, 'Translation error:', error);
      
      // Extraction sécurisée des données de la requête
      const requestBody = request.body as Partial<{ 
        text: string; 
        source_language: string; 
        target_language: string; 
      }>;
      const fallbackTranslation = `[${requestBody.target_language?.toUpperCase() || 'XX'}] ${requestBody.text || 'Error'}`;
      
      return reply.status(200).send({
        success: true,
        data: {
          translated_text: fallbackTranslation,
          source_language: requestBody.source_language || 'auto',
          target_language: requestBody.target_language || 'en',
          original_text: requestBody.text || '',
          model_used: 'fallback',
          confidence: 0.1,
          processing_time: 0.001,
          from_cache: false,
          error: errorMessage,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // Route pour obtenir les langues supportées
  fastify.get('/languages', async () => {
    return {
      success: true,
      data: {
        languages: [
          { code: 'fr', name: 'Français', flag: '🇫🇷' },
          { code: 'en', name: 'English', flag: '🇺🇸' },
          { code: 'es', name: 'Español', flag: '🇪🇸' },
          { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
          { code: 'pt', name: 'Português', flag: '🇵🇹' },
          { code: 'zh', name: '中文', flag: '🇨🇳' },
          { code: 'ja', name: '日本語', flag: '🇯🇵' },
          { code: 'ar', name: 'العربية', flag: '🇸🇦' }
        ]
      }
    };
  });

  // Route pour détecter la langue
  fastify.post<{ Body: { text: string } }>('/detect-language', async (request: FastifyRequest<{ Body: { text: string } }>, reply: FastifyReply) => {
    try {
      const { text } = request.body;
      
      if (!text || text.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Text is required'
        });
      }

      // Détection simple basée sur des patterns
      let detectedLanguage = 'en';
      let confidence = 0.5;

      // Détection basique par patterns
      if (/[àáâäçèéêëìíîïñòóôöùúûüÿ]/i.test(text)) {
        detectedLanguage = 'fr';
        confidence = 0.7;
      } else if (/[ñáéíóúü]/i.test(text)) {
        detectedLanguage = 'es';
        confidence = 0.7;
      } else if (/[äöüß]/i.test(text)) {
        detectedLanguage = 'de';
        confidence = 0.7;
      }

      return {
        success: true,
        data: {
          language: detectedLanguage,
          confidence: confidence,
          text: text
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown language detection error';
      logError(request.log, 'Language detection error:', error);
      return reply.status(500).send({
        success: false,
        error: errorMessage
      });
    }
  });

  // Route de test pour le service de traduction
  fastify.get('/test', async () => {
    try {
      // Test avec un nouveau message (comportement WebSocket)
      const messageData: any = {
        conversationId: 'test-conversation',
        content: 'Hello world',
        originalLanguage: 'en'
      };
      
      const handleResult = await translationService.handleNewMessage(messageData);
      
      // Attendre un peu pour que la traduction soit traitée
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Récupérer le résultat de traduction
      const testResult = await translationService.getTranslation(handleResult.messageId, 'fr');
      
      if (!testResult) {
        return {
          success: false,
          message: 'Translation service test failed - no result available',
          message_id: handleResult.messageId
        };
      }

      return {
        success: true,
        message: 'Translation service is working',
        message_id: handleResult.messageId,
        test_result: {
          translated_text: testResult.translatedText,
          source_language: testResult.sourceLanguage,
          target_language: testResult.targetLanguage,
          model_used: testResult.modelType,
          confidence: testResult.confidenceScore
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown translation test error';
      return {
        success: false,
        message: 'Translation service test failed',
        error: errorMessage
      };
    }
  });
}
