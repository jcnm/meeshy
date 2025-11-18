# Phase 3: Intégration WhatsApp et iMessage

## 🎯 Objectif

Permettre à Meeshy de servir de passerelle unifiée pour communiquer avec WhatsApp et iMessage, avec traduction automatique et synchronisation bidirectionnelle.

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture proposée](#architecture-proposée)
3. [Technologies recommandées](#technologies-recommandées)
4. [Par où commencer](#par-où-commencer)
5. [Structure du code](#structure-du-code)
6. [Plan d'implémentation](#plan-dimplémentation)
7. [Comment tester](#comment-tester)
8. [Défis et solutions](#défis-et-solutions)

---

## Vue d'ensemble

### Fonctionnalités clés

```
┌──────────────┐
│   Meeshy     │ ◄──► Traduction ML
│   Frontend   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Gateway    │
│  (Node.js)   │
└──────┬───────┘
       │
       ├──────────────────┐
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│  WhatsApp    │   │   iMessage   │
│   Bridge     │   │    Bridge    │
└──────┬───────┘   └──────┬───────┘
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│  WhatsApp    │   │   iMessage   │
│   (Web/API)  │   │  (macOS/iOS) │
└──────────────┘   └──────────────┘
```

### Flux de messages

**Message entrant (WhatsApp/iMessage → Meeshy):**
1. Message reçu sur WhatsApp/iMessage
2. Bridge capture le message
3. Normalisation du format
4. Traduction si nécessaire
5. Stockage dans Meeshy DB
6. Envoi au frontend via Socket.IO

**Message sortant (Meeshy → WhatsApp/iMessage):**
1. Utilisateur envoie depuis Meeshy
2. Gateway identifie la conversation externe
3. Traduction inverse si nécessaire
4. Bridge envoie via WhatsApp/iMessage API
5. Confirmation de livraison

---

## Architecture proposée

### Composants principaux

```
meeshy/
├── bridge-whatsapp/          # Service Bridge WhatsApp
│   ├── src/
│   │   ├── adapters/
│   │   │   ├── whatsapp-web.adapter.ts    # whatsapp-web.js
│   │   │   └── whatsapp-business.adapter.ts # Business API
│   │   ├── services/
│   │   │   ├── message-normalizer.service.ts
│   │   │   ├── media-handler.service.ts
│   │   │   └── sync.service.ts
│   │   ├── models/
│   │   │   └── external-mapping.model.ts
│   │   └── server.ts
│   ├── package.json
│   └── Dockerfile
│
├── bridge-imessage/          # Service Bridge iMessage
│   ├── src/
│   │   ├── adapters/
│   │   │   ├── bluebubbles.adapter.ts     # BlueBubbles API
│   │   │   └── applescript.adapter.ts     # macOS AppleScript
│   │   ├── services/
│   │   │   ├── message-normalizer.service.ts
│   │   │   ├── media-handler.service.ts
│   │   │   └── sync.service.ts
│   │   ├── models/
│   │   │   └── external-mapping.model.ts
│   │   └── server.ts
│   ├── package.json
│   └── Dockerfile
│
├── gateway/
│   └── src/
│       ├── services/
│       │   └── bridge-connector.service.ts  # Connexion aux bridges
│       └── routes/
│           └── external-messages.routes.ts  # API bridges
│
└── shared/
    └── types/
        └── external-platforms.ts            # Types partagés
```

---

## Technologies recommandées

### WhatsApp

#### Option 1: whatsapp-web.js (Recommandé pour démarrer)
✅ **Avantages:**
- Gratuit, pas besoin de compte business
- Facile à mettre en place
- Supporte multi-device
- Excellente bibliothèque TypeScript

❌ **Inconvénients:**
- Nécessite scan QR code
- Peut être bloqué par WhatsApp (unofficial)
- Moins stable que l'API officielle

```bash
npm install whatsapp-web.js qrcode-terminal
```

#### Option 2: WhatsApp Business API (Pour production)
✅ **Avantages:**
- Officiel et stable
- Support professionnel
- Scalable

❌ **Inconvénients:**
- Coûteux ($0.005-0.09 par message)
- Nécessite compte WhatsApp Business
- Configuration complexe

### iMessage

#### Option 1: BlueBubbles (Recommandé)
✅ **Avantages:**
- API REST simple
- Support complet iMessage
- Serveur macOS facile à installer
- Documentation excellente

❌ **Inconvénients:**
- Nécessite un Mac toujours allumé
- Setup initial manuel

```bash
# Installation sur macOS
brew install bluebubbles
```

#### Option 2: AppleScript (Alternative)
✅ **Avantages:**
- Natif macOS
- Gratuit
- Contrôle total

❌ **Inconvénients:**
- Complexe à développer
- Nécessite macOS
- Pas de notifications push natives

---

## Par où commencer

### Étape 1: Prototype WhatsApp (1-2 semaines)

**Jour 1-2: Setup de base**
```bash
# Créer le projet bridge-whatsapp
mkdir -p bridge-whatsapp/src
cd bridge-whatsapp
npm init -y
npm install whatsapp-web.js qrcode-terminal express socket.io-client
npm install -D typescript @types/node @types/express
```

**Jour 3-5: Adapter WhatsApp basique**
- Connexion avec QR code
- Réception de messages
- Envoi de messages simples
- Gestion de session

**Jour 6-10: Intégration avec Gateway**
- API de synchronisation
- Normalisation des messages
- Stockage des mappings
- Tests d'intégration

**Jour 11-14: Fonctionnalités avancées**
- Support des médias
- Gestion des groupes
- Statuts de livraison
- Tests end-to-end

### Étape 2: Prototype iMessage (2-3 semaines)

**Semaine 1: Setup BlueBubbles**
- Installation serveur BlueBubbles sur Mac
- Configuration API
- Tests de connexion

**Semaine 2: Adapter iMessage**
- Connexion à BlueBubbles API
- Réception de messages
- Envoi de messages
- Intégration Gateway

**Semaine 3: Finalisation**
- Support médias
- Synchronisation complète
- Tests et debugging

### Étape 3: Production (2-4 semaines)

- Migration vers WhatsApp Business API
- Déploiement et monitoring
- Documentation utilisateur
- Formation équipe

---

## Structure du code

### 1. Schema Prisma (Shared)

```prisma
// shared/schema.prisma

model ExternalPlatform {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  name            String   // "whatsapp", "imessage"
  config          Json     // Configuration spécifique
  isActive        Boolean  @default(true)
  lastSyncAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  mappings        ExternalConversationMapping[]
}

model ExternalConversationMapping {
  id                    String   @id @default(auto()) @map("_id") @db.ObjectId

  // Meeshy conversation
  meeshyConversationId  String   @db.ObjectId
  meeshyConversation    Conversation @relation(fields: [meeshyConversationId], references: [id])

  // External platform
  externalPlatformId    String   @db.ObjectId
  externalPlatform      ExternalPlatform @relation(fields: [externalPlatformId], references: [id])

  // External identifiers
  externalChatId        String   // WhatsApp chat ID ou iMessage chat GUID
  externalParticipants  Json     // Liste des participants externes

  // Sync settings
  autoSync              Boolean  @default(true)
  autoTranslate         Boolean  @default(true)
  lastSyncedMessageId   String?
  lastSyncAt            DateTime?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([meeshyConversationId, externalPlatformId, externalChatId])
  @@index([externalChatId])
  @@index([meeshyConversationId])
}

model ExternalMessage {
  id                    String   @id @default(auto()) @map("_id") @db.ObjectId

  // Message Meeshy lié
  meeshyMessageId       String?  @db.ObjectId
  meeshyMessage         Message? @relation(fields: [meeshyMessageId], references: [id])

  // Mapping de conversation
  mappingId             String   @db.ObjectId
  mapping               ExternalConversationMapping @relation(fields: [mappingId], references: [id])

  // External message data
  externalMessageId     String   // ID du message externe
  externalAuthor        String   // Numéro/ID de l'auteur externe
  externalTimestamp     DateTime

  // Sync metadata
  direction             String   // "inbound" | "outbound"
  syncStatus            String   // "pending" | "synced" | "failed"
  syncedAt              DateTime?
  syncError             String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([externalMessageId, mappingId])
  @@index([meeshyMessageId])
  @@index([mappingId])
}
```

### 2. Types TypeScript (Shared)

```typescript
// shared/types/external-platforms.ts

export type ExternalPlatformType = 'whatsapp' | 'imessage';

export interface ExternalPlatformConfig {
  whatsapp?: {
    type: 'web' | 'business';
    sessionData?: any;
    businessApiKey?: string;
    phoneNumberId?: string;
  };
  imessage?: {
    type: 'bluebubbles' | 'applescript';
    serverUrl?: string;
    password?: string;
  };
}

export interface ExternalMessage {
  id: string;
  chatId: string;
  author: string;
  body: string;
  timestamp: Date;
  hasMedia: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  quotedMessageId?: string;
  metadata?: Record<string, any>;
}

export interface NormalizedMessage {
  externalId: string;
  externalPlatform: ExternalPlatformType;
  externalChatId: string;
  externalAuthor: string;
  content: string;
  timestamp: Date;
  attachments?: Array<{
    type: 'image' | 'video' | 'audio' | 'file';
    url: string;
    mimeType: string;
    size: number;
  }>;
  quotedMessage?: {
    externalId: string;
    content: string;
  };
}

export interface BridgeConfig {
  platform: ExternalPlatformType;
  gatewayUrl: string;
  gatewayApiKey: string;
  autoReconnect: boolean;
  syncInterval: number; // ms
}
```

### 3. WhatsApp Bridge (bridge-whatsapp)

```typescript
// bridge-whatsapp/src/adapters/whatsapp-web.adapter.ts

import { Client, LocalAuth, Message as WAMessage } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { EventEmitter } from 'events';
import { NormalizedMessage, ExternalPlatformType } from '@meeshy/shared/types/external-platforms';

export class WhatsAppWebAdapter extends EventEmitter {
  private client: Client;
  private isReady = false;

  constructor() {
    super();

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'meeshy-whatsapp-bridge',
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // QR Code pour connexion
    this.client.on('qr', (qr) => {
      console.log('📱 Scan ce QR code avec WhatsApp:');
      qrcode.generate(qr, { small: true });
      this.emit('qr', qr);
    });

    // Authentification réussie
    this.client.on('authenticated', () => {
      console.log('✅ WhatsApp authentifié');
      this.emit('authenticated');
    });

    // Client prêt
    this.client.on('ready', () => {
      console.log('🚀 WhatsApp client prêt');
      this.isReady = true;
      this.emit('ready');
    });

    // Message reçu
    this.client.on('message', async (message: WAMessage) => {
      if (message.fromMe) return; // Ignorer nos propres messages

      const normalized = await this.normalizeMessage(message);
      this.emit('message', normalized);
    });

    // Déconnexion
    this.client.on('disconnected', (reason) => {
      console.log('❌ WhatsApp déconnecté:', reason);
      this.isReady = false;
      this.emit('disconnected', reason);
    });
  }

  async initialize(): Promise<void> {
    await this.client.initialize();
  }

  async sendMessage(chatId: string, content: string): Promise<string> {
    if (!this.isReady) {
      throw new Error('WhatsApp client not ready');
    }

    const message = await this.client.sendMessage(chatId, content);
    return message.id._serialized;
  }

  async sendMediaMessage(
    chatId: string,
    mediaUrl: string,
    caption?: string
  ): Promise<string> {
    if (!this.isReady) {
      throw new Error('WhatsApp client not ready');
    }

    const media = await this.client.sendMessage(chatId, mediaUrl, {
      caption,
    });
    return media.id._serialized;
  }

  private async normalizeMessage(
    message: WAMessage
  ): Promise<NormalizedMessage> {
    const chat = await message.getChat();
    const contact = await message.getContact();

    const normalized: NormalizedMessage = {
      externalId: message.id._serialized,
      externalPlatform: 'whatsapp' as ExternalPlatformType,
      externalChatId: chat.id._serialized,
      externalAuthor: contact.id._serialized,
      content: message.body,
      timestamp: new Date(message.timestamp * 1000),
    };

    // Gestion des médias
    if (message.hasMedia) {
      const media = await message.downloadMedia();
      normalized.attachments = [{
        type: this.getMediaType(media.mimetype),
        url: `data:${media.mimetype};base64,${media.data}`,
        mimeType: media.mimetype,
        size: media.data.length,
      }];
    }

    // Message quoté
    if (message.hasQuotedMsg) {
      const quoted = await message.getQuotedMessage();
      normalized.quotedMessage = {
        externalId: quoted.id._serialized,
        content: quoted.body,
      };
    }

    return normalized;
  }

  private getMediaType(mimeType: string): 'image' | 'video' | 'audio' | 'file' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  }

  async getChats(): Promise<Array<{ id: string; name: string }>> {
    const chats = await this.client.getChats();
    return chats.map(chat => ({
      id: chat.id._serialized,
      name: chat.name,
    }));
  }

  async destroy(): Promise<void> {
    await this.client.destroy();
  }
}
```

### 4. Bridge Server (bridge-whatsapp)

```typescript
// bridge-whatsapp/src/server.ts

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WhatsAppWebAdapter } from './adapters/whatsapp-web.adapter';
import { BridgeConnectorService } from './services/bridge-connector.service';
import { MessageSyncService } from './services/message-sync.service';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);

app.use(express.json());

// Configuration
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || 'dev-key';
const PORT = process.env.PORT || 4000;

// Adapter WhatsApp
const whatsappAdapter = new WhatsAppWebAdapter();

// Service de connexion au Gateway
const bridgeConnector = new BridgeConnectorService({
  gatewayUrl: GATEWAY_URL,
  apiKey: GATEWAY_API_KEY,
});

// Service de synchronisation
const syncService = new MessageSyncService(whatsappAdapter, bridgeConnector);

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: whatsappAdapter.isReady ? 'ready' : 'initializing',
    platform: 'whatsapp',
  });
});

app.get('/chats', async (req, res) => {
  try {
    const chats = await whatsappAdapter.getChats();
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/send', async (req, res) => {
  try {
    const { chatId, content, mediaUrl } = req.body;

    let messageId: string;
    if (mediaUrl) {
      messageId = await whatsappAdapter.sendMediaMessage(chatId, mediaUrl, content);
    } else {
      messageId = await whatsappAdapter.sendMessage(chatId, content);
    }

    res.json({ messageId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event handlers
whatsappAdapter.on('message', async (message) => {
  console.log('📨 Message reçu:', message.externalChatId);
  await syncService.handleIncomingMessage(message);
});

whatsappAdapter.on('qr', (qr) => {
  io.emit('qr', qr);
});

whatsappAdapter.on('ready', () => {
  console.log('✅ Bridge WhatsApp prêt');
  io.emit('status', { ready: true });
});

// Démarrage
async function start() {
  console.log('🚀 Démarrage du Bridge WhatsApp...');

  await whatsappAdapter.initialize();

  httpServer.listen(PORT, () => {
    console.log(`🌐 Bridge WhatsApp écoute sur le port ${PORT}`);
  });
}

start().catch(console.error);
```

---

## Plan d'implémentation

### Semaine 1-2: Foundation WhatsApp

**Tasks:**
- [ ] Créer projet `bridge-whatsapp`
- [ ] Setup TypeScript + Express
- [ ] Implémenter `WhatsAppWebAdapter`
- [ ] Tests de connexion QR code
- [ ] Réception de messages de base
- [ ] Envoi de messages de base

**Livrables:**
- Bridge WhatsApp fonctionnel (lecture/écriture)
- QR code scanner
- Logs de messages

### Semaine 3-4: Intégration Gateway

**Tasks:**
- [ ] Créer `BridgeConnectorService`
- [ ] Ajouter schema Prisma pour mappings
- [ ] Implémenter `MessageSyncService`
- [ ] API Gateway pour bridges
- [ ] Tests d'intégration

**Livrables:**
- Synchronisation bidirectionnelle
- Stockage des mappings
- API de contrôle

### Semaine 5-6: iMessage Prototype

**Tasks:**
- [ ] Setup BlueBubbles sur Mac
- [ ] Créer projet `bridge-imessage`
- [ ] Implémenter `BlueBubblesAdapter`
- [ ] Intégration Gateway
- [ ] Tests

**Livrables:**
- Bridge iMessage fonctionnel
- Synchronisation avec Gateway

### Semaine 7-8: Médias et Polish

**Tasks:**
- [ ] Support images/vidéos WhatsApp
- [ ] Support images/vidéos iMessage
- [ ] Upload vers Meeshy storage
- [ ] Optimisation performance
- [ ] Documentation

**Livrables:**
- Support complet médias
- Documentation utilisateur

---

## Comment tester

### 1. Tests unitaires

```typescript
// bridge-whatsapp/__tests__/adapters/whatsapp-web.adapter.test.ts

import { WhatsAppWebAdapter } from '../../src/adapters/whatsapp-web.adapter';

describe('WhatsAppWebAdapter', () => {
  let adapter: WhatsAppWebAdapter;

  beforeEach(() => {
    adapter = new WhatsAppWebAdapter();
  });

  it('should emit qr event on QR code generation', (done) => {
    adapter.on('qr', (qr) => {
      expect(qr).toBeDefined();
      done();
    });

    adapter.initialize();
  });

  it('should normalize WhatsApp message', async () => {
    const mockWAMessage = {
      id: { _serialized: 'msg_123' },
      body: 'Hello world',
      timestamp: Date.now() / 1000,
      fromMe: false,
      hasMedia: false,
      getChat: async () => ({ id: { _serialized: 'chat_456' } }),
      getContact: async () => ({ id: { _serialized: 'contact_789' } }),
    };

    const normalized = await adapter['normalizeMessage'](mockWAMessage);

    expect(normalized.externalId).toBe('msg_123');
    expect(normalized.content).toBe('Hello world');
    expect(normalized.externalPlatform).toBe('whatsapp');
  });
});
```

### 2. Tests d'intégration

```typescript
// bridge-whatsapp/__tests__/integration/gateway-sync.test.ts

import axios from 'axios';

describe('Gateway Sync Integration', () => {
  it('should sync message to gateway', async () => {
    const message = {
      externalId: 'wa_msg_123',
      externalChatId: 'wa_chat_456',
      content: 'Test message',
      timestamp: new Date(),
    };

    const response = await axios.post(
      'http://localhost:3000/api/bridge/messages',
      message,
      {
        headers: { 'X-API-Key': process.env.GATEWAY_API_KEY },
      }
    );

    expect(response.status).toBe(201);
    expect(response.data.meeshyMessageId).toBeDefined();
  });
});
```

### 3. Tests manuels

**Checklist WhatsApp:**
- [ ] Scanner QR code et se connecter
- [ ] Recevoir un message WhatsApp → Apparaît dans Meeshy
- [ ] Envoyer un message depuis Meeshy → Reçu sur WhatsApp
- [ ] Envoyer une image WhatsApp → Visible dans Meeshy
- [ ] Envoyer une image Meeshy → Visible sur WhatsApp
- [ ] Message de groupe WhatsApp → Synchronisé
- [ ] Traduire message WhatsApp → ES → Envoyé traduit
- [ ] Reconnexion après déconnexion

**Checklist iMessage:**
- [ ] Connexion BlueBubbles
- [ ] Recevoir iMessage → Apparaît dans Meeshy
- [ ] Envoyer depuis Meeshy → Reçu sur iPhone
- [ ] Photo iMessage → Visible Meeshy
- [ ] Photo Meeshy → Visible iPhone
- [ ] Traduction bidirectionnelle

### 4. Tests de charge

```bash
# Simuler 100 messages WhatsApp entrants
node scripts/load-test-whatsapp.js --messages 100 --interval 100

# Vérifier que tous sont synchronisés
```

---

## Défis et solutions

### Défi 1: WhatsApp peut bannir les comptes unofficial

**Solution:**
- Utiliser compte dédié pour les tests
- Migrer vers Business API en production
- Rate limiting conservateur
- Monitoring des bannissements

### Défi 2: iMessage nécessite Mac toujours allumé

**Solution:**
- Mac Mini dédié dans cloud (MacStadium, AWS Mac)
- Haute disponibilité avec 2 Macs
- Monitoring uptime

### Défi 3: Médias volumineux

**Solution:**
- Compression avant upload
- Storage S3/CloudFlare R2
- CDN pour delivery
- Lazy loading

### Défi 4: Synchronisation temps réel

**Solution:**
- WebSockets pour notifications
- Queue Redis pour fiabilité
- Retry mechanism exponentiel

### Défi 5: Gestion des conversations groupées

**Solution:**
- Mapping N:1 (N externes → 1 Meeshy)
- Metadata pour tracking participants
- UI pour identifier sources

---

## Métriques de succès

**MVP (4 semaines):**
- ✅ WhatsApp: Envoi/réception messages texte
- ✅ iMessage: Envoi/réception messages texte
- ✅ Synchronisation bidirectionnelle
- ✅ Traduction automatique
- ✅ 1 conversation test stable

**V1 (8 semaines):**
- ✅ Support médias (images, vidéos, audio)
- ✅ Groupes WhatsApp
- ✅ Conversations iMessage groupées
- ✅ 10+ conversations simultanées
- ✅ Uptime > 95%

**Production (12 semaines):**
- ✅ WhatsApp Business API
- ✅ Monitoring et alertes
- ✅ Documentation complète
- ✅ Support utilisateur
- ✅ 100+ conversations
- ✅ Uptime > 99%

---

## Ressources

### Documentation

- [whatsapp-web.js](https://wwebjs.dev/)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [BlueBubbles](https://bluebubbles.app/)
- [BlueBubbles API](https://docs.bluebubbles.app/)

### Exemples de code

```bash
# Clone exemples whatsapp-web.js
git clone https://github.com/pedroslopez/whatsapp-web.js-guide

# Exemples BlueBubbles
git clone https://github.com/BlueBubblesApp/bluebubbles-server
```

---

## Prochaines étapes

1. **Aujourd'hui:** Créer `bridge-whatsapp` et tester connexion
2. **Cette semaine:** Implémenter réception/envoi messages
3. **Semaine prochaine:** Intégration Gateway
4. **Dans 2 semaines:** Prototype iMessage

**Commençons par le code de base du bridge WhatsApp?** 🚀
