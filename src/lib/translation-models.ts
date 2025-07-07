import { 
  type TranslationModelType as UnifiedTranslationModelType, 
  type ModelCost, 
  UNIFIED_TRANSLATION_MODELS as TRANSLATION_MODELS,
  getModelConfig,
  getModelsByFamily,
  getCompatibleModels,
  recommendModel
} from '@/lib/unified-model-config';
import { type TranslationModelType as HFTranslationModelType } from '@/lib/simplified-model-config';
import { HuggingFaceTranslationService } from '@/services/huggingface-translation';

// Type unifié pour compatibilité
export type TranslationModelType = UnifiedTranslationModelType;

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
  private loadedModels: Map<TranslationModelType, boolean> = new Map();
  private loadingPromises: Map<TranslationModelType, Promise<boolean>> = new Map();

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
  getLoadedModel(modelType: TranslationModelType): boolean | null {
    return this.loadedModels.get(modelType) || null;
  }

  /**
   * Charge un modèle via HuggingFaceTranslationService
   */
  async loadModel(modelType: TranslationModelType): Promise<boolean> {
    if (this.loadedModels.has(modelType)) {
      return true;
    }

    if (this.loadingPromises.has(modelType)) {
      return this.loadingPromises.get(modelType)!;
    }

    const config = MODELS_CONFIG[modelType];
    if (!config) {
      console.error(`Configuration non trouvée pour le modèle: ${modelType}`);
      return false;
    }

    console.log(`🔄 Chargement du modèle ${modelType} via HuggingFaceTranslationService...`);
    
    const loadingPromise = this.loadModelWithHuggingFace(modelType);
    this.loadingPromises.set(modelType, loadingPromise);
    
    try {
      const success = await loadingPromise;
      this.loadingPromises.delete(modelType);
      
      if (success) {
        this.loadedModels.set(modelType, true);
        console.log(`✅ Modèle ${modelType} chargé et mis en cache`);
      }
      
      return success;
    } catch (error) {
      this.loadingPromises.delete(modelType);
      console.error(`❌ Erreur chargement ${modelType}:`, error);
      throw error;
    }
  }

  /**
   * Charge un modèle avec HuggingFaceTranslationService
   */
  private async loadModelWithHuggingFace(modelType: TranslationModelType): Promise<boolean> {
    const translationService = HuggingFaceTranslationService.getInstance();
    
    try {
      // Mapper vers le type HuggingFace
      const hfModelType = this.mapToHFModelType(modelType);
      if (!hfModelType) {
        console.warn(`Modèle non supporté par HuggingFaceTranslationService: ${modelType}`);
        return false;
      }
      
      // Utiliser la méthode loadModel du service HuggingFace
      await translationService.loadModel(hfModelType);
      return true;
    } catch (error) {
      console.error(`Erreur lors du chargement du modèle ${modelType}:`, error);
      return false;
    }
  }

  /**
   * Mapper les types de modèles vers HuggingFace
   */
  private mapToHFModelType(modelType: TranslationModelType): HFTranslationModelType | null {
    switch (modelType) {
      case 'MT5_SMALL':
        return 'MT5_BASE' as HFTranslationModelType;
      case 'MT5_BASE':
        return 'MT5_BASE' as HFTranslationModelType;
      case 'NLLB_DISTILLED_600M':
        return 'NLLB_DISTILLED_600M' as HFTranslationModelType;
      default:
        console.warn(`Modèle non supporté: ${modelType}`);
        return null;
    }
  }

  /**
   * Décharge un modèle de la mémoire
   */
  unloadModel(modelType: TranslationModelType): void {
    if (this.loadedModels.has(modelType)) {
      this.loadedModels.delete(modelType);
      console.log(`♻️ Modèle ${modelType} déchargé de la mémoire`);
    }
  }

  /**
   * Obtient les statistiques de mémoire
   */
  getMemoryStats() {
    const loadedModels = Array.from(this.loadedModels.keys());
    
    return {
      loadedModels,
      modelCount: loadedModels.length,
      memoryMB: loadedModels.length * 100 // Estimation approximative
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
   * Traduit un texte avec un modèle spécifique via HuggingFaceTranslationService
   */
  async translateWithModel(
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string, 
    modelType: TranslationModelType
  ): Promise<string> {
    console.log(`🔄 Traduction via HuggingFaceTranslationService: ${text.substring(0, 50)}... (${sourceLanguage} -> ${targetLanguage}, ${modelType})`);
    
    const translationService = HuggingFaceTranslationService.getInstance();
    
    // Mapper vers le type HuggingFace
    const hfModelType = this.mapToHFModelType(modelType);
    if (!hfModelType) {
      throw new Error(`Modèle non supporté: ${modelType}`);
    }
    
    const result = await translationService.translateText(text, sourceLanguage, targetLanguage, hfModelType);
    return result.translatedText;
  }

  /**
   * Traduit un texte avec sélection automatique de modèle
   */
  async translate(
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string
  ): Promise<string> {
    console.log(`🔄 Traduction automatique via HuggingFaceTranslationService: ${text.substring(0, 50)}... (${sourceLanguage} -> ${targetLanguage})`);
    
    // Sélectionner le meilleur modèle automatiquement
    const modelType = text.length < 50 ? 'MT5_SMALL' : 'NLLB_DISTILLED_600M';
    return await this.translateWithModel(text, sourceLanguage, targetLanguage, modelType as TranslationModelType);
  }
}

// Instance singleton
export const translationModels = new TranslationModelsManager();

// Exports de compatibilité
export { TRANSLATION_MODELS, getModelConfig, getModelsByFamily, getCompatibleModels, recommendModel };
