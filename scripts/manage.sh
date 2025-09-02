#!/bin/bash

# Script de gestion et monitoring Meeshy
# Usage: ./scripts/manage.sh [COMMAND] [DROPLET_IP]
# Commands: health, backup, update, logs, shell, monitor

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

COMMAND="${1:-help}"
DROPLET_IP="$2"

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Fonctions utilitaires
log_info() { echo -e "${BLUE}Info: $1${NC}"; }
log_success() { echo -e "${GREEN}Success: $1${NC}"; }
log_warning() { echo -e "${YELLOW}Warning: $1${NC}"; }
log_error() { echo -e "${RED}Error: $1${NC}"; }

# Test de connexion SSH
test_ssh_connection() {
    local ip="$1"
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$ip "echo 'SSH OK'" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Verifier la sante des services
check_health() {
    local ip="$1"
    log_info "Verification de la sante des services sur $ip"
    
    # Etat des conteneurs
    log_info "Etat des conteneurs:"
    ssh -o StrictHostKeyChecking=no root@$ip "cd /opt/meeshy && docker-compose ps"
    
    echo ""
    
    # Utilisation des ressources
    log_info "Utilisation des ressources:"
    ssh -o StrictHostKeyChecking=no root@$ip "df -h / && echo '---' && free -h"
    
    echo ""
    
    # Services systeme
    log_info "Services systeme:"
    ssh -o StrictHostKeyChecking=no root@$ip "systemctl status --no-pager -l nginx docker"
    
    echo ""
    
    # Test des endpoints
    log_info "Test des endpoints:"
    
    # Frontend
    if curl -s -o /dev/null -w "%{http_code}" "http://$ip" | grep -q "200\|301\|302"; then
        log_success "Frontend: OK"
    else
        log_warning "Frontend: En cours de demarrage ou probleme"
    fi
    
    # Gateway
    if curl -s -o /dev/null -w "%{http_code}" "http://$ip:3000/health" | grep -q "200"; then
        log_success "Gateway API: OK"
    else
        log_warning "Gateway API: En cours de demarrage ou probleme"
    fi
    
    # Translator
    if curl -s -o /dev/null -w "%{http_code}" "http://$ip:8000/health" | grep -q "200"; then
        log_success "Translator API: OK"
    else
        log_warning "Translator API: En cours de demarrage ou probleme"
    fi
}

# Sauvegarde des donnees
backup_data() {
    local ip="$1"
    log_info "Sauvegarde des donnees sur $ip"
    
    # Creer repertoire de sauvegarde
    local backup_dir="/tmp/meeshy-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Sauvegarder MongoDB
    log_info "Sauvegarde MongoDB..."
    ssh -o StrictHostKeyChecking=no root@$ip "cd /opt/meeshy && docker-compose exec -T mongodb mongodump --out /tmp/mongodb-backup"
    scp -r -o StrictHostKeyChecking=no root@$ip:/tmp/mongodb-backup "$backup_dir/"
    
    # Sauvegarder les fichiers de configuration
    log_info "Sauvegarde des configurations..."
    scp -r -o StrictHostKeyChecking=no root@$ip:/opt/meeshy "$backup_dir/"
    
    # Creer archive
    local archive_name="meeshy-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    tar -czf "$archive_name" -C "$backup_dir" .
    
    log_success "Sauvegarde creee: $archive_name"
    
    # Nettoyer
    rm -rf "$backup_dir"
    ssh -o StrictHostKeyChecking=no root@$ip "rm -rf /tmp/mongodb-backup"
}

# Mise a jour des services
update_services() {
    local ip="$1"
    log_info "Mise a jour des services sur $ip"
    
    # Arreter les services
    log_info "Arret des services..."
    ssh -o StrictHostKeyChecking=no root@$ip "cd /opt/meeshy && docker-compose down"
    
    # Mettre a jour les images
    log_info "Mise a jour des images..."
    ssh -o StrictHostKeyChecking=no root@$ip "cd /opt/meeshy && docker-compose pull"
    
    # Redemarrer les services
    log_info "Redemarrage des services..."
    ssh -o StrictHostKeyChecking=no root@$ip "cd /opt/meeshy && docker-compose up -d"
    
    # Attendre que les services demarrent
    log_info "Attente du demarrage..."
    sleep 30
    
    # Verifier la sante
    check_health "$ip"
}

# Afficher les logs
show_logs() {
    local ip="$1"
    local service="${3:-all}"
    
    log_info "Logs des services sur $ip"
    
    if [ "$service" = "all" ]; then
        ssh -o StrictHostKeyChecking=no root@$ip "cd /opt/meeshy && docker-compose logs --tail=100 -f"
    else
        ssh -o StrictHostKeyChecking=no root@$ip "cd /opt/meeshy && docker-compose logs --tail=100 -f $service"
    fi
}

# Acces shell au serveur
access_shell() {
    local ip="$1"
    log_info "Connexion SSH a $ip"
    ssh -o StrictHostKeyChecking=no root@$ip
}

# Monitoring en temps reel
monitor_services() {
    local ip="$1"
    log_info "Monitoring en temps reel sur $ip"
    
    # Verifier la sante toutes les 30 secondes
    while true; do
        clear
        echo -e "${BLUE}MONITORING MEESHY - $(date)${NC}"
        echo "=================================================="
        
        # Etat des conteneurs
        ssh -o StrictHostKeyChecking=no root@$ip "cd /opt/meeshy && docker-compose ps" 2>/dev/null || echo "Impossible de recuperer l'etat"
        
        echo ""
        echo -e "${YELLOW}Appuyez sur Ctrl+C pour arreter le monitoring${NC}"
        echo "Actualisation dans 30 secondes..."
        
        sleep 30
    done
}

# Afficher l'aide
show_help() {
    echo -e "${BLUE}Script de gestion et monitoring Meeshy${NC}"
    echo "=================================================="
    echo ""
    echo -e "${GREEN}Usage:${NC}"
    echo "  $0 [COMMAND] [DROPLET_IP]"
    echo ""
    echo -e "${GREEN}Commandes:${NC}"
    echo -e "${CYAN}  health${NC}    - Verifier la sante des services"
    echo -e "${CYAN}  backup${NC}    - Sauvegarder les donnees"
    echo -e "${CYAN}  update${NC}    - Mettre a jour les services"
    echo -e "${CYAN}  logs${NC}      - Afficher les logs (optionnel: service)"
    echo -e "${CYAN}  shell${NC}     - Acces shell au serveur"
    echo -e "${CYAN}  monitor${NC}   - Monitoring en temps reel"
    echo ""
    echo -e "${GREEN}Exemples:${NC}"
    echo "  $0 health 209.97.149.115"
    echo "  $0 backup 209.97.149.115"
    echo "  $0 logs 209.97.149.115 frontend"
    echo "  $0 monitor 209.97.149.115"
    echo ""
    echo -e "${YELLOW}Utilise la cle SSH par defaut du systeme${NC}"
}

# Verifier les arguments
if [ "$COMMAND" = "help" ] || [ "$COMMAND" = "-h" ] || [ "$COMMAND" = "--help" ]; then
    show_help
    exit 0
fi

if [ -z "$DROPLET_IP" ]; then
    log_error "IP du droplet manquante"
    echo ""
    show_help
    exit 1
fi

# Test de connexion SSH
if ! test_ssh_connection "$DROPLET_IP"; then
    log_error "Impossible de se connecter au serveur $DROPLET_IP"
    exit 1
fi

# Executer la commande
case "$COMMAND" in
    "health")
        check_health "$DROPLET_IP"
        ;;
    "backup")
        backup_data "$DROPLET_IP"
        ;;
    "update")
        update_services "$DROPLET_IP"
        ;;
    "logs")
        show_logs "$DROPLET_IP" "$3"
        ;;
    "shell")
        access_shell "$DROPLET_IP"
        ;;
    "monitor")
        monitor_services "$DROPLET_IP"
        ;;
    *)
        log_error "Commande inconnue: $COMMAND"
        echo ""
        show_help
        exit 1
        ;;
esac

log_success "Commande '$COMMAND' executee avec succes sur $DROPLET_IP"
