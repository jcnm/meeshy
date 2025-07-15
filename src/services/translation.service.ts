/**
 * Service de traduction unifié pour Meeshy
 * Utilise @huggingface/transformers avec une gestion robuste des modèles MT5 et NLLB
 * Interface unifiée avec cache et persistance automatique
 */
import { pipeline } from '@huggingface/transformers';
import { 
  getActiveModelConfig,
  ACTIVE_MODELS,
  type AllowedModelType,
  type UnifiedModelConfig 
} from '@/lib/unified-model-config';
import { convertToNLLBCode, isLanguageSupportedByNLLB } from '@/utils/nllb-language-mapping';

// === TYPES ET INTERFACES (du fichier principal) ===

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  modelUsed: string;
  confidence: number;
  fromCache: boolean;
}

export interface TranslationOptions {
  preferredModel?: AllowedModelType;
  forceRefresh?: boolean;
  onProgress?: (progress: TranslationProgress) => void;
}

export interface TranslationProgress {
  modelName: string;
  status: 'downloading' | 'loading' | 'ready' | 'error';
  progress?: number;
  error?: string;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  detectedLanguages: Array<{language: string; confidence: number}>;
}

// === INTERFACES INTERNES ===

interface ModelPipeline {
  pipeline: unknown; // Pipeline générique pour la compatibilité
  config: UnifiedModelConfig;
}

interface CachedTranslation {
  original: string;
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
  modelUsed: string;
}

interface TranslationResultRaw {
  translation_text?: string;
  generated_text?: string;
  text?: string;
  [key: string]: unknown;
}

interface ProgressInfo {
  progress?: number;
  status?: string;
  [key: string]: unknown;
}

/**
 * Service de traduction adapté utilisant les algorithmes robustes du HuggingFaceTranslationService
 * avec les interfaces modernes du TranslationService
 */
export class TranslationService {
  private static instance: TranslationService;
  private loadedPipelines = new Map<AllowedModelType, ModelPipeline>();
  private loadingPromises = new Map<AllowedModelType, Promise<ModelPipeline>>();
  private progressCallbacks = new Map<string, (progress: TranslationProgress) => void>();
  private cache = new Map<string, CachedTranslation>();
  
  // Configuration
  private readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 jours
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly STORAGE_KEY_CACHE = 'meeshy_translation_cache';
  private readonly STORAGE_KEY_LOADED_MODELS = 'meeshy_loaded_models';
  private readonly STORAGE_KEY_MODEL_CACHE = 'meeshy_model_cache_metadata';
  private readonly MAX_TEXT_LENGTH = 200; // Limite pour éviter le gel

  static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  private constructor() {
    console.log('🤗 Service de traduction adapté initialisé');
    
    // Vérifier qu'on est côté client avant d'accéder au localStorage
    if (typeof window !== 'undefined') {
      // Nettoyer le cache corrompu au démarrage
      const hasCorruptedCache = localStorage.getItem(this.STORAGE_KEY_LOADED_MODELS)?.includes('NLLB_DISTILLED_600M');
      if (hasCorruptedCache) {
        console.warn('🧹 Cache corrompu détecté, nettoyage...');
        localStorage.removeItem(this.STORAGE_KEY_LOADED_MODELS);
        localStorage.removeItem(this.STORAGE_KEY_MODEL_CACHE);
        localStorage.removeItem(this.STORAGE_KEY_CACHE);
      }
      
      this.loadCacheFromStorage();
      this.loadPersistedState();
      this.autoReloadPersistedModels();
    } else {
      console.log('🔒 Service de traduction: Exécution côté serveur, localStorage ignoré');
    }
  }

  // === API PUBLIQUE PRINCIPALE (interface du fichier principal) ===

  /**
   * Traduction principale avec interface moderne
   */
  async translate(
    text: string,
    targetLanguage: string,
    sourceLanguage: string,
    options: TranslationOptions = {}
  ): Promise<TranslationResult> {
    // Validation des entrées (du fichier principal)
    if (!text?.trim()) {
      throw new Error('Le texte à traduire ne peut pas être vide');
    }

    if (text.length > this.MAX_TEXT_LENGTH) {
      throw new Error(`Texte trop long (maximum ${this.MAX_TEXT_LENGTH} caractères). Réduisez la taille pour éviter le gel de l'interface.`);
    }

    console.log(`🔄 Traduction: "${text}" (${sourceLanguage} → ${targetLanguage})`);

    // Sélectionner le modèle avant validation
    const modelType = options.preferredModel || ACTIVE_MODELS.highModel;
    const config = getActiveModelConfig(modelType === ACTIVE_MODELS.basicModel ? 'basic' : 'high');
    
    // Validation des langues pour les modèles NLLB
    if (config.family === 'NLLB') {
      if (!isLanguageSupportedByNLLB(sourceLanguage)) {
        throw new Error(`Langue source "${sourceLanguage}" non supportée par le modèle NLLB. Utilisez MT5 pour cette langue ou choisissez une langue supportée.`);
      }
      if (!isLanguageSupportedByNLLB(targetLanguage)) {
        throw new Error(`Langue cible "${targetLanguage}" non supportée par le modèle NLLB. Utilisez MT5 pour cette langue ou choisissez une langue supportée.`);
      }
    }

    // Vérifier le cache
    if (!options.forceRefresh) {
      const cached = this.getFromCache(text, sourceLanguage, targetLanguage);
      if (cached) {
        console.log('✅ Traduction trouvée dans le cache');
        return {
          translatedText: cached.translated,
          sourceLanguage: sourceLanguage,
          targetLanguage,
          modelUsed: cached.modelUsed,
          confidence: 1.0,
          fromCache: true
        };
      }
    }

    // Charger le modèle et effectuer la traduction (algorithme du fichier HuggingFace)
    const modelPipeline = await this.loadTranslationPipeline(modelType, options.onProgress);
    const result = await this.performTranslation(
      modelPipeline, 
      text, 
      sourceLanguage, 
      targetLanguage
    );

    // Mettre en cache
    this.addToCache(text, result.translatedText, sourceLanguage, targetLanguage, result.modelUsed);

    return {
      ...result,
      sourceLanguage: sourceLanguage,
      fromCache: false
    };
  }

  /**
   * Charge un pipeline de traduction (interface moderne avec algorithme robuste)
   */
  async loadTranslationPipeline(
    modelType: AllowedModelType, 
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<ModelPipeline> {
    // Si déjà chargé
    if (this.loadedPipelines.has(modelType)) {
      console.log(`✅ Modèle ${modelType} déjà chargé`);
      return this.loadedPipelines.get(modelType)!;
    }

    // Si en cours de chargement
    if (this.loadingPromises.has(modelType)) {
      return this.loadingPromises.get(modelType)!;
    }

    const config = getActiveModelConfig(modelType === ACTIVE_MODELS.basicModel ? 'basic' : 'high');
    const modelId = config.huggingFaceId;

    // Enregistrer le callback de progression
    if (onProgress) {
      this.progressCallbacks.set(modelId, onProgress);
    }

    const loadingPromise = this.doLoadPipeline(modelType, config, onProgress);
    this.loadingPromises.set(modelType, loadingPromise);

    try {
      const modelPipeline = await loadingPromise;
      this.loadedPipelines.set(modelType, modelPipeline);
      this.loadingPromises.delete(modelType);
      
      this.persistState();
      
      this.notifyProgress(modelId, {
        modelName: config.name,
        status: 'ready',
        progress: 100
      });

      return modelPipeline;
    } catch (error) {
      this.loadingPromises.delete(modelType);
      this.notifyProgress(modelId, {
        modelName: config.name,
        status: 'error',
        error: error instanceof Error ? error.message : 'Erreur de chargement'
      });
      throw error;
    }
  }

  // === MÉTHODES PRIVÉES (algorithmes du fichier HuggingFace) ===

  /**
   * Effectue le chargement réel du modèle (algorithme robuste du fichier HuggingFace)
   */
  private async doLoadPipeline(
    modelType: AllowedModelType,
    config: UnifiedModelConfig,
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<ModelPipeline> {
    console.log(`🔄 Chargement du modèle: ${config.huggingFaceId}`);
    
    // Vérification de la mémoire (du fichier HuggingFace)
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memInfo = (performance as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      if (memInfo && memInfo.usedJSHeapSize) {
        const freeMemoryMB = (memInfo.jsHeapSizeLimit - memInfo.usedJSHeapSize) / (1024 * 1024);
        console.log(`💾 Mémoire libre estimée: ${Math.round(freeMemoryMB)} MB`);
        
        if (config.family === 'NLLB' && freeMemoryMB < 512) {
          console.warn('⚠️ Mémoire faible détectée, le chargement du modèle NLLB peut échouer');
        }
      }
    }
    
    this.notifyProgress(config.huggingFaceId, {
      modelName: config.name,
      status: 'downloading',
      progress: 0
    });

    try {
      // Charger le pipeline approprié selon le type de modèle (algorithme du fichier HuggingFace)
      const taskType = config.family === 'MT5' ? 'text2text-generation' : 'translation';
      
      const translator = await pipeline(taskType, config.huggingFaceId, { 
        progress_callback: (progressInfo: ProgressInfo) => {
          if (progressInfo.progress !== undefined) {
            onProgress?.({
              modelName: config.displayName,
              status: 'downloading',
              progress: Math.round(progressInfo.progress)
            });
          }
        },
        device: 'wasm',
        dtype: 'fp32'
      });

      console.log(`✅ Modèle ${config.huggingFaceId} chargé avec succès`);
      return { pipeline: translator, config };
    } catch (error) {
      console.error(`❌ Erreur chargement ${config.huggingFaceId}:`, error);
      
      // Gestion d'erreurs robuste (du fichier HuggingFace)
      if (error instanceof Error) {
        if (error.message.includes('aborted') || error.name === 'AbortError') {
          throw new Error(`Chargement du modèle ${config.displayName} interrompu. Essayez le modèle MT5_SMALL pour commencer.`);
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          throw new Error(`Erreur de réseau lors du chargement de ${config.displayName}. Vérifiez votre connexion internet.`);
        } else if (error.message.includes('memory') || error.message.includes('OOM')) {
          throw new Error(`Mémoire insuffisante pour charger ${config.displayName}. Essayez un modèle plus petit comme MT5_SMALL.`);
        }
      }
      
      throw new Error(`Impossible de charger le modèle ${config.displayName}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  /**
   * Effectue la traduction avec robustesse (algorithme du fichier HuggingFace)
   */
  private async performTranslation(
    modelPipeline: ModelPipeline,
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<Omit<TranslationResult, 'sourceLanguage' | 'fromCache'>> {
    const { config } = modelPipeline;

    try {
      const result = await this.executeTranslationWithTimeout(
        modelPipeline.pipeline as (text: string, config?: unknown, options?: unknown) => Promise<unknown>,
        text,
        sourceLanguage,
        targetLanguage,
        config
      );

      let translatedText = this.extractTranslatedText(result);
      translatedText = this.cleanTranslationText(translatedText);

      // Validation robuste (du fichier HuggingFace)
      if (!translatedText || translatedText === text || this.isCorruptedResult(translatedText)) {
        console.warn(`⚠️ Traduction corrompue détectée: "${translatedText}"`);
        
        if (config.family === 'MT5') {
          throw new Error('Traduction MT5 corrompue. Essayez un texte plus simple ou utilisez le modèle NLLB.');
        } else {
          translatedText = text;
        }
      }

      console.log(`✅ Traduction réussie: "${translatedText}"`);

      return {
        translatedText,
        targetLanguage,
        modelUsed: config.displayName,
        confidence: 0.95
      };

    } catch (error) {
      if ((error as Error).message.includes('invalid data location')) {
        console.warn('🔄 Rechargement du modèle suite à l\'erreur de localisation');
        this.unloadPipeline(config.name);
        const newPipeline = await this.loadTranslationPipeline(config.name);
        return await this.performTranslation(newPipeline, text, sourceLanguage, targetLanguage);
      }
      throw error;
    }
  }

  /**
   * Exécute la traduction avec timeout (algorithme robuste du fichier HuggingFace)
   */
  private async executeTranslationWithTimeout(
    translator: (text: string, config?: unknown, options?: unknown) => Promise<unknown>,
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    config: UnifiedModelConfig
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout: La traduction prend trop de temps.'));
      }, 30000);

      async function executeTranslation() {
        try {
          let result;
          
          const isNLLBModel = config.family === 'NLLB';
          
          if (isNLLBModel) {
            try {
              const srcLang = convertToNLLBCode(sourceLanguage);
              const tgtLang = convertToNLLBCode(targetLanguage);
              
              console.log(`🔄 NLLB: ${sourceLanguage} (${srcLang}) → ${targetLanguage} (${tgtLang})`);
              
              result = await translator(text, undefined, {
                src_lang: srcLang,
                tgt_lang: tgtLang,
                max_length: Math.min(100, text.length + 20),
                num_beams: 1,
                early_stopping: true
              });
            } catch (langError) {
              console.error('❌ Erreur de langue NLLB:', langError);
              throw new Error(`Langue non supportée par le modèle NLLB: ${langError}`);
            }
          } else {
            // Pour MT5
            const prompt = `translate ${sourceLanguage} to ${targetLanguage}: ${text}`;
            console.log(`🔄 MT5 prompt: "${prompt}"`);
            
            result = await translator(prompt, {
              max_length: Math.min(100, text.length + 20),
              do_sample: false,
              temperature: 0.1,
              num_return_sequences: 1,
              early_stopping: true,
              num_beams: 1
            });
          }
          
          clearTimeout(timeoutId);
          resolve(result);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      }

      setTimeout(executeTranslation, 10);
    });
  }

  /**
   * Extrait le texte traduit du résultat (algorithme du fichier HuggingFace)
   */
  private extractTranslatedText(result: unknown): string {
    if (Array.isArray(result) && result.length > 0) {
      const firstResult = result[0];
      if (typeof firstResult === 'object' && firstResult !== null) {
        const translationResult = firstResult as TranslationResultRaw;
        return translationResult.translation_text || 
               translationResult.generated_text || 
               translationResult.text ||
               String(firstResult);
      } else {
        return String(firstResult);
      }
    } else if (typeof result === 'object' && result !== null) {
      const translationResult = result as TranslationResultRaw;
      return translationResult.translation_text || 
             translationResult.generated_text || 
             translationResult.text ||
             String(result);
    } else {
      return String(result);
    }
  }

  /**
   * Nettoie le texte traduit (algorithme du fichier HuggingFace)
   */
  private cleanTranslationText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/<extra_id_\d+>/g, '')
      .replace(/▁/g, ' ')
      .replace(/<s>|<\/s>/g, '')
      .replace(/<pad>/g, '')
      .replace(/<unk>/g, '')
      .replace(/<mask>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Détecte si un résultat est corrompu (algorithme du fichier HuggingFace)
   */
  private isCorruptedResult(text: string): boolean {
    if (!text || text.length === 0) return true;
    
    const corruptionPatterns = [
      /^[:.\s\-n]+$/,
      /^[:\s]+$/,
      /^[-\s]+$/,
      /^\s*n\s*n\s*n/,
      /^[^a-zA-Z]*$/
    ];
    
    return corruptionPatterns.some(pattern => pattern.test(text.trim()));
  }

  // === MÉTHODES UTILITAIRES (interfaces du fichier principal) ===

  /**
   * Charge automatiquement le meilleur modèle disponible
   */
  async loadBestAvailableModel(
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<{ modelType: AllowedModelType; pipeline: ModelPipeline }> {
    const loadedModels = this.getLoadedModels();
    if (loadedModels.length > 0) {
      const bestLoaded = loadedModels[0];
      const pipeline = this.loadedPipelines.get(bestLoaded);
      
      if (pipeline) {
        console.log(`✅ Utilisation du modèle déjà chargé: ${bestLoaded}`);
        return { modelType: bestLoaded, pipeline };
      }
    }

    const persistedModels = this.getPersistedLoadedModels();
    if (persistedModels.length > 0) {
      const bestPersisted = persistedModels[0];
      try {
        const pipeline = await this.loadTranslationPipeline(bestPersisted, onProgress);
        console.log(`✅ Modèle rechargé depuis la persistance: ${bestPersisted}`);
        return { modelType: bestPersisted, pipeline };
      } catch {
        console.warn(`⚠️ Échec du rechargement de ${bestPersisted}, essai du modèle recommandé`);
      }
    }

    const basicModel = ACTIVE_MODELS.basicModel;
    const pipeline = await this.loadTranslationPipeline(basicModel, onProgress);
    
    console.log(`✅ Modèle de base chargé: ${basicModel}`);
    return { modelType: basicModel, pipeline };
  }

  /**
   * Décharge un pipeline
   */
  unloadPipeline(modelType: AllowedModelType): boolean {
    const deleted = this.loadedPipelines.delete(modelType);
    if (deleted) {
      this.persistState();
      console.log(`🗑️ Modèle ${modelType} déchargé`);
    }
    return deleted;
  }

  /**
   * Décharge tous les pipelines
   */
  unloadAllPipelines(): void {
    this.loadedPipelines.clear();
    this.loadingPromises.clear();
    this.persistState();
    console.log('🧹 Tous les modèles déchargés');
  }

  /**
   * Vide le cache
   */
  clearCache(): void {
    this.cache.clear();
    this.saveCacheToStorage();
    console.log('🧹 Cache vidé');
  }

  /**
   * Nettoie complètement le cache et la persistance
   */
  async clearAllCache(): Promise<void> {
    this.unloadAllPipelines();
    this.clearCache();
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY_LOADED_MODELS);
      localStorage.removeItem(this.STORAGE_KEY_MODEL_CACHE);
    }
    
    console.log('🧹 Cache et persistance nettoyés complètement');
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

  /**
   * Statistiques du service
   */
  getStats() {
    return {
      loadedPipelines: this.getLoadedModels(),
      loadingPipelines: Array.from(this.loadingPromises.keys()),
      cacheSize: this.cache.size,
      hasLanguageDetector: false
    };
  }

  /**
   * Statistiques détaillées des modèles
   */
  getModelStats(): { 
    loaded: number; 
    total: number; 
    loadedModels: AllowedModelType[];
    availableModels: AllowedModelType[];
  } {
    const availableModels = [ACTIVE_MODELS.basicModel, ACTIVE_MODELS.highModel];
    const loadedModels = this.getLoadedModels();

    return {
      loaded: loadedModels.length,
      total: availableModels.length,
      loadedModels,
      availableModels
    };
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      expiredCount: 0,
      totalTranslations: this.cache.size
    };
  }

  // === GESTION DU CACHE (du fichier principal) ===

  private generateCacheKey(text: string, sourceLanguage: string, targetLanguage: string): string {
    return `${text}|${sourceLanguage}|${targetLanguage}`;
  }

  private addToCache(
    text: string,
    translated: string,
    sourceLanguage: string,
    targetLanguage: string,
    modelUsed: string
  ): void {
    const cacheKey = this.generateCacheKey(text, sourceLanguage, targetLanguage);
    this.cache.set(cacheKey, {
      original: text,
      translated,
      sourceLanguage,
      targetLanguage,
      timestamp: Date.now(),
      modelUsed
    });
    
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

  private cleanExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_EXPIRY) {
        this.cache.delete(key);
      }
    }
    
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, this.cache.size - this.MAX_CACHE_SIZE);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  private loadCacheFromStorage(): void {
    if (typeof window === 'undefined') return;
    
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
    if (typeof window === 'undefined') return;
    
    try {
      const cacheObject = Object.fromEntries(this.cache);
      localStorage.setItem(this.STORAGE_KEY_CACHE, JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde du cache:', error);
    }
  }

  // === GESTION DE LA PERSISTANCE (du fichier principal) ===

  private loadPersistedState(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const savedModels = localStorage.getItem(this.STORAGE_KEY_LOADED_MODELS);
      if (savedModels) {
        const modelIds: string[] = JSON.parse(savedModels);
        console.log(`📂 Modèles persistés trouvés: ${modelIds.join(', ')}`);
      }
    } catch (error) {
      console.warn('⚠️ Erreur lors du chargement de l\'état persisté:', error);
    }
  }

  private async autoReloadPersistedModels(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    const persistedModels = this.getPersistedLoadedModels();
    
    if (persistedModels.length > 0) {
      console.log(`🔄 Rechargement automatique de ${persistedModels.length} modèles persistés...`);
      
      for (const modelType of persistedModels) {
        try {
          await this.loadTranslationPipeline(modelType);
          console.log(`✅ Modèle ${modelType} rechargé automatiquement`);
        } catch (error) {
          console.warn(`⚠️ Échec du rechargement automatique de ${modelType}:`, error);
        }
      }
    }
  }

  private getPersistedLoadedModels(): AllowedModelType[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const savedModels = localStorage.getItem(this.STORAGE_KEY_LOADED_MODELS);
      if (savedModels) {
        const modelIds: string[] = JSON.parse(savedModels);
        return modelIds.includes('basic') ? [ACTIVE_MODELS.basicModel] : 
               modelIds.includes('high') ? [ACTIVE_MODELS.highModel] : [];
      }
    } catch (error) {
      console.warn('⚠️ Erreur lors de la lecture des modèles persistés:', error);
    }
    return [];
  }

  private persistState(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const loadedModelTypes = this.getLoadedModels();
      const modelIds = loadedModelTypes.map(type => 
        type === ACTIVE_MODELS.basicModel ? 'basic' : 'high'
      );
      
      localStorage.setItem(this.STORAGE_KEY_LOADED_MODELS, JSON.stringify(modelIds));
      console.log(`💾 État persisté: ${loadedModelTypes.length} modèles`);
    } catch (error) {
      console.warn('⚠️ Erreur lors de la sauvegarde de l\'état:', error);
    }
  }
  /**
   * Notifie la progression du chargement (interface moderne)
   */
  private notifyProgress(modelId: string, progress: TranslationProgress): void {
    const callback = this.progressCallbacks.get(modelId);
    if (callback) {
      callback(progress);
    }
  }
}

// Instance singleton
export const translationService = TranslationService.getInstance();
export default TranslationService;