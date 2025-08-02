/**
 * Client gRPC pour le service de traduction Meeshy
 * Intégration avec le WebSocket handler pour traduction en temps réel
 */

import { createChannel, createClient, Metadata, ClientOptions } from 'nice-grpc';
import { 
  TranslationServiceDefinition,
  TranslateRequest,
  TranslateResponse,
  TranslateMultipleRequest,
  TranslateMultipleResponse,
  DetectLanguageRequest,
  DetectLanguageResponse,
  SupportedLanguagesRequest,
  SupportedLanguagesResponse,
  ServiceStatsRequest,
  ServiceStatsResponse
} from './generated/translation';
import { logger } from '../utils/logger';

export interface TranslationResult {
  translated_text: string;
  detected_source_language: string;
  confidence_score: number;
  model_tier: 'basic' | 'medium' | 'premium';
  processing_time_ms: number;
  from_cache: boolean;
}

export interface MultipleTranslationResult {
  translations: Array<{
    target_language: string;
    translated_text: string;
    confidence_score: number;
    model_tier: 'basic' | 'medium' | 'premium';
    processing_time_ms: number;
    from_cache: boolean;
  }>;
  detected_source_language: string;
}

export interface LanguageDetectionResult {
  detected_language: string;
  confidence_score: number;
  complexity_score: number;
  recommended_model_tier: 'basic' | 'medium' | 'premium';
}

export interface ServiceStats {
  cache_size: number;
  supported_languages_count: number;
  models_loaded_count: number;
  device_info: string;
  service_ready: boolean;
}

export class MeeshyTranslationClient {
  private client: ReturnType<typeof createClient<TranslationServiceDefinition>>;
  private channel: any;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // 1 seconde

  constructor(
    private host: string = process.env.TRANSLATION_SERVICE_HOST || 'localhost',
    private port: number = parseInt(process.env.TRANSLATION_SERVICE_PORT || '50051')
  ) {
    this.initialize();
  }

  private initialize(): void {
    try {
      const address = `${this.host}:${this.port}`;
      logger.info(`🔌 Connexion au service de traduction: ${address}`);

      this.channel = createChannel(address);
      this.client = createClient(TranslationServiceDefinition, this.channel);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      logger.info('✅ Client gRPC de traduction initialisé');
    } catch (error) {
      logger.error('❌ Erreur initialisation client gRPC:', error);
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      
      logger.warn(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${delay}ms`);
      
      setTimeout(() => {
        this.initialize();
      }, delay);
    } else {
      logger.error('❌ Nombre maximum de tentatives de reconnexion atteint');
    }
  }

  /**
   * Traduit un texte vers une langue cible
   */
  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<TranslationResult | null> {
    if (!this.isConnected) {
      logger.error('❌ Service de traduction non connecté');
      return null;
    }

    try {
      const request: TranslateRequest = {
        text,
        target_language: targetLanguage,
        source_language: sourceLanguage || ''
      };

      const response = await this.client.translateText(request);

      const result: TranslationResult = {
        translated_text: response.translated_text,
        detected_source_language: response.detected_source_language,
        confidence_score: response.confidence_score,
        model_tier: response.model_tier as 'basic' | 'medium' | 'premium',
        processing_time_ms: response.processing_time_ms,
        from_cache: response.from_cache
      };

      logger.info(`✅ Traduction réussie: ${sourceLanguage || 'auto'} -> ${targetLanguage} (${response.model_tier}, ${response.processing_time_ms}ms)`);
      return result;

    } catch (error) {
      logger.error('❌ Erreur traduction:', error);
      
      // Tentative de reconnexion en cas d'erreur
      this.isConnected = false;
      this.scheduleReconnect();
      
      return null;
    }
  }

  /**
   * Traduit un texte vers plusieurs langues en parallèle
   */
  async translateMultiple(
    text: string,
    targetLanguages: string[],
    sourceLanguage?: string
  ): Promise<MultipleTranslationResult | null> {
    if (!this.isConnected) {
      logger.error('❌ Service de traduction non connecté');
      return null;
    }

    try {
      const request: TranslateMultipleRequest = {
        text,
        target_languages: targetLanguages,
        source_language: sourceLanguage || ''
      };

      const response = await this.client.translateMultiple(request);

      const result: MultipleTranslationResult = {
        translations: response.translations.map(t => ({
          target_language: t.target_language,
          translated_text: t.translated_text,
          confidence_score: t.confidence_score,
          model_tier: t.model_tier as 'basic' | 'medium' | 'premium',
          processing_time_ms: t.processing_time_ms,
          from_cache: t.from_cache
        })),
        detected_source_language: response.detected_source_language
      };

      logger.info(`✅ Traduction multiple réussie: ${targetLanguages.length} langues`);
      return result;

    } catch (error) {
      logger.error('❌ Erreur traduction multiple:', error);
      
      this.isConnected = false;
      this.scheduleReconnect();
      
      return null;
    }
  }

  /**
   * Détecte la langue d'un texte avec analyse de complexité
   */
  async detectLanguage(text: string): Promise<LanguageDetectionResult | null> {
    if (!this.isConnected) {
      logger.error('❌ Service de traduction non connecté');
      return null;
    }

    try {
      const request: DetectLanguageRequest = { text };
      const response = await this.client.detectLanguage(request);

      const result: LanguageDetectionResult = {
        detected_language: response.detected_language,
        confidence_score: response.confidence_score,
        complexity_score: response.complexity_score,
        recommended_model_tier: response.recommended_model_tier as 'basic' | 'medium' | 'premium'
      };

      logger.info(`✅ Langue détectée: ${response.detected_language} (confiance: ${response.confidence_score.toFixed(2)}, complexité: ${response.complexity_score.toFixed(2)})`);
      return result;

    } catch (error) {
      logger.error('❌ Erreur détection langue:', error);
      
      this.isConnected = false;
      this.scheduleReconnect();
      
      return null;
    }
  }

  /**
   * Récupère la liste des langues supportées
   */
  async getSupportedLanguages(): Promise<string[] | null> {
    if (!this.isConnected) {
      logger.error('❌ Service de traduction non connecté');
      return null;
    }

    try {
      const request: SupportedLanguagesRequest = {};
      const response = await this.client.getSupportedLanguages(request);

      logger.info(`✅ Langues supportées récupérées: ${response.languages.length} langues`);
      return response.languages;

    } catch (error) {
      logger.error('❌ Erreur récupération langues supportées:', error);
      
      this.isConnected = false;
      this.scheduleReconnect();
      
      return null;
    }
  }

  /**
   * Récupère les statistiques du service
   */
  async getServiceStats(): Promise<ServiceStats | null> {
    if (!this.isConnected) {
      logger.error('❌ Service de traduction non connecté');
      return null;
    }

    try {
      const request: ServiceStatsRequest = {};
      const response = await this.client.getServiceStats(request);

      const result: ServiceStats = {
        cache_size: response.cache_size,
        supported_languages_count: response.supported_languages_count,
        models_loaded_count: response.models_loaded_count,
        device_info: response.device_info,
        service_ready: response.service_ready
      };

      logger.info('✅ Statistiques du service récupérées');
      return result;

    } catch (error) {
      logger.error('❌ Erreur récupération statistiques:', error);
      
      this.isConnected = false;
      this.scheduleReconnect();
      
      return null;
    }
  }

  /**
   * Vérifie si le service est connecté et prêt
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Ferme la connexion proprement
   */
  async close(): Promise<void> {
    try {
      if (this.channel) {
        this.channel.close();
        this.isConnected = false;
        logger.info('✅ Connexion gRPC fermée proprement');
      }
    } catch (error) {
      logger.error('❌ Erreur fermeture connexion gRPC:', error);
    }
  }

  /**
   * Traduction en temps réel pour les messages WebSocket
   * Optimisée pour les conversations
   */
  async translateForChat(
    text: string,
    targetLanguages: string[],
    userId: string,
    conversationId: string
  ): Promise<MultipleTranslationResult | null> {
    const startTime = Date.now();

    // Ajouter des métadonnées de contexte
    const metadata = new Metadata();
    metadata.set('user-id', userId);
    metadata.set('conversation-id', conversationId);
    metadata.set('request-type', 'chat');

    try {
      // Détection rapide de langue si nécessaire
      const detection = await this.detectLanguage(text);
      const sourceLanguage = detection?.detected_language || 'auto';

      // Traduction vers toutes les langues cibles
      const result = await this.translateMultiple(text, targetLanguages, sourceLanguage);

      if (result) {
        const totalTime = Date.now() - startTime;
        logger.info(`💬 Traduction chat complétée en ${totalTime}ms pour conversation ${conversationId}`);
      }

      return result;

    } catch (error) {
      logger.error(`❌ Erreur traduction chat pour conversation ${conversationId}:`, error);
      return null;
    }
  }
}

// Instance singleton
export const translationClient = new MeeshyTranslationClient();

// Gestion propre de la fermeture
process.on('SIGTERM', async () => {
  await translationClient.close();
});

process.on('SIGINT', async () => {
  await translationClient.close();
});

export default translationClient;
