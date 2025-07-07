/**
 * Utilitaire pour synchroniser les modèles téléchargés avec le système de traduction
 * Corrige le problème de détection des modèles dans les tests
 */

import { translationModels, type TranslationModelType } from '@/lib/translation-models';
import { ModelCacheService } from '@/lib/model-cache';

export interface LocalStorageModelState {
  [modelKey: string]: boolean;
}

export interface ModelSyncInfo {
  localStorageModels: string[];
  memoryModels: string[];
  cachedModels: string[];
  missingModels: string[];
}

/**
 * Obtient l'état des modèles depuis localStorage
 */
export function getLocalStorageModels(): LocalStorageModelState {
  try {
    const stored = localStorage.getItem('meeshy-loaded-models');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Erreur lecture localStorage des modèles:', error);
    return {};
  }
}

/**
 * Met à jour l'état d'un modèle dans localStorage
 */
export function setLocalStorageModel(modelKey: string, isLoaded: boolean): void {
  try {
    const current = getLocalStorageModels();
    current[modelKey] = isLoaded;
    localStorage.setItem('meeshy-loaded-models', JSON.stringify(current));
  } catch (error) {
    console.error('Erreur écriture localStorage des modèles:', error);
  }
}

/**
 * Obtient les modèles marqués comme téléchargés dans localStorage
 */
export function getDownloadedModelsFromStorage(): string[] {
  const storedModels = getLocalStorageModels();
  return Object.entries(storedModels)
    .filter(([, isLoaded]) => isLoaded)
    .map(([modelKey]) => modelKey);
}

/**
 * Obtient une vue d'ensemble de l'état des modèles
 */
export async function getModelSyncInfo(): Promise<ModelSyncInfo> {
  const localStorageModels = getDownloadedModelsFromStorage();
  const memoryModels = translationModels.getLoadedModels();
  
  // Récupérer les modèles en cache IndexedDB
  let cachedModels: string[] = [];
  try {
    const modelCache = ModelCacheService.getInstance();
    const cached = await modelCache.getCachedModels();
    cachedModels = cached.map(model => `${model.family}-${model.variant}`);
  } catch (error) {
    console.warn('Impossible de récupérer les modèles du cache:', error);
  }

  // Identifier les modèles manquants (marqués téléchargés mais pas en mémoire)
  const missingModels = localStorageModels.filter(model => !memoryModels.includes(model));

  return {
    localStorageModels,
    memoryModels,
    cachedModels,
    missingModels
  };
}

/**
 * Tente de charger un modèle manquant en mémoire
 */
export async function loadMissingModel(modelKey: string): Promise<boolean> {
  try {
    console.log(`🔄 Tentative de chargement du modèle manquant: ${modelKey}`);
    
    // Conversion du format localStorage vers le format TranslationModelsManager
    const modelName = convertLocalStorageKeyToModelName(modelKey);
    
    if (!modelName) {
      console.warn(`Impossible de convertir la clé ${modelKey} en nom de modèle`);
      return false;
    }

    // Tenter de charger le modèle
    const model = await translationModels.loadModel(modelName as TranslationModelType);
    
    if (model) {
      console.log(`✅ Modèle ${modelKey} chargé avec succès en mémoire`);
      return true;
    } else {
      console.warn(`❌ Impossible de charger le modèle ${modelKey}`);
      // Mettre à jour localStorage pour refléter l'état réel
      setLocalStorageModel(modelKey, false);
      return false;
    }
  } catch (error) {
    console.error(`Erreur lors du chargement du modèle ${modelKey}:`, error);
    setLocalStorageModel(modelKey, false);
    return false;
  }
}

/**
 * Synchronise tous les modèles marqués téléchargés avec la mémoire
 */
export async function syncAllModels(): Promise<{ loaded: string[], failed: string[] }> {
  const info = await getModelSyncInfo();
  const loaded: string[] = [];
  const failed: string[] = [];

  console.log(`🔄 Synchronisation de ${info.missingModels.length} modèles manquants...`);

  for (const modelKey of info.missingModels) {
    const success = await loadMissingModel(modelKey);
    if (success) {
      loaded.push(modelKey);
    } else {
      failed.push(modelKey);
    }
  }

  console.log(`✅ Synchronisation terminée: ${loaded.length} chargés, ${failed.length} échués`);
  return { loaded, failed };
}

/**
 * Convertit une clé localStorage en nom de modèle pour TranslationModelsManager
 */
function convertLocalStorageKeyToModelName(localStorageKey: string): string | null {
  const mapping: Record<string, string> = {
    'mt5-small': 'MT5_SMALL',
    'mt5-base': 'MT5_BASE', 
    'mt5-large': 'MT5_LARGE',
    'mt5-xl': 'MT5_XL',
    'mt5-xxl': 'MT5_XXL',
    'nllb-distilled-600M': 'NLLB_DISTILLED_600M',
    'nllb-1.3B': 'NLLB_1_3B',
    'nllb-3.3B': 'NLLB_3_3B'
  };

  return mapping[localStorageKey] || null;
}

/**
 * Convertit un nom de modèle TranslationModelsManager en clé localStorage
 */
export function convertModelNameToLocalStorageKey(modelName: string): string | null {
  const reverseMapping: Record<string, string> = {
    'MT5_SMALL': 'mt5-small',
    'MT5_BASE': 'mt5-base',
    'MT5_LARGE': 'mt5-large', 
    'MT5_XL': 'mt5-xl',
    'MT5_XXL': 'mt5-xxl',
    'NLLB_DISTILLED_600M': 'nllb-distilled-600M',
    'NLLB_1_3B': 'nllb-1.3B',
    'NLLB_3_3B': 'nllb-3.3B'
  };

  return reverseMapping[modelName] || null;
}

/**
 * Hook personnalisé pour synchroniser automatiquement les modèles
 */
export function useModelSync() {
  const syncModels = async () => {
    return await syncAllModels();
  };

  const getInfo = async () => {
    return await getModelSyncInfo();
  };

  const loadModel = async (modelKey: string) => {
    return await loadMissingModel(modelKey);
  };

  return {
    syncModels,
    getInfo,
    loadModel,
    getDownloadedModels: getDownloadedModelsFromStorage
  };
}

/**
 * Diagnostic complet de l'état des modèles
 */
export async function diagnoseModelState(): Promise<void> {
  console.log('🔍 === DIAGNOSTIC DE L\'ÉTAT DES MODÈLES ===');
  
  const info = await getModelSyncInfo();
  
  console.log('📱 Modèles dans localStorage:', info.localStorageModels);
  console.log('🧠 Modèles en mémoire:', info.memoryModels);
  console.log('💾 Modèles en cache IndexedDB:', info.cachedModels);
  console.log('❌ Modèles manquants:', info.missingModels);
  
  if (info.missingModels.length > 0) {
    console.log('⚠️ Des modèles sont marqués téléchargés mais pas chargés en mémoire');
    console.log('💡 Utilisez syncAllModels() pour corriger cela');
  } else if (info.localStorageModels.length === 0) {
    console.log('📭 Aucun modèle téléchargé selon localStorage');
    console.log('💡 Téléchargez des modèles depuis l\'onglet Modèles des paramètres');
  } else {
    console.log('✅ Tous les modèles téléchargés sont correctement chargés');
  }
  
  console.log('🔍 === FIN DU DIAGNOSTIC ===');
}
