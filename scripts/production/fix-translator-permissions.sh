#!/bin/bash

# ===== SCRIPT DE CORRECTION DES PERMISSIONS TRANSLATOR =====
# Ce script corrige les permissions des volumes Docker pour le service translator
# Il résout les problèmes de chargement des modèles ML

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Correction des permissions des volumes Translator${NC}"
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

echo -e "${BLUE}🔍 Vérification des volumes Docker...${NC}"

# Vérifier que les volumes existent
VOLUMES=$(run_remote "docker volume ls | grep translator | awk '{print \$2}'")
if [ -z "$VOLUMES" ]; then
    log_error "Aucun volume translator trouvé"
    exit 1
fi

echo -e "${GREEN}✅ Volumes translator trouvés:${NC}"
echo "$VOLUMES" | while read volume; do
    echo "  • $volume"
done

echo ""
log_info "🔧 Correction des permissions des volumes..."

# Corriger les permissions de chaque volume
for volume in $VOLUMES; do
    log_info "  • Correction des permissions du volume $volume..."
    
    # Déterminer le chemin selon le type de volume
    case $volume in
        *models*)
            path="/workspace/models"
            ;;
        *cache*)
            path="/workspace/cache"
            ;;
        *generated*)
            path="/workspace/generated"
            ;;
        *)
            path="/workspace"
            ;;
    esac
    
    # Corriger les permissions
    run_remote "docker run --rm -v $volume:$path alpine chown -R 1000:1000 $path"
    run_remote "docker run --rm -v $volume:$path alpine chmod -R 755 $path"
    
    log_success "    Permissions corrigées pour $volume"
done

echo ""
log_info "🔄 Redémarrage du service translator..."

# Redémarrer le translator
run_remote "docker-compose -f /opt/meeshy/docker-compose.yml restart translator"

echo ""
log_info "⏳ Attente du redémarrage du translator..."
sleep 20

echo ""
log_info "🔍 Vérification du statut du translator..."

# Vérifier le statut
STATUS=$(run_remote "docker-compose -f /opt/meeshy/docker-compose.yml ps translator | grep translator")
echo "$STATUS"

# Vérifier les logs récents pour voir si les modèles se chargent
echo ""
log_info "📋 Vérification des logs récents du translator..."
run_remote "docker logs meeshy-translator --tail 20"

echo ""
log_success "🎉 Correction des permissions terminée !"
echo ""
echo -e "${YELLOW}💡 Si le translator a encore des problèmes:${NC}"
echo -e "  • Vérifiez les logs: ${BLUE}docker logs meeshy-translator${NC}"
echo -e "  • Redémarrez manuellement: ${BLUE}docker-compose restart translator${NC}"
echo -e "  • Vérifiez l'espace disque: ${BLUE}df -h${NC}"
echo ""
