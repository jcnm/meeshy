/**
 * Service de traduction unifié pour Meeshy
 * Combine toutes les fonctionnalités de traduction en un seul service
 * Version corrigée avec gestion des codes de langues NLLB
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
import {
  convertToNLLBCode,
  getNLLBSupportedLanguages
} from '@/utils/nllb-language-mapping';

// Types unifiés pour éviter les conflits
export interface TranslationProgress {
  modelName: string;
  status: 'downloading' | 'loading' | 'ready' | 'error';
  progress?: number; // 0-100
  error?: string;
}

export interface TranslationApiResult {
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

// Types pour les réponses des pipelines HuggingFace
interface PipelineResponse {
  translation_text?: string;
  generated_text?: string;
  text?: string;
  [key: string]: unknown;
}

// Interface pour le pipeline de traduction simplifié
interface TranslationPipeline {
  (text: string | string[], options?: Record<string, unknown>): Promise<PipelineResponse[] | PipelineResponse>;
  model?: unknown;
  tokenizer?: unknown;
  dispose?: () => Promise<void>;
}

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

      // Sauvegarder la liste des modèles chargés
      this.saveLoadedModelsToStorage();
      
      console.log(`✅ Modèle ${config.displayName} chargé avec succès`);
      return pipeline;
    } catch (error) {
      this.loadingPromises.delete(modelType);
      this.progressCallbacks.delete(modelType);
      console.error(`❌ Erreur lors du chargement du modèle ${config.displayName}:`, error);
      throw error;
    }
  }

  private async doLoadModel(modelType: AllowedModelType, config: UnifiedModelConfig): Promise<TranslationPipeline> {
    const progressCallback = this.progressCallbacks.get(modelType);
    
    try {
      if (progressCallback) {
        progressCallback({
          modelName: config.displayName,
          status: 'downloading',
          progress: 0
        });
      }

      const translationPipeline = await pipeline('translation', config.huggingFaceId, {
        progress_callback: (progressInfo: Record<string, unknown>) => {
          if (progressCallback) {
            progressCallback({
              modelName: config.displayName,
              status: 'downloading',
              progress: typeof progressInfo.progress === 'number' ? Math.round(progressInfo.progress * 100) : undefined
            });
          }
        }
      });

      if (progressCallback) {
        progressCallback({
          modelName: config.displayName,
          status: 'ready',
          progress: 100
        });
      }

      return translationPipeline as TranslationPipeline;
    } catch (error) {
      if (progressCallback) {
        progressCallback({
          modelName: config.displayName,
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

  // === MÉTHODES DE TRADUCTION PRINCIPALES ===

  /**
   * Traduction simple avec sélection automatique du modèle
   */
  async translateSimple(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationApiResult> {
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
  ): Promise<TranslationApiResult> {
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
  ): Promise<TranslationApiResult> {
    try {
      // Déterminer si on utilise un modèle NLLB ou MT5
      const isNLLBModel = config.family === 'NLLB';
      
      let actualSourceLang = sourceLanguage;
      let actualTargetLang = targetLanguage;
      
      // Convertir les codes de langues pour NLLB
      if (isNLLBModel) {
        try {
          actualSourceLang = convertToNLLBCode(sourceLanguage);
          actualTargetLang = convertToNLLBCode(targetLanguage);
        } catch (error) {
          // Si la langue n'est pas supportée par NLLB, afficher une erreur utile
          if (error instanceof Error && error.message.includes('non supportée')) {
            const supportedLanguages = getNLLBSupportedLanguages();
            throw new Error(`Langue "${sourceLanguage}" ou "${targetLanguage}" non supportée par NLLB. Langues supportées: ${supportedLanguages.slice(0, 10).join(', ')}...`);
          }
          throw error;
        }
      }

      // Appeler le pipeline avec les bons codes de langues
      const result = await pipeline(text, {
        src_lang: actualSourceLang,
        tgt_lang: actualTargetLang
      });

      let translatedText = '';
      if (Array.isArray(result) && result.length > 0) {
        const firstResult = result[0];
        translatedText = firstResult.translation_text || 
                        firstResult.generated_text || 
                        firstResult.text || 
                        String(firstResult);
      } else if (result && typeof result === 'object') {
        const response = result as PipelineResponse;
        translatedText = response.translation_text ||
                        response.generated_text ||
                        response.text ||
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
      
      // Gérer spécifiquement les erreurs de langues non supportées
      if (error instanceof Error) {
        const message = error.message;
        
        // Si l'erreur contient une liste de langues supportées (comme dans le cas initial)
        if (message.includes('_Latn') || message.includes('_Cyrl') || message.includes('_Arab')) {
          throw new Error(`Langue non supportée par le modèle ${config.displayName}. Veuillez vérifier les langues source et cible.`);
        }
        
        // Si c'est notre erreur personnalisée pour les langues non supportées
        if (message.includes('non supportée par NLLB')) {
          throw error; // Propager tel quel
        }
      }
      
      throw new Error(`Échec de la traduction avec ${config.displayName}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // === MÉTHODES UTILITAIRES ===

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
    loadingModels: AllowedModelType[];
    cacheSize: number;
    cacheExpiredCount: number;
  } {
    return {
      loadedModels: Array.from(this.loadedPipelines.keys()),
      loadingModels: Array.from(this.loadingPromises.keys()),
      cacheSize: this.cache.size,
      cacheExpiredCount: 0
    };
  }

  /**
   * Récupère les statistiques du cache
   */
  getCacheStats(): { size: number; expiredCount: number; totalTranslations: number } {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const cached of this.cache.values()) {
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
   * Vide le cache
   */
  clearCache(): void {
    this.cache.clear();
    this.metadata.clear();
    localStorage.removeItem(this.STORAGE_KEY_CACHE);
    localStorage.removeItem(this.STORAGE_KEY_METADATA);
    console.log('✅ Cache de traduction vidé');
  }

  /**
   * Vérifie si un modèle est chargé
   */
  isModelLoaded(modelType: AllowedModelType): boolean {
    return this.loadedPipelines.has(modelType);
  }

  /**
   * Obtient la liste des modèles chargés
   */
  getLoadedModels(): AllowedModelType[] {
    return Array.from(this.loadedPipelines.keys());
  }
}

// Instance singleton
export const translationService = TranslationService.getInstance();
