#!/bin/bash

# Script de démarrage pour Container Unifié Meeshy
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}🚀 Démarrage de Meeshy - Container Unifié${NC}"
echo "=============================================="

# Créer les répertoires nécessaires
mkdir -p /app/data/postgres /app/data/redis /app/logs /app/cache /app/models
chown -R meeshy:meeshy /app/data /app/logs /app/cache /app/models

# Vérifier si on utilise des services externes
USE_EXTERNAL_DB=${USE_EXTERNAL_DB:-false}
USE_EXTERNAL_REDIS=${USE_EXTERNAL_REDIS:-false}

echo -e "${BLUE}🔍 Configuration des services:${NC}"
echo "  - Base de données externe: $USE_EXTERNAL_DB"
echo "  - Redis externe: $USE_EXTERNAL_REDIS"

# Variables d'environnement par défaut
export POSTGRES_USER=${POSTGRES_USER:-"meeshy"}
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"MeeshyP@ssword"}
export POSTGRES_DB=${POSTGRES_DB:-"meeshy"}
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"

# Initialiser PostgreSQL si nécessaire
if [ "$USE_EXTERNAL_DB" != "true" ]; then
    echo -e "${BLUE}📊 Configuration de PostgreSQL...${NC}"
    
    mkdir -p /app/data/postgres /app/data/redis
    
    if [ ! -f /app/data/postgres/postgresql.conf ]; then
        echo -e "${YELLOW}📝 Initialisation de PostgreSQL...${NC}"
        
        INITDB_PATH=$(find /usr/lib/postgresql -name "initdb" 2>/dev/null | head -1)
        if [ -z "$INITDB_PATH" ]; then
            echo -e "${RED}❌ Impossible de trouver initdb${NC}"
            exit 1
        fi
        
        chown -R postgres:postgres /app/data/postgres
        su - postgres -c "$INITDB_PATH -D /app/data/postgres"
        
        # Configuration PostgreSQL améliorée
        cat >> /app/data/postgres/pg_hba.conf << EOF
# Ajout de règles d'authentification
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
host    all             all             0.0.0.0/0               md5
local   all             postgres                                peer
local   all             all                                     peer
EOF
        
        cat >> /app/data/postgres/postgresql.conf << EOF
listen_addresses = '*'
port = 5432
max_connections = 100
shared_buffers = 128MB
logging_collector = on
log_directory = '/app/logs'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
EOF
        
        chown -R postgres:postgres /app/data/postgres
        echo -e "${GREEN}✅ PostgreSQL initialisé${NC}"
    else
        echo -e "${GREEN}✅ Configuration PostgreSQL existante détectée${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Utilisation d'une base de données externe${NC}"
fi

# Initialiser Redis si nécessaire
if [ "$USE_EXTERNAL_REDIS" != "true" ]; then
    echo -e "${BLUE}➕ Initialisation de Redis...${NC}"
    mkdir -p /app/data/redis
    chown -R redis:redis /app/data/redis
    chmod 755 /app/data/redis
    echo -e "${GREEN}✅ Redis configuré${NC}"
else
    echo -e "${YELLOW}⚠️  Utilisation d'un Redis externe${NC}"
fi

# Configuration Supervisor
echo -e "${BLUE}🔧 Préparation de la configuration Supervisor...${NC}"
TEMP_SUPERVISOR_DIR="/tmp/supervisor"
mkdir -p $TEMP_SUPERVISOR_DIR

# Créer supervisord.conf
cat > $TEMP_SUPERVISOR_DIR/supervisord.conf << 'EOF'
[unix_http_server]
file=/var/run/supervisor.sock
chmod=0700

[supervisord]
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid
childlogdir=/var/log/supervisor
nodaemon=true
user=root

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface

[supervisorctl]
serverurl=unix:///var/run/supervisor.sock

[include]
files = /tmp/supervisor/*.conf

[group:meeshy]
programs=PROGRAMS_PLACEHOLDER
priority=999
EOF

# Déterminer quels services démarrer
PROGRAMS="translator,gateway,frontend"

if [ "$USE_EXTERNAL_DB" != "true" ]; then
    cp /etc/supervisor/conf.d/postgres.conf $TEMP_SUPERVISOR_DIR/
    PROGRAMS="postgres,$PROGRAMS"
fi

if [ "$USE_EXTERNAL_REDIS" != "true" ]; then
    cp /etc/supervisor/conf.d/redis.conf $TEMP_SUPERVISOR_DIR/
    PROGRAMS="redis,$PROGRAMS"
fi

cp /etc/supervisor/conf.d/translator.conf $TEMP_SUPERVISOR_DIR/
cp /etc/supervisor/conf.d/gateway.conf $TEMP_SUPERVISOR_DIR/
cp /etc/supervisor/conf.d/frontend.conf $TEMP_SUPERVISOR_DIR/
cp /etc/supervisor/conf.d/nginx.conf $TEMP_SUPERVISOR_DIR/

sed -i "s/PROGRAMS_PLACEHOLDER/$PROGRAMS/" $TEMP_SUPERVISOR_DIR/supervisord.conf

# Fonction pour attendre qu'un service soit prêt
wait_for_service() {
    local service_name=$1
    local check_command=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${BLUE}⏳ Attente du service $service_name...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if eval "$check_command" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name est prêt${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}   Tentative $attempt/$max_attempts...${NC}"
        sleep 5
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ Timeout en attendant $service_name${NC}"
    return 1
}

# Démarrer Supervisor en arrière-plan
echo -e "${BLUE}🔧 Démarrage de Supervisor...${NC}"
/usr/bin/supervisord -c $TEMP_SUPERVISOR_DIR/supervisord.conf &
SUPERVISOR_PID=$!

# Attendre que Supervisor soit démarré
sleep 10

# Configuration de la base de données après démarrage
if [ "$USE_EXTERNAL_DB" != "true" ]; then
    # Attendre que PostgreSQL soit vraiment prêt
    wait_for_service "PostgreSQL" "pg_isready -h localhost -p 5432"
    
    echo -e "${BLUE}🔧 Configuration de la base de données meeshy...${NC}"
    
    # Créer l'utilisateur et la base de données avec les bonnes méthodes
    PGPASSWORD="" psql -h localhost -U postgres -c "CREATE USER \"$POSTGRES_USER\" WITH PASSWORD '$POSTGRES_PASSWORD' CREATEDB SUPERUSER;" 2>/dev/null || true
    PGPASSWORD="" psql -h localhost -U postgres -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";" 2>/dev/null || true
    PGPASSWORD="" psql -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE \"$POSTGRES_DB\" TO \"$POSTGRES_USER\";" 2>/dev/null || true
    
    # Tester la connexion avec le nouvel utilisateur
    echo -e "${BLUE}🔍 Test de connexion avec l'utilisateur $POSTGRES_USER...${NC}"
    if PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version();" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Connexion réussie avec $POSTGRES_USER${NC}"
    else
        echo -e "${RED}❌ Échec de connexion avec $POSTGRES_USER${NC}"
        exit 1
    fi
    
    # Attendre que tous les services soient stables
    sleep 15
    
    # Exécuter les migrations Prisma
    echo -e "${BLUE}🔧 Exécution des migrations Prisma...${NC}"
    
    # Migration shared
    if [ -d "/app/shared" ] && [ -f "/app/shared/schema.prisma" ]; then
        echo -e "${BLUE}   Migration du schéma shared...${NC}"
        cd /app/shared
        if npx prisma migrate deploy --schema=./schema.prisma; then
            echo -e "${GREEN}✅ Migration shared réussie${NC}"
        else
            echo -e "${RED}❌ Échec de la migration shared${NC}"
        fi
    fi
    
    # Migration gateway
    if [ -d "/app/gateway" ] && [ -f "/app/gateway/shared/schema.prisma" ]; then
        echo -e "${BLUE}   Migration du schéma gateway...${NC}"
        cd /app/gateway
        if npx prisma migrate deploy --schema=./shared/schema.prisma; then
            echo -e "${GREEN}✅ Migration gateway réussie${NC}"
        else
            echo -e "${RED}❌ Échec de la migration gateway${NC}"
        fi
    fi
    
    echo -e "${GREEN}✅ Migrations Prisma terminées${NC}"
fi

# Attendre que Redis soit prêt si nécessaire
if [ "$USE_EXTERNAL_REDIS" != "true" ]; then
    wait_for_service "Redis" "redis-cli ping"
fi

# Vérifier l'état final des services
echo -e "${BLUE}🔍 État final des services...${NC}"
supervisorctl -c $TEMP_SUPERVISOR_DIR/supervisord.conf status

echo -e "${GREEN}✅ Tous les services sont démarrés${NC}"
echo -e "${CYAN}🌐 Frontend accessible sur: http://localhost${NC}"
echo -e "${CYAN}🔌 Gateway API accessible sur: http://localhost/api${NC}"
echo -e "${CYAN}🤖 Translator API accessible sur: http://localhost/translate${NC}"

# Attendre le processus Supervisor
wait $SUPERVISOR_PID