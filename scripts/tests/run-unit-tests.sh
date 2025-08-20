#!/bin/bash

# Unit Tests Runner for Meeshy
# Runs unit tests for all services

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_RESULTS_DIR="test-results"
COVERAGE_DIR="coverage"

# Créer les répertoires de résultats
mkdir -p "$TEST_RESULTS_DIR"
mkdir -p "$COVERAGE_DIR"

echo -e "${BLUE}🧪 Démarrage des tests unitaires Meeshy${NC}"
echo -e "${BLUE}=====================================${NC}"

# Fonction pour exécuter les tests avec gestion d'erreur
run_tests() {
    local service=$1
    local test_command=$2
    local test_file="$TEST_RESULTS_DIR/${service}-unit-tests.log"
    
    echo -e "${BLUE}🔍 Tests unitaires pour $service...${NC}"
    
    if eval "$test_command" > "$test_file" 2>&1; then
        echo -e "${GREEN}✅ Tests unitaires $service: SUCCESS${NC}"
        return 0
    else
        echo -e "${RED}❌ Tests unitaires $service: FAILED${NC}"
        echo -e "${YELLOW}📋 Logs disponibles dans: $test_file${NC}"
        return 1
    fi
}

# Tests Frontend (Next.js)
echo -e "${BLUE}📦 Tests Frontend (Next.js)...${NC}"
if [ -d "frontend" ]; then
    cd frontend
    
    # Vérifier si les dépendances sont installées
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installation des dépendances frontend...${NC}"
        pnpm install
    fi
    
    # Tests unitaires avec Jest
    if run_tests "frontend" "pnpm test"; then
        echo -e "${GREEN}✅ Tests frontend terminés avec succès${NC}"
    else
        echo -e "${RED}❌ Tests frontend échoués${NC}"
        cd ..
        exit 1
    fi
    
    cd ..
else
    echo -e "${YELLOW}⚠️  Répertoire frontend non trouvé${NC}"
fi

# Tests Gateway (Node.js/Fastify)
echo -e "${BLUE}📦 Tests Gateway (Fastify)...${NC}"
if [ -d "gateway" ]; then
    cd gateway
    
    # Vérifier si les dépendances sont installées
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installation des dépendances gateway...${NC}"
        pnpm install
    fi
    
    # Tests unitaires avec Jest
    if run_tests "gateway" "pnpm test"; then
        echo -e "${GREEN}✅ Tests gateway terminés avec succès${NC}"
    else
        echo -e "${RED}❌ Tests gateway échoués${NC}"
        cd ..
        exit 1
    fi
    
    cd ..
else
    echo -e "${YELLOW}⚠️  Répertoire gateway non trouvé${NC}"
fi

# Tests Translator (Python/FastAPI)
echo -e "${BLUE}📦 Tests Translator (FastAPI)...${NC}"
if [ -d "translator" ]; then
    cd translator
    
    # Vérifier si l'environnement virtuel existe
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}🐍 Création de l'environnement virtuel translator...${NC}"
        python3 -m venv venv
    fi
    
    # Activer l'environnement virtuel
    source venv/bin/activate
    
    # Installer les dépendances
    echo -e "${YELLOW}📦 Installation des dépendances translator...${NC}"
    pip install -r requirements.txt
    
    # Tests unitaires avec pytest
    if run_tests "translator" "python -m pytest tests/ -v --cov=src --cov-report=html:../$COVERAGE_DIR/translator"; then
        echo -e "${GREEN}✅ Tests translator terminés avec succès${NC}"
    else
        echo -e "${RED}❌ Tests translator échoués${NC}"
        deactivate
        cd ..
        exit 1
    fi
    
    deactivate
    cd ..
else
    echo -e "${YELLOW}⚠️  Répertoire translator non trouvé${NC}"
fi

# Tests Shared (Prisma/TypeScript)
echo -e "${BLUE}📦 Tests Shared (Prisma)...${NC}"
if [ -d "shared" ]; then
    cd shared
    
    # Vérifier si les dépendances sont installées
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installation des dépendances shared...${NC}"
        pnpm install
    fi
    
    # Tests de validation du schéma Prisma
    if run_tests "shared" "npx prisma validate"; then
        echo -e "${GREEN}✅ Validation du schéma Prisma réussie${NC}"
    else
        echo -e "${RED}❌ Validation du schéma Prisma échouée${NC}"
        cd ..
        exit 1
    fi
    
    cd ..
else
    echo -e "${YELLOW}⚠️  Répertoire shared non trouvé${NC}"
fi

# Résumé des tests
echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}🎉 Tous les tests unitaires terminés avec succès !${NC}"
echo -e "${BLUE}📋 Résultats disponibles dans: $TEST_RESULTS_DIR${NC}"
echo -e "${BLUE}📊 Couverture disponible dans: $COVERAGE_DIR${NC}"

# Afficher un résumé des résultats
echo -e "${BLUE}📊 Résumé des tests:${NC}"
for log_file in "$TEST_RESULTS_DIR"/*-unit-tests.log; do
    if [ -f "$log_file" ]; then
        service=$(basename "$log_file" -unit-tests.log)
        if grep -q "FAIL\|Error\|Exception" "$log_file"; then
            echo -e "${RED}❌ $service: ÉCHEC${NC}"
        else
            echo -e "${GREEN}✅ $service: SUCCÈS${NC}"
        fi
    fi
done
