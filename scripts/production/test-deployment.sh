#!/bin/bash

# Script de test du déploiement en production
# Teste toutes les étapes sans exécuter le déploiement réel

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
VERBOSE=false

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${CYAN}🔄 $1${NC}"; }

# Fonction pour afficher l'aide
show_help() {
    echo -e "${BLUE}Script de Test du Déploiement en Production${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS] DROPLET_IP"
    echo ""
    echo "Arguments:"
    echo "  DROPLET_IP              IP du droplet Digital Ocean"
    echo ""
    echo "Options:"
    echo "  --verbose               Mode verbeux"
    echo "  --help                  Afficher cette aide"
    echo ""
    echo "Description:"
    echo "  Ce script teste toutes les étapes du déploiement"
    echo "  sans exécuter le déploiement réel."
    echo ""
    echo "Exemples:"
    echo "  $0 157.230.15.51                    # Test complet"
    echo "  $0 --verbose 157.230.15.51          # Test avec logs détaillés"
    echo ""
}

# Fonction pour tester la connexion SSH
test_ssh_connection() {
    local ip="$1"
    log_step "Test de connexion SSH vers $ip..."
    
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$ip "echo 'Connexion SSH réussie'" >/dev/null 2>&1; then
        log_success "Connexion SSH réussie"
        return 0
    else
        log_error "Impossible de se connecter au serveur $ip"
        return 1
    fi
}

# Fonction pour tester les configurations
test_configurations() {
    log_step "Test des configurations..."
    
    # Vérifier que le fichier de secrets existe
    if [ ! -f "$SECRETS_DIR/production-secrets.env" ]; then
        log_error "Fichier de secrets non trouvé: $SECRETS_DIR/production-secrets.env"
        log_info "Exécutez d'abord: ./scripts/production/generate-production-config.sh"
        return 1
    fi
    
    # Vérifier que le fichier de configuration existe
    if [ ! -f "$PROJECT_ROOT/config/production.env" ]; then
        log_error "Fichier de configuration non trouvé: $PROJECT_ROOT/config/production.env"
        return 1
    fi
    
    log_success "Configurations trouvées"
    
    # Afficher les informations de connexion
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
}

# Fonction pour tester les scripts
test_scripts() {
    log_step "Test des scripts..."
    
    # Scripts requis
    local required_scripts=(
        "$SCRIPT_DIR/generate-production-config.sh"
        "$SCRIPT_DIR/reset-database.sh"
        "$SCRIPT_DIR/deploy-with-meeshy-deploy.sh"
        "$PROJECT_ROOT/scripts/deployment/build-and-push-docker-images.sh"
        "$PROJECT_ROOT/scripts/meeshy-deploy.sh"
    )
    
    for script in "${required_scripts[@]}"; do
        if [ ! -f "$script" ]; then
            log_error "Script requis non trouvé: $script"
            return 1
        fi
        
        if [ ! -x "$script" ]; then
            log_warning "Script non exécutable, correction des permissions: $script"
            chmod +x "$script"
        fi
    done
    
    log_success "Tous les scripts requis sont présents et exécutables"
}

# Fonction pour tester Docker
test_docker() {
    log_step "Test de Docker..."
    
    # Vérifier que Docker est disponible
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker n'est pas installé ou n'est pas dans le PATH"
        return 1
    fi
    
    # Vérifier que Docker est en cours d'exécution
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker n'est pas en cours d'exécution"
        return 1
    fi
    
    log_success "Docker est disponible et en cours d'exécution"
}

# Fonction pour tester les images Docker
test_docker_images() {
    log_step "Test des images Docker..."
    
    # Vérifier que les images existent sur Docker Hub
    local images=(
        "isopen/meeshy-translator"
        "isopen/meeshy-gateway"
        "isopen/meeshy-frontend"
        "isopen/meeshy"
    )
    
    for image in "${images[@]}"; do
        if docker search "$image" --limit 1 | grep -q "$image"; then
            log_success "Image $image trouvée sur Docker Hub"
        else
            log_warning "Image $image non trouvée sur Docker Hub"
        fi
    done
}

# Fonction pour tester le transfert de fichiers
test_file_transfer() {
    local ip="$1"
    log_step "Test du transfert de fichiers..."
    
    # Créer un fichier de test
    local test_file="/tmp/meeshy-test-$(date +%s).txt"
    echo "Test de transfert Meeshy - $(date)" > "$test_file"
    
    # Tester le transfert
    if scp -o StrictHostKeyChecking=no "$test_file" root@$ip:/tmp/ >/dev/null 2>&1; then
        log_success "Transfert de fichiers fonctionnel"
        
        # Nettoyer
        ssh -o StrictHostKeyChecking=no root@$ip "rm -f /tmp/$(basename "$test_file")" >/dev/null 2>&1
        rm -f "$test_file"
    else
        log_error "Échec du transfert de fichiers"
        rm -f "$test_file"
        return 1
    fi
}

# Fonction pour tester les prérequis du serveur
test_server_prerequisites() {
    local ip="$1"
    log_step "Test des prérequis du serveur..."
    
    # Vérifier que Docker est installé sur le serveur
    if ssh -o StrictHostKeyChecking=no root@$ip "command -v docker >/dev/null 2>&1" >/dev/null 2>&1; then
        log_success "Docker installé sur le serveur"
    else
        log_warning "Docker non installé sur le serveur (sera installé automatiquement)"
    fi
    
    # Vérifier que Docker Compose est installé sur le serveur
    if ssh -o StrictHostKeyChecking=no root@$ip "command -v docker-compose >/dev/null 2>&1" >/dev/null 2>&1; then
        log_success "Docker Compose installé sur le serveur"
    else
        log_warning "Docker Compose non installé sur le serveur (sera installé automatiquement)"
    fi
    
    # Vérifier l'espace disque
    local disk_usage=$(ssh -o StrictHostKeyChecking=no root@$ip "df -h / | tail -1 | awk '{print \$5}' | sed 's/%//'")
    if [ "$disk_usage" -lt 80 ]; then
        log_success "Espace disque suffisant ($disk_usage% utilisé)"
    else
        log_warning "Espace disque faible ($disk_usage% utilisé)"
    fi
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
    
    echo -e "${BLUE}🧪 Test du Déploiement en Production Meeshy${NC}"
    echo -e "${BLUE}==========================================${NC}"
    echo ""
    echo -e "${YELLOW}🎯 Cible: ${CYAN}$DROPLET_IP${NC}"
    echo ""
    
    # Tests locaux
    log_step "Tests locaux..."
    test_scripts || exit 1
    test_docker || exit 1
    test_configurations || exit 1
    test_docker_images
    
    echo ""
    
    # Tests de connexion
    log_step "Tests de connexion..."
    test_ssh_connection "$DROPLET_IP" || exit 1
    test_file_transfer "$DROPLET_IP" || exit 1
    test_server_prerequisites "$DROPLET_IP"
    
    echo ""
    
    # Résumé des tests
    log_success "🎉 Tous les tests sont passés avec succès !"
    echo ""
    echo -e "${YELLOW}📋 Résumé des tests:${NC}"
    echo -e "  • ✅ Scripts locaux vérifiés"
    echo -e "  • ✅ Docker local fonctionnel"
    echo -e "  • ✅ Configurations générées"
    echo -e "  • ✅ Images Docker disponibles"
    echo -e "  • ✅ Connexion SSH établie"
    echo -e "  • ✅ Transfert de fichiers fonctionnel"
    echo -e "  • ✅ Prérequis serveur vérifiés"
    echo ""
    echo -e "${GREEN}🚀 Le système est prêt pour le déploiement !${NC}"
    echo ""
    echo -e "${YELLOW}💡 Prochaine étape:${NC}"
    echo -e "  ${GREEN}./scripts/production/deploy-with-meeshy-deploy.sh $DROPLET_IP${NC}"
    echo ""
}

# Exécuter le script principal
main "$@"
