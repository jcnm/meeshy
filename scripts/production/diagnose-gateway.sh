#!/bin/bash

# Script de diagnostic pour la gateway Meeshy en production
# Usage: ./scripts/production/diagnose-gateway.sh DROPLET_IP

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DROPLET_IP="$1"

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${CYAN}🔄 $1${NC}"; }

# Vérifier que l'IP est fournie
if [ -z "$DROPLET_IP" ]; then
    log_error "IP du droplet manquante"
    echo "Usage: $0 DROPLET_IP"
    exit 1
fi

echo -e "${BLUE}🔍 Diagnostic de la Gateway Meeshy en Production${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Test de connexion SSH
log_step "Test de connexion SSH..."
if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$DROPLET_IP "echo 'Connexion SSH réussie'" >/dev/null 2>&1; then
    log_success "Connexion SSH réussie"
else
    log_error "Impossible de se connecter au serveur"
    exit 1
fi

# Vérifier l'état des conteneurs
log_step "Vérification de l'état des conteneurs..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose ps"

# Vérifier spécifiquement la gateway
log_step "État détaillé de la gateway..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker ps -a --filter name=meeshy-gateway --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

# Vérifier les logs de la gateway
log_step "Logs récents de la gateway (dernières 50 lignes)..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker logs --tail 50 meeshy-gateway 2>&1" || log_warning "Impossible de récupérer les logs de la gateway"

# Vérifier les variables d'environnement de la gateway
log_step "Variables d'environnement de la gateway..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker exec meeshy-gateway env | grep -E '(DATABASE|REDIS|TRANSLATOR|NODE_ENV|PORT)'" 2>/dev/null || log_warning "Impossible d'accéder aux variables d'environnement"

# Vérifier la connectivité réseau
log_step "Test de connectivité réseau..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker exec meeshy-gateway ping -c 2 meeshy-database" 2>/dev/null || log_warning "Impossible de tester la connectivité vers la base de données"
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker exec meeshy-gateway ping -c 2 redis" 2>/dev/null || log_warning "Impossible de tester la connectivité vers Redis"
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker exec meeshy-gateway ping -c 2 translator" 2>/dev/null || log_warning "Impossible de tester la connectivité vers le translator"

# Vérifier les ports
log_step "Vérification des ports..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "netstat -tlnp | grep :3000" || log_warning "Port 3000 non ouvert"

# Vérifier les ressources système
log_step "Ressources système..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "free -h && echo '' && df -h /"

# Vérifier les logs système
log_step "Logs système récents..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "journalctl -u docker --since '10 minutes ago' --no-pager | tail -20" || log_warning "Impossible d'accéder aux logs système"

# Vérifier la configuration Docker Compose
log_step "Configuration Docker Compose..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && grep -A 20 'gateway:' docker-compose.yml"

# Vérifier les fichiers de configuration
log_step "Fichiers de configuration..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && ls -la .env* && echo '' && head -20 .env"

# Test de redémarrage de la gateway
log_step "Test de redémarrage de la gateway..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose restart gateway"
sleep 10

# Vérifier l'état après redémarrage
log_step "État après redémarrage..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker ps --filter name=meeshy-gateway --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

# Logs après redémarrage
log_step "Logs après redémarrage..."
echo ""
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker logs --tail 20 meeshy-gateway 2>&1" || log_warning "Impossible de récupérer les logs après redémarrage"

echo ""
log_success "Diagnostic terminé"
echo ""
echo -e "${YELLOW}💡 Actions recommandées:${NC}"
echo "1. Vérifiez les logs ci-dessus pour identifier l'erreur"
echo "2. Vérifiez que la base de données est accessible"
echo "3. Vérifiez que Redis est accessible"
echo "4. Vérifiez que le translator est accessible"
echo "5. Vérifiez les variables d'environnement"
echo ""
echo -e "${YELLOW}🔧 Commandes utiles:${NC}"
echo "• Redémarrer la gateway: ssh root@$DROPLET_IP 'cd /opt/meeshy && docker-compose restart gateway'"
echo "• Voir les logs en temps réel: ssh root@$DROPLET_IP 'docker logs -f meeshy-gateway'"
echo "• Vérifier l'état: ssh root@$DROPLET_IP 'cd /opt/meeshy && docker-compose ps'"
