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

# Initialiser PostgreSQL si nécessaire
if [ "$USE_EXTERNAL_DB" != "true" ]; then
    echo -e "${BLUE}📊 Configuration de PostgreSQL...${NC}"
    
    # Créer les répertoires de données si nécessaire
    mkdir -p /app/data/postgres /app/data/redis
    
    # Initialiser PostgreSQL si la configuration n'existe pas
    if [ ! -f /app/data/postgres/postgresql.conf ]; then
        echo -e "${YELLOW}📝 Initialisation de PostgreSQL...${NC}"
        
        # Trouver le binaire initdb
        INITDB_PATH=$(find /usr/lib/postgresql -name "initdb" 2>/dev/null | head -1)
        if [ -z "$INITDB_PATH" ]; then
            echo -e "${RED}❌ Impossible de trouver initdb${NC}"
            exit 1
        fi
        
        # Initialiser la base de données
        chown -R postgres:postgres /app/data/postgres
        su - postgres -c "$INITDB_PATH -D /app/data/postgres"
        
        # Configuration PostgreSQL
        echo "host all all 0.0.0.0/0 trust" >> /app/data/postgres/pg_hba.conf
        echo "host all all ::/0 trust" >> /app/data/postgres/pg_hba.conf
        echo "listen_addresses = '0.0.0.0'" >> /app/data/postgres/postgresql.conf
        echo "port = 5432" >> /app/data/postgres/postgresql.conf
        echo "max_connections = 100" >> /app/data/postgres/postgresql.conf
        echo "shared_buffers = 128MB" >> /app/data/postgres/postgresql.conf
        
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

# Vérifier les fichiers de configuration Supervisor
echo -e "${BLUE}🔍 Vérification des fichiers de configuration Supervisor...${NC}"
ls -la /etc/supervisor/conf.d/

# Créer une configuration Supervisor adaptée
echo -e "${BLUE}🔧 Préparation de la configuration Supervisor...${NC}"
TEMP_SUPERVISOR_DIR="/tmp/supervisor"
mkdir -p $TEMP_SUPERVISOR_DIR

# Créer une nouvelle configuration supervisord.conf
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
    echo -e "${BLUE}📊 Ajout de PostgreSQL à la configuration...${NC}"
    cp /etc/supervisor/conf.d/postgres.conf $TEMP_SUPERVISOR_DIR/
    PROGRAMS="postgres,$PROGRAMS"
fi

if [ "$USE_EXTERNAL_REDIS" != "true" ]; then
    echo -e "${BLUE}➕ Ajout de Redis à la configuration...${NC}"
    cp /etc/supervisor/conf.d/redis.conf $TEMP_SUPERVISOR_DIR/
    PROGRAMS="redis,$PROGRAMS"
fi

# Copier les autres configurations
cp /etc/supervisor/conf.d/translator.conf $TEMP_SUPERVISOR_DIR/
cp /etc/supervisor/conf.d/gateway.conf $TEMP_SUPERVISOR_DIR/
cp /etc/supervisor/conf.d/frontend.conf $TEMP_SUPERVISOR_DIR/
# Nginx sera démarré automatiquement par les dépendances
cp /etc/supervisor/conf.d/nginx.conf $TEMP_SUPERVISOR_DIR/

# Mettre à jour la liste des programmes dans le groupe
sed -i "s/PROGRAMS_PLACEHOLDER/$PROGRAMS/" $TEMP_SUPERVISOR_DIR/supervisord.conf

# Attendre que les services de base soient prêts
if [ "$USE_EXTERNAL_DB" != "true" ]; then
    echo -e "${BLUE}⏳ Attente du démarrage de PostgreSQL...${NC}"
    sleep 5
    
    # Créer la base de données et l'utilisateur meeshy si nécessaire
    echo -e "${BLUE}🔧 Configuration de la base de données meeshy...${NC}"
    
    # Corriger les permissions PostgreSQL
    chown -R postgres:postgres /app/data/postgres
    chmod 700 /app/data/postgres
    
    su - postgres -c "psql -c \"CREATE USER meeshy WITH PASSWORD 'MeeshyP@ssword' CREATEDB;\" 2>/dev/null || true"
    su - postgres -c "psql -c \"CREATE DATABASE meeshy OWNER meeshy;\" 2>/dev/null || true"
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE meeshy TO meeshy;\" 2>/dev/null || true"
    
    echo -e "${GREEN}✅ Base de données meeshy configurée${NC}"
fi

if [ "$USE_EXTERNAL_REDIS" != "true" ]; then
    echo -e "${BLUE}⏳ Attente du démarrage de Redis...${NC}"
    sleep 3
fi

# Démarrer Supervisor
echo -e "${BLUE}🔧 Démarrage de Supervisor...${NC}"
/usr/bin/supervisord -c $TEMP_SUPERVISOR_DIR/supervisord.conf &

# Attendre que tous les services soient démarrés
echo -e "${BLUE}⏳ Attente du démarrage de tous les services (30 secondes)...${NC}"
sleep 30

# Vérifier l'état des services
echo -e "${BLUE}🔍 Vérification de l'état des services...${NC}"
supervisorctl -c $TEMP_SUPERVISOR_DIR/supervisord.conf status

# Exécuter les migrations Prisma après que PostgreSQL soit prêt
if [ "$USE_EXTERNAL_DB" != "true" ]; then
    echo -e "${BLUE}🔧 Exécution des migrations Prisma...${NC}"
    sleep 3  # Attendre que PostgreSQL soit complètement prêt
    
    # Attendre que PostgreSQL soit accessible via Supervisor
    until supervisorctl -c $TEMP_SUPERVISOR_DIR/supervisord.conf status postgres | grep -q "RUNNING"; do
        echo -e "${YELLOW}⏳ Attente de PostgreSQL via Supervisor...${NC}"
        sleep 5
    done
    
    # Attendre que PostgreSQL soit accessible
    until su - postgres -c "psql -c '\l'" >/dev/null 2>&1; do
        echo -e "${YELLOW}⏳ Attente de PostgreSQL...${NC}"
        sleep 5
    done
    su - postgres -c "psql -c '\l'"
    # Attendre encore un peu pour s'assurer que PostgreSQL est stable
    sleep 10
    
    cd /app/shared && npx prisma migrate deploy --schema=./schema.prisma
    cd /app/gateway && npx prisma migrate deploy --schema=./shared/schema.prisma
    
    echo -e "${GREEN}✅ Migrations Prisma exécutées${NC}"
fi

# Attendre indéfiniment
echo -e "${GREEN}✅ Tous les services sont démarrés${NC}"
echo -e "${CYAN}🌐 Frontend accessible sur: http://localhost${NC}"
echo -e "${CYAN}🔌 Gateway API accessible sur: http://localhost/api${NC}"
echo -e "${CYAN}🤖 Translator API accessible sur: http://localhost/translate${NC}"

# Garder le container en vie
wait
