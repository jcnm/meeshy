# Instructions pour déboguer la galerie d'images

## Étape 1 : Redémarrer le backend

```bash
# Si vous utilisez Docker
docker-compose restart gateway

# OU si vous lancez directement
cd gateway
npm run dev
```

## Étape 2 : Ouvrir la console du navigateur

1. Ouvrir DevTools (`F12`)
2. Aller dans l'onglet "Console"
3. Effacer les logs existants

## Étape 3 : Reproduire le problème

1. Aller sur `/chat/mshy_68f1580736cc7df1f2376a59.2510162239_zf14qeux`
2. Cliquer sur une image pour ouvrir la galerie

## Étape 4 : Observer les logs

### Logs Frontend (Console du navigateur)

Vous devriez voir :
```
[AttachmentService] getConversationAttachments - Début: {
  conversationId: "...",
  options: { type: "image", limit: 100 },
  authHeaders: ["X-Session-Token"],  // ⬅️ IMPORTANT
  url: "http://localhost:3001/api/conversations/.../attachments?type=image&limit=100"
}

[AttachmentService] getConversationAttachments - Réponse: {
  status: 403,  // ⬅️ ERREUR ICI
  statusText: "Forbidden",
  ok: false
}

[AttachmentService] ❌ Erreur récupération attachments: {
  status: 403,
  error: { error: "Access denied to this conversation" }
}
```

### Logs Backend (Terminal du gateway)

Vous devriez voir :
```
[AttachmentRoutes] GET /conversations/:conversationId/attachments - Début

[AttachmentRoutes] AuthContext: {
  hasAuthContext: true,
  isAuthenticated: false,
  isAnonymous: true,  // ⬅️ BON SIGNE
  userId: "...",
  hasAnonymousParticipant: true
}

[AttachmentRoutes] Paramètres: {
  conversationId: "...",
  type: "image",
  limit: 100
}

[AttachmentRoutes] Vérification accès anonyme: {
  anonymousParticipantId: "...",
  conversationIdRequested: "..."
}

[AttachmentRoutes] Participant trouvé: {
  hasParticipant: true/false,
  participantConversationId: "...",  // ⬅️ COMPARER AVEC requestedConversationId
  requestedConversationId: "...",
  match: true/false,  // ⬅️ SI FALSE, C'EST LE PROBLÈME
  allowViewHistory: true/false
}
```

## Étape 5 : Analyser les logs

### Cas 1 : authHeaders est vide `[]`

**Problème :** Le token n'est pas envoyé

**Solution :** 
```javascript
// Dans la console du navigateur
console.log('Session Token:', localStorage.getItem('anonymous_session_token'));
```

Si `null`, la session a expiré. Reconnectez-vous.

### Cas 2 : hasAuthContext: false

**Problème :** Le middleware `authOptional` ne fonctionne pas

**Vérifier :** Le middleware est-il bien appelé ?

### Cas 3 : match: false

**Problème :** Les conversationIds ne correspondent pas

**Logs à partager :**
```
participantConversationId: "abc123..."
requestedConversationId: "xyz789..."
```

C'est probablement un problème de format (ObjectId vs identifier). Dans ce cas, je dois modifier la logique de comparaison.

### Cas 4 : allowViewHistory: false

**Problème :** Le lien ne permet pas de voir l'historique

**Solution :** Modifier le lien pour autoriser `allowViewHistory: true`

## Étape 6 : Me partager les logs

Copiez-collez les logs complets :
- **Frontend** : Tout ce qui apparaît dans la console
- **Backend** : Les logs `[AttachmentRoutes]` dans le terminal

Je pourrai alors identifier le problème exact et le corriger.

## Vérifications rapides

### Vérifier le token de session
```javascript
// Dans la console du navigateur
localStorage.getItem('anonymous_session_token')
```

Devrait retourner quelque chose comme : `"sess_abc123xyz..."`

### Vérifier les données de la conversation
```javascript
// Si vous avez accès aux données
console.log('Conversation ID:', /* le conversationId utilisé par la galerie */);
```

## Date

2025-10-16

