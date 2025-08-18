#!/bin/bash

# Script de debug pour tester l'image Docker
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Debug de l'image Docker Meeshy${NC}"
echo "================================"

# Tester l'image directement
echo -e "${BLUE}🧪 Test de l'image...${NC}"

# Tester les dépendances Python
echo -e "${BLUE}🐍 Test des dépendances Python...${NC}"
docker run --rm meeshy:latest python -c "
import zmq
import torch
import transformers
import fastapi
import redis
import prisma
print('✅ Toutes les dépendances Python sont installées')
"

# Tester les dépendances Node.js
echo -e "${BLUE}📦 Test des dépendances Node.js...${NC}"
docker run --rm meeshy:latest bash -c "
tsx --version
pnpm --version
echo '✅ Toutes les dépendances Node.js sont installées'
"

# Tester le démarrage du translator
echo -e "${BLUE}🤖 Test du démarrage du translator...${NC}"
docker run --rm -d --name meeshy-debug meeshy:latest
sleep 5

# Vérifier les logs
echo -e "${BLUE}📋 Logs du conteneur...${NC}"
docker logs meeshy-debug

# Vérifier les processus
echo -e "${BLUE}🔍 Processus dans le conteneur...${NC}"
docker exec meeshy-debug ps aux

# Vérifier les fichiers de log
echo -e "${BLUE}📄 Fichiers de log...${NC}"
docker exec meeshy-debug ls -la /app/logs/

# Nettoyer
docker stop meeshy-debug 2>/dev/null || true
docker rm meeshy-debug 2>/dev/null || true

echo -e "${GREEN}✅ Debug terminé${NC}"
