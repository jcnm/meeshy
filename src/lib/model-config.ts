/**
 * Configuration des modèles de traduction avec différentes tailles
 */

export interface ModelVariant {
  size: string;
  memoryRequirement: number; // en MB
  downloadSize: number; // en MB
  performance: 'fast' | 'balanced' | 'accurate';
  description: string;
  modelUrl: string;
  tokenizerUrl?: string;
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
        description: 'Modèle léger, idéal pour machines avec 8GB RAM ou moins',
        modelUrl: 'https://huggingface.co/google/mt5-small/resolve/main/model.json',
        tokenizerUrl: 'https://huggingface.co/google/mt5-small/resolve/main/tokenizer.json',
      },
      base: {
        size: 'base',
        memoryRequirement: 4096, // 4GB
        downloadSize: 1200, // 1.2GB
        performance: 'balanced',
        description: 'Modèle équilibré, recommandé pour machines avec 16GB RAM',
        modelUrl: 'https://huggingface.co/google/mt5-base/resolve/main/model.json',
        tokenizerUrl: 'https://huggingface.co/google/mt5-base/resolve/main/tokenizer.json',
      },
      large: {
        size: 'large',
        memoryRequirement: 8192, // 8GB
        downloadSize: 2400, // 2.4GB
        performance: 'accurate',
        description: 'Modèle précis, pour machines avec 32GB RAM ou plus',
        modelUrl: 'https://huggingface.co/google/mt5-large/resolve/main/model.json',
        tokenizerUrl: 'https://huggingface.co/google/mt5-large/resolve/main/tokenizer.json',
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
      distilled_600M: {
        size: 'distilled-600M',
        memoryRequirement: 3072, // 3GB
        downloadSize: 600, // 600MB
        performance: 'fast',
        description: 'Version distillée et optimisée, idéale pour machines avec 8-16GB RAM',
        modelUrl: 'https://huggingface.co/facebook/nllb-200-distilled-600M/resolve/main/model.json',
        tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-distilled-600M/resolve/main/tokenizer.json',
      },
      '1_3B': {
        size: '1.3B',
        memoryRequirement: 6144, // 6GB
        downloadSize: 1300, // 1.3GB
        performance: 'balanced',
        description: 'Modèle équilibré avec bonne précision, pour machines avec 16-32GB RAM',
        modelUrl: 'https://huggingface.co/facebook/nllb-200-1.3B/resolve/main/model.json',
        tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-1.3B/resolve/main/tokenizer.json',
      },
      '3_3B': {
        size: '3.3B',
        memoryRequirement: 12288, // 12GB
        downloadSize: 3300, // 3.3GB
        performance: 'accurate',
        description: 'Modèle haute précision, nécessite 32GB RAM ou plus',
        modelUrl: 'https://huggingface.co/facebook/nllb-200-3.3B/resolve/main/model.json',
        tokenizerUrl: 'https://huggingface.co/facebook/nllb-200-3.3B/resolve/main/tokenizer.json',
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
  let nllbVariant = 'distilled_600M';
  let reasoning = '';

  if (estimatedRAM >= 32768 && storageAvailable >= 8000 && deviceType === 'workstation') {
    // Machine puissante : meilleurs modèles
    mt5Variant = 'large';
    nllbVariant = '3_3B';
    reasoning = 'Machine puissante détectée (32GB+ RAM) - modèles haute précision recommandés';
  } else if (estimatedRAM >= 16384 && storageAvailable >= 4000) {
    // Machine équilibrée
    mt5Variant = 'base';
    nllbVariant = '1_3B';
    reasoning = 'Machine équilibrée (16GB+ RAM) - modèles balanced recommandés';
  } else {
    // Machine limitée : modèles légers
    mt5Variant = 'small';
    nllbVariant = 'distilled_600M';
    reasoning = 'Machine avec ressources limitées - modèles légers recommandés';
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
