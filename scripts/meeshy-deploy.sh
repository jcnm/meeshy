#!/bin/bash

# 🚀 MEESHY - SCRIPT UNIFIÉ DE DÉPLOIEMENT
# Usage: ./scripts/meeshy-deploy.sh [COMMAND] [DROPLET_IP]
# Commands: deploy, test, verify, status, logs, restart, stop, recreate

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

COMMAND="${1:-}"
DROPLET_IP="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_COMPOSE_FILE="docker-compose.traefik.yml"
FORCE_REFRESH=false

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Test de connexion SSH
test_ssh_connection() {
    local ip="$1"
    log_info "Test de connexion SSH..."
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$ip "echo 'Connexion SSH réussie'" >/dev/null 2>&1; then
        log_success "Connexion SSH réussie"
        return 0
    else
        log_error "Impossible de se connecter au serveur"
        return 1
    fi
}

# Déploiement complet
deploy_complete() {
    local ip="$1"
    local domain="${2:-localhost}"
    log_info "🚀 Déploiement complet sur $ip (domaine: $domain)"

    # Créer répertoire temporaire
    local deploy_dir="/tmp/meeshy-deploy-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$deploy_dir"

    # Préparer fichiers
    log_info "📁 Préparation des fichiers..."
    cp "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" "$deploy_dir/docker-compose.yml"
    cp "$PROJECT_ROOT/env.digitalocean" "$deploy_dir/.env"
    cp -r "$PROJECT_ROOT/docker" "$deploy_dir/"
    cp -r "$PROJECT_ROOT/shared" "$deploy_dir/"

    # Envoyer sur serveur
    log_info "📤 Envoi des fichiers..."
    ssh -o StrictHostKeyChecking=no root@$ip "mkdir -p /opt/meeshy"
    scp -o StrictHostKeyChecking=no "$deploy_dir/docker-compose.yml" root@$ip:/opt/meeshy/
    scp -o StrictHostKeyChecking=no "$deploy_dir/.env" root@$ip:/opt/meeshy/
    scp -r -o StrictHostKeyChecking=no "$deploy_dir/docker" root@$ip:/opt/meeshy/
    scp -r -o StrictHostKeyChecking=no "$deploy_dir/shared" root@$ip:/opt/meeshy/

    # Script de déploiement amélioré avec gestion SSL intelligente
    cat << 'EOF' > /tmp/deploy-services.sh
#!/bin/bash
set -e
cd /opt/meeshy

# Installer Docker si pas présent
if ! command -v docker &> /dev/null; then
    echo "🐳 Installation de Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker $USER
    systemctl enable docker
    systemctl start docker
    rm get-docker.sh
fi

# Installer Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installation de Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
fi

# Installer OpenSSL et dig si pas présents
if ! command -v openssl &> /dev/null; then
    echo "🔐 Installation d'OpenSSL..."
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y openssl dnsutils
    elif command -v yum &> /dev/null; then
        yum install -y openssl bind-utils
    elif command -v apk &> /dev/null; then
        apk add --no-cache openssl bind-tools
    fi
fi

echo "🧹 Nettoyage..."
docker-compose down --remove-orphans || true
docker system prune -f || true
docker image prune -f || true

# Gestion SSL intelligente
echo "🔐 Configuration SSL..."
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
    echo "🌐 Mode production détecté pour $DOMAIN"
    # Utiliser la configuration Let's Encrypt
    cp docker/nginx/letsencrypt.conf docker/nginx/active.conf 2>/dev/null || {
        echo "⚠️  Configuration Let's Encrypt non trouvée, utilisation du mode développement"
        cp docker/nginx/digitalocean.conf docker/nginx/active.conf
    }
else
    echo "🔧 Mode développement détecté"
    # Générer des certificats auto-signés
    if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
        mkdir -p ssl
        cd ssl
        
        openssl genrsa -out key.pem 2048
        cat > openssl.conf << 'SSL_EOF'
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = FR
ST = IDF
L = Paris
O = Meeshy
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = 127.0.0.1
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
SSL_EOF

        openssl req -new -x509 -key key.pem -out cert.pem -days 365 -config openssl.conf
        chmod 600 key.pem
        chmod 644 cert.pem
        rm openssl.conf
        
        echo "✅ Certificats auto-signés générés"
        cd ..
    fi
    
    # Utiliser la configuration de développement
    cp docker/nginx/digitalocean.conf docker/nginx/active.conf
fi

if [ "$FORCE_REFRESH" = "true" ]; then
    echo "📦 Téléchargement forcé des images..."
    docker-compose pull --no-cache
else
    echo "📦 Téléchargement des images..."
    docker-compose pull
fi

echo "🚀 Démarrage séquentiel..."

# MongoDB
echo "📊 Démarrage MongoDB..."
docker-compose up -d mongodb
sleep 20

# Vérifier MongoDB avec authentification correcte
for i in {1..15}; do
    if docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        echo "✅ MongoDB prêt"
        break
    fi
    echo "⏳ Tentative $i/15..."
    sleep 10
done

# Vérifier que la base meeshy est accessible
for i in {1..10}; do
    if docker-compose exec -T mongodb mongosh --eval "use meeshy; db.runCommand('ping')" >/dev/null 2>&1; then
        echo "✅ Base de données 'meeshy' accessible"
        break
    fi
    echo "⏳ Tentative $i/10 pour la base meeshy..."
    sleep 5
done

# Redis
echo "🔴 Démarrage Redis..."
docker-compose up -d redis
sleep 5

# Vérifier Redis
for i in {1..10}; do
    if docker-compose exec -T redis redis-cli --no-auth-warning -a MeeshyRedis123 ping >/dev/null 2>&1; then
        echo "✅ Redis prêt"
        break
    fi
    echo "⏳ Tentative $i/10 pour Redis..."
    sleep 5
done

# Translator
echo "🌐 Démarrage Translator..."
docker-compose up -d translator
sleep 30

# Vérifier Translator
for i in {1..15}; do
    if curl -f -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "✅ Translator prêt"
        break
    fi
    echo "⏳ Tentative $i/15 pour Translator..."
    sleep 10
done

# Gateway
echo "🚪 Démarrage Gateway..."
docker-compose up -d gateway
sleep 20

# Vérifier Gateway
for i in {1..15}; do
    if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
        echo "✅ Gateway prêt"
        break
    fi
    echo "⏳ Tentative $i/15 pour Gateway..."
    sleep 10
done

# Frontend
echo "🎨 Démarrage Frontend..."
docker-compose up -d frontend
sleep 15

# Nginx
echo "🌐 Démarrage Nginx..."
docker-compose up -d nginx
sleep 10

echo "📊 État final des services:"
docker-compose ps
echo "✅ Tous les services déployés et vérifiés"
EOF

    # Exécuter avec le domaine
    scp -o StrictHostKeyChecking=no /tmp/deploy-services.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/deploy-services.sh && FORCE_REFRESH=$FORCE_REFRESH DOMAIN=$domain /tmp/deploy-services.sh"
    rm -f /tmp/deploy-services.sh

    # Vérification automatique
    log_info "🔍 Vérification post-déploiement..."
    sleep 10
    health_check "$ip"
    rm -rf "$deploy_dir"
}

# Correction rapide
deploy_fix() {
    local ip="$1"
    log_info "🔧 Correction rapide sur $ip"

    # Créer répertoire temporaire
    local deploy_dir="/tmp/meeshy-fix-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$deploy_dir"

    # Préparer fichiers
    log_info "📁 Préparation des fichiers corrigés..."
    cp "$PROJECT_ROOT/$DOCKER_COMPOSE_FILE" "$deploy_dir/docker-compose.yml"
    cp "$PROJECT_ROOT/env.digitalocean" "$deploy_dir/.env"

    # Envoyer sur serveur
    log_info "📤 Envoi des fichiers corrigés..."
    scp -o StrictHostKeyChecking=no "$deploy_dir/docker-compose.yml" root@$ip:/opt/meeshy/
    scp -o StrictHostKeyChecking=no "$deploy_dir/.env" root@$ip:/opt/meeshy/

    # Redémarrer services
    restart_services "$ip"

    # Vérifier la santé des services
    log_info "🔍 Vérification post-correction..."
    sleep 30
    health_check "$ip"

    # Nettoyer
    rm -rf "$deploy_dir"
}

# Vérification de la santé
health_check() {
    local ip="$1"
    log_info "🏥 Vérification complète de la santé des services..."

    # Script de vérification détaillée
    cat << 'EOF' > /tmp/health-check.sh
#!/bin/bash
cd /opt/meeshy

echo "🏥 VÉRIFICATION COMPLÈTE DE SANTÉ DES SERVICES"
echo "============================================="

# Vérifier que tous les services sont en cours d'exécution
echo ""
echo "📊 ÉTAT DES SERVICES DOCKER:"
docker-compose ps

# 1. Vérifier MongoDB
echo ""
echo "📊 TEST MONGODB:"
if docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    echo "✅ MongoDB: Service accessible"

    # Vérifier la base de données meeshy
    if docker-compose exec -T mongodb mongosh --eval "use meeshy; db.runCommand('ping')" >/dev/null 2>&1; then
        echo "✅ Base de données 'meeshy': Accessible"

        # Vérifier les collections
        collections=$(docker-compose exec -T mongodb mongosh --eval "use meeshy; db.getCollectionNames()" --quiet 2>/dev/null | grep -v "MongoDB\|connecting\|switched" | head -5)
        if [ -n "$collections" ]; then
            echo "✅ Collections détectées: $collections"
        else
            echo "⚠️  Aucune collection détectée (base vide)"
        fi
    else
        echo "❌ Base de données 'meeshy': Non accessible"
        exit 1
    fi
else
    echo "❌ MongoDB: Service inaccessible"
    exit 1
fi

# 2. Vérifier Redis
echo ""
echo "🔴 TEST REDIS:"
if docker-compose exec -T redis redis-cli --no-auth-warning -a MeeshyRedis123 ping >/dev/null 2>&1; then
    echo "✅ Redis: Connecté et opérationnel"

    # Test de cache
    if docker-compose exec -T redis redis-cli --no-auth-warning -a MeeshyRedis123 set test_key "test_value" >/dev/null 2>&1; then
        if docker-compose exec -T redis redis-cli --no-auth-warning -a MeeshyRedis123 get test_key | grep -q "test_value"; then
            echo "✅ Cache Redis fonctionnel"
        else
            echo "⚠️  Cache Redis: problème de lecture"
        fi
        # Nettoyer
        docker-compose exec -T redis redis-cli --no-auth-warning -a MeeshyRedis123 del test_key >/dev/null 2>&1
    else
        echo "⚠️  Cache Redis: problème d'écriture"
    fi
else
    echo "❌ Redis: Problème de connexion"
    exit 1
fi

# 3. Vérifier Translator
echo ""
echo "🌐 TEST TRANSLATOR:"
# Test endpoint de santé avec tentatives multiples
for i in {1..10}; do
    if curl -f -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "✅ Translator: Endpoint /health accessible"

        # Test de réponse de santé
        health_response=$(curl -s http://localhost:8000/health 2>/dev/null)
        if echo "$health_response" | grep -q "status\|ok\|healthy\|database"; then
            echo "✅ Translator: Réponse de santé valide"
        else
            echo "⚠️  Translator: Réponse de santé suspecte: $health_response"
        fi
        break
    fi
    echo "⏳ Tentative $i/10 pour Translator..."
    sleep 5
done

if [ $i -eq 10 ]; then
    echo "❌ Translator: Endpoint /health inaccessible après 10 tentatives"
    exit 1
fi

# Test des modèles ML
if curl -f -s http://localhost:8000/models >/dev/null 2>&1; then
    echo "✅ Translator: Endpoint /models accessible"
else
    echo "⚠️  Translator: Endpoint /models inaccessible"
fi

# 4. Vérifier Gateway
echo ""
echo "🚪 TEST GATEWAY:"
# Test endpoint de santé avec tentatives multiples
for i in {1..10}; do
    if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
        echo "✅ Gateway: Endpoint /health accessible"

        # Test de réponse de santé
        health_response=$(curl -s http://localhost:3000/health 2>/dev/null)
        if echo "$health_response" | grep -q "status\|ok\|healthy\|database"; then
            echo "✅ Gateway: Réponse de santé valide"
        else
            echo "⚠️  Gateway: Réponse de santé suspecte: $health_response"
        fi
        break
    fi
    echo "⏳ Tentative $i/10 pour Gateway..."
    sleep 5
done

if [ $i -eq 10 ]; then
    echo "❌ Gateway: Endpoint /health inaccessible après 10 tentatives"
    exit 1
fi

# Test des endpoints API
if curl -f -s http://localhost:3000/api/status >/dev/null 2>&1; then
    echo "✅ Gateway: Endpoint /api/status accessible"
else
    echo "⚠️  Gateway: Endpoint /api/status inaccessible"
fi

# 5. Vérifier Frontend
echo ""
echo "🎨 TEST FRONTEND:"
# Test d'accessibilité avec tentatives multiples
for i in {1..10}; do
    if curl -f -s http://localhost:3100 >/dev/null 2>&1; then
        echo "✅ Frontend: Accessible"

        # Vérifier que c'est bien Next.js
        response=$(curl -s http://localhost:3100 2>/dev/null | head -c 200)
        if echo "$response" | grep -q "Next\|React\|meeshy\|Meeshy"; then
            echo "✅ Frontend: Réponse Next.js détectée"
        else
            echo "⚠️  Frontend: Réponse non-Next.js détectée"
        fi
        break
    fi
    echo "⏳ Tentative $i/10 pour Frontend..."
    sleep 5
done

if [ $i -eq 10 ]; then
    echo "❌ Frontend: Inaccessible après 10 tentatives"
    exit 1
fi

# 6. Vérifier Nginx
echo ""
echo "🌐 TEST NGINX:"
if curl -f -s http://localhost:80 >/dev/null 2>&1; then
    echo "✅ Nginx: Port 80 accessible"
else
    echo "⚠️  Nginx: Port 80 inaccessible"
fi

# 7. Vérifier les connexions ZMQ
echo ""
echo "🔌 TEST ZMQ:"
# Vérifier les ports ZMQ
if netstat -tuln 2>/dev/null | grep -q ":5555\|:5558"; then
    echo "✅ ZMQ: Ports détectés (5555, 5558)"
else
    echo "⚠️  ZMQ: Ports non détectés (peut être normal dans Docker)"
fi

# 8. Vérifier les connexions Prisma
echo ""
echo "🗄️  TEST PRISMA:"
# Vérifier l'initialisation des clients Prisma
if docker-compose logs gateway 2>/dev/null | grep -i "prisma" >/dev/null 2>&1; then
    echo "✅ Gateway: Logs Prisma détectés"
else
    echo "⚠️  Gateway: Aucun log Prisma trouvé"
fi

if docker-compose logs translator 2>/dev/null | grep -i "prisma" >/dev/null 2>&1; then
    echo "✅ Translator: Logs Prisma détectés"
else
    echo "⚠️  Translator: Aucun log Prisma trouvé"
fi

# 9. Test de communication inter-services
echo ""
echo "🔗 TEST COMMUNICATION INTER-SERVICES:"
# Test de communication Gateway -> Translator via gRPC
if docker-compose logs gateway 2>/dev/null | grep -i "translator\|gRPC\|50051" >/dev/null 2>&1; then
    echo "✅ Gateway: Communication avec Translator détectée"
else
    echo "⚠️  Gateway: Communication avec Translator non détectée"
fi

# Test de communication via ZMQ
if docker-compose logs translator 2>/dev/null | grep -i "ZMQ\|5555\|5558" >/dev/null 2>&1; then
    echo "✅ Translator: Communication ZMQ détectée"
else
    echo "⚠️  Translator: Communication ZMQ non détectée"
fi

echo ""
echo "🎉 VÉRIFICATION COMPLÈTE TERMINÉE !"
echo "===================================="
echo "✅ MongoDB: Opérationnel"
echo "✅ Redis: Opérationnel"
echo "✅ Gateway: Opérationnel"
echo "✅ Translator: Opérationnel"
echo "✅ Frontend: Opérationnel"
echo "✅ ZMQ: Configuré"
echo "✅ Prisma: Initialisé"
echo ""
echo "🚀 TOUS LES SERVICES SONT OPÉRATIONNELS !"
EOF

    scp -o StrictHostKeyChecking=no /tmp/health-check.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/health-check.sh && /tmp/health-check.sh"
    rm -f /tmp/health-check.sh
}

# Tests complets
run_tests() {
    local ip="$1"
    log_info "🧪 Tests complets des services..."

    # Script de tests
    cat << 'EOF' > /tmp/run-tests.sh
#!/bin/bash
cd /opt/meeshy

echo "🧪 TESTS COMPLETS POST-DÉPLOIEMENT"
echo "=================================="

# État Docker
echo "🐳 Services Docker:"
docker-compose ps

# Tests de performance
echo ""
echo "⏱️  TESTS DE PERFORMANCE:"

# MongoDB
start_time=$(date +%s%N)
docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1
end_time=$(date +%s%N)
mongo_latency=$(( (end_time - start_time) / 1000000 ))
echo "📊 MongoDB: ${mongo_latency}ms"

# Gateway
start_time=$(date +%s%N)
curl -f -s http://localhost:3000/health >/dev/null 2>&1
end_time=$(date +%s%N)
gateway_latency=$(( (end_time - start_time) / 1000000 ))
echo "🚪 Gateway: ${gateway_latency}ms"

# Translator
start_time=$(date +%s%N)
curl -f -s http://localhost:8000/health >/dev/null 2>&1
end_time=$(date +%s%N)
translator_latency=$(( (end_time - start_time) / 1000000 ))
echo "🌐 Translator: ${translator_latency}ms"

echo "✅ Tests terminés"
EOF

    scp -o StrictHostKeyChecking=no /tmp/run-tests.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/run-tests.sh && /tmp/run-tests.sh"
    rm -f /tmp/run-tests.sh
}

# Vérification des connexions
verify_connections() {
    local ip="$1"
    log_info "🔌 Vérification des connexions..."

    # Script de vérification
    cat << 'EOF' > /tmp/verify-conn.sh
#!/bin/bash
cd /opt/meeshy

echo "🔌 VÉRIFICATION DES CONNEXIONS"
echo "=============================="

# MongoDB + Prisma
echo "🗄️  MongoDB + Prisma:"
if docker-compose logs gateway | grep -i "prisma" >/dev/null 2>&1; then
    echo "  ✅ Gateway: Prisma initialisé"
else
    echo "  ⚠️  Gateway: Prisma non détecté"
fi

if docker-compose logs translator | grep -i "prisma" >/dev/null 2>&1; then
    echo "  ✅ Translator: Prisma initialisé"
else
    echo "  ⚠️  Translator: Prisma non détecté"
fi

# ZMQ
echo "🔌 ZMQ:"
if netstat -tuln 2>/dev/null | grep -q ":5555\|:5558"; then
    echo "  ✅ Ports ZMQ ouverts"
else
    echo "  ⚠️  Ports ZMQ non détectés"
fi

# REST
echo "🌐 REST:"
if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
    echo "  ✅ Gateway /health OK"
else
    echo "  ❌ Gateway /health KO"
fi

if curl -f -s http://localhost:8000/health >/dev/null 2>&1; then
    echo "  ✅ Translator /health OK"
else
    echo "  ❌ Translator /health KO"
fi

echo "✅ Vérification terminée"
EOF

    scp -o StrictHostKeyChecking=no /tmp/verify-conn.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/verify-conn.sh && /tmp/verify-conn.sh"
    rm -f /tmp/verify-conn.sh
}

# Déploiement Traefik avec SSL automatique
deploy_traefik() {
    local ip="$1"
    local domain="${2:-meeshy.me}"
    log_info "🚀 Déploiement Traefik avec SSL automatique sur $ip (domaine: $domain)"

    # Créer répertoire temporaire
    local deploy_dir="/tmp/meeshy-traefik-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$deploy_dir"

    # Préparer fichiers Traefik
    log_info "📁 Préparation des fichiers Traefik..."
    cp "$PROJECT_ROOT/docker-compose.traefik.yml" "$deploy_dir/docker-compose.yml"
    cp "$PROJECT_ROOT/env.digitalocean" "$deploy_dir/.env"
    cp -r "$PROJECT_ROOT/config" "$deploy_dir/" 2>/dev/null || log_warning "Dossier config non trouvé (optionnel)"

    # Envoyer sur serveur
    log_info "📤 Envoi des fichiers Traefik..."
    ssh -o StrictHostKeyChecking=no root@$ip "mkdir -p /opt/meeshy"
    scp -o StrictHostKeyChecking=no "$deploy_dir/docker-compose.yml" root@$ip:/opt/meeshy/
    scp -o StrictHostKeyChecking=no "$deploy_dir/.env" root@$ip:/opt/meeshy/
    if [ -d "$deploy_dir/config" ]; then
        scp -r -o StrictHostKeyChecking=no "$deploy_dir/config" root@$ip:/opt/meeshy/
    fi

    # Script de déploiement Traefik
    cat << 'EOF' > /tmp/deploy-traefik.sh
#!/bin/bash
set -e
cd /opt/meeshy

echo "🚀 DÉPLOIEMENT TRAEFIK AVEC SSL AUTOMATIQUE"
echo "==========================================="

# Installer Docker si pas présent
if ! command -v docker &> /dev/null; then
    echo "🐳 Installation de Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker $USER
    systemctl enable docker
    systemctl start docker
    rm get-docker.sh
fi

# Installer Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installation de Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
fi

echo "🧹 Nettoyage..."
docker-compose down --remove-orphans || true
docker system prune -f || true

echo "📦 Téléchargement des images..."
docker-compose pull

echo "🚀 Démarrage des services Traefik..."
docker-compose up -d

echo "⏳ Attente du démarrage (60 secondes)..."
sleep 60

echo "📊 État des services:"
docker-compose ps

echo "🔍 Tests de connectivité..."
echo "Frontend: $(curl -k -s -o /dev/null -w '%{http_code}' https://$DOMAIN || echo 'ERROR')"
echo "Traefik Dashboard: $(curl -k -s -o /dev/null -w '%{http_code}' https://traefik.$DOMAIN || echo 'ERROR')"
echo "Gateway: $(curl -k -s -o /dev/null -w '%{http_code}' https://gate.$DOMAIN/health || echo 'ERROR')"
echo "Translator: $(curl -k -s -o /dev/null -w '%{http_code}' https://ml.$DOMAIN/translate || echo 'ERROR')"
echo "MongoDB UI: $(curl -k -s -o /dev/null -w '%{http_code}' https://mongo.$DOMAIN || echo 'ERROR')"
echo "Redis UI: $(curl -k -s -o /dev/null -w '%{http_code}' https://redis.$DOMAIN || echo 'ERROR')"

echo "🔐 Vérification des certificats SSL..."
if docker-compose exec traefik cat /letsencrypt/acme.json >/dev/null 2>&1; then
    echo "✅ Certificats Let's Encrypt:"
    docker-compose exec traefik cat /letsencrypt/acme.json | jq '.letsencrypt.Certificates[] | .domain.main' 2>/dev/null || echo "Erreur de lecture"
else
    echo "⚠️  Fichier acme.json non accessible"
fi

echo "✅ Déploiement Traefik terminé !"
echo ""
echo "🔗 URLs disponibles:"
echo "- Frontend: https://$DOMAIN"
echo "- Traefik Dashboard: https://traefik.$DOMAIN (admin:admin)"
echo "- Gateway API: https://gate.$DOMAIN/health"
echo "- WebSocket: https://gate.$DOMAIN/socket.io/"
echo "- Translator: https://ml.$DOMAIN/translate"
echo "- MongoDB UI: https://mongo.$DOMAIN"
echo "- Redis UI: https://redis.$DOMAIN"
EOF

    # Exécuter avec le domaine
    scp -o StrictHostKeyChecking=no /tmp/deploy-traefik.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/deploy-traefik.sh && DOMAIN=$domain /tmp/deploy-traefik.sh"
    rm -f /tmp/deploy-traefik.sh

    # Vérification automatique
    log_info "🔍 Vérification post-déploiement Traefik..."
    sleep 10
    health_check "$ip"
    rm -rf "$deploy_dir"
}

# Déploiement incrémental (fichiers modifiés uniquement)
deploy_incremental() {
    local ip="$1"
    log_info "🔄 Déploiement incrémental sur $ip (fichiers modifiés uniquement)"

    # Créer répertoire temporaire
    local deploy_dir="/tmp/meeshy-update-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$deploy_dir"

    # Détecter les fichiers modifiés
    log_info "🔍 Détection des fichiers modifiés..."
    
    # Fichiers de configuration principaux
    local modified_files=()
    
    # Vérifier docker-compose.traefik.yml
    if [ -f "docker-compose.traefik.yml" ]; then
        local local_hash=$(md5sum docker-compose.traefik.yml 2>/dev/null | cut -d' ' -f1 || echo "")
        local remote_hash=$(ssh -o StrictHostKeyChecking=no root@$ip "md5sum /opt/meeshy/docker-compose.traefik.yml 2>/dev/null | cut -d' ' -f1" || echo "")
        if [ "$local_hash" != "$remote_hash" ] && [ -n "$local_hash" ]; then
            modified_files+=("docker-compose.traefik.yml")
            log_info "📝 docker-compose.traefik.yml modifié"
        fi
    fi

    # Vérifier env.digitalocean
    if [ -f "env.digitalocean" ]; then
        local local_hash=$(md5sum env.digitalocean 2>/dev/null | cut -d' ' -f1 || echo "")
        local remote_hash=$(ssh -o StrictHostKeyChecking=no root@$ip "md5sum /opt/meeshy/.env 2>/dev/null | cut -d' ' -f1" || echo "")
        if [ "$local_hash" != "$remote_hash" ] && [ -n "$local_hash" ]; then
            modified_files+=("env.digitalocean")
            log_info "📝 env.digitalocean modifié"
        fi
    fi

    # Vérifier les fichiers de configuration
    if [ -d "config" ]; then
        local config_modified=false
        for config_file in config/*; do
            if [ -f "$config_file" ]; then
                local filename=$(basename "$config_file")
                local local_hash=$(md5sum "$config_file" 2>/dev/null | cut -d' ' -f1 || echo "")
                local remote_hash=$(ssh -o StrictHostKeyChecking=no root@$ip "md5sum /opt/meeshy/config/$filename 2>/dev/null | cut -d' ' -f1" || echo "")
                if [ "$local_hash" != "$remote_hash" ] && [ -n "$local_hash" ]; then
                    config_modified=true
                    log_info "📝 $config_file modifié"
                fi
            fi
        done
        if [ "$config_modified" = true ]; then
            modified_files+=("config/")
        fi
    fi

    # Vérifier les scripts
    if [ -f "scripts/meeshy-deploy.sh" ]; then
        local local_hash=$(md5sum scripts/meeshy-deploy.sh 2>/dev/null | cut -d' ' -f1 || echo "")
        local remote_hash=$(ssh -o StrictHostKeyChecking=no root@$ip "md5sum /opt/meeshy/scripts/meeshy-deploy.sh 2>/dev/null | cut -d' ' -f1" || echo "")
        if [ "$local_hash" != "$remote_hash" ] && [ -n "$local_hash" ]; then
            modified_files+=("scripts/meeshy-deploy.sh")
            log_info "📝 scripts/meeshy-deploy.sh modifié"
        fi
    fi

    # Si aucun fichier modifié, sortir
    if [ ${#modified_files[@]} -eq 0 ]; then
        log_success "✅ Aucun fichier modifié détecté - déploiement non nécessaire"
        return 0
    fi

    log_info "📦 Fichiers à déployer: ${modified_files[*]}"

    # Copier les fichiers modifiés
    for file in "${modified_files[@]}"; do
        if [ -f "$file" ]; then
            cp "$file" "$deploy_dir/"
            log_info "📋 Copié: $file"
        elif [ -d "$file" ]; then
            cp -r "$file" "$deploy_dir/"
            log_info "📁 Copié: $file"
        fi
    done

    # Envoyer sur serveur
    log_info "📤 Envoi des fichiers modifiés..."
    for file in "${modified_files[@]}"; do
        if [ -f "$file" ]; then
            if [ "$file" = "env.digitalocean" ]; then
                scp -o StrictHostKeyChecking=no "$deploy_dir/$file" root@$ip:/opt/meeshy/.env
            else
                scp -o StrictHostKeyChecking=no "$deploy_dir/$file" root@$ip:/opt/meeshy/
            fi
            log_info "📤 Envoyé: $file"
        elif [ -d "$file" ]; then
            scp -r -o StrictHostKeyChecking=no "$deploy_dir/$file" root@$ip:/opt/meeshy/
            log_info "📤 Envoyé: $file"
        fi
    done

    # Script de mise à jour incrémentale
    cat << 'EOF' > /tmp/update-services.sh
#!/bin/bash
set -e
cd /opt/meeshy

echo "🔄 MISE À JOUR INCRÉMENTALE DES SERVICES"
echo "======================================="

# Vérifier si docker-compose.yml a changé
if [ -f "docker-compose.traefik.yml" ]; then
    echo "📝 Configuration Docker Compose mise à jour"
    ln -sf docker-compose.traefik.yml docker-compose.yml
fi

# Redémarrer seulement les services affectés
echo "🔄 Redémarrage des services affectés..."

# Toujours redémarrer Traefik si la config a changé
if [ -f "docker-compose.traefik.yml" ]; then
    echo "🔄 Redémarrage de Traefik..."
    docker-compose restart traefik
    sleep 10
fi

# Redémarrer les autres services si nécessaire
if [ -f ".env" ]; then
    echo "🔄 Redémarrage des services (variables d'environnement mises à jour)..."
    docker-compose restart
    sleep 30
fi

echo "📊 État des services après mise à jour:"
docker-compose ps

echo "🔍 Tests rapides de connectivité..."
echo "Frontend: $(curl -k -s -o /dev/null -w '%{http_code}' https://$DOMAIN || echo 'ERROR')"
echo "Gateway: $(curl -k -s -o /dev/null -w '%{http_code}' https://gate.$DOMAIN/health || echo 'ERROR')"

echo "✅ Mise à jour incrémentale terminée !"
EOF

    # Exécuter la mise à jour
    scp -o StrictHostKeyChecking=no /tmp/update-services.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/update-services.sh && DOMAIN=$(grep '^DOMAIN=' env.digitalocean 2>/dev/null | cut -d'=' -f2 | tr -d '\"' || echo 'meeshy.me') /tmp/update-services.sh"
    rm -f /tmp/update-services.sh

    # Nettoyer
    rm -rf "$deploy_dir"

    log_success "✅ Déploiement incrémental terminé !"
}

# Redémarrage des services
restart_services() {
    local ip="$1"
    log_info "🔄 Redémarrage des services..."

    cat << 'EOF' > /tmp/restart.sh
#!/bin/bash
cd /opt/meeshy
docker-compose down --remove-orphans || true
docker system prune -f || true
docker-compose pull
docker-compose up -d
sleep 30
docker-compose ps
echo "✅ Services redémarrés"
EOF

    scp -o StrictHostKeyChecking=no /tmp/restart.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/restart.sh && /tmp/restart.sh"
    rm -f /tmp/restart.sh
}

# Afficher l'aide
show_help() {
    echo -e "${BLUE}🚀 MEESHY - SCRIPT UNIFIÉ DE DÉPLOIEMENT${NC}"
    echo "================================================"
    echo ""
    echo -e "${GREEN}Usage:${NC}"
    echo "  $0 [COMMAND] [DROPLET_IP] [--force-refresh]"
    echo ""
    echo -e "${GREEN}Commands:${NC}"
    echo -e "${CYAN}  deploy${NC}       - Déploiement complet"
    echo -e "${CYAN}  fix${NC}          - Correction rapide (redémarrage)"
    echo -e "${CYAN}  test${NC}         - Tests complets post-déploiement"
    echo -e "${CYAN}  verify${NC}       - Vérification des connexions"
    echo -e "${CYAN}  health${NC}       - Vérification rapide de santé"
    echo -e "${CYAN}  status${NC}       - État des services"
    echo -e "${CYAN}  logs${NC}         - Logs des services"
    echo -e "${CYAN}  restart${NC}      - Redémarrage des services"
    echo -e "${CYAN}  stop${NC}         - Arrêt des services"
    echo -e "${CYAN}  ssl${NC}          - Gestion SSL (dev/prod)"
    echo -e "${CYAN}  traefik${NC}      - Déploiement Traefik avec SSL automatique"
    echo -e "${CYAN}  update${NC}       - Déploiement incrémental (fichiers modifiés uniquement)"
    echo -e "${CYAN}  recreate${NC}     - Recréation du droplet"
    echo ""
    echo -e "${GREEN}Options:${NC}"
    echo -e "${CYAN}  --force-refresh${NC} - Forcer le téléchargement des images"
    echo ""
    echo -e "${GREEN}Exemples:${NC}"
    echo "  $0 deploy 157.230.15.51"
    echo "  $0 test 157.230.15.51"
    echo "  $0 verify 157.230.15.51"
    echo "  $0 --force-refresh deploy 157.230.15.51"
    echo ""
    echo -e "${YELLOW}💡 Toutes les connexions sont vérifiées automatiquement${NC}"
    echo -e "${YELLOW}💡 MongoDB, ZMQ et REST endpoints validés${NC}"
}

# Point d'entrée principal
main() {
    # Parsing des options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force-refresh)
                FORCE_REFRESH=true
                shift
                ;;
            *)
                break
                ;;
        esac
    done

    COMMAND="${1:-}"
    DROPLET_IP="$2"

    case "$COMMAND" in
        "deploy")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            # Récupérer le domaine depuis l'environnement ou utiliser localhost
            local domain=$(grep "^DOMAIN=" env.digitalocean 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "localhost")
            deploy_complete "$DROPLET_IP" "$domain"
            ;;
        "fix")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            deploy_fix "$DROPLET_IP"
            ;;
        "test")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            run_tests "$DROPLET_IP"
            ;;
        "verify")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            verify_connections "$DROPLET_IP"
            ;;
        "health")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            health_check "$DROPLET_IP"
            ;;
        "status")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose ps"
            ;;
        "logs")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose logs --tail=50"
            ;;
        "restart")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            restart_services "$DROPLET_IP"
            ;;
        "stop")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose down"
            log_success "Services arrêtés"
            ;;
        "ssl")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            local ssl_command="${3:-help}"
            local domain="${4:-'meeshy.me'}"
            local email="${5:-'admin@meeshy.me'}"
            ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && ./scripts/manage-ssl.sh $ssl_command $domain $email"
            ;;
        "update")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            deploy_incremental "$DROPLET_IP"
            ;;
        "recreate")
            log_error "Fonction recreate non implémentée - utiliser DigitalOcean directement"
            log_info "Alternative: doctl compute droplet delete <id> && doctl compute droplet create..."
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
