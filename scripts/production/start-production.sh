#!/bin/bash

# 🚀 Script de démarrage pour l'environnement de PRODUCTION (DigitalOcean)
# Ce script démarre l'environnement complet Meeshy en mode production
# - Tous les services via Docker Compose avec Traefik
set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 Démarrage de l'environnement Meeshy PRODUCTION (DigitalOcean)${NC}"
echo -e "${YELLOW}   Architecture: Tous services Docker + Traefik SSL${NC}"
echo ""

# Variables d'environnement pour la PRODUCTION
export NODE_ENV="production"
export ENVIRONMENT="production"

# Charger la configuration de production
if [ -f ".env.production" ]; then
    echo -e "${BLUE}📋 Chargement de la configuration production (.env.production)${NC}"
    set -a
    source .env.production
    set +a
else
    echo -e "${RED}❌ Fichier .env.production non trouvé !${NC}"
    echo -e "${YELLOW}💡 Créez le fichier avec: cp env.digitalocean .env.production${NC}"
    exit 1
fi

# Vérification des variables critiques
echo -e "${BLUE}🔍 Vérification de la configuration production...${NC}"

REQUIRED_VARS=(
    "DATABASE_URL"
    "REDIS_URL"
    "DOMAIN_NAME"
    "CERTBOT_EMAIL"
    "TRANSLATOR_IMAGE"
    "GATEWAY_IMAGE"
    "FRONTEND_IMAGE"
)

missing_vars=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ Variables manquantes dans .env.production:${NC}"
    for var in "${missing_vars[@]}"; do
        echo -e "  ${RED}- $var${NC}"
    done
    echo -e "${YELLOW}💡 Configurez ces variables dans .env.production${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuration production valide${NC}"

echo -e "${BLUE}📋 Configuration de l'environnement PRODUCTION:${NC}"
echo -e "  ${GREEN}NODE_ENV:${NC} $NODE_ENV"
echo -e "  ${GREEN}Domain:${NC} $DOMAIN_NAME"
echo -e "  ${GREEN}Email SSL:${NC} $CERTBOT_EMAIL"
echo -e "  ${GREEN}Database:${NC} ${DATABASE_URL/\/\/.*@/\/\/***@}"
echo -e "  ${GREEN}Translator Image:${NC} $TRANSLATOR_IMAGE"
echo -e "  ${GREEN}Gateway Image:${NC} $GATEWAY_IMAGE"
echo -e "  ${GREEN}Frontend Image:${NC} $FRONTEND_IMAGE"
echo ""

# Fonction pour attendre qu'un service soit prêt
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Attente du service $service_name...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -k "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name est prêt !${NC}"
            return 0
        fi
        echo -n "."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ Timeout: $service_name n'est pas prêt après $((max_attempts * 5)) secondes${NC}"
    return 1
}

# Vérification Docker et Docker Compose
echo -e "${BLUE}🔍 Vérification de Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker n'est pas installé${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose n'est pas installé${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker et Docker Compose disponibles${NC}"

# Pull des dernières images
echo -e "${BLUE}📦 Pull des dernières images Docker...${NC}"
docker-compose -f docker-compose.prod.yml pull

# Arrêt des anciens conteneurs (si ils existent)
echo -e "${BLUE}🛑 Arrêt des anciens conteneurs...${NC}"
docker-compose -f docker-compose.prod.yml down --remove-orphans

# Démarrage des services en production
echo -e "${BLUE}🚀 Démarrage des services en production...${NC}"
docker-compose -f docker-compose.prod.yml up -d

echo -e "${YELLOW}⏳ Attente du démarrage des services...${NC}"
sleep 20

# Vérification des services
echo -e "${BLUE}📊 Statut des services:${NC}"
docker-compose -f docker-compose.prod.yml ps

# Test de connectivité des services
echo -e "${BLUE}🔍 Test de connectivité des services...${NC}"

# Test Traefik
if wait_for_service "http://localhost:8080" "Traefik Dashboard"; then
    echo -e "${GREEN}✅ Traefik Dashboard accessible${NC}"
fi

# Test Frontend
if wait_for_service "https://$DOMAIN_NAME" "Frontend"; then
    echo -e "${GREEN}✅ Frontend accessible${NC}"
fi

# Test Gateway
if wait_for_service "https://gate.$DOMAIN_NAME/health" "Gateway"; then
    echo -e "${GREEN}✅ Gateway accessible${NC}"
fi

# Test Translator
if wait_for_service "https://ml.$DOMAIN_NAME/health" "Translator"; then
    echo -e "${GREEN}✅ Translator accessible${NC}"
fi

# Affichage des logs en cas de problème
echo -e "${BLUE}📝 Logs récents des services:${NC}"
echo -e "${YELLOW}=== Traefik ===${NC}"
docker-compose -f docker-compose.prod.yml logs --tail=10 traefik

echo -e "${YELLOW}=== Frontend ===${NC}"
docker-compose -f docker-compose.prod.yml logs --tail=10 frontend

echo -e "${YELLOW}=== Gateway ===${NC}"
docker-compose -f docker-compose.prod.yml logs --tail=10 gateway

echo -e "${YELLOW}=== Translator ===${NC}"
docker-compose -f docker-compose.prod.yml logs --tail=10 translator

echo ""
echo -e "${GREEN}🎉 Environnement Meeshy PRODUCTION démarré avec succès !${NC}"
echo ""
echo -e "${CYAN}🌐 URLs d'accès PRODUCTION:${NC}"
echo -e "  ${GREEN}Frontend:${NC}        https://$DOMAIN_NAME"
echo -e "  ${GREEN}Gateway API:${NC}     https://gate.$DOMAIN_NAME"
echo -e "  ${GREEN}Translator API:${NC}  https://ml.$DOMAIN_NAME"
echo -e "  ${GREEN}Traefik Dashboard:${NC} http://$DOMAIN_NAME:8080"
echo ""
echo -e "${CYAN}📊 Commandes utiles:${NC}"
echo -e "  ${GREEN}Logs:${NC}            docker-compose -f docker-compose.prod.yml logs -f [service]"
echo -e "  ${GREEN}Status:${NC}          docker-compose -f docker-compose.prod.yml ps"
echo -e "  ${GREEN}Restart:${NC}         docker-compose -f docker-compose.prod.yml restart [service]"
echo -e "  ${GREEN}Stop:${NC}            ./scripts/production/stop-production.sh"
echo ""
echo -e "${CYAN}🔒 SSL/TLS:${NC}"
echo -e "  ${GREEN}Certificats:${NC}     Let's Encrypt automatique via Traefik"
echo -e "  ${GREEN}Email:${NC}           $CERTBOT_EMAIL"
echo ""
echo -e "${PURPLE}🚀 Environnement de PRODUCTION prêt !${NC}"
