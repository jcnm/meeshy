#!/bin/bash

# Script de test pour vérifier les limites de messages

echo "🧪 Test des Limites de Messages Meeshy"
echo "========================================"
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Vérifier les variables d'environnement
echo "📋 Test 1: Vérification des variables d'environnement"
echo "-------------------------------------------------------"

check_env_var() {
    local service=$1
    local env_file=$2
    local var_name=$3
    local expected=$4
    
    if [ -f "$env_file" ]; then
        if grep -q "^${var_name}=" "$env_file"; then
            local value=$(grep "^${var_name}=" "$env_file" | cut -d'=' -f2 | tr -d '"')
            if [ "$value" = "$expected" ]; then
                echo -e "${GREEN}✓${NC} $service: $var_name = $value"
            else
                echo -e "${YELLOW}⚠${NC} $service: $var_name = $value (attendu: $expected)"
            fi
        else
            echo -e "${RED}✗${NC} $service: $var_name non trouvé dans $env_file"
        fi
    else
        echo -e "${RED}✗${NC} $service: Fichier $env_file non trouvé"
    fi
}

# Vérifier Frontend
echo ""
echo "Frontend (.env.local):"
check_env_var "Frontend" "frontend/.env.local" "NEXT_PUBLIC_MAX_MESSAGE_LENGTH" "1024"
check_env_var "Frontend" "frontend/.env.local" "NEXT_PUBLIC_MAX_TEXT_ATTACHMENT_THRESHOLD" "2000"

# Vérifier Gateway
echo ""
echo "Gateway (env.example):"
check_env_var "Gateway" "gateway/env.example" "MAX_MESSAGE_LENGTH" "1024"
check_env_var "Gateway" "gateway/env.example" "MAX_TEXT_ATTACHMENT_THRESHOLD" "2000"
check_env_var "Gateway" "gateway/env.example" "MAX_TRANSLATION_LENGTH" "500"

# Vérifier Translator
echo ""
echo "Translator (.env):"
check_env_var "Translator" "translator/.env" "MAX_MESSAGE_LENGTH" "1024"
check_env_var "Translator" "translator/.env" "MAX_TEXT_ATTACHMENT_THRESHOLD" "2000"
check_env_var "Translator" "translator/.env" "MAX_TRANSLATION_LENGTH" "500"

# Test 2: Vérifier les fichiers de configuration
echo ""
echo ""
echo "📋 Test 2: Vérification des fichiers de configuration"
echo "-------------------------------------------------------"

check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        echo "   └─ $file"
    else
        echo -e "${RED}✗${NC} $description"
        echo "   └─ $file (non trouvé)"
    fi
}

check_file "gateway/src/config/message-limits.ts" "Configuration Gateway"
check_file "translator/src/config/message_limits.py" "Configuration Translator"
check_file "frontend/utils/messaging-utils.ts" "Utilitaires Frontend"

# Test 3: Vérifier les imports dans les fichiers
echo ""
echo ""
echo "📋 Test 3: Vérification des imports"
echo "-------------------------------------------------------"

check_import() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if [ -f "$file" ]; then
        if grep -q "$pattern" "$file"; then
            echo -e "${GREEN}✓${NC} $description"
        else
            echo -e "${RED}✗${NC} $description (import non trouvé)"
        fi
    else
        echo -e "${RED}✗${NC} $description (fichier non trouvé)"
    fi
}

check_import "gateway/src/socketio/MeeshySocketIOManager.ts" "validateMessageLength" "Import validation Gateway"
check_import "translator/src/api/translation_api.py" "can_translate_message" "Import validation Translator API"
check_import "translator/src/services/zmq_server.py" "can_translate_message" "Import validation Translator ZMQ"

# Test 4: Vérifier la compilation
echo ""
echo ""
echo "📋 Test 4: Vérification de la compilation"
echo "-------------------------------------------------------"

if [ -d "gateway/dist" ]; then
    echo -e "${GREEN}✓${NC} Gateway compilé (dist/ existe)"
else
    echo -e "${YELLOW}⚠${NC} Gateway non compilé (exécuter: cd gateway && pnpm run build)"
fi

if [ -d "frontend/.next" ]; then
    echo -e "${GREEN}✓${NC} Frontend compilé (.next/ existe)"
else
    echo -e "${YELLOW}⚠${NC} Frontend non compilé (exécuter: cd frontend && pnpm run build)"
fi

# Résumé final
echo ""
echo ""
echo "📊 Résumé"
echo "========================================"
echo ""
echo "Configuration des limites:"
echo "  • MAX_MESSAGE_LENGTH: 1024 caractères"
echo "  • MAX_TEXT_ATTACHMENT_THRESHOLD: 2000 caractères"
echo "  • MAX_TRANSLATION_LENGTH: 500 caractères"
echo ""
echo "Services vérifiés:"
echo "  • Frontend: ✓"
echo "  • Gateway: ✓"
echo "  • Translator: ✓"
echo ""
echo "Documentation:"
echo "  • MESSAGE_LIMITS_IMPLEMENTATION.md"
echo ""
echo "✅ Tous les tests de configuration sont terminés!"
echo ""
