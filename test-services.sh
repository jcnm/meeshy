#!/bin/bash

# Script de test pour vérifier les services Meeshy
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Variables
FRONTEND_URL="http://localhost:3100"
GATEWAY_URL="http://localhost:3000"
TRANSLATOR_URL="http://localhost:8000"
TIMEOUT=30

echo -e "${BLUE}🧪 Test des services Meeshy${NC}"
echo "=================================="

# Fonction pour tester un service
test_service() {
    local name=$1
    local url=$2
    local endpoint=$3
    
    echo -e "${BLUE}🔍 Test de $name...${NC}"
    
    # Attendre que le service soit prêt
    local retries=0
    while [ $retries -lt $TIMEOUT ]; do
        if curl -s -f "$url$endpoint" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $name est opérationnel${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ Attente de $name... ($((retries + 1))/$TIMEOUT)${NC}"
        sleep 2
        retries=$((retries + 1))
    done
    
    echo -e "${RED}❌ $name n'est pas accessible après $TIMEOUT secondes${NC}"
    return 1
}

# Test du Frontend
test_service "Frontend" "$FRONTEND_URL" "/"

# Test du Gateway
test_service "Gateway" "$GATEWAY_URL" "/health"

# Test du Translator
test_service "Translator" "$TRANSLATOR_URL" "/health"

echo -e "${BLUE}🎯 Tests terminés${NC}"

# Test de traduction
echo -e "${BLUE}🌐 Test de traduction...${NC}"
if curl -s -X POST "$TRANSLATOR_URL/translate" \
    -H "Content-Type: application/json" \
    -d '{"text": "Hello world", "source_lang": "en", "target_lang": "fr"}' | grep -q "Bonjour"; then
    echo -e "${GREEN}✅ Traduction fonctionnelle${NC}"
else
    echo -e "${YELLOW}⚠️  Traduction non testée ou échec${NC}"
fi

echo -e "${GREEN}🎉 Tests terminés !${NC}"
