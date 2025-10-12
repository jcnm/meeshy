# Debug: Changement de Langue dans BubbleMessage

## Problème
Le changement de langue ne fonctionne toujours pas malgré le retrait de React.memo.

## Corrections Appliquées (12 octobre 2025)

### 1. Retrait de React.memo ✅
**Fichier**: `frontend/components/common/bubble-message.tsx`
- Export direct de `BubbleMessageInner` comme `BubbleMessage`
- Pas de mémoisation complexe qui bloque les re-renders

### 2. Correction des useEffect dans messages-display.tsx ✅
**Problème identifié**: `messageDisplayStates` dans les dépendances des useEffect créait des boucles/blocages

**Solution**: Utilisation de fonctions de callback dans `setMessageDisplayStates`

**Avant**:
```typescript
useEffect(() => {
  // ... code qui utilise messageDisplayStates
  setMessageDisplayStates(prev => ({ ...prev, ...newStates }));
}, [displayMessages, messageDisplayStates, getPreferredDisplayLanguage]); // ❌ messageDisplayStates dans deps
```

**Après**:
```typescript
useEffect(() => {
  setMessageDisplayStates(prev => {
    // Tout le code utilise 'prev' au lieu de messageDisplayStates
    return hasChanges ? newStates : prev;
  });
}, [displayMessages, getPreferredDisplayLanguage]); // ✅ Pas de messageDisplayStates dans deps
```

### 3. Logs de Debug Améliorés ✅

**Dans handleLanguageSwitch** (messages-display.tsx):
```typescript
console.log(`🔄 [LANGUAGE SWITCH] Message ${messageId}: switching to ${language}`);
console.log(`📊 [LANGUAGE SWITCH] Previous state:`, prev[messageId]);
console.log(`📊 [LANGUAGE SWITCH] New state:`, newState[messageId]);
```

**Dans currentContent useMemo** (bubble-message.tsx):
```typescript
console.log(`📖 [BUBBLE-MESSAGE ${message.id.substring(0, 8)}] Getting content:`, {
  currentDisplayLanguage,
  originalLang,
  availableLanguages: message.translations?.map((t: any) => t.language || t.targetLanguage) || []
});
```

## Flux de Debug À Vérifier

### Quand vous cliquez sur une traduction dans le popover:

```
1. 🔄 [BUBBLE-MESSAGE xxx] Switching language for message xxx to en
   → BubbleMessage appelle handleLanguageSwitch
   
2. 📊 [BUBBLE-MESSAGE xxx] Current display language: fr
   → État actuel avant changement

3. 🔄 [LANGUAGE SWITCH] Message xxx: switching to en
   → messages-display reçoit l'appel
   
4. 📊 [LANGUAGE SWITCH] Previous state: { currentDisplayLanguage: 'fr', ... }
   → État précédent dans le store
   
5. 📊 [LANGUAGE SWITCH] New state: { currentDisplayLanguage: 'en', ... }
   → Nouvel état créé
   
6. 📖 [BUBBLE-MESSAGE xxx] Getting content: { currentDisplayLanguage: 'en', ... }
   → useMemo recalcule le contenu
   
7. ✅ [BUBBLE-MESSAGE xxx] Showing TRANSLATED content in en
   → Contenu trouvé et affiché
```

### Si ça ne fonctionne PAS, vous verrez:

**Cas 1: handleLanguageSwitch n'est pas appelé**
```
❌ Pas de log [LANGUAGE SWITCH]
→ Problème: Le onClick du bouton ne fonctionne pas
```

**Cas 2: L'état change mais pas le contenu**
```
✅ [LANGUAGE SWITCH] New state: { currentDisplayLanguage: 'en', ... }
❌ Pas de nouveau log [BUBBLE-MESSAGE] Getting content
→ Problème: BubbleMessage ne re-render pas
```

**Cas 3: BubbleMessage re-render mais garde l'ancien contenu**
```
✅ [LANGUAGE SWITCH] New state: { currentDisplayLanguage: 'en', ... }
✅ [BUBBLE-MESSAGE] Getting content: { currentDisplayLanguage: 'en', ... }
⚠️ [BUBBLE-MESSAGE] No translation found for en, showing original
→ Problème: La traduction n'existe pas ou le format est incorrect
```

## Vérifications À Faire

### 1. Vérifier que les traductions existent
Ouvrir la console et taper:
```javascript
// Dans la console du navigateur
window.__messages = []; // Initialiser
// Puis chercher un message dans l'UI et inspecter
console.log(message.translations);
```

Devrait afficher quelque chose comme:
```javascript
[
  { language: 'en', content: 'Hello world', ... },
  { language: 'es', content: 'Hola mundo', ... }
]
```

### 2. Vérifier le format des traductions
Les traductions doivent avoir SOIT `language` SOIT `targetLanguage`:
```javascript
// Format accepté 1
{ language: 'en', content: 'text' }

// Format accepté 2
{ targetLanguage: 'en', translatedContent: 'text' }
```

### 3. Vérifier que currentDisplayLanguage est passé correctement
Dans la console, après un clic sur une traduction:
```
📊 [LANGUAGE SWITCH] New state: { currentDisplayLanguage: 'en', ... }
```

Si `currentDisplayLanguage` est toujours l'ancienne valeur, le state n'est pas mis à jour.

### 4. Vérifier que BubbleMessage reçoit la nouvelle prop
Ajouter ce log temporaire dans BubbleMessage (ligne ~105):
```typescript
useEffect(() => {
  console.log(`🔄 [BUBBLE-MESSAGE ${message.id.substring(0, 8)}] Props changed:`, {
    currentDisplayLanguage
  });
}, [currentDisplayLanguage, message.id]);
```

## Solutions Selon les Symptômes

### Symptôme: Pas de log [LANGUAGE SWITCH]
**Cause**: Le bouton de changement de langue ne fonctionne pas

**Solution**: Vérifier que le bouton appelle bien `handleLanguageSwitch`:
```typescript
<button onClick={(e) => {
  e.stopPropagation();
  handleLanguageSwitch(versionAny.language);
  handlePopoverOpenChange(false);
}}>
```

### Symptôme: [LANGUAGE SWITCH] log OK mais pas de re-render
**Cause**: React ne détecte pas le changement de state

**Solution**: Vérifier que le nouvel objet state est bien différent:
```typescript
// Le spread operator crée un nouvel objet
const newState = {
  ...prev,
  [messageId]: { // ← Nouvel objet, React détectera le changement
    currentDisplayLanguage: language,
    // ...
  }
};
```

### Symptôme: Re-render OK mais contenu identique
**Cause**: useMemo ne se recalcule pas ou traduction introuvable

**Solution 1**: Vérifier les dépendances de useMemo (ligne 312 bubble-message.tsx)
```typescript
}, [currentDisplayLanguage, message.id, message.originalLanguage, 
    message.content, message.originalContent, message.translations]);
    // ↑ Toutes ces deps déclenchent un recalcul
```

**Solution 2**: Vérifier que la traduction existe:
```typescript
const translation = message.translations?.find((t: any) => 
  (t?.language || t?.targetLanguage) === currentDisplayLanguage
);
// Si undefined → traduction introuvable
```

## Test Complet

1. **Ouvrir la console du navigateur** (F12)
2. **Activer tous les logs** (ne pas filtrer)
3. **Cliquer sur une traduction**
4. **Observer la séquence de logs**
5. **Comparer avec le flux attendu ci-dessus**

## Fichiers Modifiés pour ce Fix

1. `frontend/components/common/messages-display.tsx`
   - Lignes 225-247: useEffect initialisation sans messageDisplayStates dans deps
   - Lignes 249-289: useEffect auto-translation sans messageDisplayStates dans deps
   - Lignes 187-203: handleLanguageSwitch avec logs détaillés

2. `frontend/components/common/bubble-message.tsx`
   - Lignes 283-312: currentContent useMemo avec logs détaillés
   - Ligne 1026: Export direct sans React.memo

## Status

✅ Corrections appliquées
🧪 Tests requis avec logs de console
📊 Analyser les logs pour identifier le point de blocage exact

