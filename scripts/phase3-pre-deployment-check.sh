#!/bin/bash

# Phase 3 Pre-Deployment Validation Checklist
# This script validates that all infrastructure and code is ready for Phase 3 testing
# Usage: bash scripts/phase3-pre-deployment-check.sh

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 3 Pre-Deployment Validation${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Helper functions
pass() {
  echo -e "${GREEN}✓ $1${NC}"
  ((PASSED++))
}

fail() {
  echo -e "${RED}✗ $1${NC}"
  ((FAILED++))
}

warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
  ((WARNINGS++))
}

info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

# ===== Code Readiness Checks =====
echo -e "${BLUE}## CODE READINESS${NC}\n"

# Check TypeScript compilation
if npm run build &>/dev/null; then
  pass "TypeScript compilation successful"
else
  fail "TypeScript compilation failed (DMA components should compile cleanly)"
fi

# Check for DMA component files
if [ -f "gateway/src/dma-interoperability/adapters/LibraryAdapters.ts" ]; then
  pass "Option B - Production library adapters found"
else
  fail "Option B - Production library adapters missing"
fi

if [ -f "shared/schema.prisma" ] && grep -q "model DMAEnrollment" shared/schema.prisma; then
  pass "Option C - Prisma DMA models found"
else
  fail "Option C - Prisma DMA models missing"
fi

if [ -d "gateway/tests/load-testing" ] && [ -f "gateway/tests/load-testing/01-enrollment-concurrency.js" ]; then
  pass "Option D - Load testing scripts found (5 scenarios)"
else
  fail "Option D - Load testing scripts missing"
fi

# ===== Documentation Checks =====
echo -e "\n${BLUE}## DOCUMENTATION${NC}\n"

if [ -f "docs/dma-phase1/PHASE_3_SECURITY_AUDIT_PLAN.md" ]; then
  pass "Phase 3 Security Audit Plan documented"
else
  fail "Phase 3 Security Audit Plan missing"
fi

if [ -f "docs/dma-phase1/PHASE_3_DEPLOYMENT_MONITORING.md" ]; then
  pass "Phase 3 Deployment & Monitoring Guide documented"
else
  fail "Phase 3 Deployment & Monitoring Guide missing"
fi

if [ -f "docs/dma-phase1/PHASE_3_TIMELINE_EXECUTION_SUMMARY.md" ]; then
  pass "Phase 3 Timeline & Execution Summary documented"
else
  fail "Phase 3 Timeline & Execution Summary missing"
fi

# ===== Infrastructure Checks =====
echo -e "\n${BLUE}## INFRASTRUCTURE READINESS${NC}\n"

# Check for Prometheus config
if [ -f "infrastructure/prometheus/prometheus.yml" ]; then
  pass "Prometheus configuration found"
else
  fail "Prometheus configuration missing"
fi

# Check for Grafana dashboards
if [ -f "infrastructure/grafana/dashboards/meeshy-dma-phase3-overview.json" ]; then
  pass "Grafana Phase 3 dashboard configured"
else
  fail "Grafana Phase 3 dashboard missing"
fi

# Check for Docker Compose
if [ -f "infrastructure/docker-compose.phase3.yml" ]; then
  pass "Docker Compose Phase 3 stack configured"
else
  fail "Docker Compose Phase 3 stack missing"
fi

# Check for Alertmanager config
if [ -f "infrastructure/alertmanager/config.yml" ]; then
  pass "Alertmanager configuration found"
else
  warn "Alertmanager configuration missing (optional for local testing)"
fi

# ===== Docker/Environment Checks =====
echo -e "\n${BLUE}## ENVIRONMENT & DEPENDENCIES${NC}\n"

# Check Docker
if command -v docker &> /dev/null; then
  pass "Docker installed"

  # Check Docker daemon
  if docker ps &>/dev/null; then
    pass "Docker daemon running"
  else
    fail "Docker daemon not running (needed for Phase 3 testing)"
  fi
else
  fail "Docker not installed (required for Phase 3 infrastructure)"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
  pass "Docker Compose installed"
  docker_compose_version=$(docker-compose --version | grep -oP '(?<=version )[\d.]+')
  info "  Docker Compose version: $docker_compose_version"
else
  fail "Docker Compose not installed (required for Phase 3)"
fi

# Check npm/Node
if command -v npm &> /dev/null; then
  pass "npm installed"
  node_version=$(node --version)
  npm_version=$(npm --version)
  info "  Node version: $node_version"
  info "  npm version: $npm_version"
else
  fail "npm not installed (required for local testing)"
fi

# Check k6
if command -v k6 &> /dev/null; then
  pass "k6 load testing tool installed"
  k6_version=$(k6 --version)
  info "  $k6_version"
else
  warn "k6 not installed (optional - can install via: brew install k6 or npm install -g k6)"
fi

# Check MongoDB CLI
if command -v mongosh &> /dev/null; then
  pass "MongoDB CLI (mongosh) installed"
else
  warn "mongosh not installed (optional - for manual MongoDB management)"
fi

# ===== Git/VCS Checks =====
echo -e "\n${BLUE}## VERSION CONTROL${NC}\n"

if git status &>/dev/null; then
  pass "Git repository initialized"

  # Check branch
  current_branch=$(git rev-parse --abbrev-ref HEAD)
  if [[ $current_branch == "claude/"* ]]; then
    pass "On feature branch: $current_branch"
  else
    warn "Not on expected feature branch (current: $current_branch)"
  fi

  # Check commits
  commit_count=$(git rev-list --count HEAD)
  info "  Total commits: $commit_count"

  # Check for uncommitted changes
  if git diff-index --quiet HEAD --; then
    pass "Working directory clean"
  else
    warn "Uncommitted changes detected (should commit before Phase 3)"
  fi
else
  fail "Not a git repository"
fi

# ===== Phase 3 Specific Readiness =====
echo -e "\n${BLUE}## PHASE 3 SPECIFIC READINESS${NC}\n"

# Check if .env exists for secrets
if [ -f ".env" ]; then
  pass ".env file found (for local secrets)"
else
  warn ".env file not found (create for Phase 3 testing with DB passwords, etc)"
fi

# Check for MongoDB initialization script
if [ -f "infrastructure/mongodb/init.js" ]; then
  pass "MongoDB initialization script found"
else
  info "MongoDB initialization script not found (will be created if needed)"
fi

# Check Prisma is installed
if [ -f "node_modules/.bin/prisma" ]; then
  pass "Prisma ORM installed"
  prisma_version=$(npm list @prisma/client | grep @prisma/client | head -1)
  info "  $prisma_version"
else
  fail "Prisma ORM not installed (required for DMA database operations)"
fi

# ===== Success Criteria =====
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}VALIDATION SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo "✓ Passed:  $PASSED"
echo "✗ Failed:  $FAILED"
echo "⚠ Warnings: $WARNINGS"

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✓ All critical checks passed!${NC}"

  if [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ No warnings - ready for Phase 3 execution${NC}\n"
    exit 0
  else
    echo -e "${YELLOW}⚠ Some warnings detected - review before Phase 3${NC}\n"
    exit 0
  fi
else
  echo -e "\n${RED}✗ Critical checks failed - cannot proceed with Phase 3${NC}"
  echo -e "${RED}Please fix the failed items above and retry${NC}\n"
  exit 1
fi
