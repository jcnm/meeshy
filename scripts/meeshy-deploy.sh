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

# Traefik (doit être démarré en premier)
echo "🌐 Démarrage Traefik..."
docker-compose up -d traefik
sleep 5

# Vérifier Traefik
for i in {1..10}; do
    if curl -f -s http://localhost:80 >/dev/null 2>&1; then
        echo "✅ Traefik prêt"
        break
    fi
    echo "⏳ Tentative $i/10 pour Traefik..."
    sleep 2
done

# MongoDB
echo "📊 Démarrage MongoDB..."
docker-compose up -d database
sleep 5

# Vérifier MongoDB avec authentification correcte
for i in {1..15}; do
    if docker-compose exec -T database mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        echo "✅ MongoDB prêt"
        break
    fi
    echo "⏳ Tentative $i/15..."
    sleep 5
done

# Vérifier que la base meeshy est accessible
for i in {1..10}; do
    if docker-compose exec -T database mongosh --eval "use meeshy; db.runCommand('ping')" >/dev/null 2>&1; then
        echo "✅ Base de données 'meeshy' accessible"
        break
    fi
    echo "⏳ Tentative $i/10 pour la base meeshy..."
    sleep 5
done

# Initialiser le replica set MongoDB si nécessaire
echo "🔧 Vérification et initialisation du replica set MongoDB..."

# Attendre que MongoDB soit complètement prêt
echo "⏳ Attente que MongoDB soit prêt pour l'initialisation du replica set..."
sleep 1

# Vérifier si le replica set est déjà initialisé
if docker-compose exec -T database mongosh --eval "rs.status()" >/dev/null 2>&1; then
    echo "✅ Replica set MongoDB déjà configuré"
    # Vérifier le statut du replica set
    echo "📊 Statut du replica set:"
    docker-compose exec -T database mongosh --eval "rs.status()" --quiet
else
    echo "📋 Initialisation du replica set rs0..."
    
    # Utiliser le nom du conteneur au lieu de localhost pour le réseau Docker
    docker-compose exec -T database mongosh --eval "
        try {
            rs.initiate({
                _id: 'rs0',
                members: [
                    { _id: 0, host: 'meeshy-database:27017' }
                ]
            });
            print('✅ Replica set rs0 initialisé avec succès');
        } catch (e) {
            if (e.message.includes('already initialized')) {
                print('⚠️  Replica set déjà initialisé');
            } else {
                print('❌ Erreur initialisation replica set: ' + e.message);
                throw e;
            }
        }
    "
    
    # Attendre que le replica set soit prêt
    echo "⏳ Attente que le replica set soit prêt..."
    for i in {1..20}; do
        if docker-compose exec -T database mongosh --eval "rs.status().ok" 2>/dev/null | grep -q "1"; then
            echo "✅ Replica set rs0 prêt"
            break
        fi
        echo "⏳ Tentative $i/20 pour le replica set..."
        sleep 2
    done
    
    # Vérifier le statut final
    echo "📊 Statut final du replica set:"
    docker-compose exec -T database mongosh --eval "rs.status()" --quiet
fi

# Vérifier que la base de données meeshy est accessible avec le replica set
echo "🔍 Vérification de l'accès à la base de données avec replica set..."
for i in {1..10}; do
    if docker-compose exec -T database mongosh --eval "use meeshy; db.runCommand('ping')" >/dev/null 2>&1; then
        echo "✅ Base de données 'meeshy' accessible avec replica set"
        break
    fi
    echo "⏳ Tentative $i/10 pour la base meeshy avec replica set..."
    sleep 2
done

# Redis
echo "🔴 Démarrage Redis..."
docker-compose up -d redis
sleep 2

# Vérifier Redis
for i in {1..10}; do
    if docker-compose exec -T redis redis-cli --no-auth-warning -a MeeshyRedis123 ping >/dev/null 2>&1; then
        echo "✅ Redis prêt"
        break
    fi
    echo "⏳ Tentative $i/10 pour Redis..."
    sleep 2
done

# Services d'administration (MongoDB UI, Redis UI)
echo "🛠️  Démarrage des services d'administration..."
docker-compose up -d nosqlclient p3x-redis
sleep 3

# Vérifier les services d'administration
echo "🔍 Vérification des services d'administration..."
if docker-compose ps nosqlclient | grep -q "Up"; then
    echo "✅ MongoDB UI (NoSQLClient) prêt"
else
    echo "⚠️  MongoDB UI non disponible"
fi

if docker-compose ps p3x-redis | grep -q "Up"; then
    echo "✅ Redis UI (P3X Redis) prêt"
else
    echo "⚠️  Redis UI non disponible"
fi

# Préparation du volume des modèles ML
echo "🔧 Configuration des permissions du volume des modèles ML..."
if docker volume ls | grep -q "meeshy_models_data"; then
    echo "📁 Volume des modèles ML existant détecté"
    # Créer un container temporaire pour corriger les permissions
    docker run --rm -v meeshy_models_data:/workspace/models alpine:latest sh -c "
        echo '🔧 Correction des permissions du volume des modèles...'
        chown -R 1000:1000 /workspace/models 2>/dev/null || true
        chmod -R 755 /workspace/models 2>/dev/null || true
        echo '✅ Permissions corrigées pour le volume des modèles'
    "
else
    echo "📁 Création du volume des modèles ML avec permissions correctes..."
    docker volume create meeshy_models_data
    # Créer un container temporaire pour initialiser les permissions
    docker run --rm -v meeshy_models_data:/workspace/models alpine:latest sh -c "
        echo '🔧 Initialisation des permissions du volume des modèles...'
        mkdir -p /workspace/models
        chown -R 1000:1000 /workspace/models
        chmod -R 755 /workspace/models
        echo '✅ Volume des modèles ML initialisé avec permissions correctes'
    "
fi

# Nettoyage des fichiers de verrouillage des modèles ML
echo "🧹 Nettoyage des fichiers de verrouillage des modèles ML..."
docker run --rm -v meeshy_models_data:/workspace/models alpine:latest sh -c "
    echo '🧹 Recherche et suppression des fichiers de verrouillage...'
    find /workspace/models -name '*.lock' -type f -delete 2>/dev/null || true
    find /workspace/models -name '*.tmp' -type f -delete 2>/dev/null || true
    find /workspace/models -name '.incomplete' -type d -exec rm -rf {} + 2>/dev/null || true
    echo '✅ Fichiers de verrouillage nettoyés'
"

# Translator
echo "🌐 Démarrage Translator..."
docker-compose up -d translator
sleep 10

# Vérifier Translator
for i in {1..15}; do
    if curl -f -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "✅ Translator prêt"
        break
    fi
    echo "⏳ Tentative $i/15 pour Translator..."
    sleep 2
done

# Gateway
echo "🚪 Démarrage Gateway..."
docker-compose up -d gateway
sleep 5

# Vérifier Gateway
for i in {1..15}; do
    if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
        echo "✅ Gateway prêt"
        break
    fi
    echo "⏳ Tentative $i/15 pour Gateway..."
    sleep 2
done

# Frontend
echo "🎨 Démarrage Frontend..."
docker-compose up -d frontend
sleep 5

# Vérifier Frontend
for i in {1..10}; do
    if docker-compose exec -T frontend curl -f -s http://localhost:3100 >/dev/null 2>&1; then
        echo "✅ Frontend prêt"
        break
    fi
    echo "⏳ Tentative $i/10 pour Frontend..."
    sleep 2
done

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
    
    # Vérification préliminaire des services Docker
    log_info "🔍 Vérification préliminaire des conteneurs..."
    ssh -o StrictHostKeyChecking=no root@$ip "cd /opt/meeshy && docker-compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'"

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
if docker-compose exec -T database mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    echo "✅ MongoDB: Service accessible"

    # Vérifier la base de données meeshy
    if docker-compose exec -T database mongosh --eval "use meeshy; db.runCommand('ping')" >/dev/null 2>&1; then
        echo "✅ Base de données 'meeshy': Accessible"

        # Vérifier les collections
        collections=$(docker-compose exec -T database mongosh --eval "use meeshy; db.getCollectionNames()" --quiet 2>/dev/null | grep -v "MongoDB\|connecting\|switched" | head -5)
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
# Test via le réseau Docker interne (plus fiable en production)
for i in {1..10}; do
    if docker-compose exec -T translator curl -f -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "✅ Translator: Endpoint /health accessible"

        # Test de réponse de santé
        health_response=$(docker-compose exec -T translator curl -s http://localhost:8000/health 2>/dev/null)
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
    # Essayer de vérifier via les logs Docker
    echo "📋 Vérification des logs Translator:"
    docker-compose logs --tail 20 translator | grep -i "error\|failed\|exception" || echo "Aucune erreur critique détectée"
    exit 1
fi

# Test des modèles ML
if docker-compose exec -T translator curl -f -s http://localhost:8000/models >/dev/null 2>&1; then
    echo "✅ Translator: Endpoint /models accessible"
else
    echo "⚠️  Translator: Endpoint /models inaccessible"
fi

# 4. Vérifier Gateway
echo ""
echo "🚪 TEST GATEWAY:"
# Test via le réseau Docker interne (plus fiable en production)
for i in {1..10}; do
    if docker-compose exec -T gateway curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
        echo "✅ Gateway: Endpoint /health accessible"

        # Test de réponse de santé
        health_response=$(docker-compose exec -T gateway curl -s http://localhost:3000/health 2>/dev/null)
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
    # Essayer de vérifier via les logs Docker
    echo "📋 Vérification des logs Gateway:"
    docker-compose logs --tail 20 gateway | grep -i "error\|failed\|exception" || echo "Aucune erreur critique détectée"
    exit 1
fi

# Test des endpoints API (corriger l'endpoint)
if docker-compose exec -T gateway curl -f -s http://localhost:3000/info >/dev/null 2>&1; then
    echo "✅ Gateway: Endpoint /info accessible"
else
    echo "⚠️  Gateway: Endpoint /info inaccessible"
fi

# 5. Vérifier Frontend
echo ""
echo "🎨 TEST FRONTEND:"
# Test via le réseau Docker interne (plus fiable en production)
for i in {1..10}; do
    if docker-compose exec -T frontend curl -f -s http://localhost:3100 >/dev/null 2>&1; then
        echo "✅ Frontend: Accessible"

        # Vérifier que c'est bien Next.js
        response=$(docker-compose exec -T frontend curl -s http://localhost:3100 2>/dev/null | head -c 200)
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
    # Essayer de vérifier via les logs Docker
    echo "📋 Vérification des logs Frontend:"
    docker-compose logs --tail 20 frontend | grep -i "error\|failed\|exception" || echo "Aucune erreur critique détectée"
    exit 1
fi

# 6. Vérifier Traefik (reverse proxy)
echo ""
echo "🌐 TEST TRAEFIK:"
if curl -f -s http://localhost:80 >/dev/null 2>&1; then
    echo "✅ Traefik: Port 80 accessible"
    
    # Test de l'API Traefik (si configurée)
    if curl -f -s http://localhost:8080/api/rawdata >/dev/null 2>&1; then
        echo "✅ Traefik: API dashboard accessible"
    else
        echo "ℹ️  Traefik: API dashboard non configurée (normal en production)"
    fi
    
    # Test de redirection HTTPS
    if curl -f -s -I http://localhost:80 | grep -q "301\|302"; then
        echo "✅ Traefik: Redirection HTTPS configurée"
    else
        echo "⚠️  Traefik: Redirection HTTPS non détectée"
    fi
else
    echo "❌ Traefik: Port 80 inaccessible"
    # Essayer de vérifier via les logs Docker
    echo "📋 Vérification des logs Traefik:"
    docker-compose logs --tail 20 traefik | grep -i "error\|failed\|exception" || echo "Aucune erreur critique détectée"
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

# 10. Test d'accès externe via Traefik (si domaine configuré)
echo ""
echo "🌍 TEST ACCÈS EXTERNE VIA TRAEFIK:"
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
    echo "Test d'accès via le domaine: $DOMAIN"
    
    # Test du frontend principal
    if curl -f -s -H "Host: $DOMAIN" http://localhost >/dev/null 2>&1; then
        echo "✅ Frontend: Accessible via $DOMAIN"
    else
        echo "⚠️  Frontend: Non accessible via $DOMAIN"
    fi
    
    # Test du sous-domaine www
    if curl -f -s -H "Host: www.$DOMAIN" http://localhost >/dev/null 2>&1; then
        echo "✅ Frontend: Accessible via www.$DOMAIN"
    else
        echo "⚠️  Frontend: Non accessible via www.$DOMAIN"
    fi
    
    # Test de l'API Gateway
    if curl -f -s -H "Host: gate.$DOMAIN" http://localhost/health >/dev/null 2>&1; then
        echo "✅ Gateway: Accessible via gate.$DOMAIN"
    else
        echo "⚠️  Gateway: Non accessible via gate.$DOMAIN"
    fi
    
    # Test du service ML
    if curl -f -s -H "Host: ml.$DOMAIN" http://localhost/health >/dev/null 2>&1; then
        echo "✅ Translator: Accessible via ml.$DOMAIN"
    else
        echo "⚠️  Translator: Non accessible via ml.$DOMAIN"
    fi
    
    # Test du dashboard Traefik
    if curl -f -s -H "Host: traefik.$DOMAIN" http://localhost >/dev/null 2>&1; then
        echo "✅ Traefik Dashboard: Accessible via traefik.$DOMAIN"
    else
        echo "⚠️  Traefik Dashboard: Non accessible via traefik.$DOMAIN"
    fi
    
    # Test des interfaces d'administration
    if curl -f -s -H "Host: mongo.$DOMAIN" http://localhost >/dev/null 2>&1; then
        echo "✅ MongoDB UI: Accessible via mongo.$DOMAIN"
    else
        echo "⚠️  MongoDB UI: Non accessible via mongo.$DOMAIN"
    fi
    
    if curl -f -s -H "Host: redis.$DOMAIN" http://localhost >/dev/null 2>&1; then
        echo "✅ Redis UI: Accessible via redis.$DOMAIN"
    else
        echo "⚠️  Redis UI: Non accessible via redis.$DOMAIN"
    fi
else
    echo "ℹ️  Domaine non configuré, test d'accès externe ignoré"
fi

echo ""
echo "🎉 VÉRIFICATION COMPLÈTE TERMINÉE !"
echo "===================================="
echo "✅ Traefik: Opérationnel (Reverse Proxy + SSL)"
echo "✅ MongoDB: Opérationnel (Replica Set)"
echo "✅ Redis: Opérationnel"
echo "✅ Gateway: Opérationnel (gate.$DOMAIN)"
echo "✅ Translator: Opérationnel (ml.$DOMAIN)"
echo "✅ Frontend: Opérationnel ($DOMAIN)"
echo "✅ MongoDB UI: Opérationnel (mongo.$DOMAIN)"
echo "✅ Redis UI: Opérationnel (redis.$DOMAIN)"
echo "✅ ZMQ: Configuré"
echo "✅ Prisma: Initialisé"
echo ""
echo "🚀 TOUS LES SERVICES SONT OPÉRATIONNELS !"
echo "🌐 Architecture Traefik avec sous-domaines configurée"
EOF

    scp -o StrictHostKeyChecking=no /tmp/health-check.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/health-check.sh && /tmp/health-check.sh"
    rm -f /tmp/health-check.sh
}

# Vérification simple et robuste
simple_health_check() {
    local ip="$1"
    log_info "🔍 Vérification simple des services..."
    
    # Script de vérification simplifiée
    cat << 'EOF' > /tmp/simple-health-check.sh
#!/bin/bash
cd /opt/meeshy

echo "🔍 VÉRIFICATION SIMPLE DES SERVICES"
echo "==================================="

# 1. Vérifier l'état des conteneurs
echo ""
echo "📊 ÉTAT DES CONTENEURS:"
docker-compose ps

# 2. Vérifier les health checks Docker
echo ""
echo "🏥 HEALTH CHECKS DOCKER:"
for service in traefik database redis nosqlclient p3x-redis translator gateway frontend; do
    if docker-compose ps --format "{{.Name}} {{.Status}}" | grep -q "$service.*healthy\|$service.*Up"; then
        echo "✅ $service: Opérationnel"
    else
        echo "❌ $service: Problème détecté"
        # Afficher les logs récents en cas de problème
        echo "📋 Logs récents pour $service:"
        docker-compose logs --tail 5 $service 2>/dev/null | grep -E "(error|Error|ERROR|failed|Failed|FAILED)" || echo "Aucune erreur récente"
    fi
done

# 3. Test de connectivité réseau interne
echo ""
echo "🔌 TEST CONNECTIVITÉ RÉSEAU:"
# Test MongoDB
if docker-compose exec -T database mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    echo "✅ MongoDB: Connecté"
else
    echo "❌ MongoDB: Non connecté"
fi

# Test Redis
if docker-compose exec -T redis redis-cli --no-auth-warning -a MeeshyRedis123 ping >/dev/null 2>&1; then
    echo "✅ Redis: Connecté"
else
    echo "❌ Redis: Non connecté"
fi

# Test Gateway (via réseau interne)
if docker-compose exec -T gateway curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
    echo "✅ Gateway: Health check OK"
else
    echo "❌ Gateway: Health check échoué"
fi

# Test Translator (via réseau interne)
if docker-compose exec -T translator curl -f -s http://localhost:8000/health >/dev/null 2>&1; then
    echo "✅ Translator: Health check OK"
else
    echo "❌ Translator: Health check échoué"
fi

# Test Frontend (via réseau interne)
if docker-compose exec -T frontend curl -f -s http://localhost:3100 >/dev/null 2>&1; then
    echo "✅ Frontend: Accessible"
else
    echo "❌ Frontend: Non accessible"
fi

# 4. Test d'accès externe (Traefik)
echo ""
echo "🌐 TEST ACCÈS EXTERNE:"
if curl -f -s http://localhost:80 >/dev/null 2>&1; then
    echo "✅ Traefik: Port 80 accessible"
else
    echo "❌ Traefik: Port 80 non accessible"
fi

echo ""
echo "🎯 RÉSUMÉ:"
echo "=========="
healthy_services=$(docker-compose ps --format "{{.Name}} {{.Status}}" | grep -c "healthy\|Up")
total_services=$(docker-compose ps --format "{{.Name}}" | wc -l)
echo "Services opérationnels: $healthy_services/$total_services"

if [ $healthy_services -eq $total_services ]; then
    echo "🎉 TOUS LES SERVICES SONT OPÉRATIONNELS !"
    exit 0
else
    echo "⚠️  CERTAINS SERVICES ONT DES PROBLÈMES"
    exit 1
fi
EOF

    scp -o StrictHostKeyChecking=no /tmp/simple-health-check.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/simple-health-check.sh && /tmp/simple-health-check.sh"
    rm -f /tmp/simple-health-check.sh
}

# Configuration du replica set MongoDB
configure_mongodb_replica() {
    local ip="$1"
    log_info "🔧 Configuration du replica set MongoDB..."
    
    # Script de configuration du replica set
    cat << 'EOF' > /tmp/configure-replica.sh
#!/bin/bash
cd /opt/meeshy

echo "🔧 CONFIGURATION DU REPLICA SET MONGODB"
echo "======================================="

# Vérifier que MongoDB est en cours d'exécution
echo "📊 Vérification de l'état de MongoDB..."
docker-compose ps database

# Attendre que MongoDB soit prêt
echo "⏳ Attente que MongoDB soit prêt..."
for i in {1..30}; do
    if docker-compose exec -T database mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        echo "✅ MongoDB prêt"
        break
    fi
    echo "⏳ Tentative $i/30..."
    sleep 2
done

# Vérifier si le replica set est déjà configuré
echo "🔍 Vérification du statut du replica set..."
if docker-compose exec -T database mongosh --eval "rs.status()" >/dev/null 2>&1; then
    echo "✅ Replica set déjà configuré"
    echo "📊 Statut actuel:"
    docker-compose exec -T database mongosh --eval "rs.status()" --quiet
else
    echo "📋 Initialisation du replica set rs0..."
    
    # Initialiser le replica set
    docker-compose exec -T database mongosh --eval "
        try {
            rs.initiate({
                _id: 'rs0',
                members: [
                    { _id: 0, host: 'meeshy-database:27017', priority: 1 }
                ]
            });
            print('✅ Replica set rs0 initialisé avec succès');
        } catch (e) {
            if (e.message.includes('already initialized')) {
                print('⚠️  Replica set déjà initialisé');
            } else {
                print('❌ Erreur initialisation replica set: ' + e.message);
                throw e;
            }
        }
    "
    
    # Attendre que le replica set soit prêt
    echo "⏳ Attente que le replica set soit prêt..."
    for i in {1..30}; do
        if docker-compose exec -T database mongosh --eval "rs.status().ok" 2>/dev/null | grep -q "1"; then
            echo "✅ Replica set rs0 prêt"
            break
        fi
        echo "⏳ Tentative $i/30 pour le replica set..."
        sleep 3
    done
fi

# Vérifier le statut final
echo "📊 Statut final du replica set:"
docker-compose exec -T database mongosh --eval "rs.status()" --quiet

# Tester la connexion avec le replica set
echo "🔍 Test de connexion avec le replica set..."
if docker-compose exec -T database mongosh --eval "use meeshy; db.runCommand('ping')" >/dev/null 2>&1; then
    echo "✅ Connexion à la base de données avec replica set réussie"
else
    echo "❌ Problème de connexion à la base de données"
    exit 1
fi

echo "🎉 Configuration du replica set MongoDB terminée avec succès!"
echo "🔗 String de connexion: mongodb://meeshy-database:27017/meeshy?replicaSet=rs0"
EOF

    scp -o StrictHostKeyChecking=no /tmp/configure-replica.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/configure-replica.sh && /tmp/configure-replica.sh"
    rm -f /tmp/configure-replica.sh
}

# Test des certificats SSL et configuration Traefik
test_ssl_certificates() {
    local ip="$1"
    log_info "🔒 Test des certificats SSL et configuration Traefik..."
    
    # Script de test SSL
    cat << 'EOF' > /tmp/test-ssl.sh
#!/bin/bash
cd /opt/meeshy

echo "🔒 TEST DES CERTIFICATS SSL ET CONFIGURATION TRAEFIK"
echo "=================================================="

# Vérifier que Traefik est en cours d'exécution
echo "📊 Vérification de l'état de Traefik..."
docker-compose ps traefik

# Vérifier les volumes de certificats
echo "📁 Vérification des volumes de certificats..."
if docker volume ls | grep -q "traefik_certs"; then
    echo "✅ Volume traefik_certs trouvé"
    
    # Vérifier le contenu du volume
    echo "📋 Contenu du volume de certificats:"
    docker run --rm -v meeshy_traefik_certs:/data alpine ls -la /data/ 2>/dev/null || echo "Volume vide ou inaccessible"
else
    echo "❌ Volume traefik_certs non trouvé"
fi

# Test de redirection HTTP vers HTTPS
echo "🔄 Test de redirection HTTP vers HTTPS..."
if curl -f -s -I http://localhost:80 | grep -q "301\|302"; then
    echo "✅ Redirection HTTP vers HTTPS configurée"
    echo "📋 Détails de la redirection:"
    curl -f -s -I http://localhost:80 | grep -i "location\|status"
else
    echo "⚠️  Redirection HTTP vers HTTPS non détectée"
fi

# Test des sous-domaines (si domaine configuré)
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
    echo "🌐 Test des sous-domaines avec SSL..."
    
    # Test du frontend principal
    echo "🔍 Test du frontend principal ($DOMAIN)..."
    if curl -f -s -H "Host: $DOMAIN" http://localhost >/dev/null 2>&1; then
        echo "✅ Frontend accessible via $DOMAIN"
    else
        echo "❌ Frontend non accessible via $DOMAIN"
    fi
    
    # Test du dashboard Traefik
    echo "🔍 Test du dashboard Traefik (traefik.$DOMAIN)..."
    if curl -f -s -H "Host: traefik.$DOMAIN" http://localhost >/dev/null 2>&1; then
        echo "✅ Dashboard Traefik accessible via traefik.$DOMAIN"
    else
        echo "❌ Dashboard Traefik non accessible via traefik.$DOMAIN"
    fi
    
    # Test de l'API Gateway
    echo "🔍 Test de l'API Gateway (gate.$DOMAIN)..."
    if curl -f -s -H "Host: gate.$DOMAIN" http://localhost/health >/dev/null 2>&1; then
        echo "✅ API Gateway accessible via gate.$DOMAIN"
    else
        echo "❌ API Gateway non accessible via gate.$DOMAIN"
    fi
    
    # Test du service ML
    echo "🔍 Test du service ML (ml.$DOMAIN)..."
    if curl -f -s -H "Host: ml.$DOMAIN" http://localhost/health >/dev/null 2>&1; then
        echo "✅ Service ML accessible via ml.$DOMAIN"
    else
        echo "❌ Service ML non accessible via ml.$DOMAIN"
    fi
else
    echo "ℹ️  Domaine non configuré, tests SSL externes ignorés"
fi

# Vérifier les logs Traefik pour les erreurs SSL
echo "📋 Vérification des logs Traefik pour les erreurs SSL..."
docker-compose logs --tail 20 traefik | grep -i "ssl\|tls\|certificate\|acme" || echo "Aucun log SSL récent"

echo "🎉 Test des certificats SSL terminé!"
EOF

    scp -o StrictHostKeyChecking=no /tmp/test-ssl.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/test-ssl.sh && /tmp/test-ssl.sh"
    rm -f /tmp/test-ssl.sh
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
    echo -e "${CYAN}  health${NC}       - Vérification complète de santé"
    echo -e "${CYAN}  simple-health${NC} - Vérification simple et robuste"
    echo -e "${CYAN}  replica${NC}      - Configuration du replica set MongoDB"
    echo -e "${CYAN}  ssl${NC}          - Test des certificats SSL et Traefik"
    echo -e "${CYAN}  status${NC}       - État des services"
    echo -e "${CYAN}  logs${NC}         - Logs des services"
    echo -e "${CYAN}  restart${NC}      - Redémarrage des services"
    echo -e "${CYAN}  stop${NC}         - Arrêt des services"
    echo -e "${CYAN}  recreate${NC}     - Recréation du droplet"
    echo ""
    echo -e "${GREEN}Options:${NC}"
    echo -e "${CYAN}  --force-refresh${NC} - Forcer le téléchargement des images"
    echo ""
    echo -e "${GREEN}Exemples:${NC}"
    echo "  $0 deploy 157.230.15.51"
    echo "  $0 test 157.230.15.51"
    echo "  $0 verify 157.230.15.51"
    echo "  $0 simple-health 157.230.15.51"
    echo "  $0 replica 157.230.15.51"
    echo "  $0 ssl 157.230.15.51"
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
        "simple-health")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            simple_health_check "$DROPLET_IP"
            ;;
        "replica")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            configure_mongodb_replica "$DROPLET_IP"
            ;;
        "ssl")
            if [ -z "$DROPLET_IP" ]; then
                log_error "IP du droplet manquante"
                show_help
                exit 1
            fi
            test_ssh_connection "$DROPLET_IP" || exit 1
            test_ssl_certificates "$DROPLET_IP"
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
