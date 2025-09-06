#!/bin/bash

# Script de correction d'urgence pour le problème WebSocket en production
# Corrige l'erreur "Invalid namespace" causée par /ws au lieu de /socket.io/

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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -z "$DROPLET_IP" ]; then
    log_error "Usage: $0 <DROPLET_IP>"
    log_info "Exemple: $0 157.230.15.51"
    exit 1
fi

log_info "🔧 Correction WebSocket Meeshy sur $DROPLET_IP"

# Test de connexion SSH
log_info "🔐 Test de connexion SSH..."
if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$DROPLET_IP "echo 'SSH OK'" >/dev/null 2>&1; then
    log_error "Impossible de se connecter au serveur $DROPLET_IP"
    exit 1
fi
log_success "Connexion SSH réussie"

# Créer répertoire temporaire
DEPLOY_DIR="/tmp/meeshy-fix-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEPLOY_DIR"

log_info "📁 Préparation des fichiers corrigés..."

# Copier les fichiers avec corrections
cp "$PROJECT_ROOT/docker-compose.traefik.yml" "$DEPLOY_DIR/docker-compose.yml"
cp "$PROJECT_ROOT/env.digitalocean" "$DEPLOY_DIR/.env"
cp -r "$PROJECT_ROOT/docker" "$DEPLOY_DIR/"
cp -r "$PROJECT_ROOT/shared" "$DEPLOY_DIR/"
cp -r "$PROJECT_ROOT/frontend" "$DEPLOY_DIR/"
cp -r "$PROJECT_ROOT/gateway" "$DEPLOY_DIR/"
cp -r "$PROJECT_ROOT/translator" "$DEPLOY_DIR/"

log_info "📤 Envoi des fichiers corrigés..."
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "mkdir -p /opt/meeshy-backup"
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cp -r /opt/meeshy /opt/meeshy-backup/meeshy-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true"

# Envoyer tous les fichiers corrigés
scp -r -o StrictHostKeyChecking=no "$DEPLOY_DIR"/* root@$DROPLET_IP:/opt/meeshy/

# Script de correction sur le serveur
cat << 'EOF' > /tmp/fix-websocket.sh
#!/bin/bash
set -e
cd /opt/meeshy

echo "🛑 Arrêt des services Frontend et Gateway..."
docker-compose down frontend gateway || true

echo "🗂️  Suppression des images anciennes..."
docker rmi $(docker images | grep 'meeshy-frontend\|meeshy-gateway' | awk '{print $3}') 2>/dev/null || true

echo "🔨 Reconstruction COMPLÈTE des images avec corrections..."
docker-compose build --no-cache --force-rm frontend gateway

echo "🧹 Nettoyage du cache Docker..."
docker system prune -f

echo "🚀 Redémarrage des services avec nouvelles images..."
docker-compose up -d gateway
sleep 15

# Vérifier Gateway
echo "🏥 Vérification Gateway..."
for i in {1..10}; do
    if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
        echo "✅ Gateway prêt"
        break
    fi
    echo "⏳ Tentative $i/10 pour Gateway..."
    sleep 3
done

echo "🎨 Redémarrage Frontend..."
docker-compose up -d frontend
sleep 10

# Vérifier Frontend
echo "🏥 Vérification Frontend..."
for i in {1..10}; do
    if docker-compose exec -T frontend curl -f -s http://localhost:3100 >/dev/null 2>&1; then
        echo "✅ Frontend prêt"
        break
    fi
    echo "⏳ Tentative $i/10 pour Frontend..."
    sleep 3
done

echo "📊 État final des services:"
docker-compose ps

echo "🔍 Test des URLs WebSocket dans les logs..."
docker-compose logs frontend | grep -i "ws_url\|websocket" | tail -5 || echo "Aucune info WebSocket trouvée"

echo "✅ Correction WebSocket terminée!"
EOF

log_info "🔧 Exécution des corrections sur le serveur..."
scp -o StrictHostKeyChecking=no /tmp/fix-websocket.sh root@$DROPLET_IP:/tmp/
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "chmod +x /tmp/fix-websocket.sh && /tmp/fix-websocket.sh"

log_info "🧪 Tests de validation..."

# Test Gateway
if ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "curl -f -s https://gate.meeshy.me/health" >/dev/null 2>&1; then
    log_success "Gateway accessible"
else
    log_warning "Gateway non accessible"
fi

# Test Frontend
if ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "curl -f -s https://meeshy.me/" >/dev/null 2>&1; then
    log_success "Frontend accessible"
else
    log_warning "Frontend non accessible"
fi

log_success "🎯 Correction terminée!"

echo ""
echo "📝 Corrections appliquées:"
echo "  • frontend/next.config.ts: Suppression de /ws dans l'URL par défaut"
echo "  • gateway/src/server.ts: Mise à jour documentation endpoints"
echo "  • Images Docker reconstruites complètement"
echo "  • Cache Docker nettoyé"
echo ""
echo "🔍 Pour vérifier:"
echo "  • Ouvrir https://meeshy.me dans le navigateur"
echo "  • Vérifier la console pour les erreurs WebSocket"
echo "  • L'erreur 'Invalid namespace' ne devrait plus apparaître"
echo ""
echo "📋 Logs utiles:"
echo "  ssh root@$DROPLET_IP 'cd /opt/meeshy && docker-compose logs -f frontend'"
echo "  ssh root@$DROPLET_IP 'cd /opt/meeshy && docker-compose logs -f gateway'"

# Nettoyage
rm -rf "$DEPLOY_DIR"
rm -f /tmp/fix-websocket.sh

log_success "🏁 Script terminé avec succès!"
