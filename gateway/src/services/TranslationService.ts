/**
 * Service de traduction haute performance pour Meeshy
 * Utilise l'architecture ZMQ PUB/SUB + REQ/REP avec pool de connexions
 */

import { PrismaClient } from '@prisma/client';
import { ZMQTranslationClient, TranslationRequest, TranslationResult } from './zmq-translation-client';

export interface MessageData {
  id?: string;
  conversationId: string;
  senderId?: string;
  anonymousSenderId?: string;
  content: string;
  originalLanguage: string;
  messageType?: string;
  replyToId?: string;
}

export interface TranslationServiceStats {
  messages_saved: number;
  translation_requests_sent: number;
  translations_received: number;
  errors: number;
  pool_full_rejections: number;
  avg_processing_time: number;
  uptime_seconds: number;
  memory_usage_mb: number;
}

export class TranslationService {
  private prisma: PrismaClient;
  private zmqClient: ZMQTranslationClient;
  private startTime: number = Date.now();
  
  // Cache mémoire pour les résultats récents
  private memoryCache: Map<string, TranslationResult> = new Map();
  private readonly CACHE_SIZE = 1000;
  
  // Statistiques
  private stats: TranslationServiceStats = {
    messages_saved: 0,
    translation_requests_sent: 0,
    translations_received: 0,
    errors: 0,
    pool_full_rejections: 0,
    avg_processing_time: 0,
    uptime_seconds: 0,
    memory_usage_mb: 0
  };

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    
    // Initialiser le client ZMQ avec l'architecture PUB/SUB
    this.zmqClient = new ZMQTranslationClient(
      process.env.ZMQ_TRANSLATOR_HOST || 'localhost',
      5555, // Port PUB pour envoyer les requêtes
      5556  // Port SUB pour recevoir les résultats
    );
    
    // Écouter les événements de traduction terminée
    this.zmqClient.on('translationCompleted', this._handleTranslationCompleted.bind(this));
    this.zmqClient.on('translationError', this._handleTranslationError.bind(this));
    
    console.log('🚀 TranslationService initialisé avec architecture PUB/SUB');
  }

  async initialize(): Promise<void> {
    try {
      await this.zmqClient.initialize();
      console.log('✅ TranslationService initialisé avec succès');
    } catch (error) {
      console.error('❌ Erreur initialisation TranslationService:', error);
      throw error;
    }
  }

  /**
   * Traite un nouveau message selon l'architecture spécifiée :
   * 1. Sauvegarde le message avec Prisma
   * 2. Libère le client immédiatement
   * 3. Traite les traductions en asynchrone
   */
  async handleNewMessage(messageData: MessageData): Promise<{ messageId: string; status: string }> {
    try {
      console.log(`📝 Traitement nouveau message pour conversation ${messageData.conversationId}`);
      
      // 1. SAUVEGARDER LE MESSAGE AVEC PRISMA
      const savedMessage = await this._saveMessageToDatabase(messageData);
      this.stats.messages_saved++;
      
      console.log(`✅ Message sauvegardé: ${savedMessage.id}`);
      
      // 2. LIBÉRER LE CLIENT IMMÉDIATEMENT
      const response = {
        messageId: savedMessage.id,
        status: 'message_saved',
        translation_queued: true
      };
      
      // 3. TRAITER LES TRADUCTIONS EN ASYNCHRONE (non-bloquant)
      setImmediate(async () => {
        try {
          await this._processTranslationsAsync(savedMessage);
        } catch (error) {
          console.error(`❌ Erreur traitement asynchrone des traductions: ${error}`);
          this.stats.errors++;
        }
      });
      
      return response;
      
    } catch (error) {
      console.error(`❌ Erreur traitement message: ${error}`);
      this.stats.errors++;
      throw error;
    }
  }

  private async _saveMessageToDatabase(messageData: MessageData) {
    try {
      const message = await this.prisma.message.create({
        data: {
          conversationId: messageData.conversationId,
          senderId: messageData.senderId || null,
          anonymousSenderId: messageData.anonymousSenderId || null,
          content: messageData.content,
          originalLanguage: messageData.originalLanguage,
          messageType: messageData.messageType || 'text',
          replyToId: messageData.replyToId || null
        }
      });
      
      // Mettre à jour lastMessageAt de la conversation
      await this.prisma.conversation.update({
        where: { id: messageData.conversationId },
        data: { lastMessageAt: new Date() }
      });
      
      return message;
      
    } catch (error) {
      console.error(`❌ Erreur sauvegarde message: ${error}`);
      throw error;
    }
  }

  private async _processTranslationsAsync(message: any) {
    try {
      console.log(`🔄 Démarrage traitement asynchrone des traductions pour ${message.id}`);
      
      // 1. EXTRAIRE LES LANGUES UNIQUES DE LA CONVERSATION
      const targetLanguages = await this._extractConversationLanguages(message.conversationId);
      
      if (targetLanguages.length === 0) {
        console.log(`ℹ️ Aucune langue cible trouvée pour la conversation ${message.conversationId}`);
        return;
      }
      
      console.log(`🌍 Langues cibles extraites: ${targetLanguages.join(', ')}`);
      
      // 2. ENVOYER LA REQUÊTE DE TRADUCTION VIA PUB
      const request: TranslationRequest = {
        messageId: message.id,
        text: message.content,
        sourceLanguage: message.originalLanguage,
        targetLanguages: targetLanguages,
        conversationId: message.conversationId,
        modelType: 'basic'
      };
      
      const taskId = await this.zmqClient.sendTranslationRequest(request);
      this.stats.translation_requests_sent++;
      
      console.log(`📤 Requête de traduction envoyée: ${taskId} (${targetLanguages.length} langues)`);
      
    } catch (error) {
      console.error(`❌ Erreur traitement asynchrone: ${error}`);
      this.stats.errors++;
    }
  }

  private async _extractConversationLanguages(conversationId: string): Promise<string[]> {
    try {
      const languages = new Set<string>();
      
      // Récupérer les membres de la conversation
      const members = await this.prisma.conversationMember.findMany({
        where: { 
          conversationId: conversationId,
          isActive: true 
        },
        include: {
          user: {
            select: {
              systemLanguage: true,
              regionalLanguage: true,
              customDestinationLanguage: true,
              autoTranslateEnabled: true,
              translateToSystemLanguage: true,
              translateToRegionalLanguage: true,
              useCustomDestination: true
            }
          }
        }
      });
      
      // Récupérer les participants anonymes
      const anonymousParticipants = await this.prisma.anonymousParticipant.findMany({
        where: { 
          conversationId: conversationId,
          isActive: true 
        }
      });
      
      // Extraire les langues des utilisateurs authentifiés
      for (const member of members) {
        if (member.user.autoTranslateEnabled) {
          if (member.user.translateToSystemLanguage) {
            languages.add(member.user.systemLanguage);
          }
          if (member.user.translateToRegionalLanguage) {
            languages.add(member.user.regionalLanguage);
          }
          if (member.user.useCustomDestination && member.user.customDestinationLanguage) {
            languages.add(member.user.customDestinationLanguage);
          }
        }
      }
      
      // Pour les participants anonymes, utiliser les langues par défaut
      if (anonymousParticipants.length > 0) {
        languages.add('fr'); // Français par défaut
        languages.add('en'); // Anglais par défaut
      }
      
      // Filtrer les langues identiques à la langue source
      const sourceLanguage = await this._getMessageSourceLanguage(conversationId);
      const filteredLanguages = Array.from(languages).filter(lang => lang !== sourceLanguage);
      
      console.log(`🌍 Langues extraites pour ${conversationId}: ${filteredLanguages.join(', ')}`);
      
      return filteredLanguages;
      
    } catch (error) {
      console.error(`❌ Erreur extraction langues: ${error}`);
      return ['en', 'fr']; // Fallback
    }
  }

  private async _getMessageSourceLanguage(conversationId: string): Promise<string> {
    try {
      const lastMessage = await this.prisma.message.findFirst({
        where: { conversationId: conversationId },
        orderBy: { createdAt: 'desc' },
        select: { originalLanguage: true }
      });
      
      return lastMessage?.originalLanguage || 'fr';
    } catch (error) {
      console.error(`❌ Erreur récupération langue source: ${error}`);
      return 'fr';
    }
  }

  private async _handleTranslationCompleted(data: { taskId: string; result: TranslationResult; targetLanguage: string }) {
    try {
      console.log(`📥 Traduction reçue: ${data.result.messageId} -> ${data.targetLanguage}`);
      
      this.stats.translations_received++;
      
      // Mettre en cache le résultat
      const cacheKey = `${data.result.messageId}_${data.targetLanguage}`;
      this._addToCache(cacheKey, data.result);
      
      // Sauvegarder en base de données
      await this._saveTranslationToDatabase(data.result);
      
      // Ici, vous pouvez émettre un événement WebSocket pour notifier les clients
      // this.emit('translationReady', data);
      
    } catch (error) {
      console.error(`❌ Erreur traitement traduction terminée: ${error}`);
      this.stats.errors++;
    }
  }

  private async _handleTranslationError(data: { taskId: string; messageId: string; error: string; conversationId: string }) {
    console.error(`❌ Erreur de traduction: ${data.error} pour ${data.messageId}`);
    
    if (data.error === 'translation pool full') {
      this.stats.pool_full_rejections++;
    }
    
    this.stats.errors++;
  }

  private _addToCache(key: string, result: TranslationResult) {
    // Gestion du cache LRU simple
    if (this.memoryCache.size >= this.CACHE_SIZE) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    
    this.memoryCache.set(key, result);
  }

  private async _saveTranslationToDatabase(result: TranslationResult) {
    try {
      const cacheKey = `${result.messageId}_${result.targetLanguage}`;
      
      await this.prisma.messageTranslation.upsert({
        where: { cacheKey: cacheKey },
        update: {
          translatedContent: result.translatedText,
          confidenceScore: result.confidenceScore,
          translationModel: result.modelType
        },
        create: {
          messageId: result.messageId,
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
          translatedContent: result.translatedText,
          translationModel: result.modelType,
          confidenceScore: result.confidenceScore,
          cacheKey: cacheKey
        }
      });
      
    } catch (error) {
      console.error(`❌ Erreur sauvegarde traduction: ${error}`);
    }
  }

  async getTranslation(messageId: string, targetLanguage: string): Promise<TranslationResult | null> {
    try {
      // Vérifier le cache mémoire
      const cacheKey = `${messageId}_${targetLanguage}`;
      const cachedResult = this.memoryCache.get(cacheKey);
      
      if (cachedResult) {
        console.log(`💾 Traduction trouvée en cache: ${messageId} -> ${targetLanguage}`);
        return cachedResult;
      }
      
      // Vérifier la base de données
      const dbTranslation = await this.prisma.messageTranslation.findUnique({
        where: { cacheKey: cacheKey }
      });
      
      if (dbTranslation) {
        const result: TranslationResult = {
          messageId: dbTranslation.messageId,
          translatedText: dbTranslation.translatedContent,
          sourceLanguage: dbTranslation.sourceLanguage,
          targetLanguage: dbTranslation.targetLanguage,
          confidenceScore: dbTranslation.confidenceScore || 0,
          processingTime: 0,
          modelType: dbTranslation.translationModel
        };
        
        // Mettre en cache
        this._addToCache(cacheKey, result);
        
        return result;
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Erreur récupération traduction: ${error}`);
      return null;
    }
  }

  getStats(): TranslationServiceStats {
    const uptime = (Date.now() - this.startTime) / 1000;
    
    return {
      ...this.stats,
      uptime_seconds: uptime,
      memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const zmqHealth = await this.zmqClient.healthCheck();
      return zmqHealth;
    } catch (error) {
      console.error(`❌ Health check échoué: ${error}`);
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await this.zmqClient.close();
      console.log('✅ TranslationService fermé');
    } catch (error) {
      console.error(`❌ Erreur fermeture TranslationService: ${error}`);
    }
  }
}
