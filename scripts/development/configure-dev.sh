#!/bin/bash

# 🔧 Configuration de l'environnement de développement LOCAL
# Ce script configure les variables d'environnement pour le développement
set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔧 Configuration de l'environnement de développement LOCAL${NC}"

# Configuration de base
export NODE_ENV="development"
export ENVIRONMENT="local"

# Configuration de la base de données
export DATABASE_TYPE="MONGODB"
export DATABASE_URL="mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin"
export DATABASE_USER="meeshy"
export DATABASE_PASSWORD="MeeshyPassword123"
export DATABASE_NAME="meeshy"

# Configuration Redis
export REDIS_URL="redis://localhost:6379"
export REDIS_HOST="localhost"
export REDIS_PORT="6379"

# Configuration des services
export TRANSLATOR_URL="http://localhost:8000"
export GATEWAY_URL="http://localhost:3000"
export FRONTEND_URL="http://localhost:3100"

# Configuration Frontend (Next.js)
export NEXT_PUBLIC_API_URL="http://localhost:3000"
export NEXT_PUBLIC_TRANSLATION_URL="http://localhost:8000"
export NEXT_PUBLIC_WS_URL="ws://localhost:3000/api/ws"

# Configuration ZMQ
export ZMQ_PUSH_URL="tcp://localhost:5555"
export ZMQ_SUB_URL="tcp://localhost:5558"

# Configuration Prisma
export PRISMA_SCHEMA_PATH="../shared/prisma/schema.prisma"
export PRISMA_GENERATE_CLIENT="true"
export DATABASE_POOL_SIZE="10"

# Configuration ML/Translator
export ML_BATCH_SIZE="16"
export TRANSLATION_CACHE_TTL="3600"
export SUPPORTED_LANGUAGES="fr,en,es,de,pt,zh,ja,ar"
export DEFAULT_LANGUAGE="fr"
export AUTO_DETECT_LANGUAGE="true"

# Configuration des ports
export FRONTEND_PORT="3100"
export GATEWAY_PORT="3000"
export TRANSLATOR_PORT="8000"
export DATABASE_PORT="27017"
export REDIS_PORT="6379"

# Configuration de sécurité (dev)
export JWT_SECRET="dev-jwt-secret-key-change-in-production"
export CORS_ORIGIN="http://localhost:3100"

# Configuration de logging
export LOG_LEVEL="debug"
export LOG_FORMAT="pretty"

echo -e "${GREEN}✅ Variables d'environnement configurées pour le développement LOCAL${NC}"
echo -e "${BLUE}📋 Configuration active:${NC}"
echo -e "  ${GREEN}Environment:${NC} $ENVIRONMENT"
echo -e "  ${GREEN}Node Env:${NC} $NODE_ENV"
echo -e "  ${GREEN}Database:${NC} ${DATABASE_URL/\/\/.*@/\/\/***@}"
echo -e "  ${GREEN}Frontend:${NC} $FRONTEND_URL"
echo -e "  ${GREEN}Gateway:${NC} $GATEWAY_URL"
echo -e "  ${GREEN}Translator:${NC} $TRANSLATOR_URL"

# Créer le fichier .env.local pour le développement
DEV_ENV_FILE="/Users/smpceo/Downloads/Meeshy/meeshy/.env.local"

echo -e "${YELLOW}📝 Création du fichier .env.local...${NC}"

cat > "$DEV_ENV_FILE" << EOF
# Configuration de l'environnement de développement LOCAL
# Généré automatiquement par scripts/development/configure-dev.sh

NODE_ENV=development
ENVIRONMENT=local

# Base de données
DATABASE_TYPE=MONGODB
DATABASE_URL=mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin
DATABASE_USER=meeshy
DATABASE_PASSWORD=MeeshyPassword123
DATABASE_NAME=meeshy

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# URLs des services
TRANSLATOR_URL=http://localhost:8000
GATEWAY_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3100

# Configuration Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_TRANSLATION_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/ws

# Configuration ZMQ
ZMQ_PUSH_URL=tcp://localhost:5555
ZMQ_SUB_URL=tcp://localhost:5558

# Configuration Prisma
PRISMA_SCHEMA_PATH=../shared/prisma/schema.prisma
PRISMA_GENERATE_CLIENT=true
DATABASE_POOL_SIZE=10

# Configuration ML
ML_BATCH_SIZE=16
TRANSLATION_CACHE_TTL=3600
SUPPORTED_LANGUAGES=fr,en,es,de,pt,zh,ja,ar
DEFAULT_LANGUAGE=fr
AUTO_DETECT_LANGUAGE=true

# Ports
FRONTEND_PORT=3100
GATEWAY_PORT=3000
TRANSLATOR_PORT=8000
DATABASE_PORT=27017
REDIS_PORT=6379

# Sécurité (dev)
JWT_SECRET=dev-jwt-secret-key-change-in-production
CORS_ORIGIN=http://localhost:3100

# Logging
LOG_LEVEL=debug
LOG_FORMAT=pretty
EOF

echo -e "${GREEN}✅ Fichier .env.local créé: $DEV_ENV_FILE${NC}"

# Créer les fichiers .env spécifiques pour chaque service
echo -e "${YELLOW}📝 Création des fichiers .env pour les services...${NC}"

# Frontend .env.local
FRONTEND_ENV="/Users/smpceo/Downloads/Meeshy/meeshy/frontend/.env.local"
cat > "$FRONTEND_ENV" << EOF
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_TRANSLATION_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/ws
EOF

# Gateway .env.local
GATEWAY_ENV="/Users/smpceo/Downloads/Meeshy/meeshy/gateway/.env.local"
cat > "$GATEWAY_ENV" << EOF
NODE_ENV=development
DATABASE_URL=mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin
REDIS_URL=redis://localhost:6379
TRANSLATOR_URL=http://localhost:8000
ZMQ_PUSH_URL=tcp://localhost:5555
ZMQ_SUB_URL=tcp://localhost:5558
PRISMA_SCHEMA_PATH=../shared/prisma/schema.prisma
PORT=3000
CORS_ORIGIN=http://localhost:3100
JWT_SECRET=dev-jwt-secret-key-change-in-production
EOF

# Translator .env.local
TRANSLATOR_ENV="/Users/smpceo/Downloads/Meeshy/meeshy/translator/.env.local"
cat > "$TRANSLATOR_ENV" << EOF
NODE_ENV=development
DATABASE_URL=mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin
REDIS_URL=redis://localhost:6379
ZMQ_PUSH_URL=tcp://localhost:5555
ZMQ_SUB_URL=tcp://localhost:5558
PRISMA_SCHEMA_PATH=../shared/prisma/schema.prisma
ML_BATCH_SIZE=16
TRANSLATION_CACHE_TTL=3600
SUPPORTED_LANGUAGES=fr,en,es,de,pt,zh,ja,ar
DEFAULT_LANGUAGE=fr
PORT=8000
EOF

echo -e "${GREEN}✅ Fichiers .env créés pour tous les services${NC}"

echo ""
echo -e "${CYAN}🎯 Configuration terminée !${NC}"
echo -e "${PURPLE}Vous pouvez maintenant démarrer l'environnement avec:${NC}"
echo -e "  ${YELLOW}./scripts/development/start-local.sh${NC}"
echo ""
