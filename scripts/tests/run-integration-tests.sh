#!/bin/bash

# Integration Tests Runner for Meeshy
# Runs integration tests between services

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_RESULTS_DIR="test-results"
INTEGRATION_TESTS_DIR="scripts/tests/integration"

echo -e "${BLUE}🔗 Démarrage des tests d'intégration Meeshy${NC}"
echo -e "${BLUE}==========================================${NC}"

# Fonction pour attendre qu'un service soit prêt
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Attente du service $service...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Service $service prêt${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}   Tentative $attempt/$max_attempts...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ Service $service non disponible après $max_attempts tentatives${NC}"
    return 1
}

# Fonction pour exécuter un test d'intégration
run_integration_test() {
    local test_name=$1
    local test_script=$2
    local test_file="$TEST_RESULTS_DIR/${test_name}-integration.log"
    
    echo -e "${BLUE}🔍 Test d'intégration: $test_name${NC}"
    
    if [ -f "$test_script" ]; then
        if bash "$test_script" > "$test_file" 2>&1; then
            echo -e "${GREEN}✅ Test $test_name: SUCCESS${NC}"
            return 0
        else
            echo -e "${RED}❌ Test $test_name: FAILED${NC}"
            echo -e "${YELLOW}📋 Logs disponibles dans: $test_file${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  Script de test non trouvé: $test_script${NC}"
        return 0
    fi
}

# Démarrer les services en mode test
echo -e "${BLUE}🚀 Démarrage des services pour les tests d'intégration...${NC}"

# Arrêter les services existants
echo -e "${YELLOW}🛑 Arrêt des services existants...${NC}"
docker-compose down 2>/dev/null || true
docker-compose -f docker-compose.unified.yml down 2>/dev/null || true

# Démarrer les services avec docker-compose
echo -e "${YELLOW}🚀 Démarrage des services microservices...${NC}"
docker-compose up -d postgres redis

# Attendre que PostgreSQL soit prêt
wait_for_service "PostgreSQL" "http://localhost:5432" || {
    echo -e "${RED}❌ Impossible de démarrer PostgreSQL${NC}"
    exit 1
}

# Attendre que Redis soit prêt
wait_for_service "Redis" "http://localhost:6379" || {
    echo -e "${RED}❌ Impossible de démarrer Redis${NC}"
    exit 1
}

# Démarrer le translator
echo -e "${YELLOW}🚀 Démarrage du translator...${NC}"
docker-compose up -d translator

# Attendre que le translator soit prêt
wait_for_service "Translator" "http://localhost:8000/health" || {
    echo -e "${RED}❌ Impossible de démarrer le translator${NC}"
    exit 1
}

# Démarrer le gateway
echo -e "${YELLOW}🚀 Démarrage du gateway...${NC}"
docker-compose up -d gateway

# Attendre que le gateway soit prêt
wait_for_service "Gateway" "http://localhost:3000/health" || {
    echo -e "${RED}❌ Impossible de démarrer le gateway${NC}"
    exit 1
}

# Démarrer le frontend
echo -e "${YELLOW}🚀 Démarrage du frontend...${NC}"
docker-compose up -d frontend

# Attendre que le frontend soit prêt
wait_for_service "Frontend" "http://localhost:3100" || {
    echo -e "${RED}❌ Impossible de démarrer le frontend${NC}"
    exit 1
}

echo -e "${GREEN}✅ Tous les services sont démarrés${NC}"

# Tests d'intégration Gateway-Translator
echo -e "${BLUE}🔗 Tests d'intégration Gateway-Translator...${NC}"

# Test 1: Communication gRPC
run_integration_test "gateway-translator-grpc" "$INTEGRATION_TESTS_DIR/test-grpc-communication.sh"

# Test 2: Communication ZMQ
run_integration_test "gateway-translator-zmq" "$INTEGRATION_TESTS_DIR/test-zmq-communication.sh"

# Test 3: Traduction de messages
run_integration_test "gateway-translator-translation" "$INTEGRATION_TESTS_DIR/test-translation-flow.sh"

# Tests d'intégration Frontend-Gateway
echo -e "${BLUE}🔗 Tests d'intégration Frontend-Gateway...${NC}"

# Test 1: Authentification
run_integration_test "frontend-gateway-auth" "$INTEGRATION_TESTS_DIR/test-authentication.sh"

# Test 2: WebSocket communication
run_integration_test "frontend-gateway-websocket" "$INTEGRATION_TESTS_DIR/test-websocket.sh"

# Test 3: API endpoints
run_integration_test "frontend-gateway-api" "$INTEGRATION_TESTS_DIR/test-api-endpoints.sh"

# Tests d'intégration complète
echo -e "${BLUE}🔗 Tests d'intégration complète Frontend-Gateway-Translator...${NC}"

# Test 1: Flux complet de traduction
run_integration_test "full-translation-flow" "$INTEGRATION_TESTS_DIR/test-full-translation-flow.sh"

# Test 2: Conversation multilingue
run_integration_test "multilingual-conversation" "$INTEGRATION_TESTS_DIR/test-multilingual-conversation.sh"

# Test 3: Performance sous charge
run_integration_test "performance-under-load" "$INTEGRATION_TESTS_DIR/test-performance-under-load.sh"

# Arrêter les services
echo -e "${YELLOW}🛑 Arrêt des services...${NC}"
docker-compose down

# Résumé des tests
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}🎉 Tests d'intégration terminés !${NC}"
echo -e "${BLUE}📋 Résultats disponibles dans: $TEST_RESULTS_DIR${NC}"

# Afficher un résumé des résultats
echo -e "${BLUE}📊 Résumé des tests d'intégration:${NC}"
for log_file in "$TEST_RESULTS_DIR"/*-integration.log; do
    if [ -f "$log_file" ]; then
        test_name=$(basename "$log_file" -integration.log)
        if grep -q "FAIL\|Error\|Exception" "$log_file"; then
            echo -e "${RED}❌ $test_name: ÉCHEC${NC}"
        else
            echo -e "${GREEN}✅ $test_name: SUCCÈS${NC}"
        fi
    fi
done
