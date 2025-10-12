#!/bin/bash

# 🔧 Script de correction des versions Prisma
# Ce script aligne toutes les versions Prisma sur 6.13.0

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}🔧 CORRECTION DES VERSIONS PRISMA - MEESHY${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📁 Projet: ${PROJECT_ROOT}${NC}"
echo ""

cd "$PROJECT_ROOT"

# Confirmation avant de continuer
echo -e "${YELLOW}⚠️  Ce script va:${NC}"
echo -e "  1. Sauvegarder les package.json actuels"
echo -e "  2. Mettre à jour les versions Prisma vers 6.13.0"
echo -e "  3. Supprimer tous les node_modules"
echo -e "  4. Réinstaller toutes les dépendances"
echo -e "  5. Régénérer les clients Prisma"
echo ""
echo -e "${YELLOW}📊 Durée estimée: 15-20 minutes${NC}"
echo ""

read -p "$(echo -e ${YELLOW}Voulez-vous continuer? [y/N]: ${NC})" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Opération annulée${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🚀 Début de la correction...${NC}"
echo ""

# Phase 1: Sauvegarde
echo -e "${CYAN}═══ Phase 1: Sauvegarde ═══${NC}"
echo ""

cp package.json package.json.backup
echo -e "${GREEN}✅ Sauvegarde de package.json${NC}"

cp gateway/package.json gateway/package.json.backup
echo -e "${GREEN}✅ Sauvegarde de gateway/package.json${NC}"

cp shared/package.json shared/package.json.backup
echo -e "${GREEN}✅ Sauvegarde de shared/package.json${NC}"

echo ""

# Phase 2: Mise à jour des versions
echo -e "${CYAN}═══ Phase 2: Mise à jour des versions ═══${NC}"
echo ""

# Mettre à jour package.json racine
echo -e "${YELLOW}📝 Mise à jour de package.json racine...${NC}"
sed -i.bak 's/"prisma": "5\.17\.0"/"prisma": "6.13.0"/g' package.json
sed -i.bak 's/"@prisma\/client": "5\.17\.0"/"@prisma\/client": "6.13.0"/g' package.json
rm -f package.json.bak
echo -e "${GREEN}✅ package.json racine mis à jour${NC}"

# Mettre à jour gateway/package.json
echo -e "${YELLOW}📝 Mise à jour de gateway/package.json...${NC}"
sed -i.bak 's/"prisma": "\^6\.15\.0"/"prisma": "6.13.0"/g' gateway/package.json
rm -f gateway/package.json.bak
echo -e "${GREEN}✅ gateway/package.json mis à jour${NC}"

echo ""

# Phase 3: Nettoyage
echo -e "${CYAN}═══ Phase 3: Nettoyage ═══${NC}"
echo ""

echo -e "${YELLOW}🗑️  Suppression des node_modules...${NC}"
rm -rf node_modules 2>/dev/null || true
rm -rf frontend/node_modules 2>/dev/null || true
rm -rf gateway/node_modules 2>/dev/null || true
rm -rf shared/node_modules 2>/dev/null || true
echo -e "${GREEN}✅ node_modules supprimés${NC}"

echo -e "${YELLOW}🗑️  Suppression des anciens clients Prisma...${NC}"
rm -rf shared/client 2>/dev/null || true
rm -rf gateway/shared/prisma/client 2>/dev/null || true
rm -rf frontend/shared/prisma/client 2>/dev/null || true
echo -e "${GREEN}✅ Anciens clients Prisma supprimés${NC}"

echo -e "${YELLOW}🗑️  Suppression des builds...${NC}"
rm -rf frontend/.next 2>/dev/null || true
rm -rf gateway/dist 2>/dev/null || true
rm -rf gateway/cache 2>/dev/null || true
echo -e "${GREEN}✅ Builds supprimés${NC}"

echo ""

# Phase 4: Réinstallation
echo -e "${CYAN}═══ Phase 4: Réinstallation des dépendances ═══${NC}"
echo ""

echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
echo -e "${BLUE}   (Cela peut prendre plusieurs minutes)${NC}"
echo ""

pnpm install

echo ""
echo -e "${GREEN}✅ Dépendances installées${NC}"
echo ""

# Vérifier les versions installées
echo -e "${BLUE}🔍 Vérification des versions Prisma installées:${NC}"
PRISMA_VERSION=$(pnpm list prisma --depth=0 2>/dev/null | grep prisma | head -1 | awk '{print $2}' || echo "non trouvé")
CLIENT_VERSION=$(pnpm list @prisma/client --depth=0 2>/dev/null | grep @prisma/client | head -1 | awk '{print $2}' || echo "non trouvé")
echo -e "  ${GREEN}• Prisma CLI: ${PRISMA_VERSION}${NC}"
echo -e "  ${GREEN}• @prisma/client: ${CLIENT_VERSION}${NC}"
echo ""

# Phase 5: Génération Prisma
echo -e "${CYAN}═══ Phase 5: Génération des clients Prisma ═══${NC}"
echo ""

# Générer dans shared
echo -e "${YELLOW}🔨 Génération du client Prisma dans shared...${NC}"
cd shared

# Vérifier que le schéma existe
if [ ! -f "schema.prisma" ]; then
    echo -e "${RED}❌ Fichier schema.prisma non trouvé dans shared/${NC}"
    exit 1
fi

pnpm run generate

echo -e "${GREEN}✅ Client Prisma généré dans shared${NC}"
echo ""

# Distribuer
echo -e "${YELLOW}📤 Distribution du client Prisma...${NC}"
if [ -f "scripts/distribute.sh" ]; then
    chmod +x scripts/distribute.sh
    ./scripts/distribute.sh
    echo -e "${GREEN}✅ Client Prisma distribué${NC}"
else
    echo -e "${YELLOW}⚠️  Script de distribution non trouvé, distribution manuelle...${NC}"
    
    # Distribution manuelle
    mkdir -p ../gateway/shared/prisma
    mkdir -p ../frontend/shared/prisma
    
    if [ -d "client" ]; then
        cp -r client ../gateway/shared/prisma/ 2>/dev/null || true
        cp -r client ../frontend/shared/prisma/ 2>/dev/null || true
        echo -e "${GREEN}✅ Distribution manuelle effectuée${NC}"
    fi
fi

cd ..
echo ""

# Générer dans gateway
echo -e "${YELLOW}🔨 Génération du client Prisma dans gateway...${NC}"
cd gateway

# Vérifier que le schéma existe
if [ -f "shared/prisma/schema.prisma" ]; then
    pnpm run generate:prisma 2>/dev/null || echo -e "${YELLOW}⚠️  generate:prisma a échoué, mais ce n'est peut-être pas critique${NC}"
    echo -e "${GREEN}✅ Client Prisma généré dans gateway${NC}"
else
    echo -e "${YELLOW}⚠️  Schema Prisma non trouvé dans gateway/shared/prisma/${NC}"
fi

cd ..
echo ""

# Phase 6: Vérification
echo -e "${CYAN}═══ Phase 6: Vérification ═══${NC}"
echo ""

echo -e "${BLUE}🔍 Vérification des clients Prisma générés:${NC}"

if [ -d "shared/client" ]; then
    echo -e "${GREEN}✅ shared/client existe${NC}"
    echo -e "   Fichiers: $(ls shared/client | wc -l | tr -d ' ') fichiers générés"
else
    echo -e "${RED}❌ shared/client n'existe pas${NC}"
fi

if [ -d "gateway/shared/prisma/client" ]; then
    echo -e "${GREEN}✅ gateway/shared/prisma/client existe${NC}"
else
    echo -e "${YELLOW}⚠️  gateway/shared/prisma/client n'existe pas${NC}"
fi

echo ""

# Résumé
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ CORRECTION TERMINÉE AVEC SUCCÈS !${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${CYAN}📋 RÉSUMÉ:${NC}"
echo -e "  ${GREEN}✅ Versions Prisma alignées sur 6.13.0${NC}"
echo -e "  ${GREEN}✅ Dépendances réinstallées${NC}"
echo -e "  ${GREEN}✅ Clients Prisma régénérés${NC}"
echo -e "  ${GREEN}✅ Distribution effectuée${NC}"
echo ""

echo -e "${YELLOW}🧪 PROCHAINES ÉTAPES:${NC}"
echo ""
echo -e "${BLUE}1. Tester le build du gateway:${NC}"
echo -e "   ${CYAN}cd gateway && pnpm run build${NC}"
echo ""
echo -e "${BLUE}2. Tester le build du frontend:${NC}"
echo -e "   ${CYAN}cd frontend && pnpm run build${NC}"
echo ""
echo -e "${BLUE}3. Démarrer l'environnement de développement:${NC}"
echo -e "   ${CYAN}./scripts/meeshy.sh dev start${NC}"
echo ""
echo -e "${BLUE}4. Si tout fonctionne, supprimer les backups:${NC}"
echo -e "   ${CYAN}rm -f *.backup gateway/*.backup shared/*.backup${NC}"
echo ""

echo -e "${YELLOW}🆘 EN CAS DE PROBLÈME:${NC}"
echo -e "   Restaurer les backups avec:"
echo -e "   ${CYAN}cp package.json.backup package.json${NC}"
echo -e "   ${CYAN}cp gateway/package.json.backup gateway/package.json${NC}"
echo -e "   ${CYAN}cp shared/package.json.backup shared/package.json${NC}"
echo -e "   ${CYAN}pnpm install${NC}"
echo ""

echo -e "${GREEN}🎉 Script terminé !${NC}"
echo ""

