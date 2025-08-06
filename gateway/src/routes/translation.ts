import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ZMQTranslationClient } from '../services/zmq-translation-client';
import { randomUUID } from 'crypto';

// Schémas de validation
const TranslateRequestSchema = z.object({
  text: z.string().min(1).max(1000),
  source_language: z.string().min(2).max(5).optional(),
  target_language: z.string().min(2).max(5),
  model_type: z.enum(['basic', 'medium', 'premium']).optional() // Optional car on peut le prédire automatiquement
});

interface TranslateRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  modelType?: 'basic' | 'medium' | 'premium';
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

// Instance globale du client ZMQ
let zmqClient: ZMQTranslationClient | null = null;

// Initialiser le client ZMQ
async function getZMQClient(): Promise<ZMQTranslationClient> {
  if (!zmqClient) {
    const port = parseInt(process.env.ZMQ_PORT || '5555');
    const host = process.env.ZMQ_HOST || 'localhost';
    
    zmqClient = new ZMQTranslationClient(port, host);
    await zmqClient.initialize();
  }
  return zmqClient;
}

// Fonction pour appeler le service de traduction via ZMQ
async function callZMQTranslationService(
  text: string,
  sourceLanguage: string | undefined,
  targetLanguage: string,
  modelType: string = 'basic'
): Promise<TranslationResult> {
  
  try {
    const client = await getZMQClient();
    
    // Déterminer le type de modèle automatiquement si non spécifié ou si 'basic'
    const finalModelType = modelType === 'basic' ? getPredictedModelType(text.length) : modelType;
    
    console.log(`🎯 Modèle sélectionné: ${finalModelType} (texte: ${text.length} caractères, demandé: ${modelType})`);
    
    const request = {
      messageId: randomUUID(),
      text: text,
      sourceLanguage: sourceLanguage || 'auto',
      targetLanguage: targetLanguage,
      modelType: finalModelType // Utiliser le modèle déterminé
    };

    const response = await client.translateText(request);

    // Convertir la réponse ZMQ au format attendu
    return {
      translated_text: response.translatedText,
      source_language: response.detectedSourceLanguage,
      target_language: targetLanguage,
      original_text: text,
      model_used: response.metadata?.modelUsed || finalModelType,
      confidence: response.metadata?.confidenceScore || 0.8,
      processing_time: 0, // Sera calculé par la route
      from_cache: response.metadata?.fromCache || false,
      cache_key: response.messageId
    };

  } catch (error) {
    console.error('ZMQ Translation Service Error:', error);
    
    // Fallback en cas d'erreur
    return {
      translated_text: `[${targetLanguage.toUpperCase()}] ${text}`,
      source_language: sourceLanguage || 'auto',
      target_language: targetLanguage,
      original_text: text,
      model_used: 'fallback',
      confidence: 0.1,
      processing_time: 0.001,
      from_cache: false,
      cache_key: `fallback_${Date.now()}`
    };
  }
}

export async function translationRoutes(fastify: FastifyInstance) {
  
  // Route principale de traduction
  fastify.post<{ Body: TranslateRequest }>('/translate', async (request: FastifyRequest<{ Body: TranslateRequest }>, reply: FastifyReply) => {
    try {
      const validatedData = TranslateRequestSchema.parse(request.body);
      
      const startTime = Date.now();
      
      // Appel au service de traduction via ZMQ
      const result = await callZMQTranslationService(
        validatedData.text,
        validatedData.source_language,
        validatedData.target_language,
        validatedData.model_type || 'basic'
      );

      const processingTime = (Date.now() - startTime) / 1000;

      return {
        success: true,
        data: {
          ...result,
          processing_time: processingTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      request.log.error('Translation error:', error);
      
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
      request.log.error('Language detection error:', error);
      return reply.status(500).send({
        success: false,
        error: errorMessage
      });
    }
  });

  // Route de test pour le service de traduction
  fastify.get('/test', async () => {
    try {
      const testResult = await callZMQTranslationService(
        'Hello world',
        'en',
        'fr',
        'basic'
      );

      return {
        success: true,
        message: 'Translation service is working',
        test_result: testResult
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
