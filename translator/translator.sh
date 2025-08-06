#!/bin/bash

# Script de démarrage du translator Python Meeshy
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}🐍 [TRA] Démarrage du translator Python Meeshy${NC}"
echo "================================================="

# Vérifier Python
if ! command -v python3 >/dev/null 2>&1; then
    echo -e "${RED}❌ Python3 non trouvé${NC}"
    exit 1
fi

echo -e "${GREEN}✅ [TRA] Python version: $(python3 --version)${NC}"

# Vérifier l'environnement virtuel
if [[ ! -d ".venv" ]]; then
    echo -e "${YELLOW}🔧 [TRA] Création de l'environnement virtuel...${NC}"
    python3 -m venv .venv
fi

# Activer l'environnement virtuel et installer les dépendances
if [[ ! -f ".venv/bin/uvicorn" ]]; then
    echo -e "${YELLOW}📦 [TRA] Installation des dépendances...${NC}"
    .venv/bin/pip install --no-cache-dir -r requirements.txt
fi

# Variables d'environnement
export NODE_ENV=${NODE_ENV:-development}
export DATABASE_URL=${DATABASE_URL:-"file:./dev.db"}
export REDIS_URL=${REDIS_URL:-"memory://"}
export TRANSLATOR_CACHE_TYPE=${TRANSLATOR_CACHE_TYPE:-"memory"}

echo -e "${BLUE}📊 [TRA] Configuration:${NC}"
echo "   Port: 8000"
echo "   Environment: $NODE_ENV"
echo "   Database: $DATABASE_URL"
echo "   Cache: $TRANSLATOR_CACHE_TYPE"

# Fonction de nettoyage
cleanup() {
    echo -e "\n${YELLOW}🛑 [TRA] Arrêt du translator...${NC}"
    if [[ ! -z "$TRANSLATOR_PID" ]]; then
        kill $TRANSLATOR_PID 2>/dev/null || true
        wait $TRANSLATOR_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ [TRA] Translator arrêté proprement${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Démarrer le translator
echo -e "${GREEN}🚀 [TRA] Démarrage du translator intégré (FastAPI + ZMQ)...${NC}"
echo "   Utilisez Ctrl+C pour arrêter"
echo "================================================="

# Démarrer avec Python directement (main.py gère FastAPI + ZMQ)
.venv/bin/python main.py &
TRANSLATOR_PID=$!

# Attendre le démarrage
sleep 5

# Vérifier si le serveur fonctionne
if kill -0 $TRANSLATOR_PID 2>/dev/null; then
    echo -e "${GREEN}✅ [TRA] Translator démarré avec succès (PID: $TRANSLATOR_PID)${NC}"
    echo -e "${BLUE}🌐 [TRA] API disponible sur http://localhost:8000${NC}"
    echo -e "${YELLOW}💡 [TRA] Endpoints disponibles:${NC}"
    echo "   GET  /health              - Status du service"
    echo "   POST /translate           - Traduction de texte"
    echo "   POST /detect-language     - Détection de langue"
    echo "   GET  /docs               - Documentation API"
else
    echo -e "${RED}❌ [TRA] Échec du démarrage du translator${NC}"
    exit 1
fi

# Attendre la fin du processus
wait $TRANSLATOR_PID
