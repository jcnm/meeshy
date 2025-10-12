# 🐛 Correction: Changement de Langue dans les Messages

## Problèmes Identifiés

### 1. ❌ Traduction non affichée lors de la sélection
**Symptôme**: Quand l'utilisateur clique sur une traduction dans le popover, le contenu ne change pas.

### 2. ❌ Langue originale non affichée au clic
**Symptôme**: Quand l'utilisateur clique sur le badge de langue originale, le message original ne s'affiche pas.

## ✅ Corrections Apportées

### 1. **Réorganisation de l'initialisation de l'état**
- **Avant**: L'initialisation se faisait pendant le render
- **Après**: Utilisation d'un `useEffect` dédié après la définition de `displayMessages`
- **Fichier**: `frontend/components/common/messages-display.tsx`

```typescript
// Initialiser l'état d'affichage pour les nouveaux messages
useEffect(() => {
  const newStates: Record<string, any> = {};
  let hasNewStates = false;

  displayMessages.forEach(message => {
    if (!messageDisplayStates[message.id]) {
      const preferredLanguage = getPreferredDisplayLanguage(message);
      newStates[message.id] = {
        currentDisplayLanguage: preferredLanguage,
        isTranslating: false
      };
      hasNewStates = true;
    }
  });

  if (hasNewStates) {
    setMessageDisplayStates(prev => ({ ...prev, ...newStates }));
  }
}, [displayMessages, messageDisplayStates, getPreferredDisplayLanguage]);
```

### 2. **Amélioration du handleLanguageSwitch**
- **Avant**: Ne gérait pas le cas où l'état du message n'existait pas
- **Après**: Crée toujours un nouvel état complet même si inexistant

```typescript
const handleLanguageSwitch = useCallback((messageId: string, language: string) => {
  console.log(`🔄 [LANGUAGE SWITCH] Message ${messageId}: switching to ${language}`);
  setMessageDisplayStates(prev => ({
    ...prev,
    [messageId]: {
      currentDisplayLanguage: language,
      isTranslating: prev[messageId]?.isTranslating || false,
      translationError: prev[messageId]?.translationError
    }
  }));
}, []);
```

### 3. **Ajout de logs de debugging**

#### Dans messages-display.tsx
```typescript
console.log(`🔄 [LANGUAGE SWITCH] Message ${messageId}: switching to ${language}`);
```

#### Dans bubble-message.tsx
```typescript
console.log(`🔄 [BUBBLE-MESSAGE] Switching language for message ${message.id} to ${langCode}`);
console.log(`📊 [BUBBLE-MESSAGE] Current display language: ${currentDisplayLanguage}`);

// Dans getCurrentContent()
console.log(`📖 [BUBBLE-MESSAGE] Getting content for message ${message.id}:`, {
  currentDisplayLanguage,
  originalLang,
  isOriginal: currentDisplayLanguage === originalLang,
  translationsCount: message.translations?.length || 0
});
```

#### Debug du changement de langue (useEffect)
```typescript
useEffect(() => {
  console.log(`🔄 [BUBBLE-MESSAGE] currentDisplayLanguage changed for message ${message.id}:`, {
    newLanguage: currentDisplayLanguage,
    originalLanguage: message.originalLanguage,
    translationsAvailable: message.translations?.map((t: any) => t.language || t.targetLanguage) || []
  });
}, [currentDisplayLanguage, message.id]);
```

## 🔍 Comment Débugger

### Console Logs à Surveiller

Quand vous cliquez sur une traduction, vous devriez voir dans la console :

```
1. 🔄 [BUBBLE-MESSAGE] Switching language for message xxx to en
2. 📊 [BUBBLE-MESSAGE] Current display language: fr
3. 🔄 [LANGUAGE SWITCH] Message xxx: switching to en
4. 🔄 [BUBBLE-MESSAGE] currentDisplayLanguage changed for message xxx: { newLanguage: 'en', ... }
5. 📖 [BUBBLE-MESSAGE] Getting content for message xxx: { currentDisplayLanguage: 'en', ... }
6. ✅ [BUBBLE-MESSAGE] Showing translated content in en (Translation text...)
```

### Étapes de Test

#### Test 1: Changement de traduction
1. Ouvrez une conversation avec des messages traduits
2. Ouvrez le popover de traduction (icône 🌐)
3. Cliquez sur une langue disponible
4. Vérifiez que :
   - ✅ Le popover se ferme
   - ✅ Le contenu du message change
   - ✅ Les logs apparaissent dans la console
   - ✅ L'animation de transition se joue

#### Test 2: Retour à l'original
1. Affichez un message traduit
2. Cliquez sur le badge de langue originale (en haut à droite)
3. Vérifiez que :
   - ✅ Le message original s'affiche
   - ✅ Le badge change de couleur (gris = actif)
   - ✅ Les logs montrent le changement
   - ✅ L'animation de transition se joue

#### Test 3: Navigation entre traductions
1. Affichez un message avec plusieurs traductions
2. Changez de langue plusieurs fois
3. Vérifiez que :
   - ✅ Chaque changement met à jour le contenu
   - ✅ Les transitions sont fluides
   - ✅ Pas de lag ou freeze

## 📊 Flux de Données Corrigé

```
┌────────────────────────────────────────────────────────────┐
│ Utilisateur clique sur une traduction dans le popover     │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ BubbleMessage.handleLanguageSwitch(langCode)               │
│ - Ferme le popover                                         │
│ - Appelle onLanguageSwitch(messageId, langCode)            │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ MessagesDisplay.handleLanguageSwitch(messageId, language)  │
│ - Met à jour messageDisplayStates[messageId]               │
│ - Change currentDisplayLanguage pour ce message            │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ BubbleMessage re-rend avec nouveau currentDisplayLanguage │
│ - useEffect détecte le changement                          │
│ - getCurrentContent() utilise la nouvelle langue           │
│ - AnimatePresence joue la transition                       │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ Contenu mis à jour visible à l'utilisateur ✅              │
└────────────────────────────────────────────────────────────┘
```

## 🎯 Points Clés de la Correction

### 1. Initialisation Propre
- ✅ useEffect au bon endroit (après displayMessages)
- ✅ Pas d'initialisation pendant le render
- ✅ État complet créé pour chaque nouveau message

### 2. Mise à Jour Robuste
- ✅ handleLanguageSwitch crée toujours un état complet
- ✅ Utilise l'opérateur `?.` pour éviter les undefined
- ✅ Conserve les propriétés existantes (isTranslating, translationError)

### 3. Logging Exhaustif
- ✅ Logs à chaque étape du flux
- ✅ useEffect pour tracer les changements de prop
- ✅ Logs dans getCurrentContent pour voir ce qui est retourné

## 🧪 Résultats Attendus

### Comportement Correct

1. **Clic sur traduction**: Le message se traduit instantanément
2. **Clic sur original**: Le message original s'affiche
3. **Navigation entre langues**: Fluide et sans bug
4. **Console logs**: Montrent clairement le flux

### Si Problème Persiste

Vérifiez dans la console :
- Les logs `[LANGUAGE SWITCH]` apparaissent ?
- Les logs `[BUBBLE-MESSAGE]` montrent le bon currentDisplayLanguage ?
- Les traductions sont bien présentes dans le message ?
- getCurrentContent() trouve la traduction ?

## 📝 Notes Techniques

- Le state `messageDisplayStates` est géré au niveau du composant parent (`MessagesDisplay`)
- Chaque message a son propre état de langue
- Les traductions sont stockées dans `message.translations[]`
- Le format des traductions peut être `t.language` ou `t.targetLanguage`
- Le contenu peut être `t.content` ou `t.translatedContent`

## ✅ Tests de Non-Régression

- [ ] Les tooltips fonctionnent toujours
- [ ] L'icône de réponse est à gauche de la traduction
- [ ] La navigation vers le message parent fonctionne
- [ ] Les animations sont fluides
- [ ] Le dark mode fonctionne
- [ ] Les favoris fonctionnent
- [ ] La copie fonctionne

---

**Date**: 12 octobre 2025  
**Status**: ✅ Corrigé avec logs de debug

