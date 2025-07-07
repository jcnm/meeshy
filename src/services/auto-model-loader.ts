/**
 * Service de chargement automatique des modèles
 * Charge automatiquement les modèles essentiels au démarrage de l'application
 */

import { translationModels, type TranslationModelType } from '@/lib/translation-models';
import { ModelCacheService } from '@/lib/model-cache';
import { toast } from 'sonner';

export interface AutoLoadConfig {
  models: {
    mt5: string;
    nllb: string;
  };
  fallbackUrls: {
    mt5: string;
    nllb: string;
  };
  timeout: number;
  retries: number;
}

export interface LoadingProgress {
  modelName: string;
  progress: number;
  status: 'loading' | 'success' | 'error';
  message?: string;
}

const DEFAULT_CONFIG: AutoLoadConfig = {
  models: {
    mt5: 'MT5_SMALL',
    nllb: 'NLLB_DISTILLED_600M'
  },
  fallbackUrls: {
    mt5: 'https://huggingface.co/Xenova/mt5-small/resolve/main',
    nllb: 'https://huggingface.co/Xenova/nllb-200-distilled-600M/resolve/main'
  },
  timeout: 30000, // 30 secondes
  retries: 2
};

export class AutoModelLoader {
  private static instance: AutoModelLoader;
  private config: AutoLoadConfig;
  private modelCache: ModelCacheService;
  private loadingPromises: Map<string, Promise<boolean>> = new Map();
  private progressCallbacks: Set<(progress: LoadingProgress) => void> = new Set();

  private constructor(config: Partial<AutoLoadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modelCache = ModelCacheService.getInstance();
  }

  static getInstance(config?: Partial<AutoLoadConfig>): AutoModelLoader {
    if (!AutoModelLoader.instance) {
      AutoModelLoader.instance = new AutoModelLoader(config);
    }
    return AutoModelLoader.instance;
  }

  /**
   * Abonne à la progression du chargement
   */
  onProgress(callback: (progress: LoadingProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  /**
   * Notifie la progression
   */
  private notifyProgress(progress: LoadingProgress): void {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('Erreur dans le callback de progression:', error);
      }
    });
  }

  /**
   * Charge automatiquement les modèles essentiels au démarrage
   */
  async autoLoadEssentialModels(): Promise<{mt5: boolean, nllb: boolean}> {
    console.log('🚀 Démarrage du chargement automatique des modèles essentiels...');
    
    // Charger les deux modèles en parallèle
    const [mt5Success, nllbSuccess] = await Promise.all([
      this.loadModel('mt5', this.config.models.mt5),
      this.loadModel('nllb', this.config.models.nllb)
    ]);

    const result = { mt5: mt5Success, nllb: nllbSuccess };
    
    if (mt5Success && nllbSuccess) {
      console.log('✅ Tous les modèles essentiels chargés avec succès');
      toast.success('Modèles de traduction chargés');
    } else if (mt5Success || nllbSuccess) {
      console.log('⚠️ Certains modèles ont échoué au chargement');
      toast.warning('Certains modèles de traduction indisponibles');
    } else {
      console.log('❌ Aucun modèle n\'a pu être chargé');
      toast.error('Impossible de charger les modèles de traduction');
    }

    return result;
  }

  /**
   * Charge un modèle spécifique avec fallback
   */
  private async loadModel(family: 'mt5' | 'nllb', modelName: string): Promise<boolean> {
    // Éviter les chargements duplicatas
    if (this.loadingPromises.has(modelName)) {
      return await this.loadingPromises.get(modelName)!;
    }

    const loadingPromise = this.performModelLoad(family, modelName);
    this.loadingPromises.set(modelName, loadingPromise);

    try {
      const result = await loadingPromise;
      this.loadingPromises.delete(modelName);
      return result;
    } catch (error) {
      this.loadingPromises.delete(modelName);
      throw error;
    }
  }

  /**
   * Effectue le chargement réel du modèle
   */
  private async performModelLoad(family: 'mt5' | 'nllb', modelName: string): Promise<boolean> {
    this.notifyProgress({
      modelName,
      progress: 0,
      status: 'loading',
      message: `Vérification du modèle ${modelName}...`
    });

    try {
      // 1. Vérifier si le modèle est déjà en mémoire
      if (translationModels.isModelLoaded(modelName)) {
        this.notifyProgress({
          modelName,
          progress: 100,
          status: 'success',
          message: `Modèle ${modelName} déjà chargé`
        });
        return true;
      }

      this.notifyProgress({
        modelName,
        progress: 20,
        status: 'loading',
        message: `Chargement du modèle ${modelName}...`
      });

      // 2. Essayer de charger depuis le cache local/distant
      const model = await this.loadWithTimeout(modelName);

      if (model) {
        this.notifyProgress({
          modelName,
          progress: 100,
          status: 'success',
          message: `Modèle ${modelName} chargé avec succès`
        });
        return true;
      } else {
        throw new Error('Échec du chargement');
      }

    } catch (error) {
      console.error(`❌ Erreur chargement modèle ${modelName}:`, error);
      
      this.notifyProgress({
        modelName,
        progress: 0,
        status: 'error',
        message: `Échec du chargement de ${modelName}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      });

      return false;
    }
  }

  /**
   * Charge un modèle avec timeout
   */
  private async loadWithTimeout(modelName: string): Promise<unknown> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout après ${this.config.timeout}ms`));
      }, this.config.timeout);

      try {
        const model = await translationModels.loadModel(modelName as TranslationModelType);
        clearTimeout(timeoutId);
        resolve(model);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Vérifie quels modèles sont déjà chargés
   */
  getLoadedModelsStatus(): {mt5: boolean, nllb: boolean} {
    return {
      mt5: translationModels.isModelLoaded(this.config.models.mt5),
      nllb: translationModels.isModelLoaded(this.config.models.nllb)
    };
  }

  /**
   * Force le rechargement des modèles
   */
  async reloadModels(): Promise<{mt5: boolean, nllb: boolean}> {
    console.log('🔄 Rechargement forcé des modèles...');
    
    // Décharger les modèles existants
    translationModels.unloadModel(this.config.models.mt5 as TranslationModelType);
    translationModels.unloadModel(this.config.models.nllb as TranslationModelType);
    
    // Recharger
    return await this.autoLoadEssentialModels();
  }

  /**
   * Vérifie si les modèles essentiels sont disponibles
   */
  areEssentialModelsReady(): boolean {
    const status = this.getLoadedModelsStatus();
    return status.mt5 && status.nllb;
  }

  /**
   * Obtient des statistiques sur les modèles
   */
  getModelStats(): {
    total: number;
    loaded: number;
    failed: number;
    models: Array<{name: string, loaded: boolean, family: string}>;
  } {
    const models = [
      { name: this.config.models.mt5, family: 'mt5', loaded: translationModels.isModelLoaded(this.config.models.mt5) },
      { name: this.config.models.nllb, family: 'nllb', loaded: translationModels.isModelLoaded(this.config.models.nllb) }
    ];

    const loaded = models.filter(m => m.loaded).length;
    
    return {
      total: models.length,
      loaded,
      failed: models.length - loaded,
      models
    };
  }
}

// Instance globale
export const autoModelLoader = AutoModelLoader.getInstance();

/**
 * Hook React pour utiliser le chargement automatique des modèles
 */
export function useAutoModelLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<LoadingProgress[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Vérifier l'état initial
    setIsReady(autoModelLoader.areEssentialModelsReady());

    // S'abonner aux mises à jour de progression
    const unsubscribe = autoModelLoader.onProgress((progressUpdate) => {
      setProgress(prev => {
        const existing = prev.findIndex(p => p.modelName === progressUpdate.modelName);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = progressUpdate;
          return updated;
        } else {
          return [...prev, progressUpdate];
        }
      });
    });

    return unsubscribe;
  }, []);

  const loadModels = async () => {
    setIsLoading(true);
    try {
      const result = await autoModelLoader.autoLoadEssentialModels();
      setIsReady(result.mt5 && result.nllb);
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const reloadModels = async () => {
    setIsLoading(true);
    try {
      const result = await autoModelLoader.reloadModels();
      setIsReady(result.mt5 && result.nllb);
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    progress,
    isReady,
    loadModels,
    reloadModels,
    stats: autoModelLoader.getModelStats()
  };
}

// Import React pour le hook
import { useState, useEffect } from 'react';
