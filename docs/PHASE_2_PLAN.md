# Phase 2 - Unification de l'Envoi de Messages

## 🎯 Objectifs

### Problèmes Identifiés
1. **Double-voie messaging** : REST `POST /conversations/:id/messages` ET WebSocket `message:send`
2. **Logique dupliquée** : Validation, permissions, sauvegarde dans 2 endroits
3. **Inconsistance auth** : REST = Bearer token, WebSocket = hybrid auth
4. **Formats réponse** : REST retourne objet complet, WebSocket retourne juste messageId
5. **Performance** : Pas optimisé pour 100k msg/sec avec double logique

### Solution Target
**WebSocket-First Strategy** : Une seule voie WebSocket avec unified response format

## 🏗️ Architecture Cible

```
Frontend → WebSocket Gateway → Translator Service
    ↓ Unified Message Format
Gateway Response → Frontend (Real-time + Acknowledgment)
```

### Unified Message Flow
```typescript
// Frontend envoie via WebSocket UNIQUEMENT
socket.emit('message:send', {
  conversationId: string,
  content: string,
  originalLanguage?: string,
  messageType?: string,
  replyToId?: string
}, (response: UnifiedMessageResponse) => {
  // ACK avec message complet + metadata
});
```

## 📦 Phase 2.1 - Types Unifiés pour Messaging

### UnifiedMessageRequest
```typescript
interface UnifiedMessageRequest {
  conversationId: string;
  content: string;
  originalLanguage?: string;
  messageType?: string;
  replyToId?: string;
  // Extensions pour anonymous messaging
  isAnonymous?: boolean;
  anonymousDisplayName?: string;
}
```

### UnifiedMessageResponse  
```typescript
interface UnifiedMessageResponse extends ApiResponse<Message> {
  // Hérite de ApiResponse pour cohérence
  data: Message; // Message complet avec sender, translations, etc.
  metadata: {
    conversationStats?: ConversationStats;
    translationStatus?: 'pending' | 'completed' | 'failed';
    deliveryStatus?: 'sent' | 'delivered' | 'read';
  };
}
```

## 🔄 Phase 2.2 - Migration Strategy

### Étape 1: Backup REST Endpoint
- Garder `POST /conversations/:id/messages` en DEPRECATED
- Ajouter header `X-Deprecated: true` 
- Logger usage pour monitoring migration

### Étape 2: Unified WebSocket Handler
- Créer `UnifiedMessageHandler` dans `gateway/src/services/`
- Centraliser toute logique : validation, permissions, sauvegarde, traduction
- Utiliser types unifiés de Phase 1

### Étape 3: Enhanced WebSocket Response
- Retourner `UnifiedMessageResponse` au lieu de juste `{ messageId }`
- Includer stats conversation, statut traduction, metadata
- Support ACK/callback pour confirmation delivery

### Étape 4: Frontend Migration
- Modifier `frontend/services/conversations.service.ts`
- Remplacer appels REST par WebSocket uniquement
- Unified error handling avec types de Phase 1

## 🔒 Phase 2.3 - Authentification Unifiée

### Problem Actuel
```typescript
// REST utilise Bearer token uniquement
headers: { Authorization: `Bearer ${token}` }

// WebSocket utilise hybrid auth
{ userId, sessionToken, language }
```

### Solution Unifiée
```typescript
// WebSocket accepte Bearer token format
socket.auth = { 
  token: `Bearer ${sessionToken}`,
  language: userLanguage 
};

// Ou maintenir format existant pour backward compatibility
socket.auth = {
  userId: user.id,
  sessionToken: token,
  language: userLanguage
};
```

## ⚡ Phase 2.4 - Performance Optimizations

### Unified Validation Pipeline
```typescript
// Un seul point de validation au lieu de 2
class MessageValidationService {
  validateMessage(request: UnifiedMessageRequest): ValidationResult
  validatePermissions(userId: string, conversationId: string): PermissionResult
}
```

### Batch Translation Queueing
```typescript
// Optimiser pour 100k msg/sec
class BatchTranslationQueue {
  queueMessage(message: Message): void
  processBatch(): Promise<TranslationResult[]>
}
```

### Caching Strategy
```typescript
// Cache permissions et stats pour éviter repeated DB queries
class ConversationPermissionCache {
  canSendMessage(userId: string, conversationId: string): boolean
  getConversationStats(conversationId: string): ConversationStats
}
```

## 📋 Implementation Order

### Phase 2.1 - Types ✅ NEXT
1. Créer `UnifiedMessageRequest` interface
2. Créer `UnifiedMessageResponse` interface  
3. Ajouter à `shared/types/index.ts`

### Phase 2.2 - Unified Handler
1. Créer `UnifiedMessageHandler` service
2. Migrer logique de REST endpoint + WebSocket handler
3. Implémenter unified validation/permissions

### Phase 2.3 - WebSocket Enhancement
1. Modifier `MeeshySocketIOManager.ts`
2. Utiliser `UnifiedMessageHandler`
3. Retourner `UnifiedMessageResponse`

### Phase 2.4 - Deprecate REST
1. Marquer REST endpoint DEPRECATED
2. Ajouter monitoring/logging
3. Frontend migration vers WebSocket-only

### Phase 2.5 - Performance Testing
1. Test 10k+ messages/second
2. Memory usage optimization
3. Database query optimization

## 🎯 Success Criteria

- ✅ Single unified WebSocket messaging path
- ✅ Consistent auth method across Gateway-Frontend  
- ✅ Unified response format with complete message data
- ✅ Performance: Handle 10k+ messages/second  
- ✅ Zero breaking changes during migration
- ✅ Type safety with Phase 1 unified types

## 🚀 Ready to Start?

La Phase 2.1 (types unifiés) peut commencer immédiatement avec les fondations de Phase 1.
