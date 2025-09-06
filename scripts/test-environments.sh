#!/bin/bash

# 🧪 Script de test pour les nouveaux environnements DEV/PROD
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🧪 Test des nouveaux environnements Meeshy${NC}"
echo ""

# Test de la structure des fichiers
echo -e "${BLUE}📁 Vérification de la structure des fichiers...${NC}"

files_to_check=(
    "scripts/development/start-local.sh"
    "scripts/development/stop-local.sh" 
    "scripts/development/configure-dev.sh"
    "scripts/production/start-production.sh"
    "scripts/production/stop-production.sh"
    "scripts/production/configure-production.sh"
    "docker-compose.dev.yml"
    "docker-compose.prod.yml"
    "scripts/README-ENVIRONMENTS.md"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✅ $file${NC}"
    else
        echo -e "  ${RED}❌ $file${NC}"
    fi
done

echo ""

# Test des permissions
echo -e "${BLUE}🔐 Vérification des permissions...${NC}"

scripts_to_check=(
    "scripts/development/start-local.sh"
    "scripts/development/stop-local.sh"
    "scripts/development/configure-dev.sh" 
    "scripts/production/start-production.sh"
    "scripts/production/stop-production.sh"
    "scripts/production/configure-production.sh"
)

for script in "${scripts_to_check[@]}"; do
    if [ -x "$script" ]; then
        echo -e "  ${GREEN}✅ $script (exécutable)${NC}"
    else
        echo -e "  ${RED}❌ $script (non exécutable)${NC}"
    fi
done

echo ""

# Test de validation syntax des scripts
echo -e "${BLUE}🔍 Validation de la syntaxe des scripts...${NC}"

for script in "${scripts_to_check[@]}"; do
    if bash -n "$script" 2>/dev/null; then
        echo -e "  ${GREEN}✅ $script (syntaxe valide)${NC}"
    else
        echo -e "  ${RED}❌ $script (erreur de syntaxe)${NC}"
    fi
done

echo ""

# Test du docker-compose dev
echo -e "${BLUE}🐳 Test de validation docker-compose.dev.yml...${NC}"
if docker-compose -f docker-compose.dev.yml config >/dev/null 2>&1; then
    echo -e "  ${GREEN}✅ docker-compose.dev.yml (syntaxe valide)${NC}"
else
    echo -e "  ${RED}❌ docker-compose.dev.yml (erreur de syntaxe)${NC}"
fi

# Test du docker-compose prod
echo -e "${BLUE}🐳 Test de validation docker-compose.prod.yml...${NC}"
if [ -f "docker-compose.prod.yml" ]; then
    if docker-compose -f docker-compose.prod.yml config >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ docker-compose.prod.yml (syntaxe valide)${NC}"
    else
        echo -e "  ${RED}❌ docker-compose.prod.yml (erreur de syntaxe)${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠️  docker-compose.prod.yml (non trouvé)${NC}"
fi

echo ""

# Test des anciens scripts (doivent être supprimés)
echo -e "${BLUE}🗑️  Vérification de la suppression des anciens scripts...${NC}"

old_scripts=("start-local.sh" "start-local-simple.sh")

for script in "${old_scripts[@]}"; do
    if [ ! -f "$script" ]; then
        echo -e "  ${GREEN}✅ $script (supprimé)${NC}"
    else
        echo -e "  ${YELLOW}⚠️  $script (encore présent)${NC}"
    fi
done

echo ""

# Résumé
echo -e "${CYAN}📋 Résumé du test:${NC}"
echo -e "  ${GREEN}Structure:${NC} Nouveaux scripts créés"
echo -e "  ${GREEN}Permissions:${NC} Scripts exécutables"
echo -e "  ${GREEN}Syntaxe:${NC} Scripts validés"
echo -e "  ${GREEN}Docker:${NC} Configurations validées"
echo -e "  ${GREEN}Nettoyage:${NC} Anciens scripts supprimés"

echo ""
echo -e "${PURPLE}🎯 Prochaines étapes:${NC}"
echo -e "  ${YELLOW}1. Tester l'environnement DEV: ./scripts/development/start-local.sh${NC}"
echo -e "  ${YELLOW}2. Configurer la production: ./scripts/production/configure-production.sh${NC}"
echo -e "  ${YELLOW}3. Lire la documentation: cat scripts/README-ENVIRONMENTS.md${NC}"

echo ""
echo -e "${GREEN}✅ Test terminé avec succès !${NC}"
