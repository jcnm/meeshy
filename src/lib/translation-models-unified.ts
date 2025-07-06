import * as tf from '@tensorflow/tfjs';
import { 
  type TranslationModelType, 
  type ModelCost, 
  UNIFIED_TRANSLATION_MODELS as TRANSLATION_MODELS,
  getModelConfig,
  getModelsByFamily,
  getCompatibleModels,
  recommendModel
} from '@/lib/unified-model-config';

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
// Maintenant basée sur UNIFIED_TRANSLATION_MODELS avec des ajouts spécifiques
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
    tokenizer: `${unifiedConfig.family.toLowerCase()}-${unifiedConfig.size.toLowerCase()}`,
    cost: unifiedConfig.cost,
    color: unifiedConfig.color,
    quality: unifiedConfig.quality,
    usageStats: {
      totalUsage: 0,
      lastUsed: null,
      averageInferenceTime: unifiedConfig.cost.inferenceTime,
      successRate: 0.95
    }
  };
  
  return acc;
}, {} as Record<TranslationModelType, ModelConfig>);

/**
 * Service de gestion des modèles de traduction
 * Utilise la configuration unifiée pour une source unique de vérité
 */
export class TranslationModels {
  private models = new Map<string, tf.GraphModel>();
  private loadingPromises = new Map<string, Promise<tf.GraphModel | null>>();
  private initializationAttempted = new Map<string, boolean>();

  /**
   * Charge un modèle de traduction
   */
  async loadModel(modelName: string): Promise<tf.GraphModel | null> {
    // Si le modèle est déjà chargé, le retourner
    const cachedModel = this.models.get(modelName);
    if (cachedModel) {
      return cachedModel;
    }

    // Si le modèle est en cours de chargement, attendre
    const loadingPromise = this.loadingPromises.get(modelName);
    if (loadingPromise) {
      return loadingPromise;
    }

    // Éviter les tentatives répétées de chargement d'un modèle qui a échoué
    if (this.initializationAttempted.get(modelName)) {
      console.log(`⚠️ Modèle ${modelName} déjà tenté, utilisation du fallback`);
      return null;
    }

    // Commencer le chargement du modèle
    const promise = this.loadModelFromPath(modelName);
    this.loadingPromises.set(modelName, promise);
    this.initializationAttempted.set(modelName, true);

    try {
      const model = await promise;
      if (model) {
        this.models.set(modelName, model);
      }
      this.loadingPromises.delete(modelName);
      
      if (model) {
        console.log(`✅ Modèle ${modelName} chargé avec succès`);
      } else {
        console.log(`⚠️ Modèle ${modelName} non disponible, utilisation du fallback`);
      }
      
      return model;
    } catch (loadError) {
      this.loadingPromises.delete(modelName);
      console.error(`❌ Erreur lors du chargement du modèle ${modelName}:`, loadError);
      return null;
    }
  }

  /**
   * Charge le modèle depuis le système de fichiers ou URL
   */
  private async loadModelFromPath(modelName: string): Promise<tf.GraphModel | null> {
    const config = MODELS_CONFIG[modelName as TranslationModelType];
    if (!config) {
      throw new Error(`Configuration pour le modèle ${modelName} non trouvée`);
    }

    try {
      // Vérifier d'abord en local
      const localPath = `/models/${modelName}/model.json`;
      let model: tf.GraphModel;
      
      try {
        model = await tf.loadGraphModel(localPath);
        console.log(`📁 Modèle ${modelName} chargé depuis le cache local`);
        return model;
      } catch {
        console.log(`📂 Modèle ${modelName} non trouvé en local, téléchargement depuis l'URL...`);
        
        // Fallback vers l'URL externe
        if (config.modelUrl) {
          model = await tf.loadGraphModel(config.modelUrl);
          console.log(`🌐 Modèle ${modelName} téléchargé depuis ${config.modelUrl}`);
          return model;
        } else {
          throw new Error(`Aucune URL de modèle disponible pour ${modelName}`);
        }
      }
    } catch (error) {
      console.error(`❌ Impossible de charger le modèle ${modelName}:`, error);
      return null;
    }
  }

  /**
   * Obtient le nom du modèle approprié pour un type TranslationModelType
   */
  getModelKey(modelType: TranslationModelType): string {
    const config = getModelConfig(modelType);
    return `${config.family.toLowerCase()}_${config.size.toLowerCase()}`;
  }

  /**
   * Convertit un nom de modèle vers TranslationModelType
   */
  getModelType(modelName: string): TranslationModelType {
    // Conversion du format ancien vers le nouveau
    const mapping: Record<string, TranslationModelType> = {
      'mt5': 'MT5_SMALL',
      'mt5_small': 'MT5_SMALL',
      'mt5_base': 'MT5_BASE',
      'mt5_large': 'MT5_LARGE',
      'mt5_xl': 'MT5_XL',
      'mt5_xxl': 'MT5_XXL',
      'nllb': 'NLLB_200M',
      'nllb_200m': 'NLLB_200M',
      'nllb_distilled_600m': 'NLLB_DISTILLED_600M',
      'nllb_distilled_1_3b': 'NLLB_DISTILLED_1_3B',
      'nllb_1_3b': 'NLLB_1_3B',
      'nllb_3_3b': 'NLLB_3_3B',
      'nllb_54b': 'NLLB_54B'
    };

    return mapping[modelName.toLowerCase()] || 'MT5_SMALL';
  }

  /**
   * Vérifie si un modèle est disponible
   */
  isModelLoaded(modelName: string): boolean {
    return this.models.has(modelName);
  }

  /**
   * Obtient la liste des modèles chargés
   */
  getLoadedModels(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Libère un modèle de la mémoire
   */
  unloadModel(modelName: string): boolean {
    const model = this.models.get(modelName);
    if (model) {
      model.dispose();
      this.models.delete(modelName);
      this.initializationAttempted.delete(modelName);
      console.log(`🗑️ Modèle ${modelName} déchargé de la mémoire`);
      return true;
    }
    return false;
  }

  /**
   * Libère tous les modèles de la mémoire
   */
  unloadAllModels(): void {
    for (const [modelName, model] of this.models.entries()) {
      model.dispose();
      console.log(`🗑️ Modèle ${modelName} déchargé`);
    }
    this.models.clear();
    this.initializationAttempted.clear();
    this.loadingPromises.clear();
  }

  /**
   * Met à jour les statistiques d'usage d'un modèle
   */
  updateUsageStats(modelType: TranslationModelType, inferenceTime: number, success: boolean): void {
    const config = MODELS_CONFIG[modelType];
    if (config && config.usageStats) {
      config.usageStats.totalUsage++;
      config.usageStats.lastUsed = new Date();
      
      // Moyenne mobile de temps d'inférence
      const currentAvg = config.usageStats.averageInferenceTime;
      const totalUsage = config.usageStats.totalUsage;
      config.usageStats.averageInferenceTime = 
        (currentAvg * (totalUsage - 1) + inferenceTime) / totalUsage;
      
      // Taux de succès avec moyenne mobile
      const currentRate = config.usageStats.successRate;
      config.usageStats.successRate = 
        (currentRate * (totalUsage - 1) + (success ? 1 : 0)) / totalUsage;
    }
  }

  /**
   * Obtient les modèles disponibles pour une famille donnée
   * Utilise la nouvelle configuration unifiée
   */
  getAvailableModelsByFamily(family: 'MT5' | 'NLLB'): TranslationModelType[] {
    return getModelsByFamily(family).map(config => config.name);
  }

  /**
   * Obtient tous les modèles disponibles
   */
  getAllAvailableModels(): TranslationModelType[] {
    return Object.keys(TRANSLATION_MODELS) as TranslationModelType[];
  }

  /**
   * Vérifie si un modèle est disponible selon les capacités système
   */
  isModelAvailable(modelType: TranslationModelType): boolean {
    const compatibleModels = getCompatibleModels(8192); // 8GB par défaut
    return compatibleModels.some(model => model.name === modelType);
  }

  /**
   * Recommande le meilleur modèle selon les critères
   */
  recommendBestModel(options: {
    purpose: 'simple' | 'complex';
    priority: 'speed' | 'quality' | 'efficiency';
    maxMemoryMB?: number;
    family?: 'MT5' | 'NLLB';
  }): TranslationModelType {
    const recommended = recommendModel(options);
    return recommended.name;
  }

  /**
   * Obtient les métriques de performance d'un modèle
   */
  getModelMetrics(modelType: TranslationModelType): {
    config: ModelConfig;
    isLoaded: boolean;
    usageStats?: ModelConfig['usageStats'];
  } {
    const config = MODELS_CONFIG[modelType];
    const modelKey = this.getModelKey(modelType);
    
    return {
      config,
      isLoaded: this.isModelLoaded(modelKey),
      usageStats: config.usageStats
    };
  }
}

// Instance unique du gestionnaire de modèles
export const translationModels = new TranslationModels();

// Fonction utilitaire pour obtenir le coût total d'une liste de traductions
export function calculateTranslationCost(translations: Array<{
  modelType: TranslationModelType;
  count: number;
}>): {
  totalEnergy: number;
  totalCO2: number;
  totalCost: number;
  totalTime: number;
} {
  return translations.reduce((acc, { modelType, count }) => {
    const config = MODELS_CONFIG[modelType];
    if (config) {
      acc.totalEnergy += config.cost.energyConsumption * count;
      acc.totalCO2 += config.cost.co2Equivalent * count;
      acc.totalCost += config.cost.monetaryEquivalent * count;
      acc.totalTime += config.cost.inferenceTime * count;
    }
    return acc;
  }, {
    totalEnergy: 0,
    totalCO2: 0,
    totalCost: 0,
    totalTime: 0
  });
}

export default translationModels;
