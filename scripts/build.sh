#!/bin/bash

# Script de construction des images Docker Meeshy
# Usage: ./scripts/build.sh [COMMAND]
# Commands: build, push, build-and-push, list, clean

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

COMMAND="${1:-help}"

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Images a construire
IMAGES=(
    "frontend:meeshy-frontend:mongodb"
    "gateway:meeshy-gateway:mongodb"
    "translator:meeshy-translator:mongodb"
)

# Fonctions utilitaires
log_info() { echo -e "${BLUE}Info: $1${NC}"; }
log_success() { echo -e "${GREEN}Success: $1${NC}"; }
log_warning() { echo -e "${YELLOW}Warning: $1${NC}"; }
log_error() { echo -e "${RED}Error: $1${NC}"; }

# Construire une image
build_image() {
    local service="$1"
    local image_name="$2"
    
    log_info "Construction de $service..."
    
    case "$service" in
        "frontend")
            cd "$PROJECT_ROOT/frontend"
            docker build -t "$image_name" .
            ;;
        "gateway")
            cd "$PROJECT_ROOT/gateway"
            docker build -t "$image_name" .
            ;;
        "translator")
            cd "$PROJECT_ROOT/translator"
            docker build -t "$image_name" .
            ;;
        *)
            log_error "Service inconnu: $service"
            return 1
            ;;
    esac
    
    log_success "Image $image_name construite"
}

# Pousser une image
push_image() {
    local service="$1"
    local image_name="$2"
    
    log_info "Poussage de $image_name..."
    
    # Tag pour Docker Hub
    local dockerhub_name="isopen/$image_name"
    docker tag "$image_name" "$dockerhub_name"
    
    # Pousser
    docker push "$dockerhub_name"
    
    log_success "Image $dockerhub_name poussee"
}

# Construire toutes les images
build_all() {
    log_info "Construction de toutes les images..."
    
    for image in "${IMAGES[@]}"; do
        IFS=':' read -r service image_name <<< "$image"
        build_image "$service" "$image_name"
    done
    
    log_success "Toutes les images ont ete construites"
}

# Pousser toutes les images
push_all() {
    log_info "Poussage de toutes les images..."
    
    for image in "${IMAGES[@]}"; do
        IFS=':' read -r service image_name <<< "$image"
        push_image "$service" "$image_name"
    done
    
    log_success "Toutes les images ont ete poussees"
}

# Construire et pousser
build_and_push() {
    log_info "Construction et poussage de toutes les images..."
    
    build_all
    push_all
    
    log_success "Construction et poussage termines"
}

# Lister les images
list_images() {
    log_info "Images Docker locales:"
    docker images | grep -E "(meeshy|isopen)" || echo "Aucune image trouvee"
    
    echo ""
    log_info "Images sur Docker Hub:"
    for image in "${IMAGES[@]}"; do
        IFS=':' read -r service image_name <<< "$image"
        local dockerhub_name="isopen/$image_name"
        echo "  • $dockerhub_name"
    done
}

# Nettoyer les images
clean_images() {
    log_info "Nettoyage des images..."
    
    # Supprimer les images locales
    for image in "${IMAGES[@]}"; do
        IFS=':' read -r service image_name <<< "$image"
        docker rmi "$image_name" 2>/dev/null || true
        docker rmi "isopen/$image_name" 2>/dev/null || true
    done
    
    # Nettoyer les images non utilisees
    docker image prune -f
    
    log_success "Nettoyage termine"
}

# Afficher l'aide
show_help() {
    echo -e "${BLUE}Script de construction des images Docker Meeshy${NC}"
    echo "=================================================="
    echo ""
    echo -e "${GREEN}Usage:${NC}"
    echo "  $0 [COMMAND]"
    echo ""
    echo -e "${GREEN}Commandes:${NC}"
    echo -e "${CYAN}  build${NC}         - Construire toutes les images"
    echo -e "${CYAN}  push${NC}          - Pousser toutes les images sur Docker Hub"
    echo -e "${CYAN}  build-and-push${NC} - Construire et pousser toutes les images"
    echo -e "${CYAN}  list${NC}          - Lister les images disponibles"
    echo -e "${CYAN}  clean${NC}         - Nettoyer les images locales"
    echo ""
    echo -e "${GREEN}Exemples:${NC}"
    echo "  $0 build"
    echo "  $0 build-and-push"
    echo "  $0 list"
    echo ""
    echo -e "${YELLOW}Les images seront taggees avec 'isopen/' pour Docker Hub${NC}"
}

# Verifier que Docker est disponible
if ! command -v docker &> /dev/null; then
    log_error "Docker n'est pas installe ou accessible"
    exit 1
fi

# Executer la commande
case "$COMMAND" in
    "help"|"-h"|"--help")
        show_help
        ;;
    "build")
        build_all
        ;;
    "push")
        push_all
        ;;
    "build-and-push")
        build_and_push
        ;;
    "list")
        list_images
        ;;
    "clean")
        clean_images
        ;;
    *)
        log_error "Commande inconnue: $COMMAND"
        echo ""
        show_help
        exit 1
        ;;
esac
