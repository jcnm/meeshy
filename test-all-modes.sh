#!/bin/bash

# Script de test unifié pour tous les modes de Meeshy
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Test unifié de tous les modes Meeshy${NC}"
echo "=========================================="

# Fonction pour tester un service
test_service() {
    local name=$1
    local url=$2
    local endpoint=$3
    local timeout=${4:-30}
    
    echo -e "${BLUE}🔍 Test de $name...${NC}"
    
    local retries=0
    while [ $retries -lt $timeout ]; do
        if curl -s -f "$url$endpoint" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $name est opérationnel${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ Attente de $name... ($((retries + 1))/$timeout)${NC}"
        sleep 2
        retries=$((retries + 1))
    done
    
    echo -e "${RED}❌ $name n'est pas accessible après $timeout secondes${NC}"
    return 1
}

# Fonction pour tester la traduction
test_translation() {
    local url=$1
    echo -e "${BLUE}🌐 Test de traduction sur $url...${NC}"
    
    if curl -s -X POST "$url/translate" \
        -H "Content-Type: application/json" \
        -d '{"text": "Hello world", "source_lang": "en", "target_lang": "fr"}' | grep -q "Bonjour"; then
        echo -e "${GREEN}✅ Traduction fonctionnelle${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Traduction non testée ou échec${NC}"
        return 1
    fi
}

# Test du mode interne
test_internal_mode() {
    echo -e "${BLUE}🔧 Test du mode interne...${NC}"
    
    # Démarrer en arrière-plan
    ./run-internal.sh &
    INTERNAL_PID=$!
    
    # Attendre un peu
    sleep 10
    
    # Tester les services
    test_service "Frontend (interne)" "http://localhost:3100" "/" 60
    test_service "Gateway (interne)" "http://localhost:3000" "/health" 60
    test_service "Translator (interne)" "http://localhost:8000" "/health" 60
    
    # Tester la traduction
    test_translation "http://localhost:8000"
    
    # Arrêter le mode interne
    kill $INTERNAL_PID 2>/dev/null || true
    wait $INTERNAL_PID 2>/dev/null || true
    
    echo -e "${GREEN}✅ Mode interne testé${NC}"
}

# Test du mode externe
test_external_mode() {
    echo -e "${BLUE}🔧 Test du mode externe...${NC}"
    
    # Démarrer les services externes
    docker-compose -f docker-compose.external.yml up -d
    
    # Attendre que les services soient prêts
    sleep 15
    
    # Tester les services
    test_service "Frontend (externe)" "http://localhost:3100" "/" 60
    test_service "Gateway (externe)" "http://localhost:3000" "/health" 60
    test_service "Translator (externe)" "http://localhost:8000" "/health" 60
    
    # Tester la traduction
    test_translation "http://localhost:8000"
    
    # Arrêter les services externes
    docker-compose -f docker-compose.external.yml down
    
    echo -e "${GREEN}✅ Mode externe testé${NC}"
}

# Menu principal
show_menu() {
    echo -e "${BLUE}Choisissez le mode de test :${NC}"
    echo "1) Mode interne (PostgreSQL + Redis inclus)"
    echo "2) Mode externe (PostgreSQL + Redis séparés)"
    echo "3) Test complet (les deux modes)"
    echo "4) Quitter"
    echo ""
    read -p "Votre choix (1-4): " choice
}

# Exécution selon le choix
case $1 in
    "internal")
        test_internal_mode
        ;;
    "external")
        test_external_mode
        ;;
    "all")
        test_internal_mode
        echo ""
        test_external_mode
        ;;
    *)
        show_menu
        case $choice in
            1)
                test_internal_mode
                ;;
            2)
                test_external_mode
                ;;
            3)
                test_internal_mode
                echo ""
                test_external_mode
                ;;
            4)
                echo -e "${GREEN}Au revoir !${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Choix invalide${NC}"
                exit 1
                ;;
        esac
        ;;
esac

echo -e "${GREEN}🎉 Tests terminés !${NC}"
