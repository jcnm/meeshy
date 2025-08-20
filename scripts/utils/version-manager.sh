#!/bin/bash

# Version Manager for Meeshy
# Automatically manages version increments and updates across all files

set -e

# Configuration
VERSION_FILE=".version"
DEFAULT_VERSION="0.5.1-alpha"
REGISTRY="isopen"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour obtenir la version actuelle
get_current_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat "$VERSION_FILE"
    else
        echo "$DEFAULT_VERSION"
    fi
}

# Fonction pour incrémenter la version
increment_version() {
    local current_version=$(get_current_version)
    local version_type=${1:-patch}
    
    # Extraire les composants de la version
    local major=$(echo "$current_version" | cut -d. -f1)
    local minor=$(echo "$current_version" | cut -d. -f2)
    local patch=$(echo "$current_version" | cut -d. -f3 | cut -d- -f1)
    local suffix=$(echo "$current_version" | cut -d- -f2-)
    
    case $version_type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            echo -e "${RED}❌ Type de version invalide: $version_type${NC}"
            echo "Types valides: major, minor, patch"
            exit 1
            ;;
    esac
    
    local new_version="${major}.${minor}.${patch}-${suffix}"
    echo "$new_version"
}

# Fonction pour sauvegarder la nouvelle version
save_version() {
    local version=$1
    echo "$version" > "$VERSION_FILE"
    echo -e "${GREEN}✅ Version sauvegardée: $version${NC}"
}

# Fonction pour mettre à jour les versions dans les fichiers
update_version_in_files() {
    local version=$1
    local old_version=$(get_current_version)
    
    echo -e "${BLUE}🔄 Mise à jour des versions dans les fichiers...${NC}"
    
    # Mettre à jour package.json des services
    if [ -f "frontend/package.json" ]; then
        sed -i.bak "s/\"version\": \".*\"/\"version\": \"$version\"/" frontend/package.json
        rm -f frontend/package.json.bak
        echo -e "${GREEN}✅ frontend/package.json mis à jour${NC}"
    fi
    
    if [ -f "gateway/package.json" ]; then
        sed -i.bak "s/\"version\": \".*\"/\"version\": \"$version\"/" gateway/package.json
        rm -f gateway/package.json.bak
        echo -e "${GREEN}✅ gateway/package.json mis à jour${NC}"
    fi
    
    # Mettre à jour les images Docker dans docker-compose.yml
    if [ -f "docker-compose.yml" ]; then
        sed -i.bak "s/isopen\/meeshy-translator:.*/isopen\/meeshy-translator:$version/" docker-compose.yml
        sed -i.bak "s/isopen\/meeshy-gateway:.*/isopen\/meeshy-gateway:$version/" docker-compose.yml
        sed -i.bak "s/isopen\/meeshy-frontend:.*/isopen\/meeshy-frontend:$version/" docker-compose.yml
        rm -f docker-compose.yml.bak
        echo -e "${GREEN}✅ docker-compose.yml mis à jour${NC}"
    fi
    
    # Mettre à jour l'image unifiée dans docker-compose.unified.yml
    if [ -f "docker-compose.unified.yml" ]; then
        sed -i.bak "s/isopen\/meeshy:.*/isopen\/meeshy:$version/" docker-compose.unified.yml
        rm -f docker-compose.unified.yml.bak
        echo -e "${GREEN}✅ docker-compose.unified.yml mis à jour${NC}"
    fi
    
    # Mettre à jour le README.md
    if [ -f "README.md" ]; then
        sed -i.bak "s/isopen\/meeshy-translator:.*/isopen\/meeshy-translator:$version/" README.md
        sed -i.bak "s/isopen\/meeshy-gateway:.*/isopen\/meeshy-gateway:$version/" README.md
        sed -i.bak "s/isopen\/meeshy-frontend:.*/isopen\/meeshy-frontend:$version/" README.md
        sed -i.bak "s/isopen\/meeshy:.*/isopen\/meeshy:$version/" README.md
        rm -f README.md.bak
        echo -e "${GREEN}✅ README.md mis à jour${NC}"
    fi
    
    echo -e "${GREEN}✅ Toutes les versions ont été mises à jour de $old_version vers $version${NC}"
}

# Fonction pour afficher l'aide
show_help() {
    echo -e "${BLUE}Version Manager for Meeshy${NC}"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  current                    Afficher la version actuelle"
    echo "  increment [TYPE]           Incrémenter la version (major|minor|patch)"
    echo "  update [VERSION]           Définir une version spécifique"
    echo "  save [VERSION]             Sauvegarder une version"
    echo "  apply [VERSION]            Appliquer une version à tous les fichiers"
    echo "  auto-increment [TYPE]      Incrémenter et appliquer automatiquement"
    echo ""
    echo "Examples:"
    echo "  $0 current"
    echo "  $0 increment patch"
    echo "  $0 update 0.6.0-alpha"
    echo "  $0 auto-increment minor"
    echo ""
}

# Fonction principale
main() {
    case "${1:-help}" in
        current)
            get_current_version
            ;;
        increment)
            local version_type=${2:-patch}
            local new_version=$(increment_version "$version_type")
            echo -e "${GREEN}Nouvelle version: $new_version${NC}"
            ;;
        update)
            local version=$2
            if [ -z "$version" ]; then
                echo -e "${RED}❌ Version requise${NC}"
                exit 1
            fi
            save_version "$version"
            update_version_in_files "$version"
            ;;
        save)
            local version=$2
            if [ -z "$version" ]; then
                echo -e "${RED}❌ Version requise${NC}"
                exit 1
            fi
            save_version "$version"
            ;;
        apply)
            local version=$2
            if [ -z "$version" ]; then
                version=$(get_current_version)
            fi
            update_version_in_files "$version"
            ;;
        auto-increment)
            local version_type=${2:-patch}
            local new_version=$(increment_version "$version_type")
            save_version "$new_version"
            update_version_in_files "$new_version"
            echo -e "${GREEN}✅ Version incrémentée et appliquée: $new_version${NC}"
            ;;
        help|*)
            show_help
            ;;
    esac
}

# Exécuter la fonction principale
main "$@"
