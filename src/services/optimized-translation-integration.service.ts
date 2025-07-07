/**
 * Service d'intégration pour la stratégie de traduction optimisée
 * Orchestre l'interaction entre les différents composants du système
 */

'use client';

import { optimizedTranslation } from './optimized-translation.service';
import { hierarchicalCache } from './hierarchical-cache.service';
import type { 
  ConversationMetadata, 
  LoadingState
} from '@/types/translation-optimization';
import type { User, Message } from '@/types';
import { ConversationsService } from './conversationsService';

export interface OptimizedTranslationIntegration {
  // Phase 1: Chargement instantané
  loadConversationsMetadata(): Promise<ConversationMetadata[]>;
  
  // Phase 2: Traduction prioritaire  
  translateLastMessages(
    conversations: ConversationMetadata[], 
    user: User
  ): Promise<Map<string, string>>;
  
  // Phase 3: Traduction paresseuse
  startBackgroundTranslations(user: User): Promise<void>;
  
  // Utilitaires
  getLoadingState(): LoadingState;
  clearCache(): Promise<void>;
  getPerformanceMetrics(): {
    cache: unknown;
    translation: unknown;
    queue: unknown;
  };
}

/**
 * Service principal d'intégration
 */
export class OptimizedTranslationIntegrationService implements OptimizedTranslationIntegration {
  private static instance: OptimizedTranslationIntegrationService;
  
  private conversationsService = new ConversationsService();
  private isInitialized = false;

  static getInstance(): OptimizedTranslationIntegrationService {
    if (!OptimizedTranslationIntegrationService.instance) {
      OptimizedTranslationIntegrationService.instance = new OptimizedTranslationIntegrationService();
    }
    return OptimizedTranslationIntegrationService.instance;
  }

  private constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🚀 Initialisation du service d\'intégration de traduction optimisée...');
    
    try {
      // Les services sont déjà des singletons, pas besoin de les initialiser explicitement
      this.isInitialized = true;
      console.log('✅ Service d\'intégration initialisé');
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation du service d\'intégration:', error);
    }
  }

  // ================= PHASE 1: CHARGEMENT INSTANTANÉ =================

  async loadConversationsMetadata(): Promise<ConversationMetadata[]> {
    console.log('📋 Phase 1: Chargement instantané des métadonnées...');
    
    try {
      // 1. Essayer de charger depuis le cache hiérarchique
      let metadata = await hierarchicalCache.loadConversationsMetadata();
      
      if (metadata.length === 0) {
        // 2. Démarrage à froid - charger les conversations complètes
        console.log('🔄 Démarrage à froid - chargement des conversations...');
        const conversations = await this.conversationsService.getConversations();
        
        // 3. Transformer en métadonnées et mettre en cache
        await hierarchicalCache.updateConversationsMetadata(conversations);
        metadata = await hierarchicalCache.loadConversationsMetadata();
      }

      console.log(`✅ ${metadata.length} métadonnées de conversations chargées`);
      return metadata;

    } catch (error) {
      console.error('❌ Erreur lors du chargement des métadonnées:', error);
      return [];
    }
  }

  // ================= PHASE 2: TRADUCTION PRIORITAIRE =================

  async translateLastMessages(
    conversations: ConversationMetadata[], 
    user: User
  ): Promise<Map<string, string>> {
    console.log('🎯 Phase 2: Traduction prioritaire des derniers messages...');
    
    const results = new Map<string, string>();
    
    try {
      // Préparer les conversations pour traduction
      const conversationsWithMessages = conversations
        .filter(conv => conv.lastMessage && !conv.lastMessage.isTranslated)
        .map(conv => ({
          id: conv.id,
          lastMessage: this.convertMetadataToMessage(conv)
        }));

      if (conversationsWithMessages.length === 0) {
        console.log('✅ Aucun message à traduire');
        return results;
      }

      // Utiliser le service de traduction optimisé
      const translations = await optimizedTranslation.translateLastMessages(
        conversationsWithMessages,
        user.systemLanguage,
        user
      );

      console.log(`✅ ${translations.size} derniers messages traduits`);
      return translations;

    } catch (error) {
      console.error('❌ Erreur lors de la traduction prioritaire:', error);
      return results;
    }
  }

  // ================= PHASE 3: TRADUCTION PARESSEUSE =================

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async startBackgroundTranslations(_user: User): Promise<void> {
    console.log('🔄 Phase 3: Démarrage des traductions en arrière-plan...');
    
    try {
      // Configuration pour traduction en arrière-plan
      optimizedTranslation.configure({
        backgroundProcessing: true,
        batchSize: 5,
        maxConcurrentTranslations: 2
      });

      console.log('✅ Traductions en arrière-plan démarrées');

    } catch (error) {
      console.error('❌ Erreur lors du démarrage des traductions en arrière-plan:', error);
    }
  }

  // ================= UTILITAIRES =================

  private convertMetadataToMessage(conv: ConversationMetadata): Message | undefined {
    if (!conv.lastMessage) return undefined;

    return {
      id: conv.lastMessage.id,
      content: conv.lastMessage.content,
      senderId: conv.lastMessage.senderId,
      conversationId: conv.id,
      originalLanguage: conv.lastMessage.originalLanguage,
      isEdited: false,
      createdAt: conv.lastMessage.timestamp,
      updatedAt: conv.lastMessage.timestamp,
      sender: {
        id: conv.lastMessage.senderId,
        username: conv.lastMessage.senderName,
        displayName: conv.lastMessage.senderName,
        email: '',
        role: 'USER',
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false,
          canManageTranslations: false
        },
        systemLanguage: 'fr',
        regionalLanguage: 'fr',
        autoTranslateEnabled: false,
        translateToSystemLanguage: false,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: false,
        createdAt: new Date(),
        lastActiveAt: new Date()
      }
    };
  }

  getLoadingState(): LoadingState {
    return hierarchicalCache.getLoadingState();
  }

  async clearCache(): Promise<void> {
    console.log('🧹 Nettoyage du cache...');
    await hierarchicalCache.forceCacheCleanup();
    optimizedTranslation.clearQueue();
    console.log('✅ Cache nettoyé');
  }

  getPerformanceMetrics() {
    return {
      cache: hierarchicalCache.getPerformanceMetrics(),
      translation: optimizedTranslation.getPerformanceMetrics(),
      queue: optimizedTranslation.getQueueStatus()
    };
  }

  // ================= STRATÉGIE COMPLÈTE =================

  /**
   * Exécuter la stratégie de traduction optimisée complète
   */
  async executeOptimizedTranslationStrategy(user: User): Promise<{
    metadata: ConversationMetadata[];
    translations: Map<string, string>;
    loadingState: LoadingState;
  }> {
    console.log('🚀 Exécution de la stratégie de traduction optimisée complète...');
    
    const startTime = performance.now();
    
    try {
      // Phase 1: Chargement instantané (< 100ms)
      const metadata = await this.loadConversationsMetadata();
      
      // Phase 2: Traduction prioritaire (100-500ms)
      const translations = await this.translateLastMessages(metadata, user);
      
      // Phase 3: Traduction paresseuse (arrière-plan)
      setTimeout(() => {
        this.startBackgroundTranslations(user);
      }, 500);
      
      const totalTime = performance.now() - startTime;
      console.log(`✅ Stratégie exécutée en ${totalTime.toFixed(2)}ms`);
      
      return {
        metadata,
        translations,
        loadingState: this.getLoadingState()
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'exécution de la stratégie:', error);
      
      return {
        metadata: [],
        translations: new Map(),
        loadingState: {
          phase: 'STARTUP',
          progress: 0,
          conversationsLoaded: 0,
          totalConversations: 0,
          translationsCompleted: 0,
          totalTranslations: 0,
          estimatedTimeRemaining: 0,
          errors: [{
            type: 'TRANSLATION',
            message: 'Erreur lors de l\'exécution de la stratégie',
            timestamp: new Date(),
            recoverable: true
          }]
        }
      };
    }
  }
}

// Export de l'instance singleton
export const optimizedTranslationIntegration = OptimizedTranslationIntegrationService.getInstance();
