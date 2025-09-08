#!/bin/bash

# Script de préparation du déploiement en production
# Guide l'utilisateur à travers les étapes de préparation

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
SECRETS_DIR="$PROJECT_ROOT/secrets"

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${CYAN}🔄 $1${NC}"; }

echo -e "${BLUE}🚀 Préparation du Déploiement en Production Meeshy${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Étape 1: Vérification des prérequis
log_step "Étape 1: Vérification des prérequis..."

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    log_error "Ce script doit être exécuté depuis la racine du projet Meeshy"
    exit 1
fi

# Vérifier que les scripts existent
required_scripts=(
    "$SCRIPT_DIR/generate-production-config.sh"
    "$SCRIPT_DIR/reset-database.sh"
    "$SCRIPT_DIR/deploy-production.sh"
    "$PROJECT_ROOT/scripts/deployment/build-and-push-docker-images.sh"
    "$PROJECT_ROOT/scripts/meeshy-deploy.sh"
)

for script in "${required_scripts[@]}"; do
    if [ ! -f "$script" ]; then
        log_error "Script requis non trouvé: $script"
        exit 1
    fi
done

log_success "Tous les scripts requis sont présents"

# Étape 2: Vérification des configurations
log_step "Étape 2: Vérification des configurations..."

if [ ! -f "$SECRETS_DIR/production-secrets.env" ]; then
    log_warning "Fichier de secrets non trouvé, génération..."
    bash "$SCRIPT_DIR/generate-production-config.sh" --force
else
    log_success "Fichier de secrets trouvé"
fi

# Étape 3: Affichage des informations de connexion
log_step "Étape 3: Informations de connexion générées..."

echo -e "${YELLOW}🔐 Utilisateurs par défaut:${NC}"
echo -e "  • ${CYAN}Admin:${NC} admin / $(grep "^ADMIN_PASSWORD=" "$SECRETS_DIR/production-secrets.env" | cut -d'=' -f2)"
echo -e "  • ${CYAN}Meeshy:${NC} meeshy / $(grep "^MEESHY_PASSWORD=" "$SECRETS_DIR/production-secrets.env" | cut -d'=' -f2)"
echo -e "  • ${CYAN}Atabeth:${NC} atabeth / $(grep "^ATABETH_PASSWORD=" "$SECRETS_DIR/production-secrets.env" | cut -d'=' -f2)"

echo ""
echo -e "${YELLOW}📧 Emails configurés:${NC}"
echo -e "  • ${CYAN}Admin:${NC} $(grep "^ADMIN_EMAIL=" "$SECRETS_DIR/production-secrets.env" | cut -d'=' -f2)"
echo -e "  • ${CYAN}Meeshy:${NC} $(grep "^MEESHY_EMAIL=" "$SECRETS_DIR/production-secrets.env" | cut -d'=' -f2)"
echo -e "  • ${CYAN}Atabeth:${NC} $(grep "^ATABETH_EMAIL=" "$SECRETS_DIR/production-secrets.env" | cut -d'=' -f2)"

echo ""
echo -e "${YELLOW}🌐 Domaine configuré:${NC}"
echo -e "  • ${CYAN}$(grep "^DOMAIN=" "$SECRETS_DIR/production-secrets.env" | cut -d'=' -f2)${NC}"

# Étape 4: Instructions de déploiement
log_step "Étape 4: Instructions de déploiement..."

echo ""
echo -e "${YELLOW}📋 Prochaines étapes:${NC}"
echo ""
echo -e "${CYAN}1. Transférer le fichier de secrets sur Digital Ocean:${NC}"
echo -e "   ${GREEN}scp secrets/production-secrets.env root@DROPLET_IP:/opt/meeshy/secrets/${NC}"
echo ""
echo -e "${CYAN}2. Déploiement complet en une commande:${NC}"
echo -e "   ${GREEN}./scripts/production/deploy-production.sh DROPLET_IP${NC}"
echo ""
echo -e "${CYAN}3. Ou déploiement par étapes:${NC}"
echo -e "   ${GREEN}./scripts/deployment/build-and-push-docker-images.sh${NC}"
echo -e "   ${GREEN}./scripts/production/reset-database.sh DROPLET_IP${NC}"
echo -e "   ${GREEN}./scripts/meeshy-deploy.sh deploy DROPLET_IP${NC}"
echo ""

# Étape 5: Vérification post-déploiement
log_step "Étape 5: Vérification post-déploiement..."

echo -e "${CYAN}Après le déploiement, vérifiez:${NC}"
echo -e "  • ${GREEN}./scripts/meeshy-deploy.sh health DROPLET_IP${NC}"
echo -e "  • ${GREEN}./scripts/meeshy-deploy.sh logs DROPLET_IP${NC}"
echo ""

# Étape 6: Accès à l'application
log_step "Étape 6: Accès à l'application..."

echo -e "${CYAN}Une fois déployé, l'application sera accessible via:${NC}"
echo -e "  • ${GREEN}Frontend:${NC} https://meeshy.me"
echo -e "  • ${GREEN}API Gateway:${NC} https://gate.meeshy.me"
echo -e "  • ${GREEN}Service ML:${NC} https://ml.meeshy.me"
echo -e "  • ${GREEN}Dashboard Traefik:${NC} https://traefik.meeshy.me"
echo -e "  • ${GREEN}MongoDB UI:${NC} https://mongo.meeshy.me"
echo -e "  • ${GREEN}Redis UI:${NC} https://redis.meeshy.me"
echo ""

# Étape 7: Avertissements de sécurité
log_step "Étape 7: Avertissements de sécurité..."

echo -e "${RED}⚠️  IMPORTANT:${NC}"
echo -e "  • ${RED}NE JAMAIS COMMITER le fichier secrets/production-secrets.env${NC}"
echo -e "  • ${RED}TOUJOURS créer des backups avant le reset de la base de données${NC}"
echo -e "  • ${RED}TOUJOURS vérifier la santé des services après déploiement${NC}"
echo -e "  • ${RED}TOUJOURS utiliser des mots de passe forts générés automatiquement${NC}"
echo ""

# Étape 8: Support
log_step "Étape 8: Support..."

echo -e "${CYAN}En cas de problème:${NC}"
echo -e "  • Consultez ${GREEN}scripts/production/README.md${NC}"
echo -e "  • Consultez ${GREEN}scripts/production/QUICK_DEPLOYMENT_GUIDE.md${NC}"
echo -e "  • Vérifiez les logs avec ${GREEN}./scripts/meeshy-deploy.sh logs DROPLET_IP${NC}"
echo ""

# Résumé final
echo -e "${GREEN}🎉 Préparation terminée !${NC}"
echo -e "${GREEN}🚀 Vous êtes prêt pour le déploiement en production.${NC}"
echo ""
echo -e "${YELLOW}💡 Conseil:${NC}"
echo -e "  Commencez par tester la connexion SSH vers votre droplet:"
echo -e "  ${GREEN}ssh -o StrictHostKeyChecking=no root@DROPLET_IP 'echo \"Connexion OK\"'${NC}"
echo ""
