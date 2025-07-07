/**
 * Configuration simplifiée des modèles de traduction
 * Utilise uniquement 2 modèles configurables via les variables d'environnement
 */

// Types de modèles autorisés
export type AllowedModelType = 
  | 'MT5_SMALL' 
  | 'MT5_BASE' 
  | 'MT5_LARGE' 
  | 'MT5_XL' 
  | 'MT5_XXL'
  | 'NLLB_DISTILLED_600M' 
  | 'NLLB_DISTILLED_1_3B'
  | 'NLLB_1_3B' 
  | 'NLLB_3_3B';

// Configuration des modèles actifs
export interface ActiveModelConfig {
  basicModel: AllowedModelType;
  highModel: AllowedModelType;
}

// Import de la configuration complète des modèles
import { UNIFIED_TRANSLATION_MODELS, type UnifiedModelConfig } from './unified-model-config';

/**
 * Récupère la configuration des modèles depuis les variables d'environnement
 */
function getActiveModelsFromEnv(): ActiveModelConfig {
  const basicModel = (process.env.NEXT_PUBLIC_BASIC_MODEL as AllowedModelType) || 'MT5_SMALL';
  const highModel = (process.env.NEXT_PUBLIC_HIGH_MODEL as AllowedModelType) || 'NLLB_DISTILLED_600M';
  
  // Validation des modèles
  if (!UNIFIED_TRANSLATION_MODELS[basicModel]) {
    console.warn(`Modèle basique invalide: ${basicModel}, utilisation de MT5_SMALL par défaut`);
    return { basicModel: 'MT5_SMALL', highModel };
  }
  
  if (!UNIFIED_TRANSLATION_MODELS[highModel]) {
    console.warn(`Modèle haute performance invalide: ${highModel}, utilisation de NLLB_DISTILLED_600M par défaut`);
    return { basicModel, highModel: 'NLLB_DISTILLED_600M' };
  }
  
  return { basicModel, highModel };
}

// Configuration active des modèles
export const ACTIVE_MODELS = getActiveModelsFromEnv();

/**
 * Obtient la configuration complète d'un modèle actif
 */
export function getActiveModelConfig(type: 'basic' | 'high'): UnifiedModelConfig {
  const modelType = type === 'basic' ? ACTIVE_MODELS.basicModel : ACTIVE_MODELS.highModel;
  return UNIFIED_TRANSLATION_MODELS[modelType];
}

/**
 * Obtient tous les modèles actifs avec leur configuration
 */
export function getAllActiveModels(): Array<{ type: 'basic' | 'high'; config: UnifiedModelConfig }> {
  return [
    { type: 'basic', config: getActiveModelConfig('basic') },
    { type: 'high', config: getActiveModelConfig('high') }
  ];
}

/**
 * Détermine quel modèle utiliser selon les critères du message
 */
export function selectModelForMessage(messageLength: number, complexity: 'simple' | 'complex'): {
  type: 'basic' | 'high';
  config: UnifiedModelConfig;
} {
  // Logique de sélection :
  // - Messages courts (≤50 caractères) et simples -> modèle basique
  // - Messages longs ou complexes -> modèle haute performance
  if (messageLength <= 50 && complexity === 'simple') {
    return { type: 'basic', config: getActiveModelConfig('basic') };
  } else {
    return { type: 'high', config: getActiveModelConfig('high') };
  }
}

/**
 * Vérifie si un modèle est actuellement actif
 */
export function isModelActive(modelType: AllowedModelType): boolean {
  return modelType === ACTIVE_MODELS.basicModel || modelType === ACTIVE_MODELS.highModel;
}

/**
 * Export pour compatibilité avec l'existant
 */
export const TRANSLATION_MODELS_SIMPLIFIED = {
  [ACTIVE_MODELS.basicModel]: UNIFIED_TRANSLATION_MODELS[ACTIVE_MODELS.basicModel],
  [ACTIVE_MODELS.highModel]: UNIFIED_TRANSLATION_MODELS[ACTIVE_MODELS.highModel]
};

// Types pour l'usage externe
export type ActiveModelType = 'basic' | 'high';
export type SimpleModelConfig = ReturnType<typeof getActiveModelConfig>;
