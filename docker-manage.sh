#!/bin/bash

# ===== MEESHY DOCKER MANAGEMENT SCRIPT =====
# Backend: Fastify avec service de traduction gRPC backend
# Production optimized with pnpm and tini

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions utilitaires
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.docker"
PROJECT_NAME="meeshy"

# Vérification des prérequis
check_requirements() {
    log_info "Vérification des prérequis..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose n'est pas installé"
        exit 1
    fi
    
    log_success "Prérequis validés"
}

# Démarrage des services
start_services() {
    log_info "🚀 Démarrage des services Meeshy..."
    
    # Copier le fichier d'environnement si nécessaire
    if [ ! -f .env ]; then
        cp .env.docker .env
        log_info "Fichier .env créé depuis .env.docker"
    fi
    
    # Build et démarrage
    docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up --build -d
    
    log_success "Services démarrés avec succès!"
    log_info "🌐 Frontend: http://localhost:3000"
    log_info "🔧 Backend API: http://localhost:3001"
    log_info "🌍 Translation Service: grpc://localhost:50051"
    log_info "📊 Monitoring: http://localhost:3003 (Grafana)"
}

# Arrêt des services
stop_services() {
    log_info "🛑 Arrêt des services Meeshy..."
    docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down
    log_success "Services arrêtés"
}

# Redémarrage des services
restart_services() {
    log_info "🔄 Redémarrage des services..."
    stop_services
    start_services
}

# Affichage des logs
show_logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs -f
    else
        docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs -f "$service"
    fi
}

# Status des services
show_status() {
    log_info "📊 Status des services Meeshy:"
    docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
}

# Nettoyage complet
clean_all() {
    log_warning "⚠️  Nettoyage complet - Suppression de tous les conteneurs et volumes!"
    read -p "Êtes-vous sûr? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down -v --remove-orphans
        docker system prune -f
        docker volume prune -f
        log_success "Nettoyage terminé"
    else
        log_info "Nettoyage annulé"
    fi
}

# Build uniquement
build_images() {
    log_info "🏗️  Build des images Docker..."
    docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --no-cache
    log_success "Build terminé"
}

# Tests de santé
health_check() {
    log_info "🏥 Vérification de la santé des services..."
    
    services=("frontend:3000" "backend:3001")
    
    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"
        if curl -f "http://localhost:$port/health" &> /dev/null; then
            log_success "$name est en bonne santé"
        else
            log_error "$name ne répond pas"
        fi
    done
    
    # Test gRPC
    if python3 -c "import grpc; channel = grpc.insecure_channel('localhost:50051'); channel.close()" &> /dev/null; then
        log_success "Translation service (gRPC) est en bonne santé"
    else
        log_error "Translation service (gRPC) ne répond pas"
    fi
}

# Backup de la base de données
backup_db() {
    log_info "💾 Sauvegarde de la base de données..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="backup_${timestamp}.sql"
    
    docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres pg_dump -U meeshy_user meeshy > "$backup_file"
    log_success "Sauvegarde créée: $backup_file"
}

# Restauration de la base de données
restore_db() {
    local backup_file=$1
    if [ -z "$backup_file" ]; then
        log_error "Fichier de sauvegarde requis"
        echo "Usage: $0 restore <backup_file.sql>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Fichier de sauvegarde non trouvé: $backup_file"
        exit 1
    fi
    
    log_warning "⚠️  Restauration de la base de données depuis $backup_file"
    read -p "Êtes-vous sûr? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres psql -U meeshy_user -d meeshy < "$backup_file"
        log_success "Restauration terminée"
    else
        log_info "Restauration annulée"
    fi
}

# Menu d'aide
show_help() {
    echo "🌍 Script de gestion Meeshy Docker"
    echo
    echo "Usage: $0 <command> [options]"
    echo
    echo "Commandes disponibles:"
    echo "  start     - Démarre tous les services"
    echo "  stop      - Arrête tous les services"
    echo "  restart   - Redémarre tous les services"
    echo "  status    - Affiche le status des services"
    echo "  logs      - Affiche les logs (optionnel: nom du service)"
    echo "  build     - Build les images Docker"
    echo "  health    - Vérifie la santé des services"
    echo "  backup    - Sauvegarde la base de données"
    echo "  restore   - Restaure la base de données"
    echo "  clean     - Nettoyage complet"
    echo "  help      - Affiche cette aide"
    echo
    echo "Exemples:"
    echo "  $0 start"
    echo "  $0 logs backend"
    echo "  $0 restore backup_20250729_123456.sql"
}

# Fonction principale
main() {
    check_requirements
    
    case "$1" in
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$2"
            ;;
        build)
            build_images
            ;;
        health)
            health_check
            ;;
        backup)
            backup_db
            ;;
        restore)
            restore_db "$2"
            ;;
        clean)
            clean_all
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Commande inconnue: $1"
            show_help
            exit 1
            ;;
    esac
}

# Exécution
main "$@"
