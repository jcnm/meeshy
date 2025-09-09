#!/bin/bash

# Script simple pour déployer les mots de passe Traefik
# Usage: ./scripts/simple-deploy-passwords.sh <IP_SERVEUR>

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de logging
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérification des paramètres
if [ $# -ne 1 ]; then
    log_error "Usage: $0 <IP_SERVEUR>"
    exit 1
fi

SERVER_IP="$1"

# Vérification de la connexion SSH
log_info "Test de connexion SSH vers $SERVER_IP..."
if ! ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@$SERVER_IP "echo 'Connexion SSH OK'" >/dev/null 2>&1; then
    log_error "Impossible de se connecter au serveur $SERVER_IP"
    exit 1
fi
log_success "Connexion SSH réussie"

# Lecture du mot de passe depuis le fichier clear.txt
CLEAR_FILE="secrets/clear.txt"
if [ ! -f "$CLEAR_FILE" ]; then
    log_error "Fichier $CLEAR_FILE non trouvé"
    exit 1
fi

# Extraction du mot de passe admin
ADMIN_PASSWORD=$(grep "ADMIN_PASSWORD_CLEAR=" "$CLEAR_FILE" | cut -d'"' -f2)
if [ -z "$ADMIN_PASSWORD" ]; then
    log_error "Mot de passe admin non trouvé dans $CLEAR_FILE"
    exit 1
fi

log_info "Mot de passe admin extrait: ${ADMIN_PASSWORD:0:4}****"

# Génération du hash bcrypt
log_info "Génération du hash bcrypt..."
BCRYPT_HASH=$(htpasswd -nbB admin "$ADMIN_PASSWORD")
if [ -z "$BCRYPT_HASH" ]; then
    log_error "Échec de la génération du hash bcrypt"
    exit 1
fi

log_success "Hash bcrypt généré: ${BCRYPT_HASH:0:20}****"

# Mise à jour directe sur le serveur
log_info "Mise à jour des variables Traefik sur le serveur..."

# Sauvegarde du fichier .env
ssh root@$SERVER_IP "cd /opt/meeshy && cp .env .env.backup.$(date +%Y%m%d_%H%M%S)"

# Mise à jour des variables
ssh root@$SERVER_IP "cd /opt/meeshy && sed -i 's|TRAEFIK_USERS=.*|TRAEFIK_USERS=\"$BCRYPT_HASH\"|' .env"
ssh root@$SERVER_IP "cd /opt/meeshy && sed -i 's|API_USERS=.*|API_USERS=\"$BCRYPT_HASH\"|' .env"

# Échapper les $ pour Docker Compose
ssh root@$SERVER_IP "cd /opt/meeshy && sed -i 's|TRAEFIK_USERS=\"admin:\$2y\$05\$|TRAEFIK_USERS=\"admin:\$\$2y\$\$05\$\$|g' .env"
ssh root@$SERVER_IP "cd /opt/meeshy && sed -i 's|API_USERS=\"admin:\$2y\$05\$|API_USERS=\"admin:\$\$2y\$\$05\$\$|g' .env"

log_success "Variables mises à jour"

# Recréation du conteneur Traefik
log_info "Recréation du conteneur Traefik..."
ssh root@$SERVER_IP "cd /opt/meeshy && docker-compose up -d traefik"

# Attente du redémarrage
log_info "Attente du redémarrage de Traefik..."
sleep 15

# Vérification
log_info "Vérification du statut de Traefik..."
if ssh root@$SERVER_IP "cd /opt/meeshy && docker ps | grep -q 'meeshy-traefik.*Up'"; then
    log_success "Traefik redémarré avec succès"
else
    log_error "Problème avec le redémarrage de Traefik"
    exit 1
fi

# Test de l'authentification
log_info "Test de l'authentification Traefik..."
if curl -u admin:$ADMIN_PASSWORD -I https://traefik.meeshy.me 2>/dev/null | grep -q "HTTP/2 405"; then
    log_success "Authentification Traefik fonctionnelle !"
else
    log_error "Authentification Traefik échouée"
    exit 1
fi

log_success "Déploiement des mots de passe Traefik terminé !"
echo ""
echo "🔐 ACCÈS TRAEFIK:"
echo "   URL: https://traefik.meeshy.me"
echo "   Utilisateur: admin"
echo "   Mot de passe: $ADMIN_PASSWORD"
echo ""
echo "🧪 Test de connexion:"
echo "   curl -u admin:$ADMIN_PASSWORD https://traefik.meeshy.me"

