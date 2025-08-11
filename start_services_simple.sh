#!/bin/bash

# Script simple pour démarrer les services Meeshy
set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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

# Attendre la fin des processus
wait $TRANSLATOR_PID $GATEWAY_PID
