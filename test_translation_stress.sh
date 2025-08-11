#!/bin/bash

# Script de stress test unifié pour les requêtes de traduction
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}🧪 [UNIFIED TEST] Test de stress unifié des requêtes de traduction${NC}"
echo "=================================================================="

# Configuration
GATEWAY_URL="http://localhost:3000"
TOTAL_REQUESTS=500
CONCURRENT_REQUESTS=20
DELAY_BETWEEN_BATCHES=0.5

# Structure unifiée des langues et textes associés
LANGUAGE_TEXTS=(
    ["en"]="Hello world|This is a test message|The quick brown fox jumps over the lazy dog|Good morning everyone|Technology is changing our lives"
    ["fr"]="Bonjour le monde|Ceci est un message de test|Le renard brun rapide saute par-dessus le chien paresseux|Bonjour tout le monde|La technologie change nos vies"
    ["es"]="Hola mundo|Este es un mensaje de prueba|El zorro marrón rápido salta sobre el perro perezoso|Buenos días a todos|La tecnología está cambiando nuestras vidas"
    ["de"]="Hallo Welt|Das ist eine Testnachricht|Der schnelle braune Fuchs springt über den faulen Hund|Guten Morgen alle zusammen|Technologie verändert unser Leben"
    ["pt"]="Olá mundo|Esta é uma mensagem de teste|A raposa marrom rápida pula sobre o cão preguiçoso|Bom dia a todos|A tecnologia está mudando nossas vidas"
    ["zh"]="你好世界|这是一个测试消息|敏捷的棕色狐狸跳过懒惰的狗|大家早上好|科技正在改变我们的生活"
    ["ja"]="こんにちは世界|これはテストメッセージです|素早い茶色のキツネが怠惰な犬を飛び越える|おはようございます皆さん|技術は私たちの生活を変えています"
    ["ar"]="مرحبا بالعالم|هذه رسالة اختبار|الثعلب البني السريع يقفز فوق الكلب الكسول|صباح الخير للجميع|التكنولوجيا تغير حياتنا"
)

# Définition des paires de langues cohérentes
LANGUAGE_PAIRS=(
    ["en"]="fr,es,de,pt,zh,ja,ar"
    ["fr"]="en,es,de,pt,zh,ja,ar"
    ["es"]="en,fr,de,pt,zh,ja,ar"
    ["de"]="en,fr,es,pt,zh,ja,ar"
    ["pt"]="en,fr,es,de,zh,ja,ar"
    ["zh"]="en,fr,es,de,pt,ja,ar"
    ["ja"]="en,fr,es,de,pt,zh,ar"
    ["ar"]="en,fr,es,de,pt,zh,ja"
)

# Types de modèles supportés
MODEL_TYPES=("basic" "advanced" "premium")

# Variables de statistiques
TOTAL_SUCCESS=0
TOTAL_ERRORS=0
START_TIME=$(date +%s)

# Fichiers temporaires pour thread-safety
SUCCESS_FILE="/tmp/translation_success.txt"
ERROR_FILE="/tmp/translation_errors.txt"
TIMES_FILE="/tmp/translation_times.txt"

# Fonction pour nettoyer les fichiers temporaires
cleanup_temp_files() {
    rm -f "$SUCCESS_FILE" "$ERROR_FILE" "$TIMES_FILE"
    echo "0" > "$SUCCESS_FILE"
    echo "0" > "$ERROR_FILE"
}

# Fonction thread-safe pour incrémenter les compteurs
increment_success() {
    local time_taken="$1"
    echo "1" >> "$SUCCESS_FILE"
    echo "$time_taken" >> "$TIMES_FILE"
}

increment_error() {
    echo "1" >> "$ERROR_FILE"
}

# Fonction pour obtenir un texte cohérent avec la langue source
get_text_for_language() {
    local lang="$1"
    local texts_string="${LANGUAGE_TEXTS[$lang]}"
    
    if [[ -z "$texts_string" ]]; then
        # Fallback pour les langues non définies
        echo "Test message in $lang"
        return
    fi
    
    IFS='|' read -ra TEXTS_ARRAY <<< "$texts_string"
    local random_index=$((RANDOM % ${#TEXTS_ARRAY[@]}))
    echo "${TEXTS_ARRAY[$random_index]}"
}

# Fonction pour obtenir une langue cible cohérente
get_target_language() {
    local source_lang="$1"
    local targets_string="${LANGUAGE_PAIRS[$source_lang]}"
    
    if [[ -z "$targets_string" ]]; then
        # Fallback
        echo "en"
        return
    fi
    
    IFS=',' read -ra TARGETS_ARRAY <<< "$targets_string"
    local random_index=$((RANDOM % ${#TARGETS_ARRAY[@]}))
    echo "${TARGETS_ARRAY[$random_index]}"
}

# Fonction pour générer une requête cohérente
generate_coherent_request() {
    local request_id="$1"
    
    # Sélectionner une langue source aléatoire
    local source_languages=($(printf '%s\n' "${!LANGUAGE_TEXTS[@]}" | shuf))
    local source_lang="${source_languages[0]}"
    
    # Obtenir un texte cohérent pour cette langue
    local text=$(get_text_for_language "$source_lang")
    
    # Obtenir une langue cible cohérente
    local target_lang=$(get_target_language "$source_lang")
    
    # Sélectionner un type de modèle
    local model_type="${MODEL_TYPES[$((RANDOM % ${#MODEL_TYPES[@]}))]}"
    
    # Génération d'IDs pour les cas de retraduction (30% de chance)
    local conversation_id="conv-$(date +%s)-$((RANDOM % 1000))"
    local message_id=""
    
    if [[ $((RANDOM % 10)) -lt 3 ]]; then
        message_id="msg-$((RANDOM % 1000))"
    fi
    
    echo "$source_lang|$target_lang|$text|$model_type|$conversation_id|$message_id"
}

# Fonction pour faire une requête de traduction
make_translation_request() {
    local request_data="$1"
    local request_id="$2"
    
    IFS='|' read -ra REQUEST_PARTS <<< "$request_data"
    local source_lang="${REQUEST_PARTS[0]}"
    local target_lang="${REQUEST_PARTS[1]}"
    local text="${REQUEST_PARTS[2]}"
    local model_type="${REQUEST_PARTS[3]}"
    local conversation_id="${REQUEST_PARTS[4]}"
    local message_id="${REQUEST_PARTS[5]}"
    
    local start_time=$(date +%s.%N)
    
    # Construire le payload JSON
    local json_payload="{\"text\":\"$text\",\"source_language\":\"$source_lang\",\"target_language\":\"$target_lang\",\"model_type\":\"$model_type\",\"conversation_id\":\"$conversation_id\""
    
    if [[ -n "$message_id" ]]; then
        json_payload="$json_payload,\"message_id\":\"$message_id\""
    fi
    
    json_payload="$json_payload}"
    
    # Faire la requête
    local response=$(curl -s -w "\n%{http_code}\n%{time_total}" \
        -X POST "${GATEWAY_URL}/translate" \
        -H "Content-Type: application/json" \
        -H "User-Agent: StressTest/1.0" \
        -d "$json_payload" 2>/dev/null)
    
    local http_code=$(echo "$response" | tail -n 2 | head -n 1)
    local time_total=$(echo "$response" | tail -n 1)
    local json_response=$(echo "$response" | sed '$d' | sed '$d')
    local end_time=$(date +%s.%N)
    
    # Validation de la réponse
    if [[ "$http_code" == "200" ]]; then
        if echo "$json_response" | jq -e '.success == true and .data.translated_text != null' > /dev/null 2>&1; then
            local translated_text=$(echo "$json_response" | jq -r '.data.translated_text' 2>/dev/null)
            local request_type="NOUVELLE"
            
            if [[ -n "$message_id" ]]; then
                request_type="RETRADUCTION"
            fi
            
            echo -e "${GREEN}✅ [$request_id|$request_type] $source_lang→$target_lang: \"$(echo "$text" | cut -c1-30)...\" → \"$(echo "$translated_text" | cut -c1-30)...\" (${time_total}s)${NC}"
            increment_success "$time_total"
        else
            echo -e "${RED}❌ [$request_id] Réponse JSON invalide - $source_lang→$target_lang${NC}"
            increment_error
        fi
    else
        echo -e "${RED}❌ [$request_id] HTTP $http_code - $source_lang→$target_lang${NC}"
        increment_error
    fi
}

# Vérification de la disponibilité de la gateway
echo -e "${CYAN}🔍 [TEST] Vérification de la gateway sur $GATEWAY_URL...${NC}"
if ! curl -s --connect-timeout 5 "${GATEWAY_URL}/health" > /dev/null; then
    echo -e "${RED}❌ [TEST] Gateway non accessible${NC}"
    echo -e "${YELLOW}💡 [TEST] Démarrez les services avec: ./start_meeshy_services.sh${NC}"
    exit 1
fi

echo -e "${GREEN}✅ [TEST] Gateway accessible${NC}"

# Test de cohérence initial
echo -e "${CYAN}🧪 [TEST] Test de cohérence initial...${NC}"
test_request=$(generate_coherent_request "INIT")
IFS='|' read -ra INIT_PARTS <<< "$test_request"
test_response=$(curl -s -X POST "${GATEWAY_URL}/translate" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"${INIT_PARTS[2]}\",\"source_language\":\"${INIT_PARTS[0]}\",\"target_language\":\"${INIT_PARTS[1]}\",\"model_type\":\"${INIT_PARTS[3]}\"}")

if echo "$test_response" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ [TEST] Test de cohérence réussi (${INIT_PARTS[0]} → ${INIT_PARTS[1]})${NC}"
else
    echo -e "${YELLOW}⚠️  [TEST] Test initial échoué, mais on continue...${NC}"
fi

# Initialisation des fichiers temporaires
cleanup_temp_files

echo -e "\n${BLUE}🚀 [TEST] Démarrage du stress test unifié${NC}"
echo "================================================="
echo -e "${CYAN}📊 Configuration:${NC}"
echo "   - Requêtes totales: $TOTAL_REQUESTS"
echo "   - Requêtes concurrentes: $CONCURRENT_REQUESTS"
echo "   - Délai entre lots: ${DELAY_BETWEEN_BATCHES}s"
echo "   - Langues supportées: ${#LANGUAGE_TEXTS[@]}"
echo "   - Types de modèles: ${#MODEL_TYPES[@]}"
echo ""

# Génération et exécution des requêtes
echo -e "${BLUE}🔄 [TEST] Génération des requêtes cohérentes...${NC}"
for ((i=1; i<=TOTAL_REQUESTS; i++)); do
    request_data=$(generate_coherent_request "$i")
    make_translation_request "$request_data" "$i" &
    
    # Gestion de la concurrence
    if ((i % CONCURRENT_REQUESTS == 0)); then
        wait
        echo -e "${YELLOW}⏳ [TEST] Lot $((i/CONCURRENT_REQUESTS))/$((TOTAL_REQUESTS/CONCURRENT_REQUESTS)) terminé${NC}"
        sleep $DELAY_BETWEEN_BATCHES
    fi
done

# Attendre les dernières requêtes
wait

# Calcul des statistiques finales
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

SUCCESS_COUNT=$(wc -l < "$SUCCESS_FILE" 2>/dev/null || echo "0")
ERROR_COUNT=$(wc -l < "$ERROR_FILE" 2>/dev/null || echo "0")

# Calculs des temps de réponse
AVG_TIME=0
MIN_TIME=0
MAX_TIME=0

if [[ -f "$TIMES_FILE" && -s "$TIMES_FILE" ]]; then
    AVG_TIME=$(awk '{sum += $1; count++} END {if (count > 0) print sum/count; else print 0}' "$TIMES_FILE")
    MIN_TIME=$(sort -n "$TIMES_FILE" | head -n1)
    MAX_TIME=$(sort -n "$TIMES_FILE" | tail -n1)
fi

# Affichage des résultats
echo -e "\n${GREEN}📊 [TEST] Résultats du test de stress unifié${NC}"
echo "================================================="
echo -e "${BLUE}📈 Statistiques générales:${NC}"
echo "   Requêtes totales: $TOTAL_REQUESTS"
echo "   Requêtes réussies: $SUCCESS_COUNT"
echo "   Requêtes échouées: $ERROR_COUNT"
echo "   Taux de succès: $((SUCCESS_COUNT * 100 / TOTAL_REQUESTS))%"
echo ""
echo -e "${BLUE}⏱️  Performance:${NC}"
echo "   Durée totale: ${TOTAL_DURATION}s"
echo "   Temps de réponse moyen: ${AVG_TIME}s"
echo "   Temps de réponse min: ${MIN_TIME}s"
echo "   Temps de réponse max: ${MAX_TIME}s"
echo "   Requêtes/seconde: $(echo "scale=2; $SUCCESS_COUNT / $TOTAL_DURATION" | bc -l 2>/dev/null || echo "N/A")"
echo ""

# Évaluation qualitative
success_rate=$((SUCCESS_COUNT * 100 / TOTAL_REQUESTS))

if [[ $success_rate -ge 95 ]]; then
    echo -e "${GREEN}🎉 [TEST] Excellent ! Taux de succès ≥ 95%${NC}"
elif [[ $success_rate -ge 90 ]]; then
    echo -e "${GREEN}✅ [TEST] Très bien ! Taux de succès ≥ 90%${NC}"
elif [[ $success_rate -ge 80 ]]; then
    echo -e "${YELLOW}⚠️  [TEST] Acceptable. Taux de succès ≥ 80%${NC}"
else
    echo -e "${RED}❌ [TEST] Problématique. Taux de succès < 80%${NC}"
fi

# Recommandations
echo -e "\n${CYAN}💡 [TEST] Recommandations:${NC}"
if [[ $(echo "$AVG_TIME > 2.0" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
    echo "   - Temps de réponse élevé (>2s), considérez l'optimisation"
fi
if [[ $ERROR_COUNT -gt $((TOTAL_REQUESTS / 10)) ]]; then
    echo "   - Taux d'erreur élevé (>10%), vérifiez la stabilité du service"
fi
if [[ $success_rate -lt 95 ]]; then
    echo "   - Améliorez la gestion des erreurs et la résilience"
fi

# Nettoyage
cleanup_temp_files

echo -e "\n${BLUE}🏁 [TEST] Test de stress unifié terminé${NC}"