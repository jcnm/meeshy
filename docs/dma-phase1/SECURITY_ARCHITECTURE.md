# Meeshy Security Architecture for DMA Interoperability

**Document Type**: Technical Security Specification
**Version**: 1.0
**Date**: November 18, 2024
**Classification**: Internal - Confidential

---

## 1. Executive Summary

Meeshy implements a **zero-trust security model** with Signal Protocol E2EE as the foundation for DMA interoperability. All communication between Meeshy and WhatsApp is encrypted end-to-end, with keys managed securely and never stored unencrypted.

## 2. Security Principles

### Core Principles
1. **Zero Knowledge**: Meeshy cannot read user messages
2. **Encryption First**: All messages encrypted by default
3. **Key Ownership**: Users own their encryption keys
4. **Minimal Data**: Collect only what's necessary
5. **Transparency**: Users know what data we have

### Design Philosophy
- **Defense in Depth**: Multiple security layers
- **Fail Secure**: When in doubt, deny access
- **Least Privilege**: Minimum required access
- **Audit Everything**: Full audit logs
- **Regular Review**: Continuous security improvements

## 3. End-to-End Encryption Architecture

### Signal Protocol Foundation

```
User A                              User B
   ↓                                  ↓
[Message] → Signal Encrypt    Signal Decrypt ← [Message]
   ↓                                  ↓
  E2EE                               E2EE
(Ciphertext)                    (Plaintext)
   ↓                                  ↓
[XMPP Transport] ←→ [WhatsApp Server] ←→ [XMPP Transport]
   ↓                                  ↓
 No access                        No access
to plaintext                    to plaintext
```

### Key Management

**Key Types**
1. **Identity Keys** (long-term)
   - Used for X3DH key agreement
   - Stored encrypted on device
   - Backed up with password protection

2. **Pre-Keys** (medium-term)
   - Signed pre-keys for initial communication
   - Rotated regularly (every week)
   - Uploaded to Meeshy servers

3. **Session Keys** (short-term)
   - Generated per conversation
   - Used for Double Ratchet
   - Rotated with every message
   - **Never** stored in plaintext

### Key Lifecycle

```
1. Registration
   ├── Generate Identity Key Pair (EC-P256)
   ├── Generate 50 Pre-Key Pairs
   ├── Generate Signed Pre-Key
   └── Upload to Meeshy Key Server (encrypted)

2. First Message
   ├── Receiver publishes Pre-Keys
   ├── Sender executes X3DH
   ├── Sender creates initial message key
   └── Sender sends initial message + Ephemeral Key

3. Subsequent Messages
   ├── Apply Double Ratchet
   ├── Sender ratchets forward
   ├── Receiver derives keys
   └── Message keys used once and deleted

4. Key Rotation
   ├── Weekly: Signed Pre-Key rotation
   ├── Monthly: Force new session establishment
   ├── On compromise: Immediate key revocation
```

## 4. XMPP Transport Security

### TLS Configuration

**Required**
- TLS 1.3 minimum
- Mutual TLS (mTLS) for server-to-server
- ECDHE key exchange (EC-P256 minimum)
- AES-256-GCM cipher suite
- HKDF key derivation

**Implementation**
```
# TLS 1.3 with mTLS
Client (Meeshy)
    ↓ (TLS 1.3, mTLS)
Server (Meeshy XMPP)
    ↓ (TLS 1.3, mTLS)
WhatsApp DMA Server
```

### XMPP Compression (Disabled)
- No compression (prevents CRIME attacks)
- All messages over encrypted TLS

### Certificate Pinning
- Pin WhatsApp root CA
- Pin Meeshy intermediate CA
- Rotation policy: annual
- Compromise handling: emergency rotation

## 5. Message Security

### Message Format

```
Raw Message
    ↓
Sign with Sender Private Key
    ↓
Encrypt with Session Key (AES-256-GCM)
    ↓
Add HMAC-SHA256 for authenticity
    ↓
Serialize with protobuf
    ↓
Wrap in XMPP stanza
    ↓
Transport via TLS
    ↓
(Reverse on receiver side)
```

### Message Authentication

**Double Verification**
1. **Sender Verification**:
   - Digital signature with sender's identity key
   - Timestamp included in signature
   - Signature must match established session

2. **Transport Verification**:
   - HMAC-SHA256 over entire message
   - TLS packet authentication
   - Message sequence number checking

### Message Integrity

```typescript
// Pseudo-code
function encryptMessage(plaintext: string, sessionKey: Uint8Array): CipherMessage {
  // Generate random nonce
  const nonce = randomBytes(12);

  // Encrypt with AES-256-GCM
  const cipher = AES_256_GCM.createCipher(sessionKey, nonce);
  const ciphertext = cipher.update(plaintext);
  const authTag = cipher.final();

  // Sign entire message
  const signature = ECDSA_SHA256.sign(
    ciphertext + authTag + nonce,
    senderPrivateKey
  );

  return {
    version: 3,
    ciphertext,
    authTag,
    nonce,
    signature,
    senderKeyId
  };
}
```

## 6. User Authentication & Verification

### Enlistment API Security

**User Registration Flow**
```
1. User creates Meeshy account
   ├── Verify email/phone
   ├── Generate Identity Key Pair
   └── Generate Pre-Keys (50)

2. Enlistment with WhatsApp
   ├── Call POST /enlistment/register
   ├── Provide: meeshy_uid + phone_number
   ├── Provide: cryptographic proof
   └── Receive: verification token

3. Token Exchange
   ├── Store token securely
   ├── Use for XMPP authentication
   └── Renew token every 30 days

4. Continuous Verification
   ├── On every message send
   ├── Verify token valid
   ├── Check user still exists
   └── Check not revoked
```

### Cryptographic Proof

**Proof Generation**
```typescript
// User proves ownership of Meeshy account
const proof = ECDSA_SHA256.sign(
  SHA256(meeshy_uid + phone_number + timestamp),
  meeshy_private_key
);

// Send to Enlistment API
const response = await fetch('https://enlistment.meeshy.app/register', {
  method: 'POST',
  body: JSON.stringify({
    meeshy_uid: user.id,
    phone_number: user.phone,
    timestamp: Date.now(),
    proof: proof,
    public_key: user.publicKey
  })
});
```

### User Revocation

**Immediate Revocation**
- User deletes account
- User revokes access
- Security breach detected
- Compromise suspected

**Revocation Process**
```
1. Admin/User initiates revocation
   ↓
2. Delete all session keys immediately
   ↓
3. Call WhatsApp /enlistment/revoke
   ↓
4. Mark user as revoked in database
   ↓
5. Audit log entry created
   ↓
6. Notify user of revocation
```

## 7. Data Protection

### Data at Rest

**Encrypted Storage**
- All keys stored with encryption
- Master key in HSM (Hardware Security Module)
- Database-level encryption (TDE)
- Automatic secure deletion (shred)

**Retention Policy**
- Messages: Deleted after delivery confirmation
- Session keys: Deleted after session ends
- Pre-keys: Deleted after use
- Audit logs: Retained for 90 days minimum
- User metadata: Retained as long as account active

### Data in Transit

**All Transport Encrypted**
- XMPP: TLS 1.3
- API: HTTPS only
- Database: Encrypted replication
- Backups: Encrypted at rest + in transit

### Data Access Controls

**Who can access what?**
```
User's Private Key:
├── User device only (never sent to Meeshy)
└── Encrypted backup (requires password)

User's Pre-Keys:
├── Meeshy servers (encrypted)
├── Deleted after use
└── Rotated weekly

Session Keys:
├── Generated per device
├── Never stored after session end
└── Auto-deleted on logout

User Metadata:
├── Meeshy servers (encrypted)
├── Limited to essential data (uid, phone)
└── Accessible to support staff (with audit log)

Messages:
├── Only encrypted ciphertext stored (temporary)
├── Deleted after delivery
└── NO ACCESS by Meeshy staff
```

## 8. Access Control & Authentication

### Internal Access

**Role-Based Access Control (RBAC)**
```
Admin
├── Full system access
├── Requires MFA (TOTP + hardware key)
├── All actions logged
└── Quarterly access review

Security Team
├── Key management access
├── Audit log review
├── Requires MFA
└── Time-limited access (1-hour max)

Support Team
├── User metadata only (uid, phone, created_at)
├── NO access to messages or keys
├── MFA required
└── All queries audited

DevOps
├── Infrastructure access
├── NO application data access
├── IP whitelist + MFA
└── Change approval required

Developers
├── Staging environment only
├── Synthetic test data
├── NO production access
└── Code review for key-related code
```

### API Access

**Enlistment API Authentication**
```
Client Authentication:
├── Client certificate (mTLS)
├── HMAC-SHA256 signature
├── Request timestamp (prevent replay)
└── Rate limiting (100 req/sec per client)

Rate Limiting:
├── Per client: 100 requests/second
├── Per IP: 1000 requests/second
├── Per user: 10 requests/minute
└── Burst allowance: +20%

Timeout:
├── Connection timeout: 5 seconds
├── Request timeout: 30 seconds
├── Keep-alive: 60 seconds
```

## 9. Threat Model & Mitigations

### Threat 1: Message Interception

**Threat**: Attacker intercepts message in transit

**Mitigations**:
- ✅ TLS 1.3 encryption (transport-level)
- ✅ Signal Protocol E2EE (application-level)
- ✅ Message authentication codes
- ✅ Perfect forward secrecy
- ✅ Certificate pinning

**Impact if breached**: Ciphertext only (unusable without keys)

### Threat 2: Key Theft

**Threat**: Attacker steals encryption keys

**Mitigations**:
- ✅ Keys stored encrypted (HSM)
- ✅ Short-lived session keys (per message)
- ✅ Identity keys on user device only
- ✅ Regular key rotation
- ✅ Secure deletion (shred)

**Impact if breached**: Limited to stolen key's session

### Threat 3: Account Takeover

**Threat**: Attacker gains access to user account

**Mitigations**:
- ✅ Strong password requirements
- ✅ MFA support (TOTP + SMS + hardware key)
- ✅ Session management (max 3 active)
- ✅ Unusual login detection
- ✅ IP-based restrictions (optional)

**Impact if breached**: Attacker can send/read messages (user's own account)

### Threat 4: Man-in-the-Middle (MITM)

**Threat**: Attacker interposes between Meeshy and WhatsApp

**Mitigations**:
- ✅ mTLS with certificate pinning
- ✅ HSTS preloading
- ✅ Certificate transparency logs
- ✅ Regular certificate audit
- ✅ Backup keys for emergency

**Impact if breached**: Ciphertext only

### Threat 5: Metadata Analysis

**Threat**: Attacker learns who talks to whom, when

**Mitigations**:
- ✅ Constant-size padding
- ✅ Message timing obfuscation
- ✅ Dummy message injection (optional)
- ✅ Limited metadata retention
- ✅ Metadata encryption

**Impact if breached**: Partial metadata exposure

### Threat 6: Replay Attacks

**Threat**: Attacker replays previous message

**Mitigations**:
- ✅ Message sequence numbers
- ✅ Timestamp inclusion
- ✅ Nonce per message
- ✅ Session-specific keys
- ✅ TLS protections

**Impact if breached**: Message duplicated (client detects)

## 10. Compliance & Auditing

### Audit Logging

**What We Log**
```
✅ User registration
✅ Key generation events
✅ Enlistment API calls
✅ Failed authentications
✅ Access control changes
✅ Administrative actions
✅ Message delivery (metadata only, not content)

❌ Message content (NEVER)
❌ Private keys (NEVER)
❌ Unencrypted passwords (NEVER)
```

**Audit Log Properties**
- Immutable (append-only)
- Encrypted at rest
- Replicated to secure backup
- Reviewed daily for anomalies
- Retained for 90 days minimum

### Monitoring & Alerting

**Real-Time Alerts**
- Multiple failed login attempts → Account lock
- Unusual key rotation pattern → Security review
- Enlistment API failures → Incident response
- TLS certificate issues → Immediate escalation
- Unusual access patterns → Investigation

## 11. Third-Party Audit

### Planned Security Audit (Phase 2)

**Scope**
- XMPP server implementation
- Signal Protocol integration
- Enlistment API security
- Key management system
- Database encryption

**Timeline**
- Week 5-6 of Phase 2
- 2-week engagement
- Full report provided to Meta

**Standards**
- OWASP Top 10 check
- CWE-25 most dangerous vulnerabilities
- Signal Protocol standard compliance
- DMA regulatory compliance

## 12. Incident Response

### Incident Classification

**Critical (P1)** - Immediate action required
- Message encryption broken
- Keys compromised
- Authentication bypass
- Mass service outage

**High (P2)** - Within 1 hour
- Unusual access patterns
- Potential insider threat
- Major service degradation
- Configuration drift

**Medium (P3)** - Within 4 hours
- Minor service issues
- Single user problems
- Non-critical bugs

**Low (P4)** - During business hours
- Documentation issues
- UI/UX problems
- Non-security questions

### Incident Response Team

- **On-Call**: 24/7 escalation
- **Response Time**: P1: 5 min, P2: 15 min
- **Communication**: Slack + Email
- **Post-Mortem**: Within 24 hours

### Compromised Key Response

```
1. Detect compromise (P1 alert)
   ↓
2. Immediate key revocation
   ↓
3. Notify user
   ↓
4. Revoke all active sessions
   ↓
5. Generate new keys on next login
   ↓
6. Audit: How was key compromised?
   ↓
7. Notify affected WhatsApp contacts
   ↓
8. Post-mortem and improvements
```

## 13. Compliance Checklist

### GDPR
- ✅ Privacy by design
- ✅ Data minimization
- ✅ Purpose limitation
- ✅ Storage limitation
- ✅ User rights (access, deletion, portability)
- ✅ Data processing agreement (DPA)
- ✅ Privacy impact assessment (PIA)

### DMA Interoperability
- ✅ Signal Protocol implementation
- ✅ Message encryption mandatory
- ✅ Key management secure
- ✅ Enlistment API compliance
- ✅ No lock-in mechanisms
- ✅ Interoperability transparency

### NIST Cybersecurity Framework
- ✅ Identify: Asset inventory
- ✅ Protect: Encryption, access control
- ✅ Detect: Monitoring, alerting
- ✅ Respond: Incident response plan
- ✅ Recover: Backup and restoration

## 14. Key Cryptographic Specifications

### Algorithms Used

| Purpose | Algorithm | Key Size | Standard |
|---------|-----------|----------|----------|
| Identity Key | EC-P256 | 256-bit | NIST |
| Pre-Key | EC-P256 | 256-bit | NIST |
| Session Encryption | AES-256-GCM | 256-bit | NIST |
| Key Derivation | HKDF-SHA256 | 256-bit | RFC 5869 |
| Message Signing | ECDSA-SHA256 | 256-bit | FIPS 186-4 |
| Password Hashing | Argon2id | - | PHC |
| TLS Handshake | ECDHE-P256 | 256-bit | RFC 8446 |

## 15. Future Improvements

### Post-Launch Enhancements
- Post-quantum cryptography migration (2026)
- Hardware security module (HSM) for key storage
- Zero-knowledge proof authentication
- Perfect forward secrecy improvements
- Metadata encryption enhancements

### Research Areas
- Onion routing for metadata hiding
- Private information retrieval (PIR)
- Homomorphic encryption for analytics
- Decentralized key management

---

## Conclusion

Meeshy's security architecture provides **multi-layered protection** with Signal Protocol E2EE at its core. Users can communicate securely with WhatsApp without Meeshy ever accessing their messages.

**Key Guarantees:**
1. ✅ Messages readable only by sender and receiver
2. ✅ Keys managed securely and never in plaintext
3. ✅ Perfect forward secrecy for all sessions
4. ✅ Regular audit and monitoring
5. ✅ Compliance with DMA and GDPR

---

**Version**: 1.0
**Next Review**: Phase 2 kickoff
**Questions**: Contact security@meeshy.app
