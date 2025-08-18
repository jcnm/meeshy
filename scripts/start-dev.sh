#!/bin/bash

# Script de démarrage pour le développement avec hot reload
set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Démarrage de Meeshy en mode développement...${NC}"

# Attendre que les bases de données soient prêtes
echo -e "${YELLOW}⏳ Attente des bases de données...${NC}"
until pg_isready -h postgres -p 5432 -U meeshy; do
    echo "PostgreSQL n'est pas encore prêt..."
    sleep 2
done

until redis-cli -h redis -p 6379 ping; do
    echo "Redis n'est pas encore prêt..."
    sleep 2
done

echo -e "${GREEN}✅ Bases de données prêtes${NC}"

# Créer les répertoires nécessaires
mkdir -p /app/logs /app/data /app/cache /app/models

# Générer le client Prisma si nécessaire
echo -e "${YELLOW}🔧 Génération du client Prisma...${NC}"
cd /app/shared
if [ -f schema.sqlite.prisma ]; then
    cp schema.sqlite.prisma schema.prisma
fi
export PRISMA_CLIENT_OUTPUT_DIRECTORY=/app/shared/node_modules/.prisma/client
npx prisma generate

# Installer les dépendances si nécessaire (pour le hot reload)
echo -e "${YELLOW}📦 Vérification des dépendances...${NC}"

# Frontend
if [ ! -d "/app/frontend/node_modules" ]; then
    echo -e "${BLUE}📦 Installation des dépendances Frontend...${NC}"
    cd /app/frontend
    pnpm install --frozen-lockfile
fi

# Gateway
if [ ! -d "/app/gateway/node_modules" ]; then
    echo -e "${BLUE}📦 Installation des dépendances Gateway...${NC}"
    cd /app/gateway
    pnpm install --frozen-lockfile
fi

# Translator
if [ ! -d "/app/translator/venv" ]; then
    echo -e "${BLUE}📦 Installation des dépendances Translator...${NC}"
    cd /app/translator
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
fi

# Démarrer les services en mode développement
echo -e "${GREEN}🚀 Démarrage des services en mode développement...${NC}"

# Fonction pour démarrer un service en arrière-plan
start_service() {
    local name=$1
    local cmd=$2
    local log_file="/app/logs/${name}.log"
    
    echo -e "${BLUE}🔄 Démarrage de ${name}...${NC}"
    eval "$cmd" > "$log_file" 2>&1 &
    echo $! > "/app/logs/${name}.pid"
    echo -e "${GREEN}✅ ${name} démarré (PID: $(cat /app/logs/${name}.pid))${NC}"
}

# Démarrer le Translator
cd /app/translator
source venv/bin/activate
start_service "translator" "HTTP_PORT=8000 ZMQ_PUSH_PORT=5555 ZMQ_SUB_PORT=5558 python -u start_service.py"

# Démarrer le Gateway
cd /app/gateway
start_service "gateway" "tsx -r tsconfig-paths/register src/server.ts"

# Démarrer le Frontend
cd /app/frontend
start_service "frontend" "pnpm dev"

# Démarrer Nginx
echo -e "${BLUE}🔄 Démarrage de Nginx...${NC}"
nginx -g "daemon off;" &
echo $! > "/app/logs/nginx.pid"
echo -e "${GREEN}✅ Nginx démarré (PID: $(cat /app/logs/nginx.pid))${NC}"

# Fonction pour surveiller les processus
monitor_services() {
    echo -e "${YELLOW}👀 Surveillance des services...${NC}"
    while true; do
        for service in translator gateway frontend nginx; do
            if [ -f "/app/logs/${service}.pid" ]; then
                pid=$(cat "/app/logs/${service}.pid")
                if ! kill -0 $pid 2>/dev/null; then
                    echo -e "${RED}❌ Le service ${service} s'est arrêté (PID: $pid)${NC}"
                    echo -e "${YELLOW}📋 Dernières lignes du log ${service}:${NC}"
                    tail -10 "/app/logs/${service}.log" || true
                    return 1
                fi
            fi
        done
        sleep 10
    done
}

# Attendre que tous les services soient prêts
echo -e "${YELLOW}⏳ Attente que les services soient prêts...${NC}"
sleep 10

# Vérifier que les services répondent
echo -e "${YELLOW}🔍 Vérification des services...${NC}"

# Test du Translator (retry)
for i in {1..20}; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Translator: http://localhost:8000/health${NC}"
        break
    fi
    echo -e "${YELLOW}⏳ Translator pas prêt (tentative $i)${NC}"
    sleep 1
done

# Test du Gateway (retry)
for i in {1..20}; do
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Gateway: http://localhost:3000/health${NC}"
        break
    fi
    echo -e "${YELLOW}⏳ Gateway pas prêt (tentative $i)${NC}"
    sleep 1
done

# Test du Frontend (retry)
for i in {1..20}; do
    if curl -sf http://localhost:3100 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend: http://localhost:3100${NC}"
        break
    fi
    echo -e "${YELLOW}⏳ Frontend pas prêt (tentative $i)${NC}"
    sleep 1
done

echo -e "${GREEN}🎉 Meeshy est prêt en mode développement !${NC}"
echo -e "${BLUE}📱 Frontend: http://localhost:3100${NC}"
echo -e "${BLUE}🔌 Gateway: http://localhost:3000${NC}"
echo -e "${BLUE}🤖 Translator: http://localhost:8000${NC}"
echo -e "${YELLOW}📋 Logs disponibles dans /app/logs/${NC}"

# Surveiller les services
monitor_services
