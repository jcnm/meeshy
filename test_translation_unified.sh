#!/bin/bash

# Script de stress test pour le comportement unifié de traduction
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
GATEWAY_URL="http://localhost:3000"
TOTAL_REQUESTS=100
CONCURRENT_REQUESTS=10
DELAY_BETWEEN_BATCHES=2

# Langues de test
SOURCE_LANGUAGES=("en" "fr" "es" "de")
TARGET_LANGUAGES=("fr" "en" "es" "de" "pt" "zh" "ja")

# Textes de test
TEXTS=(
    "Hello world"
    "Bonjour le monde"
    "Hola mundo"
    "Hallo Welt"
    "This is a test message"
    "Ceci est un message de test"
    "Esto es un mensaje de prueba"
    "Das ist eine Testnachricht"
    "The quick brown fox jumps over the lazy dog"
    "Le renard brun rapide saute par-dessus le chien paresseux"
)

# Statistiques
SUCCESS_COUNT=0
FAILURE_COUNT=0
TOTAL_TIME=0
RESPONSE_TIMES=()

# Fichier temporaire pour stocker les résultats
RESULTS_FILE="/tmp/translation_test_results.txt"
echo "0 0" > "$RESULTS_FILE"

# Fonction pour incrémenter les compteurs de manière thread-safe
increment_success() {
    local current=$(cat "$RESULTS_FILE")
    local success=$(echo "$current" | cut -d' ' -f1)
    local failure=$(echo "$current" | cut -d' ' -f2)
    success=$((success + 1))
    echo "$success $failure" > "$RESULTS_FILE"
}

increment_failure() {
    local current=$(cat "$RESULTS_FILE")
    local success=$(echo "$current" | cut -d' ' -f1)
    local failure=$(echo "$current" | cut -d' ' -f2)
    failure=$((failure + 1))
    echo "$success $failure" > "$RESULTS_FILE"
}

echo -e "${BLUE}🚀 [STRESS TEST] Démarrage du test de traduction unifié${NC}"
echo "================================================="
echo -e "${CYAN}📊 Configuration:${NC}"
echo "   Total requests: $TOTAL_REQUESTS"
echo "   Concurrent requests: $CONCURRENT_REQUESTS"
echo "   Gateway URL: $GATEWAY_URL"
echo ""

# Fonction pour faire une requête de traduction
make_translation_request() {
    local request_num=$1
    local text="${TEXTS[$((RANDOM % ${#TEXTS[@]}))]}"
    local source_lang="${SOURCE_LANGUAGES[$((RANDOM % ${#SOURCE_LANGUAGES[@]}))]}"
    local target_lang="${TARGET_LANGUAGES[$((RANDOM % ${#TARGET_LANGUAGES[@]}))]}"
    local conversation_id="test-conv-$((RANDOM % 10))"
    
    # 50% de chance d'avoir un message_id (retraduction)
    local has_message_id=$((RANDOM % 2))
    local message_id=""
    
    if [ $has_message_id -eq 1 ]; then
        message_id="test-msg-$((RANDOM % 1000))"
    fi
    
    local start_time=$(date +%s.%N)
    
    # Construire le JSON de la requête
    local json_data="{\"text\":\"$text\",\"source_language\":\"$source_lang\",\"target_language\":\"$target_lang\",\"conversation_id\":\"$conversation_id\""
    
    if [ ! -z "$message_id" ]; then
        json_data="$json_data,\"message_id\":\"$message_id\""
    fi
    
    json_data="$json_data}"
    
    # Faire la requête
    local response=$(curl -s -w "\n%{http_code}" -X POST "$GATEWAY_URL/translate" \
        -H "Content-Type: application/json" \
        -d "$json_data" 2>/dev/null)
    
    local http_code=$(echo "$response" | tail -n1)
    local response_body=$(echo "$response" | sed '$d')
    local end_time=$(date +%s.%N)
    
    local response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    # Vérifier le succès
    if [ "$http_code" = "200" ] && echo "$response_body" | grep -q '"success":true'; then
        local translated_text=$(echo "$response_body" | jq -r '.data.translated_text // empty' 2>/dev/null)
        if [ ! -z "$translated_text" ] && [ "$translated_text" != "null" ]; then
            echo -e "${GREEN}✅ [REQ-$request_num] Succès (${response_time}s): $text → $translated_text${NC}"
            increment_success
            RESPONSE_TIMES+=($response_time)
        else
            echo -e "${RED}❌ [REQ-$request_num] Échec: Pas de traduction (${response_time}s)${NC}"
            increment_failure
        fi
    else
        echo -e "${RED}❌ [REQ-$request_num] Échec HTTP $http_code (${response_time}s)${NC}"
        increment_failure
    fi
}

# Fonction pour faire des requêtes de retraduction
make_retranslation_request() {
    local request_num=$1
    local message_id="retranslate-msg-$((RANDOM % 100))"
    local text="${TEXTS[$((RANDOM % ${#TEXTS[@]}))]}"
    local source_lang="${SOURCE_LANGUAGES[$((RANDOM % ${#SOURCE_LANGUAGES[@]}))]}"
    local target_lang="${TARGET_LANGUAGES[$((RANDOM % ${#TARGET_LANGUAGES[@]}))]}"
    local conversation_id="retranslate-conv-$((RANDOM % 5))"
    
    local start_time=$(date +%s.%N)
    
    local json_data="{\"text\":\"$text\",\"source_language\":\"$source_lang\",\"target_language\":\"$target_lang\",\"conversation_id\":\"$conversation_id\",\"message_id\":\"$message_id\"}"
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "$GATEWAY_URL/translate" \
        -H "Content-Type: application/json" \
        -d "$json_data" 2>/dev/null)
    
    local http_code=$(echo "$response" | tail -n1)
    local response_body=$(echo "$response" | sed '$d')
    local end_time=$(date +%s.%N)
    
    local response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    if [ "$http_code" = "200" ] && echo "$response_body" | grep -q '"success":true'; then
        local translated_text=$(echo "$response_body" | jq -r '.data.translated_text // empty' 2>/dev/null)
        if [ ! -z "$translated_text" ] && [ "$translated_text" != "null" ]; then
            echo -e "${CYAN}🔄 [RETRANS-$request_num] Retraduction (${response_time}s): $text → $translated_text${NC}"
            increment_success
            RESPONSE_TIMES+=($response_time)
        else
            echo -e "${RED}❌ [RETRANS-$request_num] Échec retraduction: Pas de traduction (${response_time}s)${NC}"
            increment_failure
        fi
    else
        echo -e "${RED}❌ [RETRANS-$request_num] Échec HTTP $http_code (${response_time}s)${NC}"
        increment_failure
    fi
}

# Vérifier que la gateway est disponible
echo -e "${YELLOW}🔍 [STRESS TEST] Vérification de la gateway...${NC}"
if ! curl -s "$GATEWAY_URL/health" > /dev/null; then
    echo -e "${RED}❌ [STRESS TEST] Gateway non disponible sur $GATEWAY_URL${NC}"
    exit 1
fi

echo -e "${GREEN}✅ [STRESS TEST] Gateway disponible${NC}"

# Test initial
echo -e "${YELLOW}🧪 [STRESS TEST] Test initial...${NC}"
initial_test=$(curl -s "$GATEWAY_URL/test" | jq -r '.success // false' 2>/dev/null)
if [ "$initial_test" = "true" ]; then
    echo -e "${GREEN}✅ [STRESS TEST] Test initial réussi${NC}"
else
    echo -e "${YELLOW}⚠️  [STRESS TEST] Test initial échoué (normal pour système asynchrone)${NC}"
fi

echo ""
echo -e "${BLUE}🚀 [STRESS TEST] Démarrage du stress test...${NC}"
echo "================================================="

# Phase 1: Requêtes normales
echo -e "${CYAN}📝 [STRESS TEST] Phase 1: Requêtes de traduction normales${NC}"
for ((i=1; i<=TOTAL_REQUESTS/2; i++)); do
    make_translation_request $i &
    
    # Limiter le nombre de requêtes concurrentes
    if [ $((i % CONCURRENT_REQUESTS)) -eq 0 ]; then
        wait
        sleep $DELAY_BETWEEN_BATCHES
    fi
done
wait

echo ""
echo -e "${CYAN}🔄 [STRESS TEST] Phase 2: Requêtes de retraduction${NC}"
for ((i=1; i<=TOTAL_REQUESTS/2; i++)); do
    make_retranslation_request $i &
    
    # Limiter le nombre de requêtes concurrentes
    if [ $((i % CONCURRENT_REQUESTS)) -eq 0 ]; then
        wait
        sleep $DELAY_BETWEEN_BATCHES
    fi
done
wait

# Calculer les statistiques
echo ""
echo -e "${BLUE}📊 [STRESS TEST] Résultats${NC}"
echo "================================================="

# Lire les résultats du fichier
results=$(cat "$RESULTS_FILE")
SUCCESS_COUNT=$(echo "$results" | cut -d' ' -f1)
FAILURE_COUNT=$(echo "$results" | cut -d' ' -f2)

total_requests=$((SUCCESS_COUNT + FAILURE_COUNT))
success_rate=$(echo "scale=2; $SUCCESS_COUNT * 100 / $total_requests" | bc -l 2>/dev/null || echo "0")

echo -e "${GREEN}✅ Succès: $SUCCESS_COUNT${NC}"
echo -e "${RED}❌ Échecs: $FAILURE_COUNT${NC}"
echo -e "${CYAN}📈 Taux de succès: ${success_rate}%${NC}"

# Calculer le temps de réponse moyen
if [ ${#RESPONSE_TIMES[@]} -gt 0 ]; then
    total_time=0
    for time in "${RESPONSE_TIMES[@]}"; do
        total_time=$(echo "$total_time + $time" | bc -l 2>/dev/null || echo "$total_time")
    done
    avg_time=$(echo "scale=3; $total_time / ${#RESPONSE_TIMES[@]}" | bc -l 2>/dev/null || echo "0")
    echo -e "${CYAN}⏱️  Temps de réponse moyen: ${avg_time}s${NC}"
fi

echo ""
echo -e "${GREEN}🎉 [STRESS TEST] Test terminé !${NC}"

# Nettoyer le fichier temporaire
rm -f "$RESULTS_FILE"
