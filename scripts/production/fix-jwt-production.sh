#!/bin/bash

# ===== SCRIPT DE CORRECTION JWT POUR PRODUCTION =====
# Ce script corrige le problème de clé JWT incohérente en production
# Il force la réinitialisation de la base de données avec la bonne clé JWT

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Correction du problème JWT en production${NC}"
echo -e "${YELLOW}⚠️  Ce script va réinitialiser la base de données avec la bonne clé JWT${NC}"
echo ""

# Vérifier que nous sommes en production
if [ "$NODE_ENV" != "production" ]; then
    echo -e "${YELLOW}⚠️  NODE_ENV n'est pas défini sur 'production'${NC}"
    echo -e "${YELLOW}   Assurez-vous d'exécuter ce script en production${NC}"
    read -p "Continuer quand même ? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Script annulé${NC}"
        exit 1
    fi
fi

# Charger les variables d'environnement de production
if [ -f "env.production" ]; then
    echo -e "${BLUE}📋 Chargement de la configuration de production...${NC}"
    export $(grep -v '^#' env.production | xargs)
else
    echo -e "${RED}❌ Fichier env.production non trouvé${NC}"
    exit 1
fi

# Charger les secrets de production
if [ -f "secrets/production-secrets.env" ]; then
    echo -e "${BLUE}🔐 Chargement des secrets de production...${NC}"
    export $(grep -v '^#' secrets/production-secrets.env | xargs)
else
    echo -e "${RED}❌ Fichier secrets/production-secrets.env non trouvé${NC}"
    exit 1
fi

# Vérifier que la clé JWT est définie
if [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}❌ JWT_SECRET n'est pas défini${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuration chargée${NC}"
echo -e "${BLUE}🔑 Clé JWT: ${JWT_SECRET:0:20}...${NC}"
echo ""

# Afficher les informations de connexion
echo -e "${BLUE}📊 Configuration de la base de données:${NC}"
echo -e "  ${GREEN}Type:${NC} $DATABASE_TYPE"
echo -e "  ${GREEN}URL:${NC} ${DATABASE_URL/\/\/.*@/\/\/***@}"
echo -e "  ${GREEN}Reset forcé:${NC} $FORCE_DB_RESET"
echo ""

# Confirmation finale
echo -e "${YELLOW}⚠️  ATTENTION: Ce script va:${NC}"
echo -e "  ${YELLOW}1. Arrêter les services en cours${NC}"
echo -e "  ${YELLOW}2. Réinitialiser complètement la base de données${NC}"
echo -e "  ${YELLOW}3. Recréer les utilisateurs avec la bonne clé JWT${NC}"
echo -e "  ${YELLOW}4. Redémarrer les services${NC}"
echo ""

read -p "Êtes-vous sûr de vouloir continuer ? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Script annulé${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Début de la correction JWT...${NC}"

# 1. Arrêter les services
echo -e "${BLUE}🛑 Arrêt des services...${NC}"
docker-compose -f docker-compose.prod.yml down || true

# 2. Forcer la réinitialisation de la base de données
echo -e "${BLUE}🗑️  Réinitialisation de la base de données...${NC}"
export FORCE_DB_RESET=true

# 3. Redémarrer les services avec la bonne configuration
echo -e "${BLUE}🚀 Redémarrage des services avec la bonne clé JWT...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# 4. Attendre que les services soient prêts
echo -e "${BLUE}⏳ Attente du démarrage des services...${NC}"
sleep 30

# 5. Vérifier que les services sont en cours d'exécution
echo -e "${BLUE}🔍 Vérification des services...${NC}"

# Vérifier le Gateway
if curl -s -f http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ Gateway: Opérationnel${NC}"
else
    echo -e "${RED}❌ Gateway: Non accessible${NC}"
fi

# Vérifier le Frontend
if curl -s -f http://localhost:3100 > /dev/null; then
    echo -e "${GREEN}✅ Frontend: Opérationnel${NC}"
else
    echo -e "${RED}❌ Frontend: Non accessible${NC}"
fi

# Vérifier le Translator
if curl -s -f http://localhost:8000/health > /dev/null; then
    echo -e "${GREEN}✅ Translator: Opérationnel${NC}"
else
    echo -e "${RED}❌ Translator: Non accessible${NC}"
fi

# 6. Tester l'authentification
echo -e "${BLUE}🔐 Test de l'authentification...${NC}"

# Tester la connexion admin
ADMIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"'$ADMIN_PASSWORD'"}')

if echo "$ADMIN_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Authentification admin: Succès${NC}"
else
    echo -e "${RED}❌ Authentification admin: Échec${NC}"
    echo -e "${YELLOW}   Réponse: $ADMIN_RESPONSE${NC}"
fi

# Tester la connexion meeshy
MEESHY_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"meeshy","password":"'$MEESHY_PASSWORD'"}')

if echo "$MEESHY_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Authentification meeshy: Succès${NC}"
else
    echo -e "${RED}❌ Authentification meeshy: Échec${NC}"
    echo -e "${YELLOW}   Réponse: $MEESHY_RESPONSE${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Correction JWT terminée !${NC}"
echo ""
echo -e "${BLUE}📋 Informations de connexion:${NC}"
echo -e "  ${GREEN}Admin:${NC} admin / $ADMIN_PASSWORD"
echo -e "  ${GREEN}Meeshy:${NC} meeshy / $MEESHY_PASSWORD"
echo -e "  ${GREEN}Atabeth:${NC} atabeth / $ATABETH_PASSWORD"
echo ""
echo -e "${BLUE}🌐 URLs d'accès:${NC}"
echo -e "  ${GREEN}Frontend:${NC} http://localhost:3100"
echo -e "  ${GREEN}Gateway:${NC} http://localhost:3000"
echo -e "  ${GREEN}Translator:${NC} http://localhost:8000"
echo ""
echo -e "${GREEN}✅ Vous pouvez maintenant vous connecter avec les bonnes clés JWT !${NC}"
