#!/bin/bash

# Script de validation de configuration pour Meeshy
# Vérifie que tous les prérequis sont en place

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     MEESHY - Validation de Configuration               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Compteurs
ERRORS=0
WARNINGS=0
SUCCESS=0

# Fonction pour les vérifications
check_command() {
    local cmd=$1
    local name=$2
    echo -n "🔍 Vérification de $name... "
    if command -v $cmd &> /dev/null; then
        local version=$($cmd --version 2>&1 | head -n1)
        echo -e "${GREEN}✓ OK${NC} ($version)"
        ((SUCCESS++))
        return 0
    else
        echo -e "${RED}✗ NON TROUVÉ${NC}"
        ((ERRORS++))
        return 1
    fi
}

check_file() {
    local file=$1
    local name=$2
    echo -n "📄 Vérification de $name... "
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ Trouvé${NC}"
        ((SUCCESS++))
        return 0
    else
        echo -e "${YELLOW}⚠ Non trouvé${NC}"
        ((WARNINGS++))
        return 1
    fi
}

check_docker_running() {
    echo -n "🐳 Vérification de Docker... "
    if docker info &> /dev/null; then
        echo -e "${GREEN}✓ Running${NC}"
        ((SUCCESS++))
        return 0
    else
        echo -e "${RED}✗ Docker n'est pas démarré${NC}"
        ((ERRORS++))
        return 1
    fi
}

echo -e "${YELLOW}=== Vérification des Prérequis ===${NC}"
echo ""

# Vérifier Docker
check_docker_running

# Vérifier Docker Compose
check_command docker-compose "Docker Compose"

# Vérifier curl
check_command curl "curl"

# Vérifier wget (optionnel)
if check_command wget "wget (optionnel)"; then
    :
else
    ((WARNINGS--))
fi

echo ""
echo -e "${YELLOW}=== Vérification des Fichiers de Configuration ===${NC}"
echo ""

# Vérifier les fichiers Docker Compose
check_file "docker-compose.dev.yml" "Docker Compose Dev"
check_file "docker-compose.traefik.yml" "Docker Compose Traefik"

# Vérifier les scripts
check_file "start-dev.sh" "Script de démarrage"
check_file "health-check.sh" "Script de santé"
check_file "update-dev.sh" "Script de mise à jour"

# Vérifier le Makefile
check_file "Makefile" "Makefile"

# Vérifier les fichiers d'environnement
check_file ".env.dev" "Fichier environnement dev"

if ! check_file ".env" "Fichier .env principal"; then
    echo -e "   ${BLUE}ℹ️  Conseil: Copiez .env.dev vers .env pour la production${NC}"
fi

echo ""
echo -e "${YELLOW}=== Vérification des Permissions ===${NC}"
echo ""

# Vérifier que les scripts sont exécutables
for script in start-dev.sh health-check.sh update-dev.sh; do
    echo -n "🔒 Vérification des permissions de $script... "
    if [ -x "$script" ]; then
        echo -e "${GREEN}✓ Exécutable${NC}"
        ((SUCCESS++))
    else
        echo -e "${YELLOW}⚠ Non exécutable${NC}"
        echo -e "   ${BLUE}ℹ️  Exécutez: chmod +x $script${NC}"
        ((WARNINGS++))
    fi
done

echo ""
echo -e "${YELLOW}=== Vérification des Images Docker ===${NC}"
echo ""

# Vérifier si les images sont disponibles
declare -a images=("isopen/meeshy-frontend:latest" "isopen/meeshy-gateway:latest" "isopen/meeshy-translator:latest")

for image in "${images[@]}"; do
    echo -n "🐋 Vérification de l'image $image... "
    if docker images | grep -q "${image%%:*}"; then
        echo -e "${GREEN}✓ Disponible localement${NC}"
        ((SUCCESS++))
    else
        echo -e "${YELLOW}⚠ Non trouvée localement${NC}"
        echo -e "   ${BLUE}ℹ️  L'image sera téléchargée au premier démarrage${NC}"
        ((WARNINGS++))
    fi
done

echo ""
echo -e "${YELLOW}=== Vérification de la Documentation ===${NC}"
echo ""

# Vérifier la documentation
check_file "README.md" "README principal"
check_file "QUICKSTART_DEV.md" "Guide Quick Start"
check_file "DEPLOYMENT_LOCAL_DOCKER.md" "Guide déploiement Docker"
check_file "DEPLOYMENT_COMPARISON.md" "Comparaison déploiements"

echo ""
echo -e "${YELLOW}=== Vérification de la Structure des Services ===${NC}"
echo ""

# Vérifier la structure des services
for service in frontend gateway translator shared; do
    echo -n "📁 Vérification du service $service... "
    if [ -d "$service" ]; then
        echo -e "${GREEN}✓ Trouvé${NC}"
        ((SUCCESS++))
    else
        echo -e "${RED}✗ Non trouvé${NC}"
        ((ERRORS++))
    fi
done

echo ""
echo -e "${YELLOW}=== Résumé de Validation ===${NC}"
echo ""

echo -e "Vérifications réussies:  ${GREEN}$SUCCESS${NC}"
echo -e "Avertissements:          ${YELLOW}$WARNINGS${NC}"
echo -e "Erreurs:                 ${RED}$ERRORS${NC}"

echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✨ Validation réussie! Votre environnement est prêt.${NC}"
    echo ""
    echo -e "${BLUE}🚀 Prochaines étapes:${NC}"
    echo ""
    echo "   1. Télécharger les images Docker:"
    echo -e "      ${YELLOW}./start-dev.sh pull${NC}"
    echo ""
    echo "   2. Démarrer tous les services:"
    echo -e "      ${YELLOW}./start-dev.sh${NC}"
    echo ""
    echo "   3. Vérifier la santé des services:"
    echo -e "      ${YELLOW}./health-check.sh${NC}"
    echo ""
    echo "   4. Accéder à l'application:"
    echo -e "      ${YELLOW}http://localhost:3100${NC}"
    echo ""
    
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Il y a $WARNINGS avertissement(s). Veuillez les vérifier ci-dessus.${NC}"
        echo ""
    fi
    
    exit 0
else
    echo -e "${RED}❌ Validation échouée! Il y a $ERRORS erreur(s).${NC}"
    echo ""
    echo -e "${YELLOW}💡 Actions correctives recommandées:${NC}"
    echo ""
    
    if ! docker info &> /dev/null; then
        echo "   - Démarrer Docker Desktop"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "   - Installer Docker Compose"
    fi
    
    if [ ! -f "docker-compose.dev.yml" ]; then
        echo "   - Vérifier que vous êtes dans le bon répertoire"
    fi
    
    echo ""
    exit 1
fi
