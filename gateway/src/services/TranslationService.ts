/**
 * Service de traduction haute performance pour Meeshy
 * Utilise l'architecture ZMQ PUB/SUB + REQ/REP avec pool de connexions
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '../../shared/prisma/client';
import { ZMQTranslationClient, TranslationRequest, TranslationResult } from './zmq-translation-client';
import { ZMQSingleton } from './zmq-singleton';

export interface MessageData {
  id?: string;
  conversationId: string;
  senderId?: string;
  anonymousSenderId?: string;
  content: string;
  originalLanguage: string;
  messageType?: string;
  replyToId?: string;
  targetLanguage?: string; // Langue cible spécifique pour la traduction
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

export class TranslationService extends EventEmitter {
  private prisma: PrismaClient;
  private zmqClient: ZMQTranslationClient | null = null;
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

  private processedMessages = new Set<string>();
  private processedTasks = new Set<string>();

  constructor(prisma: PrismaClient) {
    super(); // Appel au constructeur EventEmitter
    this.prisma = prisma;
    console.log('[GATEWAY] 🚀 TranslationService initialisé avec architecture PUB/SUB');
  }

  async initialize(): Promise<void> {
    try {
      console.log('[GATEWAY] 🔧 Initialisation TranslationService...');
      
      // Utiliser le singleton ZMQ
      this.zmqClient = await ZMQSingleton.getInstance();
      console.log('[GATEWAY] ✅ ZMQ Client obtenu:', this.zmqClient ? 'OK' : 'NULL');
      
      // Écouter les événements de traduction terminée
      this.zmqClient.on('translationCompleted', this._handleTranslationCompleted.bind(this));
      this.zmqClient.on('translationError', this._handleTranslationError.bind(this));
      
      // Test de réception après initialisation
      setTimeout(async () => {
        try {
          console.log('[GATEWAY] 🧪 Test de réception après initialisation...');
          await this.zmqClient.testReception();
        } catch (error) {
          console.error('[GATEWAY] ❌ Erreur test réception:', error);
        }
      }, 3000);
      
      console.log('[GATEWAY] ✅ TranslationService initialisé avec succès');
    } catch (error) {
      console.error('[GATEWAY] ❌ Erreur initialisation TranslationService:', error);
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
      console.log(`📝 Traitement message pour conversation ${messageData.conversationId}`);
      
      let messageId: string;
      let isRetranslation = false;
      
      // Vérifier si c'est une retraduction (message avec ID existant)
      if (messageData.id) {
        console.log(`🔄 Retraduction détectée pour le message ${messageData.id}`);
        messageId = messageData.id;
        isRetranslation = true;
        
        // Vérifier que le message existe en base
        const existingMessage = await this.prisma.message.findUnique({
          where: { id: messageData.id }
        });
        
        if (!existingMessage) {
          throw new Error(`Message ${messageData.id} non trouvé en base de données`);
        }
        
        console.log(`✅ Message existant trouvé: ${messageData.id}`);
      } else {
        // Nouveau message - sauvegarder en base
        console.log(`📝 Nouveau message - sauvegarde en base`);
        const savedMessage = await this._saveMessageToDatabase(messageData);
        messageId = savedMessage.id;
        this.stats.messages_saved++;
        console.log(`✅ Nouveau message sauvegardé: ${messageId}`);
      }
      
      // 2. LIBÉRER LE CLIENT IMMÉDIATEMENT
      const response = {
        messageId: messageId,
        status: isRetranslation ? 'retranslation_queued' : 'message_saved',
        translation_queued: true
      };
      
      // 3. TRAITER LES TRADUCTIONS EN ASYNCHRONE (non-bloquant)
      console.log(`🔄 [TranslationService] Déclenchement traitement asynchrone pour ${messageId}...`);
      setImmediate(async () => {
        try {
          console.log(`🔄 [TranslationService] Début traitement asynchrone...`);
          if (isRetranslation) {
            // Pour une retraduction, on utilise les données du message existant
            console.log(`🔄 [TranslationService] Traitement retraduction...`);
            await this._processRetranslationAsync(messageId, messageData);
          } else {
            // Pour un nouveau message, on récupère les données complètes
            console.log(`🔄 [TranslationService] Traitement nouveau message...`);
            const savedMessage = await this.prisma.message.findUnique({
              where: { id: messageId }
            });
            if (savedMessage) {
              // Passer la langue cible spécifiée par le client
              await this._processTranslationsAsync(savedMessage, messageData.targetLanguage);
            } else {
              console.error(`❌ [TranslationService] Message ${messageId} non trouvé en base`);
            }
          }
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
      // Vérifier si la conversation existe, sinon la créer
      const existingConversation = await this.prisma.conversation.findUnique({
        where: { id: messageData.conversationId }
      });
      
      if (!existingConversation) {
        console.log(`📝 Création automatique de la conversation ${messageData.conversationId}`);
        await this.prisma.conversation.create({
          data: {
            id: messageData.conversationId,
            title: `Conversation ${messageData.conversationId}`,
            type: 'group',
            createdAt: new Date(),
            lastMessageAt: new Date()
          }
        });
      }
      
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

  private async _processTranslationsAsync(message: any, targetLanguage?: string) {
    try {
      console.log(`🔄 Démarrage traitement asynchrone des traductions pour ${message.id}`);
      console.log(`🔧 ZMQ Client disponible:`, this.zmqClient ? 'OUI' : 'NON');
      
      if (!this.zmqClient) {
        console.error('[GATEWAY] ❌ ZMQ Client non disponible pour les traductions');
        return;
      }
      
      // 1. DÉTERMINER LES LANGUES CIBLES
      let targetLanguages: string[];
      
      if (targetLanguage) {
        // Utiliser la langue cible spécifiée par le client
        targetLanguages = [targetLanguage];
        console.log(`🎯 Langue cible spécifiée par le client: ${targetLanguage}`);
      } else {
        // Extraire les langues de la conversation (comportement par défaut)
        targetLanguages = await this._extractConversationLanguages(message.conversationId);
        
        if (targetLanguages.length === 0) {
          console.log(`ℹ️ Aucune langue cible trouvée pour la conversation ${message.conversationId}, utilisation de 'en' par défaut`);
          targetLanguages = ['en'];
        }
      }
      
      console.log(`🌍 Langues cibles finales: ${targetLanguages.join(', ')}`);
      
      // 2. ENVOYER LA REQUÊTE DE TRADUCTION VIA PUB
      const request: TranslationRequest = {
        messageId: message.id,
        text: message.content,
        sourceLanguage: message.originalLanguage,
        targetLanguages: targetLanguages,
        conversationId: message.conversationId,
        modelType: (message as any).modelType || ((message.content?.length ?? 0) < 80 ? 'medium' : 'premium')
      };
      
      console.log(`📤 Tentative d'envoi de requête ZMQ...`);
      const taskId = await this.zmqClient.sendTranslationRequest(request);
      this.stats.translation_requests_sent++;
      
      console.log(`📤 Requête de traduction envoyée: ${taskId} (${targetLanguages.length} langues)`);
      
    } catch (error) {
      console.error(`❌ Erreur traitement asynchrone: ${error}`);
      this.stats.errors++;
    }
  }

  /**
   * Traite une retraduction d'un message existant
   */
  private async _processRetranslationAsync(messageId: string, messageData: MessageData) {
    try {
      console.log(`🔄 [TranslationService] Démarrage retraduction pour le message ${messageId}`);
      console.log(`🔍 [TranslationService] Données de retraduction:`, {
        messageId,
        targetLanguage: messageData.targetLanguage,
        modelType: (messageData as any).modelType
      });
      
      // Récupérer le message existant depuis la base
      const existingMessage = await this.prisma.message.findUnique({
        where: { id: messageId }
      });
      
      if (!existingMessage) {
        throw new Error(`Message ${messageId} non trouvé pour retraduction`);
      }
      
      // 1. DÉTERMINER LES LANGUES CIBLES
      let targetLanguages: string[];
      
      if (messageData.targetLanguage) {
        // Utiliser la langue cible spécifiée par le client
        targetLanguages = [messageData.targetLanguage];
        console.log(`🎯 Langue cible spécifiée pour retraduction: ${messageData.targetLanguage}`);
      } else {
        // Extraire les langues de la conversation (comportement par défaut)
        targetLanguages = await this._extractConversationLanguages(existingMessage.conversationId);
        
        if (targetLanguages.length === 0) {
          console.log(`ℹ️ Aucune langue cible trouvée pour la retraduction de ${messageId}, utilisation de 'en' par défaut`);
          targetLanguages = ['en'];
        }
      }
      
      console.log(`🌍 Langues cibles pour retraduction: ${targetLanguages.join(', ')}`);
      
      // 2. SUPPRIMER LES ANCIENNES TRADUCTIONS (optionnel)
      // On peut choisir de supprimer les anciennes traductions ou les garder
      console.log(`🗑️ Suppression des anciennes traductions pour ${messageId}`);
      await this.prisma.messageTranslation.deleteMany({
        where: { messageId: messageId }
      });
      
      // 3. ENVOYER LA REQUÊTE DE RETRADUCTION VIA PUB
      const request: TranslationRequest = {
        messageId: messageId,
        text: existingMessage.content,
        sourceLanguage: existingMessage.originalLanguage,
        targetLanguages: targetLanguages,
        conversationId: existingMessage.conversationId,
        modelType: (messageData as any).modelType || ((existingMessage.content?.length ?? 0) < 80 ? 'medium' : 'premium')
      };
      
      const taskId = await this.zmqClient.sendTranslationRequest(request);
      this.stats.translation_requests_sent++;
      
      console.log(`📤 Requête de retraduction envoyée: ${taskId} (${targetLanguages.length} langues)`);
      
    } catch (error) {
      console.error(`❌ Erreur retraduction: ${error}`);
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
      // let filteredLanguages = Array.from(languages).filter(lang => lang !== sourceLanguage);
      
      // // Si aucune langue n'est trouvée, utiliser des langues par défaut
      // if (filteredLanguages.length === 0) {
      //   console.log(`⚠️ Aucune langue cible trouvée pour la conversation ${conversationId}, utilisation des langues par défaut`);
      //   filteredLanguages = ['en', 'fr', 'es', 'de', 'pt', 'zh', 'ja'].filter(lang => lang !== sourceLanguage);
      // }
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

  private async _handleTranslationCompleted(data: { 
    taskId: string; 
    result: TranslationResult; 
    targetLanguage: string;
    metadata?: any;
  }) {
    try {
      // Utiliser taskId pour la déduplication (permet la retraduction avec un nouveau taskId)
      const taskKey = `${data.taskId}_${data.targetLanguage}`;
      
      // Vérifier si ce taskId a déjà été traité (évite les doublons accidentels)
      if (this.processedTasks.has(taskKey)) {
        console.log(`🔄 [TranslationService] Task déjà traité, ignoré: ${taskKey}`);
        return;
      }
      
      // Marquer ce task comme traité
      this.processedTasks.add(taskKey);
      
      // Nettoyer les anciens tasks traités (garder seulement les 1000 derniers)
      if (this.processedTasks.size > 1000) {
        const firstKey = this.processedTasks.values().next().value;
        this.processedTasks.delete(firstKey);
      }
      
      console.log(`📥 [TranslationService] Traduction reçue: ${data.result.messageId} -> ${data.targetLanguage} (taskId: ${data.taskId})`);
      console.log(`🔧 [TranslationService] Informations techniques:`);
      console.log(`   📋 Modèle: ${data.result.translatorModel || 'unknown'}`);
      console.log(`   📋 Worker: ${data.result.workerId || 'unknown'}`);
      console.log(`   📋 Pool: ${data.result.poolType || 'unknown'}`);
      console.log(`   📋 Performance: ${data.result.translationTime || 0}ms`);
      console.log(`   📋 Queue: ${data.result.queueTime || 0}ms`);
      console.log(`   📋 Mémoire: ${data.result.memoryUsage || 0}MB`);
      console.log(`   📋 CPU: ${data.result.cpuUsage || 0}%`);
      
      this.stats.translations_received++;
      
      // Mettre en cache avec métadonnées (écrase l'ancienne traduction)
      const cacheKey = `${data.result.messageId}_${data.result.sourceLanguage}_${data.targetLanguage}`;
      this._addToCache(cacheKey, data.result);
      
      // Sauvegarder en base avec informations techniques (upsert = mise à jour si existe)
      await this._saveTranslationToDatabase(data.result, data.metadata);
      
      // Incrémenter le compteur de traductions pour l'utilisateur
      await this._incrementUserTranslationStats(data.result.messageId);
      
      // Émettre événement avec métadonnées
      console.log(`📡 [TranslationService] Émission événement translationReady pour ${data.result.messageId} -> ${data.targetLanguage}`);
      this.emit('translationReady', {
        taskId: data.taskId,
        result: data.result,
        targetLanguage: data.targetLanguage,
        metadata: data.metadata || {}
      });
      console.log(`✅ [TranslationService] Événement translationReady émis avec métadonnées`);
      
    } catch (error) {
      console.error(`❌ [TranslationService] Erreur traitement: ${error}`);
      console.error(`📋 [TranslationService] Données reçues: ${JSON.stringify(data, null, 2)}`);
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

  /**
   * Incrémente le compteur de traductions pour l'utilisateur qui a envoyé le message
   */
  private async _incrementUserTranslationStats(messageId: string) {
    try {
      // Récupérer le message pour obtenir l'ID de l'utilisateur
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: { senderId: true }
      });
      
      if (message && message.senderId) {
        // Incrémenter le compteur de traductions utilisées
        await this.prisma.userStats.upsert({
          where: { userId: message.senderId },
          update: {
            translationsUsed: {
              increment: 1
            }
          },
          create: {
            userId: message.senderId,
            translationsUsed: 1
          }
        });
        
        console.log(`📊 [TranslationService] Compteur de traductions incrémenté pour l'utilisateur ${message.senderId}`);
      }
    } catch (error) {
      console.error(`❌ [TranslationService] Erreur lors de l'incrémentation des stats: ${error}`);
    }
  }

  /**
   * Extrait les informations techniques du champ translationModel
   * Format: "modelType|workerId|poolType|translationTime|queueTime|memoryUsage|cpuUsage"
   */
  private _extractTechnicalInfo(translationModel: string): {
    modelType: string;
    workerId: string;
    poolType: string;
    translationTime: number;
    queueTime: number;
    memoryUsage: number;
    cpuUsage: number;
  } {
    try {
      const parts = translationModel.split('|');
      if (parts.length >= 7) {
        return {
          modelType: parts[0],
          workerId: parts[1],
          poolType: parts[2],
          translationTime: parseFloat(parts[3]) || 0,
          queueTime: parseFloat(parts[4]) || 0,
          memoryUsage: parseFloat(parts[5]) || 0,
          cpuUsage: parseFloat(parts[6]) || 0
        };
      }
    } catch (error) {
      console.error(`❌ [TranslationService] Erreur extraction infos techniques: ${error}`);
    }
    
    // Valeurs par défaut si le format n'est pas reconnu
    return {
      modelType: translationModel,
      workerId: 'unknown',
      poolType: 'normal',
      translationTime: 0,
      queueTime: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
  }

  private async _saveTranslationToDatabase(result: TranslationResult, metadata?: any) {
    try {
      const cacheKey = `${result.messageId}_${result.sourceLanguage}_${result.targetLanguage}`;
      
      // First, try to delete any existing record with the same cacheKey to avoid conflicts
      try {
        await this.prisma.messageTranslation.deleteMany({
          where: { cacheKey: cacheKey }
        });
      } catch (error) {
        // Ignore errors if no record exists
      }
      
      // Now create the new record
      await this.prisma.messageTranslation.create({
        data: {
          messageId: result.messageId,
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
          translatedContent: result.translatedText,
          confidenceScore: result.confidenceScore,
          cacheKey: cacheKey,
          // Stocker les informations techniques dans le champ translationModel
          // Format: "modelType|workerId|poolType|translationTime|queueTime|memoryUsage|cpuUsage"
          translationModel: `${result.modelType}|${result.workerId || 'unknown'}|${result.poolType || 'normal'}|${result.translationTime || 0}|${result.queueTime || 0}|${result.memoryUsage || 0}|${result.cpuUsage || 0}`
        }
      });
      
      console.log(`💾 [TranslationService] Traduction sauvegardée avec métadonnées: ${cacheKey}`);
      console.log(`🔧 [TranslationService] Informations techniques stockées: ${result.modelType}|${result.workerId || 'unknown'}|${result.poolType || 'normal'}|${result.translationTime || 0}|${result.queueTime || 0}|${result.memoryUsage || 0}|${result.cpuUsage || 0}`);
      
    } catch (error) {
      console.error(`❌ [TranslationService] Erreur sauvegarde: ${error}`);
    }
  }



  async getTranslation(messageId: string, targetLanguage: string, sourceLanguage?: string): Promise<TranslationResult | null> {
    try {
      // Vérifier le cache mémoire
      const cacheKey = sourceLanguage 
        ? `${messageId}_${sourceLanguage}_${targetLanguage}`
        : `${messageId}_${targetLanguage}`;
      const cachedResult = this.memoryCache.get(cacheKey);
      
      if (cachedResult) {
        console.log(`💾 Traduction trouvée en cache: ${messageId} -> ${targetLanguage}`);
        return cachedResult;
      }
      
      // Vérifier la base de données - try multiple cache key formats
      let dbTranslation = null;
      
      if (sourceLanguage) {
        // Try with source language first
        dbTranslation = await this.prisma.messageTranslation.findUnique({
          where: { cacheKey: cacheKey }
        });
      }
      
      if (!dbTranslation) {
        // Try with composite key as fallback
        dbTranslation = await this.prisma.messageTranslation.findUnique({
          where: { 
            messageId_targetLanguage: {
              messageId: messageId,
              targetLanguage: targetLanguage
            }
          }
        });
      }
      
      if (dbTranslation) {
        // Extraire les informations techniques du champ translationModel
        const technicalInfo = this._extractTechnicalInfo(dbTranslation.translationModel);
        
        const result: TranslationResult = {
          messageId: dbTranslation.messageId,
          translatedText: dbTranslation.translatedContent,
          sourceLanguage: dbTranslation.sourceLanguage,
          targetLanguage: dbTranslation.targetLanguage,
          confidenceScore: dbTranslation.confidenceScore || 0,
          processingTime: technicalInfo.translationTime,
          modelType: technicalInfo.modelType,
          // Ajouter les informations techniques enrichies
          translatorModel: technicalInfo.modelType,
          workerId: technicalInfo.workerId,
          poolType: technicalInfo.poolType,
          translationTime: technicalInfo.translationTime,
          queueTime: technicalInfo.queueTime,
          memoryUsage: technicalInfo.memoryUsage,
          cpuUsage: technicalInfo.cpuUsage
        };
        
        // Mettre en cache
        this._addToCache(cacheKey, result);
        
        console.log(`📋 [TranslationService] Traduction récupérée avec infos techniques: ${technicalInfo.modelType}|${technicalInfo.workerId}|${technicalInfo.poolType}|${technicalInfo.translationTime}ms|${technicalInfo.queueTime}ms|${technicalInfo.memoryUsage}MB|${technicalInfo.cpuUsage}%`);
        
        return result;
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Erreur récupération traduction: ${error}`);
      return null;
    }
  }

  /**
   * Méthode pour les requêtes REST de traduction directe
   */
  async translateTextDirectly(
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string, 
    modelType: string = 'basic'
  ): Promise<TranslationResult> {
    try {
      console.log(`🌐 [REST] Traduction directe: '${text.substring(0, 50)}...' (${sourceLanguage} → ${targetLanguage})`);
      
      // Créer une requête de traduction
      const request: TranslationRequest = {
        messageId: `rest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: text,
        sourceLanguage: sourceLanguage,
        targetLanguages: [targetLanguage],
        conversationId: 'rest-request',
        modelType: modelType
      };
      
      // Envoyer la requête et attendre la réponse
      const taskId = await this.zmqClient.sendTranslationRequest(request);
      this.stats.translation_requests_sent++;
      
      console.log(`📤 [REST] Requête envoyée, taskId: ${taskId}, attente de la réponse...`);
      
      // Attendre la réponse via un événement
      const response = await new Promise<TranslationResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for translation response'));
        }, 10000); // 10 secondes de timeout

        const handleResponse = (data: any) => {
          if (data.taskId === taskId) {
            clearTimeout(timeout);
            this.zmqClient.removeListener('translationCompleted', handleResponse);
            this.zmqClient.removeListener('translationError', handleError);
            
            console.log(`📥 [REST] Réponse reçue:`, data);
            
            resolve(data.result);
          }
        };

        const handleError = (data: any) => {
          if (data.taskId === taskId) {
            clearTimeout(timeout);
            this.zmqClient.removeListener('translationCompleted', handleResponse);
            this.zmqClient.removeListener('translationError', handleError);
            reject(new Error(`Translation error: ${data.error}`));
          }
        };

        this.zmqClient.on('translationCompleted', handleResponse);
        this.zmqClient.on('translationError', handleError);
      });

      return response;
      
    } catch (error) {
      console.error(`❌ [REST] Erreur traduction directe: ${error}`);
      this.stats.errors++;
      
      // Fallback en cas d'erreur
      return {
        messageId: `fallback_${Date.now()}`,
        translatedText: `[${targetLanguage.toUpperCase()}] ${text}`,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage,
        confidenceScore: 0.1,
        processingTime: 0.001,
        modelType: 'fallback'
      };
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
      console.log('[GATEWAY] ✅ TranslationService fermé');
    } catch (error) {
      console.error(`❌ Erreur fermeture TranslationService: ${error}`);
    }
  }
}
