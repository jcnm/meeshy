#!/bin/bash

# Script de gestion Docker pour Meeshy Backend Refactored
# Usage: ./docker-manage.sh [command]

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="meeshy-backend"
DOCKER_COMPOSE_DEV="docker-compose.yml"
DOCKER_COMPOSE_PROD="docker-compose.prod.yml"

# Fonctions utilitaires
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Vérifier si Docker est installé
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker n'est pas installé. Veuillez l'installer d'abord."
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker n'est pas en cours d'exécution. Veuillez le démarrer."
    fi
}

# Vérifier si Docker Compose est installé
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose n'est pas installé. Veuillez l'installer d'abord."
    fi
}

# Fonction pour obtenir la commande docker-compose
get_compose_cmd() {
    if command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    else
        echo "docker compose"
    fi
}

# Démarrage des services en mode développement
start_dev() {
    log "Démarrage des services en mode développement..."
    
    COMPOSE_CMD=$(get_compose_cmd)
    
    # Arrêter les services s'ils sont en cours
    $COMPOSE_CMD -f $DOCKER_COMPOSE_DEV down
    
    # Construire et démarrer
    $COMPOSE_CMD -f $DOCKER_COMPOSE_DEV up --build -d
    
    log "Services démarrés en mode développement"
    info "Fastify API: http://localhost:3001"
    info "Health check: http://localhost:3001/health"
    info "WebSocket: ws://localhost:3001/ws"
    info "Nginx: http://localhost:80"
    info "PostgreSQL: localhost:5432"
    info "Redis: localhost:6379"
}

# Démarrage des services en mode production
start_prod() {
    log "Démarrage des services en mode production..."
    
    COMPOSE_CMD=$(get_compose_cmd)
    
    # Vérifier les variables d'environnement
    if [[ ! -f ".env.production" ]]; then
        warn "Fichier .env.production non trouvé. Utilisation des valeurs par défaut."
    fi
    
    # Arrêter les services s'ils sont en cours
    $COMPOSE_CMD -f $DOCKER_COMPOSE_PROD down
    
    # Construire et démarrer
    $COMPOSE_CMD -f $DOCKER_COMPOSE_PROD up --build -d
    
    log "Services démarrés en mode production"
    info "Fastify API: http://localhost:3001"
    info "Nginx: http://localhost:80"
    info "Grafana: http://localhost:3003"
    info "Prometheus: http://localhost:9090"
}

# Arrêt des services
stop() {
    log "Arrêt des services..."
    
    COMPOSE_CMD=$(get_compose_cmd)
    
    $COMPOSE_CMD -f $DOCKER_COMPOSE_DEV down
    $COMPOSE_CMD -f $DOCKER_COMPOSE_PROD down
    
    log "Tous les services ont été arrêtés"
}

# Redémarrage des services
restart() {
    MODE=${1:-dev}
    
    log "Redémarrage des services en mode $MODE..."
    
    stop
    
    if [[ "$MODE" == "prod" ]]; then
        start_prod
    else
        start_dev
    fi
}

# Affichage des logs
logs() {
    SERVICE=${1:-}
    COMPOSE_CMD=$(get_compose_cmd)
    
    if [[ -n "$SERVICE" ]]; then
        log "Affichage des logs pour le service: $SERVICE"
        $COMPOSE_CMD -f $DOCKER_COMPOSE_DEV logs -f $SERVICE
    else
        log "Affichage des logs de tous les services"
        $COMPOSE_CMD -f $DOCKER_COMPOSE_DEV logs -f
    fi
}

# Status des services
status() {
    log "Status des services:"
    
    COMPOSE_CMD=$(get_compose_cmd)
    
    echo ""
    info "=== SERVICES DE DÉVELOPPEMENT ==="
    $COMPOSE_CMD -f $DOCKER_COMPOSE_DEV ps
    
    echo ""
    info "=== SERVICES DE PRODUCTION ==="
    $COMPOSE_CMD -f $DOCKER_COMPOSE_PROD ps
}

# Health check de tous les services
health() {
    log "Vérification de la santé des services..."
    
    # Vérifier Fastify
    if curl -f http://localhost:3001/health &> /dev/null; then
        info "✅ Fastify API: OK"
    else
        warn "❌ Fastify API: KO"
    fi
    
    # Vérifier Nginx
    if curl -f http://localhost:80/health &> /dev/null; then
        info "✅ Nginx: OK"
    else
        warn "❌ Nginx: KO"
    fi
    
    # Vérifier PostgreSQL
    if docker exec meeshy-postgres pg_isready -U meeshy -d meeshy_db &> /dev/null; then
        info "✅ PostgreSQL: OK"
    else
        warn "❌ PostgreSQL: KO"
    fi
    
    # Vérifier Redis
    if docker exec meeshy-redis redis-cli ping &> /dev/null; then
        info "✅ Redis: OK"
    else
        warn "❌ Redis: KO"
    fi
}

# Sauvegarde de la base de données
backup() {
    log "Sauvegarde de la base de données..."
    
    BACKUP_DIR="./backups"
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    mkdir -p $BACKUP_DIR
    
    docker exec meeshy-postgres pg_dump -U meeshy meeshy_db > "$BACKUP_DIR/$BACKUP_FILE"
    
    log "Sauvegarde créée: $BACKUP_DIR/$BACKUP_FILE"
}

# Restauration de la base de données
restore() {
    BACKUP_FILE=${1:-}
    
    if [[ -z "$BACKUP_FILE" ]]; then
        error "Veuillez spécifier le fichier de sauvegarde: ./docker-manage.sh restore <backup_file>"
    fi
    
    if [[ ! -f "$BACKUP_FILE" ]]; then
        error "Fichier de sauvegarde non trouvé: $BACKUP_FILE"
    fi
    
    log "Restauration de la base de données depuis: $BACKUP_FILE"
    
    docker exec -i meeshy-postgres psql -U meeshy -d meeshy_db < "$BACKUP_FILE"
    
    log "Restauration terminée"
}

# Nettoyage complet
clean() {
    warn "Cette opération va supprimer tous les conteneurs, images et volumes Docker liés au projet."
    read -p "Êtes-vous sûr? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Nettoyage en cours..."
        
        COMPOSE_CMD=$(get_compose_cmd)
        
        # Arrêter et supprimer les conteneurs
        $COMPOSE_CMD -f $DOCKER_COMPOSE_DEV down -v --remove-orphans
        $COMPOSE_CMD -f $DOCKER_COMPOSE_PROD down -v --remove-orphans
        
        # Supprimer les images
        docker images | grep meeshy | awk '{print $3}' | xargs -r docker rmi
        
        # Nettoyer les ressources non utilisées
        docker system prune -f
        
        log "Nettoyage terminé"
    else
        info "Nettoyage annulé"
    fi
}

# Construction des images
build() {
    log "Construction des images Docker..."
    
    COMPOSE_CMD=$(get_compose_cmd)
    
    $COMPOSE_CMD -f $DOCKER_COMPOSE_DEV build --no-cache
    
    log "Images construites avec succès"
}

# Migration de la base de données
migrate() {
    log "Exécution des migrations de base de données..."
    
    docker exec meeshy-fastify npm run migrate
    
    log "Migrations terminées"
}

# Affichage de l'aide
help() {
    echo "Usage: ./docker-manage.sh [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start-dev     Démarrer en mode développement"
    echo "  start-prod    Démarrer en mode production"
    echo "  stop          Arrêter tous les services"
    echo "  restart [dev|prod]  Redémarrer les services"
    echo "  status        Afficher le status des services"
    echo "  logs [service]      Afficher les logs"
    echo "  health        Vérifier la santé des services"
    echo "  build         Construire les images Docker"
    echo "  migrate       Exécuter les migrations DB"
    echo "  backup        Sauvegarder la base de données"
    echo "  restore <file>      Restaurer la base de données"
    echo "  clean         Nettoyer tous les conteneurs et images"
    echo "  help          Afficher cette aide"
    echo ""
    echo "Examples:"
    echo "  ./docker-manage.sh start-dev"
    echo "  ./docker-manage.sh logs fastify-service"
    echo "  ./docker-manage.sh restart prod"
    echo "  ./docker-manage.sh restore ./backups/backup_20240101_120000.sql"
}

# Script principal
main() {
    check_docker
    check_docker_compose
    
    case "${1:-help}" in
        "start-dev")
            start_dev
            ;;
        "start-prod")
            start_prod
            ;;
        "stop")
            stop
            ;;
        "restart")
            restart "${2:-dev}"
            ;;
        "status")
            status
            ;;
        "logs")
            logs "${2:-}"
            ;;
        "health")
            health
            ;;
        "build")
            build
            ;;
        "migrate")
            migrate
            ;;
        "backup")
            backup
            ;;
        "restore")
            restore "${2:-}"
            ;;
        "clean")
            clean
            ;;
        "help"|*)
            help
            ;;
    esac
}

# Exécution du script
main "$@"
