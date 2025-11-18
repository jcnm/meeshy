# Phase 3 Quick Start Guide
**Date:** November 18, 2025
**Status:** Ready for Phase 3 Execution

---

## Overview

This guide provides step-by-step instructions for executing Phase 3 of the Meeshy Signal DMA implementation:
- **Weeks 10-11:** Security Audit & Validation
- **Weeks 11-12:** Load Testing
- **Week 13:** Production Deployment & Monitoring

---

## Prerequisites

### Required Software

Install these on your local machine or server:

```bash
# Core tools
brew install docker docker-compose node npm
brew install vault k6  # Optional: k6 can use cloud version

# Verify installations
docker --version      # Docker 24.0+
docker-compose --version  # Docker Compose 2.20+
node --version        # Node.js 20 LTS
npm --version        # npm 10+
vault --version       # Vault 1.15+
k6 --version         # k6 latest (optional)
```

### Clone and Setup Repository

```bash
cd /path/to/meeshy
git checkout claude/signal-protocol-implementation-017s1EBSAQGRVuwprJ5ZkxqP
npm install
```

---

## Quick Start: 5-Minute Setup

### Step 1: Verify Pre-Deployment Readiness

```bash
bash scripts/phase3-pre-deployment-check.sh
```

Expected output:
```
✓ Passed:  12
✗ Failed:  0
⚠ Warnings: 0
✓ All critical checks passed!
✓ No warnings - ready for Phase 3 execution
```

### Step 2: Start Infrastructure Stack

```bash
# Navigate to infrastructure directory
cd infrastructure

# Start Docker Compose stack (Prometheus, Grafana, MongoDB, etc)
docker-compose -f docker-compose.phase3.yml up -d

# Watch startup
docker-compose -f docker-compose.phase3.yml ps
```

Expected services:
```
NAME                 STATUS
meeshy-mongodb       Up (healthy)
meeshy-prometheus    Up (healthy)
meeshy-grafana       Up (healthy)
meeshy-alertmanager  Up (healthy)
meeshy-node-exporter Up (healthy)
meeshy-redis         Up (healthy)
```

### Step 3: Access Monitoring Dashboards

Open in your browser:

- **Grafana:** http://localhost:3001
  - Username: `admin`
  - Password: `admin123` (change in production!)
  - Dashboard: "Meeshy Signal DMA - Phase 3 Production Overview"

- **Prometheus:** http://localhost:9090
  - Query interface for raw metrics
  - Alert rules: Status → Rules

- **MongoDB:** localhost:27017
  - Username: `meeshy`
  - Password: (set in `.env` or Docker Compose)

- **Alertmanager:** http://localhost:9093
  - Alert routing and history

### Step 4: Initialize Vault (Secrets Management)

```bash
# Start Vault development server (for testing)
vault server -dev -dev-root-token-id=root &

# Setup secrets
bash infrastructure/vault/setup-vault.sh

# Verify
vault kv list secret/meeshy-dma
```

### Step 5: Run Pre-Deployment Checks

```bash
# Validate everything is running
bash scripts/phase3-pre-deployment-check.sh

# Should show: ✓ All critical checks passed!
```

---

## Running Load Tests

### Option A: Single Test Scenario

```bash
# Test enrollment concurrency (1000 users)
bash scripts/run-load-tests.sh 01

# View results in Grafana dashboard
# Latency, throughput, and error rates will appear in real-time
```

### Option B: All Scenarios Sequential

```bash
# Run all 5 load testing scenarios
bash scripts/run-load-tests.sh all

# This will run:
# 1. Enrollment Concurrency (4 minutes)
# 2. Message Throughput (1 hour)
# 3. Offline Queue (2 hours)
# 4. Session Establishment (10 minutes)
# 5. 24-Hour Stability (1 hour for testing, 24h for production)
```

### Load Test Descriptions

| # | Name | Duration | VUs | Target | Success Criteria |
|---|------|----------|-----|--------|-----------------|
| 1 | Enrollment | 4 min | 100 | 1000 concurrent | P99 < 500ms |
| 2 | Throughput | 1 hour | 100 | 10k msg/hour | 99.99% delivery |
| 3 | Offline Queue | 2 hours | 500 | 5k messages | 0 duplicates |
| 4 | Sessions | 10 min | 1000 | X3DH + Noise | < 150ms setup |
| 5 | Stability | 1-24 hours | 100 | Sustained | 99.99% uptime |

---

## Monitoring During Tests

### Real-Time Dashboards

During load testing, monitor these Grafana panels:

**Performance Metrics:**
- Request Rate (req/sec)
- Latency Distribution (P50, P99, P99.9)
- Error Rate (%)
- Message Throughput (msg/sec)

**System Health:**
- CPU Usage (%)
- Memory Usage (%)
- Database Connections
- Disk Usage

**Application Metrics:**
- Encryption Latency
- Message Delivery Rate
- Session Count
- Offline Queue Size

### Alert Notifications

Alerts are configured to notify:
- **Critical (Slack #incidents):** Service down, high error rate, DB issues
- **Warning (Slack #alerts-warnings):** High latency, memory leak, connection spike
- **Info (Slack #monitoring):** Performance trends, delivery rates

Configure Slack webhook in `infrastructure/alertmanager/config.yml`:
```yaml
slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
```

---

## Security Audit Phase

### Week 10-11: Conduct Security Review

1. **Select Security Firm:**
   - Trail of Bits (Signal Protocol specialists)
   - Cure53 (XMPP federation experts)
   - Contact: sales@trailofbits.com

2. **SAST Scanning:**
   ```bash
   # SonarQube setup
   docker run -d --name sonarqube -p 9000:9000 sonarqube:latest

   # Snyk setup
   npm install -g snyk
   snyk auth
   snyk test gateway/src/dma-interoperability/
   ```

3. **Penetration Testing:**
   - XMPP federation security
   - Signal Protocol message flow
   - Database access controls
   - API authentication/authorization

4. **Key Management Audit:**
   - Verify key generation entropy
   - Check encryption-at-rest implementation
   - Test key rotation procedures

See detailed procedures in: `docs/dma-phase1/PHASE_3_SECURITY_AUDIT_PLAN.md`

---

## Production Deployment Phase

### Week 13: Canary Rollout

#### Stage 1: Staging Validation (Day 1)

```bash
# Deploy to staging environment
npm run build
npm run deploy:staging

# Run smoke tests
npm run test:smoke

# Verify all health checks pass
```

#### Stage 2: Canary 1 - 5% Traffic (Day 2)

```bash
# Deploy canary version to 5% of pods
kubectl set image deployment/meeshy-dma \
  meeshy-dma=meeshy:v3.0.0-rc1 \
  --record \
  -n production

# Scale canary
kubectl scale deployment meeshy-dma --replicas=5 -n production-canary
kubectl scale deployment meeshy-dma --replicas=95 -n production-stable

# Monitor for 1 hour
# Watch error rate, latency, memory
# Alert thresholds: error rate < 2%, latency P99 < 600ms

# Decision:
# IF metrics good THEN proceed to Canary 2
# ELSE rollback and investigate
```

#### Stage 3: Canary 2 - 25% Traffic (Day 2-3)

```bash
# Scale canary to 25%
kubectl scale deployment meeshy-dma --replicas=25 -n production-canary
kubectl scale deployment meeshy-dma --replicas=75 -n production-stable

# Monitor for 4 hours
# Extended observation for delayed failures
# Same alerts as Canary 1

# Decision:
# IF metrics good THEN proceed to full rollout
# ELSE investigate root cause, fix, restart canary
```

#### Stage 4: Full Rollout - 100% Traffic (Day 3-4)

```bash
# Deploy to all pods
kubectl scale deployment meeshy-dma --replicas=100 -n production

# Monitor continuously for 24 hours
# Success criteria:
# - Error rate < 1%
# - Latency P99 < 500ms
# - Memory stable
# - 100% message delivery
# - Zero data corruption

# Decommission old version after 24h validation
```

---

## Troubleshooting

### Docker Issues

```bash
# Check Docker logs
docker-compose -f infrastructure/docker-compose.phase3.yml logs -f

# Restart single service
docker-compose -f infrastructure/docker-compose.phase3.yml restart prometheus

# View service health
docker-compose -f infrastructure/docker-compose.phase3.yml ps
```

### k6 Load Test Failures

```bash
# Check k6 is installed
k6 --version

# Run test with verbose output
k6 run -v gateway/tests/load-testing/01-enrollment-concurrency.js

# Check API connectivity
curl http://localhost:3000/health
```

### MongoDB Connection Issues

```bash
# Test MongoDB connection
mongosh mongodb://meeshy:password@localhost:27017/meeshy-dma?authSource=admin

# Check collection indices
db.dma_enrollments.getIndexes()

# Verify collections exist
db.getCollectionNames()
```

### Prometheus/Grafana Issues

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Reload Prometheus config
curl -X POST http://localhost:9090/-/reload

# Check Grafana datasources
curl http://localhost:3001/api/datasources
```

---

## Success Criteria Checklist

### ✅ Pre-Deployment

- [ ] Pre-deployment checklist passes (12+ items)
- [ ] All Docker services healthy
- [ ] Prometheus collecting metrics
- [ ] Grafana dashboards accessible
- [ ] MongoDB initialized with collections and indices
- [ ] Vault secrets stored

### ✅ Load Testing

- [ ] Enrollment: 1000 concurrent, P99 < 500ms
- [ ] Throughput: 10,000 msg/hr, 99.99% delivery
- [ ] Offline Queue: 5000 messages, 0 duplicates
- [ ] Sessions: < 150ms setup time
- [ ] Stability: 99.99% uptime, stable memory

### ✅ Security Audit

- [ ] Third-party cryptographic review: PASS
- [ ] SAST scan: All critical/high fixed
- [ ] Penetration test: All findings mitigated
- [ ] Key management audit: PASS

### ✅ Production Deployment

- [ ] Staging validation: PASS
- [ ] Canary 1 (5%): Metrics within threshold
- [ ] Canary 2 (25%): 4-hour metrics valid
- [ ] Full rollout (100%): 24 hours stable
- [ ] Monitoring dashboards: Operational

---

## Documentation References

| Document | Purpose |
|----------|---------|
| [Phase 3 Security Audit Plan](docs/dma-phase1/PHASE_3_SECURITY_AUDIT_PLAN.md) | Detailed security testing procedures |
| [Phase 3 Deployment & Monitoring](docs/dma-phase1/PHASE_3_DEPLOYMENT_MONITORING.md) | Infrastructure setup and operations |
| [Phase 3 Timeline & Execution](docs/dma-phase1/PHASE_3_TIMELINE_EXECUTION_SUMMARY.md) | Day-by-day execution plan |
| [Session 2 Completion Summary](docs/dma-phase1/SESSION_2_COMPLETION_SUMMARY.md) | Overview of Phase 2 & Phase 3 planning |

---

## Support & Escalation

### Issues or Questions?

1. **Check documentation:** See references above
2. **Review runbooks:** `infrastructure/alertmanager/` (incident procedures)
3. **Contact team lead:** [TBD]
4. **On-call engineer:** [TBD] (for production issues)

### Emergency Rollback

```bash
# Immediate rollback to previous version
kubectl rollout undo deployment/meeshy-dma -n production

# Verify
kubectl rollout status deployment/meeshy-dma -n production

# Expected recovery time: < 5 minutes
```

---

## Next Steps

1. **This Week:** Run pre-deployment checks and start Docker stack
2. **Next Week:** Begin load testing suite (scenarios 1-5)
3. **Week After:** Execute canary rollout to production
4. **Final Week:** Production validation and monitoring

**Expected Completion:** December 16, 2025 ✅

---

**Status:** 🟢 Ready for Phase 3 Execution

For detailed information, see documentation in `/docs/dma-phase1/`
