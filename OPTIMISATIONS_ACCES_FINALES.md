# Optimisations de la logique d'accès - Implémentation finale

## Résumé des optimisations implémentées

### 1. ✅ Vérification du préfixe `mshy_` pour les identifiants

**Problème identifié** : Les identifiants reçus par la gateway débutent par `mshy_` et il faut vérifier ce préfixe.

**Solution implémentée** :
```typescript
// Vérifier le préfixe mshy_ pour les identifiants de conversation
if (conversationIdentifier.startsWith('mshy_')) {
  // Identifiant avec préfixe mshy_ - résoudre l'ID réel
  const conversation = await prisma.conversation.findFirst({
    where: {
      OR: [
        { id: conversationId },
        { identifier: conversationIdentifier }
      ]
    }
  });
  
  if (!conversation) {
    return false;
  } else {
    // Vérifier l'appartenance à la conversation
    const membership = await prisma.conversationMember.findFirst({
      where: {
        conversationId: conversation.id,
        userId: authContext.userId,
        isActive: true
      }
    });
    return !!membership;
  }
}
```

### 2. ✅ Amélioration de l'authentification anonyme

**Problème identifié** : Le `userId` des participants anonymes est l'ID d'`anonymousParticipant`, et le middleware auth doit vérifier si la session est toujours active.

**Solution implémentée** :
- **Middleware d'authentification** : Retourne l'ID du participant anonyme comme `userId`
- **Vérification d'activité** : Le middleware vérifie automatiquement si la session est active
- **Récupération optimisée** : Utilise `id: userId` au lieu de `sessionToken: userId`

```typescript
// Middleware auth.ts
userId: anonymousParticipant.id, // Utiliser l'ID du participant anonyme

// Routes conversations.ts
const anonymousAccess = await prisma.anonymousParticipant.findFirst({
  where: {
    id: authContext.userId, // userId est l'ID du participant anonyme
    isActive: true,
    conversationId: conversationId
  }
});
```

### 3. ✅ Ajout des participants anonymes dans la récupération des conversations

**Problème identifié** : Il faut ajouter les participants anonymes lorsqu'on remonte les conversations.

**Solution implémentée** :
```typescript
// Dans la récupération des conversations
include: {
  members: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          isOnline: true,
          lastSeen: true
        }
      }
    }
  },
  anonymousParticipants: {
    where: {
      isActive: true
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      isOnline: true,
      lastSeenAt: true,
      joinedAt: true
    }
  },
  // ... autres includes
}
```

### 4. ✅ Correction de l'accès pour les utilisateurs non authentifiés

**Problème identifié** : Si l'utilisateur n'est pas authentifié (pas de session token, pas de JWT token), il ne doit pas pouvoir accéder à aucune conversation.

**Solution implémentée** :
```typescript
async function canAccessConversation(
  prisma: any,
  authContext: any,
  conversationId: string,
  conversationIdentifier: string
): Promise<boolean> {
  // Si l'utilisateur n'est pas authentifié (pas de session token, pas de JWT token), aucun accès
  if (!authContext.isAuthenticated) {
    return false;
  }
  
  // ... reste de la logique
}
```

## Fonction utilitaire centralisée

### `canAccessConversation()`

Une fonction utilitaire centralisée qui gère toute la logique d'accès :

```typescript
async function canAccessConversation(
  prisma: any,
  authContext: any,
  conversationId: string,
  conversationIdentifier: string
): Promise<boolean> {
  // Si l'utilisateur n'est pas authentifié, aucun accès
  if (!authContext.isAuthenticated) {
    return false;
  }
  
  if (authContext.isAnonymous) {
    // Utilisateurs anonymes authentifiés : vérifier l'accès via liens d'invitation
    const anonymousAccess = await prisma.anonymousParticipant.findFirst({
      where: {
        id: authContext.userId,
        isActive: true,
        conversationId: conversationId
      }
    });
    return !!anonymousAccess;
  } else {
    // Vérifier le préfixe mshy_ pour les identifiants de conversation
    if (conversationIdentifier.startsWith('mshy_')) {
      // Identifiant avec préfixe mshy_ - résoudre l'ID réel
      const conversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { id: conversationId },
            { identifier: conversationIdentifier }
          ]
        }
      });
      
      if (!conversation) {
        return false;
      } else {
        // Vérifier l'appartenance à la conversation
        const membership = await prisma.conversationMember.findFirst({
          where: {
            conversationId: conversation.id,
            userId: authContext.userId,
            isActive: true
          }
        });
        return !!membership;
      }
    } else {
      // Identifiant direct - vérifier l'appartenance à la conversation
      const membership = await prisma.conversationMember.findFirst({
        where: {
          conversationId: conversationId,
          userId: authContext.userId,
          isActive: true
        }
      });
      return !!membership;
    }
  }
}
```

## Règles d'accès finales

### Utilisateurs non authentifiés
- **Aucun accès** : Pas d'accès à aucune conversation
- **Code de retour** : 403 Forbidden
- **Message** : "Authentification requise" ou "Accès non autorisé à cette conversation"

### Utilisateurs anonymes authentifiés
- **Accès** : Uniquement aux conversations pour lesquelles ils ont reçu un lien d'invitation
- **Vérification** : Via `anonymousParticipant` avec `id: userId` et `conversationId`
- **Droits d'écriture** : Déterminés par les permissions du participant anonyme

### Utilisateurs connectés (JWT)
- **Accès** : Uniquement aux conversations dont ils sont membres
- **Vérification** : Via `conversationMember` avec `userId` et `conversationId`
- **Préfixe mshy_** : Support complet pour les identifiants avec préfixe `mshy_`

## Tests de validation

### Scripts de test créés
1. **`test-simple-access.sh`** : Test de la logique d'accès simplifiée
2. **`test-unauthenticated-access.sh`** : Test spécifique pour les utilisateurs non authentifiés

### Résultats des tests
- ✅ Utilisateurs non authentifiés → Accès refusé (403) pour toutes les conversations
- ✅ Utilisateurs connectés non-membres → Accès refusé (403) pour les conversations dont ils ne sont pas membres
- ✅ Utilisateurs anonymes → Accès uniquement via liens d'invitation
- ✅ Support du préfixe `mshy_` → Résolution correcte des identifiants

## Fichiers modifiés

### Middleware d'authentification
- `gateway/src/middleware/auth.ts` : Correction du `userId` pour les utilisateurs anonymes

### Routes de conversations
- `gateway/src/routes/conversations.ts` : 
  - Fonction utilitaire `canAccessConversation()`
  - Remplacement de toute la logique d'accès par l'utilisation de cette fonction
  - Ajout des participants anonymes dans les récupérations
  - Correction des codes de retour (403 au lieu de 404 pour les accès non autorisés)

### Scripts de test
- `scripts/development/test-simple-access.sh` : Test de la logique d'accès
- `scripts/development/test-unauthenticated-access.sh` : Test des utilisateurs non authentifiés

## Avantages des optimisations

1. **Sécurité renforcée** : Aucun accès pour les utilisateurs non authentifiés
2. **Logique centralisée** : Une seule fonction pour gérer tous les accès
3. **Support complet** : Préfixe `mshy_`, participants anonymes, vérifications d'activité
4. **Performance optimisée** : Requêtes Prisma optimisées
5. **Maintenabilité** : Code plus simple et cohérent
6. **Tests complets** : Validation de tous les scénarios

## Résultat final

La logique d'accès est maintenant :
- **Sécurisée** : Seuls les utilisateurs authentifiés peuvent accéder aux conversations
- **Simple** : Une seule règle claire et compréhensible
- **Complète** : Support de tous les types d'utilisateurs et d'identifiants
- **Testée** : Validation complète avec des scripts de test

**Règle appliquée : Seuls les utilisateurs faisant partie de la conversation peuvent y accéder. Rien de plus !**

