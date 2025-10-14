#!/bin/bash

# Script de vérification de santé pour tous les services Meeshy
# Vérifie que tous les services sont opérationnels

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     MEESHY - Vérification de Santé des Services        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Fonction pour vérifier un service HTTP
check_http() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "🔍 Vérification de $name... "
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_status"; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ ÉCHEC${NC}"
        return 1
    fi
}

# Fonction pour vérifier un conteneur Docker
check_container() {
    local name=$1
    local container=$2
    
    echo -n "🐳 Vérification du conteneur $name... "
    
    if docker ps --filter "name=$container" --filter "status=running" | grep -q "$container"; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Stopped${NC}"
        return 1
    fi
}

# Compteur de succès/échecs
SUCCESS=0
FAILED=0

# Vérifier les conteneurs Docker
echo -e "${YELLOW}=== Vérification des Conteneurs Docker ===${NC}"
echo ""

if check_container "Database" "meeshy-dev-database"; then ((SUCCESS++)); else ((FAILED++)); fi
if check_container "Redis" "meeshy-dev-redis"; then ((SUCCESS++)); else ((FAILED++)); fi
if check_container "Translator" "meeshy-dev-translator"; then ((SUCCESS++)); else ((FAILED++)); fi
if check_container "Gateway" "meeshy-dev-gateway"; then ((SUCCESS++)); else ((FAILED++)); fi
if check_container "Frontend" "meeshy-dev-frontend"; then ((SUCCESS++)); else ((FAILED++)); fi
if check_container "NoSQLClient" "meeshy-dev-nosqlclient"; then ((SUCCESS++)); else ((FAILED++)); fi
if check_container "P3X Redis UI" "meeshy-dev-p3x-redis-ui"; then ((SUCCESS++)); else ((FAILED++)); fi

echo ""
echo -e "${YELLOW}=== Vérification des Services HTTP ===${NC}"
echo ""

# Attendre un peu que les services se stabilisent
sleep 2

if check_http "Frontend" "http://localhost:3100"; then ((SUCCESS++)); else ((FAILED++)); fi
if check_http "Gateway Health" "http://localhost:3000/health"; then ((SUCCESS++)); else ((FAILED++)); fi
if check_http "Translator Health" "http://localhost:8000/health"; then ((SUCCESS++)); else ((FAILED++)); fi
if check_http "MongoDB UI" "http://localhost:3001"; then ((SUCCESS++)); else ((FAILED++)); fi
if check_http "Redis UI" "http://localhost:7843"; then ((SUCCESS++)); else ((FAILED++)); fi

echo ""
echo -e "${YELLOW}=== Tests Fonctionnels ===${NC}"
echo ""

# Test de connexion à l'API
echo -n "🔐 Test de connexion API... "
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@meeshy.local","password":"admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✓ OK${NC}"
    ((SUCCESS++))
    
    # Extraire le token pour les tests suivants
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "   Token reçu: ${TOKEN:0:20}..."
else
    echo -e "${RED}✗ ÉCHEC${NC}"
    echo "   Response: $LOGIN_RESPONSE"
    ((FAILED++))
fi

# Test de traduction
echo -n "🌐 Test de traduction... "
TRANSLATION_RESPONSE=$(curl -s -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","source_language":"en","target_language":"fr"}')

if echo "$TRANSLATION_RESPONSE" | grep -q "Bonjour\|Salut"; then
    echo -e "${GREEN}✓ OK${NC}"
    ((SUCCESS++))
    echo "   Traduction: $(echo "$TRANSLATION_RESPONSE" | grep -o '"translated_text":"[^"]*"' | cut -d'"' -f4)"
else
    echo -e "${RED}✗ ÉCHEC${NC}"
    echo "   Response: $TRANSLATION_RESPONSE"
    ((FAILED++))
fi

echo ""
echo -e "${YELLOW}=== Résumé ===${NC}"
echo ""
echo -e "Tests réussis:  ${GREEN}$SUCCESS${NC}"
echo -e "Tests échoués:  ${RED}$FAILED${NC}"
echo ""

# Afficher les URLs si tout fonctionne
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✨ Tous les services sont opérationnels!${NC}"
    echo ""
    echo -e "${BLUE}📍 URLs d'accès:${NC}"
    echo "   - Frontend:        http://localhost:3100"
    echo "   - Gateway API:     http://localhost:3000"
    echo "   - Translator API:  http://localhost:8000"
    echo "   - MongoDB UI:      http://localhost:3001"
    echo "   - Redis UI:        http://localhost:7843"
    echo ""
    echo -e "${BLUE}🔐 Utilisateurs de test:${NC}"
    echo "   - admin@meeshy.local / admin123"
    echo "   - meeshy@meeshy.local / meeshy123"
    echo "   - atabeth@meeshy.local / atabeth123"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Certains services ont des problèmes!${NC}"
    echo ""
    echo -e "${YELLOW}💡 Actions recommandées:${NC}"
    echo "   1. Vérifier les logs: ./start-dev.sh logs"
    echo "   2. Redémarrer les services: ./start-dev.sh restart"
    echo "   3. Vérifier Docker: docker ps"
    echo ""
    exit 1
fi
