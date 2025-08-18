#!/bin/bash

# Script de démarrage pour Docker unique Meeshy
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}🚀 Démarrage de Meeshy - Docker Unique${NC}"
echo "=============================================="

# Créer les répertoires nécessaires
mkdir -p /app/data/postgres /app/logs /app/cache /app/models
chown -R meeshy:meeshy /app/data /app/logs /app/cache /app/models

# Initialiser la base de données PostgreSQL si nécessaire
if [ "$START_POSTGRES" = "true" ] && [ "$USE_EXTERNAL_DB" != "true" ] && [ ! -f /app/data/postgres/postgresql.conf ]; then
    echo -e "${BLUE}📊 Initialisation de PostgreSQL...${NC}"
    INITDB_PATH=$(find /usr/lib/postgresql -name initdb -type f 2>/dev/null | head -1)
    if [ -n "$INITDB_PATH" ]; then
        su - meeshy -c "$INITDB_PATH -D /app/data/postgres"
    else
        echo -e "${RED}❌ initdb non trouvé${NC}"
        exit 1
    fi
    echo "host all all 0.0.0.0/0 trust" >> /app/data/postgres/pg_hba.conf
    echo "host all all ::/0 trust" >> /app/data/postgres/pg_hba.conf
    echo "listen_addresses = '0.0.0.0'" >> /app/data/postgres/postgresql.conf
    echo "port = 5432" >> /app/data/postgres/postgresql.conf
    echo -e "${GREEN}✅ PostgreSQL initialisé${NC}"
elif [ "$USE_EXTERNAL_DB" = "true" ]; then
    echo -e "${YELLOW}⚠️  Utilisation d'une base de données externe${NC}"
elif [ "$START_POSTGRES" = "false" ]; then
    echo -e "${YELLOW}⚠️  PostgreSQL désactivé${NC}"
fi

# Vérifier les fichiers de configuration
echo -e "${BLUE}🔍 Vérification des fichiers de configuration...${NC}"
ls -la /etc/supervisor/conf.d/

# Créer une configuration Supervisor temporaire sans les services désactivés
echo -e "${BLUE}🔧 Préparation de la configuration Supervisor...${NC}"
TEMP_SUPERVISOR_DIR="/tmp/supervisor"
mkdir -p $TEMP_SUPERVISOR_DIR

# Copier tous les fichiers de configuration
cp /etc/supervisor/conf.d/*.conf $TEMP_SUPERVISOR_DIR/

# Ajouter les programmes PostgreSQL et Redis si activés
if [ "$START_POSTGRES" = "true" ]; then
    cat >> $TEMP_SUPERVISOR_DIR/supervisord.conf << 'EOF'

[program:postgres]
command=postgres -D /app/data/postgres -c listen_addresses=0.0.0.0 -c port=5432
directory=/app/data
user=meeshy
autostart=false
autorestart=true
startretries=3
startsecs=10
stdout_logfile=/app/logs/postgres.log
stderr_logfile=/app/logs/postgres.error.log
environment=POSTGRES_DB="%(ENV_POSTGRES_DB)s",POSTGRES_USER="%(ENV_POSTGRES_USER)s",POSTGRES_PASSWORD="%(ENV_POSTGRES_PASSWORD)s",PGDATA="/app/data/postgres"
priority=100
EOF
    PROGRAMS="postgres,translator,gateway,frontend"
else
    PROGRAMS="translator,gateway,frontend"
fi

if [ "$START_REDIS" = "true" ]; then
    cat >> $TEMP_SUPERVISOR_DIR/supervisord.conf << 'EOF'

[program:redis]
command=redis-server --bind 0.0.0.0 --port 6379 --dir /app/data/redis
directory=/app/data
user=meeshy
autostart=false
autorestart=true
startretries=3
startsecs=5
stdout_logfile=/app/logs/redis.log
stderr_logfile=/app/logs/redis.error.log
priority=200
EOF
    PROGRAMS="redis,$PROGRAMS"
fi

# Mettre à jour la liste des programmes dans le groupe
sed -i "s/programs=.*/programs=$PROGRAMS/" $TEMP_SUPERVISOR_DIR/supervisord.conf

# Démarrer Supervisor avec la configuration temporaire
echo -e "${BLUE}🔧 Démarrage de Supervisor...${NC}"
/usr/bin/supervisord -c $TEMP_SUPERVISOR_DIR/supervisord.conf &
SUPERVISOR_PID=$!

# Attendre que Supervisor soit prêt
sleep 3

# Démarrer PostgreSQL si configuré
if [ "$START_POSTGRES" = "true" ]; then
    echo -e "${GREEN}🐘 Démarrage de PostgreSQL...${NC}"
    supervisorctl start postgres
fi

# Démarrer Redis si configuré
if [ "$START_REDIS" = "true" ]; then
    echo -e "${GREEN}🔴 Démarrage de Redis...${NC}"
    supervisorctl start redis
fi

# Démarrer les services applicatifs
echo -e "${GREEN}🚀 Démarrage des services applicatifs...${NC}"
supervisorctl -c $TEMP_SUPERVISOR_DIR/supervisord.conf start translator
supervisorctl -c $TEMP_SUPERVISOR_DIR/supervisord.conf start gateway
supervisorctl -c $TEMP_SUPERVISOR_DIR/supervisord.conf start frontend

echo -e "${GREEN}✅ Tous les services démarrés !${NC}"
echo -e "${CYAN}🌐 Frontend: http://localhost:3100${NC}"
echo -e "${CYAN}🔌 Gateway: http://localhost:3000${NC}"
echo -e "${CYAN}🤖 Translator: http://localhost:8000${NC}"
if [ "$START_POSTGRES" = "true" ]; then
    echo -e "${CYAN}🐘 PostgreSQL: localhost:5432${NC}"
fi
if [ "$START_REDIS" = "true" ]; then
    echo -e "${CYAN}🔴 Redis: localhost:6379${NC}"
fi

# Attendre que tous les services soient démarrés
echo -e "${GREEN}✅ Tous les services démarrés !${NC}"
echo -e "${CYAN}🌐 Frontend: http://localhost:3100${NC}"
echo -e "${CYAN}🔌 Gateway: http://localhost:3000${NC}"
echo -e "${CYAN}🤖 Translator: http://localhost:8000${NC}"
if [ "$START_POSTGRES" = "true" ]; then
    echo -e "${CYAN}🐘 PostgreSQL: localhost:5432${NC}"
fi
if [ "$START_REDIS" = "true" ]; then
    echo -e "${CYAN}🔴 Redis: localhost:6379${NC}"
fi

# Garder le conteneur en vie et surveiller les processus
echo -e "${GREEN}🔄 Surveillance des services...${NC}"
while true; do
    sleep 10
    # Vérifier que Supervisor est toujours en cours d'exécution
    if ! kill -0 $SUPERVISOR_PID 2>/dev/null; then
        echo -e "${RED}❌ Supervisor s'est arrêté${NC}"
        exit 1
    fi
done
