#!/bin/bash

# 🔧 Configuration de l'environnement de PRODUCTION (DigitalOcean)
# Ce script configure les variables d'environnement pour la production
set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔧 Configuration de l'environnement de PRODUCTION (DigitalOcean)${NC}"

# Vérifier si le fichier env.digitalocean existe
if [ ! -f "env.digitalocean" ]; then
    echo -e "${RED}❌ Fichier env.digitalocean non trouvé !${NC}"
    echo -e "${YELLOW}💡 Créez d'abord le fichier env.digitalocean avec la configuration DigitalOcean${NC}"
    exit 1
fi

# Copier la configuration DigitalOcean vers .env.production
echo -e "${YELLOW}📝 Copie de la configuration DigitalOcean...${NC}"
cp env.digitalocean .env.production

echo -e "${GREEN}✅ Fichier .env.production créé à partir de env.digitalocean${NC}"

# Valider la configuration
echo -e "${BLUE}🔍 Validation de la configuration production...${NC}"

# Charger les variables
set -a
source .env.production
set +a

# Variables requises pour la production
REQUIRED_VARS=(
    "NODE_ENV"
    "DATABASE_URL"
    "REDIS_URL"
    "DOMAIN_NAME"
    "CERTBOT_EMAIL"
    "TRANSLATOR_IMAGE"
    "GATEWAY_IMAGE" 
    "FRONTEND_IMAGE"
)

# Variables optionnelles mais recommandées
OPTIONAL_VARS=(
    "JWT_SECRET"
    "CORS_ORIGIN"
    "LOG_LEVEL"
    "DATABASE_POOL_SIZE"
    "ML_BATCH_SIZE"
    "TRANSLATION_CACHE_TTL"
)

echo -e "${BLUE}📋 Vérification des variables requises:${NC}"
missing_vars=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
        echo -e "  ${RED}❌ $var: MANQUANTE${NC}"
    else
        # Masquer les mots de passe dans l'affichage
        if [[ "$var" == *"PASSWORD"* ]] || [[ "$var" == *"SECRET"* ]] || [[ "$var" == *"DATABASE_URL"* ]]; then
            echo -e "  ${GREEN}✅ $var: ***${NC}"
        else
            echo -e "  ${GREEN}✅ $var: ${!var}${NC}"
        fi
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ Variables manquantes dans .env.production:${NC}"
    for var in "${missing_vars[@]}"; do
        echo -e "  ${RED}- $var${NC}"
    done
    echo -e "${YELLOW}💡 Configurez ces variables dans le fichier env.digitalocean${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Vérification des variables optionnelles:${NC}"
for var in "${OPTIONAL_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "  ${YELLOW}⚠️  $var: Non définie (valeur par défaut sera utilisée)${NC}"
    else
        if [[ "$var" == *"SECRET"* ]]; then
            echo -e "  ${GREEN}✅ $var: ***${NC}"
        else
            echo -e "  ${GREEN}✅ $var: ${!var}${NC}"
        fi
    fi
done

# Vérifications spécifiques
echo -e "${BLUE}🔍 Vérifications spécifiques:${NC}"

# Vérifier le format du domaine
if [[ ! "$DOMAIN_NAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$ ]]; then
    echo -e "${YELLOW}⚠️  Format du domaine suspect: $DOMAIN_NAME${NC}"
else
    echo -e "${GREEN}✅ Format du domaine valide: $DOMAIN_NAME${NC}"
fi

# Vérifier le format de l'email
if [[ ! "$CERTBOT_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    echo -e "${YELLOW}⚠️  Format de l'email suspect: $CERTBOT_EMAIL${NC}"
else
    echo -e "${GREEN}✅ Format de l'email valide: $CERTBOT_EMAIL${NC}"
fi

# Vérifier que NODE_ENV est en production
if [ "$NODE_ENV" != "production" ]; then
    echo -e "${RED}❌ NODE_ENV doit être 'production', actuellement: $NODE_ENV${NC}"
    exit 1
else
    echo -e "${GREEN}✅ NODE_ENV configuré pour la production${NC}"
fi

# Vérifier les URLs des images Docker
echo -e "${BLUE}🐳 Vérification des images Docker:${NC}"
images=("$TRANSLATOR_IMAGE" "$GATEWAY_IMAGE" "$FRONTEND_IMAGE")
image_names=("Translator" "Gateway" "Frontend")

for i in "${!images[@]}"; do
    image="${images[$i]}"
    name="${image_names[$i]}"
    
    if [[ "$image" == *":latest"* ]]; then
        echo -e "${GREEN}✅ $name: $image${NC}"
    elif [[ "$image" == *":local"* ]]; then
        echo -e "${YELLOW}⚠️  $name: $image (image locale pour la production !)${NC}"
    else
        echo -e "${GREEN}✅ $name: $image${NC}"
    fi
done

# Créer un fichier de validation
VALIDATION_FILE=".production-validation"
cat > "$VALIDATION_FILE" << EOF
# Validation de la configuration de production
# Généré le: $(date)

CONFIGURATION_VALIDATED=true
VALIDATION_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DOMAIN_NAME=$DOMAIN_NAME
CERTBOT_EMAIL=$CERTBOT_EMAIL
NODE_ENV=$NODE_ENV

# Checksums des images
TRANSLATOR_IMAGE_CHECKSUM=$(echo "$TRANSLATOR_IMAGE" | md5sum | cut -d' ' -f1)
GATEWAY_IMAGE_CHECKSUM=$(echo "$GATEWAY_IMAGE" | md5sum | cut -d' ' -f1)
FRONTEND_IMAGE_CHECKSUM=$(echo "$FRONTEND_IMAGE" | md5sum | cut -d' ' -f1)
EOF

echo ""
echo -e "${GREEN}✅ Configuration de production validée !${NC}"
echo ""
echo -e "${CYAN}📋 Résumé de la configuration:${NC}"
echo -e "  ${GREEN}Environment:${NC} $NODE_ENV"
echo -e "  ${GREEN}Domain:${NC} $DOMAIN_NAME"
echo -e "  ${GREEN}SSL Email:${NC} $CERTBOT_EMAIL"
echo -e "  ${GREEN}Database:${NC} ${DATABASE_URL/\/\/.*@/\/\/***@}"
echo -e "  ${GREEN}Validation:${NC} $VALIDATION_FILE"
echo ""
echo -e "${CYAN}🚀 Étapes suivantes:${NC}"
echo -e "  ${YELLOW}1. Vérifiez la configuration dans .env.production${NC}"
echo -e "  ${YELLOW}2. Assurez-vous que le DNS pointe vers ce serveur${NC}"
echo -e "  ${YELLOW}3. Démarrez la production avec: ./scripts/production/start-production.sh${NC}"
echo ""
echo -e "${PURPLE}🎯 Configuration de PRODUCTION prête !${NC}"
