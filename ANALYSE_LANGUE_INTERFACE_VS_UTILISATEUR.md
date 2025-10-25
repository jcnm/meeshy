# Analyse : Langue d'Interface vs Configuration Utilisateur

**Date** : 25 octobre 2025  
**Contexte** : Comprendre comment la langue d'interface frontend est gérée vs les préférences utilisateur backend

---

## 🎯 Situation actuelle

### 1️⃣ **Utilisateur NON connecté**
**Stockage** : `localStorage` via Zustand persist  
**Clé** : `meeshy-language`  
**Champ** : `currentInterfaceLanguage`

**Gestion** :
- Sélecteur de langue dans le **Header** (composant `Header.tsx`)
- Détection automatique de la langue du navigateur au premier chargement
- Persistance locale uniquement (pas de synchronisation backend)

**Code** :
```typescript
// frontend/stores/language-store.ts
export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      currentInterfaceLanguage: 'en', // Valeur par défaut
      setInterfaceLanguage: (language: string) => {
        set({ currentInterfaceLanguage: language });
      },
      // ...
    }),
    {
      name: 'meeshy-language', // localStorage key
      version: 1,
    }
  )
);
```

**Comportement** :
- ✅ La langue change immédiatement dans le Header
- ✅ Persiste après rechargement de page
- ❌ **Non synchronisé** avec les préférences backend

---

### 2️⃣ **Utilisateur CONNECTÉ**
**Stockage backend** : Base de données PostgreSQL  
**Table** : `User`  
**Champs pertinents** :
```typescript
interface SocketIOUser {
  systemLanguage: string;              // Langue principale (ex: "fr")
  regionalLanguage: string;            // Langue régionale (ex: "fr")
  customDestinationLanguage?: string;  // Langue personnalisée optionnelle
  autoTranslateEnabled: boolean;       // Active/désactive la traduction auto
  translateToSystemLanguage: boolean;  // Traduire vers systemLanguage
  translateToRegionalLanguage: boolean; // Traduire vers regionalLanguage
  useCustomDestination: boolean;       // Utiliser customDestinationLanguage
}
```

**Gestion actuelle** :
- Sélecteur dans `/settings#theme` (composant `ThemeSettings.tsx`)
- **PROBLÈME** : Le changement de langue dans les settings modifie **UNIQUEMENT** `localStorage` (Zustand)
- **MANQUE** : Aucun appel API pour mettre à jour `user.systemLanguage` en base de données

**Code actuel** :
```typescript
// frontend/components/settings/theme-settings.tsx
const handleInterfaceLanguageChange = (languageCode: string) => {
  console.log('🔄 [ThemeSettings] Changing language to:', languageCode);
  setInterfaceLanguage(languageCode); // ✅ Met à jour Zustand localStorage
  toast.success(t('theme.interfaceLanguageUpdated'));
  
  // ❌ MANQUE : Appel API pour synchroniser avec backend
  // await updateUserLanguagePreferences({ systemLanguage: languageCode });
  
  setTimeout(() => {
    window.location.reload();
  }, 500);
};
```

---

## 🔍 Problème identifié

### Pour les utilisateurs connectés :

1. **Stockage dupliqué** :
   - Frontend : `localStorage['meeshy-language'].currentInterfaceLanguage`
   - Backend : `User.systemLanguage` en base de données

2. **Désynchronisation** :
   - Changement dans `/settings#theme` → met à jour localStorage
   - **MAIS** ne met PAS à jour `User.systemLanguage` en base de données
   - Résultat : La préférence n'est pas sauvegardée côté serveur

3. **Incohérence** :
   - Si l'utilisateur se connecte depuis un autre appareil → il n'a pas sa langue préférée
   - Les traductions de messages utilisent `User.systemLanguage` (backend) et non `currentInterfaceLanguage` (frontend)

---

## ✅ Solution recommandée

### Stratégie de synchronisation

#### Pour utilisateurs NON connectés :
- ✅ Garder le système actuel (localStorage uniquement)
- ✅ Sélecteur dans Header
- ✅ Détection automatique navigateur

#### Pour utilisateurs CONNECTÉS :
1. **Au chargement de la page** :
   - Récupérer `user.systemLanguage` depuis le backend (via AuthStore)
   - Synchroniser avec `currentInterfaceLanguage` dans le store Zustand
   - Priorité : Backend > localStorage

2. **Au changement de langue** :
   - Mettre à jour `localStorage` (Zustand)
   - **Appeler API** pour mettre à jour `User.systemLanguage` en base de données
   - Recharger la page pour appliquer les changements

---

## 🔧 Modifications nécessaires

### 1. Créer l'endpoint API backend

**Fichier** : `gateway/src/routes/users/preferences.ts` (ou similaire)

```typescript
// PUT /api/users/preferences/language
router.put('/preferences/language', authenticate, async (request, reply) => {
  const { systemLanguage } = request.body;
  const userId = request.user.id;
  
  // Validation
  if (!['en', 'fr'].includes(systemLanguage)) {
    return reply.code(400).send({ error: 'Invalid language' });
  }
  
  // Mise à jour en base de données
  await prisma.user.update({
    where: { id: userId },
    data: { systemLanguage }
  });
  
  return reply.send({ success: true, systemLanguage });
});
```

### 2. Créer le service frontend

**Fichier** : `frontend/services/user-preferences.service.ts`

```typescript
export class UserPreferencesService {
  async updateLanguagePreference(language: string): Promise<ApiResponse<{ systemLanguage: string }>> {
    try {
      const response = await fetch('/api/users/preferences/language', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ systemLanguage: language })
      });
      
      if (!response.ok) throw new Error('Failed to update language');
      
      return await response.json();
    } catch (error) {
      console.error('[UserPreferences] Failed to update language:', error);
      throw error;
    }
  }
}
```

### 3. Modifier le composant ThemeSettings

**Fichier** : `frontend/components/settings/theme-settings.tsx`

```typescript
import { UserPreferencesService } from '@/services/user-preferences.service';

const userPrefsService = new UserPreferencesService();

const handleInterfaceLanguageChange = async (languageCode: string) => {
  console.log('🔄 [ThemeSettings] Changing language to:', languageCode);
  
  // 1. Mettre à jour le store local
  setInterfaceLanguage(languageCode);
  
  // 2. Si utilisateur connecté, synchroniser avec backend
  if (user) {
    try {
      await userPrefsService.updateLanguagePreference(languageCode);
      console.log('✅ [ThemeSettings] Language synced with backend');
    } catch (error) {
      console.error('❌ [ThemeSettings] Failed to sync language:', error);
      toast.error('Failed to save language preference');
      return; // Ne pas recharger si l'API a échoué
    }
  }
  
  toast.success(t('theme.interfaceLanguageUpdated'));
  
  // 3. Recharger pour appliquer
  setTimeout(() => {
    window.location.reload();
  }, 500);
};
```

### 4. Initialiser la langue depuis le backend au login

**Fichier** : `frontend/stores/auth-store.ts`

```typescript
setUser: (user: User | null) => {
  set({
    user,
    isAuthenticated: !!user,
    isAuthChecking: false,
  });
  
  // Synchroniser la langue d'interface avec les préférences utilisateur
  if (user?.systemLanguage) {
    const languageStore = useLanguageStore.getState();
    if (languageStore.currentInterfaceLanguage !== user.systemLanguage) {
      console.log('[AUTH_STORE] Syncing interface language with user preferences:', user.systemLanguage);
      languageStore.setInterfaceLanguage(user.systemLanguage);
    }
  }
},
```

---

## 🧪 Tests à effectuer après implémentation

### Test 1 : Synchronisation au login
1. Créer un utilisateur avec `systemLanguage = "fr"` en base de données
2. Se connecter
3. **Vérifier** : L'interface charge en français automatiquement

### Test 2 : Changement de langue (utilisateur connecté)
1. Se connecter
2. Aller sur `/settings#theme`
3. Changer la langue de "Français" à "English"
4. **Vérifier** : 
   - API appelée : `PUT /api/users/preferences/language`
   - Base de données mise à jour : `User.systemLanguage = "en"`
   - localStorage mis à jour
   - Page rechargée en anglais

### Test 3 : Multi-appareils
1. Se connecter sur appareil A, changer langue en "English"
2. Se connecter sur appareil B
3. **Vérifier** : L'interface charge en anglais automatiquement

### Test 4 : Utilisateur non connecté
1. Ouvrir en navigation privée
2. Changer la langue dans le Header
3. **Vérifier** : 
   - Langue change localement
   - Pas d'appel API (normal)
   - Persist dans localStorage uniquement

---

## 📊 Récapitulatif

| Aspect | État actuel | État souhaité |
|--------|-------------|---------------|
| **Non connecté** | ✅ localStorage uniquement | ✅ Inchangé |
| **Connecté - Frontend** | ✅ localStorage | ✅ localStorage + Backend sync |
| **Connecté - Backend** | ❌ Non synchronisé | ✅ `User.systemLanguage` mis à jour |
| **Multi-appareils** | ❌ Ne fonctionne pas | ✅ Préférence partagée |
| **Endpoint API** | ❌ N'existe pas | ✅ `PUT /api/users/preferences/language` |

---

## 🎯 Prochaines étapes recommandées

1. ✅ **Créer l'endpoint API** dans le Gateway pour mettre à jour `User.systemLanguage`
2. ✅ **Créer le service frontend** pour appeler l'API
3. ✅ **Modifier ThemeSettings** pour synchroniser avec backend si utilisateur connecté
4. ✅ **Initialiser langue** depuis `user.systemLanguage` au login dans AuthStore
5. ✅ **Tester** les 4 scénarios ci-dessus

---

**Status** : 📋 Analyse complète - Prêt pour implémentation
