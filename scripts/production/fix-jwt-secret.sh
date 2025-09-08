#!/bin/bash

# ===== SCRIPT DE CORRECTION JWT SECRET =====
# Ce script corrige le problème de JWT_SECRET vide dans le container gateway

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Correction du JWT_SECRET manquant${NC}"
echo ""

# Vérifier que l'IP du droplet est fournie
if [ -z "$1" ]; then
    echo -e "${RED}❌ Usage: $0 DROPLET_IP${NC}"
    echo -e "${YELLOW}Exemple: $0 157.230.15.51${NC}"
    exit 1
fi

DROPLET_IP="$1"

echo -e "${BLUE}🎯 Cible: ${YELLOW}$DROPLET_IP${NC}"
echo ""

# Fonction pour exécuter une commande sur le serveur distant
run_remote() {
    ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "$1"
}

# Fonction pour afficher le statut
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

echo -e "${BLUE}🔍 Vérification du problème JWT_SECRET...${NC}"

# Vérifier le JWT_SECRET actuel dans le container
JWT_SECRET_CURRENT=$(run_remote "docker exec meeshy-gateway env | grep JWT_SECRET | cut -d'=' -f2")
if [ -z "$JWT_SECRET_CURRENT" ]; then
    log_error "JWT_SECRET est vide dans le container gateway"
else
    log_warning "JWT_SECRET actuel: $JWT_SECRET_CURRENT"
fi

echo ""
log_info "🔧 Correction du fichier .env sur le serveur..."

# Corriger le fichier .env en supprimant les placeholders
run_remote "cd /opt/meeshy && cp .env .env.backup"
run_remote "cd /opt/meeshy && sed -i '/^JWT_SECRET=CHANGE_ME_/d' .env"
run_remote "cd /opt/meeshy && sed -i '/^ADMIN_PASSWORD=CHANGE_ME_/d' .env"
run_remote "cd /opt/meeshy && sed -i '/^MEESHY_BIGBOSS_PASSWORD=CHANGE_ME_/d' .env"
run_remote "cd /opt/meeshy && sed -i '/^MONGODB_PASSWORD=CHANGE_ME_/d' .env"
run_remote "cd /opt/meeshy && sed -i '/^REDIS_PASSWORD=CHANGE_ME_/d' .env"
run_remote "cd /opt/meeshy && sed -i '/^TRAEFIK_USERS=admin:CHANGE_ME_/d' .env"
run_remote "cd /opt/meeshy && sed -i '/^API_USERS=admin:CHANGE_ME_/d' .env"
run_remote "cd /opt/meeshy && sed -i '/^MONGO_USERS=admin:CHANGE_ME_/d' .env"
run_remote "cd /opt/meeshy && sed -i '/^REDIS_USERS=admin:CHANGE_ME_/d' .env"

log_success "Placeholders supprimés du fichier .env"

echo ""
log_info "🔄 Redémarrage des services avec la configuration corrigée..."

# Redémarrer les services
run_remote "cd /opt/meeshy && docker-compose restart gateway translator"

echo ""
log_info "⏳ Attente du redémarrage des services..."
sleep 20

echo ""
log_info "🔍 Vérification du JWT_SECRET corrigé..."

# Vérifier le nouveau JWT_SECRET
JWT_SECRET_NEW=$(run_remote "docker exec meeshy-gateway env | grep JWT_SECRET | cut -d'=' -f2")
if [ -n "$JWT_SECRET_NEW" ] && [ "$JWT_SECRET_NEW" != "CHANGE_ME_JWT_SECRET" ]; then
    log_success "JWT_SECRET corrigé: ${JWT_SECRET_NEW:0:20}..."
else
    log_error "JWT_SECRET toujours vide ou incorrect"
fi

echo ""
log_info "🔍 Vérification du statut des services..."
run_remote "cd /opt/meeshy && docker-compose ps"

echo ""
log_info "🧪 Test de l'authentification..."

# Tester l'authentification
TEST_RESULT=$(run_remote "curl -s -X POST https://gate.meeshy.me/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"testuser123\",\"password\":\"password123\"}' | jq -r '.success' 2>/dev/null || echo 'false'")

if [ "$TEST_RESULT" = "true" ]; then
    log_success "🎉 Authentification fonctionnelle !"
else
    log_warning "⚠️  Authentification encore problématique, vérifiez les logs"
fi

echo ""
log_success "🎉 Correction du JWT_SECRET terminée !"
echo ""
echo -e "${YELLOW}💡 Si le problème persiste:${NC}"
echo -e "  • Vérifiez les logs: ${BLUE}docker logs meeshy-gateway${NC}"
echo -e "  • Vérifiez le fichier .env: ${BLUE}cat /opt/meeshy/.env | grep JWT_SECRET${NC}"
echo -e "  • Redémarrez manuellement: ${BLUE}docker-compose restart gateway${NC}"
echo ""
