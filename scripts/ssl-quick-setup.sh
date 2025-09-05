#!/bin/bash

# 🚀 Script de configuration SSL rapide pour Meeshy
# Choisit automatiquement la meilleure solution SSL
# Usage: ./scripts/ssl-quick-setup.sh [DOMAIN] [EMAIL]

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DOMAIN="${1:-}"
EMAIL="${2:-admin@meeshy.com}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Vérifier que Docker est en cours d'exécution
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker n'est pas en cours d'exécution"
        exit 1
    fi
}

# Afficher le menu de sélection
show_menu() {
    echo -e "${BLUE}🔐 CONFIGURATION SSL POUR MEESHY${NC}"
    echo "=================================="
    echo ""
    echo -e "${GREEN}Choisissez votre solution SSL:${NC}"
    echo ""
    echo -e "${CYAN}1.${NC} Nginx + Let's Encrypt (Recommandé pour production)"
    echo -e "${CYAN}2.${NC} Traefik (Moderne, avec dashboard)"
    echo -e "${CYAN}3.${NC} Caddy (Le plus simple, automatique)"
    echo -e "${CYAN}4.${NC} Configuration manuelle"
    echo ""
    echo -e "${YELLOW}💡 Caddy est recommandé pour la simplicité${NC}"
    echo -e "${YELLOW}💡 Nginx est recommandé pour la performance${NC}"
    echo -e "${YELLOW}💡 Traefik est recommandé pour la flexibilité${NC}"
    echo ""
}

# Configuration avec Nginx optimisé
setup_nginx_ssl() {
    local domain="$1"
    local email="$2"
    
    log_info "🔧 Configuration avec Nginx + Let's Encrypt..."
    
    # Utiliser la configuration SSL optimisée
    cp "$PROJECT_ROOT/docker-compose.ssl-optimized.yml" "$PROJECT_ROOT/docker-compose.yml"
    
    # Exécuter le script SSL optimisé
    if [ -n "$domain" ] && [ "$domain" != "localhost" ]; then
        "$PROJECT_ROOT/scripts/ssl-setup-optimized.sh" auto "$domain" "$email"
    else
        "$PROJECT_ROOT/scripts/ssl-setup-optimized.sh" self-signed localhost
    fi
    
    log_success "Configuration Nginx terminée"
}

# Configuration avec Traefik
setup_traefik_ssl() {
    local domain="$1"
    local email="$2"
    
    log_info "🔧 Configuration avec Traefik..."
    
    # Utiliser la configuration Traefik
    cp "$PROJECT_ROOT/docker-compose.traefik.yml" "$PROJECT_ROOT/docker-compose.yml"
    
    # Mettre à jour les variables d'environnement
    if [ -n "$domain" ] && [ "$domain" != "localhost" ]; then
        sed -i "s/DOMAIN=.*/DOMAIN=$domain/" "$PROJECT_ROOT/.env" 2>/dev/null || true
        sed -i "s/CERTBOT_EMAIL=.*/CERTBOT_EMAIL=$email/" "$PROJECT_ROOT/.env" 2>/dev/null || true
    fi
    
    # Démarrer les services
    docker-compose up -d
    
    log_success "Configuration Traefik terminée"
    log_info "Dashboard Traefik disponible sur: http://traefik.$domain:8080"
}

# Configuration avec Caddy
setup_caddy_ssl() {
    local domain="$1"
    local email="$2"
    
    log_info "🔧 Configuration avec Caddy (le plus simple)..."
    
    # Utiliser la configuration Caddy
    cp "$PROJECT_ROOT/docker-compose.caddy.yml" "$PROJECT_ROOT/docker-compose.yml"
    
    # Mettre à jour le Caddyfile
    if [ -n "$domain" ] && [ "$domain" != "localhost" ]; then
        sed -i "s/{$DOMAIN:localhost}/$domain/g" "$PROJECT_ROOT/Caddyfile"
        sed -i "s/{$CERTBOT_EMAIL:admin@meeshy.me}/$email/g" "$PROJECT_ROOT/Caddyfile"
    fi
    
    # Démarrer les services
    docker-compose up -d
    
    log_success "Configuration Caddy terminée"
    log_info "HTTPS automatique activé pour: $domain"
}

# Configuration manuelle
setup_manual_ssl() {
    log_info "🔧 Configuration manuelle..."
    
    echo -e "${YELLOW}Configuration manuelle sélectionnée${NC}"
    echo ""
    echo "Vous pouvez maintenant:"
    echo "1. Modifier les fichiers de configuration selon vos besoins"
    echo "2. Utiliser vos propres certificats SSL"
    echo "3. Configurer un reverse proxy personnalisé"
    echo ""
    echo "Fichiers de configuration disponibles:"
    echo "- docker-compose.ssl-optimized.yml (Nginx + Let's Encrypt)"
    echo "- docker-compose.traefik.yml (Traefik)"
    echo "- docker-compose.caddy.yml (Caddy)"
    echo "- docker/nginx/ssl-optimized.conf (Configuration Nginx)"
    echo "- Caddyfile (Configuration Caddy)"
    echo ""
    echo "Copiez le fichier de votre choix vers docker-compose.yml"
}

# Vérifier la configuration DNS
check_dns() {
    local domain="$1"
    
    if [ -z "$domain" ] || [ "$domain" = "localhost" ]; then
        return 0
    fi
    
    log_info "🔍 Vérification de la configuration DNS pour $domain..."
    
    local server_ip=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
    local domain_ip=$(dig +short "$domain" | head -1 2>/dev/null || echo "unknown")
    
    if [ "$server_ip" != "unknown" ] && [ "$domain_ip" != "unknown" ]; then
        if [ "$server_ip" = "$domain_ip" ]; then
            log_success "DNS configuré correctement: $domain -> $domain_ip"
            return 0
        else
            log_warning "DNS non configuré: $domain -> $domain_ip (serveur: $server_ip)"
            return 1
        fi
    else
        log_warning "Impossible de vérifier la configuration DNS"
        return 1
    fi
}

# Test de la configuration SSL
test_ssl() {
    local domain="${1:-localhost}"
    
    log_info "🧪 Test de la configuration SSL..."
    
    # Attendre que les services soient prêts
    sleep 10
    
    # Test HTTP (redirection)
    log_info "Test HTTP (redirection vers HTTPS)..."
    if curl -s -I "http://$domain" | grep -q "301\|302"; then
        log_success "Redirection HTTP vers HTTPS fonctionnelle"
    else
        log_warning "Problème de redirection HTTP"
    fi
    
    # Test HTTPS
    log_info "Test HTTPS..."
    if curl -s -k -I "https://$domain" | grep -q "200\|301\|302"; then
        log_success "HTTPS fonctionnel"
    else
        log_warning "Problème HTTPS"
    fi
}

# Point d'entrée principal
main() {
    check_docker
    
    # Si des paramètres sont fournis, configuration automatique
    if [ -n "$DOMAIN" ]; then
        log_info "Configuration automatique pour $DOMAIN"
        
        # Vérifier DNS si ce n'est pas localhost
        if [ "$DOMAIN" != "localhost" ]; then
            if ! check_dns "$DOMAIN"; then
                log_warning "DNS non configuré, utilisation de certificats auto-signés"
            fi
        fi
        
        # Recommander Caddy pour la simplicité
        log_info "Configuration automatique avec Caddy (recommandé)"
        setup_caddy_ssl "$DOMAIN" "$EMAIL"
        
        # Test de la configuration
        test_ssl "$DOMAIN"
        
        log_success "Configuration SSL terminée!"
        echo ""
        echo -e "${GREEN}Votre application est maintenant accessible en HTTPS sur:${NC}"
        echo -e "${CYAN}https://$DOMAIN${NC}"
        echo ""
        echo -e "${YELLOW}Commandes utiles:${NC}"
        echo "- Vérifier les logs: docker-compose logs"
        echo "- Redémarrer: docker-compose restart"
        echo "- Arrêter: docker-compose down"
        
        return 0
    fi
    
    # Mode interactif
    show_menu
    
    read -p "Votre choix (1-4): " choice
    
    case $choice in
        1)
            read -p "Domaine (ou localhost): " domain
            read -p "Email pour Let's Encrypt: " email
            setup_nginx_ssl "${domain:-localhost}" "${email:-admin@meeshy.com}"
            ;;
        2)
            read -p "Domaine (ou localhost): " domain
            read -p "Email pour Let's Encrypt: " email
            setup_traefik_ssl "${domain:-localhost}" "${email:-admin@meeshy.com}"
            ;;
        3)
            read -p "Domaine (ou localhost): " domain
            read -p "Email pour Let's Encrypt: " email
            setup_caddy_ssl "${domain:-localhost}" "${email:-admin@meeshy.com}"
            ;;
        4)
            setup_manual_ssl
            ;;
        *)
            log_error "Choix invalide"
            exit 1
            ;;
    esac
    
    # Test de la configuration
    if [ "$choice" != "4" ]; then
        test_ssl "${domain:-localhost}"
    fi
}

# Exécuter le script principal
main "$@"
