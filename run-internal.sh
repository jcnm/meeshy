#!/bin/bash

# Script pour démarrer Meeshy en mode tout interne
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Démarrage de Meeshy en mode tout interne${NC}"
echo "=============================================="

# Vérifier que l'image existe
if ! docker image inspect meeshy:latest > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Image meeshy:latest non trouvée, construction en cours...${NC}"
    docker build --tag meeshy:latest --file Dockerfile .
fi

# Créer un fichier d'environnement pour le mode interne
echo -e "${BLUE}🔧 Configuration pour le mode interne...${NC}"
cat > env.internal.tmp << EOF
# Configuration pour mode tout interne
USE_EXTERNAL_DB=false
START_POSTGRES=true
START_REDIS=true

# Configuration PostgreSQL interne
POSTGRES_DB=meeshy
POSTGRES_USER=meeshy
POSTGRES_PASSWORD=MeeshyP@ssword
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Configuration Redis interne
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# URLs de base de données internes
DATABASE_URL=postgresql://meeshy:MeeshyP@ssword@localhost:5432/meeshy
REDIS_URL=redis://localhost:6379

# Autres variables d'environnement (copiées de env.docker)
$(grep -v "^#" env.docker | grep -v "^$" | grep -v "USE_EXTERNAL_DB\|START_POSTGRES\|START_REDIS\|POSTGRES_\|REDIS_\|DATABASE_URL\|REDIS_URL")
EOF

# Démarrer Meeshy en mode interne
echo -e "${BLUE}🚀 Démarrage de Meeshy avec PostgreSQL et Redis internes...${NC}"
./start-meeshy-docker.sh --env-file env.internal.tmp

# Nettoyer
rm -f env.internal.tmp
