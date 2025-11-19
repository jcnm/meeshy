# Unified Encryption Architecture for Meeshy Platform (REVISED)

**Date:** November 19, 2025
**Status:** PROPOSED - Ready for Implementation
**Approach:** Real DMA (EU Digital Markets Act) with Signal Protocol
**Architecture:** Conversation-level encryption with DateTime tracking

---

## Executive Summary

This document proposes a **unified encryption architecture** where:
- ✅ **Encryption is per-CONVERSATION** (not per-message)
- ✅ **DateTime fields track when encryption was enabled** (immutable, can't be disabled)
- ✅ **System messages are NEVER encrypted** (no need for encryption flags)
- ✅ **Same `Message` collection** handles both encrypted and plaintext
- ✅ **Real DMA compliance** - for EU interoperability
- ✅ **Backward compatible** - existing plaintext messages remain functional

---

## Core Architecture Principles

### 1️⃣ Encryption is Conversation-Level

```typescript
// Encryption controlled at conversation level ONLY
conversation.encryptionEnabledAt: DateTime | null

// null = plaintext conversation
// non-null = encrypted conversation (since that timestamp)
```

**Benefits:**
- ✅ Simpler logic (check one field, not per-message)
- ✅ Clear user expectation ("This conversation is encrypted")
- ✅ Immutable (once enabled, can't be disabled - can't set back to null)
- ✅ Audit trail (know exactly when encryption was enabled)

### 2️⃣ System Messages Are Never Encrypted

```typescript
// Derive encryption status from message type
if (message.messageType === "system") {
  // ALWAYS plaintext (no exceptions)
  // Examples: "User joined", "Settings changed", "Encryption enabled"
} else {
  // Check conversation setting
  if (conversation.encryptionEnabledAt !== null) {
    // Message is encrypted
  } else {
    // Message is plaintext
  }
}
```

**Benefits:**
- ✅ No encryption flag needed on messages
- ✅ System messages are metadata (server already knows)
- ✅ Clear exception rule

### 3️⃣ Immutable Encryption

```typescript
// Can enable encryption (null → timestamp)
conversation.encryptionEnabledAt = null → new Date()  ✅

// Cannot disable encryption (timestamp → null)
conversation.encryptionEnabledAt = <timestamp> → null  ❌ IMPOSSIBLE
```

**Benefits:**
- ✅ No "disable encryption" attack vector
- ✅ Users trust encryption stays enabled
- ✅ Database constraint prevents disabling

---

## Schema Design

### Message Model (SIMPLIFIED - No Encryption Fields)

```prisma
/// Message dans une conversation
model Message {
  id                String                @id @default(auto()) @map("_id") @db.ObjectId
  conversationId    String                @db.ObjectId
  senderId          String?               @db.ObjectId
  anonymousSenderId String?               @db.ObjectId

  // Content fields
  content           String                // Plaintext OR "[Encrypted]" placeholder

  // Message metadata
  originalLanguage  String                @default("fr")
  messageType       String                @default("text")  // "text", "image", "file", "audio", "video", "system"
  isEdited          Boolean               @default(false)
  editedAt          DateTime?
  isDeleted         Boolean               @default(false)
  deletedAt         DateTime?
  replyToId         String?               @db.ObjectId
  validatedMentions String[]              @default([])

  // 🆕 Encrypted content (only present if conversation.encryptionEnabledAt != null)
  encryptedContent  String?               // Base64 encrypted payload (null for plaintext messages)
  encryptionMetadata Json?                // { protocol, keyId, iv, authTag, messageNumber, ... }

  metadata          Json?
  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt

  // Relations
  status            MessageStatus[]       @relation("MessageStatusMessage")
  translations      MessageTranslation[]
  attachments       MessageAttachment[]
  reactions         Reaction[]            @relation("MessageReactions")
  mentions          Mention[]             @relation("MessageMentions")
  notifications     Notification[]        @relation("NotificationMessage")
  replyTo           Message?              @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  replies           Message[]             @relation("MessageReplies")
  anonymousSender   AnonymousParticipant? @relation("AnonymousMessageSender", fields: [anonymousSenderId], references: [id])
  sender            User?                 @relation("MessageSender", fields: [senderId], references: [id])
  conversation      Conversation          @relation(fields: [conversationId], references: [id])

  @@index([conversationId, createdAt])
  @@index([messageType])
}
```

**Key Points:**
- ❌ **No `isEncrypted` field** - derive from conversation + messageType
- ✅ **`encryptedContent`** - stores encrypted payload (null for plaintext)
- ✅ **`encryptionMetadata`** - stores encryption details (protocol, keys, etc.)
- ✅ **`messageType`** - "system" messages are NEVER encrypted

### Conversation Model (DateTime-based Encryption)

```prisma
/// Conversation entre utilisateurs (direct, group, public, global)
model Conversation {
  id                    String                   @id @default(auto()) @map("_id") @db.ObjectId
  identifier            String                   @unique
  type                  String
  title                 String?
  description           String?
  image                 String?
  avatar                String?
  communityId           String?                  @db.ObjectId
  isActive              Boolean                  @default(true)
  isArchived            Boolean                  @default(false)
  lastMessageAt         DateTime                 @default(now())

  // 🆕 ENCRYPTION CONTROL (DateTime-based, immutable)
  encryptionEnabledAt   DateTime?                // null = plaintext, non-null = encrypted since this date
  encryptionProtocol    String?                  @default("signal_v3")  // "signal_v3", "mls_v1", etc.
  encryptionEnabledBy   String?                  @db.ObjectId  // User who enabled encryption (audit)

  metadata              Json?
  createdAt             DateTime                 @default(now())
  updatedAt             DateTime                 @updatedAt

  // Relations
  anonymousParticipants AnonymousParticipant[]
  members               ConversationMember[]
  preferences           ConversationPreference[]
  shareLinks            ConversationShareLink[]
  community             Community?               @relation(fields: [communityId], references: [id])
  messages              Message[]
  messageStatuses       MessageStatus[]
  typingIndicators      TypingIndicator[]
  callSessions          CallSession[]
  userPreferences       UserConversationPreferences[]
  encryptionEnabledByUser User?                  @relation("ConversationEncryptionEnabler", fields: [encryptionEnabledBy], references: [id], onDelete: SetNull)

  @@index([encryptionEnabledAt])
  @@index([createdAt])
}
```

**Key Points:**
- ✅ **`encryptionEnabledAt: DateTime?`** - null = plaintext, non-null = encrypted
- ✅ **Immutable** - once set, cannot be changed back to null (enforce in application logic)
- ✅ **`encryptionEnabledBy`** - tracks who enabled encryption (accountability)
- ✅ **`encryptionProtocol`** - which protocol to use (Signal, MLS, etc.)

### User Model (Encryption Keys & Preferences)

```prisma
model User {
  id                          String                   @id @default(auto()) @map("_id") @db.ObjectId
  username                    String                   @unique
  // ... existing fields ...

  // 🆕 Signal Protocol Keys (generated when user opts into encryption)
  signalIdentityKeyPublic     String?                  // Public identity key (shareable)
  signalIdentityKeyPrivate    String?                  // Private identity key (encrypted with user password)
  signalRegistrationId        Int?                     // Registration ID (4-byte unique ID)
  signalPreKeyBundleVersion   Int?                     @default(0)  // Current pre-key bundle version
  lastKeyRotation             DateTime?                // Last time keys were rotated

  // 🆕 User Encryption Preference
  encryptionPreference        String                   @default("optional")  // "disabled", "optional", "always"

  // ... existing fields ...
  createdAt                   DateTime                 @default(now())
  updatedAt                   DateTime                 @updatedAt

  // ... existing relations ...
  enabledEncryptionFor        Conversation[]           @relation("ConversationEncryptionEnabler")
}
```

**Key Points:**
- ✅ **Signal Protocol keys** - stored per user (generated on demand)
- ✅ **`encryptionPreference`** - user's default preference for new conversations
- ✅ **Keys are optional** - only generated when user enables encryption

---

## Encryption Logic

### How to Determine if a Message is Encrypted

```typescript
function isMessageEncrypted(message: Message, conversation: Conversation): boolean {
  // Rule 1: System messages are NEVER encrypted
  if (message.messageType === "system") {
    return false;
  }

  // Rule 2: Check if conversation has encryption enabled
  if (conversation.encryptionEnabledAt === null) {
    // Conversation is plaintext
    return false;
  }

  // Rule 3: Check if message was sent AFTER encryption was enabled
  if (message.createdAt < conversation.encryptionEnabledAt) {
    // Message was sent before encryption was enabled (historical plaintext)
    return false;
  }

  // Message is encrypted
  return true;
}
```

**Benefits:**
- ✅ No field needed on Message
- ✅ Clear derivation logic
- ✅ Handles transition period (messages before/after encryption)

### Message Send Flow

```typescript
async function sendMessage(
  conversationId: string,
  content: string,
  messageType: string = "text"
): Promise<Message> {
  // 1. Get conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { encryptionEnabledAt, encryptionProtocol }
  });

  // 2. Determine if encryption is required
  const encryptionRequired = conversation.encryptionEnabledAt !== null;
  const isSystemMessage = messageType === "system";

  // 3. Handle system messages (always plaintext)
  if (isSystemMessage) {
    return await prisma.message.create({
      data: {
        conversationId,
        senderId: currentUserId,
        content: content,  // Plaintext system message
        messageType: "system",
        encryptedContent: null,
        encryptionMetadata: null
      }
    });
  }

  // 4. Handle encrypted conversation
  if (encryptionRequired) {
    try {
      // Encrypt on CLIENT SIDE (before sending to server)
      const encryptedPayload = await encryptMessageClientSide(
        content,
        conversationId,
        conversation.encryptionProtocol
      );

      return await prisma.message.create({
        data: {
          conversationId,
          senderId: currentUserId,
          content: "[Encrypted]",  // Placeholder for UI
          messageType: messageType,
          encryptedContent: encryptedPayload.ciphertext,
          encryptionMetadata: {
            protocol: conversation.encryptionProtocol,
            keyId: encryptedPayload.keyId,
            messageNumber: encryptedPayload.messageNumber,
            iv: encryptedPayload.iv,
            authTag: encryptedPayload.authTag
          }
        }
      });
    } catch (error) {
      // Encryption failed → FAIL the message send
      throw new Error(`Cannot send message: encryption failed (${error.message})`);
    }
  }

  // 5. Handle plaintext conversation
  return await prisma.message.create({
    data: {
      conversationId,
      senderId: currentUserId,
      content: content,  // Plaintext content
      messageType: messageType,
      encryptedContent: null,
      encryptionMetadata: null,
      originalLanguage: await detectLanguage(content)
    }
  });
}
```

### Enable Encryption for Conversation

```typescript
async function enableEncryption(
  conversationId: string,
  userId: string
): Promise<Conversation> {
  // 1. Get current conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { encryptionEnabledAt }
  });

  // 2. Check if already encrypted
  if (conversation.encryptionEnabledAt !== null) {
    throw new Error("Encryption already enabled for this conversation");
  }

  // 3. Verify user has encryption keys
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { signalIdentityKeyPublic }
  });

  if (!user.signalIdentityKeyPublic) {
    throw new Error("User must generate encryption keys first");
  }

  // 4. Enable encryption (IMMUTABLE - can never be disabled)
  const now = new Date();
  const updatedConversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      encryptionEnabledAt: now,
      encryptionProtocol: "signal_v3",
      encryptionEnabledBy: userId
    }
  });

  // 5. Create system message to notify participants
  await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      content: "Encryption enabled. All future messages will be end-to-end encrypted.",
      messageType: "system",  // ← Always plaintext
      encryptedContent: null,
      encryptionMetadata: null
    }
  });

  // 6. Notify all participants via WebSocket
  await notifyConversationMembers(conversationId, {
    type: "encryption_enabled",
    enabledAt: now,
    enabledBy: userId
  });

  return updatedConversation;
}
```

**Key Points:**
- ✅ **Check if already enabled** - prevent duplicate operations
- ✅ **Verify user has keys** - ensure user is ready for encryption
- ✅ **Set timestamp** - marks when encryption became active
- ✅ **System message** - notify all participants (plaintext)
- ✅ **WebSocket notification** - real-time update for UI

---

## Message Type Handling

### System Messages (Always Plaintext)

```typescript
messageType: "system"
```

**Examples:**
- "Alice joined the conversation"
- "Bob left the conversation"
- "Encryption enabled"
- "Conversation created"
- "Settings changed"

**Properties:**
- ✅ **Always plaintext** - even in encrypted conversations
- ✅ **Generated by server** - not user content
- ✅ **Metadata** - server already knows this information
- ✅ **No privacy concern** - not user's private content

### User Messages (Follow Conversation Setting)

```typescript
messageType: "text" | "image" | "file" | "audio" | "video"
```

**Encryption Logic:**
```typescript
if (conversation.encryptionEnabledAt !== null && message.createdAt >= conversation.encryptionEnabledAt) {
  // Message is encrypted
  message.encryptedContent = "base64_encrypted_payload"
  message.content = "[Encrypted]"  // Placeholder
} else {
  // Message is plaintext
  message.content = "Actual message content"
  message.encryptedContent = null
}
```

---

## Transition Period Handling

### Scenario: Enabling Encryption Mid-Conversation

```
Timeline:
t0: Conversation created (plaintext)
t1: Alice sends "Hello" (plaintext)
t2: Bob sends "Hi" (plaintext)
t3: Alice enables encryption
t4: Alice sends "Secret message" (ENCRYPTED)
t5: Bob sends "Got it" (ENCRYPTED)
```

**Database State:**

```typescript
// Conversation
{
  id: "conv123",
  createdAt: t0,
  encryptionEnabledAt: t3,  // ← Encryption enabled at t3
  encryptionProtocol: "signal_v3"
}

// Messages
[
  {
    id: "msg1",
    createdAt: t1,
    content: "Hello",
    encryptedContent: null,
    messageType: "text"
    // isEncrypted? → t1 < t3 → FALSE (plaintext)
  },
  {
    id: "msg2",
    createdAt: t2,
    content: "Hi",
    encryptedContent: null,
    messageType: "text"
    // isEncrypted? → t2 < t3 → FALSE (plaintext)
  },
  {
    id: "msg_system",
    createdAt: t3,
    content: "Encryption enabled. All future messages will be encrypted.",
    messageType: "system",
    encryptedContent: null
    // isEncrypted? → messageType === "system" → FALSE (always plaintext)
  },
  {
    id: "msg3",
    createdAt: t4,
    content: "[Encrypted]",
    encryptedContent: "base64_payload_1",
    messageType: "text"
    // isEncrypted? → t4 >= t3 → TRUE (encrypted)
  },
  {
    id: "msg4",
    createdAt: t5,
    content: "[Encrypted]",
    encryptedContent: "base64_payload_2",
    messageType: "text"
    // isEncrypted? → t5 >= t3 → TRUE (encrypted)
  }
]
```

**Query Logic:**

```typescript
// Get all messages with encryption status
const messages = await prisma.message.findMany({
  where: { conversationId: "conv123" },
  include: { conversation: { select: { encryptionEnabledAt: true } } }
});

const messagesWithEncryptionStatus = messages.map(msg => ({
  ...msg,
  isEncrypted:
    msg.messageType !== "system" &&
    msg.conversation.encryptionEnabledAt !== null &&
    msg.createdAt >= msg.conversation.encryptionEnabledAt
}));
```

---

## Database Queries

### Find All Encrypted Conversations

```typescript
const encryptedConversations = await prisma.conversation.findMany({
  where: {
    encryptionEnabledAt: { not: null }
  }
});
```

### Find All Plaintext Messages in Encrypted Conversation

```typescript
// Get historical plaintext messages (sent before encryption was enabled)
const plaintextMessages = await prisma.message.findMany({
  where: {
    conversationId: conversationId,
    createdAt: { lt: conversation.encryptionEnabledAt }
  }
});
```

### Find All Encrypted Messages

```typescript
// Messages in encrypted conversations, sent after encryption was enabled
const encryptedMessages = await prisma.message.findMany({
  where: {
    conversation: {
      encryptionEnabledAt: { not: null }
    },
    createdAt: { gte: conversation.encryptionEnabledAt },
    messageType: { not: "system" }
  }
});
```

### Search Messages (Plaintext Only)

```typescript
// Can only search plaintext messages
const searchResults = await prisma.message.findMany({
  where: {
    OR: [
      // Messages in plaintext conversations
      {
        conversation: { encryptionEnabledAt: null },
        content: { contains: searchTerm, mode: "insensitive" }
      },
      // Messages sent before encryption was enabled
      {
        conversation: { encryptionEnabledAt: { not: null } },
        createdAt: { lt: conversation.encryptionEnabledAt },
        content: { contains: searchTerm, mode: "insensitive" }
      },
      // System messages (always plaintext)
      {
        messageType: "system",
        content: { contains: searchTerm, mode: "insensitive" }
      }
    ]
  }
});
```

---

## Frontend Implementation

### Check if Message is Encrypted

```typescript
// Frontend helper function
function isMessageEncrypted(message: Message, conversation: Conversation): boolean {
  // System messages are never encrypted
  if (message.messageType === "system") {
    return false;
  }

  // Check conversation encryption
  if (!conversation.encryptionEnabledAt) {
    return false;
  }

  // Check if message was sent after encryption was enabled
  const messageTime = new Date(message.createdAt);
  const encryptionTime = new Date(conversation.encryptionEnabledAt);

  return messageTime >= encryptionTime;
}
```

### Display Message Content

```tsx
function MessageContent({ message, conversation }: Props) {
  const encrypted = isMessageEncrypted(message, conversation);

  if (encrypted) {
    // Decrypt client-side
    const [decrypted, setDecrypted] = useState<string | null>(null);

    useEffect(() => {
      decryptMessage(message.encryptedContent, message.encryptionMetadata)
        .then(plaintext => setDecrypted(plaintext))
        .catch(err => setDecrypted("[Decryption failed]"));
    }, [message]);

    return (
      <div className="message encrypted">
        <LockIcon />
        {decrypted || "Decrypting..."}
      </div>
    );
  }

  // Plaintext message
  return (
    <div className="message plaintext">
      {message.content}
    </div>
  );
}
```

### Enable Encryption Button

```tsx
function ConversationSettings({ conversation }: Props) {
  const canEnableEncryption = conversation.encryptionEnabledAt === null;

  async function handleEnableEncryption() {
    // Show confirmation dialog
    const confirmed = await confirm({
      title: "Enable End-to-End Encryption?",
      message:
        "All future messages will be encrypted. " +
        "This action cannot be undone. " +
        "System messages will remain unencrypted.",
      confirmText: "Enable Encryption",
      cancelText: "Cancel"
    });

    if (!confirmed) return;

    // Enable encryption
    await fetch(`/api/conversations/${conversation.id}/encryption`, {
      method: "POST"
    });

    // Reload conversation
    router.refresh();
  }

  if (!canEnableEncryption) {
    return (
      <div className="encryption-status">
        <LockIcon className="text-green-500" />
        <span>Encrypted since {formatDate(conversation.encryptionEnabledAt)}</span>
      </div>
    );
  }

  return (
    <Button onClick={handleEnableEncryption}>
      <LockIcon />
      Enable Encryption
    </Button>
  );
}
```

---

## Security Considerations

### ✅ Immutable Encryption

**Protection:** Once enabled, encryption cannot be disabled

```typescript
// Application-level enforcement
async function disableEncryption(conversationId: string) {
  throw new Error("Encryption cannot be disabled once enabled");
}

// Database constraint (MongoDB)
// Set encryptionEnabledAt to be immutable after first set
db.conversations.updateMany(
  { encryptionEnabledAt: { $ne: null } },
  { $unset: { encryptionEnabledAt: 1 } }
)
// This will fail if you have proper validation
```

### ✅ Audit Trail

**Tracking:** Know when encryption was enabled and by whom

```typescript
conversation: {
  encryptionEnabledAt: "2025-11-19T14:30:00Z",  // When
  encryptionEnabledBy: "user123"                 // Who
}
```

### ✅ Client-Side Encryption

**Zero-Knowledge:** Server never sees plaintext of encrypted messages

```typescript
// Client encrypts BEFORE sending to server
const ciphertext = await signalProtocol.encrypt(plaintext);
await sendToServer({ encryptedContent: ciphertext });

// Server stores encrypted blob (can't read it)
await prisma.message.create({ encryptedContent: ciphertext });

// Other clients decrypt AFTER receiving from server
const plaintext = await signalProtocol.decrypt(ciphertext);
```

### ✅ System Messages Never Encrypted

**Rationale:** Server generates system messages, so encryption provides no benefit

```typescript
// System message: server already knows the content
{
  messageType: "system",
  content: "Alice joined the conversation",
  encryptedContent: null  // ← Always null
}
```

### ⚠️ Transition Period

**Risk:** Historical plaintext messages remain readable

```typescript
// Messages sent BEFORE encryption was enabled
{
  createdAt: t1,
  content: "This is plaintext",  // ← Still readable
  encryptedContent: null
}

// Messages sent AFTER encryption was enabled
{
  createdAt: t3,
  content: "[Encrypted]",
  encryptedContent: "base64..."  // ← Protected
}
```

**Mitigation:**
- ✅ Show warning: "Previous messages were sent unencrypted"
- ✅ UI badge: "Encrypted since [date]"
- ⚠️ Option to delete old messages (user choice)

---

## API Endpoints

### Enable Encryption

```typescript
POST /api/conversations/:id/encryption

Request:
{
  // No body needed (encryption protocol is default "signal_v3")
}

Response:
{
  "success": true,
  "conversation": {
    "id": "conv123",
    "encryptionEnabledAt": "2025-11-19T14:30:00Z",
    "encryptionProtocol": "signal_v3",
    "encryptionEnabledBy": "user123"
  },
  "message": "Encryption enabled successfully"
}

Errors:
400 - Encryption already enabled
403 - User doesn't have permission
400 - User doesn't have encryption keys
```

### Get Conversation with Encryption Status

```typescript
GET /api/conversations/:id

Response:
{
  "id": "conv123",
  "title": "Private Chat",
  "encryptionEnabledAt": "2025-11-19T14:30:00Z",  // null if plaintext
  "encryptionProtocol": "signal_v3",
  "encryptionEnabledBy": "user123",
  // ... other fields
}
```

### Get Messages with Encryption Metadata

```typescript
GET /api/conversations/:id/messages

Response:
{
  "messages": [
    {
      "id": "msg1",
      "content": "Hello",
      "messageType": "text",
      "createdAt": "2025-11-19T14:00:00Z",
      "encryptedContent": null,
      "encryptionMetadata": null
      // Client derives: isEncrypted = false (createdAt < encryptionEnabledAt)
    },
    {
      "id": "msg2",
      "content": "[Encrypted]",
      "messageType": "text",
      "createdAt": "2025-11-19T14:35:00Z",
      "encryptedContent": "base64_encrypted_payload",
      "encryptionMetadata": { "protocol": "signal_v3", ... }
      // Client derives: isEncrypted = true (createdAt >= encryptionEnabledAt)
    },
    {
      "id": "msg3",
      "content": "Encryption enabled",
      "messageType": "system",
      "createdAt": "2025-11-19T14:30:00Z",
      "encryptedContent": null,
      "encryptionMetadata": null
      // Client derives: isEncrypted = false (messageType === "system")
    }
  ],
  "conversation": {
    "encryptionEnabledAt": "2025-11-19T14:30:00Z"
  }
}
```

---

## Performance Considerations

### Storage Impact

**Plaintext Conversation:**
```json
// Message: ~100 bytes
{
  "content": "Hello world",
  "messageType": "text",
  "createdAt": "...",
  "encryptedContent": null,
  "encryptionMetadata": null
}
```

**Encrypted Conversation:**
```json
// Message: ~300 bytes (3x increase)
{
  "content": "[Encrypted]",
  "messageType": "text",
  "createdAt": "...",
  "encryptedContent": "base64_encrypted_payload_150_bytes",
  "encryptionMetadata": { "protocol": "signal_v3", "keyId": 123, ... }
}
```

**Impact:**
- ✅ Plaintext: ~100 bytes/message
- ⚠️ Encrypted: ~300 bytes/message (3x)
- ✅ Acceptable tradeoff for E2EE security

### Query Performance

**Find encrypted conversations:**
```typescript
// Indexed query
db.conversations.find({ encryptionEnabledAt: { $ne: null } })
// Uses index on encryptionEnabledAt
```

**Determine message encryption:**
```typescript
// No additional query needed
// Derive from: conversation.encryptionEnabledAt + message.createdAt + message.messageType
```

**Search messages:**
```typescript
// Can only search plaintext messages
// Filter: encryptionEnabledAt === null OR createdAt < encryptionEnabledAt OR messageType === "system"
```

---

## Migration Plan

### Phase 1: Schema Update (Week 1)

**Add fields to Conversation:**
```prisma
encryptionEnabledAt   DateTime?  // null = plaintext
encryptionProtocol    String?    @default("signal_v3")
encryptionEnabledBy   String?    @db.ObjectId
```

**Add fields to Message:**
```prisma
encryptedContent      String?    // Base64 encrypted payload
encryptionMetadata    Json?      // Encryption details
```

**Add fields to User:**
```prisma
signalIdentityKeyPublic   String?
signalIdentityKeyPrivate  String?
signalRegistrationId      Int?
encryptionPreference      String  @default("optional")
```

**Migration Command:**
```bash
npx prisma db push
```

**Impact:** ✅ Zero - All fields are nullable, no breaking changes

### Phase 2: Signal Protocol Integration (Week 2-4)

```bash
# Install Signal Protocol library
npm install @signalapp/libsignal-client

# Create encryption service
# - Key generation
# - Session establishment (X3DH)
# - Message encryption/decryption (Double Ratchet)
```

### Phase 3: Backend API (Week 5)

**Endpoints:**
- `POST /api/conversations/:id/encryption` - Enable encryption
- `GET /api/users/me/keys` - Get user's public keys
- `POST /api/users/me/keys` - Generate/rotate keys

### Phase 4: Frontend Integration (Week 6-7)

**Features:**
- Encryption toggle in conversation settings
- Key generation on first use
- Client-side encryption/decryption
- UI indicators (lock icon, "Encrypted since" badge)

### Phase 5: Testing & Rollout (Week 8-10)

**Testing:**
- Unit tests (encryption logic)
- Integration tests (full E2EE flow)
- Security audit (external review)
- Performance testing (overhead measurement)

**Rollout:**
- Private beta (internal team)
- Public beta (early adopters)
- General availability (all users)

---

## Comparison: Old vs New Architecture

| Aspect | Old Proposal (Boolean) | NEW Proposal (DateTime) |
|--------|----------------------|------------------------|
| **Conversation Encryption** | `encryptionEnabled: Boolean` | `encryptionEnabledAt: DateTime?` |
| **Message Encryption** | `isEncrypted: Boolean` on Message | Derived from conversation + timestamp |
| **Immutability** | Can toggle on/off | Once enabled, permanent (can't set to null) |
| **Audit Trail** | No timestamp | Exact time encryption was enabled |
| **System Messages** | Need explicit flag | Implicit (messageType === "system") |
| **Transition Period** | Ambiguous | Clear (compare timestamps) |
| **Complexity** | More fields | Fewer fields |
| **Query Logic** | Check boolean flag | Compare timestamps |

---

## Real DMA (EU Digital Markets Act) Compliance

### What is REAL DMA?

**Real DMA** = EU's Digital Markets Act requiring messaging interoperability

**Requirements:**
- ✅ End-to-End Encryption (Signal Protocol)
- ✅ Cross-platform messaging (Meeshy ↔ WhatsApp/Signal/Telegram)
- ✅ No degradation of security/privacy
- ✅ User controls their data

**Meeshy's Compliance:**
```
Meeshy User (E2EE)
    ↕ Signal Protocol
WhatsApp User (via DMA gateway)
    ↕ Signal Protocol
Signal User (via DMA gateway)
    ↕ Signal Protocol
Telegram User (via DMA gateway)
```

**Key Points:**
- ✅ **NOT WhatsApp Business API** (commercial service)
- ✅ **Real interoperability** (personal messaging across platforms)
- ✅ **Maintained E2EE** (no man-in-the-middle)
- ✅ **User choice** (opt-in encryption per conversation)

---

## Testing Strategy

### Unit Tests

```typescript
describe("Conversation Encryption", () => {
  it("should enable encryption with timestamp", async () => {
    const before = new Date();
    const conversation = await enableEncryption("conv123", "user123");
    const after = new Date();

    expect(conversation.encryptionEnabledAt).toBeTruthy();
    expect(conversation.encryptionEnabledAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(conversation.encryptionEnabledAt.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(conversation.encryptionProtocol).toBe("signal_v3");
    expect(conversation.encryptionEnabledBy).toBe("user123");
  });

  it("should prevent disabling encryption", async () => {
    await enableEncryption("conv123", "user123");

    await expect(
      prisma.conversation.update({
        where: { id: "conv123" },
        data: { encryptionEnabledAt: null }
      })
    ).rejects.toThrow("Cannot disable encryption");
  });

  it("should derive message encryption from conversation + timestamp", () => {
    const conversation = {
      encryptionEnabledAt: new Date("2025-11-19T14:30:00Z")
    };

    const msg1 = { createdAt: new Date("2025-11-19T14:00:00Z"), messageType: "text" };
    const msg2 = { createdAt: new Date("2025-11-19T14:35:00Z"), messageType: "text" };
    const msg3 = { createdAt: new Date("2025-11-19T14:35:00Z"), messageType: "system" };

    expect(isMessageEncrypted(msg1, conversation)).toBe(false);  // Before encryption
    expect(isMessageEncrypted(msg2, conversation)).toBe(true);   // After encryption
    expect(isMessageEncrypted(msg3, conversation)).toBe(false);  // System message
  });
});
```

### Integration Tests

```typescript
describe("E2EE Message Flow", () => {
  it("should send plaintext in unencrypted conversation", async () => {
    const message = await sendMessage("conv123", "Hello");

    expect(message.content).toBe("Hello");
    expect(message.encryptedContent).toBeNull();
  });

  it("should send encrypted in encrypted conversation", async () => {
    await enableEncryption("conv123", "user123");
    const message = await sendMessage("conv123", "Secret");

    expect(message.content).toBe("[Encrypted]");
    expect(message.encryptedContent).toBeTruthy();
  });

  it("should send system messages as plaintext even in encrypted conversation", async () => {
    await enableEncryption("conv123", "user123");
    const message = await sendMessage("conv123", "User joined", "system");

    expect(message.content).toBe("User joined");
    expect(message.encryptedContent).toBeNull();
    expect(message.messageType).toBe("system");
  });
});
```

---

## Rollout Plan

### Week 1-2: Schema & Infrastructure
- ✅ Deploy schema changes
- ✅ Signal Protocol library integration
- ✅ Backend encryption service

### Week 3-4: API Implementation
- ✅ Enable encryption endpoint
- ✅ Key management endpoints
- ✅ WebSocket notifications

### Week 5-6: Frontend Integration
- ✅ Conversation settings UI
- ✅ Client-side encryption
- ✅ Decryption on message receive

### Week 7-8: Testing
- ✅ Unit tests (100% coverage)
- ✅ Integration tests (E2EE flow)
- ✅ Security audit (external)

### Week 9-10: Rollout
- ✅ Private beta (internal team)
- ✅ Public beta (early adopters)
- ✅ General availability (all users)

---

## Summary

### ✅ Key Improvements

1. **DateTime-based encryption** - Immutable, trackable, auditable
2. **Conversation-level only** - Simpler logic, clear expectations
3. **No message-level flag** - Derive from conversation + timestamp
4. **System messages exception** - Implicit (messageType check)
5. **Cleaner schema** - Fewer fields, clearer intent

### 🎯 Architecture Benefits

| Benefit | Description |
|---------|-------------|
| **Simplicity** | One field (`encryptionEnabledAt`) controls everything |
| **Immutability** | Once enabled, can't be disabled (security) |
| **Auditability** | Know exactly when encryption was enabled |
| **Backward Compatible** | Existing messages stay plaintext |
| **Performance** | No additional queries (derive from timestamps) |

### 📊 Migration Impact

- ✅ **Zero breaking changes** - All new fields are nullable
- ✅ **No data migration** - Existing data works as-is
- ✅ **Gradual rollout** - Users opt-in at their pace
- ✅ **Performance** - Minimal overhead (timestamp comparison)

---

## Next Steps

**If approved:**

1. **Update schema** (1 day)
   ```bash
   npx prisma db push
   ```

2. **Implement encryption service** (1 week)
   ```typescript
   class ConversationEncryptionService {
     async enableEncryption(conversationId, userId)
     async isConversationEncrypted(conversationId)
     async getEncryptionStatus(conversationId)
   }
   ```

3. **Update MessagingService** (2 days)
   ```typescript
   // Check conversation encryption before sending
   if (conversation.encryptionEnabledAt && messageType !== "system") {
     // Encrypt message
   }
   ```

4. **Frontend UI** (1 week)
   ```tsx
   <EncryptionToggle conversation={conversation} />
   ```

**Ready to implement?** 🚀
