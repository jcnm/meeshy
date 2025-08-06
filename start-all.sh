#!/bin/bash

# Script principal pour démarrer tous les services Meeshy
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${PURPLE}🚀 Démarrage de Meeshy - Tous les services${NC}"
echo "=============================================="

# Fonction de nettoyage
cleanup() {
    echo -e "\n${YELLOW}🛑 Arrêt de tous les services...${NC}"
    
    # Arrêter le frontend
    if [[ ! -z "$FRONTEND_PID" ]]; then
        echo -e "   Arrêt du frontend..."
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Arrêter le gateway
    if [[ ! -z "$GATEWAY_PID" ]]; then
        echo -e "   Arrêt du gateway..."
        kill $GATEWAY_PID 2>/dev/null || true
    fi
    
    # Arrêter le translator
    if [[ ! -z "$TRANSLATOR_PID" ]]; then
        echo -e "   Arrêt du translator..."
        kill $TRANSLATOR_PID 2>/dev/null || true
    fi
    
    # Attendre que tous les processus se terminent
    sleep 3
    
    echo -e "${GREEN}✅ Tous les services arrêtés proprement${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 1. Démarrer le Translator (port 8000)
echo -e "${BLUE}1/3 🐍 Démarrage du Translator...${NC}"
cd translator
./translator.sh &
TRANSLATOR_PID=$!
cd ..
sleep 8

# 2. Démarrer le Gateway (port 3000)
echo -e "${BLUE}2/3 ⚡ Démarrage du Gateway...${NC}"
cd gateway
./gateway.sh &
GATEWAY_PID=$!
cd ..
sleep 8

# 3. Démarrer le Frontend (port 3100)
echo -e "${BLUE}3/3 🎨 Démarrage du Frontend...${NC}"
cd frontend
./frontend.sh &
FRONTEND_PID=$!
cd ..
sleep 10

# Vérification des services
echo -e "${PURPLE}📊 Vérification des services...${NC}"

services_ok=true

# Test Translator
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Translator (port 8000) - OK${NC}"
else
    echo -e "${RED}❌ Translator (port 8000) - ERREUR${NC}"
    services_ok=false
fi

# Test Gateway
if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Gateway (port 3000) - OK${NC}"
else
    echo -e "${RED}❌ Gateway (port 3000) - ERREUR${NC}"
    services_ok=false
fi

# Test Frontend
if curl -s http://localhost:3100 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend (port 3100) - OK${NC}"
else
    echo -e "${RED}❌ Frontend (port 3100) - ERREUR${NC}"
    services_ok=false
fi

echo "=============================================="

if [ "$services_ok" = true ]; then
    echo -e "${GREEN}🎉 Tous les services sont démarrés avec succès !${NC}"
    echo ""
    echo -e "${CYAN}📱 Accès aux services:${NC}"
    echo -e "   🎨 Frontend:    ${BLUE}http://localhost:3100${NC}"
    echo -e "   ⚡ Gateway:     ${BLUE}http://localhost:3000${NC}"
    echo -e "   🐍 Translator:  ${BLUE}http://localhost:8000${NC}"
    echo ""
    echo -e "${CYAN}🧪 Test de la démo de traduction:${NC}"
    echo -e "   ${BLUE}http://localhost:3100/demo-translation${NC}"
    echo ""
    echo -e "${YELLOW}💡 Appuyez sur Ctrl+C pour arrêter tous les services${NC}"
    
    # Attendre indéfiniment
    while true; do
        sleep 10
        
        # Vérifier si tous les processus sont encore vivants
        if ! kill -0 $TRANSLATOR_PID 2>/dev/null || ! kill -0 $GATEWAY_PID 2>/dev/null || ! kill -0 $FRONTEND_PID 2>/dev/null; then
            echo -e "${RED}⚠️  Un service s'est arrêté de manière inattendue${NC}"
            break
        fi
    done
else
    echo -e "${RED}❌ Certains services ont échoué au démarrage${NC}"
    exit 1
fi
