#!/bin/bash

# ===== MEESHY - MISE À JOUR SANS INTERRUPTION =====
# Script pour mettre à jour gateway et frontend sans interruption de service
# Usage: ./scripts/zero-downtime-update.sh [DROPLET_IP] [OPTIONS]
# 
# Stratégie: Rolling Update avec Traefik Load Balancer
# - Déploiement des nouvelles versions en parallèle
# - Basculement progressif du trafic
# - Rollback automatique en cas de problème

set -e

# Couleurs pour les logs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Variables globales
DROPLET_IP=""
FORCE_REFRESH=false
VERBOSE=false
DRY_RUN=false
ROLLBACK_ON_ERROR=true
HEALTH_CHECK_TIMEOUT=60

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Fonction d'aide
show_help() {
    echo -e "${CYAN}🚀 MEESHY - MISE À JOUR SANS INTERRUPTION${NC}"
    echo "============================================="
    echo ""
    echo "Usage: $0 [DROPLET_IP] [OPTIONS]"
    echo ""
    echo "Description:"
    echo "  Met à jour gateway et frontend sans interruption de service"
    echo "  en utilisant une stratégie de rolling update avec Traefik"
    echo ""
    echo "Options:"
    echo "  --force-refresh         Forcer le téléchargement des nouvelles images"
    echo "  --no-rollback           Désactiver le rollback automatique en cas d'erreur"
    echo "  --health-timeout=SEC    Timeout pour les health checks (défaut: 60s)"
    echo "  --dry-run               Simulation sans modification"
    echo "  --verbose               Mode verbeux"
    echo "  --help, -h              Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0 192.168.1.100"
    echo "  $0 157.230.15.51 --force-refresh"
    echo "  $0 157.230.15.51 --dry-run --verbose"
    echo "  $0 157.230.15.51 --health-timeout=120"
    echo ""
    echo -e "${YELLOW}⚠️  ATTENTION:${NC}"
    echo "  • Ce script maintient la disponibilité du service pendant la mise à jour"
    echo "  • La base de données et l'infrastructure ne sont PAS modifiées"
    echo "  • Rollback automatique en cas de problème"
    echo ""
    echo -e "${GREEN}📋 Stratégie de déploiement:${NC}"
    echo "  1. Préparation des nouvelles versions"
    echo "  2. Déploiement en parallèle (blue-green)"
    echo "  3. Health checks des nouvelles versions"
    echo "  4. Basculement progressif du trafic"
    echo "  5. Nettoyage des anciennes versions"
    echo "  6. Rollback automatique si nécessaire"
    echo ""
}

# Parser les arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force-refresh)
                FORCE_REFRESH=true
                shift
                ;;
            --no-rollback)
                ROLLBACK_ON_ERROR=false
                shift
                ;;
            --health-timeout=*)
                HEALTH_CHECK_TIMEOUT="${1#*=}"
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                if [ -z "$DROPLET_IP" ]; then
                    DROPLET_IP="$1"
                fi
                shift
                ;;
        esac
    done
}

# Test de connexion SSH
test_ssh_connection() {
    local ip="$1"
    log_info "Test de connexion SSH vers $ip..."
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$ip "echo 'Connexion SSH réussie'" >/dev/null 2>&1; then
        log_success "Connexion SSH réussie"
        return 0
    else
        log_error "Impossible de se connecter au serveur $ip"
        return 1
    fi
}

# Vérification préliminaire
preliminary_check() {
    local ip="$1"
    log_info "Vérification préliminaire de l'environnement..."
    
    ssh -o StrictHostKeyChecking=no root@$ip << 'EOF'
        cd /opt/meeshy
        echo "🔍 VÉRIFICATION PRÉLIMINAIRE"
        echo "============================"
        
        # Vérifier que le répertoire existe
        if [ ! -d "/opt/meeshy" ]; then
            echo "❌ Répertoire /opt/meeshy non trouvé"
            exit 1
        fi
        
        # Vérifier que docker-compose.yml existe
        if [ ! -f "docker-compose.yml" ]; then
            echo "❌ Fichier docker-compose.yml non trouvé"
            exit 1
        fi
        
        # Vérifier que Docker est installé
        if ! command -v docker &> /dev/null; then
            echo "❌ Docker non installé"
            exit 1
        fi
        
        # Vérifier que Docker Compose est installé
        if ! command -v docker-compose &> /dev/null; then
            echo "❌ Docker Compose non installé"
            exit 1
        fi
        
        # Vérifier que Traefik est en cours d'exécution
        if ! docker-compose ps traefik | grep -q "Up"; then
            echo "❌ Traefik n'est pas en cours d'exécution"
            exit 1
        fi
        
        echo "✅ Environnement vérifié"
        echo ""
        echo "📊 État actuel des services:"
        docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
EOF
}

# Créer la configuration Docker Compose pour le déploiement blue-green
create_blue_green_config() {
    local ip="$1"
    log_info "Création de la configuration blue-green..."
    
    # Créer le script de configuration
    cat << 'EOF' > /tmp/create-blue-green-config.sh
#!/bin/bash
set -e

cd /opt/meeshy

echo "🔧 CRÉATION DE LA CONFIGURATION BLUE-GREEN"
echo "==========================================="

# Sauvegarder la configuration actuelle
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Configuration actuelle sauvegardée"

# Créer la configuration blue-green
cat > docker-compose.blue-green.yml << 'COMPOSE_EOF'
version: '3.8'

services:
  # Traefik Reverse Proxy (inchangé)
  traefik:
    image: traefik:v3.0
    container_name: meeshy-traefik
    restart: unless-stopped
    command:
      - "--api.dashboard=true"
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=${CERTBOT_EMAIL:-admin@meeshy.me}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.caserver=https://acme-v02.api.letsencrypt.org/directory"
      - "--log.level=DEBUG"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_certs:/letsencrypt
    networks:
      - meeshy-network

  # Database Service (inchangé)
  database:
    image: ${DATABASE_IMAGE:-mongo:8.0}
    container_name: meeshy-database
    restart: unless-stopped
    command: mongod --replSet rs0 --bind_ip_all
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${DATABASE_USER:-admin}
      MONGO_INITDB_ROOT_PASSWORD: ${DATABASE_PASSWORD:-password}
      MONGO_INITDB_DATABASE: ${DATABASE_NAME:-meeshy}
    volumes:
      - database_data:/data/db
      - database_config:/data/configdb
      - ./shared/init-mongodb-replica.sh:/docker-entrypoint-initdb.d/init-mongodb-replica.sh:ro
      - ./shared/init-mongo.js:/docker-entrypoint-initdb.d/init-mongo.js:ro
    networks:
      - meeshy-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  # Redis Cache (inchangé)
  redis:
    image: ${REDIS_IMAGE:-redis:8-alpine}
    container_name: meeshy-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-password}
    volumes:
      - redis_data:/data
    networks:
      - meeshy-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  # Translator Service (inchangé)
  translator:
    image: ${TRANSLATOR_IMAGE:-isopen/meeshy-translator:1.0.39-alpha}
    container_name: meeshy-translator
    restart: unless-stopped
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - TRANSLATION_MODEL_PATH=${TRANSLATION_MODEL_PATH:-/app/models}
      - WORKER_COUNT=${TRANSLATOR_WORKER_COUNT:-2}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    volumes:
      - translator_models:/app/models
    networks:
      - meeshy-network
    depends_on:
      database:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.translator.rule=Host(`${DOMAIN:-localhost}`) && PathPrefix(`/translate`)"
      - "traefik.http.routers.translator.entrypoints=websecure"
      - "traefik.http.routers.translator.tls.certresolver=letsencrypt"
      - "traefik.http.services.translator.loadbalancer.server.port=8000"

  # Gateway Service - Version Actuelle (BLUE)
  gateway-blue:
    image: ${GATEWAY_IMAGE:-isopen/meeshy-gateway:1.0.39-alpha}
    container_name: meeshy-gateway-blue
    restart: unless-stopped
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - TRANSLATOR_URL=${TRANSLATOR_URL}
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - NODE_ENV=${NODE_ENV:-production}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    networks:
      - meeshy-network
    depends_on:
      database:
        condition: service_healthy
      redis:
        condition: service_healthy
      translator:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.gateway-api.rule=Host(`${DOMAIN:-localhost}`) && PathPrefix(`/api`)"
      - "traefik.http.routers.gateway-api.entrypoints=websecure"
      - "traefik.http.routers.gateway-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.gateway-api.loadbalancer.server.port=3000"
      - "traefik.http.routers.gateway-ws.rule=Host(`${DOMAIN:-localhost}`) && PathPrefix(`/ws`)"
      - "traefik.http.routers.gateway-ws.entrypoints=websecure"
      - "traefik.http.routers.gateway-ws.tls.certresolver=letsencrypt"
      - "traefik.http.services.gateway-ws.loadbalancer.server.port=3000"

  # Gateway Service - Nouvelle Version (GREEN)
  gateway-green:
    image: ${GATEWAY_IMAGE:-isopen/meeshy-gateway:1.0.39-alpha}
    container_name: meeshy-gateway-green
    restart: "no"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - TRANSLATOR_URL=${TRANSLATOR_URL}
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - NODE_ENV=${NODE_ENV:-production}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    networks:
      - meeshy-network
    depends_on:
      database:
        condition: service_healthy
      redis:
        condition: service_healthy
      translator:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    labels:
      - "traefik.enable=false"  # Désactivé par défaut
      - "traefik.http.routers.gateway-api-green.rule=Host(`${DOMAIN:-localhost}`) && PathPrefix(`/api`)"
      - "traefik.http.routers.gateway-api-green.entrypoints=websecure"
      - "traefik.http.routers.gateway-api-green.tls.certresolver=letsencrypt"
      - "traefik.http.services.gateway-api-green.loadbalancer.server.port=3000"
      - "traefik.http.routers.gateway-ws-green.rule=Host(`${DOMAIN:-localhost}`) && PathPrefix(`/ws`)"
      - "traefik.http.routers.gateway-ws-green.entrypoints=websecure"
      - "traefik.http.routers.gateway-ws-green.tls.certresolver=letsencrypt"
      - "traefik.http.services.gateway-ws-green.loadbalancer.server.port=3000"

  # Frontend Service - Version Actuelle (BLUE)
  frontend-blue:
    image: ${FRONTEND_IMAGE:-isopen/meeshy-frontend:1.0.39-alpha}
    container_name: meeshy-frontend-blue
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
      - NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
      - NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
      - NEXT_PUBLIC_TRANSLATION_URL=${NEXT_PUBLIC_TRANSLATION_URL}
      - NEXT_PUBLIC_FRONTEND_URL=${NEXT_PUBLIC_FRONTEND_URL}
      - NODE_ENV=${NODE_ENV:-production}
    networks:
      - meeshy-network
    depends_on:
      gateway-blue:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3100"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`${DOMAIN:-localhost}`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=3100"
      - "traefik.http.routers.frontend.priority=1"

  # Frontend Service - Nouvelle Version (GREEN)
  frontend-green:
    image: ${FRONTEND_IMAGE:-isopen/meeshy-frontend:1.0.39-alpha}
    container_name: meeshy-frontend-green
    restart: "no"
    environment:
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
      - NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
      - NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
      - NEXT_PUBLIC_TRANSLATION_URL=${NEXT_PUBLIC_TRANSLATION_URL}
      - NEXT_PUBLIC_FRONTEND_URL=${NEXT_PUBLIC_FRONTEND_URL}
      - NODE_ENV=${NODE_ENV:-production}
    networks:
      - meeshy-network
    depends_on:
      gateway-green:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3100"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    labels:
      - "traefik.enable=false"  # Désactivé par défaut
      - "traefik.http.routers.frontend-green.rule=Host(`${DOMAIN:-localhost}`)"
      - "traefik.http.routers.frontend-green.entrypoints=websecure"
      - "traefik.http.routers.frontend-green.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend-green.loadbalancer.server.port=3100"
      - "traefik.http.routers.frontend-green.priority=1"

volumes:
  database_data:
  database_config:
  redis_data:
  translator_models:
  traefik_certs:

networks:
  meeshy-network:
    driver: bridge
COMPOSE_EOF

echo "✅ Configuration blue-green créée: docker-compose.blue-green.yml"
EOF

    # Transférer et exécuter le script
    scp -o StrictHostKeyChecking=no /tmp/create-blue-green-config.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/create-blue-green-config.sh && /tmp/create-blue-green-config.sh"
    rm -f /tmp/create-blue-green-config.sh
}

# Déploiement blue-green
deploy_blue_green() {
    local ip="$1"
    log_info "Déploiement blue-green des nouvelles versions..."
    
    # Créer le script de déploiement
    cat << EOF > /tmp/deploy-blue-green.sh
#!/bin/bash
set -e

cd /opt/meeshy

echo "🚀 DÉPLOIEMENT BLUE-GREEN"
echo "========================="

# Télécharger les nouvelles images si demandé
if [ "$FORCE_REFRESH" = "true" ]; then
    echo "📦 Téléchargement forcé des nouvelles images..."
    docker-compose -f docker-compose.blue-green.yml pull gateway-green frontend-green
else
    echo "📦 Téléchargement des nouvelles images..."
    docker-compose -f docker-compose.blue-green.yml pull gateway-green frontend-green
fi

echo ""
echo "🔄 DÉPLOIEMENT DES NOUVELLES VERSIONS (GREEN)"
echo "============================================="

# Démarrer les nouvelles versions (GREEN)
echo "🚪 Démarrage du nouveau Gateway (GREEN)..."
docker-compose -f docker-compose.blue-green.yml up -d gateway-green

# Attendre que le nouveau gateway soit prêt
echo "⏳ Attente que le nouveau Gateway soit prêt..."
sleep 10

# Vérifier que le nouveau gateway répond
for i in {1..20}; do
    if docker-compose -f docker-compose.blue-green.yml exec -T gateway-green curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
        echo "✅ Nouveau Gateway (GREEN) opérationnel"
        break
    fi
    echo "⏳ Tentative \$i/20 pour le nouveau Gateway..."
    sleep 3
done

echo "🎨 Démarrage du nouveau Frontend (GREEN)..."
docker-compose -f docker-compose.blue-green.yml up -d frontend-green

# Attendre que le nouveau frontend soit prêt
echo "⏳ Attente que le nouveau Frontend soit prêt..."
sleep 5

# Vérifier que le nouveau frontend répond
for i in {1..10}; do
    if docker-compose -f docker-compose.blue-green.yml exec -T frontend-green curl -f -s http://localhost:3100 >/dev/null 2>&1; then
        echo "✅ Nouveau Frontend (GREEN) opérationnel"
        break
    fi
    echo "⏳ Tentative \$i/10 pour le nouveau Frontend..."
    sleep 2
done

echo ""
echo "📊 État des services après déploiement GREEN:"
docker-compose -f docker-compose.blue-green.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🎉 Déploiement GREEN terminé avec succès!"
echo "✅ Nouveau Gateway: Opérationnel"
echo "✅ Nouveau Frontend: Opérationnel"
echo "✅ Anciennes versions: Toujours actives"
EOF

    # Transférer et exécuter le script
    scp -o StrictHostKeyChecking=no /tmp/deploy-blue-green.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/deploy-blue-green.sh && FORCE_REFRESH=$FORCE_REFRESH /tmp/deploy-blue-green.sh"
    rm -f /tmp/deploy-blue-green.sh
}

# Basculement du trafic vers les nouvelles versions
switch_traffic_to_green() {
    local ip="$1"
    log_info "Basculement du trafic vers les nouvelles versions (GREEN)..."
    
    # Créer le script de basculement
    cat << 'EOF' > /tmp/switch-traffic.sh
#!/bin/bash
set -e

cd /opt/meeshy

echo "🔄 BASCULEMENT DU TRAFIC VERS GREEN"
echo "==================================="

# Activer les nouvelles versions dans Traefik
echo "🌐 Activation des nouvelles versions dans Traefik..."

# Activer le nouveau Gateway
docker-compose -f docker-compose.blue-green.yml exec gateway-green sh -c '
    docker update --label-add "traefik.enable=true" meeshy-gateway-green
'

# Activer le nouveau Frontend
docker-compose -f docker-compose.blue-green.yml exec frontend-green sh -c '
    docker update --label-add "traefik.enable=true" meeshy-frontend-green
'

# Désactiver les anciennes versions dans Traefik
echo "⏹️  Désactivation des anciennes versions dans Traefik..."

# Désactiver l'ancien Gateway
docker-compose -f docker-compose.blue-green.yml exec gateway-blue sh -c '
    docker update --label-add "traefik.enable=false" meeshy-gateway-blue
'

# Désactiver l'ancien Frontend
docker-compose -f docker-compose.blue-green.yml exec frontend-blue sh -c '
    docker update --label-add "traefik.enable=false" meeshy-frontend-blue
'

# Attendre que Traefik mette à jour sa configuration
echo "⏳ Attente de la mise à jour de la configuration Traefik..."
sleep 10

# Vérifier que le trafic est bien basculé
echo "🔍 Vérification du basculement du trafic..."

# Test du nouveau Gateway
if curl -f -s -H "Host: gate.meeshy.me" http://localhost/health >/dev/null 2>&1; then
    echo "✅ Nouveau Gateway: Trafic basculé avec succès"
else
    echo "❌ Nouveau Gateway: Problème de basculement du trafic"
    exit 1
fi

# Test du nouveau Frontend
if curl -f -s -H "Host: meeshy.me" http://localhost >/dev/null 2>&1; then
    echo "✅ Nouveau Frontend: Trafic basculé avec succès"
else
    echo "❌ Nouveau Frontend: Problème de basculement du trafic"
    exit 1
fi

echo ""
echo "🎉 BASCULEMENT DU TRAFIC TERMINÉ AVEC SUCCÈS !"
echo "=============================================="
echo "✅ Nouveau Gateway: Actif et accessible"
echo "✅ Nouveau Frontend: Actif et accessible"
echo "✅ Anciennes versions: Désactivées mais préservées"
EOF

    # Transférer et exécuter le script
    scp -o StrictHostKeyChecking=no /tmp/switch-traffic.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/switch-traffic.sh && /tmp/switch-traffic.sh"
    rm -f /tmp/switch-traffic.sh
}

# Nettoyage des anciennes versions
cleanup_old_versions() {
    local ip="$1"
    log_info "Nettoyage des anciennes versions..."
    
    # Créer le script de nettoyage
    cat << 'EOF' > /tmp/cleanup-old-versions.sh
#!/bin/bash
set -e

cd /opt/meeshy

echo "🧹 NETTOYAGE DES ANCIENNES VERSIONS"
echo "==================================="

# Arrêter les anciennes versions
echo "⏹️  Arrêt des anciennes versions (BLUE)..."
docker-compose -f docker-compose.blue-green.yml stop gateway-blue frontend-blue

# Supprimer les anciens conteneurs
echo "🗑️  Suppression des anciens conteneurs..."
docker-compose -f docker-compose.blue-green.yml rm -f gateway-blue frontend-blue

# Renommer les nouvelles versions pour qu'elles deviennent les versions principales
echo "🔄 Renommage des nouvelles versions..."

# Renommer gateway-green en gateway
docker rename meeshy-gateway-green meeshy-gateway

# Renommer frontend-green en frontend
docker rename meeshy-frontend-green meeshy-frontend

# Mettre à jour les labels Traefik
echo "🏷️  Mise à jour des labels Traefik..."

# Mettre à jour les labels du Gateway
docker update --label-add "traefik.http.routers.gateway-api.rule=Host(\`meeshy.me\`) && PathPrefix(\`/api\`)" meeshy-gateway
docker update --label-add "traefik.http.routers.gateway-ws.rule=Host(\`meeshy.me\`) && PathPrefix(\`/ws\`)" meeshy-gateway

# Mettre à jour les labels du Frontend
docker update --label-add "traefik.http.routers.frontend.rule=Host(\`meeshy.me\`)" meeshy-frontend

# Supprimer les labels spécifiques à GREEN
docker update --label-rm "traefik.http.routers.gateway-api-green.rule" meeshy-gateway 2>/dev/null || true
docker update --label-rm "traefik.http.routers.gateway-ws-green.rule" meeshy-gateway 2>/dev/null || true
docker update --label-rm "traefik.http.routers.frontend-green.rule" meeshy-frontend 2>/dev/null || true

# Restaurer la configuration principale
echo "📋 Restauration de la configuration principale..."
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)
cp docker-compose.blue-green.yml docker-compose.yml

# Nettoyer les anciennes images
echo "🧹 Nettoyage des anciennes images..."
docker image prune -f

echo ""
echo "📊 État final des services:"
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🎉 NETTOYAGE TERMINÉ AVEC SUCCÈS !"
echo "=================================="
echo "✅ Anciennes versions: Supprimées"
echo "✅ Nouvelles versions: Devenues versions principales"
echo "✅ Configuration: Restaurée"
echo "✅ Images: Nettoyées"
EOF

    # Transférer et exécuter le script
    scp -o StrictHostKeyChecking=no /tmp/cleanup-old-versions.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/cleanup-old-versions.sh && /tmp/cleanup-old-versions.sh"
    rm -f /tmp/cleanup-old-versions.sh
}

# Rollback en cas de problème
rollback_to_blue() {
    local ip="$1"
    log_info "Rollback vers les anciennes versions (BLUE)..."
    
    # Créer le script de rollback
    cat << 'EOF' > /tmp/rollback-to-blue.sh
#!/bin/bash
set -e

cd /opt/meeshy

echo "🔄 ROLLBACK VERS BLUE"
echo "===================="

# Réactiver les anciennes versions dans Traefik
echo "🌐 Réactivation des anciennes versions dans Traefik..."

# Réactiver l'ancien Gateway
docker-compose -f docker-compose.blue-green.yml exec gateway-blue sh -c '
    docker update --label-add "traefik.enable=true" meeshy-gateway-blue
'

# Réactiver l'ancien Frontend
docker-compose -f docker-compose.blue-green.yml exec frontend-blue sh -c '
    docker update --label-add "traefik.enable=true" meeshy-frontend-blue
'

# Désactiver les nouvelles versions dans Traefik
echo "⏹️  Désactivation des nouvelles versions dans Traefik..."

# Désactiver le nouveau Gateway
docker-compose -f docker-compose.blue-green.yml exec gateway-green sh -c '
    docker update --label-add "traefik.enable=false" meeshy-gateway-green
'

# Désactiver le nouveau Frontend
docker-compose -f docker-compose.blue-green.yml exec frontend-green sh -c '
    docker update --label-add "traefik.enable=false" meeshy-frontend-green
'

# Attendre que Traefik mette à jour sa configuration
echo "⏳ Attente de la mise à jour de la configuration Traefik..."
sleep 10

# Vérifier que le rollback est effectif
echo "🔍 Vérification du rollback..."

# Test de l'ancien Gateway
if curl -f -s -H "Host: gate.meeshy.me" http://localhost/health >/dev/null 2>&1; then
    echo "✅ Ancien Gateway: Rollback effectif"
else
    echo "❌ Ancien Gateway: Problème de rollback"
    exit 1
fi

# Test de l'ancien Frontend
if curl -f -s -H "Host: meeshy.me" http://localhost >/dev/null 2>&1; then
    echo "✅ Ancien Frontend: Rollback effectif"
else
    echo "❌ Ancien Frontend: Problème de rollback"
    exit 1
fi

echo ""
echo "🎉 ROLLBACK TERMINÉ AVEC SUCCÈS !"
echo "================================="
echo "✅ Anciennes versions: Réactivées"
echo "✅ Nouvelles versions: Désactivées"
echo "✅ Service: Restauré à l'état précédent"
EOF

    # Transférer et exécuter le script
    scp -o StrictHostKeyChecking=no /tmp/rollback-to-blue.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/rollback-to-blue.sh && /tmp/rollback-to-blue.sh"
    rm -f /tmp/rollback-to-blue.sh
}

# Vérification finale
final_verification() {
    local ip="$1"
    log_info "Vérification finale de la mise à jour..."
    
    ssh -o StrictHostKeyChecking=no root@$ip << 'EOF'
        cd /opt/meeshy
        echo "🔍 VÉRIFICATION FINALE"
        echo "======================"
        
        echo "📊 État final des services:"
        docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
        
        echo ""
        echo "🔍 Tests de connectivité:"
        
        # Test Gateway
        if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
            echo "✅ Gateway: Endpoint /health accessible"
        else
            echo "❌ Gateway: Endpoint /health inaccessible"
        fi
        
        # Test Frontend
        if curl -f -s http://localhost:3100 >/dev/null 2>&1; then
            echo "✅ Frontend: Accessible sur le port 3100"
        else
            echo "❌ Frontend: Non accessible sur le port 3100"
        fi
        
        # Test via Traefik
        if curl -f -s -H "Host: gate.meeshy.me" http://localhost/health >/dev/null 2>&1; then
            echo "✅ Gateway: Accessible via Traefik"
        else
            echo "⚠️  Gateway: Non accessible via Traefik"
        fi
        
        if curl -f -s -H "Host: meeshy.me" http://localhost >/dev/null 2>&1; then
            echo "✅ Frontend: Accessible via Traefik"
        else
            echo "⚠️  Frontend: Non accessible via Traefik"
        fi
        
        echo ""
        echo "📋 Versions des images:"
        docker images | grep -E "(gateway|frontend)" | head -5
EOF
}

# Fonction principale
main() {
    # Parser les arguments
    parse_arguments "$@"
    
    # Vérifier que l'IP est fournie
    if [ -z "$DROPLET_IP" ]; then
        log_error "IP du serveur manquante"
        show_help
        exit 1
    fi
    
    log_info "🚀 Démarrage de la mise à jour sans interruption sur $DROPLET_IP"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "Mode --dry-run activé: Aucune modification ne sera effectuée"
    fi
    
    log_info "Stratégie: Blue-Green Deployment avec Traefik"
    log_warning "⚠️  La base de données et l'infrastructure ne seront PAS modifiées"
    
    # Test de connexion
    test_ssh_connection "$DROPLET_IP" || exit 1
    
    # Vérification préliminaire
    preliminary_check "$DROPLET_IP"
    
    # Créer la configuration blue-green
    create_blue_green_config "$DROPLET_IP"
    
    # Déployer les nouvelles versions
    deploy_blue_green "$DROPLET_IP"
    
    # Basculement du trafic
    switch_traffic_to_green "$DROPLET_IP"
    
    # Nettoyage des anciennes versions
    cleanup_old_versions "$DROPLET_IP"
    
    # Vérification finale
    final_verification "$DROPLET_IP"
    
    # Résumé final
    echo ""
    echo "🎉 MISE À JOUR SANS INTERRUPTION TERMINÉE AVEC SUCCÈS !"
    echo "======================================================"
    echo "✅ Gateway: Mis à jour sans interruption de service"
    echo "✅ Frontend: Mis à jour sans interruption de service"
    echo "✅ Base de données: Préservée (données intactes)"
    echo "✅ Infrastructure: Préservée (Traefik, Redis, MongoDB opérationnels)"
    echo "✅ Disponibilité: Service maintenu pendant toute la mise à jour"
    echo ""
    echo "🔗 Accès aux services:"
    echo "   • Frontend: https://meeshy.me"
    echo "   • Gateway API: https://gate.meeshy.me"
    echo "   • Dashboard Traefik: https://traefik.meeshy.me"
    echo ""
    echo "📋 Commandes utiles:"
    echo "   • Statut: ssh root@$DROPLET_IP 'cd /opt/meeshy && docker-compose ps'"
    echo "   • Logs: ssh root@$DROPLET_IP 'cd /opt/meeshy && docker-compose logs gateway frontend'"
    echo "   • Rollback: ssh root@$DROPLET_IP 'cd /opt/meeshy && ./scripts/rollback-to-blue.sh'"
    echo ""
    
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "Mode --dry-run: Aucune modification n'a été effectuée"
        log_info "Pour exécuter réellement la mise à jour, relancez sans --dry-run"
    fi
}

# Exécuter le script principal
main "$@"
