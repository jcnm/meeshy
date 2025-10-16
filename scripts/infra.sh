#!/bin/bash

# Script de gestion de l'infrastructure Docker (MongoDB, Redis, UI)
# Usage: ./scripts/infra.sh [start|stop|restart|status|logs]

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Fonction pour afficher les messages
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

# Commandes
start_infra() {
    log_info "Démarrage de l'infrastructure Docker..."
    docker-compose -f docker-compose.infra.yml up -d
    
    log_info "Attente du démarrage complet..."
    sleep 10
    
    # Vérifier MongoDB
    log_info "Vérification de MongoDB..."
    for i in {1..30}; do
        if docker exec meeshy-dev-database mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
            log_success "✅ MongoDB est prêt"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "❌ Timeout: MongoDB ne répond pas"
            exit 1
        fi
        sleep 1
    done
    
    # Vérifier Redis
    log_info "Vérification de Redis..."
    for i in {1..10}; do
        if docker exec meeshy-dev-redis redis-cli ping > /dev/null 2>&1; then
            log_success "✅ Redis est prêt"
            break
        fi
        if [ $i -eq 10 ]; then
            log_error "❌ Timeout: Redis ne répond pas"
            exit 1
        fi
        sleep 1
    done
    
    echo ""
    log_success "Infrastructure démarrée avec succès!"
    echo ""
    log_info "📍 Services disponibles:"
    echo "   - MongoDB:         mongodb://localhost:27017"
    echo "   - NoSQLClient UI:  http://localhost:3001"
    echo "   - Redis:           redis://localhost:6379"
    echo "   - P3X Redis UI:    http://localhost:7843"
    echo ""
}

stop_infra() {
    log_warning "Arrêt de l'infrastructure Docker..."
    docker-compose -f docker-compose.infra.yml down
    log_success "Infrastructure arrêtée"
}

restart_infra() {
    log_info "Redémarrage de l'infrastructure Docker..."
    stop_infra
    sleep 2
    start_infra
}

status_infra() {
    echo ""
    log_info "╔══════════════════════════════════════════════════════════╗"
    log_info "║         État de l'Infrastructure Docker                  ║"
    log_info "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    # Vérifier chaque service
    local all_running=true
    
    # MongoDB
    if docker ps --filter "name=meeshy-dev-database" --filter "status=running" -q | grep -q .; then
        echo -e "${GREEN}✅ MongoDB${NC}        - En cours d'exécution"
        echo "   Container: meeshy-dev-database"
        echo "   URL: mongodb://localhost:27017"
    else
        echo -e "${RED}❌ MongoDB${NC}        - Arrêté"
        all_running=false
    fi
    echo ""
    
    # NoSQLClient
    if docker ps --filter "name=meeshy-dev-nosqlclient" --filter "status=running" -q | grep -q .; then
        echo -e "${GREEN}✅ NoSQLClient${NC}    - En cours d'exécution"
        echo "   Container: meeshy-dev-nosqlclient"
        echo "   URL: http://localhost:3001"
    else
        echo -e "${YELLOW}⚠️  NoSQLClient${NC}    - Arrêté"
    fi
    echo ""
    
    # Redis
    if docker ps --filter "name=meeshy-dev-redis" --filter "status=running" -q | grep -q .; then
        echo -e "${GREEN}✅ Redis${NC}          - En cours d'exécution"
        echo "   Container: meeshy-dev-redis"
        echo "   URL: redis://localhost:6379"
    else
        echo -e "${RED}❌ Redis${NC}          - Arrêté"
        all_running=false
    fi
    echo ""
    
    # P3X Redis UI
    if docker ps --filter "name=meeshy-dev-p3x-redis-ui" --filter "status=running" -q | grep -q .; then
        echo -e "${GREEN}✅ P3X Redis UI${NC}   - En cours d'exécution"
        echo "   Container: meeshy-dev-p3x-redis-ui"
        echo "   URL: http://localhost:7843"
    else
        echo -e "${YELLOW}⚠️  P3X Redis UI${NC}   - Arrêté"
    fi
    echo ""
    
    if [ "$all_running" = true ]; then
        log_success "Tous les services essentiels sont opérationnels"
    else
        log_warning "Certains services ne sont pas démarrés"
        echo ""
        log_info "💡 Pour démarrer: ${YELLOW}./scripts/infra.sh start${NC}"
    fi
    echo ""
}

logs_infra() {
    log_info "Affichage des logs de l'infrastructure..."
    docker-compose -f docker-compose.infra.yml logs -f
}

show_usage() {
    echo ""
    echo "Usage: $0 [commande]"
    echo ""
    echo "Commandes disponibles:"
    echo "  start     - Démarrer l'infrastructure Docker"
    echo "  stop      - Arrêter l'infrastructure Docker"
    echo "  restart   - Redémarrer l'infrastructure Docker"
    echo "  status    - Afficher l'état de l'infrastructure"
    echo "  logs      - Afficher les logs de l'infrastructure"
    echo ""
    echo "Exemples:"
    echo "  $0 start"
    echo "  $0 status"
    echo ""
}

# Vérifier la commande
case "${1:-}" in
    start)
        start_infra
        ;;
    stop)
        stop_infra
        ;;
    restart)
        restart_infra
        ;;
    status)
        status_infra
        ;;
    logs)
        logs_infra
        ;;
    *)
        show_usage
        exit 1
        ;;
esac

