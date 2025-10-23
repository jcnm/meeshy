# Fix: Synchronisation de l'état du bouton langue originale

## Modifications

### `BubbleMessage.tsx`
- **Ligne 3** : Ajout de `useEffect` aux imports React
- **Lignes 80-84** : Ajout d'un `useEffect` pour synchroniser `localDisplayLanguage` avec `currentDisplayLanguage`

## Problème Résolu

Le bouton de drapeau pour afficher la langue originale ne fonctionnait pas. Quand l'utilisateur cliquait dessus, le contenu ne changeait pas.

## Cause

Le state local `localDisplayLanguage` n'était pas synchronisé avec le prop `currentDisplayLanguage` venant du parent. Quand le bouton appelait `onLanguageSwitch()`, le parent mettait à jour son state, mais le composant enfant continuait d'utiliser l'ancienne valeur locale.

## Solution

Ajout d'un `useEffect` qui écoute les changements de `currentDisplayLanguage` et met à jour `localDisplayLanguage` en conséquence. Cela assure que les deux sources de vérité restent synchronisées.

## Test

```bash
cd frontend && pnpm run build
```

Build réussi ✅

## Documentation

Voir `ORIGINAL_LANGUAGE_TOGGLE_FIX.md` pour l'analyse technique complète.
