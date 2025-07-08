/**
 * Service de traduction unifié pour Meeshy
 * Combine toutes les fonctionnalités de traduction en un seul service
 */

import { pipeline } from '@huggingface/transformers';
import { 
  selectModelForMessage,
  getActiveModelConfig,
  ACTIVE_MODELS,
  type AllowedModelType 
} from '@/lib/unified-model-config';
import { 
  type UnifiedModelConfig 
} from '@/lib/unified-model-config';

// Types unifiés
export interface TranslationProgress {
  modelName: string;
  status: 'downloading' | 'loading' | 'ready' | 'error';
  progress?: number; // 0-100
  error?: string;
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  modelUsed: string;
  confidence?: number;
}

export interface CachedTranslation {
  original: string;
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
  modelUsed: string;
}

export interface TranslationMetadata {
  messageId: string;
  originalText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
  modelUsed: string;
  cacheHit: boolean;
  translationTime: number;
}

// Type pour le pipeline de traduction
type TranslationPipeline = any; // TODO: Remplacer par le type correct des pipelines HuggingFace

/**
 * Service de traduction unifié - Combine toutes les approches
 */
export class TranslationService {
  private static instance: TranslationService;
  private loadedPipelines = new Map<AllowedModelType, TranslationPipeline>();
  private loadingPromises = new Map<AllowedModelType, Promise<TranslationPipeline>>();
  private progressCallbacks = new Map<AllowedModelType, (progress: TranslationProgress) => void>();
  
  // Cache et persistance
  private cache = new Map<string, CachedTranslation>();
  private metadata = new Map<string, TranslationMetadata>();
  
  // Clés pour la persistance localStorage
  private readonly STORAGE_KEY_LOADED_MODELS = 'meeshy_loaded_models';
  private readonly STORAGE_KEY_CACHE = 'meeshy_translation_cache';
  private readonly STORAGE_KEY_METADATA = 'meeshy_translation_metadata';
  
  // Configuration
  private readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 jours
  private readonly MAX_CACHE_SIZE = 1000; // Limite du cache

  static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  private constructor() {
    this.loadCacheFromStorage();
    this.loadMetadataFromStorage();
  }

  // === MÉTHODES DE CACHE ET PERSISTANCE ===
  
  private generateCacheKey(text: string, sourceLanguage: string, targetLanguage: string): string {
    return `${text}|${sourceLanguage}|${targetLanguage}`;
  }

  private loadCacheFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_CACHE);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.cache = new Map(Object.entries(parsed));
        this.cleanExpiredCache();
      }
    } catch (error) {
      console.warn('Erreur lors du chargement du cache:', error);
    }
  }

  private saveCacheToStorage(): void {
    try {
      const cacheObject = Object.fromEntries(this.cache);
      localStorage.setItem(this.STORAGE_KEY_CACHE, JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde du cache:', error);
    }
  }

  private loadMetadataFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_METADATA);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.metadata = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.warn('Erreur lors du chargement des métadonnées:', error);
    }
  }

  private saveMetadataToStorage(): void {
    try {
      const metadataObject = Object.fromEntries(this.metadata);
      localStorage.setItem(this.STORAGE_KEY_METADATA, JSON.stringify(metadataObject));
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde des métadonnées:', error);
    }
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_EXPIRY) {
        this.cache.delete(key);
      }
    }
    
    // Limiter la taille du cache
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, this.cache.size - this.MAX_CACHE_SIZE);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  private addToCache(
    text: string,
    translated: string,
    sourceLanguage: string,
    targetLanguage: string,
    modelUsed: string
  ): void {
    const cacheKey = this.generateCacheKey(text, sourceLanguage, targetLanguage);
    const cached: CachedTranslation = {
      original: text,
      translated,
      sourceLanguage,
      targetLanguage,
      timestamp: Date.now(),
      modelUsed
    };
    
    this.cache.set(cacheKey, cached);
    this.cleanExpiredCache();
    this.saveCacheToStorage();
  }

  private getFromCache(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): CachedTranslation | null {
    const cacheKey = this.generateCacheKey(text, sourceLanguage, targetLanguage);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_EXPIRY) {
      return cached;
    }
    
    if (cached) {
      this.cache.delete(cacheKey);
    }
    
    return null;
  }

  // === MÉTHODES DE GESTION DES MODÈLES ===

  async loadModel(modelType: AllowedModelType, onProgress?: (progress: TranslationProgress) => void): Promise<TranslationPipeline> {
    // Si déjà chargé
    if (this.loadedPipelines.has(modelType)) {
      return this.loadedPipelines.get(modelType)!;
    }

    // Si en cours de chargement
    if (this.loadingPromises.has(modelType)) {
      return this.loadingPromises.get(modelType)!;
    }

    const config = getActiveModelConfig(modelType === ACTIVE_MODELS.basicModel ? 'basic' : 'high');
    
    if (onProgress) {
      this.progressCallbacks.set(modelType, onProgress);
    }

    const loadingPromise = this.doLoadModel(modelType, config);
    this.loadingPromises.set(modelType, loadingPromise);

    try {
      const pipeline = await loadingPromise;
      this.loadedPipelines.set(modelType, pipeline);
      this.loadingPromises.delete(modelType);
      this.progressCallbacks.delete(modelType);
      
      // Sauvegarder l'état
      this.saveLoadedModelsToStorage();
      
      return pipeline;
    } catch (error) {
      this.loadingPromises.delete(modelType);
      this.progressCallbacks.delete(modelType);
      throw error;
    }
  }

  private async doLoadModel(modelType: AllowedModelType, config: UnifiedModelConfig): Promise<TranslationPipeline> {
    const progressCallback = this.progressCallbacks.get(modelType);
    
    try {
      if (progressCallback) {
        progressCallback({
          modelName: config.name,
          status: 'downloading',
          progress: 0
        });
      }

      const translationPipeline = await pipeline('translation', config.huggingFaceId, {
        progress_callback: (progressInfo: any) => {
          const progress = progressInfo as { progress?: number; loaded?: number; total?: number };
          if (progressCallback && progress?.progress !== undefined) {
            progressCallback({
              modelName: config.name,
              status: 'downloading',
              progress: Math.round(progress.progress * 100)
            });
          }
        }
      });

      if (progressCallback) {
        progressCallback({
          modelName: config.name,
          status: 'ready',
          progress: 100
        });
      }

      return translationPipeline;
    } catch (error) {
      if (progressCallback) {
        progressCallback({
          modelName: config.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
      }
      throw error;
    }
  }

  private saveLoadedModelsToStorage(): void {
    try {
      const loadedModels = Array.from(this.loadedPipelines.keys());
      localStorage.setItem(this.STORAGE_KEY_LOADED_MODELS, JSON.stringify(loadedModels));
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde des modèles chargés:', error);
    }
  }

  // === MÉTHODES DE TRADUCTION ===

  /**
   * Traduction simple avec sélection automatique du modèle
   */
  async translateSimple(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    
    // Vérifier le cache
    const cached = this.getFromCache(text, sourceLanguage, targetLanguage);
    if (cached) {
      return {
        translatedText: cached.translated,
        sourceLanguage,
        targetLanguage,
        modelUsed: cached.modelUsed,
        confidence: 1.0
      };
    }

    // Sélectionner le modèle automatiquement
    const modelSelection = selectModelForMessage(text.length, text.length > 100 ? 'complex' : 'simple');
    const modelType = modelSelection.type === 'basic' ? ACTIVE_MODELS.basicModel : ACTIVE_MODELS.highModel;
    
    // Charger et utiliser le modèle
    const pipeline = await this.loadModel(modelType);
    const result = await this.performTranslation(pipeline, text, sourceLanguage, targetLanguage, modelSelection.config);
    
    // Ajouter au cache
    this.addToCache(text, result.translatedText, sourceLanguage, targetLanguage, result.modelUsed);
    
    // Ajouter les métadonnées
    const metadata: TranslationMetadata = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      originalText: text,
      sourceLanguage,
      targetLanguage,
      timestamp: Date.now(),
      modelUsed: result.modelUsed,
      cacheHit: false,
      translationTime: Date.now() - startTime
    };
    
    this.metadata.set(metadata.messageId, metadata);
    this.saveMetadataToStorage();
    
    return result;
  }

  /**
   * Traduction optimisée avec modèle spécifique
   */
  async translateOptimized(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    preferredModel?: AllowedModelType
  ): Promise<TranslationResult> {
    // Vérifier le cache
    const cached = this.getFromCache(text, sourceLanguage, targetLanguage);
    if (cached) {
      return {
        translatedText: cached.translated,
        sourceLanguage,
        targetLanguage,
        modelUsed: cached.modelUsed,
        confidence: 1.0
      };
    }

    // Utiliser le modèle préféré ou sélectionner automatiquement
    const modelType = preferredModel || 
      (text.length > 50 ? ACTIVE_MODELS.highModel : ACTIVE_MODELS.basicModel);
    
    const config = getActiveModelConfig(modelType === ACTIVE_MODELS.basicModel ? 'basic' : 'high');
    const pipeline = await this.loadModel(modelType);
    const result = await this.performTranslation(pipeline, text, sourceLanguage, targetLanguage, config);
    
    // Ajouter au cache
    this.addToCache(text, result.translatedText, sourceLanguage, targetLanguage, result.modelUsed);
    
    return result;
  }

  private async performTranslation(
    pipeline: TranslationPipeline,
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    config: UnifiedModelConfig
  ): Promise<TranslationResult> {
    try {
      const result = await pipeline(text, {
        src_lang: sourceLanguage,
        tgt_lang: targetLanguage
      });

      let translatedText = '';
      if (Array.isArray(result) && result.length > 0) {
        const firstResult = result[0];
        translatedText = firstResult.translation_text || 
                        firstResult.generated_text || 
                        firstResult.text || 
                        String(firstResult);
      } else if (result && typeof result === 'object') {
        translatedText = result.translation_text ||
                        result.generated_text ||
                        result.text ||
                        String(result);
      } else {
        translatedText = String(result);
      }

      return {
        translatedText: translatedText.trim(),
        sourceLanguage,
        targetLanguage,
        modelUsed: config.name,
        confidence: 0.9
      };
    } catch (error) {
      console.error('Erreur lors de la traduction:', error);
      throw new Error(`Échec de la traduction: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // === MÉTHODES UTILITAIRES ===

  // === MÉTHODES DE COMPATIBILITÉ AVEC L'ANCIEN API ===
  
  /**
   * Méthode de compatibilité pour translateText (ancienne API)
   */
  async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    modelType?: AllowedModelType
  ): Promise<{ translatedText: string; modelUsed: string; confidence?: number }> {
    const result = await this.translateOptimized(text, sourceLanguage, targetLanguage, modelType);
    return {
      translatedText: result.translatedText,
      modelUsed: result.modelUsed,
      confidence: result.confidence
    };
  }

  /**
   * Méthode pour décharger un modèle
   */
  async unloadModel(modelType: AllowedModelType): Promise<boolean> {
    try {
      if (this.loadedPipelines.has(modelType)) {
        this.loadedPipelines.delete(modelType);
        this.saveLoadedModelsToStorage();
        console.log(`✅ Modèle ${modelType} déchargé`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Erreur lors du déchargement du modèle ${modelType}:`, error);
      return false;
    }
  }

  /**
   * Méthode pour décharger tous les modèles
   */
  async unloadAllModels(): Promise<void> {
    this.loadedPipelines.clear();
    this.loadingPromises.clear();
    this.progressCallbacks.clear();
    this.saveLoadedModelsToStorage();
    console.log('✅ Tous les modèles ont été déchargés');
  }

  /**
   * Récupère les statistiques des modèles
   */
  getModelStats(): {
    loadedModels: AllowedModelType[];
    totalModels: number;
    cacheSize: number;
    totalTranslations: number;
  } {
    return {
      loadedModels: Array.from(this.loadedPipelines.keys()),
      totalModels: this.loadedPipelines.size,
      cacheSize: this.cache.size,
      totalTranslations: this.metadata.size
    };
  }

  /**
   * Récupère les modèles persistés depuis le localStorage
   */
  getPersistedLoadedModels(): AllowedModelType[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_LOADED_MODELS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Erreur lors de la récupération des modèles persistés:', error);
    }
    return [];
  }

  /**
   * Précharge les modèles recommandés
   */
  async preloadRecommendedModels(onProgress?: (progress: TranslationProgress) => void): Promise<void> {
    const recommendedModels = [ACTIVE_MODELS.basicModel, ACTIVE_MODELS.highModel];
    
    for (const model of recommendedModels) {
      try {
        await this.loadModel(model, onProgress);
      } catch (error) {
        console.warn(`Impossible de précharger le modèle ${model}:`, error);
      }
    }
  }

  /**
   * Vérifie si un modèle est chargé
   */
  isModelLoaded(model: AllowedModelType): boolean {
    return this.loadedPipelines.has(model);
  }

  /**
   * Récupère la liste des modèles chargés
   */
  getLoadedModels(): AllowedModelType[] {
    return Array.from(this.loadedPipelines.keys());
  }

  /**
   * Récupère les statistiques du cache
   */
  getCacheStats(): { size: number; expiredCount: number; totalTranslations: number } {
    let expiredCount = 0;
    const now = Date.now();
    
    for (const [, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_EXPIRY) {
        expiredCount++;
      }
    }
    
    return {
      size: this.cache.size,
      expiredCount,
      totalTranslations: this.metadata.size
    };
  }

  /**
   * Charge le meilleur modèle disponible
   */
  async loadBestAvailableModel(): Promise<AllowedModelType> {
    // Tenter de charger le modèle recommandé
    try {
      await this.loadModel(ACTIVE_MODELS.basicModel);
      return ACTIVE_MODELS.basicModel;
    } catch {
      console.warn('Impossible de charger le modèle de base, tentative avec un modèle alternatif');
      
      // Fallback vers un autre modèle
      const fallbackModel = ACTIVE_MODELS.highModel;
      await this.loadModel(fallbackModel);
      return fallbackModel;
    }
  }

  /**
   * Vide le cache de traduction
   */
  clearCache(): void {
    this.cache.clear();
    this.metadata.clear();
    localStorage.removeItem(this.STORAGE_KEY_CACHE);
    localStorage.removeItem(this.STORAGE_KEY_METADATA);
    console.log('✅ Cache de traduction vidé');
  }
}

// Export de l'instance singleton
export const translationService = TranslationService.getInstance();
