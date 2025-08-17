# Endpoint `/links/:linkId/conversations`

## Vue d'ensemble

L'endpoint `/links/:linkId/conversations` est le point d'entrée principal pour récupérer toutes les données d'une conversation via un lien de partage. Il remplace l'ancien endpoint `/anonymous/conversation/:linkId` et offre une approche plus cohérente et complète.

## URL

```
GET /links/:linkId/conversations
```

## Paramètres

### Path Parameters
- `linkId` (string, requis) : L'identifiant unique du lien de partage

### Query Parameters
- `limit` (number, optionnel) : Nombre maximum de messages à récupérer (défaut: 50, max: 100)
- `offset` (number, optionnel) : Nombre de messages à ignorer pour la pagination (défaut: 0)

### Headers
- `x-session-token` (string, optionnel) : Token de session anonyme
- `Authorization: Bearer <token>` (string, optionnel) : Token d'authentification normale

## Authentification

L'endpoint accepte deux types d'authentification :

### 1. Session Anonyme
```http
GET /links/abc123/conversations
x-session-token: session_token_here
```

### 2. Authentification Normale
```http
GET /links/abc123/conversations
Authorization: Bearer jwt_token_here
```

## Réponse

### Succès (200)

```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "conv_123",
      "title": "Conversation de test",
      "description": "Description de la conversation",
      "type": "public",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    },
    "link": {
      "id": "mshy_456",
      "linkId": "abc123",
      "name": "Lien de partage",
      "description": "Description du lien",
      "allowViewHistory": true,
      "allowAnonymousMessages": true,
      "allowAnonymousFiles": false,
      "allowAnonymousImages": true,
      "requireEmail": false,
      "requireNickname": true,
      "expiresAt": "2024-12-31T23:59:59Z",
      "isActive": true
    },
    "messages": [
      {
        "id": "msg_789",
        "content": "Bonjour tout le monde !",
        "originalLanguage": "fr",
        "createdAt": "2024-01-01T10:00:00Z",
        "sender": {
          "id": "user_123",
          "username": "john_doe",
          "firstName": "John",
          "lastName": "Doe",
          "displayName": "John Doe",
          "avatar": "https://example.com/avatar.jpg"
        },
        "translations": [
          {
            "id": "trans_1",
            "targetLanguage": "en",
            "translatedText": "Hello everyone!"
          }
        ]
      }
    ],
    "stats": {
      "totalMessages": 150,
      "totalMembers": 5,
      "totalAnonymousParticipants": 3,
      "onlineAnonymousParticipants": 1,
      "hasMore": true
    },
    "members": [
      {
        "id": "member_123",
        "role": "ADMIN",
        "joinedAt": "2024-01-01T00:00:00Z",
        "user": {
          "id": "user_123",
          "username": "john_doe",
          "firstName": "John",
          "lastName": "Doe",
          "displayName": "John Doe",
          "avatar": "https://example.com/avatar.jpg",
          "isOnline": true,
          "lastSeen": "2024-01-01T10:00:00Z"
        }
      }
    ],
    "anonymousParticipants": [
      {
        "id": "anon_123",
        "nickname": "invite_1",
        "firstName": "Invité",
        "lastName": "Test",
        "language": "fr",
        "isOnline": true,
        "lastActiveAt": "2024-01-01T10:00:00Z",
        "joinedAt": "2024-01-01T09:00:00Z",
        "canSendMessages": true,
        "canSendFiles": false,
        "canSendImages": true
      }
    ],
    "currentUser": {
      "id": "user_123",
      "type": "authenticated",
      "username": "john_doe",
      "firstName": "John",
      "lastName": "Doe",
      "displayName": "John Doe",
      "language": "fr"
    }
  }
}
```

### Erreurs

#### 404 - Lien non trouvé
```json
{
  "success": false,
  "message": "Lien de conversation introuvable"
}
```

#### 401 - Authentification requise
```json
{
  "success": false,
  "message": "Authentification requise"
}
```

#### 403 - Accès non autorisé
```json
{
  "success": false,
  "message": "Accès non autorisé à cette conversation"
}
```

#### 410 - Lien expiré ou inactif
```json
{
  "success": false,
  "message": "Ce lien a expiré"
}
```

## Utilisation côté Frontend

### Service dédié

```typescript
import { LinkConversationService } from '@/services/link-conversation.service';

// Récupérer toutes les données
const data = await LinkConversationService.getConversationData('abc123', {
  limit: 50,
  offset: 0,
  sessionToken: 'session_token_here' // ou authToken: 'jwt_token_here'
});

// Récupérer seulement les statistiques
const stats = await LinkConversationService.getConversationStats('abc123');

// Récupérer seulement les participants
const participants = await LinkConversationService.getConversationParticipants('abc123');
```

### Appel direct

```typescript
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

const endpoint = API_ENDPOINTS.CONVERSATION.GET_LINK_CONVERSATION(linkId);
const response = await fetch(buildApiUrl(endpoint), {
  headers: {
    'x-session-token': sessionToken,
    // ou 'Authorization': `Bearer ${authToken}`
  }
});
```

## Avantages

### ✅ Cohérence REST
- URL logique : `/links/:linkId/conversations`
- Ressource clairement identifiée

### ✅ Données complètes
- Messages avec traductions
- Statistiques en temps réel
- Membres inscrits et anonymes
- Informations sur l'utilisateur actuel

### ✅ Flexibilité d'authentification
- Support des sessions anonymes
- Support de l'authentification normale
- Vérification des permissions

### ✅ Performance
- Pagination des messages
- Limitation du nombre de résultats
- Requêtes optimisées avec Prisma

### ✅ Sécurité
- Validation des tokens
- Vérification des permissions
- Contrôle d'accès par lien

## Migration

### Ancien endpoint (déprécié)
```typescript
fetch(`${buildApiUrl('/anonymous/conversation')}/${linkId}`)
```

### Nouvel endpoint (recommandé)
```typescript
const data = await LinkConversationService.getConversationData(linkId, options);
```

## Exemples d'utilisation

### Page de chat anonyme
```typescript
// Dans frontend/app/chat/[linkId]/page.tsx
const data = await LinkConversationService.getConversationData(linkId, {
  sessionToken: user.token
});
```

### Validation de lien
```typescript
// Vérifier si un lien est valide avant redirection
const validation = await LinkConversationService.validateLink(linkId);
if (!validation.isValid) {
  // Rediriger vers page d'erreur
}
```

### Affichage des statistiques
```typescript
// Récupérer les stats pour affichage
const stats = await LinkConversationService.getConversationStats(linkId);
console.log(`${stats.totalMessages} messages, ${stats.totalMembers} membres`);
```
