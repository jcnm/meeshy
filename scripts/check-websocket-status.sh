#!/bin/bash

# Script de vérification du statut WebSocket
# Vérifie si le problème "Invalid namespace" est résolu

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

DROPLET_IP="$1"

if [ -z "$DROPLET_IP" ]; then
    log_error "Usage: $0 <DROPLET_IP>"
    log_info "Exemple: $0 157.230.15.51"
    exit 1
fi

log_info "🔍 Vérification WebSocket sur $DROPLET_IP"

# Vérifier la connexion SSH
if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@$DROPLET_IP "echo 'SSH OK'" >/dev/null 2>&1; then
    log_error "Connexion SSH impossible"
    exit 1
fi

echo ""
log_info "📊 État des services Docker:"
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose ps"

echo ""
log_info "🌐 Test de connectivité des services:"

# Test Gateway
if ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "curl -f -s https://gate.meeshy.me/health" >/dev/null 2>&1; then
    log_success "Gateway: https://gate.meeshy.me/health"
else
    log_error "Gateway: https://gate.meeshy.me/health"
fi

# Test Frontend
if ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "curl -f -s https://meeshy.me/" >/dev/null 2>&1; then
    log_success "Frontend: https://meeshy.me/"
else
    log_error "Frontend: https://meeshy.me/"
fi

echo ""
log_info "🔍 Recherche d'erreurs WebSocket dans les logs (dernières 50 lignes):"

# Logs Gateway
echo "📊 Logs Gateway (WebSocket):"
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose logs --tail 50 gateway | grep -i 'websocket\|socket.io\|namespace\|ws' || echo 'Aucune erreur WebSocket Gateway'"

echo ""
echo "📊 Logs Frontend (WebSocket):"
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose logs --tail 50 frontend | grep -i 'websocket\|socket.io\|namespace\|ws\|url' || echo 'Aucune erreur WebSocket Frontend'"

echo ""
log_info "🔎 Recherche d'erreurs 'Invalid namespace':"
INVALID_NAMESPACE=$(ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose logs --tail 100 gateway frontend | grep -i 'invalid namespace' | wc -l")

if [ "$INVALID_NAMESPACE" -gt 0 ]; then
    log_error "Trouvé $INVALID_NAMESPACE erreurs 'Invalid namespace' dans les logs"
    echo "Dernières erreurs:"
    ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose logs --tail 100 gateway frontend | grep -i 'invalid namespace' | tail -5"
else
    log_success "Aucune erreur 'Invalid namespace' trouvée"
fi

echo ""
log_info "🔧 Configuration WebSocket actuelle:"

# Vérifier variables d'environnement
echo "Variables d'environnement:"
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && grep 'NEXT_PUBLIC_WS_URL\|NEXT_PUBLIC_BACKEND_URL' .env || echo 'Variables non trouvées'"

echo ""
log_info "📋 Instructions de test manuel:"
echo "1. Ouvrir https://meeshy.me dans un navigateur"
echo "2. Ouvrir les DevTools (F12) -> Console"
echo "3. Rechercher des erreurs contenant 'Invalid namespace' ou 'WebSocket'"
echo "4. Si aucune erreur, le problème est résolu ✅"

echo ""
log_info "🔄 Pour redéployer en cas de problème:"
echo "./scripts/fix-websocket-production-urgent.sh $DROPLET_IP"
