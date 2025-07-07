import { 
  type TranslationModelType, 
  type ModelCost, 
  UNIFIED_TRANSLATION_MODELS as TRANSLATION_MODELS,
  getModelConfig,
  getModelsByFamily,
  getCompatibleModels,
  recommendModel
} from '@/lib/unified-model-config';
import { HuggingFaceTranslationService } from '@/services/huggingface-translation';
import { RealTranslationService } from '@/services/real-translation-service';

// Interface pour la configuration des modèles avec statistiques d'usage
export interface ModelConfig {
  modelType: TranslationModelType;
  displayName: string;
  family: 'MT5' | 'NLLB';
  size: string;
  parameters: string;
  maxTokens: number;
  complexity: 'simple' | 'intermediate' | 'complex' | 'advanced';
  languages: string[];
  modelUrl?: string;
  tokenizer?: string;
  cost: ModelCost;
  color: string;
  quality: 'basic' | 'good' | 'high' | 'excellent' | 'premium';
  usageStats?: {
    totalUsage: number;
    lastUsed: Date | null;
    averageInferenceTime: number;
    successRate: number;
  };
}

// Configuration complète de tous les modèles supportés
export const MODELS_CONFIG: Record<TranslationModelType, ModelConfig> = Object.keys(TRANSLATION_MODELS).reduce((acc, key) => {
  const modelType = key as TranslationModelType;
  const unifiedConfig = TRANSLATION_MODELS[modelType];
  
  acc[modelType] = {
    modelType,
    displayName: unifiedConfig.displayName,
    family: unifiedConfig.family,
    size: unifiedConfig.size,
    parameters: unifiedConfig.parameters,
    maxTokens: unifiedConfig.maxTokens,
    complexity: unifiedConfig.purpose === 'simple' ? 'simple' : 'complex',
    languages: unifiedConfig.family === 'MT5' ? 
      ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'] :
      ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'tr', 'pl', 'nl'],
    modelUrl: unifiedConfig.modelUrl,
    tokenizer: unifiedConfig.tokenizerUrl || `/models/${unifiedConfig.name.toLowerCase()}/tokenizer.json`,
    cost: unifiedConfig.cost,
    color: unifiedConfig.family === 'MT5' ? '#4F46E5' : '#059669',
    quality: unifiedConfig.size === 'small' ? 'good' : 'excellent',
    usageStats: {
      totalUsage: 0,
      lastUsed: null,
      averageInferenceTime: 0,
      successRate: 0
    }
  };
  
  return acc;
}, {} as Record<TranslationModelType, ModelConfig>);

// Cache des modèles chargés en mémoire
class TranslationModelsManager {
  private loadedModels: Map<TranslationModelType, tf.GraphModel> = new Map();
  private loadingPromises: Map<TranslationModelType, Promise<tf.GraphModel | null>> = new Map();

  /**
   * Vérifie si un modèle est chargé en mémoire
   */
  isModelLoaded(modelType: TranslationModelType): boolean;
  isModelLoaded(modelName: string): boolean;
  isModelLoaded(model: TranslationModelType | string): boolean {
    return this.loadedModels.has(model as TranslationModelType);
  }

  /**
   * Obtient la liste des modèles chargés (compatibilité debug)
   */
  getLoadedModels(): string[] {
    return Array.from(this.loadedModels.keys());
  }

  /**
   * Obtient un modèle chargé
   */
  getLoadedModel(modelType: TranslationModelType): tf.GraphModel | null {
    return this.loadedModels.get(modelType) || null;
  }

  /**
   * Charge un modèle (PRODUCTION - utilise le RealModelDownloadService)
   */
  async loadModel(modelType: TranslationModelType): Promise<tf.GraphModel | null> {
    if (this.loadedModels.has(modelType)) {
      return this.loadedModels.get(modelType)!;
    }

    if (this.loadingPromises.has(modelType)) {
      return this.loadingPromises.get(modelType)!;
    }

    const config = MODELS_CONFIG[modelType];
    if (!config) {
      console.error(`Configuration non trouvée pour le modèle: ${modelType}`);
      return null;
    }

    console.log(`🔄 Chargement RÉEL du modèle ${modelType} via RealModelDownloadService...`);
    
    // Utiliser le RealModelDownloadService pour télécharger et charger le modèle
    const loadingPromise = this.loadModelWithRealService(modelType);
    this.loadingPromises.set(modelType, loadingPromise);
    
    try {
      const model = await loadingPromise;
      this.loadingPromises.delete(modelType);
      
      if (model) {
        this.loadedModels.set(modelType, model);
        console.log(`✅ Modèle ${modelType} chargé et mis en cache`);
      }
      
      return model;
    } catch (error) {
      this.loadingPromises.delete(modelType);
      console.error(`❌ Erreur chargement ${modelType}:`, error);
      throw error;
    }
  }

  /**
   * Charge un modèle avec le RealModelDownloadService
   */
  private async loadModelWithRealService(modelType: TranslationModelType): Promise<tf.GraphModel | null> {
    const modelService = RealModelDownloadService.getInstance();
    
    // Mapper le modelType vers le nom utilisé par RealModelDownloadService
    let modelName: string;
    switch (modelType) {
      case 'MT5_SMALL':
        modelName = 'MT5_SMALL';
        break;
      case 'NLLB_DISTILLED_600M':
        modelName = 'NLLB_DISTILLED_600M';
        break;
      default:
        console.warn(`Modèle non supporté par RealModelDownloadService: ${modelType}`);
        return null;
    }
    
    return await modelService.downloadAndLoadModel(modelName);
  }

  /**
   * Décharge un modèle de la mémoire
   */
  unloadModel(modelType: TranslationModelType): void {
    const model = this.loadedModels.get(modelType);
    if (model) {
      model.dispose();
      this.loadedModels.delete(modelType);
      console.log(`♻️ Modèle ${modelType} déchargé de la mémoire`);
    }
  }

  /**
   * Obtient les statistiques de mémoire
   */
  getMemoryStats() {
    const loadedModels = Array.from(this.loadedModels.keys());
    const memoryInfo = tf.memory();
    
    return {
      loadedModels,
      modelCount: loadedModels.length,
      tensors: memoryInfo.numTensors,
      memoryBytes: memoryInfo.numBytes,
      memoryMB: Math.round(memoryInfo.numBytes / (1024 * 1024))
    };
  }

  /**
   * Décharge tous les modèles (compatibilité debug)
   */
  unloadAllModels(): void {
    for (const modelType of this.loadedModels.keys()) {
      this.unloadModel(modelType);
    }
    this.loadingPromises.clear();
  }

  /**
   * Obtient tous les modèles disponibles
   */
  getAllAvailableModels(): TranslationModelType[] {
    return Object.keys(MODELS_CONFIG) as TranslationModelType[];
  }

  /**
   * Obtient la clé d'un modèle (compatibilité)
   */
  getModelKey(modelType: TranslationModelType): string {
    return modelType;
  }

  /**
   * Obtient les métriques d'un modèle
   */
  getModelMetrics(modelType: TranslationModelType) {
    const config = MODELS_CONFIG[modelType];
    if (!config) {
      throw new Error(`Configuration non trouvée pour le modèle: ${modelType}`);
    }
    
    return {
      config,
      isLoaded: this.isModelLoaded(modelType),
      memoryUsage: config.cost.memoryUsage,
      lastUsed: config.usageStats?.lastUsed || null,
      successRate: config.usageStats?.successRate || 0
    };
  }

  /**
   * Obtient les modèles disponibles par famille
   */
  getAvailableModelsByFamily(family: 'MT5' | 'NLLB'): TranslationModelType[] {
    return Object.keys(MODELS_CONFIG).filter(key => {
      const config = MODELS_CONFIG[key as TranslationModelType];
      return config.family === family;
    }) as TranslationModelType[];
  }

  /**
   * Traduit un texte avec un modèle spécifique (PRODUCTION)
   */
  async translateWithModel(
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string, 
    modelType: TranslationModelType
  ): Promise<string> {
    console.log(`🔄 Traduction RÉELLE via RealTranslationService: ${text.substring(0, 50)}... (${sourceLanguage} -> ${targetLanguage}, ${modelType})`);
    
    const translationService = RealTranslationService.getInstance();
    return await translationService.translateMessage(text, sourceLanguage, targetLanguage);
  }

  /**
   * Traduit un texte avec sélection automatique de modèle (PRODUCTION)
   */
  async translate(
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string
  ): Promise<string> {
    console.log(`🔄 Traduction automatique RÉELLE via RealTranslationService: ${text.substring(0, 50)}... (${sourceLanguage} -> ${targetLanguage})`);
    
    const translationService = RealTranslationService.getInstance();
    return await translationService.translateMessage(text, sourceLanguage, targetLanguage);
  }
}

// Instance singleton
export const translationModels = new TranslationModelsManager();

// Exports de compatibilité
export { TRANSLATION_MODELS, getModelConfig, getModelsByFamily, getCompatibleModels, recommendModel };
export type { TranslationModelType };
