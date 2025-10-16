# 🔌 Guide d'intégration @meeshy/shared

> Comment utiliser la librairie partagée dans vos services

## 📋 Table des matières

- [Installation](#installation)
- [Utilisation dans Gateway](#utilisation-dans-gateway)
- [Utilisation dans Frontend](#utilisation-dans-frontend)
- [Utilisation dans Translator](#utilisation-dans-translator)
- [Workflow de développement](#workflow-de-développement)
- [Migration depuis les anciens types](#migration)

---

## 🚀 Installation

### Prérequis

Assurez-vous que le workspace pnpm est bien configuré :

```yaml
# /pnpm-workspace.yaml
packages:
  - 'frontend'
  - 'gateway'
  - 'translator'
  - 'shared'
```

### Ajouter la dépendance

Dans chaque service (frontend, gateway), ajoutez :

```json
// package.json
{
  "dependencies": {
    "@meeshy/shared": "workspace:*"
  }
}
```

Puis installez :

```bash
# À la racine du monorepo
pnpm install
```

---

## 🔧 Utilisation dans Gateway

### Configuration TypeScript

```json
// gateway/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@meeshy/shared": ["../shared/dist/index.d.ts"],
      "@meeshy/shared/*": ["../shared/dist/*"]
    }
  }
}
```

### Import des types Socket.IO

```typescript
// gateway/src/socketio/MeeshySocketIOManager.ts
import type { 
  ServerToClientEvents,
  ClientToServerEvents,
  SocketIOMessage,
  SocketIOUser,
  MessageSendData,
  MessageSendResponseData,
  TranslationEvent,
  TypingEvent
} from '@meeshy/shared';

import { Server as SocketIOServer } from 'socket.io';

const io = new SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents
>(server);
```

### Import du Client Prisma

```typescript
// gateway/src/services/DatabaseService.ts
import { PrismaClient } from '@meeshy/shared/client';

class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }
  
  async getConversation(id: string) {
    return await this.prisma.conversation.findUnique({
      where: { id },
      include: { members: true }
    });
  }
}
```

### Typage des requêtes/réponses

```typescript
// gateway/src/routes/messages.ts
import type { 
  MessageRequest,
  MessageResponse,
  ApiResponse,
  MessageValidationResult
} from '@meeshy/shared';

async function sendMessage(request: MessageRequest): Promise<MessageResponse> {
  // Validation
  const validation: MessageValidationResult = validateMessage(request);
  
  if (!validation.isValid) {
    return {
      success: false,
      error: 'Validation failed',
      data: undefined,
      metadata: {}
    };
  }
  
  // Traitement...
}
```

---

## 🎨 Utilisation dans Frontend

### Configuration TypeScript

```json
// frontend/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@meeshy/shared": ["../shared/dist/index.d.ts"],
      "@meeshy/shared/*": ["../shared/dist/*"]
    }
  }
}
```

### Import des types UI

```typescript
// frontend/hooks/use-messaging.ts
import type { 
  UIMessage,
  MessageWithTranslations,
  Conversation,
  SocketIOUser,
  TranslationData
} from '@meeshy/shared';

export function useMessaging() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  
  // ...
}
```

### Components React

```typescript
// frontend/components/messages/BubbleMessage.tsx
import type { UIMessage, TranslationStatus } from '@meeshy/shared';

interface BubbleMessageProps {
  message: UIMessage;
  onTranslate: (language: string) => void;
}

export function BubbleMessage({ message, onTranslate }: BubbleMessageProps) {
  // TypeScript infère automatiquement tous les types
  const displayContent = message.showingOriginal 
    ? message.originalContent 
    : message.uiTranslations.find(t => t.status === 'completed')?.content;
  
  // ...
}
```

### Services WebSocket

```typescript
// frontend/services/meeshy-socketio.service.ts
import type { 
  ServerToClientEvents,
  ClientToServerEvents,
  MessageSendData,
  SocketIOResponse
} from '@meeshy/shared';
import { io, Socket } from 'socket.io-client';

class MeeshySocketIOService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  sendMessage(data: MessageSendData): Promise<SocketIOResponse<{ messageId: string }>> {
    return new Promise((resolve) => {
      this.socket?.emit('message:send', data, (response) => {
        resolve(response);
      });
    });
  }
}
```

---

## 🐍 Utilisation dans Translator

### Référence du schéma

Le schéma Prisma est disponible pour référence :

```python
# translator/models/message.py
# Voir /shared/schema.prisma pour la structure complète

from pydantic import BaseModel
from typing import Literal

# Types alignés avec schema.prisma Message.messageType
MessageType = Literal['text', 'image', 'file', 'audio', 'video', 'location', 'system']

class MessageTranslation(BaseModel):
    message_id: str
    source_language: str
    target_language: str
    translated_content: str
    translation_model: Literal['basic', 'medium', 'premium']
    # Aligné avec shared/schema.prisma MessageTranslation
```

---

## 🔄 Workflow de développement

### 1. Développement local

```bash
# Terminal 1 - Watch mode pour les types
cd shared
npm run build:watch

# Terminal 2 - Développement frontend
cd frontend
npm run dev

# Terminal 3 - Développement gateway
cd gateway
npm run dev
```

Les changements dans `shared/types/` sont automatiquement recompilés et les services TypeScript les détectent.

### 2. Avant de commit

```bash
cd shared

# Valider les types
npm run validate

# Builder si succès
npm run build

# Commit seulement les sources
git add types/ schema.prisma package.json tsconfig.json
git commit -m "feat: update shared types"

# Ne jamais commit dist/ (généré à la demande)
```

### 3. Après un pull

```bash
# À la racine
pnpm install

# Rebuild shared
cd shared
npm run build
```

---

## 🔄 Migration depuis les anciens types

### Avant (types inline)

```typescript
// ❌ Ancien code
interface Message {
  id: string;
  content: string;
  sender: any;
  translations: any[];
}
```

### Après (types de la librairie)

```typescript
// ✅ Nouveau code
import type { Message, MessageTranslation } from '@meeshy/shared';

// Types automatiquement inférés et stricts
const message: Message = {
  id: '...',
  conversationId: '...',
  content: '...',
  originalLanguage: 'fr',
  messageType: 'text', // Type vérifié!
  isEdited: false,
  isDeleted: false,
  createdAt: new Date(),
  timestamp: new Date(),
  translations: []
};
```

### Migration des type guards

```typescript
// ✅ Utiliser les type guards de la librairie
import { 
  isAuthenticatedUser, 
  isAnonymousParticipant,
  isImageMimeType 
} from '@meeshy/shared';

if (isAuthenticatedUser(sender)) {
  // sender est automatiquement typé comme SocketIOUser
  console.log(sender.email); // ✅ Pas d'erreur
}
```

---

## 📚 Ressources

### Documentation

- **README librairie** : `/shared/README.md`
- **README types** : `/shared/types/README.md`
- **Schéma Prisma** : `/shared/schema.prisma`

### Exemples d'utilisation

Voir les services existants :

- **Gateway** : `/gateway/src/socketio/MeeshySocketIOManager.ts`
- **Frontend** : `/frontend/hooks/use-messaging.ts`
- **Frontend** : `/frontend/services/meeshy-socketio.service.ts`

### Support

En cas de problème :

1. Vérifier l'alignement : `cd shared && npm run validate`
2. Rebuild : `npm run build`
3. Vérifier les types compilés dans `dist/`
4. Consulter la documentation JSDoc dans les `.d.ts`

---

## ✅ Checklist d'intégration

Avant de déployer un service utilisant `@meeshy/shared` :

- [ ] La librairie est dans `dependencies` du `package.json`
- [ ] `pnpm install` a été exécuté
- [ ] `cd shared && npm run build` a été exécuté
- [ ] Les imports utilisent `@meeshy/shared` et non des chemins relatifs
- [ ] Aucune erreur TypeScript dans le service
- [ ] Les types Prisma sont à jour (`npm run build:prisma`)
- [ ] Le dossier `shared/dist/` existe et contient les `.d.ts`

---

**Dernière mise à jour** : Version 1.0.0 - Typage strict complet  
**Maintenu par** : Équipe Meeshy

