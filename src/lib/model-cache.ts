/**
 * Service de cache pour les modèles de traduction
 * Gère le stockage local et la persistence des modèles TensorFlow.js
 */

export interface CachedModelInfo {
  family: string;
  variant: string;
  downloadDate: number;
  fileSize: number;
  version: string;
  checksum?: string;
}

export interface ModelCacheEntry {
  info: CachedModelInfo;
  modelBlob: Blob;
  tokenizerBlob?: Blob;
}

export class ModelCacheService {
  private static instance: ModelCacheService;
  private dbName = 'meeshy-models-cache';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  static getInstance(): ModelCacheService {
    if (!ModelCacheService.instance) {
      ModelCacheService.instance = new ModelCacheService();
    }
    return ModelCacheService.instance;
  }

  private constructor() {
    this.initializeDatabase();
  }

  /**
   * Initialise la base de données IndexedDB pour le cache
   */
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Erreur lors de l\'ouverture de la base de données de cache');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ Base de données de cache des modèles initialisée');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Store pour les modèles
        if (!db.objectStoreNames.contains('models')) {
          const modelsStore = db.createObjectStore('models', { keyPath: 'id' });
          modelsStore.createIndex('family', 'info.family', { unique: false });
          modelsStore.createIndex('variant', 'info.variant', { unique: false });
          modelsStore.createIndex('downloadDate', 'info.downloadDate', { unique: false });
        }

        // Store pour les métadonnées
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Génère une clé unique pour un modèle
   */
  private getModelKey(family: string, variant: string): string {
    return `${family}-${variant}`;
  }

  /**
   * Vérifie si un modèle est en cache
   */
  async isModelCached(family: string, variant: string): Promise<boolean> {
    if (!this.db) await this.initializeDatabase();
    if (!this.db) return false;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['models'], 'readonly');
      const store = transaction.objectStore('models');
      const request = store.get(this.getModelKey(family, variant));

      request.onsuccess = () => {
        resolve(!!request.result);
      };

      request.onerror = () => {
        console.error('Erreur lors de la vérification du cache');
        resolve(false);
      };
    });
  }

  /**
   * Récupère un modèle depuis le cache
   */
  async getCachedModel(family: string, variant: string): Promise<ModelCacheEntry | null> {
    if (!this.db) await this.initializeDatabase();
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['models'], 'readonly');
      const store = transaction.objectStore('models');
      const request = store.get(this.getModelKey(family, variant));

      request.onsuccess = () => {
        if (request.result) {
          console.log(`✅ Modèle ${family}-${variant} trouvé dans le cache`);
          resolve(request.result as ModelCacheEntry);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('Erreur lors de la récupération du modèle depuis le cache');
        resolve(null);
      };
    });
  }

  /**
   * Met en cache un modèle téléchargé
   */
  async cacheModel(
    family: string,
    variant: string,
    modelBlob: Blob,
    tokenizerBlob?: Blob,
    version: string = '1.0.0'
  ): Promise<boolean> {
    if (!this.db) await this.initializeDatabase();
    if (!this.db) return false;

    const info: CachedModelInfo = {
      family,
      variant,
      downloadDate: Date.now(),
      fileSize: modelBlob.size + (tokenizerBlob?.size || 0),
      version,
    };

    const cacheEntry: ModelCacheEntry & { id: string } = {
      id: this.getModelKey(family, variant),
      info,
      modelBlob,
      tokenizerBlob,
    };

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['models'], 'readwrite');
      const store = transaction.objectStore('models');
      const request = store.put(cacheEntry);

      request.onsuccess = () => {
        console.log(`✅ Modèle ${family}-${variant} mis en cache (${Math.round(info.fileSize / 1024 / 1024)}MB)`);
        resolve(true);
      };

      request.onerror = () => {
        console.error('Erreur lors de la mise en cache du modèle');
        resolve(false);
      };
    });
  }

  /**
   * Supprime un modèle du cache
   */
  async removeModel(family: string, variant: string): Promise<boolean> {
    if (!this.db) await this.initializeDatabase();
    if (!this.db) return false;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['models'], 'readwrite');
      const store = transaction.objectStore('models');
      const request = store.delete(this.getModelKey(family, variant));

      request.onsuccess = () => {
        console.log(`🗑️ Modèle ${family}-${variant} supprimé du cache`);
        resolve(true);
      };

      request.onerror = () => {
        console.error('Erreur lors de la suppression du modèle');
        resolve(false);
      };
    });
  }

  /**
   * Obtient la liste de tous les modèles en cache
   */
  async getCachedModels(): Promise<CachedModelInfo[]> {
    if (!this.db) await this.initializeDatabase();
    if (!this.db) return [];

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['models'], 'readonly');
      const store = transaction.objectStore('models');
      const request = store.getAll();

      request.onsuccess = () => {
        const models = request.result.map((entry: ModelCacheEntry & { id: string }) => entry.info);
        resolve(models);
      };

      request.onerror = () => {
        console.error('Erreur lors de la récupération de la liste des modèles');
        resolve([]);
      };
    });
  }

  /**
   * Calcule l'espace total utilisé par le cache
   */
  async getCacheSize(): Promise<number> {
    const models = await this.getCachedModels();
    return models.reduce((total, model) => total + model.fileSize, 0);
  }

  /**
   * Nettoie le cache en supprimant les anciens modèles
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

  /**
   * Télécharge et met en cache un modèle
   */
  async downloadAndCacheModel(
    family: string,
    variant: string,
    modelUrl: string,
    tokenizerUrl?: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    try {
      console.log(`⬇️ Téléchargement du modèle ${family}-${variant}...`);

      // Télécharger le modèle principal
      const modelResponse = await this.downloadWithProgress(modelUrl, (progress) => {
        onProgress?.(progress * 0.8); // 80% pour le modèle principal
      });

      if (!modelResponse.ok) {
        throw new Error(`Erreur de téléchargement du modèle: ${modelResponse.status}`);
      }

      const modelBlob = await modelResponse.blob();

      // Télécharger le tokenizer si spécifié
      let tokenizerBlob: Blob | undefined;
      if (tokenizerUrl) {
        const tokenizerResponse = await this.downloadWithProgress(tokenizerUrl, (progress) => {
          onProgress?.(80 + progress * 0.2); // 20% pour le tokenizer
        });

        if (tokenizerResponse.ok) {
          tokenizerBlob = await tokenizerResponse.blob();
        }
      }

      // Mettre en cache
      const success = await this.cacheModel(family, variant, modelBlob, tokenizerBlob);
      
      if (success) {
        onProgress?.(100);
        console.log(`✅ Modèle ${family}-${variant} téléchargé et mis en cache`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Erreur lors du téléchargement du modèle ${family}-${variant}:`, error);
      return false;
    }
  }

  /**
   * Télécharge un fichier avec suivi du progrès
   */
  private async downloadWithProgress(
    url: string,
    onProgress?: (progress: number) => void
  ): Promise<Response> {
    const response = await fetch(url);
    
    if (!response.ok || !response.body) {
      return response;
    }

    const reader = response.body.getReader();
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    
    let receivedLength = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      receivedLength += value.length;
      
      if (contentLength > 0 && onProgress) {
        onProgress((receivedLength / contentLength) * 100);
      }
    }

    // Reconstituer la réponse
    const allChunks = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    return new Response(allChunks.buffer, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  /**
   * Exporte les statistiques du cache
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
}

export const modelCache = ModelCacheService.getInstance();
