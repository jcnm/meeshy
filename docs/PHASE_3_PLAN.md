# Phase 3 - Intégration MessagingService

## 🎯 Objectifs Phase 3

### Règles Architecture
1. **API/WebSocket** : TOUJOURS utiliser `id` (ObjectId)
2. **URLs/Display** : Utiliser `identifier` si disponible, sinon `id`
3. **Noms simples** : Pas de préfixes "Unified" ou suffixes vides
4. **Sécurité** : JWT token (utilisateurs) + session token (anonymes)

### Points d'Intégration Identifiés

#### 1. WebSocket Handler 
- **Fichier** : `src/socketio/MeeshySocketIOManager.ts`
- **Événement** : `CLIENT_EVENTS.MESSAGE_SEND`
- **Logique actuelle** : `_handleNewMessage()` (ligne ~125)
- **Problème** : Logique dupliquée avec REST, retourne juste `{ messageId }`

#### 2. REST Endpoint
- **Fichier** : `src/routes/conversations.ts` 
- **Route** : `POST /conversations/:id/messages` (ligne ~595)
- **Logique actuelle** : Validation + permissions + sauvegarde + traduction
- **Problème** : Même logique que WebSocket, code dupliqué

### Architecture Cible Phase 3

```
Frontend Request → Auth (JWT/Session) → MessagingService → Response
    ↓
WebSocket/REST → handleMessage() → Validation + Permissions + Save + Translate
    ↓
MessageResponse avec metadata complète → Frontend
```

## 📋 Plan d'Implémentation Phase 3

### Phase 3.1 - Intégration WebSocket ✅ NEXT

1. **Modifier `MeeshySocketIOManager.ts`**
   - Remplacer `_handleNewMessage()` 
   - Utiliser `MessagingService.handleMessage()`
   - Retourner `MessageResponse` complet au lieu de `{ messageId }`
   - Support auth JWT + session token

2. **Format Requête/Réponse**
   ```typescript
   // Entrée (reste identique)
   socket.on(CLIENT_EVENTS.MESSAGE_SEND, async (data: MessageRequest, callback) => {
   
   // Sortie (améliorée)
   callback({
     success: true,
     data: MessageResponse.data,     // Message complet
     metadata: MessageResponse.metadata  // Stats, traduction, performance
   });
   ```

### Phase 3.2 - Intégration REST

1. **Modifier endpoint `POST /conversations/:id/messages`**
   - Remplacer logique interne par `MessagingService.handleMessage()`
   - Garder même format de réponse pour compatibilité
   - Marquer route DEPRECATED avec header

2. **Unified Response Format**
   ```typescript
   // Avant
   { success: true, data: { ...message, stats } }
   
   // Après  
   MessageResponse { success, data: Message, metadata: {...} }
   ```

### Phase 3.3 - Auth & Security

1. **Support Dual Auth**
   ```typescript
   // JWT Token (utilisateurs connectés)
   const userId = extractUserFromJWT(socket.auth.token);
   
   // Session Token (anonymes)  
   const anonymousId = extractUserFromSession(socket.auth.sessionToken);
   ```

2. **ID Resolution selon règles**
   ```typescript
   // API/WebSocket : TOUJOURS ObjectId
   const conversationId = await resolveToObjectId(request.conversationId);
   
   // URLs: identifier si disponible
   const displayId = conversation.identifier || conversation.id;
   ```

## 🔧 Implémentation Phase 3.1

### Étape 1: Injection MessagingService

Modifier `MeeshySocketIOManager.ts` pour utiliser `MessagingService` :

```typescript
import { MessagingService } from '../services/MessagingService';

export class MeeshySocketIOManager {
  private messagingService: MessagingService;

  constructor(prisma: PrismaClient, translationService: TranslationService) {
    this.messagingService = new MessagingService(prisma, translationService);
  }
}
```

### Étape 2: Remplacement Handler

```typescript
socket.on(CLIENT_EVENTS.MESSAGE_SEND, async (data: MessageRequest, callback?: MessageSendCallback) => {
  try {
    // Extraction auth unifiée
    const senderId = this.extractSenderId(socket);
    
    // Appel service unifié
    const response = await this.messagingService.handleMessage(data, senderId, true);
    
    // Réponse complète (pas juste messageId)
    if (callback) {
      callback(response);
    }
    
    // Broadcast temps réel vers autres clients
    this.broadcastMessage(response.data, data.conversationId);
    
  } catch (error) {
    if (callback) {
      callback({ 
        success: false, 
        error: 'Failed to send message',
        data: null,
        metadata: { debug: { requestId: generateId() } }
      });
    }
  }
});
```

### Étape 3: Auth Extraction

```typescript
private extractSenderId(socket: any): string {
  // JWT Token (utilisateurs)
  if (socket.auth?.token) {
    return extractUserIdFromJWT(socket.auth.token);
  }
  
  // Session Token (anonymes) 
  if (socket.auth?.sessionToken) {
    return extractUserIdFromSession(socket.auth.sessionToken);
  }
  
  throw new Error('No valid authentication');
}
```

## 🎯 Bénéfices Attendus Phase 3

### ✅ Élimination Duplication
- **Une seule logique** de messaging au lieu de 2 (REST + WebSocket)
- **Validation unifiée** 
- **Permissions centralisées**
- **Traduction cohérente**

### ✅ Response Enhancement  
- **Metadata riche** : stats, performance, debug
- **Status complet** : traduction, livraison, erreurs détaillées
- **Type safety** avec `MessageResponse`

### ✅ Architecture Cohérente
- **ID standardisé** : ObjectId pour API, identifier pour display
- **Auth unifié** : JWT + session token support
- **Noms simplifiés** : MessagingService, MessageRequest/Response

### ✅ Performance
- **Centralisation** permet optimisations futures
- **Caching unifié** dans un seul endroit
- **Monitoring** centralisé avec debug info

## 🚀 Ready to Start Phase 3.1

Le `MessagingService` est prêt et compilé. Commençons par l'intégration WebSocket dans `MeeshySocketIOManager.ts` !
