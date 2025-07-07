/**
 * Configuration simplifiée des modèles de traduction - 2 modèles essentiels
 * MT5 Base et NLLB Distilled 600M pour couvrir tous les besoins
 */

// Types simplifiés
export type TranslationModelType = 'MT5_BASE' | 'NLLB_DISTILLED_600M';
export type ModelFamily = 'MT5' | 'NLLB';

// Coûts et métriques énergétiques
export interface ModelCost {
  energyConsumption: number; // en Wh (Watt-heure)
  computationalCost: number; // score relatif de 1-10
  co2Equivalent: number; // en grammes de CO2
  monetaryEquivalent: number; // en centimes d'euro
  memoryUsage: number; // en MB
  inferenceTime: number; // en millisecondes
}

// Configuration unifiée d'un modèle
export interface UnifiedModelConfig {
  // Identifiants et affichage
  name: TranslationModelType;
  displayName: string;
  family: ModelFamily;
  
  // Caractéristiques techniques
  size: string;
  parameters: string;
  memoryRequirement: number; // en MB
  downloadSize: number; // en MB
  
  // Performance et qualité
  qualityScore: number; // 1-10
  speedScore: number; // 1-10
  
  // Coûts et impact
  cost: ModelCost;
  color: string; // Couleur pour l'UI
  
  // URLs et ressources - IDs Hugging Face officiels
  huggingFaceId: string;
  
  // Métadonnées
  maxTokens: number;
  purpose: 'simple' | 'complex';
  description: string;
  
  // États runtime
  isLoaded?: boolean;
  model?: unknown;
}

// Configuration des 2 modèles essentiels
export const UNIFIED_TRANSLATION_MODELS: Record<TranslationModelType, UnifiedModelConfig> = {
  // MT5 Base - Équilibre optimal pour tous types de messages
  MT5_BASE: {
    name: 'MT5_BASE',
    displayName: 'MT5 Base',
    family: 'MT5',
    size: 'Base',
    parameters: '580M',
    memoryRequirement: 3072, // 3GB
    downloadSize: 1200, // 1.2GB
    qualityScore: 8,
    speedScore: 7,
    cost: {
      energyConsumption: 0.05,
      computationalCost: 4,
      co2Equivalent: 0.03,
      monetaryEquivalent: 0.02,
      memoryUsage: 2500,
      inferenceTime: 300
    },
    color: '#3b82f6', // Bleu - équilibré
    huggingFaceId: 'Xenova/mt5-base',
    maxTokens: 200,
    purpose: 'simple',
    description: 'Modèle équilibré MT5, excellent pour messages courts et moyens'
  },

  // NLLB Distilled 600M - Spécialisé multilingue
  NLLB_DISTILLED_600M: {
    name: 'NLLB_DISTILLED_600M',
    displayName: 'NLLB Distilled 600M',
    family: 'NLLB',
    size: 'Distilled',
    parameters: '600M',
    memoryRequirement: 4096, // 4GB
    downloadSize: 1500, // 1.5GB
    qualityScore: 9,
    speedScore: 6,
    cost: {
      energyConsumption: 0.08,
      computationalCost: 6,
      co2Equivalent: 0.05,
      monetaryEquivalent: 0.03,
      memoryUsage: 3200,
      inferenceTime: 500
    },
    color: '#8b5cf6', // Violet - haute qualité
    huggingFaceId: 'Xenova/nllb-200-distilled-600M',
    maxTokens: 400,
    purpose: 'complex',
    description: 'Modèle NLLB optimisé, excellent pour messages longs et traductions complexes'
  }
};

// Fonctions utilitaires simplifiées
export function getAvailableModels(): TranslationModelType[] {
  return ['MT5_BASE', 'NLLB_DISTILLED_600M'];
}

export function getModelConfig(modelType: TranslationModelType): UnifiedModelConfig {
  return UNIFIED_TRANSLATION_MODELS[modelType];
}

export function getModelsByFamily(family: ModelFamily): TranslationModelType[] {
  return Object.values(UNIFIED_TRANSLATION_MODELS)
    .filter(config => config.family === family)
    .map(config => config.name);
}

// Choix automatique du modèle selon le type de message
export function selectBestModel(messageLength: number, complexity: 'simple' | 'complex' = 'simple'): TranslationModelType {
  // Messages courts (< 50 caractères) -> MT5 Base (plus rapide)
  if (messageLength <= 50 && complexity === 'simple') {
    return 'MT5_BASE';
  }
  
  // Messages longs ou complexes -> NLLB Distilled 600M (plus précis)
  return 'NLLB_DISTILLED_600M';
}

// Estimation des capacités système simplifiée
export function estimateSystemCapabilities(): {
  recommendedModel: TranslationModelType;
  fallbackModel: TranslationModelType;
  reasoning: string;
} {
  // Détecter la RAM approximative (heuristique basée sur navigator)
  const memoryHint = (navigator as { deviceMemory?: number }).deviceMemory;
  const hasHighMemory = memoryHint === undefined || memoryHint >= 8; // Par défaut, supposer que c'est suffisant
  
  if (hasHighMemory) {
    return {
      recommendedModel: 'NLLB_DISTILLED_600M',
      fallbackModel: 'MT5_BASE',
      reasoning: 'Système performant détecté - recommandation du modèle NLLB pour la meilleure qualité'
    };
  } else {
    return {
      recommendedModel: 'MT5_BASE',
      fallbackModel: 'MT5_BASE',
      reasoning: 'Système avec ressources limitées - recommandation du modèle MT5 pour l\'efficacité'
    };
  }
}

// Export des constantes pour compatibilité avec l'existant
export const TRANSLATION_MODELS = UNIFIED_TRANSLATION_MODELS;
