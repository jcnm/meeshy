#!/bin/bash

# Script de construction et publication des images Docker pour Meeshy sur Docker Hub
# Ce script utilise le script existant build-docker-images.sh et publie sur Docker Hub sous /isopen

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration Docker Hub
DOCKER_HUB_NAMESPACE="isopen"
VERSION="latest"

# Fonction d'affichage
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Vérification des prérequis
check_prerequisites() {
    log "Vérification des prérequis..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker n'est pas installé"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose n'est pas installé"
        exit 1
    fi
    
    # Vérifier si le script de construction existe
    if [ ! -f "build-docker-images.sh" ]; then
        error "Le script build-docker-images.sh n'existe pas"
        exit 1
    fi
    
    log "Prérequis vérifiés ✓"
    warn "Assurez-vous d'être connecté à Docker Hub avec 'docker login' avant de continuer"
}

# Construction des images en utilisant le script existant
build_images() {
    log "Construction des images Docker en utilisant le script existant..."
    
    # Exécuter le script de construction existant
    ./build-docker-images.sh
    
    log "Images construites avec succès ✓"
}

# Tag des images pour Docker Hub
tag_images() {
    log "Tag des images pour Docker Hub..."
    
    # Tag du Translator
    log "Tag de l'image Translator..."
    docker tag meeshy-translator:latest ${DOCKER_HUB_NAMESPACE}/meeshy-translator:${VERSION}
    docker tag meeshy-translator:latest ${DOCKER_HUB_NAMESPACE}/meeshy-translator:latest
    
    # Tag du Gateway
    log "Tag de l'image Gateway..."
    docker tag meeshy-gateway:latest ${DOCKER_HUB_NAMESPACE}/meeshy-gateway:${VERSION}
    docker tag meeshy-gateway:latest ${DOCKER_HUB_NAMESPACE}/meeshy-gateway:latest
    
    # Tag du Frontend
    log "Tag de l'image Frontend..."
    docker tag meeshy-frontend:latest ${DOCKER_HUB_NAMESPACE}/meeshy-frontend:${VERSION}
    docker tag meeshy-frontend:latest ${DOCKER_HUB_NAMESPACE}/meeshy-frontend:latest
    
    log "Images taggées avec succès ✓"
}

# Publication des images sur Docker Hub
push_images() {
    log "Publication des images sur Docker Hub..."
    
    # Publication du Translator
    log "Publication de l'image Translator..."
    docker push ${DOCKER_HUB_NAMESPACE}/meeshy-translator:${VERSION}
    docker push ${DOCKER_HUB_NAMESPACE}/meeshy-translator:latest
    
    # Publication du Gateway
    log "Publication de l'image Gateway..."
    docker push ${DOCKER_HUB_NAMESPACE}/meeshy-gateway:${VERSION}
    docker push ${DOCKER_HUB_NAMESPACE}/meeshy-gateway:latest
    
    # Publication du Frontend
    log "Publication de l'image Frontend..."
    docker push ${DOCKER_HUB_NAMESPACE}/meeshy-frontend:${VERSION}
    docker push ${DOCKER_HUB_NAMESPACE}/meeshy-frontend:latest
    
    log "Images publiées avec succès ✓"
}

# Affichage des images construites
show_images() {
    log "Images Docker construites:"
    docker images | grep "${DOCKER_HUB_NAMESPACE}/meeshy-"
}

# Affichage des informations de publication
show_publication_info() {
    log "=== Informations de publication ==="
    info "Images publiées sur Docker Hub:"
    info "  - ${DOCKER_HUB_NAMESPACE}/meeshy-translator:${VERSION}"
    info "  - ${DOCKER_HUB_NAMESPACE}/meeshy-gateway:${VERSION}"
    info "  - ${DOCKER_HUB_NAMESPACE}/meeshy-frontend:${VERSION}"
    echo ""
    info "Pour utiliser ces images:"
    info "  docker pull ${DOCKER_HUB_NAMESPACE}/meeshy-translator:${VERSION}"
    info "  docker pull ${DOCKER_HUB_NAMESPACE}/meeshy-gateway:${VERSION}"
    info "  docker pull ${DOCKER_HUB_NAMESPACE}/meeshy-frontend:${VERSION}"
    echo ""
    info "Ou mettre à jour votre docker-compose.yml:"
    info "  translator:"
    info "    image: ${DOCKER_HUB_NAMESPACE}/meeshy-translator:${VERSION}"
    info "  gateway:"
    info "    image: ${DOCKER_HUB_NAMESPACE}/meeshy-gateway:${VERSION}"
    info "  frontend:"
    info "    image: ${DOCKER_HUB_NAMESPACE}/meeshy-frontend:${VERSION}"
}

# Fonction principale
main() {
    log "=== Construction et publication des images Docker pour Meeshy ==="
    info "Namespace Docker Hub: ${DOCKER_HUB_NAMESPACE}"
    info "Version: ${VERSION}"
    echo ""
    
    check_prerequisites
    build_images
    tag_images
    show_images
    push_images
    show_publication_info
    
    log "=== Publication terminée avec succès ==="
}

# Exécution du script
main "$@"
