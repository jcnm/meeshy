# Guide de Migration des Types Utilisateur

## 🎯 Objectif
Consolider les types utilisateur pour réduire la redondance de code en utilisant `SocketIOUser` comme type principal.

## 📊 Comparaison des Types

### SocketIOUser (RECOMMANDÉ)
- **Fichier** : `socketio-events.ts`
- **Champs** : 28 champs
- **Usage** : Socket.IO, AuthService, temps réel
- **Permissions** : Optionnelles (`permissions?: UserPermissions`)

### User (DÉPRÉCIÉ)
- **Fichier** : `user.ts`
- **Champs** : 25 champs
- **Usage** : Généraliste
- **Permissions** : Optionnelles (`permissions?: UserPermissions`)

## 🔄 Plan de Migration

### Phase 1 : Marquer User comme déprécié ✅
- [x] Ajouter `@deprecated` à l'interface User
- [x] Créer un alias `UserUnified` vers SocketIOUser
- [x] Ajouter le champ `password?` à SocketIOUser

### Phase 2 : Migration progressive
- [ ] Remplacer les imports `User` par `SocketIOUser`
- [ ] Mettre à jour les composants frontend
- [ ] Mettre à jour les services backend
- [ ] Supprimer l'interface User dépréciée

## 📝 Instructions de Migration

### Pour les nouveaux développements
```typescript
// ✅ RECOMMANDÉ
import { SocketIOUser } from './socketio-events';

// ❌ DÉPRÉCIÉ
import { User } from './user';
```

### Pour la migration existante
```typescript
// ✅ Utiliser l'alias temporaire
import { UserUnified } from './user';

// Ou directement
import { SocketIOUser } from './socketio-events';
```

## 🔍 Différences Clés

| Champ | SocketIOUser | User | Notes |
|-------|--------------|------|-------|
| `password?` | ✅ | ✅ | Ajouté à SocketIOUser |
| `isAnonymous?` | ✅ | ✅ | Identique |
| `isMeeshyer?` | ✅ | ✅ | Identique |
| `permissions` | `?` | `?` | Optionnel dans les deux |

## 🎯 Avantages de SocketIOUser

1. **Plus complet** : 28 champs vs 25
2. **Spécialisé** : Optimisé pour l'architecture temps réel
3. **Utilisé partout** : AuthService, Socket.IO, etc.
4. **Flexible** : Permissions optionnelles
5. **Cohérent** : Aligné avec l'architecture Meeshy

## ⚠️ Points d'Attention

- **Rétrocompatibilité** : L'interface User reste disponible temporairement
- **Permissions** : Vérifier que les permissions sont bien gérées
- **Tests** : Mettre à jour les tests unitaires
- **Documentation** : Mettre à jour la documentation API

## 🚀 Prochaines Étapes

1. Identifier tous les usages de `User` dans le codebase
2. Créer des tickets de migration par module
3. Migrer progressivement sans casser l'existant
4. Supprimer l'interface User une fois la migration terminée
