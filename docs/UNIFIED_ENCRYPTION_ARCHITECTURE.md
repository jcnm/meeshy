# Unified Encryption Architecture for Meeshy Platform

**Date:** November 19, 2025
**Status:** PROPOSED - Ready for Implementation
**Approach:** Real DMA (EU Digital Markets Act) with Signal Protocol

---

## Executive Summary

This document proposes a **unified encryption architecture** where:
- ✅ **SAME `Message` collection** handles both encrypted and unencrypted messages
- ✅ **Encryption is OPTIONAL** - users/conversations can toggle it on/off
- ✅ **Real DMA compliance** - for EU interoperability, not WhatsApp Business API
- ✅ **Backward compatible** - existing plaintext messages remain functional
- ✅ **Signal Protocol** - industry-standard E2EE (used by WhatsApp, Signal, etc.)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Message Collection                        │
│  (Unified - handles BOTH encrypted & plaintext)             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Plaintext Message:                                         │
│  ├─ isEncrypted: false                                     │
│  ├─ content: "Hello world"                                 │
│  ├─ encryptedContent: null                                 │
│  └─ translations: [...] ✓                                  │
│                                                             │
│  Encrypted Message:                                         │
│  ├─ isEncrypted: true                                      │
│  ├─ content: "[Encrypted]"  (display placeholder)          │
│  ├─ encryptedContent: "base64_encrypted_payload"           │
│  ├─ encryptionProtocol: "signal_v3"                        │
│  ├─ encryptionMetadata: { keyId, ratchetState, ... }      │
│  └─ translations: null  (can't translate encrypted)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Schema Changes

### 1. Message Model - Add Optional Encryption Fields

```prisma
model Message {
  id                String                @id @default(auto()) @map("_id") @db.ObjectId
  conversationId    String                @db.ObjectId
  senderId          String?               @db.ObjectId
  anonymousSenderId String?               @db.ObjectId

  // EXISTING FIELDS
  content           String                // Plaintext OR "[Encrypted]" placeholder
  originalLanguage  String                @default("fr")
  messageType       String                @default("text")
  isEdited          Boolean               @default(false)
  editedAt          DateTime?
  isDeleted         Boolean               @default(false)
  deletedAt         DateTime?
  replyToId         String?               @db.ObjectId
  validatedMentions String[]              @default([])
  metadata          Json?

  // 🆕 NEW ENCRYPTION FIELDS (OPTIONAL)
  isEncrypted       Boolean               @default(false)
  encryptedContent  String?               // Base64 encrypted payload (when isEncrypted=true)
  encryptionProtocol String?              // "signal_v3", "noise_transport", etc.
  encryptionMetadata Json?                // { keyId, preKeyId, ratchetState, iv, authTag }

  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt

  // Relations (unchanged)
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

  @@index([isEncrypted])
  @@index([encryptionProtocol])
}
```

### 2. Conversation Model - Add Encryption Settings

```prisma
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

  // 🆕 NEW ENCRYPTION SETTINGS
  encryptionEnabled     Boolean                  @default(false)    // E2EE enabled for this conversation
  encryptionProtocol    String?                  @default("signal_v3") // Default protocol to use
  encryptionMandatory   Boolean                  @default(false)    // Reject plaintext messages if true

  metadata              Json?
  createdAt             DateTime                 @default(now())
  updatedAt             DateTime                 @updatedAt

  // Relations (unchanged)
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

  @@index([encryptionEnabled])
}
```

### 3. User Model - Add Encryption Preferences

```prisma
model User {
  id                          String                   @id @default(auto()) @map("_id") @db.ObjectId
  username                    String                   @unique
  // ... existing fields ...

  // 🆕 NEW ENCRYPTION PREFERENCES
  encryptionPreference        String                   @default("optional")  // "disabled", "optional", "preferred", "mandatory"
  signalIdentityKeyPublic     String?                  // User's Signal Protocol public identity key
  signalIdentityKeyPrivate    String?                  // Encrypted private identity key
  signalRegistrationId        Int?                     // Signal Protocol registration ID
  signalPreKeyBundleId        Int?                     @default(0)           // Current pre-key bundle ID
  lastKeyRotation             DateTime?                // Last time keys were rotated

  // ... existing fields ...
  createdAt                   DateTime                 @default(now())
  updatedAt                   DateTime                 @updatedAt

  // ... existing relations ...
}
```

---

## Encryption Flow Comparison

### Flow 1: Plaintext Message (Current - Default)

```typescript
// Client sends message
{
  conversationId: "conv123",
  content: "Hello world",
  isEncrypted: false
}

// Server stores directly
await prisma.message.create({
  data: {
    conversationId: "conv123",
    senderId: userId,
    content: "Hello world",
    isEncrypted: false,
    encryptedContent: null,
    originalLanguage: "en"
  }
});

// Server creates translations
await translationService.translateMessage(message, ["fr", "es"]);

// Recipients receive plaintext
socket.emit("new_message", {
  id: "msg123",
  content: "Hello world",
  isEncrypted: false,
  translations: {
    fr: "Bonjour le monde",
    es: "Hola mundo"
  }
});
```

### Flow 2: Encrypted Message (NEW - Opt-in)

```typescript
// Client encrypts locally (Signal Protocol)
const encryptedPayload = await signalProtocol.encrypt({
  recipientId: "user456",
  plaintext: "Hello world",
  sessionState: currentSession
});

// Client sends encrypted
{
  conversationId: "conv123",
  content: "[Encrypted]",  // Placeholder for display
  isEncrypted: true,
  encryptedContent: "base64_encrypted_payload_here",
  encryptionProtocol: "signal_v3",
  encryptionMetadata: {
    preKeyId: 123,
    signedPreKeyId: 456,
    keyId: 789,
    messageNumber: 1,
    iv: "...",
    authTag: "..."
  }
}

// Server stores as-is (can't decrypt)
await prisma.message.create({
  data: {
    conversationId: "conv123",
    senderId: userId,
    content: "[Encrypted]",
    isEncrypted: true,
    encryptedContent: encryptedPayload.ciphertext,
    encryptionProtocol: "signal_v3",
    encryptionMetadata: encryptedPayload.metadata
  }
});

// NO translations (server can't decrypt)

// Recipients receive encrypted
socket.emit("new_message", {
  id: "msg123",
  content: "[Encrypted]",
  isEncrypted: true,
  encryptedContent: "base64_encrypted_payload_here",
  encryptionProtocol: "signal_v3",
  encryptionMetadata: { ... }
});

// Client decrypts locally
const plaintext = await signalProtocol.decrypt({
  encryptedContent: message.encryptedContent,
  metadata: message.encryptionMetadata,
  sessionState: currentSession
});
// Display: "Hello world"
```

---

## Encryption Control Levels

### Level 1: User Preference

```typescript
// User account settings
{
  encryptionPreference: "disabled"   // Never encrypt my messages
  encryptionPreference: "optional"   // Let me choose per conversation (DEFAULT)
  encryptionPreference: "preferred"  // Encrypt when possible, fallback to plaintext
  encryptionPreference: "mandatory"  // Only send encrypted, fail if not possible
}
```

### Level 2: Conversation Setting

```typescript
// Conversation settings (controlled by admin/creator)
{
  encryptionEnabled: false,       // Plaintext only (DEFAULT for existing convos)
  encryptionMandatory: false
}

{
  encryptionEnabled: true,        // Encryption available
  encryptionMandatory: false,     // But plaintext still allowed
  encryptionProtocol: "signal_v3"
}

{
  encryptionEnabled: true,        // Encryption required
  encryptionMandatory: true,      // Reject plaintext messages
  encryptionProtocol: "signal_v3"
}
```

### Level 3: Message-Level Encryption

```typescript
// Each message independently tracks encryption
{
  id: "msg123",
  isEncrypted: false,  // This specific message is plaintext
  content: "Hello"
}

{
  id: "msg124",
  isEncrypted: true,   // This specific message is encrypted
  encryptedContent: "..."
}
```

---

## Implementation Logic

### Message Send Logic

```typescript
async function sendMessage(
  conversationId: string,
  content: string,
  options: { encrypt?: boolean }
): Promise<Message> {
  // 1. Get conversation encryption settings
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { encryptionEnabled, encryptionMandatory, encryptionProtocol }
  });

  // 2. Get user encryption preference
  const user = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { encryptionPreference }
  });

  // 3. Determine if encryption should be used
  let shouldEncrypt = false;

  if (conversation.encryptionMandatory) {
    // Conversation requires encryption
    shouldEncrypt = true;
  } else if (user.encryptionPreference === "mandatory") {
    // User requires encryption
    shouldEncrypt = true;
  } else if (options.encrypt === true) {
    // User explicitly requested encryption for this message
    shouldEncrypt = true;
  } else if (user.encryptionPreference === "preferred" && conversation.encryptionEnabled) {
    // User prefers encryption and conversation supports it
    shouldEncrypt = true;
  }

  // 4. Validate encryption is possible
  if (shouldEncrypt) {
    if (!conversation.encryptionEnabled) {
      throw new Error("Encryption not enabled for this conversation");
    }
    // Check recipient has public keys, session exists, etc.
  }

  // 5. Create message
  if (shouldEncrypt) {
    // Encrypt on client-side BEFORE sending to server
    const encryptedPayload = await encryptMessageClientSide(content);

    return await prisma.message.create({
      data: {
        conversationId,
        senderId: currentUserId,
        content: "[Encrypted]",
        isEncrypted: true,
        encryptedContent: encryptedPayload.ciphertext,
        encryptionProtocol: conversation.encryptionProtocol,
        encryptionMetadata: encryptedPayload.metadata
      }
    });
  } else {
    // Plaintext message
    return await prisma.message.create({
      data: {
        conversationId,
        senderId: currentUserId,
        content: content,
        isEncrypted: false,
        encryptedContent: null,
        originalLanguage: detectLanguage(content)
      }
    });
  }
}
```

---

## Feature Compatibility Matrix

| Feature | Plaintext Messages | Encrypted Messages |
|---------|-------------------|-------------------|
| **Storage** | ✅ MongoDB `Message` collection | ✅ MongoDB `Message` collection (same) |
| **Translations** | ✅ Server-side auto-translate | ❌ Not possible (content encrypted) |
| **Search** | ✅ Full-text search on content | ❌ Content encrypted (metadata only) |
| **Mentions** | ✅ Parse @username from content | ⚠️ Client-side only (before encryption) |
| **Link Previews** | ✅ Server extracts URLs | ❌ Client-side only (before encryption) |
| **Reactions** | ✅ Full support | ✅ Full support (on message ID) |
| **Replies** | ✅ Full support | ✅ Full support (on message ID) |
| **Attachments** | ✅ Server processes | ⚠️ Encrypted separately (file E2EE) |
| **Edit/Delete** | ✅ Server enforces | ✅ Server enforces (metadata only) |
| **DMA Interoperability** | ⚠️ Plaintext to external | ✅ E2EE to external platforms |

---

## Real DMA (EU Digital Markets Act) vs WhatsApp Business API

### What is REAL DMA?

**Real DMA** refers to the EU's **Digital Markets Act** regulation requiring large messaging platforms ("gatekeepers") to provide **interoperability** with third-party messaging services.

**Key Requirements:**
- ✅ **End-to-End Encryption** - Must maintain E2EE across platforms
- ✅ **Open Protocol** - Signal Protocol is the de facto standard
- ✅ **User Choice** - Users decide which platforms to connect
- ✅ **Feature Parity** - Text, media, groups, reactions must work
- ✅ **No Degradation** - Security/privacy must not be compromised

**Meeshy's Approach:**
```
Meeshy User (Signal Protocol E2EE)
    ↕ Encrypted messaging
WhatsApp User (via DMA gateway)
    ↕ Encrypted messaging
Signal User (via DMA gateway)
    ↕ Encrypted messaging
Telegram User (via DMA gateway)
```

### WhatsApp Business API (NOT what we're doing)

**WhatsApp Business API** is Meta's commercial API for businesses to send notifications/messages.

**Key Differences:**
- ❌ **NOT DMA** - Commercial service, not regulatory compliance
- ❌ **Limited Features** - Template messages, notifications only
- ❌ **Business Focus** - Customer support, marketing, not personal chat
- ❌ **Server-Side** - Messages go through Meta's servers
- ❌ **No True E2EE** - Business can see message content

**We are NOT implementing this!**

---

## Benefits of Unified Architecture

### ✅ Single Collection for All Messages

**Benefit:** Simplifies queries, migrations, and backups
```typescript
// Get all messages (encrypted + plaintext)
const messages = await prisma.message.findMany({
  where: { conversationId }
});

// Get only plaintext messages (for search)
const searchableMessages = await prisma.message.findMany({
  where: { conversationId, isEncrypted: false }
});

// Get only encrypted messages (for key rotation)
const encryptedMessages = await prisma.message.findMany({
  where: { conversationId, isEncrypted: true }
});
```

### ✅ Gradual Migration

**Benefit:** No breaking changes, opt-in encryption
- Existing conversations continue as plaintext
- New conversations can enable encryption
- Users migrate at their own pace
- Mixed messages in same conversation (transition period)

### ✅ Flexible Encryption Policies

**Benefit:** Different security requirements per conversation
- **Public communities:** Plaintext (searchable, translatable)
- **Private groups:** Optional encryption (user choice)
- **DMA interop:** Mandatory encryption (regulatory compliance)
- **Direct messages:** User preference

### ✅ Future-Proof

**Benefit:** Easy to add new encryption protocols
```prisma
encryptionProtocol: String?  // "signal_v3", "mls_v1", "noise_transport", "custom"
```

---

## Migration Plan

### Phase 1: Schema Update (Week 1)

```bash
# Add new fields to Message model
npx prisma db push

# Fields added:
# - isEncrypted (Boolean, default: false)
# - encryptedContent (String?, nullable)
# - encryptionProtocol (String?, nullable)
# - encryptionMetadata (Json?, nullable)
```

**Impact:** Zero - All existing messages have `isEncrypted: false`

### Phase 2: Encryption Infrastructure (Week 2-4)

1. **Signal Protocol Library Integration**
   - Install libsignal-client (Rust-based, official)
   - Key generation & management service
   - Session establishment (X3DH handshake)

2. **User Key Management**
   - Generate identity keys on account creation
   - Pre-key bundle generation & rotation
   - Secure storage (encrypted with user password)

3. **Client-Side Encryption**
   - Frontend: Encrypt before sending to server
   - Frontend: Decrypt after receiving from server
   - Server: Store encrypted payload as-is (zero-knowledge)

### Phase 3: Conversation Encryption Toggle (Week 5)

1. **UI for Conversation Settings**
   ```tsx
   <ConversationSettings>
     <EncryptionToggle
       enabled={conversation.encryptionEnabled}
       onChange={handleToggleEncryption}
     />
   </ConversationSettings>
   ```

2. **API Endpoints**
   ```typescript
   PATCH /api/conversations/:id/encryption
   {
     "encryptionEnabled": true,
     "encryptionMandatory": false
   }
   ```

### Phase 4: User Encryption Preferences (Week 6)

1. **UI for User Settings**
   ```tsx
   <UserSettings>
     <EncryptionPreference
       value={user.encryptionPreference}
       options={["disabled", "optional", "preferred", "mandatory"]}
     />
   </UserSettings>
   ```

2. **Key Generation on Demand**
   - Generate keys when user enables encryption
   - Upload public keys to server
   - Store private keys locally (encrypted)

### Phase 5: DMA Interoperability (Week 7-10)

1. **External Platform Adapters**
   - WhatsApp DMA adapter (E2EE required)
   - Signal adapter (native E2EE)
   - Telegram adapter (optional E2EE)

2. **Cross-Platform Key Exchange**
   - X3DH handshake with external users
   - Pre-key bundle distribution
   - Session management across platforms

---

## Security Considerations

### ✅ End-to-End Encryption (E2EE)

**Guarantee:** Server NEVER sees plaintext of encrypted messages
```typescript
// Client side
const ciphertext = signalProtocol.encrypt(plaintext, recipientPublicKey);
sendToServer({ encryptedContent: ciphertext });

// Server side
saveToDatabase({ encryptedContent: ciphertext }); // ← Encrypted blob, can't read

// Recipient client side
const plaintext = signalProtocol.decrypt(ciphertext, myPrivateKey);
```

### ✅ Perfect Forward Secrecy (PFS)

**Guarantee:** Compromised keys don't decrypt past messages
- Double Ratchet algorithm rotates keys per message
- Each message encrypted with unique key
- Old keys deleted immediately after use

### ✅ Deniability

**Guarantee:** No cryptographic proof of message authorship
- MAC-based authentication (not signatures)
- Anyone with session key could have sent message
- Provides plausible deniability

### ⚠️ Metadata Leakage

**Risk:** Server can still see metadata (not encrypted)
```typescript
// What server CAN see
{
  senderId: "user123",           // Who sent
  conversationId: "conv456",     // To which conversation
  timestamp: "2025-11-19T12:00", // When
  messageType: "text",           // Type (text/image/etc)
  isEncrypted: true              // If encrypted
}

// What server CANNOT see
{
  content: ???,                  // Message content (encrypted)
  mentions: ???,                 // Who was mentioned (encrypted)
  links: ???                     // URLs in message (encrypted)
}
```

**Mitigation:** Future work - metadata resistance (MLS protocol)

### ✅ Key Rotation

**Security:** Regular key rotation minimizes compromise impact
```typescript
// User model
{
  lastKeyRotation: "2025-11-19",
  signalPreKeyBundleId: 42  // ← Increments on rotation
}

// Rotation policy
if (daysSinceRotation > 30) {
  await rotatePreKeys(userId);
}
```

---

## Performance Considerations

### Storage Impact

**Before (Plaintext Only):**
```json
{
  "content": "Hello world",  // 11 bytes
  "isEncrypted": false
}
```

**After (Encrypted):**
```json
{
  "content": "[Encrypted]",          // 11 bytes (placeholder)
  "isEncrypted": true,
  "encryptedContent": "base64...",   // ~150 bytes (for "Hello world")
  "encryptionMetadata": { ... }      // ~100 bytes
}
```

**Impact:** ~250 bytes per encrypted message vs ~50 bytes plaintext
- 5x storage increase for encrypted messages
- Acceptable tradeoff for E2EE security
- Compression can reduce by ~30%

### Query Performance

**Plaintext Message Search:**
```typescript
// Full-text search works
db.messages.find({ $text: { $search: "hello" } });
```

**Encrypted Message Search:**
```typescript
// Can only search metadata
db.messages.find({
  isEncrypted: true,
  senderId: "user123",
  createdAt: { $gte: yesterday }
});
```

**Impact:** Search limited to metadata for encrypted messages
**Mitigation:** Client-side search after decryption (slower but private)

### Network Performance

**Plaintext:** ~50 bytes per message
**Encrypted:** ~250 bytes per message (5x increase)

**Mitigation:**
- Compression (gzip over WebSocket)
- Batch message fetching
- Lazy decryption (decrypt on-demand)

---

## Testing Strategy

### Unit Tests

```typescript
describe("Message Encryption", () => {
  it("should store plaintext message when encryption disabled", async () => {
    const message = await sendMessage("conv123", "Hello", { encrypt: false });
    expect(message.isEncrypted).toBe(false);
    expect(message.content).toBe("Hello");
    expect(message.encryptedContent).toBeNull();
  });

  it("should store encrypted message when encryption enabled", async () => {
    const message = await sendMessage("conv123", "Hello", { encrypt: true });
    expect(message.isEncrypted).toBe(true);
    expect(message.content).toBe("[Encrypted]");
    expect(message.encryptedContent).toBeTruthy();
  });

  it("should enforce mandatory encryption policy", async () => {
    await setConversationEncryption("conv123", { mandatory: true });
    await expect(
      sendMessage("conv123", "Hello", { encrypt: false })
    ).rejects.toThrow("Encryption required");
  });
});
```

### Integration Tests

```typescript
describe("E2EE Flow", () => {
  it("should encrypt, send, receive, and decrypt message", async () => {
    // Alice encrypts and sends
    const plaintext = "Hello Bob";
    const encrypted = await alice.encryptMessage(plaintext, bob.publicKey);
    await alice.sendMessage("conv123", encrypted);

    // Bob receives and decrypts
    const message = await bob.receiveMessage("conv123");
    const decrypted = await bob.decryptMessage(message);
    expect(decrypted).toBe("Hello Bob");
  });
});
```

---

## Rollout Plan

### Phase 1: Private Beta (Weeks 1-2)

- ✅ Schema deployed to production
- ✅ Encryption disabled by default (feature flag)
- ✅ Internal testing with dev accounts
- 🎯 **Goal:** Verify no regressions for plaintext messages

### Phase 2: Opt-in Beta (Weeks 3-6)

- ✅ Encryption available to early adopters
- ✅ UI toggle in conversation settings
- ✅ Public documentation released
- ✅ Monitor performance metrics
- 🎯 **Goal:** 100 users testing encrypted conversations

### Phase 3: General Availability (Weeks 7-10)

- ✅ Encryption available to all users
- ✅ Default: Optional (user chooses)
- ✅ Marketing push: "Now with E2EE!"
- 🎯 **Goal:** 10% of conversations using encryption

### Phase 4: DMA Compliance (Weeks 11-16)

- ✅ External platform adapters deployed
- ✅ Mandatory encryption for DMA interop
- ✅ EU regulatory compliance achieved
- 🎯 **Goal:** Interoperability with WhatsApp/Signal

---

## Conclusion

### ✅ YES - Single Message Collection Works!

**Benefits:**
- Unified data model (simpler queries, migrations, backups)
- Backward compatible (existing messages stay plaintext)
- Forward compatible (easy to add new encryption protocols)
- Flexible policies (per-user, per-conversation, per-message)
- Real DMA compliance (E2EE interoperability)

**Tradeoffs:**
- Encrypted messages can't be searched/translated server-side
- 5x storage increase for encrypted messages
- Requires client-side encryption logic

**Recommendation:** **PROCEED with unified architecture**

This approach gives you:
1. **Meeshy-to-Meeshy** with optional encryption (user choice)
2. **DMA interoperability** with mandatory encryption (regulatory compliance)
3. **Gradual migration** (no breaking changes)
4. **Future-proof** (easy to extend)

---

**Next Steps:**
1. Review & approve this architecture
2. Implement schema changes (1 day)
3. Integrate Signal Protocol library (1 week)
4. Build encryption toggle UI (1 week)
5. Private beta testing (2 weeks)

**Ready to proceed?**
