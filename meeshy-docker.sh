#!/bin/bash
set -e

# Meeshy Docker Management Script
# Gestion simplifiée de l'environnement Docker Compose

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅${NC} $1"
}

show_help() {
    echo "Meeshy Docker Management Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  up          Démarrer tous les services"
    echo "  down        Arrêter tous les services"
    echo "  build       Builder les images Docker"
    echo "  rebuild     Rebuilder les images sans cache"
    echo "  logs        Afficher les logs de tous les services"
    echo "  status      Afficher le statut des services"
    echo "  clean       Nettoyer les containers et volumes"
    echo "  help        Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0 up       # Démarrer en arrière-plan"
    echo "  $0 logs     # Voir les logs"
    echo "  $0 down     # Arrêter les services"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker n'est pas installé"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        error "Docker Compose n'est pas installé"
        exit 1
    fi
}

check_env() {
    if [ ! -f ".env" ]; then
        error "Fichier .env manquant"
        exit 1
    fi
    success "Configuration .env trouvée"
}

case "${1:-help}" in
    up)
        log "🚀 Démarrage de Meeshy..."
        check_docker
        check_env
        docker compose up -d
        success "Services démarrés"
        log "📱 Application disponible sur:"
        log "  • Frontend: http://localhost:3000"
        log "  • Backend API: http://localhost:3001"
        log "  • Service de traduction: http://localhost:8000"
        log "📊 Utilisez '$0 logs' pour voir les logs"
        ;;
    down)
        log "🛑 Arrêt de Meeshy..."
        check_docker
        docker compose down
        success "Services arrêtés"
        ;;
    build)
        log "🔨 Build des images Docker..."
        check_docker
        check_env
        docker compose build
        success "Images buildées"
        ;;
    rebuild)
        log "🔨 Rebuild complet des images Docker..."
        check_docker
        check_env
        docker compose build --no-cache
        success "Images rebuildées"
        ;;
    logs)
        check_docker
        docker compose logs -f
        ;;
    status)
        check_docker
        docker compose ps
        ;;
    clean)
        warn "⚠️  Ceci va supprimer tous les containers et volumes Meeshy"
        read -p "Êtes-vous sûr ? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log "🧹 Nettoyage..."
            docker compose down -v
            docker system prune -f
            success "Nettoyage terminé"
        else
            log "Nettoyage annulé"
        fi
        ;;
    help|*)
        show_help
        ;;
esac
