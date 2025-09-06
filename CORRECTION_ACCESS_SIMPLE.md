# Correction de la logique d'accès simplifiée

## Règle implémentée

**Seuls les utilisateurs faisant partie de la conversation peuvent y accéder. Rien de plus !**

## Logique simplifiée

### Pour l'accès aux conversations (lecture)

```typescript
// Règle simple : seuls les utilisateurs faisant partie de la conversation peuvent y accéder
if (authRequest.authContext.isAnonymous) {
  // Utilisateurs anonymes : vérifier l'accès via liens d'invitation
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
  // Utilisateurs connectés : vérifier l'appartenance à la conversation
  const membership = await prisma.conversationMember.findFirst({
    where: {
      conversationId: conversationId,
      userId: userId,
      isActive: true
    }
  });
  canAccess = !!membership;
}
```

### Pour l'envoi de messages (écriture)

```typescript
// Règle simple : seuls les utilisateurs faisant partie de la conversation peuvent y écrire
if (authRequest.authContext.isAnonymous) {
  // Utilisateurs anonymes : vérifier les droits d'écriture via liens d'invitation
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
  // Utilisateurs connectés : vérifier l'appartenance à la conversation
  const membership = await prisma.conversationMember.findFirst({
    where: {
      conversationId: conversationId,
      userId: userId,
      isActive: true
    }
  });
  canSend = !!membership;
}
```

## Règles d'accès finales

### Utilisateurs anonymes
- **Accès** : Uniquement aux conversations pour lesquelles ils ont reçu un lien d'invitation
- **Droits d'écriture** : Déterminés par les permissions du lien d'invitation
- **Aucune exception** : Même pour la conversation "meeshy"

### Utilisateurs connectés
- **Accès** : Uniquement aux conversations dont ils sont membres
- **Droits d'écriture** : Dans les conversations dont ils sont membres
- **Aucune exception** : Même pour la conversation "meeshy"

## Tests de validation

### Script de test
```bash
./scripts/development/test-simple-access.sh
```

### Résultats des tests
- ✅ Utilisateur anonyme → conversation 'meeshy' : 403 Forbidden
- ✅ Utilisateur anonyme → participants 'meeshy' : 403 Forbidden  
- ✅ Utilisateur connecté → conversation 'meeshy' (sans être membre) : 403 Forbidden
- ✅ Utilisateur connecté → participants 'meeshy' (sans être membre) : 403 Forbidden
- ✅ Utilisateur connecté → conversation inexistante : 404 Not Found

## Endpoints testés

### Messages
```bash
# Utilisateur anonyme (doit échouer)
curl http://localhost:3000/conversations/meeshy/messages
# → 403 Forbidden

# Utilisateur connecté non-membre (doit échouer)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/conversations/meeshy/messages
# → 403 Forbidden
```

### Participants
```bash
# Utilisateur anonyme (doit échouer)
curl http://localhost:3000/conversations/meeshy/participants
# → 403 Forbidden

# Utilisateur connecté non-membre (doit échouer)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/conversations/meeshy/participants
# → 403 Forbidden
```

## Fichiers modifiés

- `gateway/src/routes/conversations.ts` - Logique de permissions simplifiée
- `scripts/development/test-simple-access.sh` - Script de test (nouveau)

## Avantages de cette approche

1. **Simplicité** : Une seule règle claire et compréhensible
2. **Sécurité** : Aucune exception qui pourrait créer des failles
3. **Cohérence** : Même logique pour tous les types d'utilisateurs
4. **Maintenabilité** : Code plus simple à maintenir et déboguer

## Notes importantes

1. **Aucune exception** : Même la conversation "meeshy" suit la même règle
2. **Membres uniquement** : Seuls les utilisateurs qui font partie de la conversation peuvent y accéder
3. **Liens d'invitation** : Les utilisateurs anonymes accèdent via des liens spécifiques
4. **Permissions** : Les droits d'écriture sont déterminés par l'appartenance + permissions du lien

## Résultat

La logique est maintenant simple, claire et sécurisée :
- **403 Forbidden** pour les accès non autorisés
- **200 OK** pour les accès autorisés (membres de la conversation)
- **404 Not Found** pour les conversations inexistantes

**Règle appliquée : Seuls les utilisateurs faisant partie de la conversation peuvent y accéder. Rien de plus !**

