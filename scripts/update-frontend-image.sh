#!/bin/bash

# Script de mise à jour rapide de l'image Frontend en production
# Corrige définitivement le problème WebSocket namespace

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

log_info "🚀 Mise à jour Frontend avec image corrigée sur $DROPLET_IP"

# Test de connexion SSH
if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$DROPLET_IP "echo 'SSH OK'" >/dev/null 2>&1; then
    log_error "Impossible de se connecter au serveur $DROPLET_IP"
    exit 1
fi
log_success "Connexion SSH réussie"

# Script de mise à jour sur le serveur
cat << 'EOF' > /tmp/update-frontend.sh
#!/bin/bash
set -e
cd /opt/meeshy

echo "🛑 Arrêt du service Frontend..."
docker-compose down frontend

echo "🗑️  Suppression de l'ancienne image Frontend..."
docker rmi isopen/meeshy-frontend:latest 2>/dev/null || true

echo "📥 Téléchargement de la nouvelle image Frontend..."
docker pull isopen/meeshy-frontend:latest

echo "🔍 Vérification de l'image téléchargée..."
docker images | grep meeshy-frontend

echo "🚀 Redémarrage du Frontend avec la nouvelle image..."
docker-compose up -d frontend

echo "⏳ Attente du démarrage..."
sleep 15

echo "🏥 Vérification de la santé du Frontend..."
for i in {1..10}; do
    if docker-compose exec -T frontend curl -f -s http://localhost:3100 >/dev/null 2>&1; then
        echo "✅ Frontend prêt et fonctionnel"
        break
    fi
    echo "⏳ Tentative $i/10 pour Frontend..."
    sleep 3
done

echo "📊 État des services:"
docker-compose ps frontend

echo "🔍 Vérification des logs Frontend (recherche de WS_URL):"
docker-compose logs --tail 20 frontend | grep -i "ws_url\|websocket\|socket.io" || echo "Aucune mention WebSocket trouvée"

echo "✅ Mise à jour Frontend terminée!"
EOF

log_info "📤 Envoi et exécution du script de mise à jour..."
scp -o StrictHostKeyChecking=no /tmp/update-frontend.sh root@$DROPLET_IP:/tmp/
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "chmod +x /tmp/update-frontend.sh && /tmp/update-frontend.sh"

log_info "🧪 Test de connectivité..."

# Test Frontend
if ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "curl -f -s https://meeshy.me/" >/dev/null 2>&1; then
    log_success "Frontend accessible sur https://meeshy.me/"
else
    log_warning "Frontend non accessible"
fi

log_success "🎯 Mise à jour terminée!"

echo ""
echo "📝 Corrections appliquées dans l'image Docker:"
echo "  • ARG NEXT_PUBLIC_WS_URL=wss://gate.meeshy.me (sans /)"
echo "  • ENV NEXT_PUBLIC_WS_URL=wss://gate.meeshy.me (sans /) dans le builder"
echo "  • Image reconstruite et redéployée"
echo ""
echo "🔍 Pour tester:"
echo "  1. Ouvrir https://meeshy.me dans un navigateur"
echo "  2. Ouvrir DevTools (F12) -> Console"
echo "  3. L'erreur 'Invalid namespace' ne devrait plus apparaître"
echo "  4. Le WebSocket devrait se connecter à /socket.io/ au lieu de /ws"
echo ""
echo "📋 Logs utiles:"
echo "  ssh root@$DROPLET_IP 'cd /opt/meeshy && docker-compose logs -f frontend | grep -i websocket'"

# Nettoyage
rm -f /tmp/update-frontend.sh

log_success "🏁 Script terminé avec succès!"
