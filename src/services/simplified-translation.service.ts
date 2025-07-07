/**
 * Service de traduction simplifié utilisant @huggingface/transformers
 * Utilise uniquement 2 modèles configurables via variables d'environnement
 */

import { pipeline } from '@huggingface/transformers';
import { 
  getAllActiveModels,
  selectModelForMessage,
  getActiveModelConfig,
  ACTIVE_MODELS,
  type AllowedModelType,
  type ActiveModelType 
} from '@/lib/simple-model-config';
import { 
  type UnifiedModelConfig 
} from '@/lib/unified-model-config';

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

// Type pour le pipeline de traduction (simplifié)
type TranslationPipeline = any;

/**
 * Service de traduction simplifié pour 2 modèles uniquement
 */
export class SimplifiedTranslationService {
  private static instance: SimplifiedTranslationService;
  private loadedPipelines = new Map<AllowedModelType, TranslationPipeline>();
  private loadingPromises = new Map<AllowedModelType, Promise<TranslationPipeline>>();
  private progressCallbacks = new Map<AllowedModelType, (progress: TranslationProgress) => void>();
  
  // Clés pour la persistance localStorage
  private readonly STORAGE_KEY_LOADED_MODELS = 'meeshy_simple_loaded_models';

  static getInstance(): SimplifiedTranslationService {
    if (!SimplifiedTranslationService.instance) {
      SimplifiedTranslationService.instance = new SimplifiedTranslationService();
    }
    return SimplifiedTranslationService.instance;
  }

  private constructor() {
    // Charger les modèles persistés
    this.loadPersistedModels();
  }

  /**
   * Charge les modèles persistés depuis localStorage
   */
  private loadPersistedModels(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_LOADED_MODELS);
      if (stored) {
        const modelNames: AllowedModelType[] = JSON.parse(stored);
        console.log('🔄 Modèles persistés trouvés:', modelNames);
      }
    } catch (error) {
      console.warn('Erreur lors du chargement des modèles persistés:', error);
    }
  }

  /**
   * Sauvegarde les modèles chargés dans localStorage
   */
  private saveLoadedModels(): void {
    try {
      const loadedModels = Array.from(this.loadedPipelines.keys());
      localStorage.setItem(this.STORAGE_KEY_LOADED_MODELS, JSON.stringify(loadedModels));
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde des modèles:', error);
    }
  }

  /**
   * Charge un modèle spécifique
   */
  async loadModel(
    modelType: AllowedModelType,
    progressCallback?: (progress: TranslationProgress) => void
  ): Promise<TranslationPipeline> {
    // Modèle déjà chargé
    if (this.loadedPipelines.has(modelType)) {
      return this.loadedPipelines.get(modelType)!;
    }

    // Modèle en cours de chargement
    if (this.loadingPromises.has(modelType)) {
      return this.loadingPromises.get(modelType)!;
    }

    // Obtenir la configuration du modèle
    const modelConfig = modelType === ACTIVE_MODELS.basicModel 
      ? getActiveModelConfig('basic')
      : getActiveModelConfig('high');

    if (progressCallback) {
      this.progressCallbacks.set(modelType, progressCallback);
    }

    const loadingPromise = this.performModelLoading(modelType, modelConfig);
    this.loadingPromises.set(modelType, loadingPromise);

    try {
      const pipeline = await loadingPromise;
      this.loadedPipelines.set(modelType, pipeline);
      this.saveLoadedModels();
      
      // Signaler le succès
      if (progressCallback) {
        progressCallback({
          modelName: modelType,
          status: 'ready',
          progress: 100
        });
      }

      return pipeline;
    } catch (error) {
      // Signaler l'erreur
      if (progressCallback) {
        progressCallback({
          modelName: modelType,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
      }
      throw error;
    } finally {
      this.loadingPromises.delete(modelType);
      this.progressCallbacks.delete(modelType);
    }
  }

  /**
   * Effectue le chargement réel du modèle
   */
  private async performModelLoading(
    modelType: AllowedModelType,
    config: UnifiedModelConfig
  ): Promise<TranslationPipeline> {
    console.log(`🔄 Chargement du modèle ${modelType}:`, config.huggingFaceId);

    const progressCallback = this.progressCallbacks.get(modelType);

    try {
      // Signaler le début du téléchargement
      if (progressCallback) {
        progressCallback({
          modelName: modelType,
          status: 'downloading',
          progress: 0
        });
      }

      // Simulation du progrès de téléchargement (HF Transformers ne fournit pas de callback)
      const progressInterval = setInterval(() => {
        if (progressCallback) {
          progressCallback({
            modelName: modelType,
            status: 'downloading',
            progress: Math.min(90, Math.random() * 80 + 10)
          });
        }
      }, 500);

      // Créer le pipeline avec timeout de 30 secondes
      const loadingTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout de chargement (30s)')), 30000);
      });

      const pipelinePromise = pipeline('translation', config.huggingFaceId, {
        quantized: true, // Optimisation mémoire
        revision: 'main'
      });

      const translationPipeline = await Promise.race([pipelinePromise, loadingTimeout]);

      clearInterval(progressInterval);

      // Signaler la fin du chargement
      if (progressCallback) {
        progressCallback({
          modelName: modelType,
          status: 'loading',
          progress: 95
        });
      }

      console.log(`✅ Modèle ${modelType} chargé avec succès`);
      return translationPipeline;

    } catch (error) {
      console.error(`❌ Erreur lors du chargement du modèle ${modelType}:`, error);
      throw error;
    }
  }

  /**
   * Traduit un texte en utilisant le modèle approprié
   */
  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    options: {
      forceModel?: ActiveModelType;
      maxRetries?: number;
    } = {}
  ): Promise<TranslationResult> {
    const { forceModel, maxRetries = 2 } = options;

    // Sélectionner le modèle approprié
    const selectedModel = forceModel 
      ? { type: forceModel, config: getActiveModelConfig(forceModel) }
      : selectModelForMessage(text.length, text.length > 50 ? 'complex' : 'simple');

    const modelType = selectedModel.type === 'basic' ? ACTIVE_MODELS.basicModel : ACTIVE_MODELS.highModel;

    // Charger le modèle si nécessaire
    const pipeline = await this.loadModel(modelType);

    // Formatage du prompt selon le modèle
    let prompt: string;
    if (modelType.startsWith('MT5_')) {
      prompt = `translate ${sourceLanguage} to ${targetLanguage}: ${text}`;
    } else {
      // NLLB utilise des codes de langue spécifiques
      prompt = text; // NLLB gère automatiquement les langues
    }

    try {
      // Effectuer la traduction avec limitation stricte
      const result = await this.performTranslation(pipeline, prompt, {
        max_length: 200, // Limite stricte
        num_beams: 2,
        early_stopping: true,
        timeout: 30000 // 30 secondes max
      });

      return {
        translatedText: result,
        sourceLanguage,
        targetLanguage,
        modelUsed: modelType,
        confidence: 0.95 // Valeur par défaut
      };

    } catch (error) {
      console.error(`Erreur de traduction avec ${modelType}:`, error);
      
      // Retry avec l'autre modèle si possible
      if (maxRetries > 0) {
        const alternativeType: ActiveModelType = selectedModel.type === 'basic' ? 'high' : 'basic';
        return this.translate(text, sourceLanguage, targetLanguage, {
          forceModel: alternativeType,
          maxRetries: maxRetries - 1
        });
      }

      throw error;
    }
  }

  /**
   * Effectue la traduction avec gestion des erreurs
   */
  private async performTranslation(
    pipeline: TranslationPipeline,
    prompt: string,
    options: any
  ): Promise<string> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout de traduction')), options.timeout || 30000);
    });

    const translationPromise = pipeline(prompt, options);

    const result = await Promise.race([translationPromise, timeoutPromise]);

    // Extraire le texte traduit selon le format de retour
    if (Array.isArray(result) && result.length > 0) {
      return result[0].translation_text || result[0].generated_text || result[0];
    }
    
    if (typeof result === 'object' && result.translation_text) {
      return result.translation_text;
    }
    
    if (typeof result === 'string') {
      return result;
    }

    throw new Error('Format de résultat inattendu');
  }

  /**
   * Décharge un modèle de la mémoire
   */
  async unloadModel(modelType: AllowedModelType): Promise<boolean> {
    try {
      if (this.loadedPipelines.has(modelType)) {
        // Nettoyer la mémoire (approximatif)
        const pipeline = this.loadedPipelines.get(modelType);
        if (pipeline && typeof pipeline.dispose === 'function') {
          await pipeline.dispose();
        }
        
        this.loadedPipelines.delete(modelType);
        this.saveLoadedModels();
        
        console.log(`✅ Modèle ${modelType} déchargé`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Erreur lors du déchargement de ${modelType}:`, error);
      return false;
    }
  }

  /**
   * Obtient les statistiques des modèles
   */
  getModelStats() {
    const loadedModels = Array.from(this.loadedPipelines.keys());
    const totalModels = 2; // Seulement 2 modèles configurés

    return {
      loadedModels,
      totalModels,
      activeModels: [ACTIVE_MODELS.basicModel, ACTIVE_MODELS.highModel],
      memoryUsage: loadedModels.length * 1024 // Estimation grossière
    };
  }

  /**
   * Vérifie si un modèle est chargé
   */
  isModelLoaded(modelType: AllowedModelType): boolean {
    return this.loadedPipelines.has(modelType);
  }

  /**
   * Nettoie tous les modèles
   */
  async cleanup(): Promise<void> {
    const unloadPromises = Array.from(this.loadedPipelines.keys()).map(
      modelType => this.unloadModel(modelType)
    );
    
    await Promise.all(unloadPromises);
    
    // Nettoyer le localStorage
    localStorage.removeItem(this.STORAGE_KEY_LOADED_MODELS);
  }
}

// Export pour compatibilité
export { SimplifiedTranslationService as HuggingFaceTranslationService };
