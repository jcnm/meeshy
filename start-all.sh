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

# Fonction de nettoyage améliorée
cleanup() {
    echo -e "\n${YELLOW}🛑 Arrêt de tous les services...${NC}"
    
    # Tuer tous les processus enfants directement
    if [[ ! -z "$FRONTEND_PID" ]]; then
        echo -e "   Arrêt du frontend (PID: $FRONTEND_PID)..."
        kill -TERM $FRONTEND_PID 2>/dev/null || true
        # Forcer l'arrêt si nécessaire
        sleep 2
        kill -KILL $FRONTEND_PID 2>/dev/null || true
    fi
    
    if [[ ! -z "$GATEWAY_PID" ]]; then
        echo -e "   Arrêt du gateway (PID: $GATEWAY_PID)..."
        kill -TERM $GATEWAY_PID 2>/dev/null || true
        # Forcer l'arrêt si nécessaire
        sleep 2
        kill -KILL $GATEWAY_PID 2>/dev/null || true
    fi
    
    if [[ ! -z "$TRANSLATOR_PID" ]]; then
        echo -e "   Arrêt du translator (PID: $TRANSLATOR_PID)..."
        kill -TERM $TRANSLATOR_PID 2>/dev/null || true
        # Forcer l'arrêt si nécessaire
        sleep 2
        kill -KILL $TRANSLATOR_PID 2>/dev/null || true
    fi
    
    # Nettoyer tous les processus Meeshy spécifiques
    echo -e "   Nettoyage des processus Meeshy..."
    
    # Processus Node.js/Next.js du frontend
    pkill -f "next dev.*turbopack" 2>/dev/null || true
    pkill -f "next-server" 2>/dev/null || true
    pkill -f "meeshy-frontend" 2>/dev/null || true
    
    # Processus TSX/Node.js du gateway
    pkill -f "tsx.*watch.*src/server.ts" 2>/dev/null || true
    pkill -f "node.*tsx.*gateway" 2>/dev/null || true
    pkill -f "fastify.*gateway" 2>/dev/null || true
    
    # Processus Python du translator
    pkill -f "start_service.py" 2>/dev/null || true
    pkill -f "uvicorn.*translator" 2>/dev/null || true
    pkill -f "python.*translator" 2>/dev/null || true
    
    # Processus des scripts de démarrage
    pkill -f "frontend.sh" 2>/dev/null || true
    pkill -f "gateway.sh" 2>/dev/null || true
    pkill -f "translator.sh" 2>/dev/null || true
    
    # Attendre que les processus se terminent proprement
    sleep 3
    
    # Tuer tous les processus sur les ports utilisés par Meeshy
    echo -e "   Nettoyage des ports Meeshy..."
    lsof -ti:3000 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    lsof -ti:3100 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    lsof -ti:8000 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    lsof -ti:5555 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    lsof -ti:5558 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    
    # Tuer tous les processus enfants de ce script
    echo -e "   Nettoyage des processus enfants..."
    pkill -P $$ 2>/dev/null || true
    
    # Attendre que tous les processus se terminent
    sleep 2
    
    # Forcer l'arrêt des processus récalcitrants
    pkill -9 -f "tsx.*watch.*src/server.ts" 2>/dev/null || true
    pkill -9 -f "start_service.py" 2>/dev/null || true
    pkill -9 -f "next dev.*turbopack" 2>/dev/null || true
    
    # Forcer l'arrêt des ports si nécessaire
    lsof -ti:3000 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    lsof -ti:3100 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    lsof -ti:8000 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    lsof -ti:5555 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    lsof -ti:5558 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    
    echo -e "${GREEN}✅ Tous les services arrêtés proprement${NC}"
    exit 0
}

# Capturer tous les signaux d'interruption
trap cleanup SIGINT SIGTERM SIGQUIT SIGHUP EXIT

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
