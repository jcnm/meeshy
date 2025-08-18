#!/bin/bash

# Script pour arrêter Meeshy en mode développement
set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛑 Arrêt de Meeshy en mode développement${NC}"
echo -e "${YELLOW}==========================================${NC}"

# Arrêter les conteneurs
echo -e "${YELLOW}🛑 Arrêt des conteneurs...${NC}"
docker-compose -f docker-compose.dev.yml down --remove-orphans

echo -e "${GREEN}✅ Services arrêtés${NC}"
echo -e "${BLUE}💡 Pour redémarrer: ./start-dev.sh${NC}"
