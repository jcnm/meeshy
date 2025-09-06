# Architecture d'Authentification Réorganisée 🔄

## 📋 Nouvelle Structure

### 🎯 **Services d'Authentification**

#### `/services/auth.service.ts` - **Service Métier Principal**
- **Classe :** `PrismaAuthService`
- **Rôle :** Gestion complète des utilisateurs (login, register, JWT)
- **Fonctionnalités :**
  - `authenticate(credentials)` - Login username/password
  - `register(data)` - Création de compte
  - `generateToken(user)` - Génération JWT
  - `getUserById(id)` - Récupération utilisateur
  - `getUserPermissions(user)` - Permissions par rôle

#### `/services/auth-test.service.ts` - **Service de Test**
- **Classe :** `AuthService` (pour tests uniquement)
- **Rôle :** Comptes de test pour développement
- **Fonctionnalités :**
  - Utilisateurs de test statiques
  - JWT simulés pour développement
  - Validation basique des tokens

#### `/middleware/auth.ts` - **Middleware d'Authentification**
- **Classe :** `AuthMiddleware`
- **Rôle :** Validation des requêtes et contexte unifié
- **Fonctionnalités :**
  - `createAuthContext()` - Contexte unifié JWT/Session/Anonyme
  - `createUnifiedAuthMiddleware()` - Middleware Fastify
  - Helpers utilitaires (`isRegisteredUser`, `getUserPermissions`, etc.)

## 🔄 **Flux d'Utilisation**

### 1. Routes d'Authentification (Service Métier)
```typescript
// POST /login - Utilise auth.service.ts
import { PrismaAuthService } from '../services/auth.service';

const authService = new PrismaAuthService(prisma, jwtSecret);
const user = await authService.authenticate(credentials);
const token = authService.generateToken(user);
```

### 2. Middleware de Requêtes (Middleware)
```typescript
// Toutes les routes - Utilise middleware/auth.ts
import { createUnifiedAuthMiddleware } from '../middleware/auth';

const authMiddleware = createUnifiedAuthMiddleware(prisma, options);
// Détection automatique JWT/Session/Anonymous
```

### 3. Tests de Développement (Service de Test)
```typescript
// Mode développement - Utilise auth-test.service.ts
import { AuthService } from '../services/auth-test.service';

const user = AuthService.getUserByUsername('alice_fr');
const token = AuthService.generateToken(user);
```

## 📊 **Responsabilités Claires**

| Composant | Responsabilité | Usage |
|-----------|----------------|-------|
| **`auth.service.ts`** | Métier & CRUD utilisateurs | Routes login/register |
| **`auth-test.service.ts`** | Tests & développement | Mode développement |
| **`middleware/auth.ts`** | Validation & contexte | Toutes les requêtes |

## 🎯 **Types d'Authentification Supportés**

### Service Métier (`auth.service.ts`)
- ✅ **Utilisateurs enregistrés** uniquement
- ✅ Login/Register avec base de données
- ✅ Génération/validation JWT réels

### Middleware (`middleware/auth.ts`)
- ✅ **Utilisateurs enregistrés** (JWT tokens)
- ✅ **Utilisateurs anonymes** (Session tokens)
- ✅ **Non authentifiés** (aucun token)
- ✅ Contexte unifié pour tous les types

### Service de Test (`auth-test.service.ts`)
- ✅ **Utilisateurs de test** statiques
- ✅ JWT simulés pour développement
- ✅ Comptes prédéfinis (alice_fr, bob_en, carlos_es, etc.)

## 🔧 **Configuration**

### Import dans le Serveur
```typescript
// Middleware principal
import { AuthMiddleware, createUnifiedAuthMiddleware } from './middleware/auth';

// Service métier pour les routes d'auth
import { PrismaAuthService } from './services/auth.service';

// Service de test (si nécessaire)
import { AuthService as TestAuthService } from './services/auth-test.service';
```

### Utilisation dans les Routes
```typescript
// Routes d'authentification
const authService = new PrismaAuthService(prisma, jwtSecret);

// Middleware sur toutes les routes
const authMiddleware = createUnifiedAuthMiddleware(prisma, {
  requireAuth: false,
  allowAnonymous: true
});
```

## ✅ **Avantages de cette Architecture**

1. **Séparation claire des responsabilités**
2. **Noms explicites et logiques**
3. **Service métier dédié pour les opérations utilisateur**
4. **Middleware dédié pour la validation des requêtes**
5. **Service de test isolé pour le développement**
6. **Architecture scalable et maintenable**

## 🚀 **Migration Effectuée**

- ✅ `prisma-auth.service.ts` → `auth.service.ts`
- ✅ `auth.service.ts` (tests) → `auth-test.service.ts`  
- ✅ `AuthService` (middleware) → `AuthMiddleware`
- ✅ Toutes les références mises à jour
- ✅ Pas d'erreurs de compilation

L'architecture est maintenant claire, logique et scalable ! 🎉
