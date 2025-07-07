/**
 * Utilitaire de debugging pour les modèles Meeshy
 * À utiliser dans la console du navigateur pour diagnostiquer les problèmes
 */

declare global {
  interface Window {
    meeshyDebug: typeof meeshyDebug;
    translationModels: {
      getLoadedModels(): string[];
      isModelLoaded(modelName: string): boolean;
      unloadAllModels(): void;
    };
  }
}

export const meeshyDebug = {
  /**
   * Diagnostic complet de l'état des modèles
   */
  async diagnoseModels() {
    console.log('🔍 === DIAGNOSTIC COMPLET DES MODÈLES MEESHY ===');
    
    // 1. Vérifier localStorage
    console.group('📱 localStorage');
    try {
      const stored = localStorage.getItem('meeshy-loaded-models');
      const parsedModels = stored ? JSON.parse(stored) : {};
      console.log('Données brutes:', stored);
      console.log('Modèles parsés:', parsedModels);
      
      const downloadedModels = Object.entries(parsedModels)
        .filter(([, isLoaded]) => isLoaded)
        .map(([modelKey]) => modelKey);
      
      console.log(`✅ ${downloadedModels.length} modèles marqués téléchargés:`, downloadedModels);
    } catch (error) {
      console.error('❌ Erreur localStorage:', error);
    }
    console.groupEnd();
    
    // 2. Vérifier IndexedDB
    console.group('💾 IndexedDB Cache');
    try {
      const cachedModels = await this.getIndexedDBModels();
      console.log(`✅ ${cachedModels.length} modèles en cache IndexedDB:`, cachedModels);
      
      const totalSize = cachedModels.reduce((sum, model) => sum + (model.info?.fileSize || 0), 0);
      console.log(`💽 Taille totale: ${Math.round(totalSize / 1024 / 1024)}MB`);
      
      cachedModels.forEach(model => {
        console.log(`- ${model.id}: ${Math.round(model.info.fileSize / 1024 / 1024)}MB (${new Date(model.info.downloadDate).toLocaleString()})`);
      });
    } catch (error) {
      console.error('❌ Erreur IndexedDB:', error);
    }
    console.groupEnd();
    
    // 3. Vérifier TensorFlow.js
    console.group('🧠 TensorFlow.js en mémoire');
    try {
      if (window.translationModels) {
        const loadedModels = window.translationModels.getLoadedModels();
        console.log(`✅ ${loadedModels.length} modèles en mémoire:`, loadedModels);
        
        loadedModels.forEach((modelName: string) => {
          const isLoaded = window.translationModels.isModelLoaded(modelName);
          console.log(`- ${modelName}: ${isLoaded ? '✅ chargé' : '❌ non chargé'}`);
        });
      } else {
        console.warn('⚠️ translationModels non disponible sur window');
        console.log('💡 Essayez: import { translationModels } from "@/lib/translation-models"');
      }
    } catch (error) {
      console.error('❌ Erreur TensorFlow.js:', error);
    }
    console.groupEnd();
    
    // 4. Analyse et recommandations
    console.group('💡 Analyse et recommandations');
    const localStorageCount = this.getLocalStorageModelsCount();
    const indexedDBCount = await this.getIndexedDBModelsCount();
    const memoryCount = this.getMemoryModelsCount();
    
    console.log(`📊 Résumé: localStorage(${localStorageCount}) | IndexedDB(${indexedDBCount}) | Mémoire(${memoryCount})`);
    
    if (localStorageCount > 0 && memoryCount === 0) {
      console.warn('⚠️ PROBLÈME: Des modèles sont marqués téléchargés mais pas chargés en mémoire');
      console.log('🔧 Solution: Utilisez le bouton "Synchroniser" dans les tests avancés');
      console.log('🔧 Ou tapez: meeshyDebug.syncModels()');
    } else if (localStorageCount === 0) {
      console.info('📭 Aucun modèle téléchargé selon localStorage');
      console.log('💡 Allez dans Paramètres > Modèles pour télécharger des modèles');
    } else if (localStorageCount === memoryCount) {
      console.log('✅ Tous les modèles sont correctement synchronisés');
    } else {
      console.warn('⚠️ Incohérence détectée entre localStorage et mémoire');
    }
    console.groupEnd();
    
    console.log('🔍 === FIN DU DIAGNOSTIC ===');
  },

  /**
   * Obtient les modèles depuis IndexedDB
   */
  async getIndexedDBModels(): Promise<{id: string; info: {fileSize: number; downloadDate: number}}[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('meeshy-models-cache');
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['models'], 'readonly');
        const store = transaction.objectStore('models');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => resolve(getAllRequest.result);
        getAllRequest.onerror = () => reject(getAllRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Compte les modèles dans localStorage
   */
  getLocalStorageModelsCount(): number {
    try {
      const stored = localStorage.getItem('meeshy-loaded-models');
      const models = stored ? JSON.parse(stored) : {};
      return Object.values(models).filter(Boolean).length;
    } catch {
      return 0;
    }
  },

  /**
   * Compte les modèles dans IndexedDB
   */
  async getIndexedDBModelsCount(): Promise<number> {
    try {
      const models = await this.getIndexedDBModels();
      return models.length;
    } catch {
      return 0;
    }
  },

  /**
   * Compte les modèles en mémoire TensorFlow.js
   */
  getMemoryModelsCount(): number {
    try {
      if (window.translationModels) {
        return window.translationModels.getLoadedModels().length;
      }
      return 0;
    } catch {
      return 0;
    }
  },

  /**
   * Synchronise les modèles manuellement
   */
  async syncModels() {
    console.log('🔄 Démarrage de la synchronisation manuelle...');
    
    try {
      // Cette fonction devra être importée dynamiquement
      const { syncAllModels } = await import('@/utils/model-sync');
      const result = await syncAllModels();
      
      console.log(`✅ Synchronisation terminée: ${result.loaded.length} chargés, ${result.failed.length} échués`);
      return result;
    } catch (error) {
      console.error('❌ Erreur de synchronisation:', error);
      console.log('💡 Utilisez le bouton "Synchroniser" dans l\'interface utilisateur');
    }
  },

  /**
   * Nettoie complètement le cache
   */
  async clearAllCache() {
    console.log('🗑️ Nettoyage complet du cache...');
    
    // Nettoyer localStorage
    localStorage.removeItem('meeshy-loaded-models');
    console.log('✅ localStorage nettoyé');
    
    // Nettoyer IndexedDB
    try {
      const request = indexedDB.deleteDatabase('meeshy-models-cache');
      request.onsuccess = () => console.log('✅ IndexedDB nettoyé');
      request.onerror = () => console.error('❌ Erreur nettoyage IndexedDB');
    } catch (error) {
      console.error('❌ Erreur nettoyage IndexedDB:', error);
    }
    
    // Décharger les modèles TensorFlow.js
    try {
      if (window.translationModels) {
        window.translationModels.unloadAllModels();
        console.log('✅ Modèles TensorFlow.js déchargés');
      }
    } catch (error) {
      console.error('❌ Erreur déchargement TensorFlow.js:', error);
    }
    
    console.log('🔄 Rechargez la page pour un état propre');
  },

  /**
   * Affiche les commandes utiles
   */
  help() {
    console.log('🛠️ === COMMANDES MEESHY DEBUG ===');
    console.log('meeshyDebug.diagnoseModels()     - Diagnostic complet');
    console.log('meeshyDebug.syncModels()         - Synchroniser les modèles');
    console.log('meeshyDebug.clearAllCache()      - Nettoyer tout le cache');
    console.log('meeshyDebug.getLocalStorageModelsCount() - Nombre localStorage');
    console.log('meeshyDebug.getMemoryModelsCount()       - Nombre en mémoire');
    console.log('meeshyDebug.help()               - Afficher cette aide');
  }
};

// Exposer sur window pour utilisation dans la console
if (typeof window !== 'undefined') {
  window.meeshyDebug = meeshyDebug;
  
  // Afficher un message d'accueil
  console.log('🛠️ Meeshy Debug Tools chargés!');
  console.log('💡 Tapez "meeshyDebug.help()" pour voir les commandes disponibles');
  console.log('🔍 Tapez "meeshyDebug.diagnoseModels()" pour un diagnostic complet');
}
