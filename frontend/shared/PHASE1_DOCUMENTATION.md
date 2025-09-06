# Phase 1 : Types Unifiés Meeshy

## ✅ Phase 1.1 et 1.2 Complétées

Les types unifiés ont été créés et sont maintenant disponibles dans `/shared/types/`. Cette phase établit la fondation pour la cohérence entre Gateway et Frontend.

## 📁 Nouveaux Fichiers

### Types Principaux
- `conversation.ts` - Types unifiés pour conversations, messages, participants
- `user.ts` - Types unifiés pour utilisateurs et permissions  
- `anonymous.ts` - Types pour participants anonymes
- `api-responses.ts` - Format de réponse unifié REST/WebSocket

### Utilitaires
- `migration-utils.ts` - Fonctions d'aide pour la migration
- `index.ts` - Export centralisé avec compatibilité rétroactive

## 🔑 Principes Clés

### Identifiants de Conversation
```typescript
interface ConversationIdentifiers {
  id: string;           // ObjectId MongoDB - TOUJOURS pour API/WebSocket  
  identifier?: string;  // Human-readable - OPTIONNEL pour URLs
}
```

**Règle d'usage :**
- API/WebSocket : TOUJOURS utiliser `id` (ObjectId)
- URLs/Display : Utiliser `identifier` si disponible, sinon `id`

### Messages Unifiés
```typescript
interface Message {
  id: string;
  conversationId: string;  // TOUJOURS ObjectId
  senderId?: string;       // ObjectId si user connecté
  anonymousSenderId?: string; // ObjectId si anonyme
  content: string;
  originalLanguage: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  sender?: User | AnonymousParticipant; // Union type claire
  // ...
}
```

### Réponses API Unifiées
```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  meta?: ResponseMeta;
}

// WebSocket utilise le MÊME format
type SocketResponse<T> = ApiResponse<T>;
```

## 🔧 Utilitaires de Migration

```typescript
import { 
  getApiConversationId,
  getDisplayConversationId,
  normalizeMessage,
  normalizeConversation,
  isValidObjectId,
  createApiSuccessResponse,
  createApiErrorResponse
} from '@/shared/types/migration-utils';

// Extraire ObjectId pour API
const conversationId = getApiConversationId(conversation);

// Extraire identifier pour URLs
const displayId = getDisplayConversationId(conversation);

// Normaliser données depuis différentes sources
const message = normalizeMessage(rawBackendMessage);
const conv = normalizeConversation(rawBackendConversation);
```

## 🔄 Compatibilité Rétroactive

Les anciens types sont toujours disponibles via des alias :
```typescript
// Anciens types (DEPRECATED)
export type Message = UnifiedMessage;
export type Conversation = UnifiedConversation;
export interface LegacyApiResponse<T> { /* ... */ }
```

## 📋 Prochaines Étapes

### Phase 2 : Unification de l'Envoi de Messages
- Service Frontend consolidé
- Stratégie "WebSocket First" avec fallback REST
- Format de réponse identique

### Phase 3 : Identifiants de Conversation  
- Règle unique d'usage des ObjectIds
- Simplification des utilitaires

### Phase 4 : Service de Messages Unifié
- Remplacement des services existants
- Logique de normalisation centralisée

## 🎯 Avantages Obtenus

✅ **Types cohérents** entre Gateway et Frontend  
✅ **Format de réponse unifié** REST/WebSocket  
✅ **Usage claire des ObjectIds** pour API  
✅ **Union types** pour User/AnonymousParticipant  
✅ **Utilitaires de migration** pour transition douce  
✅ **Compatibilité rétroactive** préservée  

## 📚 Usage Recommandé

### Dans le Frontend
```typescript
import type { Message, Conversation, User, ApiResponse } from '@/shared/types';
import { normalizeMessage, getApiConversationId } from '@/shared/types/migration-utils';

// Utiliser les nouveaux types
const sendMessage = async (conv: Conversation, content: string): Promise<ApiResponse<Message>> => {
  const conversationId = getApiConversationId(conv); // ObjectId garanti
  return socketService.sendMessage(conversationId, content);
};
```

### Dans le Gateway
```typescript
import type { Message, Conversation, ApiResponse } from '../../shared/types';
import { createApiSuccessResponse } from '../../shared/types/migration-utils';

// Réponse unifiée
const response = createApiSuccessResponse(message, { 
  conversationStats: stats 
});
```

Cette phase établit les fondations solides pour les phases suivantes qui vont harmoniser complètement la communication Gateway ↔ Frontend.
