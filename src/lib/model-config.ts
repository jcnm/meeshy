/**
 * Configuration des modèles de traduction avec différentes tailles
 */

export interface ModelVariant {
  size: string;
  memoryRequirement: number; // en MB
  downloadSize: number; // en MB
  performance: 'fast' | 'balanced' | 'accurate' | 'premium';
  description: string;
  modelUrl: string;
  tokenizerUrl?: string;
  // Nouvelles propriétés pour les coûts et couleurs
  energyCostPerTranslation: number; // en mJ (millijoules)
  co2PerTranslation: number; // en mg de CO2
  monetaryCostPer1000Translations: number; // en USD approximatif
  qualityScore: number; // 1-10 (10 = meilleur)
  speedScore: number; // 1-10 (10 = plus rapide)
  borderColor: string; // Code couleur hexadécimal pour la bordure
  parameters: string; // Nombre de paramètres (ex: "300M", "3.3B")
}

export interface ModelFamily {
  name: string;
  type: 'mt5' | 'nllb';
  purpose: 'simple' | 'complex';
  maxTokens: number;
  languages: string[];
  variants: Record<string, ModelVariant>;
}

export const MODEL_FAMILIES: Record<string, ModelFamily> = {
  mt5: {
    name: 'mT5 (Multilingual Text-to-Text Transfer Transformer)',
    type: 'mt5',
    purpose: 'simple',
    maxTokens: 100,
    languages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
    variants: {
      small: {
        size: 'small',
        memoryRequirement: 2048, // 2GB
        downloadSize: 580, // 580MB
        performance: 'fast',
        description: 'Modèle léger et rapide, idéal pour machines avec ressources limitées',
        modelUrl: 'https://huggingface.co/google/mt5-small/resolve/main/tf_model.h5',
        tokenizerUrl: 'https://huggingface.co/google/mt5-small/resolve/main/tokenizer.json',
        energyCostPerTranslation: 15, // mJ
        co2PerTranslation: 0.8, // mg CO2
        monetaryCostPer1000Translations: 0.05, // USD
        qualityScore: 6,
        speedScore: 9,
        borderColor: '#22c55e', // Vert (efficace)
        parameters: '300M',
      },
      base: {
        size: 'base',
        memoryRequirement: 4096, // 4GB
        downloadSize: 1200, // 1.2GB
        performance: 'balanced',
        description: 'Modèle équilibré entre performance et qualité',
        modelUrl: 'https://huggingface.co/google/mt5-base/resolve/main/tf_model.h5',
        tokenizerUrl: 'https://huggingface.co/google/mt5-base/resolve/main/tokenizer.json',
        energyCostPerTranslation: 35, // mJ
        co2PerTranslation: 1.8, // mg CO2
        monetaryCostPer1000Translations: 0.12, // USD
        qualityScore: 7,
        speedScore: 7,
        borderColor: '#84cc16', // Vert clair
        parameters: '580M',
      },
      large: {
        size: 'large',
        memoryRequirement: 8192, // 8GB
        downloadSize: 2400, // 2.4GB
        performance: 'accurate',
        description: 'Modèle précis pour traductions de haute qualité',
        modelUrl: 'https://huggingface.co/google/mt5-large/resolve/main/tf_model.h5',
        tokenizerUrl: 'https://huggingface.co/google/mt5-large/resolve/main/tokenizer.json',
        energyCostPerTranslation: 75, // mJ
        co2PerTranslation: 3.9, // mg CO2
        monetaryCostPer1000Translations: 0.25, // USD
        qualityScore: 8,
        speedScore: 5,
        borderColor: '#eab308', // Jaune
        parameters: '1.2B',
      },
      xl: {
        size: 'xl',
        memoryRequirement: 12288, // 12GB
        downloadSize: 4800, // 4.8GB
        performance: 'accurate',
        description: 'Modèle très précis pour traductions professionnelles',
        modelUrl: 'https://huggingface.co/google/mt5-xl/resolve/main/tf_model.h5',
        tokenizerUrl: 'https://huggingface.co/google/mt5-xl/resolve/main/tokenizer.json',
        energyCostPerTranslation: 150, // mJ
        co2PerTranslation: 7.8, // mg CO2
        monetaryCostPer1000Translations: 0.50, // USD
        qualityScore: 9,
        speedScore: 3,
        borderColor: '#f97316', // Orange
        parameters: '3.7B',
      },
      xxl: {
        size: 'xxl',
        memoryRequirement: 24576, // 24GB
        downloadSize: 11000, // 11GB
        performance: 'premium',
        description: 'Modèle de précision maximale pour usage professionnel intensif',
        modelUrl: 'https://huggingface.co/google/mt5-xxl/resolve/main/tf_model.h5',
        tokenizerUrl: 'https://huggingface.co/google/mt5-xxl/resolve/main/tokenizer.json',
        energyCostPerTranslation: 320, // mJ
        co2PerTranslation: 16.7, // mg CO2
        monetaryCostPer1000Translations: 1.20, // USD
        qualityScore: 10,
        speedScore: 2,
        borderColor: '#dc2626', // Rouge (coûteux)
        parameters: '13B',
      },
    },
  },
  nllb: {
    name: 'NLLB (No Language Left Behind)',
    type: 'nllb',
    purpose: 'complex',
    maxTokens: 1000,
    languages: [
      'en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
      'ar', 'hi', 'tr', 'pl', 'nl', 'sv', 'da', 'no', 'fi', 'cs',
      'sk', 'hu', 'ro', 'bg', 'hr', 'sl', 'et', 'lv', 'lt', 'mt',
      'cy', 'ga', 'gd', 'is', 'mk', 'sq', 'eu', 'ca', 'gl', 'ast',
    ],
    variants: {
      '200M': {
        size: '200M',
        memoryRequirement: 1536, // 1.5GB
        downloadSize: 200, // 200MB
        performance: 'fast',
        description: 'Modèle ultra-léger pour appareils mobiles et faibles ressources',
        modelUrl: 'https://huggingface.co/facebook/nllb-200-200M/resolve/main/model.json',
        tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-200M/resolve/main/tokenizer.json',
        energyCostPerTranslation: 8, // mJ
        co2PerTranslation: 0.4, // mg CO2
        monetaryCostPer1000Translations: 0.03, // USD
        qualityScore: 5,
        speedScore: 10,
        borderColor: '#16a34a', // Vert foncé (très efficace)
        parameters: '200M',
      },
      distilled_600M: {
        size: 'distilled-600M',
        memoryRequirement: 3072, // 3GB
        downloadSize: 600, // 600MB
        performance: 'fast',
        description: 'Version distillée et optimisée, excellent rapport qualité/performance',
        modelUrl: 'https://huggingface.co/facebook/nllb-200-distilled-600M/resolve/main/model.json',
        tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-distilled-600M/resolve/main/tokenizer.json',
        energyCostPerTranslation: 22, // mJ
        co2PerTranslation: 1.1, // mg CO2
        monetaryCostPer1000Translations: 0.08, // USD
        qualityScore: 7,
        speedScore: 8,
        borderColor: '#22c55e', // Vert
        parameters: '600M',
      },
      distilled_1_3B: {
        size: 'distilled-1.3B',
        memoryRequirement: 4608, // 4.5GB
        downloadSize: 1300, // 1.3GB
        performance: 'balanced',
        description: 'Version distillée avec qualité élevée et performance optimisée',
        modelUrl: 'https://huggingface.co/facebook/nllb-200-distilled-1.3B/resolve/main/model.json',
        tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-distilled-1.3B/resolve/main/tokenizer.json',
        energyCostPerTranslation: 45, // mJ
        co2PerTranslation: 2.3, // mg CO2
        monetaryCostPer1000Translations: 0.15, // USD
        qualityScore: 8,
        speedScore: 6,
        borderColor: '#84cc16', // Vert clair
        parameters: '1.3B',
      },
      '1_3B': {
        size: '1.3B',
        memoryRequirement: 6144, // 6GB
        downloadSize: 1300, // 1.3GB
        performance: 'balanced',
        description: 'Modèle standard avec bonne précision pour usage général',
        modelUrl: 'https://huggingface.co/facebook/nllb-200-1.3B/resolve/main/model.json',
        tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-1.3B/resolve/main/tokenizer.json',
        energyCostPerTranslation: 55, // mJ
        co2PerTranslation: 2.9, // mg CO2
        monetaryCostPer1000Translations: 0.18, // USD
        qualityScore: 8,
        speedScore: 5,
        borderColor: '#a3a3a3', // Gris (neutre)
        parameters: '1.3B',
      },
      '3_3B': {
        size: '3.3B',
        memoryRequirement: 12288, // 12GB
        downloadSize: 3300, // 3.3GB
        performance: 'accurate',
        description: 'Modèle haute précision pour traductions professionnelles complexes',
        modelUrl: 'https://huggingface.co/facebook/nllb-200-3.3B/resolve/main/model.json',
        tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-3.3B/resolve/main/tokenizer.json',
        energyCostPerTranslation: 125, // mJ
        co2PerTranslation: 6.5, // mg CO2
        monetaryCostPer1000Translations: 0.40, // USD
        qualityScore: 9,
        speedScore: 3,
        borderColor: '#f59e0b', // Orange
        parameters: '3.3B',
      },
      '54B': {
        size: '54B',
        memoryRequirement: 65536, // 64GB
        downloadSize: 54000, // 54GB
        performance: 'premium',
        description: 'Modèle de recherche ultra-précis, réservé aux serveurs haute performance',
        modelUrl: 'https://huggingface.co/facebook/nllb-200-54B/resolve/main/model.json',
        tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-54B/resolve/main/tokenizer.json',
        energyCostPerTranslation: 1200, // mJ
        co2PerTranslation: 62.4, // mg CO2
        monetaryCostPer1000Translations: 4.50, // USD
        qualityScore: 10,
        speedScore: 1,
        borderColor: '#991b1b', // Rouge foncé (très coûteux)
        parameters: '54B',
      },
    },
  },
};

/**
 * Détecte les capacités de la machine
 */
export interface SystemCapabilities {
  estimatedRAM: number; // en MB
  deviceType: 'mobile' | 'laptop' | 'desktop' | 'workstation';
  connectionSpeed: 'slow' | 'fast';
  storageAvailable: number; // en MB
}

/**
 * Détecte automatiquement les capacités du système
 */
export function detectSystemCapabilities(): SystemCapabilities {
  const navigator = globalThis.navigator;
  const connection = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number } })?.connection;
  
  // Estimation basique de la RAM (via navigator.deviceMemory si disponible)
  let estimatedRAM = 8192; // Default 8GB
  if ('deviceMemory' in navigator) {
    estimatedRAM = (navigator as unknown as { deviceMemory: number }).deviceMemory * 1024; // Convert GB to MB
  } else {
    // Heuristiques basées sur d'autres indicateurs
    const cores = navigator.hardwareConcurrency || 4;
    if (cores >= 16) estimatedRAM = 32768; // 32GB
    else if (cores >= 8) estimatedRAM = 16384; // 16GB
    else if (cores >= 4) estimatedRAM = 8192; // 8GB
    else estimatedRAM = 4096; // 4GB
  }

  // Détection du type d'appareil
  let deviceType: SystemCapabilities['deviceType'] = 'laptop';
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent);
  
  if (isMobile && !isTablet) deviceType = 'mobile';
  else if (estimatedRAM >= 32768) deviceType = 'workstation';
  else if (estimatedRAM >= 16384) deviceType = 'desktop';
  else deviceType = 'laptop';

  // Vitesse de connexion
  const connectionSpeed = connection?.effectiveType === '4g' || (connection?.downlink && connection.downlink > 10) ? 'fast' : 'slow';

  // Estimation de l'espace de stockage disponible
  let storageAvailable = 10240; // Default 10GB
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    navigator.storage.estimate().then(estimate => {
      if (estimate.quota) {
        storageAvailable = Math.floor((estimate.quota - (estimate.usage || 0)) / (1024 * 1024));
      }
    });
  }

  return {
    estimatedRAM,
    deviceType,
    connectionSpeed,
    storageAvailable,
  };
}

/**
 * Recommande les meilleures variantes de modèles selon les capacités système
 */
export function recommendModelVariants(capabilities: SystemCapabilities): {
  mt5: string;
  nllb: string;
  reasoning: string;
} {
  const { estimatedRAM, deviceType, storageAvailable } = capabilities;

  let mt5Variant = 'small';
  let nllbVariant = '200M';
  let reasoning = '';

  if (estimatedRAM >= 65536 && storageAvailable >= 60000 && deviceType === 'workstation') {
    // Machine très puissante : modèles premium (serveur/workstation haut de gamme)
    mt5Variant = 'xxl';
    nllbVariant = '54B';
    reasoning = 'Workstation très puissante (64GB+ RAM) - modèles premium pour recherche/production intensive';
  } else if (estimatedRAM >= 32768 && storageAvailable >= 15000 && deviceType === 'workstation') {
    // Machine puissante : meilleurs modèles pratiques
    mt5Variant = 'xl';
    nllbVariant = '3_3B';
    reasoning = 'Machine puissante (32GB+ RAM) - modèles haute précision optimaux';
  } else if (estimatedRAM >= 16384 && storageAvailable >= 6000) {
    // Machine équilibrée : modèles intermédiaires
    mt5Variant = 'large';
    nllbVariant = 'distilled_1_3B';
    reasoning = 'Machine équilibrée (16GB+ RAM) - modèles balanced avec bonne qualité';
  } else if (estimatedRAM >= 8192 && storageAvailable >= 3000) {
    // Machine standard : modèles légers mais performants
    mt5Variant = 'base';
    nllbVariant = 'distilled_600M';
    reasoning = 'Machine standard (8GB+ RAM) - modèles optimisés pour usage quotidien';
  } else if (estimatedRAM >= 4096 && storageAvailable >= 1500) {
    // Machine basique : modèles très légers
    mt5Variant = 'small';
    nllbVariant = 'distilled_600M';
    reasoning = 'Machine avec ressources modérées (4GB+ RAM) - modèles légers';
  } else {
    // Machine très limitée : modèles minimaux
    mt5Variant = 'small';
    nllbVariant = '200M';
    reasoning = 'Machine avec ressources très limitées - modèles ultra-légers pour compatibilité maximale';
  }

  // Ajustements selon le type d'appareil
  if (deviceType === 'mobile') {
    // Sur mobile, privilégier les plus petits modèles
    mt5Variant = 'small';
    nllbVariant = estimatedRAM >= 6144 ? 'distilled_600M' : '200M';
    reasoning += ' (ajusté pour mobile)';
  }

  return { mt5: mt5Variant, nllb: nllbVariant, reasoning };
}

/**
 * Obtient la configuration complète d'un modèle
 */
export function getModelConfig(family: string, variant: string): {
  family: ModelFamily;
  variant: ModelVariant;
} | null {
  const modelFamily = MODEL_FAMILIES[family];
  if (!modelFamily) return null;

  const modelVariant = modelFamily.variants[variant];
  if (!modelVariant) return null;

  return { family: modelFamily, variant: modelVariant };
}

/**
 * Calcule le temps de téléchargement estimé
 */
export function estimateDownloadTime(sizeInMB: number, connectionSpeed: 'slow' | 'fast'): string {
  const speedMbps = connectionSpeed === 'fast' ? 50 : 5; // Mbps
  const timeInSeconds = (sizeInMB * 8) / speedMbps;
  
  if (timeInSeconds < 60) return `${Math.ceil(timeInSeconds)}s`;
  if (timeInSeconds < 3600) return `${Math.ceil(timeInSeconds / 60)}min`;
  return `${Math.ceil(timeInSeconds / 3600)}h`;
}

/**
 * Obtient tous les variants disponibles avec leurs informations détaillées
 */
export function getAllModelVariants(): Array<{
  family: string;
  variant: string;
  info: ModelVariant;
  familyInfo: ModelFamily;
}> {
  const variants: Array<{
    family: string;
    variant: string;
    info: ModelVariant;
    familyInfo: ModelFamily;
  }> = [];

  for (const [familyKey, familyData] of Object.entries(MODEL_FAMILIES)) {
    for (const [variantKey, variantData] of Object.entries(familyData.variants)) {
      variants.push({
        family: familyKey,
        variant: variantKey,
        info: variantData,
        familyInfo: familyData,
      });
    }
  }

  return variants;
}

/**
 * Obtient un variant spécifique par identifiant unique
 */
export function getVariantById(id: string): {
  family: string;
  variant: string;
  info: ModelVariant;
  familyInfo: ModelFamily;
} | null {
  // Format attendu: "mt5_small" ou "nllb_distilled_600M"
  const parts = id.split('_');
  if (parts.length < 2) return null;

  const family = parts[0];
  const variant = parts.slice(1).join('_');

  const familyData = MODEL_FAMILIES[family];
  if (!familyData) return null;

  const variantData = familyData.variants[variant];
  if (!variantData) return null;

  return {
    family,
    variant,
    info: variantData,
    familyInfo: familyData,
  };
}

/**
 * Calcule l'impact énergétique total d'une série de traductions
 */
export function calculateEnvironmentalImpact(translations: Array<{
  modelFamily: string;
  modelVariant: string;
  count: number;
}>) {
  let totalEnergy = 0; // mJ
  let totalCO2 = 0; // mg
  let totalCost = 0; // USD

  for (const translation of translations) {
    const variant = MODEL_FAMILIES[translation.modelFamily]?.variants[translation.modelVariant];
    if (variant) {
      totalEnergy += variant.energyCostPerTranslation * translation.count;
      totalCO2 += variant.co2PerTranslation * translation.count;
      totalCost += (variant.monetaryCostPer1000Translations / 1000) * translation.count;
    }
  }

  return {
    totalEnergyMJ: totalEnergy,
    totalEnergyWh: totalEnergy / 3600, // Conversion mJ vers Wh
    totalCO2Mg: totalCO2,
    totalCO2G: totalCO2 / 1000, // Conversion mg vers g
    totalCostUSD: totalCost,
    equivalents: {
      phoneCharges: Math.round(totalEnergy / 3600 / 0.012), // 1 charge = ~0.012 Wh
      carKm: Math.round((totalCO2 / 1000) / 120), // 120g CO2/km pour une voiture moyenne
      treeHours: Math.round((totalCO2 / 1000) / 0.025), // 1 arbre absorbe ~25g CO2/jour
    }
  };
}

/**
 * Obtient la couleur associée à un niveau de performance/coût
 */
export function getPerformanceColor(
  qualityScore: number,
  speedScore: number,
  energyCost: number
): string {
  // Algorithme pour déterminer la couleur basée sur plusieurs métriques
  const efficiency = (qualityScore + speedScore) / (energyCost / 10);
  
  if (efficiency > 3) return '#22c55e'; // Vert - très efficace
  if (efficiency > 2) return '#84cc16'; // Vert clair - efficace
  if (efficiency > 1.5) return '#eab308'; // Jaune - moyen
  if (efficiency > 1) return '#f97316'; // Orange - coûteux
  return '#dc2626'; // Rouge - très coûteux
}

/**
 * Génère un identifiant unique pour un modèle
 */
export function getModelId(family: string, variant: string): string {
  return `${family}_${variant}`;
}
