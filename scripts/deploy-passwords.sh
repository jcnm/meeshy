#!/bin/bash

# Script fiable pour déployer les mots de passe Traefik
# Usage: ./scripts/deploy-passwords.sh <IP_SERVEUR>

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

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
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

# Création du script de déploiement temporaire
TEMP_SCRIPT="/tmp/update-traefik-passwords.sh"
cat > "$TEMP_SCRIPT" << EOF
#!/bin/bash
set -e

echo "🔐 MISE À JOUR DES MOTS DE PASSE TRAEFIK"
echo "========================================"

cd /opt/meeshy

# Sauvegarde du fichier .env actuel
cp .env .env.backup.\$(date +%Y%m%d_%H%M%S)
echo "✅ Sauvegarde du fichier .env créée"

# Mise à jour des variables Traefik
echo "🔧 Mise à jour des variables TRAEFIK_USERS et API_USERS..."

# Hash bcrypt à utiliser
BCRYPT_HASH="$BCRYPT_HASH"

# Mettre à jour TRAEFIK_USERS
if grep -q "TRAEFIK_USERS=" .env; then
    sed -i "s|TRAEFIK_USERS=.*|TRAEFIK_USERS=\"\$BCRYPT_HASH\"|" .env
else
    echo "TRAEFIK_USERS=\"\$BCRYPT_HASH\"" >> .env
fi

# Mettre à jour API_USERS
if grep -q "API_USERS=" .env; then
    sed -i "s|API_USERS=.*|API_USERS=\"\$BCRYPT_HASH\"|" .env
else
    echo "API_USERS=\"\$BCRYPT_HASH\"" >> .env
fi

echo "✅ Variables mises à jour dans .env"

# Vérification des variables
echo "🔍 Vérification des variables..."
echo "TRAEFIK_USERS: \$(grep TRAEFIK_USERS .env)"
echo "API_USERS: \$(grep API_USERS .env)"

# Redémarrage de Traefik
echo "🔄 Redémarrage de Traefik..."
docker-compose restart traefik

# Attente du redémarrage
echo "⏳ Attente du redémarrage de Traefik..."
sleep 10

# Vérification que Traefik est opérationnel
echo "🔍 Vérification du statut de Traefik..."
if docker ps | grep -q "meeshy-traefik.*Up"; then
    echo "✅ Traefik redémarré avec succès"
else
    echo "❌ Problème avec le redémarrage de Traefik"
    exit 1
fi

echo "🎉 Mise à jour des mots de passe Traefik terminée !"
echo ""
echo "🔐 INFORMATIONS DE CONNEXION:"
echo "   URL: https://traefik.meeshy.me"
echo "   Utilisateur: admin"
echo "   Mot de passe: $ADMIN_PASSWORD"
echo ""
EOF

# Transfert et exécution du script
log_info "Transfert du script de mise à jour vers le serveur..."
scp -o StrictHostKeyChecking=no "$TEMP_SCRIPT" root@$SERVER_IP:/tmp/

log_info "Exécution du script de mise à jour..."
ssh -o StrictHostKeyChecking=no root@$SERVER_IP "chmod +x /tmp/update-traefik-passwords.sh && /tmp/update-traefik-passwords.sh"

# Nettoyage
rm -f "$TEMP_SCRIPT"
ssh -o StrictHostKeyChecking=no root@$SERVER_IP "rm -f /tmp/update-traefik-passwords.sh"

log_success "Déploiement des mots de passe Traefik terminé !"
echo ""
echo "🔐 ACCÈS TRAEFIK:"
echo "   URL: https://traefik.meeshy.me"
echo "   Utilisateur: admin"
echo "   Mot de passe: $ADMIN_PASSWORD"
echo ""
echo "🧪 Test de connexion:"
echo "   curl -u admin:$ADMIN_PASSWORD https://traefik.meeshy.me"
