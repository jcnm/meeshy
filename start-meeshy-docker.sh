#!/bin/bash

# Script de démarrage pour Meeshy Docker avec options
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Variables par défaut
USE_EXTERNAL_DB=false
START_POSTGRES=true
START_REDIS=true
ENV_FILE="env.docker"
PORTS="-p 3100:3100 -p 3000:3000 -p 8000:8000"

# Fonction d'aide
show_help() {
    echo -e "${BLUE}🚀 Script de démarrage Meeshy Docker${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help              Afficher cette aide"
    echo "  -e, --external-db       Utiliser une base de données externe"
    echo "  --no-postgres           Ne pas démarrer PostgreSQL interne"
    echo "  --no-redis              Ne pas démarrer Redis interne"
    echo "  --env-file FILE         Fichier d'environnement (défaut: env.docker)"
    echo "  --ports PORTS           Ports à exposer (défaut: 3100:3100 -p 3000:3000 -p 8000:8000)"
    echo ""
    echo "Exemples:"
    echo "  $0                                    # Démarrage avec PostgreSQL et Redis internes"
    echo "  $0 --external-db                      # Utiliser une base externe"
    echo "  $0 --no-postgres --no-redis           # Services applicatifs seulement"
    echo "  $0 --env-file env.docker.external     # Utiliser un fichier d'environnement spécifique"
}

# Parsing des arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -e|--external-db)
            USE_EXTERNAL_DB=true
            START_POSTGRES=false
            START_REDIS=false
            shift
            ;;
        --no-postgres)
            START_POSTGRES=false
            shift
            ;;
        --no-redis)
            START_REDIS=false
            shift
            ;;
        --env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        --ports)
            PORTS="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}❌ Option inconnue: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Vérifier que le fichier d'environnement existe
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Fichier d'environnement '$ENV_FILE' non trouvé${NC}"
    exit 1
fi

# Afficher la configuration
echo -e "${BLUE}🔧 Configuration:${NC}"
echo "  Fichier d'environnement: $ENV_FILE"
echo "  Base de données externe: $USE_EXTERNAL_DB"
echo "  Démarrer PostgreSQL: $START_POSTGRES"
echo "  Démarrer Redis: $START_REDIS"
echo "  Ports: $PORTS"
echo ""

# Construire la commande Docker
DOCKER_CMD="docker run --rm -it $PORTS"

# Ajouter les variables d'environnement
DOCKER_CMD="$DOCKER_CMD -e USE_EXTERNAL_DB=$USE_EXTERNAL_DB"
DOCKER_CMD="$DOCKER_CMD -e START_POSTGRES=$START_POSTGRES"
DOCKER_CMD="$DOCKER_CMD -e START_REDIS=$START_REDIS"

# Ajouter le fichier d'environnement
DOCKER_CMD="$DOCKER_CMD --env-file $ENV_FILE"

# Ajouter l'image
DOCKER_CMD="$DOCKER_CMD meeshy:latest"

echo -e "${GREEN}🚀 Démarrage de Meeshy...${NC}"
echo "Commande: $DOCKER_CMD"
echo ""

# Exécuter la commande
eval $DOCKER_CMD
