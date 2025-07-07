/**
 * Service centralisé pour la persistance des traductions de messages
 * Gère l'interface entre les traductions en mémoire et le stockage persistant
 */

import type { Message, TranslatedMessage, Translation } from '@/types';
import { 
  saveMessageTranslations, 
  loadMessageTranslations, 
  loadAllMessageTranslations,
  cleanupExpiredTranslations 
} from '@/utils/translation-persistence';

export class TranslationPersistenceService {
  private static instance: TranslationPersistenceService;
  
  // Cache en mémoire pour éviter les accès répétés au localStorage
  private memoryCache = new Map<string, { translations: Translation[]; showingOriginal: boolean }>();
  
  public static getInstance(): TranslationPersistenceService {
    if (!TranslationPersistenceService.instance) {
      TranslationPersistenceService.instance = new TranslationPersistenceService();
    }
    return TranslationPersistenceService.instance;
  }

  /**
   * Initialise le service en nettoyant les traductions expirées
   */
  public initialize(): void {
    cleanupExpiredTranslations();
  }

  /**
   * Sauvegarde les traductions d'un message (avec cache mémoire)
   */
  public saveTranslations(messageId: string, translations: Translation[], showingOriginal: boolean = true): void {
    // Mettre à jour le cache mémoire
    this.memoryCache.set(messageId, { translations: [...translations], showingOriginal });
    
    // Sauvegarder dans localStorage
    saveMessageTranslations(messageId, translations, showingOriginal);
  }

  /**
   * Charge les traductions d'un message (avec cache mémoire)
   */
  public loadTranslations(messageId: string): { translations: Translation[]; showingOriginal: boolean } | null {
    // Vérifier d'abord le cache mémoire
    const cached = this.memoryCache.get(messageId);
    if (cached) {
      return { ...cached, translations: [...cached.translations] }; // Clone pour éviter les mutations
    }

    // Charger depuis localStorage
    const persisted = loadMessageTranslations(messageId);
    if (persisted) {
      // Mettre en cache
      this.memoryCache.set(messageId, { ...persisted, translations: [...persisted.translations] });
      return persisted;
    }

    return null;
  }

  /**
   * Charge toutes les traductions pour une liste de messages
   */
  public loadAllTranslations(messageIds: string[]): Map<string, { translations: Translation[]; showingOriginal: boolean }> {
    const result = new Map<string, { translations: Translation[]; showingOriginal: boolean }>();
    
    // Charger depuis localStorage
    const persistedData = loadAllMessageTranslations(messageIds);
    
    // Mettre à jour le cache mémoire et construire le résultat
    persistedData.forEach((data, messageId) => {
      this.memoryCache.set(messageId, { ...data, translations: [...data.translations] });
      result.set(messageId, { ...data, translations: [...data.translations] });
    });

    return result;
  }

  /**
   * Ajoute une nouvelle traduction à un message existant
   */
  public addTranslation(messageId: string, newTranslation: Translation, showingOriginal?: boolean): Translation[] {
    const existing = this.loadTranslations(messageId);
    const existingTranslations = existing?.translations || [];
    
    // Retirer l'ancienne traduction dans cette langue si elle existe
    const filteredTranslations = existingTranslations.filter(t => t.language !== newTranslation.language);
    
    // Ajouter la nouvelle traduction
    const updatedTranslations = [...filteredTranslations, newTranslation];
    
    // Utiliser l'état d'affichage existant ou celui fourni
    const currentShowingOriginal = showingOriginal ?? existing?.showingOriginal ?? true;
    
    // Sauvegarder
    this.saveTranslations(messageId, updatedTranslations, currentShowingOriginal);
    
    return updatedTranslations;
  }

  /**
   * Met à jour l'état d'affichage d'un message
   */
  public updateShowingOriginal(messageId: string, showingOriginal: boolean): void {
    const existing = this.loadTranslations(messageId);
    if (existing && existing.translations.length > 0) {
      this.saveTranslations(messageId, existing.translations, showingOriginal);
    }
  }

  /**
   * Enrichit un message de base avec ses traductions persistées
   */
  public enrichMessageWithTranslations(message: Message): TranslatedMessage {
    const persistedData = this.loadTranslations(message.id);
    
    return {
      ...message,
      translations: persistedData?.translations || [],
      showingOriginal: persistedData?.showingOriginal ?? true,
      isTranslated: (persistedData?.translations?.length || 0) > 0,
      isTranslating: false,
      translationFailed: false
    };
  }

  /**
   * Enrichit une liste de messages avec leurs traductions persistées
   */
  public enrichMessagesWithTranslations(messages: Message[]): TranslatedMessage[] {
    const messageIds = messages.map(m => m.id);
    const allTranslations = this.loadAllTranslations(messageIds);
    
    return messages.map(message => {
      const persistedData = allTranslations.get(message.id);
      
      return {
        ...message,
        translations: persistedData?.translations || [],
        showingOriginal: persistedData?.showingOriginal ?? true,
        isTranslated: (persistedData?.translations?.length || 0) > 0,
        isTranslating: false,
        translationFailed: false
      };
    });
  }

  /**
   * Supprime les traductions d'un message (si le message est supprimé)
   */
  public deleteTranslations(messageId: string): void {
    this.memoryCache.delete(messageId);
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`meeshy_message_translations_${messageId}`);
      } catch (error) {
        console.warn('Erreur lors de la suppression des traductions:', error);
      }
    }
  }

  /**
   * Nettoie le cache mémoire (à appeler lors du démontage des composants)
   */
  public clearMemoryCache(): void {
    this.memoryCache.clear();
  }
}

// Export de l'instance singleton
export const translationPersistenceService = TranslationPersistenceService.getInstance();
