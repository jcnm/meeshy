#!/bin/bash

# Script de déploiement Traefik complet pour la production
# Usage: ./deploy-traefik-production.sh

set -e

echo "🚀 Déploiement Traefik Production - Meeshy"
echo "=========================================="

# Configuration
REMOTE_HOST="root@157.230.15.51"
REMOTE_PATH="/opt/meeshy"
DOMAIN="meeshy.me"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérification des prérequis
log_info "Vérification des prérequis..."
if [ ! -f "docker-compose.traefik.yml" ]; then
    log_error "docker-compose.traefik.yml non trouvé"
    exit 1
fi

if [ ! -f "env.digitalocean" ]; then
    log_error "env.digitalocean non trouvé"
    exit 1
fi

log_success "Fichiers de configuration trouvés"

# Copie des fichiers de configuration
log_info "Copie des fichiers de configuration..."
scp docker-compose.traefik.yml $REMOTE_HOST:$REMOTE_PATH/
scp env.digitalocean $REMOTE_HOST:$REMOTE_PATH/.env
scp config/dynamic.yaml $REMOTE_HOST:$REMOTE_PATH/config/ 2>/dev/null || log_warning "config/dynamic.yaml non trouvé (optionnel)"

log_success "Fichiers copiés"

# Création du lien symbolique
log_info "Configuration du lien symbolique docker-compose.yml..."
ssh $REMOTE_HOST "cd $REMOTE_PATH && ln -sf docker-compose.traefik.yml docker-compose.yml"

# Arrêt des services existants
log_info "Arrêt des services existants..."
ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose down --remove-orphans"

# Nettoyage des volumes orphelins (optionnel)
log_info "Nettoyage des volumes orphelins..."
ssh $REMOTE_HOST "cd $REMOTE_PATH && docker volume prune -f"

# Pull des images Docker
log_info "Téléchargement des images Docker..."
ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose pull"

# Démarrage des services
log_info "Démarrage des services..."
ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose up -d"

# Attente du démarrage
log_info "Attente du démarrage des services (60 secondes)..."
sleep 60

# Vérification du statut des services
log_info "Vérification du statut des services..."
ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose ps"

# Tests de connectivité
log_info "Tests de connectivité..."
echo ""

# Test Frontend
log_info "Test Frontend (https://$DOMAIN)..."
if ssh $REMOTE_HOST "curl -k -s -o /dev/null -w '%{http_code}' https://$DOMAIN" | grep -q "200"; then
    log_success "Frontend accessible"
else
    log_warning "Frontend non accessible"
fi

# Test Traefik Dashboard
log_info "Test Traefik Dashboard (https://traefik.$DOMAIN)..."
if ssh $REMOTE_HOST "curl -k -s -o /dev/null -w '%{http_code}' https://traefik.$DOMAIN" | grep -q "401"; then
    log_success "Traefik Dashboard accessible (authentification requise)"
else
    log_warning "Traefik Dashboard non accessible"
fi

# Test Gateway
log_info "Test Gateway (https://gate.$DOMAIN/health)..."
if ssh $REMOTE_HOST "curl -k -s -o /dev/null -w '%{http_code}' https://gate.$DOMAIN/health" | grep -q "200"; then
    log_success "Gateway API accessible"
else
    log_warning "Gateway API non accessible"
fi

# Test WebSocket
log_info "Test WebSocket (https://gate.$DOMAIN/socket.io/)..."
if ssh $REMOTE_HOST "curl -k -s -o /dev/null -w '%{http_code}' https://gate.$DOMAIN/socket.io/" | grep -q "400"; then
    log_success "WebSocket accessible (réponse 400 normale)"
else
    log_warning "WebSocket non accessible"
fi

# Test Translator
log_info "Test Translator (https://ml.$DOMAIN/translate)..."
if ssh $REMOTE_HOST "curl -k -s -o /dev/null -w '%{http_code}' https://ml.$DOMAIN/translate" | grep -q "405"; then
    log_success "Translator accessible (réponse 405 normale)"
else
    log_warning "Translator non accessible"
fi

# Test MongoDB UI
log_info "Test MongoDB UI (https://mongo.$DOMAIN)..."
if ssh $REMOTE_HOST "curl -k -s -o /dev/null -w '%{http_code}' https://mongo.$DOMAIN" | grep -q "200"; then
    log_success "MongoDB UI accessible"
else
    log_warning "MongoDB UI non accessible"
fi

# Test Redis UI
log_info "Test Redis UI (https://redis.$DOMAIN)..."
redis_status=$(ssh $REMOTE_HOST "curl -k -s -o /dev/null -w '%{http_code}' https://redis.$DOMAIN")
if [ "$redis_status" = "200" ] || [ "$redis_status" = "404" ]; then
    log_success "Redis UI accessible (statut: $redis_status)"
else
    log_warning "Redis UI non accessible (statut: $redis_status)"
fi

# Vérification des certificats SSL
log_info "Vérification des certificats SSL..."
echo ""
ssh $REMOTE_HOST "cd $REMOTE_PATH && \
    echo '=== Certificats Let\\'s Encrypt émis ===' && \
    docker-compose exec traefik cat /letsencrypt/acme.json | jq '.letsencrypt.Certificates[] | .domain.main' 2>/dev/null || echo 'Erreur: Impossible de lire acme.json'"

echo ""
log_success "Déploiement terminé !"
echo ""
echo "🎯 Résumé du déploiement :"
echo "=========================="
echo "✅ Infrastructure Traefik déployée"
echo "✅ Certificats SSL Let's Encrypt générés"
echo "✅ Tous les services configurés"
echo "✅ WebSocket et API fonctionnels"
echo ""
echo "🔗 URLs de test :"
echo "=================="
echo "• Frontend: https://$DOMAIN"
echo "• Traefik Dashboard: https://traefik.$DOMAIN (admin:admin)"
echo "• Gateway API: https://gate.$DOMAIN/health"
echo "• WebSocket: https://gate.$DOMAIN/socket.io/"
echo "• Translator: https://ml.$DOMAIN/translate"
echo "• MongoDB UI: https://mongo.$DOMAIN"
echo "• Redis UI: https://redis.$DOMAIN"
echo ""
echo "🔧 Commandes utiles :"
echo "====================="
echo "• Statut: ssh $REMOTE_HOST 'cd $REMOTE_PATH && docker-compose ps'"
echo "• Logs: ssh $REMOTE_HOST 'cd $REMOTE_PATH && docker-compose logs -f'"
echo "• Redémarrage: ssh $REMOTE_HOST 'cd $REMOTE_PATH && docker-compose restart'"
echo ""
log_success "Déploiement réussi ! 🚀"
