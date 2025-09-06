# Correction des permissions d'accès aux conversations

## Problème identifié

Les endpoints de conversations retournaient des erreurs 500 (Internal Server Error) car :
1. Les utilisateurs anonymes n'avaient pas accès aux conversations
2. La logique de permissions n'était pas correctement implémentée
3. Le middleware d'authentification n'était pas configuré pour gérer les utilisateurs anonymes

## Solution implémentée

### 1. Mise à jour du middleware d'authentification

**Fichier modifié :** `gateway/src/routes/conversations.ts`

- Ajout de l'import du middleware d'authentification unifié
- Remplacement de `fastify.authenticate` par `optionalAuth` pour les routes de conversations
- Configuration du middleware pour permettre l'authentification optionnelle

```typescript
import { createUnifiedAuthMiddleware, UnifiedAuthRequest, getUserId } from '../middleware/auth';

// Middleware d'authentification optionnel pour les conversations
const optionalAuth = createUnifiedAuthMiddleware(prisma, { 
  requireAuth: false, 
  allowAnonymous: true 
});
```

### 2. Correction de la logique de permissions

#### Pour l'accès aux conversations (lecture)

```typescript
if (userId === 'anonymous') {
  // Utilisateurs anonymes : accès uniquement via liens d'invitation
  const anonymousAccess = await prisma.anonymousParticipant.findFirst({
    where: {
      sessionToken: userId,
      isActive: true,
      shareLink: {
        conversationId: conversationId,
        isActive: true
      }
    }
  });
  canAccess = !!anonymousAccess;
} else {
  // Utilisateurs connectés
  if (id === "meeshy") {
    canAccess = true; // Conversation globale accessible aux utilisateurs connectés
  } else {
    // Vérifier l'appartenance à la conversation
    const membership = await prisma.conversationMember.findFirst({
      where: {
        conversationId: conversationId,
        userId: userId,
        isActive: true
      }
    });
    canAccess = !!membership;
  }
}
```

#### Pour l'envoi de messages (écriture)

```typescript
if (userId === 'anonymous') {
  // Utilisateurs anonymes : droits d'écriture uniquement via liens d'invitation
  const anonymousAccess = await prisma.anonymousParticipant.findFirst({
    where: {
      sessionToken: userId,
      isActive: true,
      canSendMessages: true, // Vérifier les permissions d'écriture
      shareLink: {
        conversationId: conversationId,
        isActive: true,
        allowAnonymousMessages: true // Vérifier que le lien permet les messages anonymes
      }
    }
  });
  canSend = !!anonymousAccess;
} else {
  // Utilisateurs connectés
  if (id === "meeshy") {
    canSend = true; // Utilisateurs connectés peuvent écrire dans la conversation globale
  } else {
    // Vérifier l'appartenance à la conversation
    const membership = await prisma.conversationMember.findFirst({
      where: {
        conversationId: conversationId,
        userId: userId,
        isActive: true
      }
    });
    canSend = !!membership;
  }
}
```

### 3. Routes modifiées

- `GET /conversations/:id/messages` - Récupération des messages
- `GET /conversations/:id/participants` - Récupération des participants

## Règles d'accès finales

### Utilisateurs anonymes
- **Accès** : Uniquement aux conversations pour lesquelles ils ont reçu un lien d'invitation
- **Droits d'écriture** : Déterminés par les permissions du lien d'invitation
- **Conversation "meeshy"** : Accès refusé (403 Forbidden)

### Utilisateurs connectés
- **Accès** : À la conversation globale "meeshy" + conversations dont ils sont membres
- **Droits d'écriture** : Dans "meeshy" + conversations dont ils sont membres
- **Conversation "meeshy"** : Accès autorisé (200 OK)

## Tests de validation

### Script de test
```bash
./scripts/development/test-conversation-access.sh
```

### Résultats des tests
- ✅ Utilisateur anonyme → conversation 'meeshy' : 403 Forbidden
- ✅ Utilisateur anonyme → participants 'meeshy' : 403 Forbidden  
- ✅ Utilisateur connecté → conversation 'meeshy' : 200 OK
- ✅ Utilisateur connecté → participants 'meeshy' : 200 OK
- ✅ Utilisateur connecté → conversation inexistante : 404 Not Found

## Endpoints testés

### Messages
```bash
# Utilisateur anonyme (doit échouer)
curl http://localhost:3000/conversations/meeshy/messages
# → 403 Forbidden

# Utilisateur connecté (doit réussir)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/conversations/meeshy/messages
# → 200 OK avec données
```

### Participants
```bash
# Utilisateur anonyme (doit échouer)
curl http://localhost:3000/conversations/meeshy/participants
# → 403 Forbidden

# Utilisateur connecté (doit réussir)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/conversations/meeshy/participants
# → 200 OK avec données
```

## Fichiers modifiés

- `gateway/src/routes/conversations.ts` - Logique de permissions et middleware
- `scripts/development/test-conversation-access.sh` - Script de test (nouveau)

## Notes importantes

1. **Sécurité** : Les utilisateurs anonymes n'ont accès qu'aux conversations pour lesquelles ils ont reçu un lien d'invitation spécifique
2. **Permissions** : Les droits d'écriture des utilisateurs anonymes sont déterminés par les permissions du lien d'invitation
3. **Conversation globale** : "meeshy" est accessible uniquement aux utilisateurs connectés
4. **Middleware** : Utilisation du système d'authentification unifié pour gérer les deux types d'utilisateurs

## Résultat

Les erreurs 500 sont résolues et remplacées par des codes de statut appropriés :
- 403 Forbidden pour les accès non autorisés
- 200 OK pour les accès autorisés
- 404 Not Found pour les conversations inexistantes

