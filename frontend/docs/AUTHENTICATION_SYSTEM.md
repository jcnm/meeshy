# Système d'Authentification Meeshy

## Vue d'ensemble

Le système d'authentification de Meeshy a été refactorisé pour offrir une gestion claire et précise de l'état de connexion. Il gère à la fois les utilisateurs authentifiés et les sessions anonymes.

## Architecture

### Composants principaux

1. **`/utils/auth.ts`** - Fonctions utilitaires pour la gestion de l'authentification
2. **`/hooks/use-auth.ts`** - Hook principal pour gérer l'état d'authentification
3. **`/components/auth/auth-guard.tsx`** - Composant de protection des routes
4. **`/components/auth/auth-provider.tsx`** - Provider du contexte d'authentification

### Types d'authentification

- **Authentification normale** : Utilisateurs avec compte permanent
- **Session anonyme** : Utilisateurs temporaires pour les conversations partagées

## Routes et protection

### Routes publiques (pas de vérification)
- `/` - Page d'accueil
- `/login` - Page de connexion
- `/register` - Page d'inscription

### Routes de jointure (accessibles à tous)
- `/join/:linkId` - Page pour rejoindre une conversation

### Routes protégées (authentification requise)
- `/chat/:linkId` - Chat partagé (accepte sessions anonymes)
- Toutes les autres routes nécessitent une authentification complète

## Utilisation

### Hook useAuth

```typescript
import { useAuth } from '@/hooks/use-auth';

function MyComponent() {
  const { 
    isAuthenticated, 
    user, 
    token, 
    isChecking, 
    isAnonymous,
    login, 
    logout, 
    joinAnonymously, 
    leaveAnonymousSession 
  } = useAuth();

  // Utilisation...
}
```

### Protection des routes

```typescript
import { AuthGuard } from '@/components/auth/auth-guard';

function ProtectedPage() {
  return (
    <AuthGuard requireAuth={true} allowAnonymous={false}>
      <div>Contenu protégé</div>
    </AuthGuard>
  );
}
```

### Vérification manuelle

```typescript
import { checkAuthStatus, clearAllAuthData } from '@/utils/auth';

// Vérifier l'état d'authentification
const authState = await checkAuthStatus();

// Nettoyer toutes les données
clearAllAuthData();
```

## Gestion des sessions

### Session normale
- Token stocké dans `localStorage.auth_token`
- Données utilisateur dans `localStorage.user`
- Vérification automatique de validité

### Session anonyme
- Token stocké dans `localStorage.anonymous_session_token`
- Données participant dans `localStorage.anonymous_participant`
- Vérification automatique de validité

## Sécurité

### Nettoyage automatique
- Invalid tokens are automatically removed
- Redirection vers la page d'authentification appropriée
- Nettoyage de toutes les données en cas d'erreur

### Vérifications
- Validation côté serveur de tous les tokens
- Vérification de l'expiration des sessions
- Nettoyage des données incohérentes

## Flux d'authentification

### Connexion normale
1. Utilisateur se connecte via `/login`
2. Token stocké dans localStorage
3. Vérification automatique de validité
4. Accès aux routes protégées

### Session anonyme
1. Utilisateur rejoint via `/join/:linkId`
2. Session token généré
3. Accès limité aux conversations partagées
4. Possibilité de créer un compte permanent

### Déconnexion
1. Nettoyage de toutes les données
2. Redirection vers la page d'accueil
3. Suppression des tokens côté serveur

## Gestion des erreurs

### Token invalide
- Nettoyage automatique des données
- Redirection vers la page de connexion
- Message d'erreur approprié

### Erreur réseau
- Nettoyage des données locales
- Redirection vers la page de connexion
- Retry automatique lors de la reconnexion

### Session expirée
- Nettoyage de la session
- Redirection vers la page de jointure (pour les sessions anonymes)
- Redirection vers la page de connexion (pour les sessions normales)

## Bonnes pratiques

1. **Toujours utiliser le hook useAuth** pour accéder à l'état d'authentification
2. **Protéger les routes** avec AuthGuard
3. **Ne pas manipuler directement localStorage** pour l'authentification
4. **Gérer les états de chargement** avec `isChecking`
5. **Utiliser les fonctions utilitaires** pour les opérations d'authentification

## Migration

### Ancien système
- Gestion dispersée dans AppContext
- Vérifications manuelles
- Pas de distinction claire entre types de sessions

### Nouveau système
- Gestion centralisée avec useAuth
- Vérifications automatiques
- Distinction claire entre sessions normales et anonymes
- Protection des routes systématique
