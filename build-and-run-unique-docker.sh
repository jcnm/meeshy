#!/bin/bash

# Script de construction et exécution du Docker unique Meeshy
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
IMAGE_NAME="meeshy-unique"
CONTAINER_NAME="meeshy-unique"
TAG="latest"

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
    
    if [ ! -f "Dockerfile" ]; then
        error "Le Dockerfile n'existe pas"
        exit 1
    fi
    
    if [ ! -f "env.docker" ]; then
        error "Le fichier env.docker n'existe pas"
        exit 1
    fi
    
    log "Prérequis vérifiés ✓"
}

# Nettoyage des conteneurs existants
cleanup_existing() {
    log "Nettoyage des conteneurs existants..."
    
    if docker ps -a --format "table {{.Names}}" | grep -q "$CONTAINER_NAME"; then
        warn "Arrêt et suppression du conteneur existant..."
        docker stop "$CONTAINER_NAME" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
    fi
    
    log "Nettoyage terminé ✓"
}

# Construction de l'image
build_image() {
    log "Construction de l'image Docker unique..."
    info "Cette opération peut prendre plusieurs minutes..."
    
    # Construction avec BuildKit pour optimiser le cache
    DOCKER_BUILDKIT=1 docker build \
        --tag "$IMAGE_NAME:$TAG" \
        --file Dockerfile \
        --progress=plain \
        .
    
    if [ $? -eq 0 ]; then
        log "Image construite avec succès ✓"
    else
        error "Échec de la construction de l'image"
        exit 1
    fi
}

# Création des volumes persistants
create_volumes() {
    log "Création des volumes persistants..."
    
    # Volume pour les données PostgreSQL
    docker volume create meeshy-postgres-data 2>/dev/null || true
    
    # Volume pour les modèles ML
    docker volume create meeshy-models 2>/dev/null || true
    
    # Volume pour les logs
    docker volume create meeshy-logs 2>/dev/null || true
    
    log "Volumes créés ✓"
}

# Exécution du conteneur
run_container() {
    log "Démarrage du conteneur Meeshy unique..."
    
    docker run -d \
        --name "$CONTAINER_NAME" \
        --env-file env.docker \
        --publish 80:80 \
        --publish 3100:3100 \
        --publish 3000:3000 \
        --publish 8000:8000 \
        --volume meeshy-postgres-data:/app/data/postgres \
        --volume meeshy-models:/app/models \
        --volume meeshy-logs:/app/logs \
        --restart unless-stopped \
        --memory=8g \
        --cpus=4.0 \
        "$IMAGE_NAME:$TAG"
    
    if [ $? -eq 0 ]; then
        log "Conteneur démarré avec succès ✓"
    else
        error "Échec du démarrage du conteneur"
        exit 1
    fi
}

# Vérification des services
check_services() {
    log "Vérification des services..."
    info "Attente du démarrage des services (peut prendre 2-3 minutes)..."
    
    # Attendre que les services soient prêts
    sleep 30
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        info "Tentative $attempt/$max_attempts..."
        
        # Vérifier PostgreSQL
        if docker exec "$CONTAINER_NAME" pg_isready -U meeshy -d meeshy >/dev/null 2>&1; then
            log "✅ PostgreSQL - OK"
        else
            warn "⏳ PostgreSQL - En cours de démarrage..."
        fi
        
        # Vérifier Redis
        if docker exec "$CONTAINER_NAME" redis-cli ping >/dev/null 2>&1; then
            log "✅ Redis - OK"
        else
            warn "⏳ Redis - En cours de démarrage..."
        fi
        
        # Vérifier Gateway
        if curl -s http://localhost:3000/health >/dev/null 2>&1; then
            log "✅ Gateway - OK"
        else
            warn "⏳ Gateway - En cours de démarrage..."
        fi
        
        # Vérifier Translator
        if curl -s http://localhost:8000/health >/dev/null 2>&1; then
            log "✅ Translator - OK"
        else
            warn "⏳ Translator - En cours de démarrage..."
        fi
        
        # Vérifier Frontend
        if curl -s http://localhost:3100 >/dev/null 2>&1; then
            log "✅ Frontend - OK"
            break
        else
            warn "⏳ Frontend - En cours de démarrage..."
        fi
        
        sleep 10
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        error "Timeout: Les services n'ont pas démarré dans le délai imparti"
        docker logs "$CONTAINER_NAME" --tail 50
        exit 1
    fi
}

# Affichage des informations
show_info() {
    echo ""
    echo -e "${PURPLE}🎉 Meeshy unique est maintenant opérationnel !${NC}"
    echo "=============================================="
    echo ""
    echo -e "${CYAN}📱 Accès aux services:${NC}"
    echo -e "   🌐 Interface principale: ${BLUE}http://localhost${NC}"
    echo -e "   🎨 Frontend direct:      ${BLUE}http://localhost:3100${NC}"
    echo -e "   ⚡ Gateway API:          ${BLUE}http://localhost:3000${NC}"
    echo -e "   🐍 Translator API:       ${BLUE}http://localhost:8000${NC}"
    echo ""
    echo -e "${CYAN}🔧 Commandes utiles:${NC}"
    echo -e "   Voir les logs:          ${BLUE}docker logs $CONTAINER_NAME${NC}"
    echo -e "   Arrêter:                ${BLUE}docker stop $CONTAINER_NAME${NC}"
    echo -e "   Redémarrer:             ${BLUE}docker restart $CONTAINER_NAME${NC}"
    echo -e "   Accès shell:            ${BLUE}docker exec -it $CONTAINER_NAME /bin/bash${NC}"
    echo ""
    echo -e "${YELLOW}💡 Les données sont persistées dans les volumes Docker${NC}"
    echo ""
}

# Fonction principale
main() {
    echo -e "${PURPLE}🚀 Construction et exécution du Docker unique Meeshy${NC}"
    echo "=============================================="
    
    check_prerequisites
    cleanup_existing
    build_image
    create_volumes
    run_container
    check_services
    show_info
}

# Exécution
main "$@"
