#!/bin/bash

# Script pour exécuter tous les tests du projet Meeshy
# Usage: ./run-all-tests.sh [--coverage]

set -e

COVERAGE=""
if [ "$1" == "--coverage" ]; then
    COVERAGE="--coverage"
fi

echo "========================================="
echo "🧪 MEESHY TEST SUITE"
echo "========================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher le résultat
show_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2 PASSED${NC}"
    else
        echo -e "${RED}❌ $2 FAILED${NC}"
        return 1
    fi
}

# Compteur de résultats
FAILED=0

# Test Shared
echo -e "${YELLOW}📦 Testing Shared Types...${NC}"
cd shared
if [ -f "package.json" ]; then
    if [ -n "$COVERAGE" ]; then
        pnpm test:coverage || { show_result 1 "Shared" && FAILED=$((FAILED+1)); }
    else
        pnpm test || { show_result 1 "Shared" && FAILED=$((FAILED+1)); }
    fi
    show_result 0 "Shared"
else
    echo "⚠️  No package.json found, skipping shared tests"
fi
cd ..
echo ""

# Test Gateway
echo -e "${YELLOW}🚪 Testing Gateway...${NC}"
cd gateway
if [ -n "$COVERAGE" ]; then
    pnpm test:coverage || { show_result 1 "Gateway" && FAILED=$((FAILED+1)); }
else
    pnpm test || { show_result 1 "Gateway" && FAILED=$((FAILED+1)); }
fi
show_result 0 "Gateway"
cd ..
echo ""

# Test Translator
echo -e "${YELLOW}🔄 Testing Translator...${NC}"
cd translator
if [ -n "$COVERAGE" ]; then
    pytest --cov=src --cov-report=term-missing --cov-report=html || { show_result 1 "Translator" && FAILED=$((FAILED+1)); }
else
    pytest || { show_result 1 "Translator" && FAILED=$((FAILED+1)); }
fi
show_result 0 "Translator"
cd ..
echo ""

# Test Frontend
echo -e "${YELLOW}🎨 Testing Frontend...${NC}"
cd frontend
if [ -n "$COVERAGE" ]; then
    pnpm test:coverage || { show_result 1 "Frontend" && FAILED=$((FAILED+1)); }
else
    pnpm test || { show_result 1 "Frontend" && FAILED=$((FAILED+1)); }
fi
show_result 0 "Frontend"
cd ..
echo ""

# Résumé
echo "========================================="
echo "📊 TEST SUMMARY"
echo "========================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✨ ALL TESTS PASSED! ✨${NC}"
    echo ""
    echo "Test suites completed successfully:"
    echo "  ✅ Shared types"
    echo "  ✅ Gateway (TypeScript/Node.js)"
    echo "  ✅ Translator (Python)"
    echo "  ✅ Frontend (React)"
    echo ""

    if [ -n "$COVERAGE" ]; then
        echo "📈 Coverage reports generated:"
        echo "  - Gateway: gateway/coverage/index.html"
        echo "  - Translator: translator/coverage_html/index.html"
        echo "  - Frontend: frontend/coverage/index.html"
        echo "  - Shared: shared/coverage/index.html"
    fi

    exit 0
else
    echo -e "${RED}❌ $FAILED TEST SUITE(S) FAILED${NC}"
    exit 1
fi
