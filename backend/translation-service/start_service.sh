#!/bin/bash

# Script de démarrage du service de traduction Meeshy
# Ce script lance le service FastAPI avec tous les composants

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🌍 MEESHY TRANSLATION SERVICE${NC}"
echo -e "${BLUE}========================================${NC}"

# Vérifier Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 non trouvé${NC}"
    exit 1
fi

# Vérifier les variables d'environnement
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️ Fichier .env non trouvé, copie de .env.example${NC}"
    cp .env.example .env
fi

# Installer les dépendances si nécessaire
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Création de l'environnement virtuel...${NC}"
    python3 -m venv venv
fi

echo -e "${YELLOW}🔧 Activation de l'environnement virtuel...${NC}"
source venv/bin/activate

echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
pip install -r requirements.txt

# Vérifier Redis (optionnel)
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✅ Redis disponible${NC}"
    else
        echo -e "${YELLOW}⚠️ Redis non disponible - utilisation du cache local${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Redis CLI non trouvé - utilisation du cache local${NC}"
fi

# Vérifier la base de données Prisma
echo -e "${YELLOW}🗄️ Vérification de la base de données...${NC}"
if [ -f "../shared/dev.db" ]; then
    echo -e "${GREEN}✅ Base de données trouvée${NC}"
else
    echo -e "${YELLOW}⚠️ Base de données non trouvée - assurez-vous que Prisma est configuré${NC}"
fi

# Vérifier les modèles ML
MODELS_PATH="../../../public/models"
if [ -d "$MODELS_PATH" ]; then
    echo -e "${GREEN}✅ Dossier des modèles trouvé${NC}"
    MODEL_COUNT=$(find "$MODELS_PATH" -type d -maxdepth 1 | wc -l)
    echo -e "${BLUE}📊 Modèles disponibles: $((MODEL_COUNT - 1))${NC}"
else
    echo -e "${YELLOW}⚠️ Dossier des modèles non trouvé: $MODELS_PATH${NC}"
    echo -e "${YELLOW}   Le service fonctionnera en mode dégradé${NC}"
fi

# Configuration
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}🚀 Démarrage du service de traduction...${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 FastAPI: http://localhost:8000${NC}"
echo -e "${BLUE}📚 Documentation: http://localhost:8000/docs${NC}"
echo -e "${BLUE}🔌 gRPC: localhost:50051${NC}"
echo -e "${BLUE}⚡ ZMQ: localhost:5555${NC}"
echo -e "${BLUE}🛑 Arrêt: Ctrl+C${NC}"
echo -e "${BLUE}========================================${NC}"

# Démarrer le service
cd src
python main.py
