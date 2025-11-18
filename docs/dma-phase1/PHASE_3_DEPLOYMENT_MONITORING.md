# Phase 3: Production Deployment & Monitoring Guide
**Date:** November 18, 2025
**Focus:** MongoDB migration, Prometheus/Grafana monitoring, canary rollout strategy

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [MongoDB Migration Strategy](#mongodb-migration-strategy)
3. [Prometheus Metrics Configuration](#prometheus-metrics-configuration)
4. [Grafana Dashboard Setup](#grafana-dashboard-setup)
5. [HashiCorp Vault Integration](#hashicorp-vault-integration)
6. [Canary Rollout Procedure](#canary-rollout-procedure)
7. [Incident Response](#incident-response)
8. [Rollback Procedures](#rollback-procedures)

---

## Pre-Deployment Checklist

### 1. Code Readiness

- [ ] All Options B, C, D completed and merged to main branch
- [ ] TypeScript compilation clean (DMA components only)
- [ ] Prisma migrations generated and tested
- [ ] All security audit findings resolved or documented
- [ ] Load tests completed with results documented

### 2. Infrastructure Readiness

- [ ] MongoDB Atlas cluster created (M30+)
  - [ ] Production configuration: Multi-region, auto-backup enabled
  - [ ] Database: `meeshy-dma` created
  - [ ] Collections: Ready for Prisma migration
  - [ ] Backup snapshots: Daily automated

- [ ] Prometheus server deployed
  - [ ] Retention: 30 days minimum
  - [ ] Storage: 100GB+ for 30-day retention
  - [ ] Backup: Daily snapshots

- [ ] Grafana instance deployed
  - [ ] Data source: Prometheus configured
  - [ ] Dashboards: Pre-configured from templates
  - [ ] Alerting: Slack/PagerDuty integration ready

- [ ] HashiCorp Vault deployed
  - [ ] Cluster initialization: 3+ servers (high availability)
  - [ ] Secrets engine: Key-value v2 enabled
  - [ ] Authentication: Kubernetes auth configured
  - [ ] Backup: Daily snapshots

### 3. Secrets Management

- [ ] All production secrets in Vault:
  ```
  ✓ Database connection strings
  ✓ JWT signing keys
  ✓ Firebase Cloud Messaging credentials
  ✓ Apple Push Notification certificates
  ✓ XMPP server credentials
  ✓ Encryption keys (HSM-backed preferred)
  ```

- [ ] Service account tokens generated
- [ ] Secret rotation policies defined (90-day passwords, 6-month keys)
- [ ] Backup encryption keys stored in HSM or physical vault

### 4. Monitoring & Logging

- [ ] Log aggregation (ELK or Loki) configured
  - [ ] Log retention: 90 days minimum
  - [ ] Sensitive data filtering: Passwords, tokens masked
  - [ ] Index strategy: Daily rotation

- [ ] Error tracking (Sentry/DataDog) configured
  - [ ] Project: meeshy-dma created
  - [ ] Release tracking: Enabled
  - [ ] Performance monitoring: APM enabled

- [ ] Uptime monitoring (UptimeRobot/StatusPage)
  - [ ] Health endpoints: Monitored every 1 minute
  - [ ] Status page: Public dashboard ready

### 5. Team & Runbooks

- [ ] On-call rotation established
- [ ] Runbooks written for common incidents
- [ ] Escalation procedures documented
- [ ] Communication channels set up (Slack alerts)
- [ ] Post-mortem template ready

### 6. Compliance & Security

- [ ] GDPR compliance verified
  - [ ] Data processing agreement (DPA) in place
  - [ ] Right to deletion implemented
  - [ ] Data export functionality tested

- [ ] Security documentation complete
  - [ ] Architecture diagrams reviewed
  - [ ] Threat model documented
  - [ ] Privacy policy updated

- [ ] Penetration test results reviewed
- [ ] Security patches applied

---

## MongoDB Migration Strategy

### Phase 1: Pre-Migration (Day 1)

**1. Backup Current Data**
```bash
# Backup existing PostgreSQL (if applicable)
pg_dump meeshy > backups/meeshy_$(date +%Y%m%d).sql

# Or backup MongoDB if already in use
mongodump --uri "mongodb+srv://user:pass@current-cluster" \
  --out backups/mongodb_backup_$(date +%Y%m%d)
```

**2. Create MongoDB Cluster**
```bash
# MongoDB Atlas: Create M30 cluster
# Settings:
# - Multi-region: Yes (primary + secondary + hidden)
# - Backup: Continuous backup enabled
# - Monitoring: Atlas monitoring + cloudwatch integration
# - Network: VPC peering + private IP endpoint
# - Auth: IP whitelist + Database users
```

**3. Create Database and Indices**
```javascript
// Create database and collections
use("meeshy-dma");

// Create DMA Enrollment collection with indices
db.createCollection("dma_enrollments");
db.dma_enrollments.createIndex({ userId: 1 }, { background: true });
db.dma_enrollments.createIndex({ status: 1 }, { background: true });
db.dma_enrollments.createIndex({ createdAt: 1 }, { background: true });
db.dma_enrollments.createIndex({ userId: 1, whatsappInternalId: 1 }, { unique: true });

// Create Offline Messages collection
db.createCollection("dma_offline_messages");
db.dma_offline_messages.createIndex({ enrollmentId: 1 }, { background: true });
db.dma_offline_messages.createIndex({ delivered: 1 }, { background: true });
db.dma_offline_messages.createIndex({ expiresAt: 1 }, {
  background: true,
  expireAfterSeconds: 2592000 // 30 days TTL
});
db.dma_offline_messages.createIndex({ messageId: 1 }, { unique: true });
db.dma_offline_messages.createIndex({ deliveryId: 1 }, { unique: true });

// Create Sessions collection
db.createCollection("dma_sessions");
db.dma_sessions.createIndex({ enrollmentId: 1 }, { background: true });
db.dma_sessions.createIndex({ sessionState: 1 }, { background: true });
db.dma_sessions.createIndex({ createdAt: 1 }, { background: true });
db.dma_sessions.createIndex({ enrollmentId: 1, remotePartyId: 1, sessionType: 1 }, { unique: true });

// Create Message Status collection
db.createCollection("dma_message_statuses");
db.dma_message_statuses.createIndex({ enrollmentId: 1 }, { background: true });
db.dma_message_statuses.createIndex({ status: 1 }, { background: true });
db.dma_message_statuses.createIndex({ createdAt: 1 }, { background: true });
db.dma_message_statuses.createIndex({ deliveredAt: 1 }, { background: true });
db.dma_message_statuses.createIndex({ messageId: 1 }, { unique: true });
```

### Phase 2: Staging Migration (Day 2-3)

**4. Test Migration in Staging**
```bash
# Generate and run Prisma migration
npx prisma migrate dev --name dma_phase3_mongodb_migration

# Run database health checks
npm run test:dma-models
npm run test:dma-adapters

# Seed test data (if needed)
npx prisma db seed
```

**5. Validate Data Integrity**
```bash
# Check record counts
db.dma_enrollments.countDocuments()
db.dma_offline_messages.countDocuments()
db.dma_sessions.countDocuments()
db.dma_message_statuses.countDocuments()

# Verify indices
db.dma_enrollments.getIndexes()
db.dma_offline_messages.getIndexes()

# Check for orphaned data
db.dma_offline_messages.find({ enrollmentId: { $nin: [...enrollmentIds] } })
```

**6. Performance Testing**
```bash
# Test common queries
time db.dma_enrollments.find({ userId: "test_user" })
time db.dma_offline_messages.find({ enrollmentId: "test_enrollment" })
time db.dma_sessions.find({ sessionState: "established" })

# Measure query latencies
npx k6 run tests/load-testing/04-session-establishment.js
```

### Phase 3: Production Migration (Day 4)

**7. Pre-Migration Window (22:00 UTC - Off-peak)**

Stop application and ensure clean state:
```bash
# 1. Health check
curl http://localhost:3000/health

# 2. Drain connection pools
# Application should gracefully close connections

# 3. Final backup of current database
pg_dump meeshy > backups/meeshy_final_$(date +%Y%m%d_%H%M%S).sql

# 4. Verify no new connections
psql meeshy -c "SELECT * FROM pg_stat_activity WHERE datname='meeshy';"
```

**8. Migrate Connection String**
```bash
# Update .env.production
OLD_DB_URL=postgresql://user:pass@host/meeshy
NEW_DB_URL=mongodb+srv://user:pass@cluster.mongodb.net/meeshy-dma

# Test connection before deployment
npx prisma db execute --stdin < test_connection.sql
```

**9. Deploy New Code with MongoDB**
```bash
# Pull latest code (with MongoDB Prisma changes)
git pull origin main

# Install dependencies
npm ci

# Build
npm run build

# Run migrations
npx prisma migrate deploy

# Start service
npm start
```

**10. Validation (23:30 UTC)**
```bash
# Health check
curl http://localhost:3000/health

# Verify key operations
curl http://localhost:3000/dma/enrollments -H "Authorization: Bearer test_token"

# Monitor logs for errors
tail -f logs/production.log
```

**11. Rollback Plan (if needed)**
```bash
# Immediate rollback to PostgreSQL:
# 1. Update .env.production with old DATABASE_URL
# 2. git revert <mongodb-commit>
# 3. npm run build && npm start

# Timeline: Should complete in < 15 minutes
```

### Phase 4: Post-Migration (Days 5-7)

**12. Continuous Monitoring**
- Verify all CRUD operations
- Monitor query latencies
- Check for cascading failures
- Watch memory usage (no memory leaks)

**13. Data Validation**
```javascript
// Check for any orphaned records
db.dma_offline_messages.aggregate([
  {
    $lookup: {
      from: "dma_enrollments",
      localField: "enrollmentId",
      foreignField: "_id",
      as: "enrollment"
    }
  },
  { $match: { enrollment: { $size: 0 } } }
])

// Verify no duplicate messages
db.dma_message_statuses.aggregate([
  { $group: { _id: "$messageId", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```

**14. Cleanup Old Data**
```bash
# After 7 days of successful migration, clean up old backups
rm backups/meeshy_*.sql.gz

# Archive old PostgreSQL server
# (Confirm no traffic, then decommission)
```

---

## Prometheus Metrics Configuration

### Installation

```bash
# Download Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.52.0/prometheus-2.52.0.linux-amd64.tar.gz
tar xvfz prometheus-2.52.0.linux-amd64.tar.gz
cd prometheus-2.52.0.linux-amd64/
```

### Configuration File

**`/etc/prometheus/prometheus.yml`**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'meeshy-dma'
    environment: 'production'

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']

# Rules files
rule_files:
  - '/etc/prometheus/rules/*.yml'

scrape_configs:
  # Application metrics
  - job_name: 'meeshy-dma'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance

  # MongoDB exporter
  - job_name: 'mongodb'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:9216']
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance

  # Node exporter (system metrics)
  - job_name: 'node'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:9100']
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance

  # Redis (if used for caching)
  - job_name: 'redis'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:6379']
```

### Alert Rules

**`/etc/prometheus/rules/meeshy-dma.yml`**
```yaml
groups:
  - name: meeshy-dma
    interval: 30s
    rules:
      # High error rate alert
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{job="meeshy-dma",status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # High latency alert
      - alert: HighLatency
        expr: |
          histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency detected"
          description: "P99 latency is {{ $value | humanizeDuration }}"

      # Database connection pool exhaustion
      - alert: DBConnectionPoolExhausted
        expr: |
          meeshy_db_connections_active / meeshy_db_connections_max > 0.8
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool near exhaustion"
          description: "Active connections: {{ $value | humanizePercentage }}"

      # Memory leak detection
      - alert: MemoryLeakDetected
        expr: |
          rate(process_resident_memory_bytes[1h]) > 5000000
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Potential memory leak detected"
          description: "Memory growing at {{ $value }} bytes/sec"

      # XMPP connection count spike
      - alert: XMPPConnectionSpike
        expr: |
          rate(xmpp_connections_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Unusual XMPP connection spike"
          description: "{{ $value | humanize }} new connections/sec"

      # Offline message queue buildup
      - alert: OfflineQueueBuildup
        expr: |
          meeshy_offline_messages_queue_size > 100000
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Offline message queue building up"
          description: "Queue size: {{ $value | humanize }} messages"

      # Low disk space
      - alert: LowDiskSpace
        expr: |
          (node_filesystem_avail_bytes{fstype=~"ext4|xfs"} / node_filesystem_size_bytes) < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space on {{ $labels.device }}"
          description: "{{ $value | humanizePercentage }} available"

      # MongoDB down
      - alert: MongoDBDown
        expr: |
          up{job="mongodb"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "MongoDB instance down"
          description: "MongoDB has been unreachable for 1 minute"
```

### Application Metrics to Expose

Add these metrics to your application (using Prometheus client library):

```typescript
// gateway/src/metrics/prometheus.ts
import client from 'prom-client';

// Counter: total requests
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// Histogram: request duration
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
});

// Gauge: active connections
export const xmppConnectionsActive = new client.Gauge({
  name: 'xmpp_connections_active',
  help: 'Active XMPP connections'
});

// Counter: messages encrypted
export const messagesEncrypted = new client.Counter({
  name: 'messages_encrypted_total',
  help: 'Total messages encrypted',
  labelNames: ['protocol']
});

// Histogram: encryption latency
export const encryptionLatency = new client.Histogram({
  name: 'encryption_latency_seconds',
  help: 'Message encryption latency',
  labelNames: ['protocol'],
  buckets: [0.001, 0.01, 0.05, 0.1]
});

// Gauge: offline messages queued
export const offlineMessagesQueued = new client.Gauge({
  name: 'meeshy_offline_messages_queue_size',
  help: 'Size of offline message queue'
});

// Database metrics
export const dbConnectionsActive = new client.Gauge({
  name: 'meeshy_db_connections_active',
  help: 'Active database connections'
});

export const dbConnectionsMax = new client.Gauge({
  name: 'meeshy_db_connections_max',
  help: 'Max database connections'
});
```

---

## Grafana Dashboard Setup

### Import Pre-Built Dashboards

```bash
# Navigate to Grafana UI
# Home → Dashboards → New → Import

# Import community dashboards:
# - 1860: Node Exporter Full
# - 3870: Prometheus 2.0 Stats
# - 10566: MongoDB
```

### Create Custom Dashboard: Meeshy DMA Overview

**Dashboard JSON Configuration:**
```json
{
  "dashboard": {
    "title": "Meeshy Signal DMA - Production",
    "tags": ["dma", "signal", "production"],
    "timezone": "UTC",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{ method }} {{ route }}"
          }
        ],
        "type": "graph"
      },
      {
        "id": 2,
        "title": "Request Latency (P99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P99"
          }
        ],
        "type": "graph"
      },
      {
        "id": 3,
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error %"
          }
        ],
        "type": "graph",
        "alert": { "conditions": [{ "evaluator": { "params": [0.01] } }] }
      },
      {
        "id": 4,
        "title": "Active XMPP Connections",
        "targets": [
          {
            "expr": "xmpp_connections_active",
            "legendFormat": "Connections"
          }
        ],
        "type": "gauge",
        "fieldConfig": { "defaults": { "max": 10000 } }
      },
      {
        "id": 5,
        "title": "Messages Encrypted (Rate)",
        "targets": [
          {
            "expr": "rate(messages_encrypted_total[5m])",
            "legendFormat": "{{ protocol }}"
          }
        ],
        "type": "graph"
      },
      {
        "id": 6,
        "title": "Encryption Latency (P99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(encryption_latency_seconds_bucket[5m]))",
            "legendFormat": "{{ protocol }}"
          }
        ],
        "type": "graph"
      },
      {
        "id": 7,
        "title": "Offline Message Queue Size",
        "targets": [
          {
            "expr": "meeshy_offline_messages_queue_size"
          }
        ],
        "type": "stat",
        "alert": { "conditions": [{ "evaluator": { "params": [100000] } }] }
      },
      {
        "id": 8,
        "title": "Database Connection Pool",
        "targets": [
          {
            "expr": "meeshy_db_connections_active",
            "legendFormat": "Active"
          },
          {
            "expr": "meeshy_db_connections_max",
            "legendFormat": "Max"
          }
        ],
        "type": "graph"
      },
      {
        "id": 9,
        "title": "CPU Usage",
        "targets": [
          {
            "expr": "100 - (avg by (instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)"
          }
        ],
        "type": "graph"
      },
      {
        "id": 10,
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "process_resident_memory_bytes / 1024 / 1024 / 1024"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

---

## HashiCorp Vault Integration

### Vault Cluster Setup

**High-Availability Configuration:**
```hcl
# /etc/vault/config.hcl
ui = true
disable_mlock = false

storage "consul" {
  path = "vault"
  address = "consul.service.consul:8500"
}

listener "tcp" {
  address = "0.0.0.0:8200"
  tls_cert_file = "/etc/vault/tls/vault.crt"
  tls_key_file = "/etc/vault/tls/vault.key"
}

ha_storage "consul" {
  path = "vault-ha"
  address = "consul.service.consul:8500"
}

api_addr = "https://vault.service.consul:8200"
cluster_addr = "https://vault.service.consul:8201"
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname = false
}
```

### Secret Management Policy

```hcl
# /etc/vault/policies/meeshy-dma.hcl
path "secret/data/meeshy-dma/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/meeshy-dma/*" {
  capabilities = ["list"]
}

path "database/creds/meeshy-dma" {
  capabilities = ["read"]
}

path "pki/issue/meeshy-dma" {
  capabilities = ["create", "update"]
}
```

### Creating Secrets

```bash
# Login to Vault
vault login -method=kubernetes role=meeshy-dma

# Create database credentials
vault write secret/data/meeshy-dma/mongodb \
  username=meeshy-user \
  password=secure_password_here

# Create JWT signing key
vault write secret/data/meeshy-dma/jwt \
  signing_key=@/path/to/jwt.key

# Create Firebase credentials
vault write secret/data/meeshy-dma/firebase \
  service_account=@/path/to/firebase-key.json

# Create encryption key
vault write secret/data/meeshy-dma/encryption \
  master_key=base64_encoded_key_here

# List secrets
vault list secret/metadata/meeshy-dma
```

### Application Integration

```typescript
// gateway/src/config/vault.ts
import Vault from 'node-vault';

const vault = new Vault({
  endpoint: process.env.VAULT_ADDR || 'https://vault:8200',
  token: process.env.VAULT_TOKEN,
  apiVersion: 'v1'
});

export async function loadSecrets() {
  const secrets = {
    mongodb: await vault.read('secret/data/meeshy-dma/mongodb'),
    jwt: await vault.read('secret/data/meeshy-dma/jwt'),
    firebase: await vault.read('secret/data/meeshy-dma/firebase'),
    encryption: await vault.read('secret/data/meeshy-dma/encryption')
  };
  return secrets;
}
```

---

## Canary Rollout Procedure

### Pre-Rollout: Staging Validation (Day 1-2)

**Smoke Tests:**
```bash
# Deploy to staging environment
npm run deploy:staging

# Run smoke test suite
npm run test:smoke

# Expected: All tests pass
# - Health check endpoint responds
# - Database operations work
# - Message encryption/decryption works
# - XMPP federation works
# - Offline messages queue works
```

**Team Sign-Off:**
- [ ] QA lead approves smoke tests
- [ ] DevOps lead verifies infrastructure
- [ ] Security lead reviews deployment plan
- [ ] On-call engineer briefed

### Canary 1: 5% Traffic (Day 3 - 6:00 UTC)

**Deployment:**
```bash
# Deploy to canary pool (5% of traffic)
kubectl set image deployment/meeshy-dma \
  meeshy-dma=meeshy:v3.0.0-rc1 \
  --record \
  -n production

# Scale to 5% (assuming 100 pods total)
kubectl scale deployment meeshy-dma --replicas=5 -n production-canary
kubectl scale deployment meeshy-dma --replicas=95 -n production-stable
```

**Monitoring (1 hour):**
```bash
# Watch error rates
kubectl logs -f deployment/meeshy-dma -n production-canary

# Check metrics
curl http://prometheus:9090/api/v1/query?query=rate(http_requests_total{job="meeshy-dma"}[5m])

# Compare: canary vs stable
# Error rate canary: should be < 2% vs stable baseline 0.5%
# Latency p99 canary: should be < 600ms vs stable baseline 300ms
```

**Success Criteria:**
- ✅ Error rate < 2% (or < 4x baseline)
- ✅ Latency p99 < 600ms (or < 2x baseline)
- ✅ No data corruption
- ✅ Zero unexpected restart loops
- ✅ Memory growth linear

**Decision: Proceed or Rollback**
```
IF error_rate < 2% AND latency_p99 < 600ms THEN
  Proceed to Canary 2
ELSE
  Rollback immediately
  Investigate root cause
  Fix and retry
```

### Canary 2: 25% Traffic (Day 3 - 10:00 UTC)

**Deployment:**
```bash
# Scale canary to 25%
kubectl scale deployment meeshy-dma --replicas=25 -n production-canary
kubectl scale deployment meeshy-dma --replicas=75 -n production-stable
```

**Monitoring (4 hours):**
- Same metrics as Canary 1
- Extended duration to catch delayed issues
- Monitor for: connection stability, message delivery rate, offline queue handling

**Success Criteria:**
- ✅ Same as Canary 1
- ✅ 4-hour sustained metrics valid
- ✅ Offline message delivery: 100%
- ✅ Session establishment: 100%

**Decision: Proceed to Full Rollout or Investigate**

### Full Rollout: 100% Traffic (Day 4 - 6:00 UTC)

**Deployment:**
```bash
# Scale to full production
kubectl scale deployment meeshy-dma --replicas=100 -n production

# Verify all pods running
kubectl get pods -n production | grep meeshy-dma

# Watch for any issues during spike
kubectl logs -f deployment/meeshy-dma -n production
```

**Continuous Monitoring (24 hours):**
```
✓ Error rate stays < 1%
✓ Latency p99 stays < 500ms
✓ Memory stable (< 10MB growth)
✓ CPU usage < 80%
✓ Zero stale sessions
✓ Message delivery 100%
✓ Database performance stable
```

**Post-Rollout Actions (24 hours after full deployment):**
1. [ ] Review logs for any errors
2. [ ] Verify all 4 DMA models populated
3. [ ] Run data integrity checks
4. [ ] Decommission stable pool (if no rollback needed)
5. [ ] Update documentation
6. [ ] Schedule post-mortem (if any issues)

---

## Incident Response

### Incident Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---|---|
| **P0** | Complete outage, no users can access | Immediate (< 5 min) | CTO + Full team |
| **P1** | Major functionality broken, 25%+ users affected | 15 minutes | Engineering lead + On-call |
| **P2** | Partial functionality issue, < 25% users affected | 30 minutes | On-call engineer |
| **P3** | Minor issue, no user impact | 4 hours | No escalation |

### P0 Incident: Service Down

**Immediate Actions (0-5 minutes):**
```bash
# 1. Health check
curl http://localhost:3000/health

# 2. Check logs
tail -f logs/production.log | grep -i error

# 3. Check database connectivity
mongosh --eval "db.adminCommand('ping')"

# 4. Declare incident
# - Notify #incidents Slack channel
# - Page on-call engineer + manager
# - Start status page incident
```

**Investigation (5-15 minutes):**
```bash
# 1. Check metrics
# - Error rate spike?
# - Latency spike?
# - Connection failures?

# 2. Recent deployments?
kubectl rollout history deployment/meeshy-dma -n production

# 3. Database issues?
kubectl logs deployment/mongodb -n databases

# 4. Dependency issues?
# - Check Firebase status
# - Check XMPP connectivity
# - Check Vault access
```

**Resolution:**

**Option A: Rollback** (if recent deployment)
```bash
# Immediate rollback
kubectl rollout undo deployment/meeshy-dma -n production

# Verify
curl http://localhost:3000/health

# Notify Slack
# "Rolled back to previous version. Investigation ongoing."
```

**Option B: Scaling** (if capacity issue)
```bash
# Increase replicas
kubectl scale deployment meeshy-dma --replicas=150 -n production

# Monitor recovery
watch kubectl get pods
```

**Option C: Fix & Deploy** (if code bug)
```bash
# Fix bug in code
# git commit && git push

# Deploy hotfix
kubectl set image deployment/meeshy-dma meeshy-dma=meeshy:v3.0.1-hotfix-1

# Verify
curl http://localhost:3000/health
```

### P1 Incident: High Error Rate

**Threshold:** Error rate > 5% for > 5 minutes

**Automated Response:**
```yaml
# Prometheus alert triggers
alert: HighErrorRate
condition: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
action:
  - Send Slack notification to #incidents
  - Page on-call engineer
  - Trigger runbook: investigate-errors.sh
```

**Manual Investigation:**
```bash
# 1. Identify error types
curl 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status="500"}[5m])' | jq

# 2. Check affected endpoints
curl 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m]) by (route)' | jq

# 3. Review logs for that endpoint
kubectl logs -f deployment/meeshy-dma -n production | grep "/dma/messages"

# 4. Decide: scaling, rollback, or fix
```

### Rollback Decision Tree

```
Error Rate > 5% AND recently deployed?
├─ YES: kubectl rollout undo (0-5 min)
└─ NO: ↓

Database connectivity issues?
├─ YES: Check MongoDB cluster, restart connection pool
└─ NO: ↓

XMPP federation errors?
├─ YES: Check XMPP server, restart connections
└─ NO: ↓

Memory leak detected?
├─ YES: Gradual rollout + code fix
└─ NO: ↓

Unknown: Scale up and investigate logs for 10 minutes
```

---

## Rollback Procedures

### Automatic Rollback Triggers

```yaml
# Prometheus AlertManager rules
- alert: AutomaticRollback
  expr: |
    (rate(http_requests_total{status=~"5.."}[5m]) > 0.1) OR
    (histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 1) OR
    (rate(process_resident_memory_bytes[5m]) > 100000000) OR # 100MB/sec
    (up{job="mongodb"} == 0)
  for: 2m
  annotations:
    action: "webhook_call_to_rollback_service"
```

### Manual Rollback Steps

**Safe Rollback:**
```bash
# 1. Get current version
kubectl get deployment meeshy-dma -o jsonpath='{.spec.template.spec.containers[0].image}'
# Output: meeshy:v3.0.0

# 2. Get previous versions
kubectl rollout history deployment/meeshy-dma -n production
# 1 → meeshy:v2.9.9
# 2 → meeshy:v3.0.0 (current)

# 3. Rollback to v2.9.9
kubectl rollout undo deployment/meeshy-dma -n production --to-revision=1

# 4. Verify rollback
kubectl get pods -n production
kubectl rollout status deployment/meeshy-dma -n production

# 5. Verify application
curl http://localhost:3000/health

# 6. Monitor metrics for recovery
# - Error rate should drop
# - Latency should normalize
# - Restart count should be < 2
```

**Fast Rollback (Emergency):**
```bash
# If Kubernetes is slow, direct container restart
docker ps | grep meeshy-dma | awk '{print $1}' | xargs docker kill

# Services should auto-restart with previous image
# Monitor: docker logs <container_id>
```

**Database Rollback (MongoDB):**
```bash
# If data corruption suspected, restore from backup
# 1. Stop application
kubectl scale deployment meeshy-dma --replicas=0 -n production

# 2. Restore from backup
mongorestore --uri "mongodb+srv://user:pass@cluster.mongodb.net/meeshy-dma" \
  --archive=backups/mongodb_snapshot_$(date -d '1 day ago' +%Y%m%d).archive

# 3. Validate data
mongo localhost:27017/meeshy-dma --eval "db.dma_enrollments.countDocuments()"

# 4. Restart application
kubectl scale deployment meeshy-dma --replicas=100 -n production

# 5. Verify
curl http://localhost:3000/health
```

---

## Monitoring Checklist

### Daily (Automated)

- [ ] Prometheus scraping metrics
- [ ] Grafana dashboards updated
- [ ] Alertmanager rules active
- [ ] Log aggregation ingesting logs
- [ ] Backup snapshots completed

### Weekly (Manual)

- [ ] Review error logs
- [ ] Check database performance
- [ ] Verify backup integrity
- [ ] Test disaster recovery
- [ ] Capacity planning review

### Monthly

- [ ] Rotate credentials (passwords)
- [ ] Update security patches
- [ ] Performance trend analysis
- [ ] Cost review
- [ ] Incident postmortem review

---

**Status:** ✅ Phase 3 Deployment & Monitoring Guide Ready

**Next Step:** Begin canary rollout as outlined in Canary Rollout Procedure section
