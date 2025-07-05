#!/bin/bash

# Script de développement pour Meeshy
# Utilisation: ./dev.sh [command]

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'aide
show_help() {
    echo -e "${BLUE}🌍 Meeshy - Script de Développement${NC}"
    echo ""
    echo "Usage: ./dev.sh [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup       - Installation complète du projet"
    echo "  dev         - Démarrer les serveurs de développement"
    echo "  frontend    - Démarrer uniquement le frontend"
    echo "  backend     - Démarrer uniquement le backend"
    echo "  build       - Build de production"
    echo "  test        - Lancer les tests"
    echo "  lint        - Vérification du code"
    echo "  clean       - Nettoyer les caches et dépendances"
    echo "  models      - Télécharger les modèles de traduction"
    echo "  check       - Vérifier l'état du projet"
    echo "  help        - Afficher cette aide"
    echo ""
}

# Fonction de vérification des prérequis
check_requirements() {
    echo -e "${BLUE}🔍 Vérification des prérequis...${NC}"
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js n'est pas installé${NC}"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}❌ Node.js version 18+ requise (actuelle: $(node -v))${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Node.js $(node -v)${NC}"
    
    # Vérifier npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm n'est pas installé${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ npm $(npm -v)${NC}"
    echo ""
}

# Installation complète
setup() {
    echo -e "${BLUE}🚀 Installation de Meeshy...${NC}"
    
    check_requirements
    
    # Installation frontend
    echo -e "${YELLOW}📦 Installation des dépendances frontend...${NC}"
    npm install
    
    # Installation backend
    echo -e "${YELLOW}📦 Installation des dépendances backend...${NC}"
    cd backend
    npm install
    cd ..
    
    # Création des dossiers nécessaires
    echo -e "${YELLOW}📁 Création des dossiers...${NC}"
    mkdir -p public/models
    mkdir -p .vscode
    
    echo -e "${GREEN}✅ Installation terminée !${NC}"
    echo ""
    echo -e "${BLUE}🎯 Prochaines étapes :${NC}"
    echo "  1. ./dev.sh models  - Télécharger les modèles (optionnel)"
    echo "  2. ./dev.sh dev     - Démarrer le développement"
    echo ""
}

# Démarrage des serveurs de développement
dev() {
    echo -e "${BLUE}🚀 Démarrage des serveurs de développement...${NC}"
    
    # Vérifier si les dépendances sont installées
    if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ]; then
        echo -e "${YELLOW}⚠️  Dépendances manquantes, installation...${NC}"
        setup
    fi
    
    # Démarrer les deux serveurs en parallèle
    echo -e "${YELLOW}🔄 Démarrage du backend (port 3002)...${NC}"
    cd backend && npm run start:dev &
    BACKEND_PID=$!
    cd ..
    
    sleep 3
    
    echo -e "${YELLOW}🔄 Démarrage du frontend (port 3000)...${NC}"
    npm run dev &
    FRONTEND_PID=$!
    
    # Fonction de nettoyage
    cleanup() {
        echo -e "\n${YELLOW}🛑 Arrêt des serveurs...${NC}"
        kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
        exit
    }
    
    # Capturer Ctrl+C
    trap cleanup INT
    
    echo -e "${GREEN}✅ Serveurs démarrés !${NC}"
    echo -e "${BLUE}📱 Frontend: http://localhost:3000${NC}"
    echo -e "${BLUE}🔌 Backend:  http://localhost:3002${NC}"
    echo ""
    echo -e "${YELLOW}Appuyez sur Ctrl+C pour arrêter${NC}"
    
    # Attendre les processus
    wait
}

# Démarrage frontend uniquement
frontend() {
    echo -e "${BLUE}🎨 Démarrage du frontend...${NC}"
    npm run dev
}

# Démarrage backend uniquement
backend() {
    echo -e "${BLUE}🔌 Démarrage du backend...${NC}"
    cd backend && npm run start:dev
}

# Build de production
build() {
    echo -e "${BLUE}🏗️  Build de production...${NC}"
    
    echo -e "${YELLOW}📦 Build frontend...${NC}"
    npm run build
    
    echo -e "${YELLOW}📦 Build backend...${NC}"
    cd backend
    npm run build
    cd ..
    
    echo -e "${GREEN}✅ Build terminé !${NC}"
}

# Tests
test() {
    echo -e "${BLUE}🧪 Lancement des tests...${NC}"
    
    # Tests frontend
    if [ -f "package.json" ] && grep -q "\"test\"" package.json; then
        echo -e "${YELLOW}🔬 Tests frontend...${NC}"
        npm test
    fi
    
    # Tests backend
    if [ -f "backend/package.json" ] && grep -q "\"test\"" backend/package.json; then
        echo -e "${YELLOW}🔬 Tests backend...${NC}"
        cd backend
        npm test
        cd ..
    fi
    
    echo -e "${GREEN}✅ Tests terminés !${NC}"
}

# Linting
lint() {
    echo -e "${BLUE}🔍 Vérification du code...${NC}"
    
    # Lint frontend
    echo -e "${YELLOW}📝 Lint frontend...${NC}"
    npm run lint || true
    
    # Lint backend
    echo -e "${YELLOW}📝 Lint backend...${NC}"
    cd backend
    npm run lint || true
    cd ..
    
    echo -e "${GREEN}✅ Vérification terminée !${NC}"
}

# Nettoyage
clean() {
    echo -e "${BLUE}🧹 Nettoyage...${NC}"
    
    echo -e "${YELLOW}🗑️  Suppression des caches...${NC}"
    rm -rf .next
    rm -rf backend/dist
    rm -rf node_modules/.cache
    rm -rf backend/node_modules/.cache
    
    echo -e "${YELLOW}🗑️  Suppression des dépendances...${NC}"
    rm -rf node_modules
    rm -rf backend/node_modules
    
    echo -e "${GREEN}✅ Nettoyage terminé !${NC}"
}

# Téléchargement des modèles
models() {
    echo -e "${BLUE}🤖 Téléchargement des modèles de traduction...${NC}"
    
    if [ -f "scripts/download-models.sh" ]; then
        chmod +x scripts/download-models.sh
        ./scripts/download-models.sh
    else
        echo -e "${YELLOW}⚠️  Script de téléchargement non trouvé${NC}"
        echo "Création du dossier models..."
        mkdir -p public/models
        echo -e "${BLUE}ℹ️  Les modèles seront téléchargés automatiquement lors de la première utilisation${NC}"
    fi
}

# Vérification de l'état
check() {
    echo -e "${BLUE}🔍 Vérification de l'état du projet...${NC}"
    echo ""
    
    # Vérifier les dépendances
    echo -e "${YELLOW}📦 Dépendances :${NC}"
    if [ -d "node_modules" ]; then
        echo -e "  ✅ Frontend installé"
    else
        echo -e "  ❌ Frontend non installé"
    fi
    
    if [ -d "backend/node_modules" ]; then
        echo -e "  ✅ Backend installé"
    else
        echo -e "  ❌ Backend non installé"
    fi
    
    # Vérifier les ports
    echo -e "\n${YELLOW}🔌 Ports :${NC}"
    if lsof -i :3000 &> /dev/null; then
        echo -e "  🟡 Port 3000 occupé"
    else
        echo -e "  ✅ Port 3000 libre"
    fi
    
    if lsof -i :3002 &> /dev/null; then
        echo -e "  🟡 Port 3002 occupé"
    else
        echo -e "  ✅ Port 3002 libre"
    fi
    
    # Vérifier les modèles
    echo -e "\n${YELLOW}🤖 Modèles :${NC}"
    if [ -d "public/models" ] && [ "$(ls -A public/models)" ]; then
        echo -e "  ✅ Dossier models non vide"
    else
        echo -e "  ⚠️  Dossier models vide (normal en développement)"
    fi
    
    echo ""
}

# Main
case "${1:-help}" in
    setup)
        setup
        ;;
    dev)
        dev
        ;;
    frontend)
        frontend
        ;;
    backend)
        backend
        ;;
    build)
        build
        ;;
    test)
        test
        ;;
    lint)
        lint
        ;;
    clean)
        clean
        ;;
    models)
        models
        ;;
    check)
        check
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Commande inconnue: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
