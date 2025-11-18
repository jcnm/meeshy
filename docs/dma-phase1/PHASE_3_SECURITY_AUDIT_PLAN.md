# Phase 3: Security Audit and Load Testing Plan
**Date:** November 18, 2025 (Session 2 - Phase 3 Planning)
**Focus:** Security validation, load testing, production deployment readiness

---

## Overview

This document outlines Phase 3 execution plan for:
- **Security Audit (Weeks 1-2):** Cryptographic review, SAST scanning, penetration testing
- **Load Testing (Weeks 2-3):** Throughput validation, concurrency testing, latency profiling
- **Production Deployment (Week 4):** MongoDB migration, secrets management, monitoring setup

---

## Phase 3: Week 1-2 - Security Audit

### 1. Third-Party Cryptographic Review

**Objective:** Independent verification of Signal Protocol and Noise Protocol implementations

**Scope:**
- Signal Protocol implementation (custom)
  - X3DH key agreement process
  - Double Ratchet state management
  - Forward secrecy guarantees
  - Key derivation functions (HKDF-SHA256)
- Noise Protocol implementation (custom)
  - NN, NX, XN handshake patterns
  - Symmetric encryption (AES-256-GCM)
  - Key reuse and session management
- AES-256-GCM implementation
- HMAC-SHA256 operations
- Entropy sources for key generation

**Deliverables:**
- [ ] Cryptographic correctness audit report
- [ ] Vulnerability assessment
- [ ] Recommendations for hardening
- [ ] Compliance certification (if applicable)

**Recommended Firms:**
1. **Trail of Bits** - Signal Protocol experts
   - Experience with Signal Desktop/Android reviews
   - Published research on Double Ratchet
   - Cost: $50k-$100k per review
   - Timeline: 4-6 weeks

2. **Cure53** - Comprehensive protocol review
   - XMPP federation security
   - End-to-end encryption validation
   - Cost: $30k-$80k
   - Timeline: 3-5 weeks

3. **NCC Group** - Enterprise security audit
   - Full system penetration testing
   - Database security review
   - Cost: $75k-$150k
   - Timeline: 4-8 weeks

**Internal Preparation:**
- Document all cryptographic operations in implementation
- Prepare test vectors for algorithm verification
- Create specification documents for custom implementations
- Identify all external cryptographic libraries used

---

### 2. Code Security Scanning (SAST)

**Objective:** Identify vulnerabilities in DMA implementation code

**Tools:**
1. **SonarQube** (Commercial)
   - TypeScript/JavaScript analysis
   - Security hotspots detection
   - Coverage tracking
   - Setup: Self-hosted or SonarCloud

2. **Snyk** (Commercial)
   - Dependency vulnerability scanning
   - Container image scanning (if using Docker)
   - License compliance
   - Real-time monitoring

3. **npm audit** (Free, built-in)
   - Dependency vulnerability detection
   - Automated fix suggestions
   - Already integrated in build pipeline

4. **ESLint Security Plugins** (Free)
   - `eslint-plugin-security` - Common security issues
   - `eslint-plugin-node` - Node.js security
   - Custom security rules

**Security Checks to Validate:**

| Category | Check | Expected Result |
|----------|-------|-----------------|
| **Input Validation** | Message content validation | No unvalidated JSON parsing |
| **Cryptography** | Key material handling | No hardcoded secrets |
| **Authentication** | JWT token validation | Expiration and signature checks |
| **Database** | SQL injection prevention | Prisma ORM (parameterized queries) |
| **CORS & CSP** | Cross-origin protection | Whitelist configured |
| **Logging** | Sensitive data logging | No credentials in logs |
| **Dependencies** | Vulnerable packages | All advisories resolved |
| **Encryption** | Data at rest | All private keys encrypted |
| **Session Management** | XMPP session handling | Proper cleanup on disconnect |
| **Error Handling** | Information disclosure | Generic error messages |

**Configuration Files to Create:**

`.snyk` (Snyk configuration):
```yaml
version: v1.25.0
org: meeshy
project-id: signal-dma-phase3
policy:
  - id: SNYK-JS-CRYPTOJS-2847132
    action: ignore
    reason: Optional dependency
    expires: 2026-01-01
```

`.sonarcloud.yml` (SonarCloud configuration):
```yaml
sonar:
  projectKey: meeshy-signal-dma
  projectName: Meeshy Signal DMA
  sources:
    - gateway/src/dma-interoperability
    - shared/dma
  exclusions:
    - "**/__tests__/**"
    - "**/*.test.ts"
  coverage:
    excludedLines:
      - "^\\s*if\\s+debug\\("
tests:
  - gateway/src/dma-interoperability/__tests__/**/*.test.ts
```

---

### 3. Penetration Testing

**Objective:** Identify security weaknesses in deployment and integration points

**Test Scope:**

#### 3.1 XMPP Federation Security
- [ ] Unauthorized stanza injection
- [ ] Man-in-the-middle (MITM) attacks over WSS
- [ ] Replay attack prevention
- [ ] Presence spoofing
- [ ] Resource enumeration
- [ ] Rate limiting validation

**Test Cases:**
```
1. Connect to XMPP with invalid SASL credentials
   Expected: Connection rejected, no bypass possible

2. Send crafted stanzas with oversized payloads
   Expected: Connection drops, no buffer overflow

3. Attempt to modify to/from JID in transit
   Expected: TLS prevents modification

4. Send 1000 messages/sec from single connection
   Expected: Rate limiting enforced, connection throttled

5. Reconnect immediately after logout
   Expected: Session invalidated, fresh auth required
```

#### 3.2 Signal Protocol Message Flow
- [ ] Out-of-order message handling
- [ ] Skipped key reuse attacks
- [ ] Double encryption prevention
- [ ] Session hijacking resistance
- [ ] Forward secrecy validation

**Test Cases:**
```
1. Send messages with wrong session ID
   Expected: Decryption fails gracefully

2. Replay captured ciphertext
   Expected: Message counter prevents duplicate decryption

3. Inject unsigned pre-key bundles
   Expected: Signature verification fails

4. Modify X3DH output before storage
   Expected: Derived keys don't match, messages unreadable
```

#### 3.3 Database Security
- [ ] Direct database access attempts
- [ ] Prisma injection attacks
- [ ] Encrypted key material integrity
- [ ] Deletion/modification of stored keys
- [ ] Unauthorized model access

**Test Cases:**
```
1. Attempt MongoDB injection in Prisma queries
   Expected: ORM sanitization prevents attack

2. Modify enrollmentId in offline message request
   Expected: User can only access own messages

3. Decrypt and store private keys without encryption
   Expected: Access controls prevent unencrypted storage
```

#### 3.4 API Authentication & Authorization
- [ ] JWT token bypass attempts
- [ ] Token expiration enforcement
- [ ] Cross-user access prevention
- [ ] Rate limiting on auth endpoints

**Test Scenarios:**
```
1. Use expired JWT token
   Expected: 401 Unauthorized response

2. Modify JWT payload (userId)
   Expected: Signature verification fails

3. Access /enrollments/OTHER_USER_ID
   Expected: 403 Forbidden
```

**Pentest Checklist:**
- [ ] Identify all HTTP/WSS endpoints
- [ ] Enumerate authentication mechanisms
- [ ] Test TLS configuration (Grade A minimum)
- [ ] Check certificate validity and expiration
- [ ] Validate message routing edge cases
- [ ] Test error message information disclosure
- [ ] Verify logging doesn't expose sensitive data
- [ ] Test backup/recovery procedures
- [ ] Validate audit logging completeness

---

### 4. Key Management Assessment

**Objective:** Verify secure key generation, storage, rotation, and revocation

**Assessment Areas:**

#### 4.1 Key Generation Security
```
✓ Random entropy source validation:
  - Identity key generation uses crypto.randomBytes()
  - Pre-key generation uses secure PRNG
  - No hardcoded default keys
  - Registration ID properly randomized

✓ Key generation rates:
  - Pre-key batch generation: 50-100 keys
  - Signed pre-key rotation: Monthly
  - Root key refresh: Per session
```

#### 4.2 Key Storage Security
```
✓ Encryption at rest:
  - Private keys encrypted in Prisma schema
  - DMAEnrollment.signalIdentityKeyPrivateEncrypted
  - DMASession.rootKeyEncrypted, chainKeySendEncrypted
  - DMASession.chainKeyReceiveEncrypted

✓ Key material isolation:
  - Private keys never logged
  - Private keys never sent over unencrypted channels
  - Private keys cleared from memory after use
```

#### 4.3 Key Rotation Policy
```
✓ Signed Pre-key (SPK) Rotation:
  - Rotate monthly (configurable)
  - Next rotation date tracked in DB
  - Old SPK retained for in-flight messages (7 days)

✓ Root Key Ratcheting:
  - Automatic DHR (Diffie-Hellman Ratchet) epoch increment
  - DMASession.dhrEpoch tracking
  - New root keys derived per Double Ratchet step

✓ Pre-key Depletion Handling:
  - Track pre-key count in DMAEnrollment.preKeyId
  - Alert when < 10 remaining
  - Allow users to force rotation
```

#### 4.4 Key Revocation & Expiration
```
✓ Enrollment Revocation:
  - DMAEnrollment.status = 'revoked'
  - DMAEnrollment.revokedAt timestamp
  - DMAEnrollment.revokedReason logged
  - All sessions invalidated

✓ Expired Keys:
  - DMASession.expiresAt enforcement
  - Offline message expiration (30 days)
  - DMAEnrollment.jwtTokenExpiresAt validation
```

#### 4.5 Key Backup & Recovery
```
Procedures to document:
- [ ] How to securely backup enrollment keys
- [ ] How to restore from backup (with audit logging)
- [ ] Key escrow procedures (if required by regulations)
- [ ] Recovery key generation and storage
- [ ] Disaster recovery testing annually
```

**Key Material Inventory:**

| Key | Location | Encryption | Rotation | Backup |
|-----|----------|-----------|----------|--------|
| Identity Key (Private) | DMAEnrollment.signalIdentityKeyPrivateEncrypted | ✓ AES-256 | - | ✓ Required |
| Pre-key (Private) | DMAEnrollment.preKeyValue | ✓ AES-256 | Monthly | ✓ Required |
| Signed Pre-key | DMAEnrollment.signedPreKeyValue | ✓ AES-256 | Monthly | ✓ Required |
| Root Key | DMASession.rootKeyEncrypted | ✓ AES-256 | Per message | Auto-derived |
| Chain Key (Send) | DMASession.chainKeySendEncrypted | ✓ AES-256 | Per message | Auto-derived |
| Chain Key (Receive) | DMASession.chainKeyReceiveEncrypted | ✓ AES-256 | Per message | Auto-derived |

---

## Phase 3: Week 2-3 - Load Testing

### Load Testing Infrastructure

**Objective:** Validate system performance under production loads

**Testing Environment:**
```
- Node.js: v20 LTS (same as production)
- Database: MongoDB Atlas (production-like)
- Message Queue: Redis (for metrics aggregation)
- Load Testing Tool: k6 (Grafana-native)
- Monitoring: Prometheus + Grafana
```

### Test Scenarios

#### Scenario 1: Concurrent User Enrollment (Week 2, Day 1)
**Goal:** Validate 1000 concurrent user enrollments without bottlenecks

```javascript
// k6 test script structure
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp to 100 users
    { duration: '1m30s', target: 500 }, // Ramp to 500 users
    { duration: '1m30s', target: 1000 }, // Ramp to 1000 users
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'], // 99th percentile < 500ms
    http_req_failed: ['rate<0.01'], // Error rate < 1%
  },
};

export default function() {
  // Enrollment flow test
  let enrollmentRes = http.post('http://localhost:3000/dma/enroll', {
    whatsappLogin: `user_${__VU}@whatsapp.com`,
    deviceId: `device_${__VU}`
  });

  check(enrollmentRes, {
    'enrollment succeeds': (r) => r.status === 200,
    'response includes enrollmentToken': (r) => r.json('enrollmentToken') !== null,
  });

  sleep(1);
}
```

**Success Criteria:**
- ✓ 99th percentile response time < 500ms
- ✓ Error rate < 1%
- ✓ Zero database connection pool exhaustion
- ✓ CPU usage < 80%
- ✓ Memory stable (no memory leaks)

#### Scenario 2: Message Throughput (Week 2, Day 2)
**Goal:** Validate 10,000 messages/hour end-to-end encryption and delivery

```
Target Load: 10,000 messages/hour
Breakdown:
- 100 active users
- 100 messages/user/hour
- Each message: Signal encrypted + XMPP federation

Metrics to Track:
- Message latency (p50, p99, p99.9)
- Encryption time per message
- Database write time per message
- XMPP delivery confirmation time
- Memory per active session
```

**Success Criteria:**
- ✓ Message latency p99 < 200ms (end-to-end)
- ✓ Encryption CPU time < 50ms per message
- ✓ Database operations < 100ms per message
- ✓ XMPP delivery confirmed within 100ms
- ✓ 99.99% message delivery rate

#### Scenario 3: Offline Message Queue Handling (Week 2, Day 3)
**Goal:** Validate offline message queue performance with 30-day retention

```
Scenario:
1. Disconnect 500 users for 24 hours
2. Queue 5000 offline messages (10 msgs/user)
3. Reconnect all users simultaneously
4. Validate all offline messages delivered

Metrics:
- Queue growth rate
- Delivery latency after reconnection
- Database query time for bulk retrieval
- Message deduplication performance
```

**Success Criteria:**
- ✓ Queue grows linearly (no cascading delays)
- ✓ All messages delivered within 5 seconds post-reconnection
- ✓ Database retrieval < 100ms for 10k messages
- ✓ Zero duplicate deliveries
- ✓ 30-day cleanup completes in < 1 minute

#### Scenario 4: Session Establishment & Key Exchange (Week 2, Day 4)
**Goal:** Validate X3DH and Noise Protocol performance

```
Scenario:
1. 1000 concurrent X3DH key agreements
2. 500 concurrent Noise Protocol handshakes
3. Measure key derivation and encryption setup time

Metrics:
- X3DH KDF time
- Noise ephemeral key generation
- Total session setup time
- Memory per session
```

**Success Criteria:**
- ✓ X3DH completion < 50ms
- ✓ Noise handshake < 100ms
- ✓ Total session setup < 150ms
- ✓ Memory per session < 1MB
- ✓ Zero failed key agreements

#### Scenario 5: Connection Stability (Week 3, Day 1)
**Goal:** Validate 24-hour uptime with steady message flow

```
Scenario:
1. Establish 100 persistent XMPP connections
2. Send steady 1 message/sec per connection (100 msg/sec total)
3. Run for 24 hours continuously
4. Monitor for connection drops, memory leaks, stale sessions

Metrics:
- Connection stability (uptime %)
- Memory growth over time
- Message delivery rate (should stay 100%)
- Database connection pool health
```

**Success Criteria:**
- ✓ 99.99% uptime (< 9 seconds downtime)
- ✓ Memory stable (< 10MB growth over 24 hours)
- ✓ 100% message delivery rate
- ✓ Zero stale session accumulation
- ✓ Database connections healthy

#### Scenario 6: Latency Profiling (Week 3, Day 2)
**Goal:** Identify performance bottlenecks

```
Measure End-to-End Latency Components:
1. Message encryption: [target < 50ms]
2. Database write: [target < 100ms]
3. XMPP transmission: [target < 50ms]
4. Decryption: [target < 50ms]
5. Delivery acknowledgment: [target < 100ms]

Total: < 350ms p99

Tools:
- Prometheus metrics hooks
- APM instrumentation (DataDog/New Relic trial)
- Flame graphs for CPU profiling
- Heap snapshots for memory analysis
```

### Load Testing Timeline

| Week | Task | Duration | Objective |
|------|------|----------|-----------|
| 2 | Enrollment concurrency | 2 hours | 1000 concurrent enrollments |
| 2 | Message throughput | 4 hours | 10k messages/hour |
| 2 | Offline queue | 3 hours | 30-day retention validation |
| 2 | Session establishment | 2 hours | Key exchange performance |
| 3 | 24-hour stability | 24 hours | Continuous operation |
| 3 | Latency profiling | 4 hours | Bottleneck identification |
| 3 | Report & optimization | 8 hours | Document findings & optimize |

---

## Phase 3: Week 4 - Production Deployment

### 4.1 Database Migration to MongoDB

**Pre-Migration Checklist:**
- [ ] Backup existing PostgreSQL (if currently using)
- [ ] Create MongoDB Atlas cluster (M30 minimum for production)
- [ ] Test Prisma MongoDB connector compatibility
- [ ] Plan migration window (suggest 2:00 AM UTC, minimal traffic)
- [ ] Create rollback procedure

**Migration Steps:**
```bash
# 1. Generate Prisma migration
npx prisma migrate dev --name dma_phase3_mongodb

# 2. Export existing data (if migrating from SQL)
npx prisma db seed

# 3. Validate data integrity
npm run test:dma-models

# 4. Switch connection string
# Update .env.production
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/meeshy-dma

# 5. Verify deployment
npm run build && npm run start:prod
```

---

### 4.2 Secrets Management Setup (HashiCorp Vault)

**Sensitive Secrets to Protect:**
- Database connection strings
- JWT signing keys
- Firebase Cloud Messaging API keys
- Apple Push Notification certificates
- XMPP server credentials
- Private key encryption keys (HSM integration)

**Vault Configuration:**
```hcl
# vault/policy/meeshy-dma.hcl
path "secret/data/meeshy-dma/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/meeshy-dma/*" {
  capabilities = ["list"]
}

# Enable Kubernetes auth for pod identity
path "auth/kubernetes/role/meeshy-dma" {
  capabilities = ["read"]
}
```

**Secret Rotation Schedule:**
- Database passwords: Every 90 days
- JWT signing keys: Every 6 months
- API keys: Every 30 days
- Certificates: Before expiration (90-day warning)

---

### 4.3 Monitoring & Alerting (Prometheus/Grafana)

**Metrics to Collect:**

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Message latency p99 | > 500ms | Page on-call engineer |
| Error rate | > 1% | Page on-call engineer |
| Database latency p99 | > 200ms | Alert in Slack |
| Memory usage | > 85% | Auto-scale or page |
| CPU usage | > 80% | Alert in Slack |
| XMPP connection count | > 10k | Alert in Slack |
| Offline message queue size | > 100k | Investigation required |

**Grafana Dashboard Layout:**
```
┌─────────────────────────────────────────┐
│  Meeshy Signal DMA - Production Metrics │
├──────────────────┬──────────────────────┤
│ Message Latency  │ Error Rate            │
│ (p50/p99)        │ (% of total)          │
├──────────────────┼──────────────────────┤
│ CPU Usage        │ Memory Usage          │
│ (% of capacity)  │ (% of capacity)       │
├──────────────────┼──────────────────────┤
│ DB Connections   │ XMPP Connections     │
│ (active/max)     │ (active/max)          │
├──────────────────┼──────────────────────┤
│ Message Throughput    │ Offline Queue Size    │
│ (msg/sec)             │ (count)               │
└──────────────────────────────────────────┘
```

---

### 4.4 Canary Rollout Strategy

**Phase 1: Staging (Week 3.5)**
- Deploy to staging environment
- Run smoke tests (message flow, encryption, delivery)
- Validate monitoring alerts
- Team review and sign-off

**Phase 2: Canary 1 (Week 4, Day 1)**
- Deploy to 5% of production traffic
- Monitor for errors, latency increases
- Compare metrics: baseline vs canary
- Success criteria:
  - Error rate < 2% (vs baseline 0.5%)
  - Latency p99 < 600ms (vs baseline 300ms)
  - No data corruption

**Phase 3: Canary 2 (Week 4, Day 2)**
- Increase to 25% of production traffic
- Extended monitoring (4+ hours)
- Validate offline message queue handling
- Success criteria: same as Canary 1

**Phase 4: Full Rollout (Week 4, Day 3)**
- Deploy to 100% of production
- Continuous monitoring
- On-call engineer standing by
- Rollback plan ready

---

## Success Criteria for Phase 3

### Security Audit
- ✅ Zero critical vulnerabilities in cryptography review
- ✅ All SAST findings either fixed or accepted with risk
- ✅ Penetration test results documented
- ✅ Key management procedures validated

### Load Testing
- ✅ 1000 concurrent enrollments with < 500ms latency p99
- ✅ 10,000 messages/hour with 99.99% delivery
- ✅ 24-hour uptime test passes (99.99% availability)
- ✅ All latency targets met (< 350ms end-to-end p99)

### Production Deployment
- ✅ Successful canary rollout to 100%
- ✅ Monitoring dashboards operational
- ✅ Alerting system validated
- ✅ Secrets management integrated
- ✅ Rollback procedures tested

---

## Phase 3 Timeline Summary

```
Week 1-2: Security Audit
  │
  ├─ Day 1-2:   Cryptographic Review
  ├─ Day 3-4:   SAST & Code Scanning
  ├─ Day 5-6:   Penetration Testing
  └─ Day 7-10:  Key Management Assessment

Week 2-3: Load Testing
  │
  ├─ Day 1:  Enrollment Concurrency (1k users)
  ├─ Day 2:  Message Throughput (10k msg/hr)
  ├─ Day 3:  Offline Queue Handling (30-day)
  ├─ Day 4:  Session Establishment
  ├─ Day 5:  24-Hour Stability Test
  └─ Day 6-7: Latency Profiling & Optimization

Week 4: Production Deployment
  │
  ├─ Day 1: Staging & Smoke Tests
  ├─ Day 2: Canary 1 (5% traffic)
  ├─ Day 3: Canary 2 (25% traffic)
  └─ Day 4: Full Rollout (100%)
```

**Total Duration:** 3-4 weeks
**Team Size:** 2-3 engineers + 1 DevOps
**Budget:** $100k-$200k (including third-party security review)

---

## Next Actions

1. **Immediately:**
   - [ ] Select security audit firm (Trail of Bits or Cure53 preferred)
   - [ ] Schedule cryptographic review kickoff
   - [ ] Set up SonarCloud and Snyk integrations

2. **This week:**
   - [ ] Create k6 load testing scripts
   - [ ] Set up Prometheus/Grafana test instance
   - [ ] Define MongoDB Atlas cluster specifications

3. **Next week:**
   - [ ] Begin security audit
   - [ ] Execute first load test (enrollment concurrency)
   - [ ] Set up HashiCorp Vault deployment plan

---

**Status:** ✅ Phase 3 Security & Load Testing Plan Ready for Execution
