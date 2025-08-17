# Améliorations de l'Authentification WebSocket

## Vue d'ensemble

L'authentification WebSocket a été améliorée pour utiliser le même middleware hybride que les routes REST, permettant une gestion unifiée des utilisateurs authentifiés et des participants anonymes.

## Changements apportés

### 1. Authentification hybride unifiée

**Avant :**
- Authentification WebSocket basée uniquement sur les tokens JWT
- Pas de support pour les participants anonymes
- Logique d'authentification séparée des routes REST

**Après :**
- Authentification hybride supportant à la fois :
  - **Bearer tokens** pour les utilisateurs authentifiés
  - **x-session-token** pour les participants anonymes
- Même logique que le middleware hybride des routes REST
- Vérification de l'expiration des liens de partage

### 2. Méthodes mises à jour

#### `_handleTokenAuthentication()`
- **Fonctionnalité :** Authentification automatique lors de la connexion WebSocket
- **Support :** Bearer token + session token
- **Vérifications :**
  - Validité du JWT pour les utilisateurs authentifiés
  - Existence et activité de l'utilisateur en base
  - Validité du session token pour les participants anonymes
  - Expiration du lien de partage
  - Statut actif du participant anonyme

#### `_handleAuthentication()`
- **Fonctionnalité :** Authentification manuelle via événement Socket.IO
- **Support :** Même logique hybride que `_handleTokenAuthentication()`
- **Fallback :** Support de l'ancien format avec `userId`

### 3. Gestion des rooms Socket.IO

#### Utilisateurs authentifiés
- Rejoignent automatiquement la conversation globale `conversation_any`
- Rejoignent leurs conversations personnelles via `_joinUserConversations()`

#### Participants anonymes
- Rejoignent uniquement la conversation spécifique de leur lien de partage
- Pas d'accès à la conversation globale
- Isolation par lien de partage

### 4. Logs améliorés

```typescript
// Authentification hybride
console.log(`🔍 Authentification hybride pour socket ${socket.id}:`, {
  hasAuthToken: !!authToken,
  hasSessionToken: !!sessionToken,
  authTokenLength: authToken?.length,
  sessionTokenLength: sessionToken?.length
});

// Succès utilisateur authentifié
console.log(`✅ Utilisateur authentifié automatiquement: ${user.id}`);

// Succès participant anonyme
console.log(`✅ Participant anonyme authentifié automatiquement: ${user.id}`);

// Erreurs détaillées
console.log(`❌ Utilisateur ${decoded.userId} non trouvé ou inactif`);
console.log(`❌ Lien de partage expiré pour participant ${participant.id}`);
```

## Avantages

### 1. Cohérence
- Même logique d'authentification que les routes REST
- Réduction de la duplication de code
- Maintenance simplifiée

### 2. Sécurité
- Vérification de l'expiration des liens de partage
- Validation du statut actif des utilisateurs/participants
- Isolation des participants anonymes par conversation

### 3. Flexibilité
- Support des deux types d'authentification
- Fallback pour l'ancien format
- Messages d'erreur détaillés

### 4. Observabilité
- Logs détaillés pour le debugging
- Traçabilité des authentifications
- Statistiques d'erreurs

## Utilisation

### Côté client (utilisateur authentifié)
```javascript
// Connexion avec Bearer token
const socket = io('ws://localhost:3000', {
  extraHeaders: {
    'Authorization': 'Bearer ' + authToken
  }
});
```

### Côté client (participant anonyme)
```javascript
// Connexion avec session token
const socket = io('ws://localhost:3000', {
  extraHeaders: {
    'x-session-token': sessionToken
  }
});
```

### Authentification manuelle (fallback)
```javascript
// Événement d'authentification manuelle
socket.emit('authenticate', {
  sessionToken: token,
  language: 'fr'
});
```

## Tests recommandés

1. **Authentification utilisateur connecté**
   - Connexion avec Bearer token valide
   - Vérification de l'accès aux conversations personnelles
   - Vérification de l'accès à la conversation globale

2. **Authentification participant anonyme**
   - Connexion avec session token valide
   - Vérification de l'accès uniquement à la conversation du lien
   - Test avec lien expiré

3. **Gestion des erreurs**
   - Token invalide
   - Utilisateur inactif
   - Participant inactif
   - Lien expiré

4. **Performance**
   - Connexions multiples simultanées
   - Déconnexions/reconnexions
   - Gestion de la mémoire

## Migration

Aucune migration requise côté client si les headers d'authentification sont déjà configurés correctement. Les anciens formats d'authentification sont toujours supportés en fallback.
