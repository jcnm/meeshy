# Architecture de Chiffrement Hybride - Meeshy

## 🎯 Problématique

**Conflit fondamental**:
- ✅ Chiffrement E2E = Privacy maximale, mais pas de traduction serveur
- ✅ Traduction serveur = UX optimale, mais nécessite accès au contenu
- ❌ Impossible d'avoir les deux simultanément avec E2E pur

## 💡 Solution: Chiffrement Hybride à 3 Niveaux

### Niveau 1: E2E Pur (`e2e_only`)
**Maximum Privacy - Pas de traduction serveur**

```
[Client A] ---(encrypted)---> [Server] ---(encrypted)---> [Client B]
                                  |
                                  ❌ Cannot decrypt
                                  ❌ Cannot translate
```

- Message chiffré avec clés utilisateurs uniquement
- Serveur stocke ciphertext sans pouvoir déchiffrer
- Traduction côté client uniquement (coûteux, lent)
- **Use case**: Conversations ultra-sensibles (juridique, médical, finance)

### Niveau 2: Hybride (`hybrid`) ⭐ **RECOMMANDÉ**
**Privacy + Traduction serveur**

```
[Client A] ---(double encrypted)---> [Server] ---(re-encrypted)---> [Client B]
                                         |
                                    ✅ Decrypt with server key
                                    ✅ Translate
                                    ✅ Re-encrypt for recipient
```

**Double chiffrement**:
1. **Layer 1 - E2E**: Message chiffré pour le destinataire (clé publique destinataire)
2. **Layer 2 - Server**: Layer 1 chiffré avec clé serveur (AES-256-GCM)

**Flux de traduction**:
1. Client A chiffre: `plaintext → E2E encrypt → server encrypt → double_ciphertext`
2. Serveur reçoit `double_ciphertext`
3. Serveur déchiffre Layer 2: `double_ciphertext → server decrypt → e2e_ciphertext`
4. Serveur déchiffre Layer 1: `e2e_ciphertext → server decrypt → plaintext` (⚠️ temporaire en RAM)
5. Serveur traduit: `plaintext (FR) → translate → plaintext (EN)`
6. Serveur chiffre pour destinataire: `plaintext (EN) → E2E encrypt (client B key) → ciphertext_B`
7. Serveur envoie `ciphertext_B` à Client B
8. Client B déchiffre: `ciphertext_B → E2E decrypt → plaintext (EN)`

**Sécurité**:
- Plaintext existe en RAM serveur < 100ms (le temps de traduire)
- Clé serveur stockée dans HSM ou AWS KMS (production)
- Logs d'audit pour chaque déchiffrement serveur
- Rotation des clés serveur tous les 30 jours

### Niveau 3: Aucun Chiffrement (`none`)
**Compatibilité - Comportement actuel**

```
[Client A] ---(plaintext)---> [Server] ---(plaintext)---> [Client B]
                                  |
                             ✅ Full access
                             ✅ Translate instantly
```

- Comportement actuel de Meeshy
- Pas de chiffrement E2E
- Traduction serveur instantanée
- **Use case**: Conversations publiques, marketing, support

## 🔧 Configuration à 2 Niveaux

La configuration du chiffrement fonctionne à **2 niveaux distincts**:

### 📋 Niveau 1: Préférences Utilisateur (Paramètres globaux)

**Champs User**:
- `defaultEncryptionMode`: Mode par défaut pour les **nouvelles conversations** créées
- `allowServerSideTranslationAt`: Autorisation de déchiffrement serveur (null = refusé)

**Rôle**:
- Détermine le **comportement par défaut** quand l'utilisateur crée une conversation
- Contrôle si l'utilisateur **peut participer** aux conversations en mode `hybrid`
- Modifiable à tout moment dans les paramètres utilisateur

**Exemples**:
```typescript
// Utilisateur A (privacy-conscious)
{
  defaultEncryptionMode: 'e2e_only',
  allowServerSideTranslationAt: null // Refuse traduction serveur
}

// Utilisateur B (équilibre privacy/UX)
{
  defaultEncryptionMode: 'hybrid',
  allowServerSideTranslationAt: '2025-01-16T10:30:00Z' // Accepte depuis cette date
}

// Utilisateur C (public/marketing)
{
  defaultEncryptionMode: 'none',
  allowServerSideTranslationAt: '2025-01-16T10:30:00Z'
}
```

### 💬 Niveau 2: Configuration Conversation (Immutable)

**Champs Conversation**:
- `encryptionMode`: Mode ACTUEL de cette conversation spécifique
- `serverEncryptionKey`: Clé serveur (si mode = hybrid)

**Rôle**:
- Détermine **COMMENT cette conversation** fonctionne
- Défini à la **création** et **NE PEUT PAS être changé** (sécurité!)
- S'applique à **tous les participants** de la conversation

**Règles de création**:
1. Utilisateur crée conversation → UI pré-sélectionne `user.defaultEncryptionMode`
2. Utilisateur peut override pour CETTE conversation
3. Backend vérifie:
   - Si mode = `hybrid` → TOUS les participants doivent avoir `allowServerSideTranslationAt !== null`
   - Si au moins 1 participant refuse → Fallback automatique vers `e2e_only` ou erreur
4. Conversation créée avec `encryptionMode` **immutable**

**Exemples de conversations**:
```typescript
// Conversation #1: Équipe marketing (tous acceptent traduction serveur)
{
  encryptionMode: 'hybrid',
  serverEncryptionKey: 'encrypted_key_abc123',
  participants: [userA, userB, userC] // Tous ont allowServerSideTranslationAt !== null
}

// Conversation #2: Discussion juridique (au moins 1 refuse)
{
  encryptionMode: 'e2e_only', // Fallback car userD refuse traduction serveur
  serverEncryptionKey: null,
  participants: [userA, userB, userD] // userD.allowServerSideTranslationAt === null
}

// Conversation #3: Chat public
{
  encryptionMode: 'none',
  serverEncryptionKey: null,
  participants: [userA, userE, userF]
}
```

### 🔄 Interaction des 2 Niveaux

```
[Création Conversation]
        ↓
1. UI pré-sélectionne: user.defaultEncryptionMode
        ↓
2. Utilisateur peut override
        ↓
3. Backend valide:
   - Si hybrid → Vérifier tous participants allowServerSideTranslationAt !== null
   - Sinon → Erreur ou fallback e2e_only
        ↓
4. Conversation créée avec encryptionMode
        ↓
5. IMMUTABLE! encryptionMode ne change plus jamais
```

**Cas d'usage**:
- Utilisateur peut changer `defaultEncryptionMode` dans ses paramètres → N'affecte que les **futures** conversations
- Utilisateur désactive `allowServerSideTranslationAt` → Les conversations `hybrid` existantes deviennent inutilisables pour lui (fallback `e2e_only`)
- Créateur de conversation peut choisir mode différent de son default pour une conversation spécifique

## 🏗️ Implémentation

### 1. Base de Données (Prisma)

La configuration du chiffrement fonctionne à **2 niveaux**:

#### A. Niveau Utilisateur (Préférences globales)
Détermine les **paramètres par défaut** pour les **nouvelles conversations** créées par cet utilisateur.

```prisma
model User {
  ...
  // Autorisation traduction serveur (null = désactivé, DateTime = activé)
  // Utilisé pour vérifier si l'utilisateur PEUT participer aux conversations hybrid
  allowServerSideTranslationAt DateTime? @default(now())

  // Mode de chiffrement PAR DÉFAUT pour les nouvelles conversations créées
  // Quand l'utilisateur crée une conversation, ce mode est utilisé
  defaultEncryptionMode EncryptionMode @default(hybrid)
  ...
}
```

#### B. Niveau Conversation (Configuration actuelle)
Détermine COMMENT cette conversation spécifique fonctionne. **Immutable après création!**

```prisma
model Conversation {
  ...
  // Mode de chiffrement ACTUEL de cette conversation
  // ⚠️ NE PEUT PAS être changé après création (sécurité)
  encryptionMode EncryptionMode @default(none)

  // Clé serveur chiffrée (pour mode hybrid uniquement)
  serverEncryptionKey String? // Encrypted with master key
  serverKeyCreatedAt DateTime?
  serverKeyExpiresAt DateTime? // Rotation tous les 30j
  ...
}

enum EncryptionMode {
  none           // Pas de chiffrement
  hybrid         // Chiffrement hybride (E2E + serveur)
  e2e_only       // E2E pur (pas de traduction serveur)
}
```

### 2. Backend (MessagingService)

```typescript
class MessagingService {
  private serverKeyManager: ServerKeyManager;

  async handleMessage(request: MessageRequest, ...): Promise<MessageResponse> {
    // 1. Déterminer le mode de chiffrement de la conversation
    const conversation = await this.getConversation(request.conversationId);
    const encryptionMode = conversation.encryptionMode;

    if (encryptionMode === 'none') {
      // Flux actuel: pas de chiffrement
      return this.handlePlaintextMessage(request);
    }

    if (encryptionMode === 'e2e_only') {
      // E2E pur: stocker tel quel, pas de traduction
      return this.handleE2EOnlyMessage(request);
    }

    if (encryptionMode === 'hybrid') {
      // Chiffrement hybride: déchiffrer, traduire, re-chiffrer
      return this.handleHybridMessage(request, conversation);
    }
  }

  private async handleHybridMessage(
    request: MessageRequest,
    conversation: Conversation
  ): Promise<MessageResponse> {
    // 1. Vérifier que tous les participants autorisent la traduction serveur
    const participants = await this.getConversationParticipants(conversation.id);
    const allAllowTranslation = participants.every(p => p.allowServerSideTranslationAt !== null);

    if (!allAllowTranslation) {
      // Fallback to e2e_only si un participant refuse
      return this.handleE2EOnlyMessage(request);
    }

    // 2. Obtenir la clé serveur de la conversation
    const serverKey = await this.serverKeyManager.getConversationKey(
      conversation.id,
      conversation.serverEncryptionKey
    );

    // 3. Déchiffrer le message (double déchiffrement)
    const encryptedData = request.encryptedData!;
    const plaintextBuffer = await this.decryptHybridMessage(
      encryptedData,
      serverKey
    );
    const plaintext = plaintextBuffer.toString('utf-8');

    // 4. Wipe plaintext buffer ASAP après utilisation
    this.secureWipe(plaintextBuffer);

    // 5. Traduire le message pour chaque participant
    const translations = await this.translateForParticipants(
      plaintext,
      request.originalLanguage,
      participants
    );

    // 6. Chiffrer chaque traduction pour son destinataire
    const encryptedTranslations = await Promise.all(
      translations.map(async (translation) => {
        const recipientKeyPackage = await this.getKeyPackage(translation.userId);
        return {
          userId: translation.userId,
          language: translation.language,
          encryptedData: await this.encryptForRecipient(
            translation.text,
            recipientKeyPackage
          ),
        };
      })
    );

    // 7. Stocker le message CHIFFRÉ (pas le plaintext)
    const message = await this.saveEncryptedMessage({
      ...request,
      encryptedData: encryptedData, // Message original chiffré
      encryptedTranslations, // Traductions chiffrées
    });

    // 8. Log d'audit pour sécurité
    await this.mlsService.logAuditEvent({
      eventType: 'hybrid_message_translated',
      conversationId: conversation.id,
      details: {
        messageId: message.id,
        languagesTranslated: translations.map(t => t.language),
      },
    });

    return this.createSuccessResponse(message, ...);
  }

  private async decryptHybridMessage(
    encryptedData: EncryptedData,
    serverKey: Buffer
  ): Promise<Buffer> {
    // Layer 2: Déchiffrer avec clé serveur (AES-256-GCM)
    const layer1Ciphertext = await this.serverKeyManager.decrypt(
      Buffer.from(encryptedData.ciphertext, 'base64'),
      Buffer.from(encryptedData.nonce, 'base64'),
      serverKey
    );

    // Layer 1: Déchiffrer E2E (via MLS/TweetNaCl)
    const plaintext = await this.mlsClient.decrypt(layer1Ciphertext);

    return plaintext;
  }

  private secureWipe(buffer: Buffer): void {
    // Overwrite buffer with zeros before GC
    buffer.fill(0);
  }
}
```

### 3. Gestionnaire de Clés Serveur

```typescript
class ServerKeyManager {
  private masterKey: Buffer; // Loaded from AWS KMS or env var
  private keyCache: Map<string, { key: Buffer; expiresAt: Date }>;

  constructor() {
    // Load master key from secure storage (AWS KMS, HashiCorp Vault, etc.)
    this.masterKey = this.loadMasterKey();
    this.keyCache = new Map();
  }

  /**
   * Get or create server encryption key for a conversation
   */
  async getConversationKey(
    conversationId: string,
    encryptedKey?: string
  ): Promise<Buffer> {
    // Check cache first
    const cached = this.keyCache.get(conversationId);
    if (cached && cached.expiresAt > new Date()) {
      return cached.key;
    }

    if (encryptedKey) {
      // Decrypt existing key with master key
      const key = await this.decryptWithMasterKey(encryptedKey);
      this.keyCache.set(conversationId, {
        key,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h cache
      });
      return key;
    }

    // Generate new key for conversation
    const newKey = crypto.randomBytes(32); // AES-256
    const encryptedNewKey = await this.encryptWithMasterKey(newKey);

    // Store in database
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        serverEncryptionKey: encryptedNewKey,
        serverKeyCreatedAt: new Date(),
        serverKeyExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    this.keyCache.set(conversationId, {
      key: newKey,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return newKey;
  }

  /**
   * Encrypt data with server key (AES-256-GCM)
   */
  async encrypt(plaintext: Buffer, nonce: Buffer, key: Buffer): Promise<Buffer> {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([encrypted, authTag]);
  }

  /**
   * Decrypt data with server key (AES-256-GCM)
   */
  async decrypt(ciphertext: Buffer, nonce: Buffer, key: Buffer): Promise<Buffer> {
    const authTagLength = 16; // GCM auth tag is always 16 bytes
    const encrypted = ciphertext.slice(0, -authTagLength);
    const authTag = ciphertext.slice(-authTagLength);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  private loadMasterKey(): Buffer {
    // In production: load from AWS KMS, Vault, etc.
    // In development: load from env var
    const masterKeyHex = process.env.MLS_MASTER_KEY;
    if (!masterKeyHex) {
      throw new Error('MLS_MASTER_KEY environment variable not set');
    }
    return Buffer.from(masterKeyHex, 'hex');
  }

  private async encryptWithMasterKey(data: Buffer): Promise<string> {
    const nonce = crypto.randomBytes(12); // GCM nonce
    const encrypted = await this.encrypt(data, nonce, this.masterKey);
    return Buffer.concat([nonce, encrypted]).toString('base64');
  }

  private async decryptWithMasterKey(encryptedData: string): Promise<Buffer> {
    const buffer = Buffer.from(encryptedData, 'base64');
    const nonce = buffer.slice(0, 12);
    const ciphertext = buffer.slice(12);
    return this.decrypt(ciphertext, nonce, this.masterKey);
  }
}
```

### 4. Frontend (UI/UX)

#### A. Création de Conversation

Le mode de chiffrement est **pré-sélectionné** selon `user.defaultEncryptionMode`:

```typescript
interface CreateConversationForm {
  name: string;
  participants: string[];
  encryptionMode: EncryptionMode; // Pré-rempli avec user.defaultEncryptionMode
}

// UI Component - Mode pré-sélectionné selon préférences utilisateur
const [encryptionMode, setEncryptionMode] = useState<EncryptionMode>(
  currentUser.defaultEncryptionMode // 'hybrid' par défaut
);

<Select
  label="Mode de chiffrement"
  value={encryptionMode}
  onChange={setEncryptionMode}
>
  <option value="none">
    🔓 Aucun chiffrement
    (Traduction instantanée, compatibilité maximale)
  </option>

  <option value="hybrid">
    🔐 Chiffrement hybride (Recommandé)
    (Privacy + Traduction serveur)
  </option>

  <option value="e2e_only">
    🔒 Chiffrement E2E pur
    (Privacy maximale, traduction client uniquement)
  </option>
</Select>

{/* Avertissement si mode hybrid mais allowServerSideTranslationAt === null */}
{encryptionMode === 'hybrid' && !currentUser.allowServerSideTranslationAt && (
  <Alert type="warning">
    ⚠️ Vous devez activer "Autoriser traduction serveur" dans vos paramètres
    pour utiliser le mode hybride.
  </Alert>
)}
```

**Flux de création**:
1. Utilisateur ouvre "Nouvelle conversation"
2. UI pré-sélectionne `user.defaultEncryptionMode` (hybrid par défaut)
3. Utilisateur peut changer le mode pour CETTE conversation spécifique
4. Backend vérifie que tous les participants ont `allowServerSideTranslationAt !== null` si mode = hybrid
5. Conversation créée avec `encryptionMode` choisi (**immutable après création!**)
```

#### B. Préférences Utilisateur

```typescript
// User Settings
<Toggle
  label="Autoriser la traduction serveur"
  description="Le serveur pourra déchiffrer vos messages temporairement pour les traduire. Désactiver cette option empêchera les traductions dans les conversations en mode hybride."
  checked={user.allowServerSideTranslationAt !== null}
  onChange={(enabled) => updateUserPreference({
    allowServerSideTranslation: enabled // API accepte boolean, backend convertit en DateTime
  })}
/>

{user.allowServerSideTranslationAt && (
  <Text size="sm" color="gray">
    Activé le {formatDate(user.allowServerSideTranslationAt)}
  </Text>
)}
```

### 5. Types TypeScript

```typescript
// shared/types/messaging.ts
export type EncryptionMode = 'none' | 'hybrid' | 'e2e_only';

export interface MessageRequest {
  ...
  encryptionMode?: EncryptionMode; // Hérité de la conversation
  encryptedData?: {
    ciphertext: string; // Base64
    nonce: string; // Base64
    senderKeyHash: string;
    encryptionType: 'mls_1_1' | 'mls_group' | 'hybrid_double';
    groupEpoch?: number;
    // Pour hybrid uniquement:
    serverLayerNonce?: string; // Nonce pour déchiffrement Layer 2
  };
}

export interface EncryptedTranslation {
  userId: string;
  language: string;
  encryptedData: {
    ciphertext: string;
    nonce: string;
  };
}
```

## 🔒 Sécurité

### Menaces et Mitigations

| Menace | Mitigation |
|--------|-----------|
| Serveur compromis | Master key dans HSM/KMS hors serveur |
| Logs contenant plaintext | Plaintext jamais loggé, wipe immédiat |
| Clé serveur volée | Rotation tous les 30j, invalidation immédiate possible |
| Attaque temporelle | Plaintext en RAM < 100ms |
| Insider threat | Audit logs pour chaque déchiffrement |
| Rejeu d'attaque | Nonces uniques, vérification epoch |

### Audit Trail

Chaque opération de déchiffrement serveur est loguée:
```typescript
{
  eventType: 'hybrid_message_decrypted',
  timestamp: '2025-01-16T12:34:56Z',
  conversationId: 'conv_123',
  messageId: 'msg_456',
  userId: 'user_789',
  serverKeyVersion: 'v2',
  ipAddress: '192.168.1.1',
  purpose: 'translation',
  languagesTranslated: ['fr', 'en', 'es'],
}
```

## 📊 Comparaison des Modes

| Feature | None | Hybrid | E2E Only |
|---------|------|--------|----------|
| Privacy | ❌ Low | 🟡 Medium | ✅ High |
| Traduction serveur | ✅ Instant | ✅ Instant | ❌ No |
| Traduction client | ⚠️ Possible | ⚠️ Fallback | ✅ Required |
| Performance | ✅ Excellent | 🟡 Good | ❌ Slow |
| DMA Compliance | ❌ No | ✅ Yes | ✅ Yes |
| Complexité | ✅ Simple | 🟡 Medium | ❌ Complex |
| Use Case | Public | Business | Sensitive |

## 🚀 Migration

### Phase 1: Infrastructure (2 semaines)
- ✅ Ajouter `encryptionMode` dans Prisma
- ✅ Implémenter `ServerKeyManager`
- ✅ Modifier `MessagingService` pour supporter les 3 modes
- ✅ Tests unitaires

### Phase 2: Frontend (1 semaine)
- Ajouter UI de sélection du mode de chiffrement
- Implémenter double chiffrement côté client
- Tester flux hybrid complet

### Phase 3: Production (1 semaine)
- Setup AWS KMS pour master key
- Migration progressive: conversations existantes = `none`
- Nouvelles conversations = `hybrid` par défaut
- Monitoring et alertes

## 📝 Notes

- **Conversations existantes**: Resteront en mode `none` (pas de chiffrement)
- **Nouvelles conversations**: Mode `hybrid` par défaut (recommandé)
- **Changement de mode**: Impossible après création (recréer conversation)
- **Compatibilité**: Mode `none` assurera compatibilité avec clients anciens

## 🔗 Références

- [MLS RFC 9420](https://www.rfc-editor.org/rfc/rfc9420.html)
- [Digital Markets Act - Article 7](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R1925)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [TweetNaCl Crypto](https://tweetnacl.js.org/)
