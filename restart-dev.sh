#!/bin/bash

# Script pour redémarrer rapidement le mode développement
set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Redémarrage rapide du mode développement${NC}"
echo -e "${YELLOW}==============================================${NC}"

# Arrêter les conteneurs
echo -e "${YELLOW}🛑 Arrêt des conteneurs...${NC}"
docker-compose -f docker-compose.dev.yml down

# Reconstruire l'image avec les corrections
echo -e "${YELLOW}🔨 Reconstruction de l'image...${NC}"
docker-compose -f docker-compose.dev.yml build --no-cache

# Redémarrer les services
echo -e "${YELLOW}🚀 Redémarrage des services...${NC}"
docker-compose -f docker-compose.dev.yml up -d

# Attendre que les services soient prêts
echo -e "${YELLOW}⏳ Attente que les services soient prêts...${NC}"
sleep 10

# Vérifier le statut
echo -e "${YELLOW}🔍 Vérification du statut...${NC}"
docker-compose -f docker-compose.dev.yml ps

echo -e "${GREEN}✅ Redémarrage terminé !${NC}"
echo -e "${BLUE}📱 Frontend: http://localhost:3100${NC}"
echo -e "${BLUE}🔌 Gateway: http://localhost:3000${NC}"
echo -e "${BLUE}🤖 Translator: http://localhost:8000${NC}"

# Suivre les logs
echo -e "${YELLOW}📋 Affichage des logs (Ctrl+C pour arrêter)...${NC}"
docker-compose -f docker-compose.dev.yml logs -f
