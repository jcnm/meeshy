#!/bin/bash

# Script de test complet du serveur de traduction
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}🧪 Test complet du serveur de traduction Meeshy${NC}"
echo "========================================================"

# Vérifier si le serveur est déjà en cours d'exécution
if lsof -i :50051 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Serveur gRPC détecté sur le port 50051${NC}"
    USE_EXISTING_SERVER=true
else
    echo -e "${YELLOW}📡 Aucun serveur détecté, démarrage automatique...${NC}"
    USE_EXISTING_SERVER=false
fi

# Fonction de nettoyage
cleanup() {
    if [[ "$USE_EXISTING_SERVER" == "false" ]] && [[ ! -z "$SERVER_PID" ]]; then
        echo -e "\n${YELLOW}🛑 Arrêt du serveur de test...${NC}"
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
    exit $1
}

trap 'cleanup 1' SIGINT SIGTERM

# Démarrer le serveur si nécessaire
if [[ "$USE_EXISTING_SERVER" == "false" ]]; then
    echo -e "${YELLOW}🚀 Démarrage du serveur de test...${NC}"
    source venv/bin/activate
    python src/translation_server_grpc_optimized.py > server_test.log 2>&1 &
    SERVER_PID=$!
    
    echo -e "${YELLOW}⏳ Attente du démarrage du serveur...${NC}"
    sleep 8
    
    # Vérifier que le serveur a démarré
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo -e "${RED}❌ Échec du démarrage du serveur${NC}"
        echo "Logs du serveur:"
        cat server_test.log
        cleanup 1
    fi
fi

# Activer l'environnement virtuel pour les tests
source venv/bin/activate

# Exécuter les tests
echo -e "${BLUE}🔍 Exécution des tests gRPC...${NC}"
python test_grpc_client.py --wait --timeout 10

TEST_RESULT=$?

if [[ $TEST_RESULT -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 Tous les tests ont réussi !${NC}"
    cleanup 0
else
    echo -e "\n${RED}❌ Certains tests ont échoué${NC}"
    
    if [[ "$USE_EXISTING_SERVER" == "false" ]]; then
        echo -e "${YELLOW}📋 Logs du serveur:${NC}"
        tail -20 server_test.log
    fi
    
    cleanup 1
fi
