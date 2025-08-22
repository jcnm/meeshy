#!/bin/bash

# Build and Push Docker Images for Meeshy
# Generic script for building and publishing Docker images

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
VERSION_MANAGER="$SCRIPT_DIR/../utils/version-manager.sh"
REGISTRY="isopen"
PLATFORMS="linux/amd64,linux/arm64"

# Variables par défaut
SKIP_TRANSLATOR=false
SKIP_GATEWAY=false
SKIP_FRONTEND=false
SKIP_UNIFIED=false
BUILD_UNIFIED_ONLY=false

# Fonction pour afficher l'aide
show_help() {
    echo -e "${BLUE}Build and Push Docker Images for Meeshy${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-translator        Skip translator build"
    echo "  --skip-gateway           Skip gateway build"
    echo "  --skip-frontend          Skip frontend build"
    echo "  --skip-unified           Skip unified image build"
    echo "  --unified-only           Build only the unified image"
    echo "  --help                   Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                        # Build all images"
    echo "  $0 --skip-frontend        # Skip frontend build"
    echo "  $0 --unified-only         # Build only unified image"
    echo "  $0 --skip-translator --skip-gateway --skip-frontend  # Unified only"
    echo ""
}

# Parser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
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

# Obtenir la version actuelle
if [ -f "$VERSION_MANAGER" ]; then
    VERSION=$(bash "$VERSION_MANAGER" current)
else
    VERSION="0.5.1-alpha"
fi

echo -e "${BLUE}🚀 Build et publication des images Docker Meeshy v${VERSION}${NC}"
echo -e "${BLUE}================================================${NC}"

# Vérifier que buildx est disponible
if ! docker buildx version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker Buildx n'est pas disponible${NC}"
    exit 1
fi

# Créer un nouveau builder si nécessaire
BUILDER_NAME="meeshy-builder"
if ! docker buildx inspect $BUILDER_NAME > /dev/null 2>&1; then
    echo -e "${YELLOW}🔧 Création du builder buildx: $BUILDER_NAME${NC}"
    docker buildx create --name $BUILDER_NAME --use
else
    echo -e "${YELLOW}🔧 Utilisation du builder existant: $BUILDER_NAME${NC}"
    docker buildx use $BUILDER_NAME
fi

# Fonction pour construire et publier une image
build_and_push() {
    local service=$1
    local dockerfile=$2
    local context=$3
    local image_name="${REGISTRY}/meeshy-${service}:${VERSION}"
     local image_name_latest="${REGISTRY}/meeshy-${service}:latest"
    
    echo -e "${BLUE}🔨 Construction de ${image_name}${NC}"
    echo -e "${YELLOW}   Dockerfile: ${dockerfile}${NC}"
    echo -e "${YELLOW}   Context: ${context}${NC}"
    
    # Construire et publier avec buildx
    docker buildx build \
        --platform $PLATFORMS \
        --file $dockerfile  --progress=plain  \
        --tag $image_name \
        --tag $image_name_latest \
        --push \
        $context

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${image_name} publié avec succès${NC}"
    else
        echo -e "${RED}❌ Échec de la publication de ${image_name}${NC}"
        exit 1
    fi
    
    echo ""
}

# Fonction pour construire et publier l'image unifiée
build_and_push_unified() {
    local image_name="${REGISTRY}/meeshy:${VERSION}"
    local image_name_latest="${REGISTRY}/meeshy:latest"
    echo -e "${BLUE}🔨 Construction de ${image_name}${NC}"
    echo -e "${YELLOW}   Dockerfile: Dockerfile.unified${NC}"
    echo -e "${YELLOW}   Context: .${NC}"
    
    # Construire et publier avec buildx
    docker buildx build \
        --platform $PLATFORMS \
        --file Dockerfile.unified \
        --tag $image_name \
        --tag $image_name_latest \
        --push \
        .
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${image_name} publié avec succès${NC}"
    else
        echo -e "${RED}❌ Échec de la publication de ${image_name}${NC}"
        exit 1
    fi
    
    echo ""
}

# Vérifier que nous sommes dans le bon répertoire
cd "$PROJECT_ROOT"

# Construire et publier chaque service
if [ "$BUILD_UNIFIED_ONLY" = true ]; then
    echo -e "${BLUE}📦 Construction de l'image unifiée uniquement...${NC}"
else
    echo -e "${BLUE}📦 Construction des services individuels...${NC}"
fi

# 1. Translator
if [ "$SKIP_TRANSLATOR" = false ]; then
    if [ -f "translator/Dockerfile" ]; then
        build_and_push "translator" "translator/Dockerfile" "translator"
    else
        echo -e "${YELLOW}⚠️  Dockerfile translator non trouvé${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Construction du translator ignorée (--skip-translator)${NC}"
fi

# 2. Gateway
if [ "$SKIP_GATEWAY" = false ]; then
    if [ -f "gateway/Dockerfile" ]; then
        build_and_push "gateway" "gateway/Dockerfile" "gateway"
    else
        echo -e "${YELLOW}⚠️  Dockerfile gateway non trouvé${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Construction du gateway ignorée (--skip-gateway)${NC}"
fi

# 3. Frontend
if [ "$SKIP_FRONTEND" = false ]; then
    if [ -f "frontend/Dockerfile" ]; then
        build_and_push "frontend" "frontend/Dockerfile" "frontend"
    else
        echo -e "${YELLOW}⚠️  Dockerfile frontend non trouvé${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Construction du frontend ignorée (--skip-frontend)${NC}"
fi

# 4. Image unifiée
if [ "$SKIP_UNIFIED" = false ]; then
    echo -e "${BLUE}📦 Construction de l'image unifiée...${NC}"
    if [ -f "Dockerfile.unified" ]; then
        build_and_push_unified
    else
        echo -e "${YELLOW}⚠️  Dockerfile.unified non trouvé${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Construction de l'image unifiée ignorée (--skip-unified)${NC}"
fi

# Afficher le résumé
echo -e "${GREEN}🎉 Build et publication terminés avec succès !${NC}"
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}📋 Images publiées :${NC}"

if [ "$SKIP_TRANSLATOR" = false ]; then
    echo -e "  • ${REGISTRY}/meeshy-translator:${VERSION}"
fi

if [ "$SKIP_GATEWAY" = false ]; then
    echo -e "  • ${REGISTRY}/meeshy-gateway:${VERSION}"
fi

if [ "$SKIP_FRONTEND" = false ]; then
    echo -e "  • ${REGISTRY}/meeshy-frontend:${VERSION}"
fi

if [ "$SKIP_UNIFIED" = false ]; then
    echo -e "  • ${REGISTRY}/meeshy:${VERSION}"
fi

echo -e "${BLUE}================================================${NC}"
echo -e "${YELLOW}🔍 Plateformes supportées : ${PLATFORMS}${NC}"
echo -e "${YELLOW}📅 Version : ${VERSION}${NC}"

if [ "$BUILD_UNIFIED_ONLY" = true ]; then
    echo -e "${YELLOW}🎯 Mode : Image unifiée uniquement${NC}"
fi

echo -e "${GREEN}✅ Publication terminée !${NC}"
