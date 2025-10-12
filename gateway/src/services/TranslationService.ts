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
  private isInitialized: boolean = false; // Flag pour éviter la double initialisation
  
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

  /**
   * Génère un identifiant unique pour une conversation
   * Format: mshy_<titre_sanitisé>-YYYYMMDDHHMMSS ou mshy_<unique_id>-YYYYMMDDHHMMSS si pas de titre
   */
  private generateConversationIdentifier(title?: string): string {
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');
    
    if (title) {
      // Sanitiser le titre : enlever les caractères spéciaux, remplacer les espaces par des tirets
      const sanitizedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Garder seulement lettres, chiffres, espaces et tirets
        .replace(/\s+/g, '-') // Remplacer les espaces par des tirets
        .replace(/-+/g, '-') // Remplacer les tirets multiples par un seul
        .replace(/^-|-$/g, ''); // Enlever les tirets en début/fin
      
      if (sanitizedTitle.length > 0) {
        return `mshy_${sanitizedTitle}-${timestamp}`;
      }
    }
    
    // Si pas de titre ou titre vide après sanitisation, utiliser un ID unique
    const uniqueId = Math.random().toString(36).slice(2, 10);
    return `mshy_${uniqueId}-${timestamp}`;
  }

  async initialize(): Promise<void> {
    try {
      // ⚠️ IMPORTANT: Éviter la double initialisation qui créerait des listeners multiples
      if (this.isInitialized) {
        console.log('[GATEWAY] ⚠️  TranslationService déjà initialisé, skip');
        return;
      }
      
      console.log('[GATEWAY] 🔧 Initialisation TranslationService...');
      
      // Utiliser le singleton ZMQ
      this.zmqClient = await ZMQSingleton.getInstance();
      console.log('[GATEWAY] ✅ ZMQ Client obtenu:', this.zmqClient ? 'OK' : 'NULL');
      
      // ⚠️ CORRECTION DOUBLONS: Retirer les anciens listeners AVANT d'en ajouter de nouveaux
      this.zmqClient.removeAllListeners('translationCompleted');
      this.zmqClient.removeAllListeners('translationError');
      
      // Écouter les événements de traduction terminée
      this.zmqClient.on('translationCompleted', this._handleTranslationCompleted.bind(this));
      this.zmqClient.on('translationError', this._handleTranslationError.bind(this));
      
      console.log('[GATEWAY] 📡 Listeners enregistrés:', {
        translationCompleted: this.zmqClient.listenerCount('translationCompleted'),
        translationError: this.zmqClient.listenerCount('translationError')
      });
      
      // Test de réception après initialisation
      setTimeout(async () => {
        try {
          console.log('[GATEWAY] 🧪 Test de réception après initialisation...');
          await this.zmqClient.testReception();
        } catch (error) {
          console.error('[GATEWAY] ❌ Erreur test réception:', error);
        }
      }, 3000);
      
      this.isInitialized = true;
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
        const existingMessage = await this.prisma.message.findFirst({
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
            console.log(`🔄 [TranslationService] Traitement retraduction avec modelType: ${(messageData as any).modelType || 'auto'}...`);
            await this._processRetranslationAsync(messageId, messageData);
          } else {
            // Pour un nouveau message, on récupère les données complètes
            console.log(`🔄 [TranslationService] Traitement nouveau message...`);
            const savedMessage = await this.prisma.message.findFirst({
              where: { id: messageId }
            });
            if (savedMessage) {
              // Passer la langue cible ET le modelType spécifiés par le client
              const requestedModelType = (messageData as any).modelType;
              console.log(`🎨 [TranslationService] Transmission modelType: ${requestedModelType || 'auto'}`);
              await this._processTranslationsAsync(savedMessage, messageData.targetLanguage, requestedModelType);
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
      const existingConversation = await this.prisma.conversation.findFirst({
        where: { id: messageData.conversationId }
      });
      
      if (!existingConversation) {
        console.log(`📝 Création automatique de la conversation ${messageData.conversationId}`);
        
        // Générer un identifiant unique pour la conversation
        const conversationIdentifier = this.generateConversationIdentifier(`Conversation ${messageData.conversationId}`);
        
        await this.prisma.conversation.create({
          data: {
            id: messageData.conversationId,
            identifier: conversationIdentifier,
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

  /**
   * Traite les traductions d'un nouveau message de manière asynchrone
   * OPTIMISATION: Filtre automatiquement les langues cibles identiques à la langue source
   * pour éviter les traductions inutiles (ex: fr → fr)
   */
  private async _processTranslationsAsync(message: any, targetLanguage?: string, modelType?: string) {
    try {
      console.log(`🔄 Démarrage traitement asynchrone des traductions pour ${message.id}`);
      console.log(`🔧 ZMQ Client disponible:`, this.zmqClient ? 'OUI' : 'NON');
      console.log(`🎨 ModelType demandé:`, modelType || 'auto');
      
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
          console.log(`ℹ️ Aucune langue cible trouvée pour la conversation ${message.conversationId}`);
        }
      }
      
      // OPTIMISATION: Filtrer les langues cibles pour éviter les traductions inutiles
      const filteredTargetLanguages = targetLanguages.filter(targetLang => {
        const sourceLang = message.originalLanguage;
        if (sourceLang && sourceLang !== 'auto' && sourceLang === targetLang) {
          console.log(`🔄 [TranslationService] Langue identique filtrée: ${sourceLang} → ${targetLang}`);
          return false;
        }
        return true;
      });
      
      console.log(`🌍 Langues cibles finales (après filtrage): ${filteredTargetLanguages.join(', ')}`);
      console.log(`🔍 [DEBUG] Langue source: ${message.originalLanguage}, Langues cibles brutes: ${targetLanguages.join(', ')}, Langues filtrées: ${filteredTargetLanguages.join(', ')}`);
      
      // Si aucune langue cible après filtrage, ne pas envoyer de requête
      if (filteredTargetLanguages.length === 0) {
        console.log(`✅ [TranslationService] Aucune traduction nécessaire pour ${message.id} (langues identiques)`);
        return;
      }
      
      // 2. DÉTERMINER LE MODEL TYPE
      // Priorité: 1) modelType passé en paramètre, 2) modelType du message, 3) auto-détection
      const finalModelType = modelType || (message as any).modelType || ((message.content?.length ?? 0) < 80 ? 'medium' : 'premium');
      
      console.log(`🎨 [TranslationService] ModelType final: ${finalModelType} (demandé: ${modelType || 'auto'}, message: ${(message as any).modelType || 'N/A'}, auto: ${(message.content?.length ?? 0) < 80 ? 'medium' : 'premium'})`);
      
      // 3. ENVOYER LA REQUÊTE DE TRADUCTION VIA ZMQ
      const request: TranslationRequest = {
        messageId: message.id,
        text: message.content,
        sourceLanguage: message.originalLanguage,
        targetLanguages: filteredTargetLanguages,
        conversationId: message.conversationId,
        modelType: finalModelType
      };
      
      console.log(`📤 Tentative d'envoi de requête ZMQ avec modelType: ${finalModelType}...`);
      const taskId = await this.zmqClient.sendTranslationRequest(request);
      this.stats.translation_requests_sent++;
      
      console.log(`📤 Requête de traduction envoyée: ${taskId} (${filteredTargetLanguages.length} langues, model: ${finalModelType})`);
      
    } catch (error) {
      console.error(`❌ Erreur traitement asynchrone: ${error}`);
      this.stats.errors++;
    }
  }


  /**
   * Traite une retraduction d'un message existant
   * OPTIMISATION: Filtre automatiquement les langues cibles identiques à la langue source
   * pour éviter les traductions inutiles (ex: fr → fr)
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
      const existingMessage = await this.prisma.message.findFirst({
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
          console.log(`ℹ️ Aucune langue cible trouvée pour la retraduction de ${messageId}`);
        }
      }
      
      // OPTIMISATION: Filtrer les langues cibles pour éviter les traductions inutiles
      const filteredTargetLanguages = targetLanguages.filter(targetLang => {
        const sourceLang = existingMessage.originalLanguage;
        if (sourceLang && sourceLang !== 'auto' && sourceLang === targetLang) {
          console.log(`🔄 [TranslationService] Langue identique filtrée pour retraduction: ${sourceLang} → ${targetLang}`);
          return false;
        }
        return true;
      });
      
      console.log(`🌍 Langues cibles pour retraduction (après filtrage): ${filteredTargetLanguages.join(', ')}`);
      
      // Si aucune langue cible après filtrage, ne pas envoyer de requête
      if (filteredTargetLanguages.length === 0) {
        console.log(`✅ [TranslationService] Aucune retraduction nécessaire pour ${messageId} (langues identiques)`);
        return;
      }
      
      // 2. DÉTERMINER LE MODEL TYPE
      // Priorité: 1) modelType du messageData (demandé par l'utilisateur), 2) auto-détection
      const requestedModelType = (messageData as any).modelType;
      const autoModelType = (existingMessage.content?.length ?? 0) < 80 ? 'medium' : 'premium';
      const finalModelType = requestedModelType || autoModelType;
      
      console.log(`🎨 [TranslationService] ModelType pour retraduction:`);
      console.log(`   Demandé: ${requestedModelType || 'N/A'}`);
      console.log(`   Auto: ${autoModelType}`);
      console.log(`   Final: ${finalModelType}`);
      
      // 3. SUPPRIMER LES ANCIENNES TRADUCTIONS POUR LES LANGUES CIBLES
      // Cela permet de remplacer les traductions existantes par les nouvelles
      if (filteredTargetLanguages.length > 0) {
        const deleteResult = await this.prisma.messageTranslation.deleteMany({
          where: {
            messageId: messageId,
            targetLanguage: {
              in: filteredTargetLanguages
            }
          }
        });
        console.log(`🗑️  [TranslationService] ${deleteResult.count} anciennes traductions supprimées pour retraduction`);
      }
      
      // 4. ENVOYER LA REQUÊTE DE RETRADUCTION VIA ZMQ
      const request: TranslationRequest = {
        messageId: messageId,
        text: existingMessage.content,
        sourceLanguage: existingMessage.originalLanguage,
        targetLanguages: filteredTargetLanguages,
        conversationId: existingMessage.conversationId,
        modelType: finalModelType
      };
      
      console.log(`📤 [TranslationService] Envoi requête de retraduction avec modelType: ${finalModelType}`);
      const taskId = await this.zmqClient.sendTranslationRequest(request);
      this.stats.translation_requests_sent++;
      
      console.log(`✅ [TranslationService] Requête de retraduction envoyée: ${taskId} (${filteredTargetLanguages.length} langues, model: ${finalModelType})`);
      
    } catch (error) {
      console.error(`❌ Erreur retraduction: ${error}`);
      this.stats.errors++;
    }
  }

  /**
   * Extrait les langues cibles des participants d'une conversation
   * Inclut les langues des utilisateurs authentifiés ET des participants anonymes
   * NOTE: Cette méthode retourne TOUTES les langues parlées dans la conversation,
   * indépendamment des préférences de traduction automatique des utilisateurs.
   * Le filtrage des langues identiques à la source se fait dans les méthodes de traitement.
   */
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
        },
        select: {
          language: true
        }
      });
      
      // Extraire TOUTES les langues des utilisateurs authentifiés
      // On extrait toujours systemLanguage, et les autres langues selon les préférences
      for (const member of members) {
        // Toujours ajouter la langue système du participant
        if (member.user.systemLanguage) {
          languages.add(member.user.systemLanguage);
        }
        
        // Ajouter les langues additionnelles si l'utilisateur a activé la traduction automatique
        if (member.user.autoTranslateEnabled) {
          // Langue régionale si activée
          if (member.user.translateToRegionalLanguage && member.user.regionalLanguage) {
            languages.add(member.user.regionalLanguage); 
          }
          // Langue personnalisée si activée
          if (member.user.useCustomDestination && member.user.customDestinationLanguage) {
            languages.add(member.user.customDestinationLanguage); 
          }
        }
      }
      
      // Extraire les langues des participants anonymes
      for (const anonymousParticipant of anonymousParticipants) {
        if (anonymousParticipant.language) {
          languages.add(anonymousParticipant.language); 
        }
      }
      
      // Retourner toutes les langues (le filtrage se fera dans les méthodes de traitement)
      const allLanguages = Array.from(languages);
      
      console.log(`🌍 [TranslationService] Langues extraites pour conversation ${conversationId}: ${allLanguages.join(', ')} (${allLanguages.length} langues uniques)`);
      
      return allLanguages;
      
    } catch (error) {
      console.error(`❌ [TranslationService] Erreur extraction langues: ${error}`);
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
      
      // SAUVEGARDE EN BASE DE DONNÉES (traduction validée par le Translator)
      let translationId: string | null = null;
      try {
        translationId = await this._saveTranslationToDatabase(data.result, data.metadata);
        console.log(`💾 [TranslationService] Traduction sauvegardée en base: ${data.result.messageId} -> ${data.targetLanguage} (ID: ${translationId})`);
      } catch (error) {
        console.error(`❌ [TranslationService] Erreur sauvegarde traduction: ${error}`);
        // Continuer même si la sauvegarde échoue
      }
      
      // Mettre en cache avec métadonnées (écrase l'ancienne traduction)
      const cacheKey = `${data.result.messageId}_${data.result.sourceLanguage}_${data.targetLanguage}`;
      this._addToCache(cacheKey, data.result);
      
      // Incrémenter le compteur de traductions pour l'utilisateur
      await this._incrementUserTranslationStats(data.result.messageId);
      
      // Émettre événement avec métadonnées et ID de traduction
      console.log(`📡 [TranslationService] Émission événement translationReady pour ${data.result.messageId} -> ${data.targetLanguage} (ID: ${translationId})`);
      this.emit('translationReady', {
        taskId: data.taskId,
        result: data.result,
        targetLanguage: data.targetLanguage,
        translationId: translationId, // Ajouter l'ID de la traduction
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
      const message = await this.prisma.message.findFirst({
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


  private async _saveTranslationToDatabase(result: TranslationResult, metadata?: any): Promise<string> {
    try {
      console.log(`💾 [TranslationService] Sauvegarde traduction en base: ${result.messageId} -> ${result.targetLanguage}`);
      
      // Créer la clé de cache unique
      const cacheKey = `${result.messageId}_${result.sourceLanguage}_${result.targetLanguage}`;
      
      // Extraire les informations techniques du modèle
      const modelInfo = result.translatorModel || result.modelType || 'basic';
      const confidenceScore = result.confidenceScore || 0.9;

      // SOLUTION ATOMIQUE: Nettoyer d'abord les doublons potentiels
      // Puis utiliser un try-catch pour gérer les violations de contrainte unique
      try {
        // Étape 1: Nettoyer les doublons existants AVANT l'insertion/mise à jour
        const existingTranslations = await this.prisma.messageTranslation.findMany({
          where: {
            messageId: result.messageId,
            targetLanguage: result.targetLanguage
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        if (existingTranslations.length > 0) {
          // S'il y a des doublons, supprimer tous sauf le premier
          if (existingTranslations.length > 1) {
            const duplicatesToDelete = existingTranslations.slice(1);
            await this.prisma.messageTranslation.deleteMany({
              where: {
                id: {
                  in: duplicatesToDelete.map(t => t.id)
                }
              }
            });
            console.log(`🧹 [TranslationService] ${duplicatesToDelete.length} doublons supprimés pour ${result.messageId} -> ${result.targetLanguage}`);
          }

          // Mettre à jour la traduction existante
          const latestTranslation = existingTranslations[0];
          const updatedTranslation = await this.prisma.messageTranslation.update({
            where: {
              id: latestTranslation.id
            },
            data: {
              sourceLanguage: result.sourceLanguage,
              translatedContent: result.translatedText,
              translationModel: modelInfo,
              confidenceScore: confidenceScore,
              cacheKey: cacheKey
            }
          });
          
          console.log(`🔄 [TranslationService] Traduction mise à jour: ${result.messageId} -> ${result.targetLanguage} (ID: ${updatedTranslation.id})`);
          return updatedTranslation.id;
        } else {
          // Créer une nouvelle traduction
          const newTranslation = await this.prisma.messageTranslation.create({
            data: {
              messageId: result.messageId,
              sourceLanguage: result.sourceLanguage,
              targetLanguage: result.targetLanguage,
              translatedContent: result.translatedText,
              translationModel: modelInfo,
              confidenceScore: confidenceScore,
              cacheKey: cacheKey
            }
          });
          
          console.log(`✅ [TranslationService] Nouvelle traduction sauvegardée: ${result.messageId} -> ${result.targetLanguage} (ID: ${newTranslation.id})`);
          return newTranslation.id;
        }
      } catch (createError: any) {
        // Si erreur de contrainte unique (race condition), réessayer avec une mise à jour
        if (createError.code === 'P2002' || createError.message?.includes('unique constraint')) {
          console.log(`⚠️ [TranslationService] Contrainte unique violée, tentative de mise à jour: ${result.messageId} -> ${result.targetLanguage}`);
          
          // Récupérer la traduction existante créée entre-temps
          const existingTranslation = await this.prisma.messageTranslation.findFirst({
            where: {
              messageId: result.messageId,
              targetLanguage: result.targetLanguage
            }
          });

          if (existingTranslation) {
            const updatedTranslation = await this.prisma.messageTranslation.update({
              where: {
                id: existingTranslation.id
              },
              data: {
                sourceLanguage: result.sourceLanguage,
                translatedContent: result.translatedText,
                translationModel: modelInfo,
                confidenceScore: confidenceScore,
                cacheKey: cacheKey
              }
            });
            
            console.log(`🔄 [TranslationService] Traduction mise à jour après race condition: ${result.messageId} -> ${result.targetLanguage} (ID: ${updatedTranslation.id})`);
            return updatedTranslation.id;
          }
        }
        
        throw createError;
      }

    } catch (error) {
      console.error(`❌ [TranslationService] Erreur sauvegarde traduction: ${error}`);
      throw error; // Remonter l'erreur pour la gestion dans _handleTranslationCompleted
    }
  }



  async getTranslation(messageId: string, targetLanguage: string, sourceLanguage?: string): Promise<TranslationResult | null> {
    try {
      // Vérifier d'abord le cache mémoire
      const cacheKey = sourceLanguage 
        ? `${messageId}_${sourceLanguage}_${targetLanguage}`
        : `${messageId}_${targetLanguage}`;
      const cachedResult = this.memoryCache.get(cacheKey);
      
      if (cachedResult) {
        console.log(`💾 Traduction trouvée en cache: ${messageId} -> ${targetLanguage}`);
        return cachedResult;
      }
      
      // Si pas en cache, chercher dans la base de données
      console.log(`🔍 [TranslationService] Recherche traduction en base: ${messageId} -> ${targetLanguage}`);
      
      const dbTranslation = await this.prisma.messageTranslation.findFirst({
        where: {
          messageId: messageId,
          targetLanguage: targetLanguage
        }
      });
      
      if (dbTranslation) {
        // Convertir la traduction de la base en format TranslationResult
        const result: TranslationResult = {
          messageId: dbTranslation.messageId,
          sourceLanguage: dbTranslation.sourceLanguage,
          targetLanguage: dbTranslation.targetLanguage,
          translatedText: dbTranslation.translatedContent,
          translatorModel: dbTranslation.translationModel,
          confidenceScore: dbTranslation.confidenceScore || 0.9,
          processingTime: 0, // Pas disponible depuis la base
          modelType: dbTranslation.translationModel || 'basic'
        };
        
        // Mettre en cache pour les prochaines requêtes
        this._addToCache(cacheKey, result);
        
        console.log(`✅ [TranslationService] Traduction trouvée en base: ${messageId} -> ${targetLanguage}`);
        return result;
      }
      
      console.log(`📋 [TranslationService] Traduction non trouvée: ${messageId} -> ${targetLanguage}`);
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


