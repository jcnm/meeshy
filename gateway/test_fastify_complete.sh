#!/bin/bash

# Script de test complet du serveur Fastify
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BASE_URL="http://localhost:3001"

echo -e "${BLUE}🧪 Test complet du serveur Fastify Meeshy${NC}"
echo "=================================================="

# Vérifier curl
if ! command -v curl >/dev/null 2>&1; then
    echo -e "${RED}❌ curl non trouvé${NC}"
    exit 1
fi

# Fonction de test HTTP
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${YELLOW}🔸 Test: $description${NC}"
    
    if [[ "$method" == "GET" ]]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    # Séparer le body et le code de statut
    body=$(echo "$response" | head -n -1)
    status_code=$(echo "$response" | tail -n 1)
    
    if [[ "$status_code" == "200" ]]; then
        echo -e "   ${GREEN}✅ Status: $status_code${NC}"
        if command -v jq >/dev/null 2>&1; then
            echo "$body" | jq '.' 2>/dev/null || echo "$body"
        else
            echo "$body"
        fi
    else
        echo -e "   ${RED}❌ Status: $status_code${NC}"
        echo "$body"
        return 1
    fi
    
    return 0
}

# Vérifier si le serveur est en cours d'exécution
if ! curl -s "$BASE_URL/health" >/dev/null 2>&1; then
    echo -e "${YELLOW}📡 Serveur non détecté, démarrage automatique...${NC}"
    
    # Démarrer le serveur en arrière-plan
    node src/server-simple.js > server_test.log 2>&1 &
    SERVER_PID=$!
    
    # Attendre le démarrage
    echo -e "${YELLOW}⏳ Attente du démarrage du serveur...${NC}"
    sleep 5
    
    # Vérifier que le serveur répond
    if ! curl -s "$BASE_URL/health" >/dev/null 2>&1; then
        echo -e "${RED}❌ Serveur non accessible après démarrage${NC}"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
    
    STARTED_SERVER=true
else
    echo -e "${GREEN}✅ Serveur détecté et accessible${NC}"
    STARTED_SERVER=false
fi

# Fonction de nettoyage
cleanup() {
    if [[ "$STARTED_SERVER" == "true" ]] && [[ ! -z "$SERVER_PID" ]]; then
        echo -e "\n${YELLOW}🛑 Arrêt du serveur de test...${NC}"
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
    exit $1
}

trap 'cleanup 1' SIGINT SIGTERM

# Tests des endpoints
echo -e "\n${BLUE}🔍 Exécution des tests API...${NC}"

# Test 1: Health check
test_endpoint "GET" "/health" "" "Health check"

echo ""

# Test 2: Stats
test_endpoint "GET" "/stats" "" "Statistiques du serveur"

echo ""

# Test 3: Messages de test
test_endpoint "GET" "/messages" "" "Messages de test"

echo ""

# Test 4: Détection de langue
test_endpoint "POST" "/test-detection" '{"text": "Bonjour, comment allez-vous ?"}' "Détection de langue (français)"

echo ""

test_endpoint "POST" "/test-detection" '{"text": "Hello, how are you?"}' "Détection de langue (anglais)"

echo ""

# Test 5: Traduction français -> anglais
test_endpoint "POST" "/test-translation" '{"text": "Bonjour le monde", "targetLanguage": "en", "sourceLanguage": "fr"}' "Traduction FR->EN"

echo ""

# Test 6: Traduction anglais -> français
test_endpoint "POST" "/test-translation" '{"text": "Hello world", "targetLanguage": "fr", "sourceLanguage": "en"}' "Traduction EN->FR"

echo ""

# Test 7: Traduction français -> espagnol
test_endpoint "POST" "/test-translation" '{"text": "Au revoir", "targetLanguage": "es", "sourceLanguage": "fr"}' "Traduction FR->ES"

echo ""

# Test WebSocket (optionnel, nécessite un client WebSocket)
echo -e "${BLUE}🔸 Info: Test WebSocket${NC}"
echo -e "   ${YELLOW}WebSocket disponible sur: ws://localhost:3001/ws${NC}"
echo -e "   ${YELLOW}Utilisez un client WebSocket pour tester les messages en temps réel${NC}"

echo -e "\n${GREEN}🎉 Tous les tests API ont réussi !${NC}"

# Nettoyer
cleanup 0
