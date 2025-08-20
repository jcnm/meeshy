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
    
    echo -e "${BLUE}🔨 Construction de ${image_name}${NC}"
    echo -e "${YELLOW}   Dockerfile: ${dockerfile}${NC}"
    echo -e "${YELLOW}   Context: ${context}${NC}"
    
    # Construire et publier avec buildx
    docker buildx build \
        --platform $PLATFORMS \
        --file $dockerfile \
        --tag $image_name \
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
    
    echo -e "${BLUE}🔨 Construction de ${image_name}${NC}"
    echo -e "${YELLOW}   Dockerfile: Dockerfile.unified${NC}"
    echo -e "${YELLOW}   Context: .${NC}"
    
    # Construire et publier avec buildx
    docker buildx build \
        --platform $PLATFORMS \
        --file Dockerfile.unified \
        --tag $image_name \
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
echo -e "${BLUE}📦 Construction des services individuels...${NC}"

# 1. Translator
if [ -f "translator/Dockerfile" ]; then
    build_and_push "translator" "translator/Dockerfile" "translator"
else
    echo -e "${YELLOW}⚠️  Dockerfile translator non trouvé${NC}"
fi

# 2. Gateway
if [ -f "gateway/Dockerfile" ]; then
    build_and_push "gateway" "gateway/Dockerfile" "gateway"
else
    echo -e "${YELLOW}⚠️  Dockerfile gateway non trouvé${NC}"
fi

# 3. Frontend
if [ -f "frontend/Dockerfile" ]; then
    build_and_push "frontend" "frontend/Dockerfile" "frontend"
else
    echo -e "${YELLOW}⚠️  Dockerfile frontend non trouvé${NC}"
fi

# 4. Image unifiée
echo -e "${BLUE}📦 Construction de l'image unifiée...${NC}"
if [ -f "Dockerfile.unified" ]; then
    build_and_push_unified
else
    echo -e "${YELLOW}⚠️  Dockerfile.unified non trouvé${NC}"
fi

# Afficher le résumé
echo -e "${GREEN}🎉 Toutes les images ont été publiées avec succès !${NC}"
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}📋 Images publiées :${NC}"
echo -e "  • ${REGISTRY}/meeshy-translator:${VERSION}"
echo -e "  • ${REGISTRY}/meeshy-gateway:${VERSION}"
echo -e "  • ${REGISTRY}/meeshy-frontend:${VERSION}"
echo -e "  • ${REGISTRY}/meeshy:${VERSION}"
echo -e "${BLUE}================================================${NC}"
echo -e "${YELLOW}🔍 Plateformes supportées : ${PLATFORMS}${NC}"
echo -e "${YELLOW}📅 Version : ${VERSION}${NC}"
echo -e "${GREEN}✅ Publication terminée !${NC}"
