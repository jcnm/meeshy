#!/bin/bash

# 🚀 Script de démarrage pour l'environnement de développement LOCAL
# Ce script démarre l'environnement complet Meeshy en mode développement
# - Services Docker: MongoDB, Redis
# - Services Node: Gateway, Frontend, Translator (via scripts .sh)
set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 Démarrage de l'environnement Meeshy LOCAL (DEV)${NC}"
echo -e "${YELLOW}   Architecture: Services Node natifs + Services Docker${NC}"
echo ""

# Variables d'environnement pour le développement LOCAL
export NODE_ENV="development"
export ENVIRONMENT="local"

# Base de données et cache (Docker)
export DATABASE_TYPE="MONGODB"
export DATABASE_URL="mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin"
export REDIS_URL="redis://localhost:6379"

# URLs des services (natifs)
export TRANSLATOR_URL="http://localhost:8000"
export GATEWAY_URL="http://localhost:3000"
export FRONTEND_URL="http://localhost:3100"

# Configuration WebSocket et API
export NEXT_PUBLIC_API_URL="http://localhost:3000"
export NEXT_PUBLIC_TRANSLATION_URL="http://localhost:8000"
export NEXT_PUBLIC_WS_URL="ws://localhost:3000/api/ws"

# Configuration ZMQ (communication inter-services)
export ZMQ_PUSH_URL="tcp://localhost:5555"
export ZMQ_SUB_URL="tcp://localhost:5558"

# Configuration Prisma
export PRISMA_SCHEMA_PATH="../shared/prisma/schema.prisma"

echo -e "${BLUE}📋 Configuration de l'environnement LOCAL:${NC}"
echo -e "  ${GREEN}NODE_ENV:${NC} $NODE_ENV"
echo -e "  ${GREEN}DATABASE_URL:${NC} ${DATABASE_URL/\/\/.*@/\/\/***@}"
echo -e "  ${GREEN}Frontend:${NC} $FRONTEND_URL"
echo -e "  ${GREEN}Gateway:${NC} $GATEWAY_URL"
echo -e "  ${GREEN}Translator:${NC} $TRANSLATOR_URL"
echo ""

# Fonction pour vérifier si un port est occupé
check_port() {
    local port=$1
    local service=$2
    if lsof -ti:$port >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $port déjà occupé ($service)${NC}"
        return 1
    fi
    return 0
}

# Fonction pour attendre qu'un service soit prêt
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Attente du service $service_name...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name est prêt !${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ Timeout: $service_name n'est pas prêt après $((max_attempts * 2)) secondes${NC}"
    return 1
}

# Vérification des ports
echo -e "${BLUE}🔍 Vérification des ports...${NC}"
ports_ok=true

if ! check_port 3000 "Gateway"; then ports_ok=false; fi
if ! check_port 3100 "Frontend"; then ports_ok=false; fi
if ! check_port 8000 "Translator"; then ports_ok=false; fi

if [ "$ports_ok" = false ]; then
    echo -e "${RED}❌ Certains ports sont occupés. Arrêtez les services en cours.${NC}"
    echo -e "${YELLOW}💡 Utilisez: pkill -f 'node.*server.js' ou pkill -f 'python.*main.py'${NC}"
    exit 1
fi

# Démarrage des services Docker (infrastructure)
echo -e "${BLUE}🐳 Démarrage des services Docker (infrastructure)...${NC}"
cd /Users/smpceo/Downloads/Meeshy/meeshy

# Démarrer seulement les services d'infrastructure avec le docker-compose de dev
docker-compose -f docker-compose.dev.yml up -d

echo -e "${YELLOW}⏳ Attente du démarrage des services Docker...${NC}"
sleep 10

# Vérification des services Docker
echo -e "${BLUE}📊 Statut des services Docker:${NC}"
docker-compose -f docker-compose.dev.yml ps

# Vérifier la connectivité MongoDB
echo -e "${BLUE}🔍 Test de connectivité MongoDB...${NC}"
if ! wait_for_service "mongodb://localhost:27017" "MongoDB"; then
    # Essayer avec netcat comme fallback
    if nc -z localhost 27017; then
        echo -e "${GREEN}✅ MongoDB est accessible sur le port 27017${NC}"
    else
        echo -e "${RED}❌ MongoDB n'est pas accessible${NC}"
        exit 1
    fi
fi

# Vérifier la connectivité Redis
echo -e "${BLUE}🔍 Test de connectivité Redis...${NC}"
if nc -z localhost 6379; then
    echo -e "${GREEN}✅ Redis est accessible sur le port 6379${NC}"
else
    echo -e "${RED}❌ Redis n'est pas accessible${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Services Docker démarrés avec succès !${NC}"
echo ""

# Démarrage des services Node (en arrière-plan)
echo -e "${BLUE}🚀 Démarrage des services Node.js...${NC}"

# Démarrer le Translator en arrière-plan
echo -e "${PURPLE}🔤 Démarrage du Translator...${NC}"
cd /Users/smpceo/Downloads/Meeshy/meeshy/translator
chmod +x translator.sh
nohup ./translator.sh > translator.log 2>&1 &
TRANSLATOR_PID=$!
echo "PID Translator: $TRANSLATOR_PID"

# Attendre que le translator soit prêt
sleep 5
if ! wait_for_service "http://localhost:8000/health" "Translator"; then
    echo -e "${YELLOW}⚠️  Translator pas encore prêt, continuons...${NC}"
fi

# Démarrer le Gateway en arrière-plan
echo -e "${PURPLE}🌐 Démarrage du Gateway...${NC}"
cd /Users/smpceo/Downloads/Meeshy/meeshy/gateway
chmod +x gateway.sh
nohup ./gateway.sh > gateway.log 2>&1 &
GATEWAY_PID=$!
echo "PID Gateway: $GATEWAY_PID"

# Attendre que le gateway soit prêt
sleep 5
if ! wait_for_service "http://localhost:3000/health" "Gateway"; then
    echo -e "${YELLOW}⚠️  Gateway pas encore prêt, continuons...${NC}"
fi

# Démarrer le Frontend en arrière-plan
echo -e "${PURPLE}🎨 Démarrage du Frontend...${NC}"
cd /Users/smpceo/Downloads/Meeshy/meeshy/frontend
chmod +x frontend.sh
nohup ./frontend.sh > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "PID Frontend: $FRONTEND_PID"

# Attendre que le frontend soit prêt
sleep 8
if ! wait_for_service "http://localhost:3100" "Frontend"; then
    echo -e "${YELLOW}⚠️  Frontend pas encore prêt, continuons...${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Environnement Meeshy LOCAL démarré avec succès !${NC}"
echo ""
echo -e "${CYAN}🌐 URLs d'accès:${NC}"
echo -e "  ${GREEN}Frontend:${NC}   http://localhost:3100"
echo -e "  ${GREEN}Gateway:${NC}    http://localhost:3000"
echo -e "  ${GREEN}Translator:${NC} http://localhost:8000"
echo -e "  ${GREEN}MongoDB:${NC}    mongodb://localhost:27017"
echo -e "  ${GREEN}Redis:${NC}      redis://localhost:6379"
echo ""
echo -e "${CYAN}📊 Process IDs:${NC}"
echo -e "  ${GREEN}Translator:${NC} $TRANSLATOR_PID"
echo -e "  ${GREEN}Gateway:${NC}    $GATEWAY_PID"
echo -e "  ${GREEN}Frontend:${NC}   $FRONTEND_PID"
echo ""
echo -e "${CYAN}📝 Logs des services:${NC}"
echo -e "  ${GREEN}Translator:${NC} tail -f /Users/smpceo/Downloads/Meeshy/meeshy/translator/translator.log"
echo -e "  ${GREEN}Gateway:${NC}    tail -f /Users/smpceo/Downloads/Meeshy/meeshy/gateway/gateway.log"
echo -e "  ${GREEN}Frontend:${NC}   tail -f /Users/smpceo/Downloads/Meeshy/meeshy/frontend/frontend.log"
echo ""
echo -e "${CYAN}🛑 Pour arrêter les services:${NC}"
echo -e "  ${YELLOW}./scripts/development/stop-local.sh${NC}"
echo ""
echo -e "${PURPLE}🚀 Environnement de développement LOCAL prêt !${NC}"
