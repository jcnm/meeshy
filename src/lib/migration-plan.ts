/**
 * Plan de migration vers la configuration unifiée des modèles
 * Ce fichier documente les changements nécessaires pour utiliser unified-model-config.ts
 */

// ÉTAPES DE MIGRATION :

// 1. Mettre à jour src/types/index.ts
// - Importer les types depuis unified-model-config.ts
// - Supprimer les définitions redondantes (TRANSLATION_MODELS, ModelCost, etc.)
// - Garder les autres types non liés aux modèles

// 2. Adapter src/lib/translation-models.ts
// - Utiliser UNIFIED_TRANSLATION_MODELS au lieu de TRANSLATION_MODELS
// - Adapter les méthodes pour utiliser la nouvelle structure
// - Intégrer les nouvelles fonctionnalités (getCompatibleModels, recommendModel, etc.)

// 3. Mettre à jour les hooks de traduction
// - src/hooks/use-optimized-message-translation.ts
// - src/hooks/use-message-translation.ts
// - Utiliser les nouvelles fonctions de recommandation

// 4. Adapter les composants UI
// - src/components/models/*.tsx
// - src/components/translation/*.tsx
// - Utiliser la structure unifiée pour l'affichage et la configuration

// 5. Services et utilitaires
// - src/lib/translation-service.ts
// - src/utils/translation.ts
// - Adapter pour utiliser la nouvelle configuration

// 6. Remplacement des imports
// AVANT:
// import { TRANSLATION_MODELS, TranslationModelType, ModelCost } from '@/types';
// import { MODEL_FAMILIES } from '@/lib/model-config';

// APRÈS:
// import { 
//   UNIFIED_TRANSLATION_MODELS as TRANSLATION_MODELS,
//   TranslationModelType,
//   ModelCost,
//   getModelConfig,
//   getModelsByFamily,
//   recommendModel
// } from '@/lib/unified-model-config';

export const MIGRATION_PLAN = {
  phase1: 'Créer unified-model-config.ts avec toutes les données consolidées',
  phase2: 'Adapter src/types/index.ts pour utiliser les nouveaux types',
  phase3: 'Migrer src/lib/translation-models.ts vers la nouvelle configuration',
  phase4: 'Mettre à jour les hooks de traduction',
  phase5: 'Adapter les composants UI',
  phase6: 'Nettoyer les anciens fichiers (model-config.ts)',
  phase7: 'Tests et validation'
};

// Correspondance entre ancienne et nouvelle structure
export const MAPPING = {
  // MODEL_FAMILIES.mt5.variants.small -> UNIFIED_TRANSLATION_MODELS.MT5_SMALL
  'mt5.small': 'MT5_SMALL',
  'mt5.base': 'MT5_BASE',
  'mt5.large': 'MT5_LARGE',
  'mt5.xl': 'MT5_XL',
  'mt5.xxl': 'MT5_XXL',
  
  // MODEL_FAMILIES.nllb.variants
  'nllb.200M': 'NLLB_200M',
  'nllb.distilled_600M': 'NLLB_DISTILLED_600M',
  'nllb.distilled_1_3B': 'NLLB_DISTILLED_1_3B',
  'nllb.1_3B': 'NLLB_1_3B',
  'nllb.3_3B': 'NLLB_3_3B',
  'nllb.54B': 'NLLB_54B'
};

export default MIGRATION_PLAN;
