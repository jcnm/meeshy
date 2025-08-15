#!/bin/bash

# Script simple pour démarrer les services Meeshy
set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Variables pour stocker les PIDs
TRANSLATOR_PID=""
GATEWAY_PID=""

# Fonction de nettoyage améliorée
cleanup() {
    echo -e "\n${YELLOW}🛑 [MEESHY] Arrêt de tous les services...${NC}"
    
    # Tuer le traducteur
    if [[ ! -z "$TRANSLATOR_PID" ]]; then
        echo -e "   ${RED}Arrêt du traducteur (PID: $TRANSLATOR_PID)...${NC}"
        kill -TERM $TRANSLATOR_PID 2>/dev/null || true
        sleep 2
        kill -KILL $TRANSLATOR_PID 2>/dev/null || true
    fi
    
    # Tuer la gateway
    if [[ ! -z "$GATEWAY_PID" ]]; then
        echo -e "   ${RED}Arrêt de la gateway (PID: $GATEWAY_PID)...${NC}"
        kill -TERM $GATEWAY_PID 2>/dev/null || true
        sleep 2
        kill -KILL $GATEWAY_PID 2>/dev/null || true
    fi
    
    # Tuer tous les processus sur les ports Meeshy
    echo -e "   ${RED}Nettoyage des ports Meeshy...${NC}"
    lsof -ti:8000 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    lsof -ti:3000 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    lsof -ti:5555 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    lsof -ti:5558 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    
    # Tuer tous les processus enfants de ce script
    echo -e "   ${RED}Nettoyage des processus enfants...${NC}"
    pkill -P $$ 2>/dev/null || true
    
    # Attendre et forcer l'arrêt si nécessaire
    sleep 2
    lsof -ti:8000 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    lsof -ti:3000 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    lsof -ti:5555 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    lsof -ti:5558 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    
    echo -e "${GREEN}✅ [MEESHY] Tous les services arrêtés proprement${NC}"
    exit 0
}

# Capturer tous les signaux d'interruption
trap cleanup SIGINT SIGTERM SIGQUIT SIGHUP EXIT

echo -e "${BLUE}🚀 [MEESHY] Démarrage des services...${NC}"
echo "================================================="

# 1. DÉMARRER LE TRADUCTEUR
echo -e "${YELLOW}🐍 [MEESHY] Démarrage du traducteur...${NC}"
cd translator
.venv/bin/python start_service.py &
TRANSLATOR_PID=$!
cd ..

echo -e "${GREEN}✅ [MEESHY] Traducteur démarré (PID: $TRANSLATOR_PID)${NC}"

# Attendre que le traducteur soit prêt
echo -e "${YELLOW}⏳ [MEESHY] Attente du démarrage du traducteur...${NC}"
sleep 8

# 2. DÉMARRER LA GATEWAY
echo -e "${YELLOW}🌐 [MEESHY] Démarrage de la gateway...${NC}"
cd gateway
pnpm run dev &
GATEWAY_PID=$!
cd ..

echo -e "${GREEN}✅ [MEESHY] Gateway démarrée (PID: $GATEWAY_PID)${NC}"

# Attendre que la gateway soit prête
echo -e "${YELLOW}⏳ [MEESHY] Attente du démarrage de la gateway...${NC}"
sleep 5

# 3. AFFICHER LE RÉSUMÉ
echo -e "\n${GREEN}🎉 [MEESHY] Services démarrés !${NC}"
echo "================================================="
echo -e "${BLUE}📊 [MEESHY] Services actifs:${NC}"
echo "   🐍 Traducteur: PID $TRANSLATOR_PID"
echo "   🌐 Gateway:    PID $GATEWAY_PID"
echo ""
echo -e "${BLUE}🔗 [MEESHY] Endpoints disponibles:${NC}"
echo "   🐍 Traducteur: http://localhost:8000"
echo "   🌐 Gateway:    http://localhost:3000"
echo "   📡 WebSocket:  ws://localhost:3000/ws"
echo "   🏥 Health:     http://localhost:3000/health"
echo ""
echo -e "${YELLOW}💡 [MEESHY] Utilisez Ctrl+C pour arrêter${NC}"
echo "================================================="

# Boucle de surveillance des processus
echo -e "${BLUE}👁️  [MEESHY] Surveillance des services en cours...${NC}"
while true; do
    sleep 5
    
    # Vérifier si les processus sont encore actifs
    if ! kill -0 $TRANSLATOR_PID 2>/dev/null; then
        echo -e "${RED}❌ [MEESHY] Le traducteur s'est arrêté de manière inattendue${NC}"
        break
    fi
    
    if ! kill -0 $GATEWAY_PID 2>/dev/null; then
        echo -e "${RED}❌ [MEESHY] La gateway s'est arrêtée de manière inattendue${NC}"
        break
    fi
done

# Si on arrive ici, un service s'est arrêté
cleanup
