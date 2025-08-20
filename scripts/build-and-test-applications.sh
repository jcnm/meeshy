#!/bin/bash

# Build and Test Applications for Meeshy
# Orchestrates the complete testing and building process

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSION_MANAGER="$SCRIPT_DIR/utils/version-manager.sh"
UNIT_TESTS="$SCRIPT_DIR/tests/run-unit-tests.sh"
INTEGRATION_TESTS="$SCRIPT_DIR/tests/run-integration-tests.sh"
BUILD_SCRIPT="$SCRIPT_DIR/deployment/build-and-push-docker-images.sh"

# Fonction pour afficher l'aide
show_help() {
    echo -e "${BLUE}Build and Test Applications for Meeshy${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-unit-tests        Skip unit tests"
    echo "  --skip-integration-tests Skip integration tests"
    echo "  --skip-build             Skip Docker build and push"
    echo "  --auto-increment [TYPE]  Auto increment version (major|minor|patch)"
    echo "  --version [VERSION]      Use specific version"
    echo "  --help                   Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                        # Full pipeline with auto-increment"
    echo "  $0 --skip-unit-tests      # Skip unit tests"
    echo "  $0 --auto-increment minor # Increment minor version"
    echo "  $0 --version 1.0.0-alpha  # Use specific version"
    echo ""
}

# Variables par défaut
SKIP_UNIT_TESTS=false
SKIP_INTEGRATION_TESTS=false
SKIP_BUILD=false
AUTO_INCREMENT_TYPE="patch"
USE_SPECIFIC_VERSION=""

# Parser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-unit-tests)
            SKIP_UNIT_TESTS=true
            shift
            ;;
        --skip-integration-tests)
            SKIP_INTEGRATION_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --auto-increment)
            AUTO_INCREMENT_TYPE="$2"
            shift 2
            ;;
        --version)
            USE_SPECIFIC_VERSION="$2"
            shift 2
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Option inconnue: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 Pipeline de build et tests Meeshy${NC}"
echo -e "${BLUE}=====================================${NC}"

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ Ce script doit être exécuté depuis la racine du projet Meeshy${NC}"
    exit 1
fi

# Vérifier que les scripts requis existent
if [ ! -f "$VERSION_MANAGER" ]; then
    echo -e "${RED}❌ Script de gestion des versions non trouvé: $VERSION_MANAGER${NC}"
    exit 1
fi

# Gestion des versions
echo -e "${BLUE}📋 Gestion des versions...${NC}"
if [ -n "$USE_SPECIFIC_VERSION" ]; then
    echo -e "${YELLOW}🔧 Utilisation de la version spécifique: $USE_SPECIFIC_VERSION${NC}"
    bash "$VERSION_MANAGER" update "$USE_SPECIFIC_VERSION"
else
    echo -e "${YELLOW}🔧 Incrémentation automatique de la version ($AUTO_INCREMENT_TYPE)...${NC}"
    bash "$VERSION_MANAGER" auto-increment "$AUTO_INCREMENT_TYPE"
fi

CURRENT_VERSION=$(bash "$VERSION_MANAGER" current)
echo -e "${GREEN}✅ Version actuelle: $CURRENT_VERSION${NC}"

# Tests unitaires
if [ "$SKIP_UNIT_TESTS" = false ]; then
    echo -e "${BLUE}🧪 Phase 1: Tests unitaires${NC}"
    echo -e "${BLUE}===========================${NC}"
    
    if [ -f "$UNIT_TESTS" ]; then
        if bash "$UNIT_TESTS"; then
            echo -e "${GREEN}✅ Tests unitaires terminés avec succès${NC}"
        else
            echo -e "${RED}❌ Tests unitaires échoués${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  Script de tests unitaires non trouvé: $UNIT_TESTS${NC}"
        echo -e "${YELLOW}⚠️  Continuation sans tests unitaires...${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Tests unitaires ignorés${NC}"
fi

# Tests d'intégration
if [ "$SKIP_INTEGRATION_TESTS" = false ]; then
    echo -e "${BLUE}🔗 Phase 2: Tests d'intégration${NC}"
    echo -e "${BLUE}===============================${NC}"
    
    if [ -f "$INTEGRATION_TESTS" ]; then
        if bash "$INTEGRATION_TESTS"; then
            echo -e "${GREEN}✅ Tests d'intégration terminés avec succès${NC}"
        else
            echo -e "${RED}❌ Tests d'intégration échoués${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  Script de tests d'intégration non trouvé: $INTEGRATION_TESTS${NC}"
        echo -e "${YELLOW}⚠️  Continuation sans tests d'intégration...${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Tests d'intégration ignorés${NC}"
fi

# Build et publication
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${BLUE}🏗️  Phase 3: Build et publication${NC}"
    echo -e "${BLUE}=================================${NC}"
    
    if [ -f "$BUILD_SCRIPT" ]; then
        echo -e "${YELLOW}🔨 Démarrage du build et de la publication...${NC}"
        if bash "$BUILD_SCRIPT"; then
            echo -e "${GREEN}✅ Build et publication terminés avec succès${NC}"
        else
            echo -e "${RED}❌ Build et publication échoués${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  Script de build non trouvé: $BUILD_SCRIPT${NC}"
        echo -e "${YELLOW}⚠️  Utilisation du script de build par défaut...${NC}"
        
        # Utiliser le script de build existant
        if [ -f "build-and-push-0.5.1-alpha.sh" ]; then
            # Remplacer la version dans le script temporairement
            sed "s/VERSION=\"0.5.1-alpha\"/VERSION=\"$CURRENT_VERSION\"/" build-and-push-0.5.1-alpha.sh > build-temp.sh
            chmod +x build-temp.sh
            
            if bash build-temp.sh; then
                echo -e "${GREEN}✅ Build et publication terminés avec succès${NC}"
            else
                echo -e "${RED}❌ Build et publication échoués${NC}"
                rm -f build-temp.sh
                exit 1
            fi
            
            rm -f build-temp.sh
        else
            echo -e "${RED}❌ Aucun script de build trouvé${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⏭️  Build et publication ignorés${NC}"
fi

# Résumé final
echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}🎉 Pipeline terminé avec succès !${NC}"
echo -e "${BLUE}📋 Version finale: $CURRENT_VERSION${NC}"
echo -e "${BLUE}📊 Résultats disponibles dans: test-results/${NC}"

# Afficher les images publiées
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${BLUE}🐳 Images Docker publiées:${NC}"
    echo -e "  • isopen/meeshy-translator:$CURRENT_VERSION"
    echo -e "  • isopen/meeshy-gateway:$CURRENT_VERSION"
    echo -e "  • isopen/meeshy-frontend:$CURRENT_VERSION"
    echo -e "  • isopen/meeshy:$CURRENT_VERSION"
fi

echo -e "${GREEN}✅ Pipeline complet terminé !${NC}"
