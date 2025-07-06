/**
 * Service de test pour les modèles de traduction
 * Simule le téléchargement et utilise l'API de fallback pour tester
 */

import { ModelCacheEntry, CachedModelInfo } from './model-cache';

export class TestModelService {
  private static instance: TestModelService;
  private simulatedCache = new Map<string, CachedModelInfo>();
  private downloadProgress = new Map<string, number>();

  static getInstance(): TestModelService {
    if (!TestModelService.instance) {
      TestModelService.instance = new TestModelService();
    }
    return TestModelService.instance;
  }

  /**
   * Simule la vérification d'un modèle en cache
   */
  async isModelCached(family: string, variant: string): Promise<boolean> {
    const key = `${family}-${variant}`;
    return this.simulatedCache.has(key);
  }

  /**
   * Simule la récupération d'un modèle depuis le cache
   */
  async getCachedModel(family: string, variant: string): Promise<ModelCacheEntry | null> {
    const key = `${family}-${variant}`;
    const info = this.simulatedCache.get(key);
    
    if (!info) return null;

    // Simule un modèle en cache
    return {
      info,
      modelBlob: new Blob(['fake-model-data'], { type: 'application/octet-stream' }),
      tokenizerBlob: new Blob(['fake-tokenizer-data'], { type: 'application/json' }),
    };
  }

  /**
   * Simule le téléchargement d'un modèle
   */
  async downloadAndCacheModel(
    family: string,
    variant: string,
    modelUrl: string,
    tokenizerUrl?: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    const key = `${family}-${variant}`;
    
    // Vérifier si le modèle existe dans la nouvelle configuration
    try {
      // Simple validation - si on peut créer une clé, le modèle existe conceptuellement
      const isValidModel = ['mt5', 'nllb'].includes(family.toLowerCase()) && 
                          ['small', 'base', 'large', '200m', '600m', '1_3b', '3_3b'].includes(variant.toLowerCase());
      
      if (!isValidModel) {
        console.error(`❌ Configuration non trouvée pour ${family}-${variant}`);
        return false;
      }
    } catch {
      console.error(`❌ Configuration non trouvée pour ${family}-${variant}`);
      return false;
    }

    console.log(`🔄 Simulation téléchargement ${family}-${variant}...`);

    // Simule le progrès de téléchargement
    for (let progress = 0; progress <= 100; progress += 10) {
      this.downloadProgress.set(key, progress);
      onProgress?.(progress);
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms par étape
    }

    // Ajouter au cache simulé
    const info: CachedModelInfo = {
      family,
      variant,
      downloadDate: Date.now(),
      fileSize: 100 * 1024 * 1024, // 100MB simulé
      version: '1.0.0-test',
    };

    this.simulatedCache.set(key, info);
    this.downloadProgress.delete(key);

    console.log(`✅ Modèle ${family}-${variant} téléchargé avec succès (simulé)`);
    return true;
  }

  /**
   * Supprime un modèle du cache simulé
   */
  async removeModel(family: string, variant: string): Promise<boolean> {
    const key = `${family}-${variant}`;
    const deleted = this.simulatedCache.delete(key);
    
    if (deleted) {
      console.log(`🗑️ Modèle ${family}-${variant} supprimé du cache (simulé)`);
    }
    
    return deleted;
  }

  /**
   * Obtient la liste des modèles en cache
   */
  async getCachedModels(): Promise<CachedModelInfo[]> {
    return Array.from(this.simulatedCache.values());
  }

  /**
   * Obtient les statistiques du cache
   */
  async getStats(): Promise<{
    totalModels: number;
    totalSize: number;
    oldestModel: Date | null;
    newestModel: Date | null;
  }> {
    const models = await this.getCachedModels();
    
    if (models.length === 0) {
      return {
        totalModels: 0,
        totalSize: 0,
        oldestModel: null,
        newestModel: null,
      };
    }

    const dates = models.map(m => m.downloadDate);
    
    return {
      totalModels: models.length,
      totalSize: models.reduce((sum, m) => sum + m.fileSize, 0),
      oldestModel: new Date(Math.min(...dates)),
      newestModel: new Date(Math.max(...dates)),
    };
  }

  /**
   * Nettoie le cache
   */
  async cleanOldModels(maxAgeInDays: number = 30): Promise<void> {
    const models = await this.getCachedModels();
    const cutoffDate = Date.now() - (maxAgeInDays * 24 * 60 * 60 * 1000);

    for (const model of models) {
      if (model.downloadDate < cutoffDate) {
        await this.removeModel(model.family, model.variant);
      }
    }
  }
}

export const testModelService = TestModelService.getInstance();
