#!/bin/bash

# Script pour démarrer Meeshy en mode développement
set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Démarrage de Meeshy en mode développement${NC}"
echo -e "${YELLOW}============================================${NC}"

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker n'est pas installé${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose n'est pas installé${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker et Docker Compose trouvés${NC}"

# Créer les répertoires nécessaires
echo -e "${YELLOW}📁 Création des répertoires...${NC}"
mkdir -p logs data

# Arrêter les conteneurs existants
echo -e "${YELLOW}🛑 Arrêt des conteneurs existants...${NC}"
docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true

# Construire l'image de développement
echo -e "${YELLOW}🔨 Construction de l'image de développement...${NC}"
docker-compose -f docker-compose.dev.yml build --no-cache

# Démarrer les services
echo -e "${YELLOW}🚀 Démarrage des services...${NC}"
docker-compose -f docker-compose.dev.yml up -d

# Attendre que les services soient prêts
echo -e "${YELLOW}⏳ Attente que les services soient prêts...${NC}"
sleep 15

# Vérifier le statut des services
echo -e "${YELLOW}🔍 Vérification du statut des services...${NC}"
docker-compose -f docker-compose.dev.yml ps

# Afficher les logs
echo -e "${GREEN}🎉 Meeshy est démarré en mode développement !${NC}"
echo -e "${BLUE}📱 Frontend: http://localhost:3100${NC}"
echo -e "${BLUE}🔌 Gateway: http://localhost:3000${NC}"
echo -e "${BLUE}🤖 Translator: http://localhost:8000${NC}"
echo -e "${BLUE}🗄️ PostgreSQL: localhost:5432${NC}"
echo -e "${BLUE}🔴 Redis: localhost:6379${NC}"
echo ""
echo -e "${YELLOW}📋 Commandes utiles:${NC}"
echo -e "  ${BLUE}Voir les logs:${NC} docker-compose -f docker-compose.dev.yml logs -f"
echo -e "  ${BLUE}Arrêter:${NC} docker-compose -f docker-compose.dev.yml down"
echo -e "  ${BLUE}Redémarrer:${NC} docker-compose -f docker-compose.dev.yml restart"
echo -e "  ${BLUE}Accéder au conteneur:${NC} docker exec -it meeshy-dev bash"
echo ""
echo -e "${GREEN}✨ Le code source est monté en volume - vos modifications seront prises en compte automatiquement !${NC}"

# Suivre les logs
echo -e "${YELLOW}📋 Affichage des logs (Ctrl+C pour arrêter)...${NC}"
docker-compose -f docker-compose.dev.yml logs -f
