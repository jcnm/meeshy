#!/bin/bash

# Script pour démarrer Meeshy avec des bases de données externes
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Démarrage de Meeshy avec bases de données externes${NC}"
echo "=================================================="

# Vérifier que docker-compose est disponible
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose n'est pas installé${NC}"
    exit 1
fi

# Démarrer les services externes
echo -e "${BLUE}🔧 Démarrage de PostgreSQL et Redis...${NC}"
docker-compose -f docker-compose.external.yml up -d

# Attendre que les services soient prêts
echo -e "${BLUE}⏳ Attente que les services soient prêts...${NC}"
sleep 10

# Vérifier la santé des services
echo -e "${BLUE}🔍 Vérification de la santé des services...${NC}"

# Vérifier PostgreSQL
if docker-compose -f docker-compose.external.yml exec -T postgres pg_isready -U meeshy -d meeshy > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL est prêt${NC}"
else
    echo -e "${RED}❌ PostgreSQL n'est pas prêt${NC}"
    exit 1
fi

# Vérifier Redis
if docker-compose -f docker-compose.external.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis est prêt${NC}"
else
    echo -e "${RED}❌ Redis n'est pas prêt${NC}"
    exit 1
fi

# Créer un fichier d'environnement temporaire pour les services externes
echo -e "${BLUE}🔧 Configuration de l'environnement...${NC}"
cat > env.external.tmp << EOF
# Configuration pour bases de données externes
USE_EXTERNAL_DB=true
START_POSTGRES=false
START_REDIS=false

# Configuration PostgreSQL externe
POSTGRES_DB=meeshy
POSTGRES_USER=meeshy
POSTGRES_PASSWORD=MeeshyP@ssword
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Configuration Redis externe
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# URLs de base de données
DATABASE_URL=postgresql://meeshy:MeeshyP@ssword@localhost:5432/meeshy
REDIS_URL=redis://localhost:6379

# Autres variables d'environnement (copiées de env.docker)
$(grep -v "^#" env.docker | grep -v "^$" | grep -v "USE_EXTERNAL_DB\|START_POSTGRES\|START_REDIS\|POSTGRES_\|REDIS_\|DATABASE_URL\|REDIS_URL")
EOF

# Démarrer Meeshy avec les services externes
echo -e "${BLUE}🚀 Démarrage de Meeshy...${NC}"
./start-meeshy-docker.sh --external-db --env-file env.external.tmp

# Nettoyer
rm -f env.external.tmp
