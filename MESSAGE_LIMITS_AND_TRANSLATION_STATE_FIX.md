# Corrections Limites Messages et État Traductions - 23 Oct 2025

## 🔴 Problème 1 : Limites de Caractères Non Respectées

### Problème Identifié
Les limites de caractères pour les messages étaient à **4000** au lieu de **2000** comme configuré dans les variables d'environnement.

### Fichiers Corrigés

#### 1. `gateway/src/services/MessageService.ts` (ligne 113-119)
**AVANT**:
```typescript
if (request.content && request.content.length > 4000) {
  errors.push({
    field: 'content',
    message: 'Message content cannot exceed 4000 characters',
    code: 'CONTENT_TOO_LONG'
  });
}
```

**APRÈS**:
```typescript
if (request.content && request.content.length > 2000) {
  errors.push({
    field: 'content',
    message: 'Message content cannot exceed 2000 characters',
    code: 'CONTENT_TOO_LONG'
  });
}
```

#### 2. `gateway/src/services/MessagingService.ts` (ligne 212-218)
**AVANT**:
```typescript
if (request.content && request.content.length > 4000) {
  errors.push({
    field: 'content',
    message: 'Message content cannot exceed 4000 characters',
    code: 'CONTENT_TOO_LONG'
  });
}
```

**APRÈS**:
```typescript
if (request.content && request.content.length > 2000) {
  errors.push({
    field: 'content',
    message: 'Message content cannot exceed 2000 characters',
    code: 'CONTENT_TOO_LONG'
  });
}
```

#### 3. `gateway/src/services/MessagingService.ts` (ligne 461)
**AVANT**:
```typescript
restrictions: {
  maxContentLength: 4000,
  maxAttachments: 100,
  allowedAttachmentTypes: ['image', 'file', 'audio', 'video'],
  rateLimitRemaining: 100
}
```

**APRÈS**:
```typescript
restrictions: {
  maxContentLength: 2000,
  maxAttachments: 100,
  allowedAttachmentTypes: ['image', 'file', 'audio', 'video'],
  rateLimitRemaining: 100
}
```

---

## 🔴 Problème 2 : Contenu Non Mis à Jour Après Sélection de Traduction

### Problème Identifié
Quand on sélectionne une traduction disponible dans `LanguageSelectionMessageView`, le contenu du message dans la vue normale (`BubbleMessage`) n'est pas mis à jour.

### Analyse du Flux de Données

```
User clicks traduction
       ↓
LanguageSelectionMessageView.handleLanguageSelect(lang)
       ↓
onSelectLanguage(lang) → BubbleMessage.handleLanguageSelect
       ↓
onLanguageSwitch(messageId, lang) → Parent (bubble-stream-page)
       ↓
❌ Parent ne met pas à jour currentDisplayLanguage
       ↓
BubbleMessage ne reçoit pas la nouvelle prop
       ↓
Contenu reste inchangé
```

### Solution Requise

Le composant parent qui utilise `BubbleMessage` ou `bubble-message` doit :

1. **Maintenir un state** pour tracker la langue affichée pour chaque message
2. **Mettre à jour ce state** quand `onLanguageSwitch` est appelé
3. **Passer la langue mise à jour** via la prop `currentDisplayLanguage`

#### Exemple de Solution (dans le Parent)

```typescript
// État pour tracker la langue de chaque message
const [messageLanguages, setMessageLanguages] = useState<Map<string, string>>(new Map());

// Handler pour changer la langue d'un message
const handleLanguageSwitch = useCallback((messageId: string, language: string) => {
  setMessageLanguages(prev => {
    const newMap = new Map(prev);
    newMap.set(messageId, language);
    return newMap;
  });
  
  console.log(`[PARENT] Language switched for message ${messageId}: ${language}`);
}, []);

// Déterminer la langue d'affichage pour un message
const getDisplayLanguage = useCallback((message: Message) => {
  // Langue sélectionnée manuellement pour ce message
  const selectedLang = messageLanguages.get(message.id);
  if (selectedLang) return selectedLang;
  
  // Sinon, utiliser la langue de l'utilisateur
  return userLanguage;
}, [messageLanguages, userLanguage]);

// Dans le rendu
<BubbleMessage
  message={message}
  currentDisplayLanguage={getDisplayLanguage(message)}
  onLanguageSwitch={handleLanguageSwitch}
  {...otherProps}
/>
```

### Fichiers à Modifier

#### Option 1 : Modifier le Parent (Recommandé)
- `frontend/components/common/bubble-stream-page.tsx` (ou le composant qui rend les messages)
- Ajouter le state `messageLanguages` comme montré ci-dessus
- Implémenter `handleLanguageSwitch` pour mettre à jour le state
- Passer `currentDisplayLanguage` dynamiquement

#### Option 2 : Ajouter un State Local dans BubbleMessage (Rapide mais moins propre)
- `frontend/components/common/bubble-message.tsx`
- Ajouter un state local `[localDisplayLanguage, setLocalDisplayLanguage]`
- Utiliser `localDisplayLanguage || currentDisplayLanguage`
- Mettre à jour `setLocalDisplayLanguage` dans `handleLanguageSwitch`

**Code pour Option 2** :
```typescript
// Ajouter au début du composant
const [localDisplayLanguage, setLocalDisplayLanguage] = useState<string | null>(null);

// Modifier handleLanguageSwitch
const handleLanguageSwitch = (langCode: string) => {
  console.log(`📊 [BUBBLE-MESSAGE] Switching to language: ${langCode}`);
  setLocalDisplayLanguage(langCode); // ✅ Mise à jour locale
  handlePopoverOpenChange(false);
  onLanguageSwitch?.(message.id, langCode); // Notifier le parent aussi
};

// Utiliser la langue locale si définie, sinon la prop
const effectiveDisplayLanguage = localDisplayLanguage || currentDisplayLanguage;

// Utiliser effectiveDisplayLanguage partout au lieu de currentDisplayLanguage
```

---

## ✅ Tests de Validation

### Test 1 : Limites de Caractères
1. Ouvrir la route `/chat` ou `/conversations`
2. Essayer d'envoyer un message de 2001+ caractères
3. **Résultat attendu** : Erreur "Message content cannot exceed 2000 characters"
4. Envoyer un message de 2000 caractères exactement
5. **Résultat attendu** : Message envoyé avec succès

### Test 2 : Sélection de Traduction
1. Ouvrir un message avec plusieurs traductions disponibles
2. Cliquer sur l'icône de traduction pour ouvrir le popover/vue
3. Cliquer sur une traduction (ex: English)
4. **Résultat attendu** : Le contenu du message s'affiche en anglais
5. Cliquer à nouveau et sélectionner une autre langue (ex: Spanish)
6. **Résultat attendu** : Le contenu du message s'affiche en espagnol
7. Cliquer sur "Show original"
8. **Résultat attendu** : Le contenu du message revient à la langue d'origine

---

## 📊 Résumé des Changements

| Fichier | Ligne | Avant | Après | Impact |
|---------|-------|-------|-------|--------|
| `MessageService.ts` | 113 | `> 4000` | `> 2000` | ✅ Limite messages |
| `MessagingService.ts` | 212 | `> 4000` | `> 2000` | ✅ Limite messages |
| `MessagingService.ts` | 461 | `maxContentLength: 4000` | `maxContentLength: 2000` | ✅ Restrictions API |
| Parent Component | N/A | Pas de state | State `messageLanguages` | ⏳ À implémenter |

---

## 🚀 Prochaines Étapes

1. ✅ **Limites de caractères** : Corrigées dans le Gateway
2. ⏳ **État des traductions** : Nécessite modification du composant parent
3. 🔄 **Rebuild** : Recompiler le Gateway avec les nouvelles limites
4. 🧪 **Tests** : Valider les deux corrections

---

**Date** : 23 Octobre 2025  
**Statut Limite** : ✅ Corrigé (limites à 2000)  
**Statut Traduction** : ⏳ Solution fournie, implémentation requise
