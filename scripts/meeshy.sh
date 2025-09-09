#!/bin/bash

# ===== MEESHY - SCRIPT UNIFIÉ DE GESTION DES SERVICES =====
# Script pour démarrer, arrêter et gérer tous les services Meeshy
# Usage: ./meeshy.sh [COMMAND] [OPTIONS]

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/meeshy"
COMPOSE_FILE="docker-compose.traefik.yml"
ENV_FILE="secrets/production-secrets.env"
DOMAIN="meeshy.me"

# Fonction d'aide
show_help() {
    echo -e "${CYAN}🚀 MEESHY - SCRIPT UNIFIÉ DE GESTION DES SERVICES${NC}"
    echo "=================================================="
    echo ""
    echo "Usage:"
    echo "  ./meeshy.sh [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  start       - Démarrer tous les services"
    echo "  stop        - Arrêter tous les services"
    echo "  restart     - Redémarrer tous les services"
    echo "  status      - Afficher le statut des services"
    echo "  logs        - Afficher les logs des services"
    echo "  pull        - Télécharger les dernières images"
    echo "  update      - Mettre à jour et redémarrer"
    echo "  health      - Vérifier la santé des services"
    echo "  clean       - Nettoyer les conteneurs et images inutilisés"
    echo "  backup      - Sauvegarder les données"
    echo "  restore     - Restaurer les données"
    echo ""
    echo "Options:"
    echo "  --force     - Forcer l'arrêt/redémarrage"
    echo "  --no-pull   - Ne pas télécharger les images"
    echo "  --logs      - Afficher les logs après démarrage"
    echo ""
    echo "Exemples:"
    echo "  ./meeshy.sh start"
    echo "  ./meeshy.sh update --logs"
    echo "  ./meeshy.sh status"
    echo "  ./meeshy.sh logs gateway"
    echo ""
}

# Fonction de logging
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

# Vérifier si Docker est installé et en cours d'exécution
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker n'est pas en cours d'exécution"
        exit 1
    fi
    
    log_success "Docker est disponible"
}

# Vérifier si Docker Compose est disponible
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose n'est pas installé"
        exit 1
    fi
    
    # Utiliser docker compose si disponible, sinon docker-compose
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    log_success "Docker Compose est disponible"
}

# Vérifier les fichiers nécessaires
check_files() {
    if [ ! -f "$PROJECT_DIR/$COMPOSE_FILE" ]; then
        log_error "Fichier $COMPOSE_FILE non trouvé dans $PROJECT_DIR"
        exit 1
    fi
    
    if [ ! -f "$PROJECT_DIR/$ENV_FILE" ]; then
        log_error "Fichier $ENV_FILE non trouvé dans $PROJECT_DIR"
        exit 1
    fi
    
    log_success "Fichiers de configuration trouvés"
}

# Télécharger les dernières images
pull_images() {
    log_info "Téléchargement des dernières images..."
    
    cd "$PROJECT_DIR"
    
    # Télécharger les images spécifiées dans le compose file
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
    
    log_success "Images téléchargées avec succès"
}

# Démarrer les services
start_services() {
    log_info "Démarrage des services Meeshy..."
    
    cd "$PROJECT_DIR"
    
    # Créer le réseau s'il n'existe pas
    docker network create meeshy-network 2>/dev/null || true
    
    # Démarrer les services
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    
    log_success "Services démarrés avec succès"
    
    # Attendre que les services soient prêts
    log_info "Attente du démarrage des services..."
    sleep 10
    
    # Vérifier le statut
    show_status
}

# Arrêter les services
stop_services() {
    log_info "Arrêt des services Meeshy..."
    
    cd "$PROJECT_DIR"
    
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    
    log_success "Services arrêtés avec succès"
}

# Redémarrer les services
restart_services() {
    log_info "Redémarrage des services Meeshy..."
    
    stop_services
    sleep 5
    start_services
}

# Afficher le statut des services
show_status() {
    log_info "Statut des services Meeshy:"
    echo ""
    
    cd "$PROJECT_DIR"
    
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    
    echo ""
    log_info "Vérification de la santé des services..."
    
    # Vérifier les ports
    local ports=("80" "443" "3000" "8000" "3100")
    for port in "${ports[@]}"; do
        if netstat -tuln | grep -q ":$port "; then
            log_success "Port $port: Ouvert"
        else
            log_warning "Port $port: Fermé"
        fi
    done
}

# Afficher les logs
show_logs() {
    local service="$1"
    
    cd "$PROJECT_DIR"
    
    if [ -n "$service" ]; then
        log_info "Logs du service $service:"
        $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f --tail=100 "$service"
    else
        log_info "Logs de tous les services:"
        $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f --tail=50
    fi
}

# Vérifier la santé des services
check_health() {
    log_info "Vérification de la santé des services..."
    
    cd "$PROJECT_DIR"
    
    # Vérifier les conteneurs
    local containers=("meeshy-traefik" "meeshy-database" "meeshy-redis" "meeshy-translator" "meeshy-gateway" "meeshy-frontend")
    
    for container in "${containers[@]}"; do
        if docker ps | grep -q "$container"; then
            local status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
            if [ "$status" = "running" ]; then
                log_success "$container: En cours d'exécution"
            else
                log_warning "$container: Statut $status"
            fi
        else
            log_error "$container: Non trouvé"
        fi
    done
    
    # Vérifier les endpoints
    log_info "Vérification des endpoints..."
    
    # Traefik
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost" | grep -q "200\|301\|302"; then
        log_success "Traefik: Accessible"
    else
        log_warning "Traefik: Non accessible"
    fi
    
    # Gateway
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/health" | grep -q "200"; then
        log_success "Gateway: Accessible"
    else
        log_warning "Gateway: Non accessible"
    fi
    
    # Translator
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/health" | grep -q "200"; then
        log_success "Translator: Accessible"
    else
        log_warning "Translator: Non accessible"
    fi
}

# Nettoyer les conteneurs et images inutilisés
clean_system() {
    log_info "Nettoyage du système..."
    
    # Arrêter tous les conteneurs
    docker stop $(docker ps -aq) 2>/dev/null || true
    
    # Supprimer tous les conteneurs
    docker rm $(docker ps -aq) 2>/dev/null || true
    
    # Supprimer les images inutilisées
    docker image prune -f
    
    # Supprimer les volumes inutilisés
    docker volume prune -f
    
    # Supprimer les réseaux inutilisés
    docker network prune -f
    
    log_success "Nettoyage terminé"
}

# Sauvegarder les données
backup_data() {
    local backup_dir="/opt/backups/meeshy"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    
    log_info "Sauvegarde des données..."
    
    mkdir -p "$backup_dir"
    
    # Sauvegarder la base de données
    docker exec meeshy-database mongodump --out /tmp/backup
    docker cp meeshy-database:/tmp/backup "$backup_dir/mongodb_$timestamp"
    
    # Sauvegarder Redis
    docker exec meeshy-redis redis-cli BGSAVE
    docker cp meeshy-redis:/data/dump.rdb "$backup_dir/redis_$timestamp.rdb"
    
    # Sauvegarder les volumes
    docker run --rm -v meeshy_database_data:/data -v "$backup_dir":/backup alpine tar czf /backup/database_data_$timestamp.tar.gz -C /data .
    docker run --rm -v meeshy_redis_data:/data -v "$backup_dir":/backup alpine tar czf /backup/redis_data_$timestamp.tar.gz -C /data .
    
    log_success "Sauvegarde terminée dans $backup_dir"
}

# Restaurer les données
restore_data() {
    local backup_dir="/opt/backups/meeshy"
    
    log_warning "Cette opération va restaurer les données depuis la dernière sauvegarde"
    read -p "Êtes-vous sûr ? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restauration annulée"
        return
    fi
    
    log_info "Restauration des données..."
    
    # Trouver la dernière sauvegarde
    local latest_backup=$(ls -t "$backup_dir" | head -1)
    
    if [ -z "$latest_backup" ]; then
        log_error "Aucune sauvegarde trouvée"
        return
    fi
    
    log_info "Restauration depuis $latest_backup"
    
    # Restaurer la base de données
    docker cp "$backup_dir/$latest_backup" meeshy-database:/tmp/restore
    docker exec meeshy-database mongorestore /tmp/restore
    
    log_success "Restauration terminée"
}

# Mettre à jour et redémarrer
update_services() {
    local no_pull="$1"
    
    log_info "Mise à jour des services Meeshy..."
    
    if [ "$no_pull" != "--no-pull" ]; then
        pull_images
    fi
    
    restart_services
    
    log_success "Mise à jour terminée"
}

# Fonction principale
main() {
    local command="$1"
    local option="$2"
    
    # Vérifications préliminaires
    check_docker
    check_docker_compose
    check_files
    
    case "$command" in
        "start")
            start_services
            if [ "$option" = "--logs" ]; then
                sleep 5
                show_logs
            fi
            ;;
        "stop")
            if [ "$option" = "--force" ]; then
                log_warning "Arrêt forcé des services..."
                docker stop $(docker ps -q) 2>/dev/null || true
            else
                stop_services
            fi
            ;;
        "restart")
            if [ "$option" = "--force" ]; then
                log_warning "Redémarrage forcé des services..."
                docker restart $(docker ps -q) 2>/dev/null || true
            else
                restart_services
            fi
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs "$option"
            ;;
        "pull")
            pull_images
            ;;
        "update")
            update_services "$option"
            ;;
        "health")
            check_health
            ;;
        "clean")
            clean_system
            ;;
        "backup")
            backup_data
            ;;
        "restore")
            restore_data
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "Commande inconnue: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Exécuter la fonction principale
main "$@"
