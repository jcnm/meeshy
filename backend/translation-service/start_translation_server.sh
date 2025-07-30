#!/bin/bash

# Script de démarrage du serveur de traduction gRPC optimisé
set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}🚀 Démarrage du serveur de traduction gRPC Meeshy${NC}"
echo "============================================================"

# Vérifier l'environnement virtuel
if [[ ! -d "venv" ]]; then
    echo -e "${RED}❌ Environnement virtuel non trouvé${NC}"
    echo "Exécutez: python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Activer l'environnement virtuel
echo -e "${YELLOW}📦 Activation de l'environnement virtuel...${NC}"
source venv/bin/activate

# Vérifier les dépendances critiques
echo -e "${YELLOW}🔍 Vérification des dépendances...${NC}"
python -c "
import sys
missing = []

try:
    import torch
    print('✅ PyTorch:', torch.__version__)
except ImportError:
    missing.append('torch')

try:
    import transformers
    print('✅ Transformers:', transformers.__version__)
except ImportError:
    missing.append('transformers')

try:
    import grpc
    print('✅ gRPC disponible')
except ImportError:
    missing.append('grpcio')

try:
    import langdetect
    print('✅ LangDetect disponible')
except ImportError:
    missing.append('langdetect')

if missing:
    print('❌ Dépendances manquantes:', ', '.join(missing))
    sys.exit(1)
else:
    print('✅ Toutes les dépendances sont présentes')
"

if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Dépendances manquantes${NC}"
    exit 1
fi

# Générer les fichiers protobuf si nécessaire
if [[ ! -f "src/translation_pb2.py" ]] || [[ "translation.proto" -nt "src/translation_pb2.py" ]]; then
    echo -e "${YELLOW}🔧 Génération des fichiers protobuf...${NC}"
    python -m grpc_tools.protoc \
        --proto_path=. \
        --python_out=src \
        --grpc_python_out=src \
        translation.proto
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Fichiers protobuf générés${NC}"
    else
        echo -e "${RED}❌ Erreur génération protobuf${NC}"
        exit 1
    fi
fi

# Variables d'environnement
export PYTHONPATH="${SCRIPT_DIR}/src:$PYTHONPATH"
export GRPC_PORT=${GRPC_PORT:-50051}
export LOG_LEVEL=${LOG_LEVEL:-INFO}

echo -e "${BLUE}📊 Configuration:${NC}"
echo "   Port gRPC: $GRPC_PORT"
echo "   Log Level: $LOG_LEVEL"
echo "   Python Path: $PYTHONPATH"

# Fonction de nettoyage
cleanup() {
    echo -e "\n${YELLOW}🛑 Arrêt du serveur...${NC}"
    if [[ ! -z "$SERVER_PID" ]]; then
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Serveur arrêté proprement${NC}"
    exit 0
}

# Configurer les signaux
trap cleanup SIGINT SIGTERM

# Démarrer le serveur
echo -e "${GREEN}🚀 Démarrage du serveur gRPC...${NC}"
echo "   Utilisez Ctrl+C pour arrêter"
echo "   Logs en temps réel:"
echo "============================================================"

python src/translation_server_grpc_optimized.py &
SERVER_PID=$!

# Attendre que le serveur démarre
sleep 2

# Vérifier si le serveur fonctionne
if kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Serveur démarré avec succès (PID: $SERVER_PID)${NC}"
    echo -e "${BLUE}📡 Service disponible sur localhost:$GRPC_PORT${NC}"
    echo -e "${YELLOW}💡 Testez avec: python test_grpc_client.py${NC}"
else
    echo -e "${RED}❌ Échec du démarrage du serveur${NC}"
    exit 1
fi

# Attendre la fin du processus
wait $SERVER_PID
