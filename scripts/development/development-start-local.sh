#!/bin/bash

# 🚀 Script de démarrage pour l'environnement de développement LOCAL
# Ce script démarre l'environnement complet Meeshy en mode développement
# - Services Docker: MongoDB, Redis
# - Services Node: Gateway, Frontend, Translator (via scripts .sh)
# - Gestion propre de l'arrêt avec Ctrl+C
set -e

# Variables globales pour le nettoyage
TRANSLATOR_PID=""
GATEWAY_PID=""
FRONTEND_PID=""
DOCKER_COMPOSE_STARTED=false

# Fonction de nettoyage appelée lors de l'arrêt
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Arrêt en cours... (Ctrl+C détecté)${NC}"
    
    # Arrêter les services Node.js
    if [ -n "$TRANSLATOR_PID" ] && kill -0 "$TRANSLATOR_PID" 2>/dev/null; then
        echo -e "${YELLOW}🛑 Arrêt du Translator (PID: $TRANSLATOR_PID)${NC}"
        kill -TERM "$TRANSLATOR_PID" 2>/dev/null || true
    fi
    
    if [ -n "$GATEWAY_PID" ] && kill -0 "$GATEWAY_PID" 2>/dev/null; then
        echo -e "${YELLOW}🛑 Arrêt du Gateway (PID: $GATEWAY_PID)${NC}"
        kill -TERM "$GATEWAY_PID" 2>/dev/null || true
    fi
    
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo -e "${YELLOW}🛑 Arrêt du Frontend (PID: $FRONTEND_PID)${NC}"
        kill -TERM "$FRONTEND_PID" 2>/dev/null || true
    fi
    
    # Arrêter les services Docker
    if [ "$DOCKER_COMPOSE_STARTED" = true ]; then
        echo -e "${YELLOW}🐳 Arrêt des services Docker...${NC}"
        cd /Users/smpceo/Downloads/Meeshy/meeshy
        docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Arrêt terminé proprement${NC}"
    exit 0
}

# Capturer les signaux pour un arrêt propre
trap cleanup SIGINT SIGTERM

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
echo -e "${PURPLE}   Utilisez Ctrl+C pour arrêter proprement tous les services${NC}"
echo ""

# Export et configuration des variables d'environnement pour localhost
echo -e "${BLUE}🔧 Configuration des variables d'environnement...${NC}"

# Variables d'environnement pour le développement LOCAL
export NODE_ENV="development"
export ENVIRONMENT="local"

# Base de données et cache (Docker sur localhost)
export DATABASE_TYPE="MONGODB"
export DATABASE_URL="mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin&replicaSet=rs0"
export REDIS_URL="redis://localhost:6379"

# URLs des services (natifs sur localhost)
export TRANSLATOR_URL="http://localhost:8000"
export GATEWAY_URL="http://localhost:3000"
export FRONTEND_URL="http://localhost:3100"

# Configuration WebSocket et API pour localhost
export NEXT_PUBLIC_API_URL="http://localhost:3000"
export NEXT_PUBLIC_TRANSLATION_URL="http://localhost:8000"
export NEXT_PUBLIC_WS_URL="ws://localhost:3000/api/ws"

# Configuration ZMQ (communication inter-services sur localhost)
export ZMQ_PUSH_URL="tcp://localhost:5555"
export ZMQ_SUB_URL="tcp://localhost:5558"

# Configuration Prisma
export PRISMA_SCHEMA_PATH="../shared/prisma/schema.prisma"

# Configuration ML/Translator pour dev
export ML_BATCH_SIZE="16"
export TRANSLATION_CACHE_TTL="3600"
export SUPPORTED_LANGUAGES="fr,en,es,de,pt,zh,ja,ar"
export DEFAULT_LANGUAGE="fr"
export AUTO_DETECT_LANGUAGE="true"

# Configuration sécurité (dev uniquement)
export JWT_SECRET="dev-jwt-secret-key-change-in-production"
export CORS_ORIGIN="http://localhost:3100"

# Configuration logging
export LOG_LEVEL="debug"
export LOG_FORMAT="pretty"

# Écrire les variables dans les fichiers .env.local pour chaque service
echo -e "${YELLOW}📝 Création des fichiers .env.local...${NC}"

# Fichier .env.local global
cat > /Users/smpceo/Downloads/Meeshy/meeshy/.env.local << EOF
NODE_ENV=development
ENVIRONMENT=local
DATABASE_URL=mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin&replicaSet=rs0
REDIS_URL=redis://localhost:6379
TRANSLATOR_URL=http://localhost:8000
GATEWAY_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3100
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_TRANSLATION_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
ZMQ_PUSH_URL=tcp://localhost:5555
ZMQ_SUB_URL=tcp://localhost:5558
PRISMA_SCHEMA_PATH=../shared/prisma/schema.prisma
JWT_SECRET=dev-jwt-secret-key-change-in-production
CORS_ORIGIN=http://localhost:3100

# Chemins locaux pour le développement (pas Docker)
MODELS_PATH=./models
TORCH_HOME=./models
HF_HOME=./models
MODEL_CACHE_DIR=./models
CACHE_DIR=./cache
LOG_DIR=./logs
PRISMA_CLIENT_OUTPUT_DIRECTORY=./client
EOF

# Frontend .env.local
cat > /Users/smpceo/Downloads/Meeshy/meeshy/frontend/.env.local << EOF
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_TRANSLATION_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
EOF

# Gateway .env.local  
cat > /Users/smpceo/Downloads/Meeshy/meeshy/gateway/.env.local << EOF
NODE_ENV=development
DATABASE_URL=mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin&replicaSet=rs0
REDIS_URL=redis://localhost:6379
TRANSLATOR_URL=http://localhost:8000
ZMQ_PUSH_URL=tcp://localhost:5555
ZMQ_SUB_URL=tcp://localhost:5558
PRISMA_SCHEMA_PATH=../shared/prisma/schema.prisma
PORT=3000
CORS_ORIGIN=http://localhost:3100
JWT_SECRET=dev-jwt-secret-key-change-in-production

# Chemins locaux pour le développement
MODELS_PATH=./models
TORCH_HOME=./models
HF_HOME=./models
MODEL_CACHE_DIR=./models
CACHE_DIR=./cache
LOG_DIR=./logs
PRISMA_CLIENT_OUTPUT_DIRECTORY=./client
EOF

# Translator .env.local
cat > /Users/smpceo/Downloads/Meeshy/meeshy/translator/.env.local << EOF
NODE_ENV=development
DATABASE_URL=mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin&replicaSet=rs0
REDIS_URL=redis://localhost:6379
ZMQ_PUSH_URL=tcp://localhost:5555
ZMQ_SUB_URL=tcp://localhost:5558
PRISMA_SCHEMA_PATH=../shared/prisma/schema.prisma
ML_BATCH_SIZE=16
TRANSLATION_CACHE_TTL=3600
SUPPORTED_LANGUAGES=fr,en,es,de,pt,zh,ja,ar
DEFAULT_LANGUAGE=fr
PORT=8000

# Chemins locaux pour le développement
MODELS_PATH=./models
TORCH_HOME=./models
HF_HOME=./models
MODEL_CACHE_DIR=./models
CACHE_DIR=./cache
LOG_DIR=./logs
PRISMA_CLIENT_OUTPUT_DIRECTORY=./client
EOF

echo -e "${BLUE}📋 Configuration de l'environnement LOCAL:${NC}"
echo -e "  ${GREEN}NODE_ENV:${NC} $NODE_ENV"
echo -e "  ${GREEN}DATABASE_URL:${NC} ${DATABASE_URL/\/\/.*@/\/\/***@}"
echo -e "  ${GREEN}Frontend:${NC} $FRONTEND_URL"
echo -e "  ${GREEN}Gateway:${NC} $GATEWAY_URL"
echo -e "  ${GREEN}Translator:${NC} $TRANSLATOR_URL"
echo ""

# Fonction pour vérifier si shared a été modifié et doit être redistribué
check_and_distribute_shared() {
    echo -e "${BLUE}🔍 Vérification de la distribution de /shared...${NC}"
    
    local shared_dir="/Users/smpceo/Downloads/Meeshy/meeshy/shared"
    local gateway_version="/Users/smpceo/Downloads/Meeshy/meeshy/gateway/shared/version.txt"
    local translator_version="/Users/smpceo/Downloads/Meeshy/meeshy/translator/shared/version.txt"
    
    local needs_distribution=false
    
    # Vérifier si les fichiers de version existent
    if [[ ! -f "$gateway_version" ]] || [[ ! -f "$translator_version" ]]; then
        echo -e "${YELLOW}📦 Première distribution ou fichiers manquants détectés${NC}"
        needs_distribution=true
    else
        # Comparer les timestamps des fichiers dans shared/ avec la dernière distribution
        local gateway_version_timestamp=$(stat -f %m "$gateway_version" 2>/dev/null || echo "0")
        local translator_version_timestamp=$(stat -f %m "$translator_version" 2>/dev/null || echo "0")
        local min_version_timestamp=$((gateway_version_timestamp < translator_version_timestamp ? gateway_version_timestamp : translator_version_timestamp))
        
        # Vérifier si des fichiers dans shared/ sont plus récents
        local shared_files_newer=$(find "$shared_dir" -type f \( -name "*.prisma" -o -name "*.proto" -o -name "*.ts" -o -name "*.js" \) -newer "$gateway_version" 2>/dev/null | wc -l)
        
        if [[ $shared_files_newer -gt 0 ]]; then
            echo -e "${YELLOW}📦 Modifications détectées dans /shared depuis la dernière distribution${NC}"
            needs_distribution=true
        else
            echo -e "${GREEN}✅ /shared est à jour, pas de redistribution nécessaire${NC}"
        fi
    fi
    
    if [[ "$needs_distribution" == "true" ]]; then
        echo -e "${BLUE}🚀 Distribution de /shared en cours...${NC}"
        
        cd "$shared_dir"
        
        # Vérifier si le script distribute existe
        if [[ ! -f "scripts/distribute.sh" ]]; then
            echo -e "${RED}❌ Script distribute.sh non trouvé dans /shared/scripts/${NC}"
            return 1
        fi
        
        # Exécuter la distribution
        chmod +x scripts/distribute.sh
        if ./scripts/distribute.sh; then
            echo -e "${GREEN}✅ Distribution de /shared terminée avec succès${NC}"
        else
            echo -e "${RED}❌ Erreur lors de la distribution de /shared${NC}"
            return 1
        fi
        
        # Retourner au répertoire principal
        cd /Users/smpceo/Downloads/Meeshy/meeshy
        
        return 0
    fi
    
    return 0
}

# Fonction pour générer les clients Prisma si nécessaire
generate_prisma_clients() {
    echo -e "${BLUE}🔧 Génération des clients Prisma...${NC}"
    
    # Gateway - Client TypeScript
    echo -e "${PURPLE}📦 Génération du client Prisma pour Gateway...${NC}"
    cd /Users/smpceo/Downloads/Meeshy/meeshy/gateway
    if [[ -f "./shared/prisma/schema.prisma" ]]; then
        if pnpm prisma generate --schema=./shared/prisma/schema.prisma; then
            echo -e "${GREEN}✅ Client Prisma Gateway généré avec succès${NC}"
        else
            echo -e "${RED}❌ Erreur lors de la génération du client Prisma Gateway${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  Schema Prisma non trouvé pour Gateway${NC}"
    fi
    
    # Translator - Client Python
    echo -e "${PURPLE}🐍 Génération du client Prisma pour Translator...${NC}"
    cd /Users/smpceo/Downloads/Meeshy/meeshy/translator
    if [[ -f "shared/prisma/schema.prisma" ]]; then
        # Vérifier si Python et Prisma sont disponibles
        if command -v python3 >/dev/null 2>&1; then
            python3 -m venv .venv
            if [ ! -f ".venv/bin/activate" ]; then
                echo -e "${RED}❌ Script d'activation .venv/bin/activate non trouvé"
                exit 1
            fi
            echo -e "${GREEN}✅ Script d'activation .venv/bin/activate trouvé"
            source .venv/bin/activate 
            echo -e "${GREEN}✅ Environnement virtuel trouvé"
            if ! command -v prisma >/dev/null 2>&1; then
                echo -e "${RED}❌ Installation de prisma non trouvé"
                python3 -m pip install prisma
            fi
            echo -e "${GREEN}✅ Prisma installé"
            echo -e "${BLUE}🔧 Génération du client Prisma pour Translator...${NC}"
            if prisma generate --schema=shared/prisma/schema.prisma; then
                echo -e "${GREEN}✅ Client Prisma Translator généré avec succès${NC}"
            else
                echo -e "${YELLOW}⚠️  Génération du client Prisma Python échouée, continuons...${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Python3 non disponible, génération Prisma Python ignorée${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Schema Prisma non trouvé pour Translator${NC}"
    fi
    
    # Retourner au répertoire principal
    cd /Users/smpceo/Downloads/Meeshy/meeshy
    
    return 0
}

# Exécuter la vérification et distribution de shared
check_and_distribute_shared

# Générer les clients Prisma après la distribution
generate_prisma_clients

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
    local max_attempts=3
    local attempt=1
    
    echo -e "${YELLOW}⏳ Attente du service $service_name...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if mongosh --eval "db.adminCommand('ping')" 2>&1; then
            echo -e "${GREEN}✅ $service_name est prêt !${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
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
DOCKER_COMPOSE_STARTED=true

echo -e "${YELLOW}⏳ Attente du démarrage des services Docker...${NC}"
sleep 2

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

# Initialiser le replica set MongoDB si nécessaire
echo -e "${BLUE}🔧 Vérification du replica set MongoDB...${NC}"
if [[ -f "scripts/development/init-mongodb-replica.sh" ]]; then
    echo -e "${YELLOW}🚀 Initialisation du replica set MongoDB...${NC}"
    if ./scripts/development/init-mongodb-replica.sh; then
        echo -e "${GREEN}✅ Replica set MongoDB configuré${NC}"
    else
        echo -e "${YELLOW}⚠️  Replica set MongoDB déjà configuré ou erreur mineure${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Script d'initialisation du replica set non trouvé${NC}"
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
sleep 2
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
sleep 2
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
sleep 2
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
echo -e "${PURPLE}🛑 Pour arrêter tous les services: Appuyez sur Ctrl+C${NC}"
echo -e "${PURPLE}🚀 Environnement de développement LOCAL prêt !${NC}"

# Boucle infinie pour maintenir le script actif et permettre l'arrêt avec Ctrl+C
echo -e "${YELLOW}⏳ Services en cours d'exécution... (Ctrl+C pour arrêter)${NC}"
while true; do
    # Vérifier que les services sont toujours en cours
    services_running=0
    
    if [ -n "$TRANSLATOR_PID" ] && kill -0 "$TRANSLATOR_PID" 2>/dev/null; then
        services_running=$((services_running + 1))
    else
        echo -e "${RED}⚠️  Translator arrêté inattendu${NC}"
    fi
    
    if [ -n "$GATEWAY_PID" ] && kill -0 "$GATEWAY_PID" 2>/dev/null; then
        services_running=$((services_running + 1))
    else
        echo -e "${RED}⚠️  Gateway arrêté inattendu${NC}"
    fi
    
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        services_running=$((services_running + 1))
    else
        echo -e "${RED}⚠️  Frontend arrêté inattendu${NC}"
    fi
    
    if [ $services_running -eq 0 ]; then
        echo -e "${RED}❌ Tous les services sont arrêtés${NC}"
        cleanup
    fi
    
    sleep 2
done
