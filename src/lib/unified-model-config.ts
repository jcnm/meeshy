/**
 * Configuration unifiée des modèles de traduction - Source unique de vérité
 * Fusion de TRANSLATION_MODELS et MODEL_FAMILIES en une seule structure complète et typée
 */

// Types de base - compatible avec l'existant
export type TranslationModelType = 
  | 'MT5_SMALL' 
  | 'MT5_BASE' 
  | 'MT5_LARGE' 
  | 'MT5_XL' 
  | 'MT5_XXL'
  | 'NLLB_200M' 
  | 'NLLB_DISTILLED_600M' 
  | 'NLLB_DISTILLED_1_3B'
  | 'NLLB_1_3B' 
  | 'NLLB_3_3B'
  | 'NLLB_54B';

export type ModelFamily = 'MT5' | 'NLLB';
export type ModelQuality = 'basic' | 'good' | 'high' | 'excellent' | 'premium';
export type ModelPerformance = 'fast' | 'balanced' | 'accurate' | 'premium';

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
  performance: ModelPerformance;
  quality: ModelQuality;
  qualityScore: number; // 1-10
  speedScore: number; // 1-10
  
  // Coûts et impact
  cost: ModelCost;
  color: string; // Couleur pour l'UI
  
  // URLs et ressources
  modelUrl: string;
  tokenizerUrl?: string;
  
  // Métadonnées de configuration
  maxTokens: number;
  purpose: 'simple' | 'complex';
  description: string;
  
  // États runtime (ajoutés dynamiquement)
  isLoaded?: boolean;
  model?: unknown;
}

// Configuration complète et unifiée de tous les modèles
export const UNIFIED_TRANSLATION_MODELS: Record<TranslationModelType, UnifiedModelConfig> = {
  // ===== FAMILLE MT5 - Google's Multilingual T5 =====
  MT5_SMALL: {
    name: 'MT5_SMALL',
    displayName: 'MT5 Small',
    family: 'MT5',
    size: 'Small',
    parameters: '300M',
    memoryRequirement: 2048, // 2GB
    downloadSize: 580, // 580MB
    performance: 'fast',
    quality: 'basic',
    qualityScore: 6,
    speedScore: 9,
    cost: {
      energyConsumption: 0.02, // 0.02 Wh par traduction
      computationalCost: 1,
      co2Equivalent: 0.01, // 10 milligrammes
      monetaryEquivalent: 0.005, // 0.005 centime
      memoryUsage: 1200, // 1.2 GB
      inferenceTime: 150 // 150ms
    },
    color: '#22c55e', // Vert - très efficace
    modelUrl: 'https://huggingface.co/google/mt5-small/resolve/main/tf_model.h5',
    tokenizerUrl: 'https://huggingface.co/google/mt5-small/resolve/main/tokenizer.json',
    maxTokens: 100,
    purpose: 'simple',
    description: 'Modèle léger et rapide, idéal pour machines avec ressources limitées'
  },

  MT5_BASE: {
    name: 'MT5_BASE',
    displayName: 'MT5 Base',
    family: 'MT5',
    size: 'Base',
    parameters: '580M',
    memoryRequirement: 4096, // 4GB
    downloadSize: 1200, // 1.2GB
    performance: 'balanced',
    quality: 'high',
    qualityScore: 7,
    speedScore: 7,
    cost: {
      energyConsumption: 0.05, // 0.05 Wh par traduction
      computationalCost: 2,
      co2Equivalent: 0.025, // 25 milligrammes
      monetaryEquivalent: 0.01, // 0.01 centime
      memoryUsage: 2300, // 2.3 GB
      inferenceTime: 250 // 250ms
    },
    color: '#84cc16', // Vert clair - efficace
    modelUrl: 'https://huggingface.co/google/mt5-base/resolve/main/tf_model.h5',
    tokenizerUrl: 'https://huggingface.co/google/mt5-base/resolve/main/tokenizer.json',
    maxTokens: 100,
    purpose: 'simple',
    description: 'Modèle équilibré entre performance et qualité'
  },

  MT5_LARGE: {
    name: 'MT5_LARGE',
    displayName: 'MT5 Large',
    family: 'MT5',
    size: 'Large',
    parameters: '1.2B',
    memoryRequirement: 8192, // 8GB
    downloadSize: 2400, // 2.4GB
    performance: 'accurate',
    quality: 'excellent',
    qualityScore: 8,
    speedScore: 5,
    cost: {
      energyConsumption: 0.1, // 0.1 Wh par traduction
      computationalCost: 4,
      co2Equivalent: 0.05, // 50 milligrammes
      monetaryEquivalent: 0.02, // 0.02 centime
      memoryUsage: 4800, // 4.8 GB
      inferenceTime: 400 // 400ms
    },
    color: '#eab308', // Jaune - moyen
    modelUrl: 'https://huggingface.co/google/mt5-large/resolve/main/tf_model.h5',
    tokenizerUrl: 'https://huggingface.co/google/mt5-large/resolve/main/tokenizer.json',
    maxTokens: 100,
    purpose: 'simple',
    description: 'Modèle précis pour traductions de haute qualité'
  },

  MT5_XL: {
    name: 'MT5_XL',
    displayName: 'MT5 XL',
    family: 'MT5',
    size: 'XL',
    parameters: '3.7B',
    memoryRequirement: 12288, // 12GB
    downloadSize: 4800, // 4.8GB
    performance: 'accurate',
    quality: 'excellent',
    qualityScore: 9,
    speedScore: 3,
    cost: {
      energyConsumption: 0.25, // 0.25 Wh par traduction
      computationalCost: 6,
      co2Equivalent: 0.125, // 125 milligrammes
      monetaryEquivalent: 0.05, // 0.05 centime
      memoryUsage: 14800, // 14.8 GB
      inferenceTime: 800 // 800ms
    },
    color: '#f97316', // Orange - coûteux
    modelUrl: 'https://huggingface.co/google/mt5-xl/resolve/main/tf_model.h5',
    tokenizerUrl: 'https://huggingface.co/google/mt5-xl/resolve/main/tokenizer.json',
    maxTokens: 100,
    purpose: 'simple',
    description: 'Modèle très précis pour traductions professionnelles'
  },

  MT5_XXL: {
    name: 'MT5_XXL',
    displayName: 'MT5 XXL',
    family: 'MT5',
    size: 'XXL',
    parameters: '13B',
    memoryRequirement: 24576, // 24GB
    downloadSize: 11000, // 11GB
    performance: 'premium',
    quality: 'premium',
    qualityScore: 10,
    speedScore: 2,
    cost: {
      energyConsumption: 0.6, // 0.6 Wh par traduction
      computationalCost: 8,
      co2Equivalent: 0.3, // 300 milligrammes
      monetaryEquivalent: 0.12, // 0.12 centime
      memoryUsage: 52000, // 52 GB
      inferenceTime: 1500 // 1.5s
    },
    color: '#dc2626', // Rouge - très coûteux
    modelUrl: 'https://huggingface.co/google/mt5-xxl/resolve/main/tf_model.h5',
    tokenizerUrl: 'https://huggingface.co/google/mt5-xxl/resolve/main/tokenizer.json',
    maxTokens: 100,
    purpose: 'simple',
    description: 'Modèle de précision maximale pour usage professionnel intensif'
  },

  // ===== FAMILLE NLLB - Meta's No Language Left Behind =====
  NLLB_200M: {
    name: 'NLLB_200M',
    displayName: 'NLLB 200M',
    family: 'NLLB',
    size: '200M',
    parameters: '200M',
    memoryRequirement: 1536, // 1.5GB
    downloadSize: 200, // 200MB
    performance: 'fast',
    quality: 'basic',
    qualityScore: 5,
    speedScore: 10,
    cost: {
      energyConsumption: 0.03, // 0.03 Wh par traduction
      computationalCost: 2,
      co2Equivalent: 0.015, // 15 milligrammes
      monetaryEquivalent: 0.008, // 0.008 centime
      memoryUsage: 800, // 800 MB
      inferenceTime: 200 // 200ms
    },
    color: '#16a34a', // Vert foncé - ultra efficace
    modelUrl: 'https://huggingface.co/facebook/nllb-200-200M/resolve/main/model.json',
    tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-200M/resolve/main/tokenizer.json',
    maxTokens: 1000,
    purpose: 'complex',
    description: 'Modèle ultra-léger pour appareils mobiles et faibles ressources'
  },

  NLLB_DISTILLED_600M: {
    name: 'NLLB_DISTILLED_600M',
    displayName: 'NLLB Distilled 600M',
    family: 'NLLB',
    size: 'distilled-600M',
    parameters: '600M',
    memoryRequirement: 3072, // 3GB
    downloadSize: 600, // 600MB
    performance: 'fast',
    quality: 'high',
    qualityScore: 7,
    speedScore: 8,
    cost: {
      energyConsumption: 0.022, // 0.022 Wh par traduction
      computationalCost: 2,
      co2Equivalent: 0.011, // 11 milligrammes
      monetaryEquivalent: 0.008, // 0.008 centime
      memoryUsage: 800, // 800 MB
      inferenceTime: 200 // 200ms
    },
    color: '#22c55e', // Vert - très efficace
    modelUrl: 'https://huggingface.co/facebook/nllb-200-distilled-600M/resolve/main/model.json',
    tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-distilled-600M/resolve/main/tokenizer.json',
    maxTokens: 1000,
    purpose: 'complex',
    description: 'Version distillée et optimisée, excellent rapport qualité/performance'
  },

  NLLB_DISTILLED_1_3B: {
    name: 'NLLB_DISTILLED_1_3B',
    displayName: 'NLLB Distilled 1.3B',
    family: 'NLLB',
    size: 'distilled-1.3B',
    parameters: '1.3B',
    memoryRequirement: 4608, // 4.5GB
    downloadSize: 1300, // 1.3GB
    performance: 'balanced',
    quality: 'excellent',
    qualityScore: 8,
    speedScore: 6,
    cost: {
      energyConsumption: 0.045, // 0.045 Wh par traduction
      computationalCost: 3,
      co2Equivalent: 0.023, // 23 milligrammes
      monetaryEquivalent: 0.015, // 0.015 centime
      memoryUsage: 1300, // 1.3 GB
      inferenceTime: 300 // 300ms
    },
    color: '#84cc16', // Vert clair - efficace
    modelUrl: 'https://huggingface.co/facebook/nllb-200-distilled-1.3B/resolve/main/model.json',
    tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-distilled-1.3B/resolve/main/tokenizer.json',
    maxTokens: 1000,
    purpose: 'complex',
    description: 'Version distillée avec qualité élevée et performance optimisée'
  },

  NLLB_1_3B: {
    name: 'NLLB_1_3B',
    displayName: 'NLLB 1.3B',
    family: 'NLLB',
    size: '1.3B',
    parameters: '1.3B',
    memoryRequirement: 6144, // 6GB
    downloadSize: 1300, // 1.3GB
    performance: 'balanced',
    quality: 'excellent',
    qualityScore: 8,
    speedScore: 5,
    cost: {
      energyConsumption: 0.15, // 0.15 Wh par traduction
      computationalCost: 5,
      co2Equivalent: 0.075, // 75 milligrammes
      monetaryEquivalent: 0.04, // 0.04 centime
      memoryUsage: 5200, // 5.2 GB
      inferenceTime: 600 // 600ms
    },
    color: '#a3a3a3', // Gris - neutre
    modelUrl: 'https://huggingface.co/facebook/nllb-200-1.3B/resolve/main/model.json',
    tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-1.3B/resolve/main/tokenizer.json',
    maxTokens: 1000,
    purpose: 'complex',
    description: 'Modèle standard avec bonne précision pour usage général'
  },

  NLLB_3_3B: {
    name: 'NLLB_3_3B',
    displayName: 'NLLB 3.3B',
    family: 'NLLB',
    size: '3.3B',
    parameters: '3.3B',
    memoryRequirement: 12288, // 12GB
    downloadSize: 3300, // 3.3GB
    performance: 'accurate',
    quality: 'premium',
    qualityScore: 9,
    speedScore: 3,
    cost: {
      energyConsumption: 0.35, // 0.35 Wh par traduction
      computationalCost: 7,
      co2Equivalent: 0.175, // 175 milligrammes
      monetaryEquivalent: 0.08, // 0.08 centime
      memoryUsage: 13200, // 13.2 GB
      inferenceTime: 1200 // 1.2s
    },
    color: '#f59e0b', // Orange - coûteux
    modelUrl: 'https://huggingface.co/facebook/nllb-200-3.3B/resolve/main/model.json',
    tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-3.3B/resolve/main/tokenizer.json',
    maxTokens: 1000,
    purpose: 'complex',
    description: 'Modèle haute précision pour traductions professionnelles complexes'
  },

  NLLB_54B: {
    name: 'NLLB_54B',
    displayName: 'NLLB 54B',
    family: 'NLLB',
    size: '54B',
    parameters: '54B',
    memoryRequirement: 65536, // 64GB
    downloadSize: 54000, // 54GB
    performance: 'premium',
    quality: 'premium',
    qualityScore: 10,
    speedScore: 1,
    cost: {
      energyConsumption: 1.2, // 1.2 Wh par traduction
      computationalCost: 10,
      co2Equivalent: 0.624, // 624 milligrammes
      monetaryEquivalent: 0.45, // 0.45 centime
      memoryUsage: 54000, // 54 GB
      inferenceTime: 5000 // 5s
    },
    color: '#991b1b', // Rouge foncé - extrêmement coûteux
    modelUrl: 'https://huggingface.co/facebook/nllb-200-54B/resolve/main/model.json',
    tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-54B/resolve/main/tokenizer.json',
    maxTokens: 1000,
    purpose: 'complex',
    description: 'Modèle de recherche ultra-précis, réservé aux serveurs haute performance'
  }
};

// ===== UTILITAIRES ET FONCTIONS D'AIDE =====

/**
 * Langues supportées par les différentes familles de modèles
 */
export const MODEL_SUPPORTED_LANGUAGES = {
  MT5: ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
  NLLB: [
    'en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
    'ar', 'hi', 'tr', 'pl', 'nl', 'sv', 'da', 'no', 'fi', 'cs',
    'sk', 'hu', 'ro', 'bg', 'hr', 'sl', 'et', 'lv', 'lt', 'mt',
    'cy', 'ga', 'gd', 'is', 'mk', 'sq', 'eu', 'ca', 'gl', 'ast',
  ]
} as const;

/**
 * Obtient la configuration d'un modèle par son type
 */
export function getModelConfig(modelType: TranslationModelType): UnifiedModelConfig {
  return UNIFIED_TRANSLATION_MODELS[modelType];
}

/**
 * Obtient tous les modèles d'une famille donnée
 */
export function getModelsByFamily(family: ModelFamily): UnifiedModelConfig[] {
  return Object.values(UNIFIED_TRANSLATION_MODELS).filter(model => model.family === family);
}

/**
 * Obtient les modèles triés par efficacité (rapport qualité/coût)
 */
export function getModelsByEfficiency(): UnifiedModelConfig[] {
  return Object.values(UNIFIED_TRANSLATION_MODELS).sort((a, b) => {
    const efficiencyA = (a.qualityScore + a.speedScore) / a.cost.computationalCost;
    const efficiencyB = (b.qualityScore + b.speedScore) / b.cost.computationalCost;
    return efficiencyB - efficiencyA;
  });
}

/**
 * Obtient les modèles compatibles avec une configuration système
 */
export function getCompatibleModels(maxMemoryMB: number, maxDownloadMB?: number): UnifiedModelConfig[] {
  return Object.values(UNIFIED_TRANSLATION_MODELS).filter(model => {
    const memoryOk = model.memoryRequirement <= maxMemoryMB;
    const downloadOk = !maxDownloadMB || model.downloadSize <= maxDownloadMB;
    return memoryOk && downloadOk;
  });
}

/**
 * Recommande le meilleur modèle pour un cas d'usage donné
 */
export function recommendModel(options: {
  purpose: 'simple' | 'complex';
  priority: 'speed' | 'quality' | 'efficiency';
  maxMemoryMB?: number;
  family?: ModelFamily;
}): UnifiedModelConfig {
  let candidates = Object.values(UNIFIED_TRANSLATION_MODELS).filter(model => {
    if (options.family && model.family !== options.family) return false;
    if (options.maxMemoryMB && model.memoryRequirement > options.maxMemoryMB) return false;
    return model.purpose === options.purpose;
  });

  if (candidates.length === 0) {
    // Fallback si aucun candidat
    candidates = Object.values(UNIFIED_TRANSLATION_MODELS);
  }

  switch (options.priority) {
    case 'speed':
      return candidates.sort((a, b) => b.speedScore - a.speedScore)[0];
    case 'quality':
      return candidates.sort((a, b) => b.qualityScore - a.qualityScore)[0];
    case 'efficiency':
    default:
      return candidates.sort((a, b) => {
        const effA = (a.qualityScore + a.speedScore) / a.cost.computationalCost;
        const effB = (b.qualityScore + b.speedScore) / b.cost.computationalCost;
        return effB - effA;
      })[0];
  }
}

/**
 * Calcule le coût total d'un ensemble de traductions
 */
export function calculateTotalCost(translations: Array<{
  modelType: TranslationModelType;
  count: number;
}>) {
  let totalEnergy = 0;
  let totalCO2 = 0;
  let totalCost = 0;
  let totalTime = 0;

  translations.forEach(({ modelType, count }) => {
    const model = getModelConfig(modelType);
    totalEnergy += model.cost.energyConsumption * count;
    totalCO2 += model.cost.co2Equivalent * count;
    totalCost += model.cost.monetaryEquivalent * count;
    totalTime += model.cost.inferenceTime * count;
  });

  return {
    energy: { wh: totalEnergy, joules: totalEnergy * 3600 },
    co2: { grams: totalCO2, kg: totalCO2 / 1000 },
    monetary: { cents: totalCost, euros: totalCost / 100 },
    time: { ms: totalTime, seconds: totalTime / 1000 },
    equivalents: {
      phoneCharges: Math.round(totalEnergy / 0.012), // 1 charge = ~0.012 Wh
      carKm: Math.round(totalCO2 / 120), // 120g CO2/km pour une voiture
      treeHours: Math.round(totalCO2 / 0.025), // 1 arbre absorbe ~25g CO2/jour
    }
  };
}

/**
 * Estime les performances selon les capacités système
 */
export function estimateSystemCapabilities(): {
  recommendedModels: { mt5: TranslationModelType; nllb: TranslationModelType };
  maxMemoryMB: number;
  reasoning: string;
} {
  // Détection basique des capacités (plus sophistiquée que MODEL_FAMILIES)
  const navigator = globalThis.navigator;
  let estimatedRAM = 8192; // Default 8GB

  if ('deviceMemory' in navigator) {
    estimatedRAM = (navigator as unknown as { deviceMemory: number }).deviceMemory * 1024; // GB vers MB
  } else {
    const cores = navigator.hardwareConcurrency || 4;
    if (cores >= 16) estimatedRAM = 32768;
    else if (cores >= 8) estimatedRAM = 16384;
    else if (cores >= 4) estimatedRAM = 8192;
    else estimatedRAM = 4096;
  }

  // Recommandations basées sur la RAM disponible
  let mt5Model: TranslationModelType = 'MT5_SMALL';
  let nllbModel: TranslationModelType = 'NLLB_200M';
  let reasoning = '';

  if (estimatedRAM >= 32768) {
    mt5Model = 'MT5_XL';
    nllbModel = 'NLLB_3_3B';
    reasoning = 'Machine puissante (32GB+) - modèles haute performance';
  } else if (estimatedRAM >= 16384) {
    mt5Model = 'MT5_LARGE';
    nllbModel = 'NLLB_DISTILLED_1_3B';
    reasoning = 'Machine équilibrée (16GB) - modèles optimaux';
  } else if (estimatedRAM >= 8192) {
    mt5Model = 'MT5_BASE';
    nllbModel = 'NLLB_DISTILLED_600M';
    reasoning = 'Machine standard (8GB) - modèles équilibrés';
  } else if (estimatedRAM >= 4096) {
    mt5Model = 'MT5_SMALL';
    nllbModel = 'NLLB_DISTILLED_600M';
    reasoning = 'Machine modeste (4GB) - modèles légers';
  } else {
    mt5Model = 'MT5_SMALL';
    nllbModel = 'NLLB_200M';
    reasoning = 'Machine limitée (<4GB) - modèles minimaux';
  }

  return {
    recommendedModels: { mt5: mt5Model, nllb: nllbModel },
    maxMemoryMB: estimatedRAM,
    reasoning
  };
}

// Export de compatibilité pour l'existant
export const TRANSLATION_MODELS = UNIFIED_TRANSLATION_MODELS;
