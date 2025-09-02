#!/bin/bash

# 🔐 Script de gestion SSL intelligent pour Meeshy
# Gère Let's Encrypt et fallback auto-signé
# Usage: ./scripts/manage-ssl.sh [COMMAND] [DOMAIN] [EMAIL]

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

# Générer des certificats auto-signés
generate_self_signed() {
    local domain="$1"
    local ssl_dir="/opt/meeshy/ssl"
    
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

# Configurer Let's Encrypt
setup_letsencrypt() {
    local domain="$1"
    local email="$2"
    
    log_info "🌐 Configuration de Let's Encrypt pour $domain..."
    
    # Vérifier que le domaine pointe vers ce serveur
    local server_ip=$(curl -s ifconfig.me)
    local domain_ip=$(dig +short $domain | head -1)
    
    if [ "$server_ip" != "$domain_ip" ]; then
        log_warning "Le domaine $domain ne pointe pas vers cette IP ($server_ip)"
        log_warning "Vérifiez votre configuration DNS avant de continuer"
        read -p "Continuer quand même ? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Créer la configuration Nginx pour Let's Encrypt
    cat > /tmp/nginx-letsencrypt.conf << EOF
server {
    listen 80;
    server_name $domain www.$domain;
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect to HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $domain www.$domain;
    
    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/live/$domain/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/live/$domain/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Frontend
    location / {
        proxy_pass http://frontend:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # API Gateway
    location /api/ {
        proxy_pass http://gateway:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # WebSocket
    location /ws/ {
        proxy_pass http://gateway:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # Translation API
    location /translate/ {
        proxy_pass http://translator:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
EOF

    # Copier la configuration
    cp /tmp/nginx-letsencrypt.conf /opt/meeshy/docker/nginx/letsencrypt.conf
    
    # Mettre à jour l'environnement
    sed -i "s/your-domain.com/$domain/g" /opt/meeshy/.env
    sed -i "s/admin@meeshy.com/$email/g" /opt/meeshy/.env
    
    log_success "Configuration Let's Encrypt créée"
}

# Obtenir les certificats Let's Encrypt
obtain_certificates() {
    local domain="$1"
    local email="$2"
    
    log_info "🔐 Obtention des certificats Let's Encrypt pour $domain..."
    
    # Arrêter Nginx temporairement
    docker-compose stop nginx
    
    # Obtenir les certificats (mode staging d'abord)
    docker-compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$email" \
        --agree-tos \
        --no-eff-email \
        --staging \
        -d "$domain" \
        -d "www.$domain"
    
    # Si succès, obtenir les vrais certificats
    log_info "🎯 Obtention des certificats de production..."
    docker-compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$email" \
        --agree-tos \
        --no-eff-email \
        -d "$domain" \
        -d "www.$domain"
    
    # Redémarrer Nginx
    docker-compose up -d nginx
    
    log_success "Certificats Let's Encrypt obtenus avec succès"
}

# Renouveler les certificats
renew_certificates() {
    log_info "🔄 Renouvellement des certificats Let's Encrypt..."
    
    docker-compose run --rm certbot renew
    
    # Redémarrer Nginx pour charger les nouveaux certificats
    docker-compose restart nginx
    
    log_success "Certificats renouvelés"
}

# Vérifier l'état des certificats
check_certificates() {
    log_info "🔍 Vérification de l'état des certificats..."
    
    if [ -d "/opt/meeshy/ssl/live" ]; then
        log_info "Certificats Let's Encrypt trouvés:"
        find /opt/meemhy/ssl/live -name "*.pem" -exec ls -la {} \;
        
        # Vérifier la validité
        for cert in $(find /opt/meeshy/ssl/live -name "fullchain.pem"); do
            echo "Certificat: $cert"
            openssl x509 -in "$cert" -text -noout | grep -E "(Subject:|Not After|DNS:)"
            echo "---"
        done
    else
        log_info "Aucun certificat Let's Encrypt trouvé"
    fi
    
    if [ -f "/opt/meeshy/ssl/cert.pem" ]; then
        log_info "Certificat auto-signé trouvé:"
        openssl x509 -in /opt/meeshy/ssl/cert.pem -text -noout | grep -E "(Subject:|Not After)"
    fi
}

# Mode développement (auto-signé)
dev_mode() {
    local domain="${1:-localhost}"
    
    log_info "🔧 Mode développement - Génération de certificats auto-signés..."
    
    generate_self_signed "$domain"
    
    # Utiliser la configuration de développement
    cp /opt/meeshy/docker/nginx/digitalocean.conf /opt/meeshy/docker/nginx/active.conf
    
    # Redémarrer Nginx
    docker-compose restart nginx
    
    log_success "Mode développement activé avec certificats auto-signés"
}

# Mode production (Let's Encrypt)
prod_mode() {
    local domain="$1"
    local email="$2"
    
    if [ -z "$domain" ]; then
        log_error "Domaine requis pour le mode production"
        exit 1
    fi
    
    log_info "🚀 Mode production - Configuration Let's Encrypt..."
    
    setup_letsencrypt "$domain" "$email"
    obtain_certificates "$domain" "$email"
    
    # Utiliser la configuration Let's Encrypt
    cp /opt/meeshy/docker/nginx/letsencrypt.conf /opt/meemhy/docker/nginx/active.conf
    
    log_success "Mode production activé avec Let's Encrypt"
}

# Afficher l'aide
show_help() {
    echo -e "${BLUE}🔐 MEESHY - GESTIONNAIRE SSL INTELLIGENT${NC}"
    echo "============================================="
    echo ""
    echo -e "${GREEN}Usage:${NC}"
    echo "  $0 [COMMAND] [DOMAIN] [EMAIL]"
    echo ""
    echo -e "${GREEN}Commands:${NC}"
    echo -e "${CYAN}  dev${NC}         - Mode développement (certificats auto-signés)"
    echo -e "${CYAN}  prod${NC}        - Mode production (Let's Encrypt)"
    echo -e "${CYAN}  renew${NC}       - Renouveler les certificats Let's Encrypt"
    echo -e "${CYAN}  check${NC}       - Vérifier l'état des certificats"
    echo -e "${CYAN}  self-signed${NC} - Générer des certificats auto-signés"
    echo -e "${CYAN}  help${NC}        - Afficher cette aide"
    echo ""
    echo -e "${GREEN}Exemples:${NC}"
    echo "  $0 dev localhost"
    echo "  $0 prod example.com admin@example.com"
    echo "  $0 renew"
    echo "  $0 check"
    echo ""
    echo -e "${YELLOW}💡 Le script gère automatiquement le fallback auto-signé${NC}"
    echo -e "${YELLOW}💡 Les certificats Let's Encrypt sont renouvelés automatiquement${NC}"
}

# Point d'entrée principal
main() {
    check_docker
    
    case "$COMMAND" in
        "dev")
            dev_mode "$DOMAIN"
            ;;
        "prod")
            prod_mode "$DOMAIN" "$EMAIL"
            ;;
        "renew")
            renew_certificates
            ;;
        "check")
            check_certificates
            ;;
        "self-signed")
            generate_self_signed "${DOMAIN:-localhost}"
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
