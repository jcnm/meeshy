# Architecture des Messages Unifiée - Meeshy

## 🎯 Vue d'ensemble

Cette architecture unifiée simplifie la gestion des messages avec **2 types principaux** :

### 1. **GatewayMessage** - Messages de la Gateway/API
- **Usage** : Réception via Socket.IO, réponses API, chargement de conversations
- **Contenu** : Message de base + traductions disponibles (peut être vide pour nouveaux messages)
- **Format** : Standard backend avec `MessageTranslation[]`

### 2. **UIMessage** - Messages pour l'interface utilisateur  
- **Usage** : Affichage dans BubbleMessage avec états visuels
- **Contenu** : GatewayMessage enrichi + états UI (traductions en cours, erreurs, etc.)
- **Format** : Optimisé pour l'UI avec `UITranslationState[]`

## 📋 Types principaux

```typescript
// 1. MESSAGE GATEWAY (Backend/API)
interface GatewayMessage {
  id: string;
  conversationId: string;
  content: string;
  originalLanguage: string;
  senderId?: string;
  anonymousSenderId?: string;
  createdAt: Date;
  sender?: User | AnonymousParticipant;
  translations: MessageTranslation[];  // Traductions DB
  replyTo?: GatewayMessage;
}

interface MessageTranslation {
  id: string;
  messageId: string;
  targetLanguage: string;         // Langue cible
  translatedContent: string;      // Contenu traduit
  translationModel: 'basic' | 'medium' | 'premium';
  cacheKey: string;
  confidenceScore?: number;
  createdAt: Date;
  cached: boolean;
}

// 2. MESSAGE UI (Interface utilisateur)
interface UIMessage extends GatewayMessage {
  // États UI
  uiTranslations: UITranslationState[];
  translatingLanguages: Set<string>;
  currentDisplayLanguage: string;
  showingOriginal: boolean;
  
  // Contenu UI
  originalContent: string;
  readStatus?: Array<{ userId: string; readAt: Date }>;
  location?: string;
  
  // Permissions
  canEdit: boolean;
  canDelete: boolean;
  canTranslate: boolean;
  canReply: boolean;
}

interface UITranslationState {
  language: string;               // Langue cible
  content: string;               // Contenu traduit
  status: 'pending' | 'translating' | 'completed' | 'failed';
  timestamp: Date;
  confidence?: number;           // Score 0-1
  model?: 'basic' | 'medium' | 'premium';
  error?: string;               // Message d'erreur si échec
  fromCache: boolean;           // Indique si traduit depuis le cache
}
```

## 🔄 Flux de conversion

```mermaid
graph TB
    A[Gateway API] -->|GatewayMessage| B[Reception]
    B -->|gatewayToUIMessage()| C[UIMessage]
    C -->|BubbleMessage| D[Affichage UI]
    
    D -->|Force Translation| E[addTranslatingState()]
    E -->|API Translation| F[updateTranslationResult()]
    F -->|Updated UIMessage| D
```

## 🛠️ Fonctions utilitaires

### Conversion Gateway → UI
```typescript
// Convertir GatewayMessage en UIMessage
const uiMessage = gatewayToUIMessage(gatewayMessage, userLanguage, {
  canEdit: gatewayMessage.senderId === currentUser.id,
  canDelete: gatewayMessage.senderId === currentUser.id,
  canTranslate: true,
  canReply: true
});

// Conversion en lot
const uiMessages = convertGatewayMessagesToUI(gatewayMessages, currentUser, userLanguage);
```

### Gestion des états de traduction
```typescript
// Marquer comme "en cours de traduction"
const translatingMessage = addTranslatingState(uiMessage, 'en');

// Mettre à jour avec le résultat
const completedMessage = updateTranslationResult(uiMessage, 'en', {
  content: 'Hello world',
  status: 'completed',
  confidence: 0.95,
  model: 'medium',
  fromCache: false
});

// Marquer comme échoué
const failedMessage = updateTranslationResult(uiMessage, 'en', {
  status: 'failed',
  error: 'Translation service unavailable'
});
```

### Utilitaires d'affichage
```typescript
// Obtenir le contenu à afficher selon la langue
const displayContent = getDisplayContent(uiMessage);

// Vérifier si une traduction est en cours
const isTranslating = isTranslating(uiMessage, 'en');

// Vérifier si une traduction est disponible
const hasTranslation = hasTranslation(uiMessage, 'en');
```

## 📁 Structure des fichiers

```
shared/types/
├── message-types.ts          # Types principaux unifiés
├── conversation.d.ts         # Types legacy (deprecated)
└── index.ts                  # Exports principaux

frontend/
├── utils/message-conversion.ts    # Utilitaires de conversion
├── components/common/
│   ├── bubble-message.tsx         # Utilise UIMessage
│   └── messages-display.tsx       # Utilise GatewayMessage → UIMessage
└── types/
    ├── index.ts                   # Exports frontend
    └── bubble-stream.ts           # Types legacy (deprecated)
```

## ✅ Avantages de cette architecture

### 1. **Séparation claire des responsabilités**
- **GatewayMessage** : Format standardisé backend/API
- **UIMessage** : Format optimisé pour l'interface utilisateur

### 2. **Performance optimisée**
- Conversion Gateway → UI uniquement quand nécessaire
- États UI gérés séparément des données backend
- Cache des traductions intégré

### 3. **Maintenir la compatibilité**
- Types legacy exportés pour migration progressive
- Fonctions de conversion transparentes
- Support des deux formats pendant la transition

### 4. **Type Safety renforcée**
- Types TypeScript stricts
- Conversion explicite entre formats
- États UI typés précisément

## 🔧 Migration progressive

1. **Phase 1** ✅ : Types unifiés créés
2. **Phase 2** ✅ : BubbleMessage mis à jour avec UIMessage
3. **Phase 3** 🔄 : Mise à jour des services et hooks
4. **Phase 4** 📋 : Migration des composants restants
5. **Phase 5** 📋 : Suppression des types legacy

## 📋 Prochaines étapes

1. Mettre à jour les services de messages pour utiliser `GatewayMessage`
2. Mettre à jour les hooks de chargement de messages
3. Tester la conversion Gateway → UI dans les composants
4. Optimiser les performances de conversion
5. Documenter les patterns d'usage pour l'équipe

Cette architecture garantit une **cohérence totale** entre les types de messages tout en optimisant les performances et l'expérience développeur ! 🚀