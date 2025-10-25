# Harmonisation du changement de langue - Header et Settings

**Date** : 25 octobre 2025  
**Problème résolu** : Le changement de langue dans le Header ne rechargeait pas la page

---

## 🎯 Problème identifié

### Comportement incohérent

**Settings (`/settings#theme`)** :
- ✅ Change la langue via `setInterfaceLanguage(languageCode)`
- ✅ Recharge la page après 500ms pour appliquer les traductions
- ✅ Met à jour `localStorage['meeshy-language'].currentInterfaceLanguage`

**Header (tous les emplacements)** :
- ✅ Change la langue via `setInterfaceLanguage(languageCode)`
- ❌ **NE RECHARGE PAS** la page
- ✅ Met à jour `localStorage['meeshy-language'].currentInterfaceLanguage`
- ❌ **Résultat** : L'interface ne change pas visuellement

---

## ✅ Solution appliquée

### Modification du composant Header

**Fichier** : `frontend/components/layout/Header.tsx`

#### 1. Ajout de la fonction `handleLanguageChange`

```typescript
const handleLanguageChange = (languageCode: string) => {
  console.log('🔄 [Header] Changing language to:', languageCode);
  setInterfaceLanguage(languageCode);
  
  // Recharger la page pour appliquer les changements de langue
  setTimeout(() => {
    console.log('🔄 [Header] Reloading page...');
    window.location.reload();
  }, 500);
};
```

#### 2. Remplacement de tous les appels directs

**Avant** :
```tsx
<LanguageFlagSelector
  value={currentInterfaceLanguage}
  onValueChange={setInterfaceLanguage} // ❌ Pas de rechargement
  interfaceOnly={true}
/>
```

**Après** :
```tsx
<LanguageFlagSelector
  value={currentInterfaceLanguage}
  onValueChange={handleLanguageChange} // ✅ Avec rechargement
  interfaceOnly={true}
/>
```

#### 3. Emplacements modifiés (6 occurrences)

1. **Desktop - Menu utilisateur connecté** (dropdown)
2. **Desktop - Mode landing** (page d'accueil)
3. **Desktop - Mode default** (utilisateurs non connectés)
4. **Mobile - Utilisateurs anonymes** (menu burger)
5. **Mobile - Mode landing** (menu burger)
6. **Mobile - Mode default** (menu burger)

---

## 🧪 Tests effectués

### Test 1 : Changement depuis Header (Desktop)
1. Ouvrir http://localhost:3100 (non connecté)
2. Cliquer sur le sélecteur de langue (drapeau)
3. Sélectionner "Français"
4. **Résultat** : 
   - ✅ Console : `🔄 [Header] Changing language to: fr`
   - ✅ Console : `🔄 [Header] Reloading page...`
   - ✅ Page rechargée en français

### Test 2 : Changement depuis Header (Mobile)
1. Ouvrir http://localhost:3100 sur mobile (ou réduire la fenêtre)
2. Ouvrir le menu burger
3. Sélectionner "English" dans le sélecteur de langue
4. **Résultat** : 
   - ✅ Page rechargée en anglais

### Test 3 : Changement depuis Settings
1. Aller sur http://localhost:3100/settings#theme
2. Changer la langue de "Français" à "English"
3. **Résultat** : 
   - ✅ Console : `🔄 [ThemeSettings] Changing language to: en`
   - ✅ Page rechargée en anglais
   - ✅ Comportement identique au Header

### Test 4 : Persistance localStorage
Après chaque changement :
```javascript
JSON.parse(localStorage.getItem('meeshy-language'))
// Résultat attendu :
{
  "state": {
    "currentInterfaceLanguage": "en", // ou "fr"
    "currentMessageLanguage": "en",
    "userLanguageConfig": {...}
  },
  "version": 1
}
```

---

## 📊 Comportement unifié

| Source du changement | Store Zustand | Rechargement | localStorage |
|---------------------|---------------|--------------|--------------|
| Header Desktop | ✅ | ✅ | ✅ |
| Header Mobile | ✅ | ✅ | ✅ |
| Settings Page | ✅ | ✅ | ✅ |

---

## 🎯 Prochaines étapes

**Pour les utilisateurs connectés** :
1. ✅ Harmonisation Header ↔ Settings : **TERMINÉ**
2. 🔄 Synchronisation avec backend (`User.systemLanguage`) : **À FAIRE**
   - Créer endpoint : `PUT /api/users/preferences`
   - Mettre à jour `UserPreference` avec clé `systemLanguage`
   - Charger la langue depuis le backend au login

**Structure recommandée pour UserPreference** :
```typescript
// Exemple de préférences utilisateur à stocker
{
  key: "systemLanguage",
  value: "fr",
  valueType: "string",
  description: "Langue d'interface préférée de l'utilisateur"
}
```

---

## 📝 Fichiers modifiés

1. ✅ `frontend/components/layout/Header.tsx`
   - Ajout de `handleLanguageChange()`
   - Remplacement de 6 occurrences de `setInterfaceLanguage` par `handleLanguageChange`

---

**Status** : ✅ Harmonisation complète - Header et Settings ont le même comportement
