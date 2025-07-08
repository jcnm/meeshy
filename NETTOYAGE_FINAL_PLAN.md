# Plan de Nettoyage Final - Architecture Meeshy

## Services de Traduction Redondants Identifiés

### À Supprimer (Non utilisés ou redondants)
1. `src/services/optimized-translation-integration.service.ts` - Utilisé seulement par 1 hook obsolète
2. `src/services/hierarchical-cache.service.ts` - Utilisé par des services redondants
3. `src/services/optimized-translation.service.ts` - Remplacé par simplified-translation
4. `src/lib/migration-plan.ts` - Fichier de plan non utilisé
5. `src/lib/test-model-service.ts` - Utilisé seulement par test-runner

### Configuration de Modèles Redondante
1. `src/lib/simple-model-config.ts` vs `src/lib/simplified-model-config.ts` vs `src/lib/unified-model-config.ts`
   - Garder: `unified-model-config.ts` (le plus complet)
   - Supprimer: `simple-model-config.ts` et `simplified-model-config.ts`

### Composants de Test Redondants
1. `src/components/models/system-test.tsx` - Remplacé par enhanced-system-test
2. `src/components/settings/system-test-component.tsx` - Doublon

### Utilitaires Non Critiques
1. `src/utils/debug-models.ts` - Utilisé seulement pour debug
2. `src/utils/test-runner.ts` - Utilisé seulement par composant de test
3. `src/utils/model-sync.ts` - Fonctionnalité remplacée

### Dossiers de Modèles Redondants
1. `public/models/mt5/` - Doublon de `mt5-small/`
2. `public/models/MT5_SMALL/` - Doublon de `mt5-small/`
3. `public/models/nllb/` - Doublon de `nllb-200-distilled-600M/`
4. `public/models/NLLB_DISTILLED_600M/` - Doublon de `nllb-200-distilled-600M/`

## Actions à Effectuer

### Phase 1: Services de Traduction
- Identifier les dernières utilisations
- Migrer vers le service unifié
- Supprimer les services obsolètes

### Phase 2: Configuration des Modèles
- Unifier vers `unified-model-config.ts`
- Mettre à jour tous les imports
- Supprimer les anciens fichiers

### Phase 3: Composants et Utilitaires
- Supprimer les composants de test obsolètes
- Nettoyer les utilitaires non critiques

### Phase 4: Dossiers de Modèles
- Supprimer les doublons de dossiers
- Mettre à jour la configuration pour pointer vers les bons dossiers

### Phase 5: Tests et Validation
- Exécuter les tests
- Vérifier l'application
- Commit final
