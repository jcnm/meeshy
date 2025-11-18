# Technical Architecture for DMA Interoperability

**Document Type**: Architecture Specification
**Version**: 1.0
**Date**: November 18, 2024
**Audience**: Technical Teams, Architects

---

## 1. System Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   USER TIER                                      │
├──────────────────────────────────────────────────────────────────┤
│  Meeshy User      ←→      WhatsApp User (EU)                     │
│  (Meeshy App)             (WhatsApp App)                         │
│                                                                  │
│  Send: "Hi there"         ← Seamless Communication ←            │
│  Receive: "Hello back!"                                         │
└──────────────┬──────────────────────────┬────────────────────────┘
               ↓                          ↓
┌──────────────────────────┐    ┌────────────────────────┐
│   Meeshy Client SDK      │    │  WhatsApp Client       │
│  (iOS/Android/Web)       │    │  (Built-in)            │
└──────────────┬───────────┘    └────────────┬───────────┘
               ↓                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                  APPLICATION TIER                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         DMA Interoperability Adapter (NEW)              │   │
│  │  • XMPP Client                                          │   │
│  │  • Signal Protocol Engine                               │   │
│  │  • Enlistment API Server                                │   │
│  │  • Message Router                                       │   │
│  │  • Key Manager                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↑                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Meeshy Core Services                            │   │
│  │  • Messaging Service                                    │   │
│  │  • User Service                                         │   │
│  │  • Conversation Service                                 │   │
│  │  • Socket.IO Handler                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────┬────────────────────────┘
               ↓                          ↓
┌──────────────────────────┐    ┌────────────────────────┐
│  XMPP Federation Layer   │    │   Enlistment API       │
│  (TLS 1.3, mTLS)         │    │   (HTTPS, mTLS)        │
│                          │    │                        │
│  • Connection Pool       │    │  • /register           │
│  • Stanza Router         │    │  • /verify             │
│  • Presence Handler      │    │  • /revoke             │
│  • Offline Queue         │    │  • /status             │
└──────────────┬───────────┘    └────────────┬───────────┘
               ↓                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE TIER                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────┐    ┌──────────────────────┐            │
│  │  PostgreSQL DB     │    │  Redis Cache         │            │
│  │  (User Mappings)   │    │  (Session Keys)      │            │
│  │  (Key Store)       │    │  (Rate Limiting)     │            │
│  └────────────────────┘    └──────────────────────┘            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Monitoring & Observability (Prometheus + Grafana)     │    │
│  └────────────────────────────────────────────────────────┘    │
└──────────────┬──────────────────────────┬────────────────────────┘
               ↓                          ↓
┌──────────────────────────┐    ┌────────────────────────┐
│   WhatsApp DMA Server    │    │   Backup Infrastructure│
│   (EU Primary)           │    │   (EU Failover)        │
│   • Message Gateway      │    │   • Hot Standby        │
│   • User Verification    │    │   • Geo-redundant      │
│   • Interoperability     │    │                        │
└──────────────────────────┘    └────────────────────────┘
```

## 2. Component Details

### 2.1 XMPP Client

**Purpose**: Establish persistent connection to WhatsApp DMA server

**Key Responsibilities**:
- Establish TLS 1.3 connection with mTLS
- Authenticate via SASL (SCRAM-SHA-256)
- Maintain persistent presence
- Route incoming/outgoing stanzas
- Handle connection loss and reconnection

**Implementation Strategy**:
```typescript
// xmpp-client.ts
import * as Strophe from 'strophe.js';

export class DMAXMPPClient {
  private conn: Strophe.Connection;
  private jid: string; // meeshy@meeshy.dma.example.com
  private password: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(
    private config: DMAConfig,
    private signalEngine: SignalProtocolEngine
  ) {}

  async connect(): Promise<void> {
    // 1. Create connection with TLS
    this.conn = new Strophe.Connection(
      `wss://${this.config.xmppServer}:5281/ws`,
      {
        mechanisms: ['SCRAM-SHA-256'],
        withCredentials: true,
        explicitResourceBinding: true
      }
    );

    // 2. Set up handlers
    this.conn.addHandler(
      this.onMessageReceived.bind(this),
      null,
      'message',
      'chat'
    );

    this.conn.addHandler(
      this.onPresence.bind(this),
      null,
      'presence'
    );

    // 3. Connect with credentials
    this.conn.connect(this.jid, this.password, (status) => {
      this.handleConnectionStatus(status);
    });
  }

  /**
   * Send encrypted message via XMPP
   */
  async sendMessage(
    recipient: string,
    message: string,
    conversationId: string
  ): Promise<void> {
    // 1. Encrypt with Signal Protocol
    const encrypted = await this.signalEngine.encryptMessage(
      message,
      recipient
    );

    // 2. Build XMPP stanza
    const stanza = Strophe.Builder('message', {
      type: 'chat',
      to: `${recipient}@whatsapp.dma.example.com`,
      from: this.jid,
      id: this.generateStanzaId(),
      timestamp: new Date().toISOString()
    })
      .c('body')
      .t(encrypted.ciphertext)
      .up()
      .c('encryption')
      .a('type', 'signal-protocol')
      .a('version', 'v3')
      .up()
      .c('ephemeral')
      .t(encrypted.ephemeralPublicKey)
      .up()
      .c('auth')
      .t(encrypted.authenticationTag)
      .build();

    // 3. Send via XMPP
    this.conn.send(stanza);
  }

  /**
   * Handle incoming XMPP message
   */
  private async onMessageReceived(stanza: any): Promise<boolean> {
    const from = stanza.getAttribute('from');
    const sender = from.split('@')[0];

    // 1. Extract encrypted content
    const encryptedBody = stanza.querySelector('body')?.textContent;
    const ephemeralKey = stanza.querySelector('ephemeral')?.textContent;
    const authTag = stanza.querySelector('auth')?.textContent;

    // 2. Decrypt with Signal Protocol
    const decrypted = await this.signalEngine.decryptMessage(
      {
        ciphertext: encryptedBody,
        ephemeralPublicKey: ephemeralKey,
        authenticationTag: authTag
      },
      sender
    );

    // 3. Route to Meeshy application
    await this.routeIncomingMessage({
      from: sender,
      text: decrypted,
      timestamp: new Date(),
      protocol: 'imessage-dma'
    });

    return true;
  }

  private handleConnectionStatus(status: number): void {
    switch (status) {
      case Strophe.Status.CONNECTING:
        console.log('XMPP: Connecting...');
        break;
      case Strophe.Status.CONNFAIL:
        console.error('XMPP: Connection failed');
        this.attemptReconnect();
        break;
      case Strophe.Status.CONNECTED:
        console.log('XMPP: Connected');
        this.reconnectAttempts = 0;
        break;
      case Strophe.Status.DISCONNECTED:
        console.log('XMPP: Disconnected');
        this.attemptReconnect();
        break;
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error('Max reconnection attempts reached');
    }

    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000);
    this.reconnectAttempts++;

    console.log(`Reconnecting in ${backoffMs}ms...`);
    await new Promise(resolve => setTimeout(resolve, backoffMs));

    await this.connect();
  }
}
```

### 2.2 Signal Protocol Engine

**Purpose**: Encrypt/decrypt all messages with Signal Protocol

**Key Responsibilities**:
- X3DH key agreement
- Double Ratchet forward secrecy
- Key storage and management
- Message authentication

**Architecture**:
```typescript
// signal-engine.ts
export class SignalProtocolEngine {
  private sessions: Map<string, DoubleRatchetSession> = new Map();
  private keyManager: SignalKeyManager;

  async encryptMessage(
    plaintext: string,
    recipientId: string
  ): Promise<EncryptedMessage> {
    // 1. Get or create session with recipient
    let session = this.sessions.get(recipientId);

    if (!session) {
      // Create new session via X3DH
      session = await this.initiateNewSession(recipientId);
      this.sessions.set(recipientId, session);
    }

    // 2. Encrypt with Double Ratchet
    const encrypted = await session.encrypt(plaintext);

    return encrypted;
  }

  async decryptMessage(
    encryptedMessage: EncryptedMessage,
    senderId: string
  ): Promise<string> {
    // 1. Get session or create from initial message
    let session = this.sessions.get(senderId);

    if (!session) {
      session = await this.receiveInitialMessage(
        encryptedMessage,
        senderId
      );
      this.sessions.set(senderId, session);
    }

    // 2. Decrypt with Double Ratchet
    const plaintext = await session.decrypt(encryptedMessage);

    return plaintext;
  }

  private async initiateNewSession(
    recipientId: string
  ): Promise<DoubleRatchetSession> {
    // 1. Get recipient's pre-keys from Enlistment API
    const preKeyBundle = await this.getRecipientPreKeys(recipientId);

    // 2. Perform X3DH
    const sharedSecret = await this.performX3DH(
      this.keyManager.getIdentityKeyPair(),
      preKeyBundle
    );

    // 3. Create ratchet session
    const session = new DoubleRatchetSession(sharedSecret);

    return session;
  }

  private async receiveInitialMessage(
    encryptedMessage: EncryptedMessage,
    senderId: string
  ): Promise<DoubleRatchetSession> {
    // 1. Perform X3DH with sender's ephemeral key
    const sharedSecret = await this.performX3DH(
      this.keyManager.getIdentityKeyPair(),
      encryptedMessage.ephemeralPublicKey
    );

    // 2. Create ratchet session
    const session = new DoubleRatchetSession(sharedSecret);

    return session;
  }

  private async performX3DH(
    myIdentityKeyPair: IdentityKeyPair,
    recipientPreKeyBundle: PreKeyBundle
  ): Promise<Buffer> {
    // Implementation per Signal Protocol spec
    // ... (see SIGNAL_PROTOCOL_PLAN.md)
  }
}
```

### 2.3 Enlistment API Server

**Purpose**: Verify Meeshy users exist and own their accounts

**Endpoints**:

```typescript
// enlistment-api.ts
import express from 'express';

const router = express.Router();

/**
 * POST /enlistment/register
 * Called by: Client app during signup
 * Purpose: Register user with Meeshy's enlistment service
 */
router.post('/register', async (req, res) => {
  const { meeshy_uid, phone_number, public_key, proof } = req.body;

  // 1. Verify user exists in Meeshy
  const user = await db.users.findById(meeshy_uid);
  if (!user || user.phone !== phone_number) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // 2. Verify cryptographic proof
  const isValid = await verifyProof(meeshy_uid, phone_number, proof, user.publicKey);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid proof' });
  }

  // 3. Create verification token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.enlistment.create({
    user_id: meeshy_uid,
    token,
    public_key,
    expires_at: expiresAt,
    phone_number
  });

  // 4. Return token
  res.json({
    verified: true,
    token,
    expires_at: expiresAt
  });
});

/**
 * GET /enlistment/status/:uid
 * Called by: WhatsApp to verify user still enrolled
 */
router.get('/status/:uid', async (req, res) => {
  const { uid } = req.params;

  const enlistment = await db.enlistment.findByUserId(uid);

  if (!enlistment || enlistment.expires_at < new Date()) {
    return res.status(404).json({ enrolled: false });
  }

  res.json({
    enrolled: true,
    last_verified: enlistment.updated_at,
    phone_number: enlistment.phone_number
  });
});

/**
 * POST /enlistment/revoke
 * Called by: User deleting account
 * Purpose: Revoke WhatsApp interoperability
 */
router.post('/revoke', async (req, res) => {
  const { meeshy_uid, reason } = req.body;

  await db.enlistment.delete(meeshy_uid);
  await db.audit.log({
    action: 'enlistment_revoked',
    user_id: meeshy_uid,
    reason
  });

  res.json({ revoked: true });
});

export default router;
```

### 2.4 Message Router

**Purpose**: Route messages between XMPP and Meeshy application

**Flow**:
```
XMPP Message → Decrypt → Route → MessagingService → Database/Socket.IO
```

## 3. Integration Points with Existing Meeshy

### Minimal Changes to Existing Code

```
Current:
  User → MessagingService → Database → Socket.IO

New:
  User → MessagingService → [NEW: SignalEngine] → XMPP → WhatsApp
                                  ↓
                            Database → Socket.IO
```

### No Changes Needed
- User model schema (already supports metadata)
- Conversation model (already supports protocol field)
- Message model (already supports encrypted flag)
- Socket.IO events (can reuse existing)

## 4. Data Flow Diagrams

### Send Message Flow

```
User types "Hello"
    ↓
MessagingService.send()
    ↓
[Is recipient WhatsApp user?]
    ├─ YES → SignalEngine.encrypt()
    │        ↓
    │        XMPPClient.send(encrypted)
    │        ↓
    │        WhatsApp Server
    │        ↓
    │        WhatsApp recipient app
    │
    └─ NO → Store in DB → Socket.IO → Meeshy user
```

### Receive Message Flow

```
WhatsApp server sends XMPP stanza
    ↓
XMPPClient.onMessage()
    ↓
SignalEngine.decrypt()
    ↓
MessagingService.handleIncomingMessage()
    ↓
Store in database
    ↓
Socket.IO broadcast to recipient's Meeshy client
    ↓
Message appears in chat
```

## 5. Infrastructure Requirements

### Primary Infrastructure (EU)

```
┌─────────────────────────────────────┐
│  Load Balancer (HTTPS/WSS)          │
│  (Cloudflare / AWS ALB)             │
└─────────────────┬───────────────────┘
                  ↓
    ┌─────────────────────────────────┐
    │ XMPP Server Cluster (3 nodes)   │
    │ - Load balanced                 │
    │ - Stateless                     │
    │ - Connection pooling            │
    └─────────────────────────────────┘
                  ↓
    ┌─────────────────────────────────┐
    │ Application Tier (5 pods)       │
    │ - Kubernetes                    │
    │ - Auto-scaling                  │
    │ - Health checks                 │
    └─────────────────────────────────┘
                  ↓
    ┌─────────────────────────────────┐
    │ Database Tier                   │
    │ - PostgreSQL Primary (EU-1)     │
    │ - PostgreSQL Replica (EU-2)     │
    │ - Automated failover            │
    └─────────────────────────────────┘
                  ↓
    ┌─────────────────────────────────┐
    │ Cache Tier                      │
    │ - Redis Cluster (6 nodes)       │
    │ - Replication 2x                │
    │ - Eviction policy: allkeys-lru  │
    └─────────────────────────────────┘
```

### Backup Infrastructure (EU Failover)

- **Location**: Different EU zone
- **Type**: Hot standby
- **RTO**: 5 minutes
- **RPO**: <1 minute
- **Failover**: Automated via Consul/etcd

## 6. Security Architecture

### Network Security

```
┌──────────────────────────────────────┐
│  TLS 1.3 + mTLS (Client ↔ Server)    │
│  - Certificate pinning               │
│  - OCSP stapling                     │
│  - CRL checking                      │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│  Signal Protocol E2EE                │
│  - X3DH + Double Ratchet             │
│  - Perfect forward secrecy           │
│  - Deniability                       │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│  Message Authentication               │
│  - HMAC-SHA256                       │
│  - Timestamp                         │
│  - Sequence numbers                  │
└──────────────────────────────────────┘
```

## 7. Monitoring & Observability

### Metrics

```
XMPP Layer:
- Connections/second
- Connection duration
- Bytes sent/received
- Reconnection rate
- Stanza latency

Signal Layer:
- Encryption time
- Decryption time
- Key generation time
- Session ratchet rate
- Failed decryptions

Application Layer:
- Message throughput
- Error rate
- P99 latency
- User active sessions
- Enlistment API response time
```

### Logging

```
Security Events:
- Enlistment registration
- User verification
- Key rotation
- Failed authentications
- Message decryption failures

Operational Events:
- Connection established/lost
- Server startup/shutdown
- Database migration
- Configuration changes
- Backup completed
```

## 8. Deployment Strategy

### Phase 2 Deployment (Staging)

1. **Week 1-2**: Developer environment
2. **Week 3-4**: Internal staging (small load test)
3. **Week 5-6**: Meta DMA staging servers (test vectors)
4. **Week 7-8**: Load testing (1000 users)

### Phase 3 Deployment (Production)

1. **Week 1**: Canary deployment (1% users)
2. **Week 2**: Progressive rollout (10% → 50% → 100%)
3. **Week 3-4**: Monitor and stabilize

---

**Version**: 1.0
**Next Step**: Begin Phase 2 implementation
**Questions**: Contact technical@meeshy.app
