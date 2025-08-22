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
    echo "  --skip-unit-tests        Skip unit tests phase"
    echo "  --skip-integration-tests Skip integration tests phase"
    echo "  --skip-build             Skip Docker build and push phase"
    echo "  --skip-translator        Skip translator build"
    echo "  --skip-gateway           Skip gateway build"
    echo "  --skip-frontend          Skip frontend build"
    echo "  --skip-unified           Skip unified image build"
    echo "  --unified-only           Build only the unified image"
    echo "  --auto-increment [TYPE]  Auto increment version (major|minor|patch)"
    echo "  --version [VERSION]      Use specific version"
    echo "  --help                   Show this help"
    echo ""
    echo "Phases:"
    echo "  1. Version Management     - Auto-increment or set specific version"
    echo "  2. Unit Tests            - Run unit tests for all services"
    echo "  3. Integration Tests     - Run integration tests"
    echo "  4. Build & Push          - Build and push Docker images"
    echo ""
    echo "Examples:"
    echo "  $0                        # Full pipeline with auto-increment"
    echo "  $0 --skip-unit-tests      # Skip unit tests phase"
    echo "  $0 --skip-build           # Skip build phase (tests only)"
    echo "  $0 --unified-only         # Build only unified image"
    echo "  $0 --skip-frontend        # Skip frontend build"
    echo "  $0 --auto-increment minor # Increment minor version"
    echo "  $0 --version 1.0.0-alpha  # Use specific version"
    echo "  $0 --skip-unit-tests --skip-integration-tests  # Build only"
    echo ""
    echo "Note: If a phase script is missing, the pipeline will continue"
    echo "      with a warning message and skip that phase."
    echo ""
}

# Variables par défaut
SKIP_UNIT_TESTS=false
SKIP_INTEGRATION_TESTS=false
SKIP_BUILD=false
SKIP_TRANSLATOR=false
SKIP_GATEWAY=false
SKIP_FRONTEND=false
SKIP_UNIFIED=false
BUILD_UNIFIED_ONLY=false
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
        --skip-translator)
            SKIP_TRANSLATOR=true
            shift
            ;;
        --skip-gateway)
            SKIP_GATEWAY=true
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --skip-unified)
            SKIP_UNIFIED=true
            shift
            ;;
        --unified-only)
            BUILD_UNIFIED_ONLY=true
            SKIP_TRANSLATOR=true
            SKIP_GATEWAY=true
            SKIP_FRONTEND=true
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
echo -e "${BLUE}🔍 Vérification des scripts requis...${NC}"
MISSING_SCRIPTS=()

if [ ! -f "$VERSION_MANAGER" ]; then
    MISSING_SCRIPTS+=("Version Manager: $VERSION_MANAGER")
fi

if [ ! -f "$UNIT_TESTS" ]; then
    MISSING_SCRIPTS+=("Unit Tests: $UNIT_TESTS")
fi

if [ ! -f "$INTEGRATION_TESTS" ]; then
    MISSING_SCRIPTS+=("Integration Tests: $INTEGRATION_TESTS")
fi

if [ ! -f "$BUILD_SCRIPT" ]; then
    MISSING_SCRIPTS+=("Build Script: $BUILD_SCRIPT")
fi

if [ ${#MISSING_SCRIPTS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Scripts manquants détectés:${NC}"
    for script in "${MISSING_SCRIPTS[@]}"; do
        echo -e "${YELLOW}   • $script${NC}"
    done
    echo -e "${YELLOW}⚠️  Le pipeline continuera mais certaines phases pourront être ignorées${NC}"
    echo ""
fi

# Phase 1: Gestion des versions
echo -e "${BLUE}📋 Phase 1: Gestion des versions${NC}"
echo -e "${BLUE}===============================${NC}"

if [ -f "$VERSION_MANAGER" ]; then
    if [ -n "$USE_SPECIFIC_VERSION" ]; then
        echo -e "${YELLOW}🔧 Utilisation de la version spécifique: $USE_SPECIFIC_VERSION${NC}"
        bash "$VERSION_MANAGER" update "$USE_SPECIFIC_VERSION"
    else
        echo -e "${YELLOW}🔧 Incrémentation automatique de la version ($AUTO_INCREMENT_TYPE)...${NC}"
        bash "$VERSION_MANAGER" auto-increment "$AUTO_INCREMENT_TYPE"
    fi

    CURRENT_VERSION=$(bash "$VERSION_MANAGER" current)
    echo -e "${GREEN}✅ Version actuelle: $CURRENT_VERSION${NC}"
else
    echo -e "${RED}❌ Script de gestion des versions non trouvé${NC}"
    echo -e "${YELLOW}⚠️  Utilisation de la version par défaut: 0.5.0-alpha${NC}"
    CURRENT_VERSION="0.5.0-alpha"
fi

# Phase 2: Tests unitaires
if [ "$SKIP_UNIT_TESTS" = false ]; then
    echo -e "${BLUE}🧪 Phase 2: Tests unitaires${NC}"
    echo -e "${BLUE}===========================${NC}"
    
    if [ -f "$UNIT_TESTS" ]; then
        echo -e "${YELLOW}🔍 Démarrage des tests unitaires...${NC}"
        if bash "$UNIT_TESTS"; then
            echo -e "${GREEN}✅ Tests unitaires terminés avec succès${NC}"
        else
            echo -e "${RED}❌ Tests unitaires échoués${NC}"
            echo -e "${YELLOW}💡 Utilisez --skip-unit-tests pour ignorer cette phase${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  Script de tests unitaires non trouvé: $UNIT_TESTS${NC}"
        echo -e "${YELLOW}⚠️  Cette phase sera ignorée${NC}"
        echo -e "${YELLOW}💡 Créez le script de tests unitaires pour activer cette phase${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Phase 2: Tests unitaires ignorés (--skip-unit-tests)${NC}"
fi

# Phase 3: Tests d'intégration
if [ "$SKIP_INTEGRATION_TESTS" = false ]; then
    echo -e "${BLUE}🔗 Phase 3: Tests d'intégration${NC}"
    echo -e "${BLUE}===============================${NC}"
    
    if [ -f "$INTEGRATION_TESTS" ]; then
        echo -e "${YELLOW}🔍 Démarrage des tests d'intégration...${NC}"
        if bash "$INTEGRATION_TESTS"; then
            echo -e "${GREEN}✅ Tests d'intégration terminés avec succès${NC}"
        else
            echo -e "${RED}❌ Tests d'intégration échoués${NC}"
            echo -e "${YELLOW}💡 Utilisez --skip-integration-tests pour ignorer cette phase${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  Script de tests d'intégration non trouvé: $INTEGRATION_TESTS${NC}"
        echo -e "${YELLOW}⚠️  Cette phase sera ignorée${NC}"
        echo -e "${YELLOW}💡 Créez le script de tests d'intégration pour activer cette phase${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Phase 3: Tests d'intégration ignorés (--skip-integration-tests)${NC}"
fi

# Phase 4: Build et publication
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${BLUE}🏗️  Phase 4: Build et publication${NC}"
    echo -e "${BLUE}=================================${NC}"
    
    if [ -f "$BUILD_SCRIPT" ]; then
        echo -e "${YELLOW}🔨 Démarrage du build et de la publication...${NC}"
        
        # Construire les arguments pour le script de build
        BUILD_ARGS=""
        if [ "$SKIP_TRANSLATOR" = true ]; then
            BUILD_ARGS="$BUILD_ARGS --skip-translator"
        fi
        if [ "$SKIP_GATEWAY" = true ]; then
            BUILD_ARGS="$BUILD_ARGS --skip-gateway"
        fi
        if [ "$SKIP_FRONTEND" = true ]; then
            BUILD_ARGS="$BUILD_ARGS --skip-frontend"
        fi
        if [ "$SKIP_UNIFIED" = true ]; then
            BUILD_ARGS="$BUILD_ARGS --skip-unified"
        fi
        if [ "$BUILD_UNIFIED_ONLY" = true ]; then
            BUILD_ARGS="$BUILD_ARGS --unified-only"
        fi
        
        if bash "$BUILD_SCRIPT" $BUILD_ARGS; then
            echo -e "${GREEN}✅ Build et publication terminés avec succès${NC}"
        else
            echo -e "${RED}❌ Build et publication échoués${NC}"
            echo -e "${YELLOW}💡 Utilisez --skip-build pour ignorer cette phase${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  Script de build non trouvé: $BUILD_SCRIPT${NC}"
        echo -e "${YELLOW}⚠️  Cette phase sera ignorée${NC}"
        echo -e "${YELLOW}💡 Créez le script de build pour activer cette phase${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Phase 4: Build et publication ignorés (--skip-build)${NC}"
fi

# Résumé final
echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}🎉 Pipeline terminé avec succès !${NC}"
echo -e "${BLUE}📋 Version finale: $CURRENT_VERSION${NC}"

# Afficher les phases exécutées
echo -e "${BLUE}📊 Phases exécutées:${NC}"
echo -e "  ✅ Phase 1: Gestion des versions"
if [ "$SKIP_UNIT_TESTS" = false ] && [ -f "$UNIT_TESTS" ]; then
    echo -e "  ✅ Phase 2: Tests unitaires"
elif [ "$SKIP_UNIT_TESTS" = true ]; then
    echo -e "  ⏭️  Phase 2: Tests unitaires (ignorée)"
else
    echo -e "  ⚠️  Phase 2: Tests unitaires (script manquant)"
fi

if [ "$SKIP_INTEGRATION_TESTS" = false ] && [ -f "$INTEGRATION_TESTS" ]; then
    echo -e "  ✅ Phase 3: Tests d'intégration"
elif [ "$SKIP_INTEGRATION_TESTS" = true ]; then
    echo -e "  ⏭️  Phase 3: Tests d'intégration (ignorée)"
else
    echo -e "  ⚠️  Phase 3: Tests d'intégration (script manquant)"
fi

if [ "$SKIP_BUILD" = false ] && ([ -f "$BUILD_SCRIPT" ] || [ -f "build-and-push-0.5.1-alpha.sh" ]); then
    echo -e "  ✅ Phase 4: Build et publication"
elif [ "$SKIP_BUILD" = true ]; then
    echo -e "  ⏭️  Phase 4: Build et publication (ignorée)"
else
    echo -e "  ⚠️  Phase 4: Build et publication (script manquant)"
fi

# Afficher les images publiées
if [ "$SKIP_BUILD" = false ] && ([ -f "$BUILD_SCRIPT" ] || [ -f "build-and-push-0.5.1-alpha.sh" ]); then
    echo -e "${BLUE}🐳 Images Docker publiées:${NC}"
    echo -e "  • isopen/meeshy-translator:$CURRENT_VERSION"
    echo -e "  • isopen/meeshy-gateway:$CURRENT_VERSION"
    echo -e "  • isopen/meeshy-frontend:$CURRENT_VERSION"
    echo -e "  • isopen/meeshy:$CURRENT_VERSION"
fi

if [ -d "test-results" ]; then
    echo -e "${BLUE}📊 Résultats disponibles dans: test-results/${NC}"
fi

echo -e "${GREEN}✅ Pipeline complet terminé !${NC}"
