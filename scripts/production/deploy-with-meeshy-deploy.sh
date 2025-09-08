#!/bin/bash

# Script de déploiement utilisant meeshy-deploy.sh avec les configurations de production
# Ce script prépare et exécute le déploiement avec les nouvelles configurations sécurisées

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

# Variables par défaut
DROPLET_IP=""
SKIP_SECRETS_TRANSFER=false
SKIP_DB_RESET=false
SKIP_BUILD=true
FORCE_REFRESH=false
VERBOSE=false

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${CYAN}🔄 $1${NC}"; }

# Fonction pour afficher l'aide
show_help() {
    echo -e "${BLUE}Script de Déploiement avec meeshy-deploy.sh${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS] DROPLET_IP"
    echo ""
    echo "Arguments:"
    echo "  DROPLET_IP              IP du droplet Digital Ocean"
    echo ""
    echo "Options:"
    echo "  --skip-secrets          Ignorer le transfert des secrets"
    echo "  --skip-db-reset         Ignorer le reset de la base de données"
    echo "  --skip-build            Ignorer le build et push des images Docker"
    echo "  --force-refresh         Forcer le téléchargement des images"
    echo "  --verbose               Mode verbeux"
    echo "  --help                  Afficher cette aide"
    echo ""
    echo "Description:"
    echo "  Ce script utilise meeshy-deploy.sh avec les configurations"
    echo "  de production générées automatiquement."
    echo ""
    echo "Exemples:"
    echo "  $0 157.230.15.51                    # Déploiement complet"
    echo "  $0 --skip-db-reset 157.230.15.51    # Déploiement sans reset DB"
    echo "  $0 --skip-build 157.230.15.51       # Déploiement sans rebuild des images"
    echo "  $0 --force-refresh 157.230.15.51    # Déploiement avec refresh forcé"
    echo ""
}

# Fonction pour tester la connexion SSH
test_ssh_connection() {
    local ip="$1"
    log_info "Test de connexion SSH vers $ip..."
    
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$ip "echo 'Connexion SSH réussie'" >/dev/null 2>&1; then
        log_success "Connexion SSH réussie"
        return 0
    else
        log_error "Impossible de se connecter au serveur $ip"
        return 1
    fi
}

# Fonction pour transférer les secrets
transfer_secrets() {
    local ip="$1"
    log_step "Transfert du fichier de secrets..."
    
    # Vérifier que le fichier de secrets existe
    if [ ! -f "$SECRETS_DIR/production-secrets.env" ]; then
        log_error "Fichier de secrets non trouvé: $SECRETS_DIR/production-secrets.env"
        log_info "Exécutez d'abord: ./scripts/production/generate-production-config.sh"
        exit 1
    fi
    
    # Créer le répertoire secrets sur le serveur
    log_info "Création du répertoire secrets sur le serveur..."
    ssh -o StrictHostKeyChecking=no root@$ip "mkdir -p /opt/meeshy/secrets"
    
    # Transférer le fichier de secrets
    log_info "Transfert du fichier de secrets..."
    scp -o StrictHostKeyChecking=no "$SECRETS_DIR/production-secrets.env" root@$ip:/opt/meeshy/secrets/
    
    # Sécuriser le fichier sur le serveur
    log_info "Sécurisation du fichier de secrets sur le serveur..."
    ssh -o StrictHostKeyChecking=no root@$ip "chmod 600 /opt/meeshy/secrets/production-secrets.env"
    
    log_success "Fichier de secrets transféré et sécurisé"
}

# Fonction pour préparer les configurations
prepare_configurations() {
    local ip="$1"
    log_step "Préparation des configurations de production..."
    
    # Créer le fichier d'environnement de production
    local env_file="$PROJECT_ROOT/env.production"
    
    # Copier la configuration de base
    cp "$PROJECT_ROOT/env.digitalocean" "$env_file"
    
    # Ajouter les secrets
    echo "" >> "$env_file"
    echo "# ===== SECRETS DE PRODUCTION ======" >> "$env_file"
    echo "# Générés automatiquement le $(date)" >> "$env_file"
    cat "$SECRETS_DIR/production-secrets.env" >> "$env_file"
    
    log_success "Configurations de production préparées"
}

# Fonction pour build et push les images Docker
build_and_push_images() {
    if [ "$SKIP_BUILD" = true ]; then
        log_info "Build et push des images Docker ignorés (--skip-build)"
        return 0
    fi
    
    log_step "Build et push des images Docker..."
    
    # Options pour le build
    local build_options=""
    if [ "$FORCE_REFRESH" = true ]; then
        build_options="--force-rebuild"
    fi
    
    # Exécuter le build
    if [ "$VERBOSE" = true ]; then
        bash "$PROJECT_ROOT/scripts/deployment/build-and-push-docker-images.sh" $build_options
    else
        bash "$PROJECT_ROOT/scripts/deployment/build-and-push-docker-images.sh" $build_options >/dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Images Docker buildées et poussées"
    else
        log_error "Échec du build et push des images Docker"
        exit 1
    fi
}

# Fonction pour reset la base de données
reset_database() {
    local ip="$1"
    log_step "Reset de la base de données..."
    
    # Utiliser le script de reset de base de données
    if [ "$VERBOSE" = true ]; then
        bash "$SCRIPT_DIR/reset-database.sh" --force "$ip"
    else
        bash "$SCRIPT_DIR/reset-database.sh" --force "$ip" >/dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Base de données resetée"
    else
        log_error "Échec du reset de la base de données"
        exit 1
    fi
}

# Fonction pour déployer avec meeshy-deploy.sh
deploy_with_meeshy_deploy() {
    local ip="$1"
    log_step "Déploiement avec meeshy-deploy.sh..."
    
    # Options pour le déploiement
    local deploy_options=""
    if [ "$FORCE_REFRESH" = true ]; then
        deploy_options="--force-refresh"
    fi
    
    # Exécuter le déploiement
    if [ "$VERBOSE" = true ]; then
        bash "$PROJECT_ROOT/scripts/meeshy-deploy.sh" deploy "$ip" $deploy_options
    else
        bash "$PROJECT_ROOT/scripts/meeshy-deploy.sh" deploy "$ip" $deploy_options >/dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Déploiement terminé"
    else
        log_error "Échec du déploiement"
        exit 1
    fi
}

# Fonction pour vérifier la santé des services
verify_health() {
    local ip="$1"
    log_step "Vérification de la santé des services..."
    
    # Vérifier la santé des services
    if [ "$VERBOSE" = true ]; then
        bash "$PROJECT_ROOT/scripts/meeshy-deploy.sh" health "$ip"
    else
        bash "$PROJECT_ROOT/scripts/meeshy-deploy.sh" health "$ip" >/dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Santé des services vérifiée"
    else
        log_warning "Problèmes détectés lors de la vérification"
        log_info "Exécutez manuellement: ./scripts/meeshy-deploy.sh health $ip"
    fi
}

# Fonction pour afficher le résumé final
show_final_summary() {
    echo ""
    log_success "🎉 Déploiement en production terminé avec succès !"
    echo ""
    echo -e "${BLUE}📋 Résumé du déploiement:${NC}"
    echo -e "  • ✅ Connexion SSH établie"
    
    if [ "$SKIP_SECRETS_TRANSFER" = false ]; then
        echo -e "  • ✅ Fichier de secrets transféré"
    fi
    
    echo -e "  • ⏭️  Build des images Docker ignoré (déploiement uniquement)"
    
    if [ "$SKIP_DB_RESET" = false ]; then
        echo -e "  • ✅ Base de données resetée"
    fi
    
    echo -e "  • ✅ Application déployée avec meeshy-deploy.sh"
    echo -e "  • ✅ Santé des services vérifiée"
    echo ""
    echo -e "${YELLOW}🔐 Informations de connexion:${NC}"
    echo -e "  • Consultez le fichier: ${CYAN}$SECRETS_DIR/production-secrets.env${NC}"
    echo ""
    echo -e "${YELLOW}🌐 Accès à l'application:${NC}"
    echo -e "  • Frontend: ${CYAN}https://meeshy.me${NC}"
    echo -e "  • API Gateway: ${CYAN}https://gate.meeshy.me${NC}"
    echo -e "  • Service ML: ${CYAN}https://ml.meeshy.me${NC}"
    echo -e "  • Dashboard Traefik: ${CYAN}https://traefik.meeshy.me${NC}"
    echo ""
    echo -e "${YELLOW}🛠️ Commandes utiles:${NC}"
    echo -e "  • Vérifier la santé: ${CYAN}./scripts/meeshy-deploy.sh health $DROPLET_IP${NC}"
    echo -e "  • Voir les logs: ${CYAN}./scripts/meeshy-deploy.sh logs $DROPLET_IP${NC}"
    echo -e "  • Redémarrer: ${CYAN}./scripts/meeshy-deploy.sh restart $DROPLET_IP${NC}"
    echo ""
    echo -e "${GREEN}🚀 L'application est maintenant en production !${NC}"
}

# Fonction principale
main() {
    # Parser les arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help)
                show_help
                exit 0
                ;;
            --skip-secrets)
                SKIP_SECRETS_TRANSFER=true
                shift
                ;;
            --skip-db-reset)
                SKIP_DB_RESET=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --force-refresh)
                FORCE_REFRESH=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            *)
                if [ -z "$DROPLET_IP" ]; then
                    DROPLET_IP="$1"
                else
                    log_error "Argument inconnu: $1"
                    show_help
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Vérifier que l'IP du droplet est fournie
    if [ -z "$DROPLET_IP" ]; then
        log_error "IP du droplet manquante"
        show_help
        exit 1
    fi
    
    echo -e "${BLUE}🚀 Déploiement en Production avec meeshy-deploy.sh${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
    echo -e "${YELLOW}🎯 Cible: ${CYAN}$DROPLET_IP${NC}"
    echo -e "${YELLOW}📋 Étapes:${NC}"
    echo -e "  • Transfert des secrets: ${CYAN}$([ "$SKIP_SECRETS_TRANSFER" = true ] && echo "IGNORÉ" || echo "ACTIF")${NC}"
    echo -e "  • Build et push des images: ${CYAN}IGNORÉ (déploiement uniquement)${NC}"
    echo -e "  • Reset de la base de données: ${CYAN}$([ "$SKIP_DB_RESET" = true ] && echo "IGNORÉ" || echo "ACTIF")${NC}"
    echo -e "  • Déploiement avec meeshy-deploy.sh: ${CYAN}ACTIF${NC}"
    echo ""
    
    # Tester la connexion SSH
    test_ssh_connection "$DROPLET_IP" || exit 1
    
    # Transférer les secrets
    if [ "$SKIP_SECRETS_TRANSFER" = false ]; then
        transfer_secrets "$DROPLET_IP"
    fi
    
    # Préparer les configurations
    prepare_configurations "$DROPLET_IP"
    
    # Build et push les images Docker
    build_and_push_images
    
    # Reset la base de données
    if [ "$SKIP_DB_RESET" = false ]; then
        reset_database "$DROPLET_IP"
    fi
    
    # Déployer avec meeshy-deploy.sh
    deploy_with_meeshy_deploy "$DROPLET_IP"
    
    # Vérifier la santé des services
    verify_health "$DROPLET_IP"
    
    # Afficher le résumé final
    show_final_summary
    
    # Nettoyer le fichier temporaire
    rm -f "$PROJECT_ROOT/env.production"
}

# Exécuter le script principal
main "$@"
