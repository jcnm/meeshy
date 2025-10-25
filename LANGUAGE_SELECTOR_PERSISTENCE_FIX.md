# Fix : Sélecteur de langue qui ne persiste pas

**Date** : 25 octobre 2025  
**Problème** : Le changement de langue dans http://localhost:3100/settings#theme ne persiste pas après rechargement de la page. L'interface reste toujours en français même après sélection de l'anglais.

## 🔍 Diagnostic

### Cause racine
Le store Zustand `language-store.ts` utilisait `detectBrowserLanguage()` directement dans `initialState`, ce qui s'exécutait **avant** que le middleware `persist` ne puisse charger la valeur sauvegardée depuis `localStorage`.

### Ordre d'exécution problématique
1. ❌ `initialState` créé avec `currentInterfaceLanguage: detectBrowserLanguage()` → **'fr'** (navigateur en français)
2. ✅ Zustand persist charge `localStorage['meeshy-language']` → **'en'** (choix utilisateur)
3. ❌ **MAIS** l'initialState a déjà défini 'fr', donc la valeur persistée est ignorée ou écrasée

## ✅ Solution appliquée

### 1. Modification de `initialState` (language-store.ts)

**AVANT (incorrect)** :
```typescript
const initialState: LanguageState = {
  currentInterfaceLanguage: detectBrowserLanguage(), // ❌ S'exécute immédiatement
  currentMessageLanguage: detectBrowserLanguage(),   // ❌ Écrase le localStorage
  availableLanguages: ['en', 'fr'],
  userLanguageConfig: DEFAULT_LANGUAGE_CONFIG,
};
```

**APRÈS (correct)** :
```typescript
const initialState: LanguageState = {
  currentInterfaceLanguage: 'en', // ✅ Valeur par défaut simple
  currentMessageLanguage: 'en',   // ✅ Sera remplacée par persist
  availableLanguages: ['en', 'fr'],
  userLanguageConfig: DEFAULT_LANGUAGE_CONFIG,
};
```

### 2. Ajout de la version du store

```typescript
{
  name: 'meeshy-language',
  version: 1, // ✅ Permet de forcer la ré-initialisation si nécessaire
  partialize: (state) => ({
    currentInterfaceLanguage: state.currentInterfaceLanguage,
    currentMessageLanguage: state.currentMessageLanguage,
    userLanguageConfig: state.userLanguageConfig,
  }),
}
```

### 3. Ajout de logs de debug (theme-settings.tsx)

```typescript
// Debug: afficher la langue actuelle
useEffect(() => {
  console.log('🔍 [ThemeSettings] Current interface language:', currentInterfaceLanguage);
  console.log('🔍 [ThemeSettings] Available languages:', getSupportedLanguages());
}, [currentInterfaceLanguage, getSupportedLanguages]);

const handleInterfaceLanguageChange = (languageCode: string) => {
  console.log('🔄 [ThemeSettings] Changing language to:', languageCode);
  setInterfaceLanguage(languageCode);
  toast.success(t('theme.interfaceLanguageUpdated'));
  
  setTimeout(() => {
    console.log('🔄 [ThemeSettings] Reloading page...');
    window.location.reload();
  }, 500);
};
```

## 🧪 Tests à effectuer

### Test 1 : Changement vers l'anglais
1. Ouvrir http://localhost:3100/settings#theme
2. Sélectionner "English" dans le sélecteur de langue d'interface
3. Attendre le rechargement automatique (500ms)
4. **Vérifier** : L'interface est en anglais et le sélecteur affiche "English"

### Test 2 : Persistance après fermeture
1. Après Test 1, fermer complètement l'onglet
2. Ouvrir un nouvel onglet sur http://localhost:3100
3. **Vérifier** : L'interface est toujours en anglais

### Test 3 : localStorage
Ouvrir la console (F12) :
```javascript
// Vérifier le contenu
JSON.parse(localStorage.getItem('meeshy-language'))

// Devrait retourner :
{
  "state": {
    "currentInterfaceLanguage": "en", // ou "fr"
    "currentMessageLanguage": "en",   // ou "fr"
    "userLanguageConfig": { ... }
  },
  "version": 1
}
```

### Test 4 : Reset et détection navigateur
```javascript
// Effacer la préférence sauvegardée
localStorage.removeItem('meeshy-language');

// Recharger la page
window.location.reload();

// Résultat attendu :
// - Navigateur en français → interface en français
// - Navigateur en anglais → interface en anglais
// - Autres langues → interface en anglais (fallback)
```

## 📊 Logs console attendus

### Au chargement de la page
```
🔍 [ThemeSettings] Current interface language: en
🔍 [ThemeSettings] Available languages: [{code: 'en', ...}, {code: 'fr', ...}]
```

### Lors du changement de langue
```
🔄 [ThemeSettings] Changing language to: fr
[LANGUAGE_STORE] Setting interface language: fr
🔄 [ThemeSettings] Reloading page...
```

### Après rechargement
```
🔍 [ThemeSettings] Current interface language: fr
```

## 🔧 Dépannage

### Si la langue ne change toujours pas

1. **Vider complètement le localStorage** :
```javascript
localStorage.clear();
sessionStorage.clear();
```

2. **Hard reload du navigateur** :
- Chrome/Edge : `Ctrl+Shift+R` (Windows) ou `Cmd+Shift+R` (Mac)
- Firefox : `Ctrl+F5` (Windows) ou `Cmd+Shift+R` (Mac)

3. **Vérifier la version du store** :
```javascript
const stored = JSON.parse(localStorage.getItem('meeshy-language'));
console.log('Store version:', stored?.version); // Devrait être 1
```

4. **Forcer une nouvelle version** :
Si le problème persiste, incrémenter `version: 2` dans `language-store.ts` pour forcer la ré-initialisation.

## 📝 Fichiers modifiés

1. **frontend/stores/language-store.ts** :
   - Suppression de `detectBrowserLanguage()` dans `initialState`
   - Ajout de `version: 1` dans la config persist
   - Valeurs par défaut simples : `'en'` au lieu de fonction dynamique

2. **frontend/components/settings/theme-settings.tsx** :
   - Ajout de logs debug avec `useEffect` pour tracer `currentInterfaceLanguage`
   - Ajout de logs dans `handleInterfaceLanguageChange`

3. **frontend/TEST_LANGUAGE_PERSISTENCE.md** :
   - Documentation complète du problème et des tests

## 🎯 Résultat attendu

✅ Le sélecteur de langue dans `/settings#theme` fonctionne correctement  
✅ La langue sélectionnée persiste après rechargement de la page  
✅ La langue persiste après fermeture et réouverture du navigateur  
✅ Premier visiteur : détection automatique de la langue du navigateur (EN/FR)  
✅ Langue non supportée : fallback vers anglais  

## 🚀 Commandes pour tester

```bash
# Rebuild du frontend
cd /Users/smpceo/Documents/Services/Meeshy/meeshy/frontend
pnpm run build

# Redémarrer le dev server si nécessaire
pnpm run dev

# Ou redémarrer tout le stack local
cd /Users/smpceo/Documents/Services/Meeshy/meeshy
./scripts/development/development-stop-local.sh
./scripts/development/development-start-local.sh
```

## 📚 Références

- **Zustand persist middleware** : https://docs.pmnd.rs/zustand/integrations/persisting-store-data
- **Ordre d'exécution Zustand** : initialState → persist rehydrate → selectors
- **Issue similaire** : Le pattern `initialState: computeValue()` bypasse persist

---

**Status** : ✅ Fix appliqué, build réussi, prêt pour test utilisateur
