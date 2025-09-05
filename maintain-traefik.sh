#!/bin/bash

# Script de maintenance et diagnostic Traefik
# Usage: ./maintain-traefik.sh [status|logs|restart|diagnose|cleanup]

set -e

# Configuration
REMOTE_HOST="root@157.230.15.51"
REMOTE_PATH="/opt/meeshy"
DOMAIN="meeshy.me"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

show_status() {
    log_info "Statut des services..."
    ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose ps"
}

show_logs() {
    local service=${1:-""}
    if [ -n "$service" ]; then
        log_info "Logs du service $service..."
        ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose logs --tail=50 -f $service"
    else
        log_info "Logs de tous les services..."
        ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose logs --tail=20"
    fi
}

restart_services() {
    local service=${1:-""}
    if [ -n "$service" ]; then
        log_info "Redémarrage du service $service..."
        ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose restart $service"
    else
        log_info "Redémarrage de tous les services..."
        ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose restart"
    fi
    log_success "Redémarrage terminé"
}

diagnose_issues() {
    log_info "Diagnostic complet de l'infrastructure..."
    echo ""
    
    # Statut des services
    log_info "1. Statut des services..."
    ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose ps"
    echo ""
    
    # Certificats SSL
    log_info "2. Certificats SSL..."
    ssh $REMOTE_HOST "cd $REMOTE_PATH && \
        echo '=== Certificats Let\\'s Encrypt émis ===' && \
        docker-compose exec traefik cat /letsencrypt/acme.json | jq '.letsencrypt.Certificates[] | .domain.main' 2>/dev/null || echo 'Erreur: Impossible de lire acme.json'"
    echo ""
    
    # Test de connectivité
    log_info "3. Tests de connectivité..."
    for domain in "$DOMAIN" "www.$DOMAIN" "traefik.$DOMAIN" "gate.$DOMAIN" "ml.$DOMAIN" "mongo.$DOMAIN" "redis.$DOMAIN"; do
        echo -n "Testing $domain... "
        status=$(ssh $REMOTE_HOST "curl -k -s -o /dev/null -w '%{http_code}' https://$domain" 2>/dev/null || echo "ERROR")
        if [ "$status" = "200" ] || [ "$status" = "401" ] || [ "$status" = "404" ] || [ "$status" = "405" ]; then
            log_success "OK ($status)"
        else
            log_error "FAILED ($status)"
        fi
    done
    echo ""
    
    # Logs d'erreurs récents
    log_info "4. Erreurs récentes dans les logs..."
    ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose logs --tail=100 | grep -i error | tail -10" || echo "Aucune erreur récente"
    echo ""
    
    # Utilisation des ressources
    log_info "5. Utilisation des ressources..."
    ssh $REMOTE_HOST "cd $REMOTE_PATH && docker stats --no-stream --format 'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}'"
}

cleanup_system() {
    log_info "Nettoyage du système..."
    
    # Nettoyage des conteneurs arrêtés
    log_info "Suppression des conteneurs arrêtés..."
    ssh $REMOTE_HOST "cd $REMOTE_PATH && docker-compose rm -f"
    
    # Nettoyage des images inutilisées
    log_info "Suppression des images inutilisées..."
    ssh $REMOTE_HOST "docker image prune -f"
    
    # Nettoyage des volumes inutilisés
    log_info "Suppression des volumes inutilisés..."
    ssh $REMOTE_HOST "docker volume prune -f"
    
    # Nettoyage du cache Docker
    log_info "Nettoyage du cache Docker..."
    ssh $REMOTE_HOST "docker system prune -f"
    
    log_success "Nettoyage terminé"
}

show_help() {
    echo "Usage: $0 [COMMAND] [SERVICE]"
    echo ""
    echo "Commands:"
    echo "  status                    Afficher le statut des services"
    echo "  logs [SERVICE]           Afficher les logs (optionnel: service spécifique)"
    echo "  restart [SERVICE]        Redémarrer les services (optionnel: service spécifique)"
    echo "  diagnose                 Diagnostic complet de l'infrastructure"
    echo "  cleanup                  Nettoyage du système Docker"
    echo "  help                     Afficher cette aide"
    echo ""
    echo "Services disponibles:"
    echo "  traefik, frontend, gateway, translator, database, redis, p3x-redis-ui, nosqlclient"
    echo ""
    echo "Exemples:"
    echo "  $0 status"
    echo "  $0 logs traefik"
    echo "  $0 restart gateway"
    echo "  $0 diagnose"
}

# Main
case "${1:-help}" in
    "status")
        show_status
        ;;
    "logs")
        show_logs "$2"
        ;;
    "restart")
        restart_services "$2"
        ;;
    "diagnose")
        diagnose_issues
        ;;
    "cleanup")
        cleanup_system
        ;;
    "help"|*)
        show_help
        ;;
esac
