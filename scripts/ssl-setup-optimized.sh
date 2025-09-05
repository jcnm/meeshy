#!/bin/bash

# 🔐 Script SSL optimisé pour Meeshy
# Gestion intelligente des certificats avec fallback automatique
# Usage: ./scripts/ssl-setup-optimized.sh [COMMAND] [DOMAIN] [EMAIL]

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

COMMAND="${1:-help}"
DOMAIN="${2:-}"
EMAIL="${3:-admin@meeshy.com}"
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

# Générer des certificats auto-signés
generate_self_signed() {
    local domain="$1"
    local ssl_dir="$PROJECT_ROOT/ssl"
    
    log_info "🔐 Génération de certificats auto-signés pour $domain..."
    
    mkdir -p "$ssl_dir"
    cd "$ssl_dir"
    
    # Générer la clé privée
    openssl genrsa -out key.pem 2048
    
    # Configuration OpenSSL avec SAN
    cat > openssl.conf << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = FR
ST = IDF
L = Paris
O = Meeshy
CN = $domain

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $domain
DNS.2 = www.$domain
DNS.3 = localhost
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
EOF

    # Générer le certificat
    openssl req -new -x509 -key key.pem -out cert.pem -days 365 -config openssl.conf
    
    # Définir les permissions
    chmod 600 key.pem
    chmod 644 cert.pem
    
    # Nettoyer
    rm openssl.conf
    
    log_success "Certificats auto-signés générés dans $ssl_dir"
}

# Obtenir les certificats Let's Encrypt
obtain_letsencrypt_certificates() {
    local domain="$1"
    local email="$2"
    
    log_info "🔐 Obtention des certificats Let's Encrypt pour $domain..."
    
    # Vérifier que Nginx est en cours d'exécution
    if ! docker-compose ps nginx | grep -q "Up"; then
        log_info "Démarrage de Nginx pour les challenges Let's Encrypt..."
        docker-compose up -d nginx
        sleep 10
    fi
    
    # Obtenir les certificats (mode staging d'abord pour tester)
    log_info "🧪 Test avec le serveur de staging Let's Encrypt..."
    if docker-compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$email" \
        --agree-tos \
        --no-eff-email \
        --staging \
        --non-interactive \
        -d "$domain" \
        -d "www.$domain" 2>/dev/null; then
        
        log_success "Test staging réussi, obtention des certificats de production..."
        
        # Obtenir les vrais certificats
        if docker-compose run --rm certbot certonly \
            --webroot \
            --webroot-path=/var/www/certbot \
            --email "$email" \
            --agree-tos \
            --no-eff-email \
            --non-interactive \
            -d "$domain" \
            -d "www.$domain"; then
            
            log_success "Certificats Let's Encrypt obtenus avec succès"
            
            # Recharger Nginx pour utiliser les nouveaux certificats
            docker-compose exec nginx nginx -s reload
            
            return 0
        else
            log_error "Échec de l'obtention des certificats de production"
            return 1
        fi
    else
        log_error "Échec du test staging Let's Encrypt"
        return 1
    fi
}

# Configuration automatique SSL
auto_configure_ssl() {
    local domain="$1"
    local email="$2"
    
    log_info "🚀 Configuration automatique SSL pour $domain..."
    
    # Vérifier la configuration DNS
    if check_dns "$domain"; then
        log_info "🌐 Tentative d'obtention de certificats Let's Encrypt..."
        
        if obtain_letsencrypt_certificates "$domain" "$email"; then
            log_success "Configuration Let's Encrypt réussie"
            return 0
        else
            log_warning "Échec Let's Encrypt, basculement vers certificats auto-signés"
        fi
    else
        log_warning "DNS non configuré, utilisation de certificats auto-signés"
    fi
    
    # Fallback vers certificats auto-signés
    generate_self_signed "$domain"
    log_success "Configuration avec certificats auto-signés"
    return 0
}

# Renouveler les certificats Let's Encrypt
renew_certificates() {
    log_info "🔄 Renouvellement des certificats Let's Encrypt..."
    
    if docker-compose run --rm certbot renew --quiet; then
        log_success "Certificats renouvelés avec succès"
        
        # Recharger Nginx
        docker-compose exec nginx nginx -s reload
        
        return 0
    else
        log_error "Échec du renouvellement des certificats"
        return 1
    fi
}

# Vérifier l'état des certificats
check_certificates() {
    log_info "🔍 Vérification de l'état des certificats..."
    
    # Vérifier les certificats Let's Encrypt
    if docker volume ls | grep -q "meeshy_ssl_certs"; then
        log_info "Certificats Let's Encrypt trouvés:"
        
        # Lister les certificats disponibles
        docker run --rm -v meeshy_ssl_certs:/etc/letsencrypt certbot/certbot:latest certificates 2>/dev/null || {
            log_warning "Impossible de lister les certificats Let's Encrypt"
        }
    else
        log_info "Aucun volume de certificats Let's Encrypt trouvé"
    fi
    
    # Vérifier les certificats auto-signés
    if [ -f "$PROJECT_ROOT/ssl/cert.pem" ]; then
        log_info "Certificat auto-signé trouvé:"
        openssl x509 -in "$PROJECT_ROOT/ssl/cert.pem" -text -noout | grep -E "(Subject:|Not After)" 2>/dev/null || {
            log_warning "Impossible de lire le certificat auto-signé"
        }
    else
        log_info "Aucun certificat auto-signé trouvé"
    fi
}

# Tester la configuration SSL
test_ssl_configuration() {
    local domain="${1:-localhost}"
    
    log_info "🧪 Test de la configuration SSL pour $domain..."
    
    # Vérifier que les services sont en cours d'exécution
    if ! docker-compose ps | grep -q "Up"; then
        log_warning "Services non démarrés, démarrage automatique..."
        docker-compose up -d
        sleep 30
    fi
    
    # Test HTTP
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
    
    # Test des certificats
    log_info "Vérification des certificats..."
    if echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null; then
        log_success "Certificats SSL valides"
    else
        log_warning "Problème avec les certificats SSL"
    fi
}

# Déployer avec SSL optimisé
deploy_with_ssl() {
    local domain="$1"
    local email="$2"
    
    log_info "🚀 Déploiement avec SSL optimisé..."
    
    # Utiliser la configuration SSL optimisée
    cp "$PROJECT_ROOT/docker-compose.ssl-optimized.yml" "$PROJECT_ROOT/docker-compose.yml"
    
    # Configuration automatique SSL
    auto_configure_ssl "$domain" "$email"
    
    # Démarrer les services
    log_info "Démarrage des services..."
    docker-compose up -d
    
    # Attendre que les services soient prêts
    log_info "Attente du démarrage des services..."
    sleep 30
    
    # Test de la configuration
    test_ssl_configuration "$domain"
    
    log_success "Déploiement SSL terminé"
}

# Afficher l'aide
show_help() {
    echo -e "${BLUE}🔐 MEESHY - CONFIGURATION SSL OPTIMISÉE${NC}"
    echo "============================================="
    echo ""
    echo -e "${GREEN}Usage:${NC}"
    echo "  $0 [COMMAND] [DOMAIN] [EMAIL]"
    echo ""
    echo -e "${GREEN}Commands:${NC}"
    echo -e "${CYAN}  auto${NC}        - Configuration automatique (Let's Encrypt + fallback)"
    echo -e "${CYAN}  letsencrypt${NC} - Forcer Let's Encrypt uniquement"
    echo -e "${CYAN}  self-signed${NC} - Générer des certificats auto-signés"
    echo -e "${CYAN}  renew${NC}       - Renouveler les certificats Let's Encrypt"
    echo -e "${CYAN}  check${NC}       - Vérifier l'état des certificats"
    echo -e "${CYAN}  test${NC}        - Tester la configuration SSL"
    echo -e "${CYAN}  deploy${NC}      - Déployer avec SSL optimisé"
    echo -e "${CYAN}  help${NC}        - Afficher cette aide"
    echo ""
    echo -e "${GREEN}Exemples:${NC}"
    echo "  $0 auto example.com admin@example.com"
    echo "  $0 letsencrypt example.com admin@example.com"
    echo "  $0 self-signed localhost"
    echo "  $0 renew"
    echo "  $0 check"
    echo "  $0 test example.com"
    echo "  $0 deploy example.com admin@example.com"
    echo ""
    echo -e "${YELLOW}💡 Le mode 'auto' essaie Let's Encrypt puis bascule automatiquement${NC}"
    echo -e "${YELLOW}💡 Les certificats sont renouvelés automatiquement toutes les 12h${NC}"
}

# Point d'entrée principal
main() {
    check_docker
    
    case "$COMMAND" in
        "auto")
            auto_configure_ssl "$DOMAIN" "$EMAIL"
            ;;
        "letsencrypt")
            if [ -z "$DOMAIN" ]; then
                log_error "Domaine requis pour Let's Encrypt"
                exit 1
            fi
            obtain_letsencrypt_certificates "$DOMAIN" "$EMAIL"
            ;;
        "self-signed")
            generate_self_signed "${DOMAIN:-localhost}"
            ;;
        "renew")
            renew_certificates
            ;;
        "check")
            check_certificates
            ;;
        "test")
            test_ssl_configuration "$DOMAIN"
            ;;
        "deploy")
            if [ -z "$DOMAIN" ]; then
                log_error "Domaine requis pour le déploiement"
                exit 1
            fi
            deploy_with_ssl "$DOMAIN" "$EMAIL"
            ;;
        "help"|"-h"|"--help"|"")
            show_help
            ;;
        *)
            log_error "Commande inconnue: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Exécuter le script principal
main "$@"
