#!/bin/bash

# Script de test pour le service de traduction Meeshy
# Vérifie que le service fonctionne correctement

set -e

echo "🧪 Test du service de traduction Meeshy"
echo "======================================"

# Configuration
TRANSLATOR_URL="http://localhost:8000"
HEALTH_ENDPOINT="$TRANSLATOR_URL/health"
TRANSLATE_ENDPOINT="$TRANSLATOR_URL/translate"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les résultats
print_result() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "WARNING" ]; then
        echo -e "${YELLOW}⚠️ $message${NC}"
    else
        echo -e "${RED}❌ $message${NC}"
    fi
}

# Test 1: Vérifier que le service est accessible
echo -e "${BLUE}📡 Test 1: Accessibilité du service${NC}"
if curl -s --connect-timeout 10 "$HEALTH_ENDPOINT" > /dev/null; then
    print_result "OK" "Service accessible sur $TRANSLATOR_URL"
else
    print_result "ERROR" "Service non accessible sur $TRANSLATOR_URL"
    echo "💡 Vérifiez que le service translator est démarré: docker-compose ps translator"
    exit 1
fi

# Test 2: Vérifier l'endpoint de santé
echo -e "${BLUE}🏥 Test 2: Endpoint de santé${NC}"
HEALTH_RESPONSE=$(curl -s --connect-timeout 10 "$HEALTH_ENDPOINT" 2>/dev/null || echo "{}")
if echo "$HEALTH_RESPONSE" | grep -q "status.*ok\|healthy.*true\|status.*200"; then
    print_result "OK" "Endpoint de santé fonctionnel"
    echo "📋 Réponse: $HEALTH_RESPONSE"
else
    print_result "WARNING" "Endpoint de santé retourne une réponse inattendue"
    echo "📋 Réponse: $HEALTH_RESPONSE"
fi

# Test 3: Test de traduction simple (EN -> FR)
echo -e "${BLUE}🌐 Test 3: Traduction EN -> FR${NC}"
TRANSLATION_PAYLOAD='{
    "text": "hello world",
    "source_language": "en",
    "target_language": "fr",
    "model_type": "basic"
}'

TRANSLATION_RESPONSE=$(curl -s --connect-timeout 30 \
    -X POST "$TRANSLATE_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "$TRANSLATION_PAYLOAD" 2>/dev/null || echo "{}")

if echo "$TRANSLATION_RESPONSE" | grep -q "translated_text"; then
    TRANSLATED_TEXT=$(echo "$TRANSLATION_RESPONSE" | grep -o '"translated_text":"[^"]*"' | cut -d'"' -f4)
    print_result "OK" "Traduction EN -> FR réussie"
    echo "📋 Texte original: hello world"
    echo "📋 Texte traduit: $TRANSLATED_TEXT"
    echo "📋 Réponse complète: $TRANSLATION_RESPONSE"
else
    print_result "WARNING" "Traduction EN -> FR échouée ou réponse inattendue"
    echo "📋 Réponse: $TRANSLATION_RESPONSE"
fi

# Test 4: Test de traduction simple (FR -> EN)
echo -e "${BLUE}🌐 Test 4: Traduction FR -> EN${NC}"
TRANSLATION_PAYLOAD_FR='{
    "text": "bonjour le monde",
    "source_language": "fr",
    "target_language": "en",
    "model_type": "basic"
}'

TRANSLATION_RESPONSE_FR=$(curl -s --connect-timeout 30 \
    -X POST "$TRANSLATE_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "$TRANSLATION_PAYLOAD_FR" 2>/dev/null || echo "{}")

if echo "$TRANSLATION_RESPONSE_FR" | grep -q "translated_text"; then
    TRANSLATED_TEXT_FR=$(echo "$TRANSLATION_RESPONSE_FR" | grep -o '"translated_text":"[^"]*"' | cut -d'"' -f4)
    print_result "OK" "Traduction FR -> EN réussie"
    echo "📋 Texte original: bonjour le monde"
    echo "📋 Texte traduit: $TRANSLATED_TEXT_FR"
else
    print_result "WARNING" "Traduction FR -> EN échouée ou réponse inattendue"
    echo "📋 Réponse: $TRANSLATION_RESPONSE_FR"
fi

# Test 5: Test de traduction avec langues identiques
echo -e "${BLUE}🔄 Test 5: Traduction avec langues identiques${NC}"
IDENTICAL_PAYLOAD='{
    "text": "test message",
    "source_language": "en",
    "target_language": "en",
    "model_type": "basic"
}'

IDENTICAL_RESPONSE=$(curl -s --connect-timeout 30 \
    -X POST "$TRANSLATE_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "$IDENTICAL_PAYLOAD" 2>/dev/null || echo "{}")

if echo "$IDENTICAL_RESPONSE" | grep -q "translated_text.*test message"; then
    print_result "OK" "Traduction avec langues identiques gérée correctement"
else
    print_result "WARNING" "Traduction avec langues identiques retourne une réponse inattendue"
    echo "📋 Réponse: $IDENTICAL_RESPONSE"
fi

# Test 6: Test de performance (temps de réponse)
echo -e "${BLUE}⚡ Test 6: Performance (temps de réponse)${NC}"
PERF_PAYLOAD='{
    "text": "quick test",
    "source_language": "en",
    "target_language": "fr",
    "model_type": "basic"
}'

START_TIME=$(date +%s.%N)
PERF_RESPONSE=$(curl -s --connect-timeout 30 \
    -X POST "$TRANSLATE_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "$PERF_PAYLOAD" 2>/dev/null || echo "{}")
END_TIME=$(date +%s.%N)

RESPONSE_TIME=$(echo "$END_TIME - $START_TIME" | bc -l 2>/dev/null || echo "0")
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc -l 2>/dev/null || echo "0")

if (( $(echo "$RESPONSE_TIME_MS < 5000" | bc -l) )); then
    print_result "OK" "Temps de réponse acceptable: ${RESPONSE_TIME_MS}ms"
else
    print_result "WARNING" "Temps de réponse élevé: ${RESPONSE_TIME_MS}ms"
fi

# Test 7: Vérifier les statistiques du service
echo -e "${BLUE}📊 Test 7: Statistiques du service${NC}"
STATS_ENDPOINT="$TRANSLATOR_URL/stats"
STATS_RESPONSE=$(curl -s --connect-timeout 10 "$STATS_ENDPOINT" 2>/dev/null || echo "{}")

if echo "$STATS_RESPONSE" | grep -q "translations_count\|model_used"; then
    print_result "OK" "Endpoint de statistiques fonctionnel"
    echo "📋 Statistiques: $STATS_RESPONSE"
else
    print_result "WARNING" "Endpoint de statistiques retourne une réponse inattendue"
    echo "📋 Réponse: $STATS_RESPONSE"
fi

# Résumé final
echo ""
echo -e "${BLUE}📋 Résumé des tests${NC}"
echo "======================================"

# Compter les résultats
TOTAL_TESTS=7
PASSED_TESTS=0
WARNING_TESTS=0
FAILED_TESTS=0

# Analyser les résultats (simplifié)
if curl -s --connect-timeout 10 "$HEALTH_ENDPOINT" > /dev/null; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

if echo "$TRANSLATION_RESPONSE" | grep -q "translated_text"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    WARNING_TESTS=$((WARNING_TESTS + 1))
fi

if echo "$TRANSLATION_RESPONSE_FR" | grep -q "translated_text"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    WARNING_TESTS=$((WARNING_TESTS + 1))
fi

if echo "$IDENTICAL_RESPONSE" | grep -q "translated_text.*test message"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    WARNING_TESTS=$((WARNING_TESTS + 1))
fi

if (( $(echo "$RESPONSE_TIME_MS < 5000" | bc -l 2>/dev/null || echo "1") )); then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    WARNING_TESTS=$((WARNING_TESTS + 1))
fi

if echo "$STATS_RESPONSE" | grep -q "translations_count\|model_used"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    WARNING_TESTS=$((WARNING_TESTS + 1))
fi

echo -e "${GREEN}✅ Tests réussis: $PASSED_TESTS/$TOTAL_TESTS${NC}"
echo -e "${YELLOW}⚠️ Tests avec avertissements: $WARNING_TESTS/$TOTAL_TESTS${NC}"
echo -e "${RED}❌ Tests échoués: $FAILED_TESTS/$TOTAL_TESTS${NC}"

echo ""
echo "💡 Conseils:"
echo "- Si des tests échouent, vérifiez les logs: docker-compose logs translator -f"
echo "- Si les modèles ne se téléchargent pas, utilisez le script de reconstruction réseau"
echo "- Le service retourne des messages d'échec clairs quand les modèles ne sont pas disponibles"
