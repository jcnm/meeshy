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
    echo -e "${BLUE}📊 Initialisation de PostgreSQL...${NC}"
    
    # Initialiser la base de données si elle n'existe pas
    if [ ! -f /app/data/postgres/postgresql.conf ]; then
        echo -e "${YELLOW}📝 Création de la base de données PostgreSQL...${NC}"
        su - postgres -c "initdb -D /app/data/postgres"
        
        # Configuration PostgreSQL
        echo "host all all 0.0.0.0/0 trust" >> /app/data/postgres/pg_hba.conf
        echo "host all all ::/0 trust" >> /app/data/postgres/pg_hba.conf
        echo "listen_addresses = '0.0.0.0'" >> /app/data/postgres/postgresql.conf
        echo "port = 5432" >> /app/data/postgres/postgresql.conf
        echo "max_connections = 100" >> /app/data/postgres/postgresql.conf
        echo "shared_buffers = 128MB" >> /app/data/postgres/postgresql.conf
        
        echo -e "${GREEN}✅ Base de données PostgreSQL créée${NC}"
    else
        echo -e "${GREEN}✅ Base de données PostgreSQL existante détectée${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Utilisation d'une base de données externe${NC}"
fi

# Initialiser Redis si nécessaire
if [ "$USE_EXTERNAL_REDIS" != "true" ]; then
    echo -e "${BLUE}🔴 Initialisation de Redis...${NC}"
    mkdir -p /app/data/redis
    chown -R redis:redis /app/data/redis
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

# Copier la configuration principale
cp /etc/supervisor/conf.d/supervisord.conf $TEMP_SUPERVISOR_DIR/

# Déterminer quels services démarrer
PROGRAMS="translator,gateway,frontend,nginx"

if [ "$USE_EXTERNAL_DB" != "true" ]; then
    echo -e "${BLUE}📊 Ajout de PostgreSQL à la configuration...${NC}"
    cp /etc/supervisor/conf.d/postgres.conf $TEMP_SUPERVISOR_DIR/
    PROGRAMS="postgres,$PROGRAMS"
fi

if [ "$USE_EXTERNAL_REDIS" != "true" ]; then
    echo -e "${BLUE}🔴 Ajout de Redis à la configuration...${NC}"
    cp /etc/supervisor/conf.d/redis.conf $TEMP_SUPERVISOR_DIR/
    PROGRAMS="redis,$PROGRAMS"
fi

# Copier les autres configurations
cp /etc/supervisor/conf.d/translator.conf $TEMP_SUPERVISOR_DIR/
cp /etc/supervisor/conf.d/gateway.conf $TEMP_SUPERVISOR_DIR/
cp /etc/supervisor/conf.d/frontend.conf $TEMP_SUPERVISOR_DIR/

# Mettre à jour la liste des programmes dans le groupe
sed -i "s/programs=.*/programs=$PROGRAMS/" $TEMP_SUPERVISOR_DIR/supervisord.conf

# Attendre que les services de base soient prêts
if [ "$USE_EXTERNAL_DB" != "true" ]; then
    echo -e "${BLUE}⏳ Attente du démarrage de PostgreSQL...${NC}"
    sleep 5
fi

if [ "$USE_EXTERNAL_REDIS" != "true" ]; then
    echo -e "${BLUE}⏳ Attente du démarrage de Redis...${NC}"
    sleep 3
fi

# Démarrer Supervisor
echo -e "${BLUE}🔧 Démarrage de Supervisor...${NC}"
/usr/bin/supervisord -c $TEMP_SUPERVISOR_DIR/supervisord.conf &

# Attendre que tous les services soient démarrés
echo -e "${BLUE}⏳ Attente du démarrage de tous les services...${NC}"
sleep 10

# Vérifier l'état des services
echo -e "${BLUE}🔍 Vérification de l'état des services...${NC}"
supervisorctl -c $TEMP_SUPERVISOR_DIR/supervisord.conf status

# Attendre indéfiniment
echo -e "${GREEN}✅ Tous les services sont démarrés${NC}"
echo -e "${CYAN}🌐 Frontend accessible sur: http://localhost${NC}"
echo -e "${CYAN}🔌 Gateway API accessible sur: http://localhost/api${NC}"
echo -e "${CYAN}🤖 Translator API accessible sur: http://localhost/translate${NC}"

# Garder le container en vie
wait
