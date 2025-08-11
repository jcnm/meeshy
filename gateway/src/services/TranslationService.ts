/**
 * Service de traduction haute performance pour Meeshy
 * Utilise l'architecture ZMQ PUB/SUB + REQ/REP avec pool de connexions
 */

import { PrismaClient } from '@prisma/client';
import { ZMQTranslationClient } from './zmq-translation-client';
import { logger } from '../utils/logger';

interface TranslationRequest {
  messageId: string;
  content: string;
  sourceLanguage: string;
  targetLanguage: string;
  modelType?: 'basic' | 'medium' | 'premium';
  conversationId?: string;
  participantIds?: string[];
}

interface TranslationResponse {
  messageId: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedContent: string;
  translationModel: string;
  cacheKey: string;
  cached: boolean;
  taskId?: string;
  processingTime?: number;
}

interface MultiLanguageTranslationRequest {
  messageId: string;
  content: string;
  sourceLanguage: string;
  targetLanguages: string[];
  modelType?: 'basic' | 'medium' | 'premium';
  conversationId?: string;
  participantIds?: string[];
}

interface MultiLanguageTranslationResponse {
  messageId: string;
  sourceLanguage: string;
  translations: Array<{
    targetLanguage: string;
    translatedContent: string;
    translationModel: string;
    cacheKey: string;
    cached: boolean;
    taskId?: string;
    processingTime?: number;
  }>;
}

export class TranslationService {
  private prisma: PrismaClient;
  private zmqClient: ZMQTranslationClient;
  private isInitialized = false;
  
  // Cache en mémoire pour les résultats récents
  private memoryCache = new Map<string, TranslationResponse>();
  private readonly maxCacheSize = 1000;
  
  // Statistiques
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    zmqRequests: 0,
    errors: 0,
    avgProcessingTime: 0
  };

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
    this.zmqClient = new ZMQTranslationClient(
      undefined, // port
      undefined, // host
      30000, // timeout 30s
      100, // max concurrent requests
      10 // pool size
    );
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initialisation du service de traduction haute performance...');
      
      // Initialiser le client ZMQ
      await this.zmqClient.initialize();
      
      // Écouter les événements de traduction terminée
      this.zmqClient.on('translationCompleted', this._handleTranslationCompleted.bind(this));
      
      this.isInitialized = true;
      logger.info('✅ Service de traduction haute performance initialisé');
      
    } catch (error) {
      logger.error('❌ Erreur initialisation service de traduction:', error);
      throw error;
    }
  }

  async translateMessage(request: TranslationRequest): Promise<TranslationResponse> {
    if (!this.isInitialized) {
      throw new Error('Service de traduction non initialisé');
    }

    this.stats.totalRequests++;
    const startTime = Date.now();

    try {
      // Générer la clé de cache
      const cacheKey = this._generateCacheKey(
        request.messageId,
        request.sourceLanguage,
        request.targetLanguage
      );

      // Vérifier le cache en mémoire
      const cachedResult = this.memoryCache.get(cacheKey);
      if (cachedResult) {
        this.stats.cacheHits++;
        logger.info(`💾 Cache hit pour ${cacheKey}`);
        return cachedResult;
      }

      // Vérifier le cache en base de données
      const dbCachedTranslation = await this.prisma.messageTranslation.findFirst({
        where: { cacheKey }
      });

      if (dbCachedTranslation) {
        this.stats.cacheHits++;
        const result: TranslationResponse = {
          messageId: request.messageId,
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
          translatedContent: dbCachedTranslation.translatedContent,
          translationModel: dbCachedTranslation.translationModel,
          cacheKey: cacheKey,
          cached: true
        };

        // Mettre en cache mémoire
        this._addToMemoryCache(cacheKey, result);
        
        logger.info(`💾 Cache DB hit pour ${cacheKey}`);
        return result;
      }

      this.stats.cacheMisses++;
      this.stats.zmqRequests++;

      // Appeler le service ZMQ haute performance
      const zmqResponse = await this.zmqClient.translateText({
        messageId: request.messageId,
        text: request.content,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        modelType: request.modelType || 'basic',
        conversationId: request.conversationId,
        participantIds: request.participantIds,
        requestType: 'conversation_translation'
      });

      const processingTime = Date.now() - startTime;
      this._updateAvgProcessingTime(processingTime);

      // Créer la réponse
      const result: TranslationResponse = {
        messageId: request.messageId,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        translatedContent: zmqResponse.translatedText,
        translationModel: zmqResponse.metadata?.modelUsed || 'basic',
        cacheKey: cacheKey,
        cached: false,
        taskId: zmqResponse.taskId,
        processingTime: zmqResponse.metadata?.processingTimeMs
      };

      // Sauvegarder en base de données (asynchrone)
      this._saveTranslationToDatabase(result, zmqResponse).catch(error => {
        logger.error('❌ Erreur sauvegarde traduction en DB:', error);
      });

      // Mettre en cache mémoire
      this._addToMemoryCache(cacheKey, result);

      logger.info(`✅ Traduction terminée: ${request.content.substring(0, 50)}... → ${zmqResponse.translatedText.substring(0, 50)}...`);
      return result;

    } catch (error) {
      this.stats.errors++;
      logger.error('❌ Erreur traduction:', error);
      
      // Fallback en cas d'erreur
      const fallbackResult: TranslationResponse = {
        messageId: request.messageId,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        translatedContent: `[ERREUR-TRADUCTION] ${request.content}`,
        translationModel: 'error-fallback',
        cacheKey: this._generateCacheKey(request.messageId, request.sourceLanguage, request.targetLanguage),
        cached: false
      };

      return fallbackResult;
    }
  }

  async translateToMultipleLanguages(request: MultiLanguageTranslationRequest): Promise<MultiLanguageTranslationResponse> {
    if (!this.isInitialized) {
      throw new Error('Service de traduction non initialisé');
    }

    this.stats.totalRequests++;
    const startTime = Date.now();

    try {
      logger.info(`🌍 Traduction multi-langues: ${request.targetLanguages.join(', ')}`);

      // Utiliser la méthode haute performance du client ZMQ
      const zmqResponses = await this.zmqClient.translateToMultipleLanguages(
        request.content,
        request.sourceLanguage,
        request.targetLanguages,
        request.modelType
      );

      const processingTime = Date.now() - startTime;
      this._updateAvgProcessingTime(processingTime);

      // Traiter les résultats
      const translations = await Promise.all(
        zmqResponses.map(async (zmqResponse, index) => {
          const targetLang = request.targetLanguages[index];
          const cacheKey = this._generateCacheKey(request.messageId, request.sourceLanguage, targetLang);

          const translation = {
            targetLanguage: targetLang,
            translatedContent: zmqResponse.translatedText,
            translationModel: zmqResponse.metadata?.modelUsed || 'basic',
            cacheKey: cacheKey,
            cached: false,
            taskId: zmqResponse.taskId,
            processingTime: zmqResponse.metadata?.processingTimeMs
          };

          // Sauvegarder en base de données (asynchrone)
          this._saveTranslationToDatabase({
            messageId: request.messageId,
            sourceLanguage: request.sourceLanguage,
            targetLanguage: targetLang,
            translatedContent: zmqResponse.translatedText,
            translationModel: zmqResponse.metadata?.modelUsed || 'basic',
            cacheKey: cacheKey,
            cached: false
          }, zmqResponse).catch(error => {
            logger.error(`❌ Erreur sauvegarde traduction ${targetLang}:`, error);
          });

          return translation;
        })
      );

      const result: MultiLanguageTranslationResponse = {
        messageId: request.messageId,
        sourceLanguage: request.sourceLanguage,
        translations
      };

      logger.info(`✅ Traduction multi-langues terminée: ${translations.length} langues`);
      return result;

    } catch (error) {
      this.stats.errors++;
      logger.error('❌ Erreur traduction multi-langues:', error);
      
      // Fallback en cas d'erreur
      const fallbackTranslations = request.targetLanguages.map(targetLang => ({
        targetLanguage: targetLang,
        translatedContent: `[ERREUR-TRADUCTION] ${request.content}`,
        translationModel: 'error-fallback',
        cacheKey: this._generateCacheKey(request.messageId, request.sourceLanguage, targetLang),
        cached: false
      }));

      return {
        messageId: request.messageId,
        sourceLanguage: request.sourceLanguage,
        translations: fallbackTranslations
      };
    }
  }

  private async _handleTranslationCompleted(data: { taskId: string; result: any }): Promise<void> {
    try {
      logger.info(`📥 Traduction terminée reçue: ${data.taskId}`);
      
      // Ici on peut traiter les traductions terminées si nécessaire
      // Par exemple, envoyer des notifications aux clients via WebSocket
      
    } catch (error) {
      logger.error('❌ Erreur traitement traduction terminée:', error);
    }
  }

  private async _saveTranslationToDatabase(result: TranslationResponse, zmqResponse: any): Promise<void> {
    try {
      await this.prisma.messageTranslation.create({
        data: {
          messageId: result.messageId,
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
          translatedContent: result.translatedContent,
          translationModel: result.translationModel,
          cacheKey: result.cacheKey,
          confidenceScore: zmqResponse.metadata?.confidenceScore || 0.8
        }
      });
    } catch (error) {
      logger.error('❌ Erreur sauvegarde traduction en DB:', error);
      throw error;
    }
  }

  private _generateCacheKey(messageId: string, sourceLanguage: string, targetLanguage: string): string {
    return `${messageId}_${sourceLanguage}_${targetLanguage}`;
  }

  private _addToMemoryCache(key: string, value: TranslationResponse): void {
    // Gestion de la taille du cache
    if (this.memoryCache.size >= this.maxCacheSize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    
    this.memoryCache.set(key, value);
  }

  private _updateAvgProcessingTime(newTime: number): void {
    const total = this.stats.totalRequests;
    if (total > 0) {
      this.stats.avgProcessingTime = (
        (this.stats.avgProcessingTime * (total - 1) + newTime) / total
      );
    } else {
      this.stats.avgProcessingTime = newTime;
    }
  }

  async getStats(): Promise<any> {
    const zmqStats = await this.zmqClient.getStats();
    const clientStats = this.zmqClient.getClientStats();
    
    return {
      service: {
        ...this.stats,
        memoryCacheSize: this.memoryCache.size,
        isInitialized: this.isInitialized
      },
      zmqServer: zmqStats,
      zmqClient: clientStats
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      return await this.zmqClient.healthCheck();
    } catch (error) {
      logger.error('❌ Health check échoué:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    logger.info('🛑 Fermeture du service de traduction...');
    
    this.isInitialized = false;
    await this.zmqClient.close();
    
    logger.info('✅ Service de traduction fermé');
  }
}
