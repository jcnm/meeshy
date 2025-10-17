#!/bin/bash

###############################################################################
# Script de correction des URLs d'attachements en production
# 
# Ce script charge les variables d'environnement de production et exécute
# la migration des URLs d'attachements pour remplacer localhost par les URLs
# de production correctes.
#
# Usage:
#   ./scripts/fix-attachment-urls.sh
#
# Prérequis:
#   - config/production.env doit exister
#   - secrets/production-secrets.env doit exister (optionnel)
#   - Node.js doit être installé
###############################################################################

set -e  # Arrêter en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧 Script de correction des URLs d'attachements${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Déterminer le répertoire racine du projet
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Charger les variables d'environnement de production
if [ -f "config/production.env" ]; then
    echo -e "${GREEN}✅ Chargement de config/production.env${NC}"
    set -a
    source config/production.env
    set +a
else
    echo -e "${RED}❌ Fichier config/production.env non trouvé${NC}"
    exit 1
fi

# Charger les secrets de production (optionnel)
if [ -f "secrets/production-secrets.env" ]; then
    echo -e "${GREEN}✅ Chargement de secrets/production-secrets.env${NC}"
    set -a
    source secrets/production-secrets.env
    set +a
fi

# Vérifier que PUBLIC_URL est définie
if [ -z "$PUBLIC_URL" ]; then
    echo -e "${YELLOW}⚠️  PUBLIC_URL n'est pas définie dans les variables d'environnement${NC}"
    echo -e "${YELLOW}   Utilisation de la valeur par défaut: https://gate.meeshy.me${NC}"
    export PUBLIC_URL="https://gate.meeshy.me"
fi

# Vérifier que DATABASE_URL est définie
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL n'est pas définie${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  ${BLUE}•${NC} PUBLIC_URL: ${GREEN}$PUBLIC_URL${NC}"
echo -e "  ${BLUE}•${NC} DATABASE_URL: ${GREEN}$(echo $DATABASE_URL | sed 's/:[^:@]*@/:***@/')${NC}"
echo ""

# Demander confirmation avant de procéder
read -p "Voulez-vous continuer avec la migration? (o/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
    echo -e "${YELLOW}❌ Migration annulée${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}🚀 Lancement de la migration...${NC}"
echo ""

# Exécuter le script de migration
node scripts/fix-attachment-urls.js

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Script terminé avec succès!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📝 Prochaines étapes:${NC}"
echo -e "  ${BLUE}1.${NC} Vérifiez que les images s'affichent correctement sur meeshy.me"
echo -e "  ${BLUE}2.${NC} Testez l'upload de nouvelles images"
echo -e "  ${BLUE}3.${NC} Vérifiez que les thumbnails fonctionnent"
echo ""

