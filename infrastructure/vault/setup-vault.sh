#!/bin/bash

# HashiCorp Vault Setup for Phase 3 Secrets Management
# This script initializes Vault, configures secrets engine, and sets up auth methods

set -e

# Configuration
VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-}"
UNSEAL_KEYS_FILE="/tmp/vault-unseal-keys.txt"
ROOT_TOKEN_FILE="/tmp/vault-root-token.txt"
VAULT_INIT_FILE="/tmp/vault-init.json"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}HashiCorp Vault Setup for Phase 3${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Helper functions
info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

success() {
  echo -e "${GREEN}✓ $1${NC}"
}

error() {
  echo -e "${RED}✗ $1${NC}"
}

warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Check Vault connectivity
check_vault() {
  info "Checking Vault connectivity..."

  if ! curl -s "$VAULT_ADDR/v1/sys/health" &>/dev/null; then
    error "Vault not accessible at $VAULT_ADDR"
    error "Start Vault with: vault server -dev -dev-root-token-id=root"
    exit 1
  fi

  success "Vault accessible at $VAULT_ADDR"
}

# Initialize Vault (production HA cluster)
init_vault() {
  info "Initializing Vault cluster..."

  if [ -f "$VAULT_INIT_FILE" ]; then
    warn "Vault already initialized (found $VAULT_INIT_FILE)"
    return
  fi

  # Initialize with 5 key shares, 3 key threshold (for HA setup)
  vault operator init \
    -key-shares=5 \
    -key-threshold=3 \
    -format=json > "$VAULT_INIT_FILE"

  if [ $? -eq 0 ]; then
    success "Vault initialized"

    # Extract and save unseal keys
    jq -r '.unseal_keys_b64[]' "$VAULT_INIT_FILE" > "$UNSEAL_KEYS_FILE"
    success "Unseal keys saved to: $UNSEAL_KEYS_FILE"

    # Extract and save root token
    jq -r '.root_token' "$VAULT_INIT_FILE" > "$ROOT_TOKEN_FILE"
    success "Root token saved to: $ROOT_TOKEN_FILE"

    echo ""
    warn "IMPORTANT: Store these securely and never commit to version control:"
    echo "  - Unseal keys: $UNSEAL_KEYS_FILE"
    echo "  - Root token: $ROOT_TOKEN_FILE"
    echo ""
  else
    error "Vault initialization failed"
    exit 1
  fi
}

# Unseal Vault
unseal_vault() {
  info "Unsealing Vault..."

  if [ ! -f "$UNSEAL_KEYS_FILE" ]; then
    error "Unseal keys file not found: $UNSEAL_KEYS_FILE"
    error "Run init_vault() first or restore from backup"
    exit 1
  fi

  # Unseal with first 3 keys
  local count=0
  while IFS= read -r key && [ $count -lt 3 ]; do
    vault operator unseal "$key" &>/dev/null
    ((count++))
  done < "$UNSEAL_KEYS_FILE"

  success "Vault unsealed"
}

# Login to Vault
login_vault() {
  info "Logging into Vault..."

  if [ ! -f "$ROOT_TOKEN_FILE" ]; then
    error "Root token file not found: $ROOT_TOKEN_FILE"
    exit 1
  fi

  export VAULT_TOKEN=$(cat "$ROOT_TOKEN_FILE")
  success "Logged in as root"
}

# Enable secrets engine
enable_secrets_engine() {
  info "Enabling KV v2 secrets engine..."

  if vault secrets list | grep -q "secret/"; then
    warn "KV v2 secrets engine already enabled"
    return
  fi

  vault secrets enable -version=2 -path=secret kv
  success "KV v2 secrets engine enabled at path: secret/"
}

# Create authentication policy
create_policy() {
  info "Creating Vault policy for meeshy-dma..."

  # Create policy file
  cat > /tmp/meeshy-dma-policy.hcl <<'EOF'
# Meeshy Signal DMA Vault Policy
# Controls access to DMA secrets for application

# Allow reading DMA secrets
path "secret/data/meeshy-dma/*" {
  capabilities = ["read", "list"]
}

# Allow reading metadata
path "secret/metadata/meeshy-dma/*" {
  capabilities = ["list"]
}

# Allow database credential generation
path "database/creds/meeshy-dma" {
  capabilities = ["read"]
}

# Allow PKI certificate requests
path "pki/issue/meeshy-dma" {
  capabilities = ["create", "update"]
}

# Allow token self-renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Allow token lookup
path "auth/token/lookup-self" {
  capabilities = ["read"]
}
EOF

  vault policy write meeshy-dma /tmp/meeshy-dma-policy.hcl
  success "Policy created: meeshy-dma"
}

# Store secrets
store_secrets() {
  info "Storing DMA secrets in Vault..."

  # MongoDB credentials
  vault kv put secret/meeshy-dma/mongodb \
    username="meeshy" \
    password="${MONGODB_PASSWORD:-change_me_in_production}" \
    uri="mongodb://meeshy:${MONGODB_PASSWORD:-change_me}@mongodb:27017/meeshy-dma?authSource=admin"

  success "MongoDB credentials stored"

  # JWT signing key (generate if not exists)
  if [ ! -f "/tmp/jwt-key.pem" ]; then
    openssl genrsa -out /tmp/jwt-key.pem 2048 2>/dev/null
  fi
  JWT_KEY=$(cat /tmp/jwt-key.pem | base64)

  vault kv put secret/meeshy-dma/jwt \
    signing_key="$JWT_KEY" \
    algorithm="RS256" \
    expiration="86400"

  success "JWT signing key stored"

  # Encryption master key
  ENCRYPTION_KEY=$(openssl rand -base64 32)
  vault kv put secret/meeshy-dma/encryption \
    master_key="$ENCRYPTION_KEY" \
    algorithm="AES-256-GCM"

  success "Encryption master key stored"

  # Firebase credentials (placeholder)
  vault kv put secret/meeshy-dma/firebase \
    service_account='{"type":"service_account","project_id":"meeshy-dma"}' \
    api_key="AIzaSy..." \
    auth_domain="meeshy-dma.firebaseapp.com"

  success "Firebase credentials stored (placeholder)"

  # XMPP credentials
  vault kv put secret/meeshy-dma/xmpp \
    host="xmpp.whatsapp.com" \
    port="5223" \
    username="${XMPP_USERNAME:-bot@whatsapp.com}" \
    password="${XMPP_PASSWORD:-change_me}" \
    tls_enabled="true"

  success "XMPP credentials stored"

  # Push notification credentials
  vault kv put secret/meeshy-dma/push-notifications \
    fcm_server_key="${FCM_SERVER_KEY:-}" \
    apns_certificate="${APNS_CERT:-}" \
    apns_key="${APNS_KEY:-}" \
    webpush_vapid_public="${WEBPUSH_PUBLIC:-}" \
    webpush_vapid_private="${WEBPUSH_PRIVATE:-}"

  success "Push notification credentials stored"
}

# Enable Kubernetes auth (for production)
enable_k8s_auth() {
  info "Enabling Kubernetes authentication..."

  if vault auth list | grep -q "kubernetes/"; then
    warn "Kubernetes auth already enabled"
    return
  fi

  vault auth enable kubernetes
  success "Kubernetes authentication enabled"

  # Configure K8s auth
  vault write auth/kubernetes/config \
    kubernetes_host="https://\$KUBERNETES_SERVICE_HOST:\$KUBERNETES_SERVICE_PORT" \
    kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
    token_reviewer_jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token

  success "Kubernetes auth configured"

  # Create role for meeshy-dma
  vault write auth/kubernetes/role/meeshy-dma \
    bound_service_account_names=meeshy-dma \
    bound_service_account_namespaces=default \
    policies=meeshy-dma \
    ttl=24h

  success "Kubernetes role created: meeshy-dma"
}

# Enable AppRole auth (for service-to-service)
enable_approle_auth() {
  info "Enabling AppRole authentication..."

  if vault auth list | grep -q "approle/"; then
    warn "AppRole auth already enabled"
    return
  fi

  vault auth enable approle
  success "AppRole authentication enabled"

  # Create AppRole for meeshy-dma
  vault write auth/approle/role/meeshy-dma \
    token_ttl=1h \
    token_max_ttl=24h \
    policies="meeshy-dma"

  success "AppRole role created"

  # Generate role ID and secret
  ROLE_ID=$(vault read -field=role_id auth/approle/role/meeshy-dma/role-id)
  SECRET_ID=$(vault write -field=secret_id -f auth/approle/role/meeshy-dma/secret-id)

  echo ""
  info "AppRole Credentials:"
  echo "  VAULT_ROLE_ID=$ROLE_ID"
  echo "  VAULT_SECRET_ID=$SECRET_ID"
  echo ""
  warn "Store these securely in your application configuration"
}

# List stored secrets
list_secrets() {
  echo ""
  echo -e "${BLUE}### Stored Secrets ###${NC}"
  vault kv list secret/meeshy-dma
}

# Main execution
main() {
  check_vault
  init_vault || true  # May already be initialized
  unseal_vault
  login_vault
  enable_secrets_engine
  create_policy
  store_secrets
  enable_k8s_auth || true
  enable_approle_auth
  list_secrets

  echo ""
  success "Vault setup complete!"
  echo ""
  echo -e "${BLUE}Next Steps:${NC}"
  echo "1. Update .env with Vault credentials"
  echo "2. Configure your application to read from Vault"
  echo "3. Set VAULT_ADDR environment variable"
  echo "4. For production, use Kubernetes auth instead of AppRole"
  echo ""
  echo "Example application setup:"
  echo "  VAULT_ADDR=http://localhost:8200"
  echo "  VAULT_TOKEN=<root-token-from-$ROOT_TOKEN_FILE>"
  echo "  Or use: VAULT_ROLE_ID and VAULT_SECRET_ID with AppRole"
}

# Run main
main
