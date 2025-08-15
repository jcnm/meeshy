#!/bin/bash

# Script de construction des images Docker pour Meeshy
# Ce script construit les trois services principaux avec les variables d'environnement

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction d'affichage
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Vérification des prérequis
check_prerequisites() {
    log "Vérification des prérequis..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker n'est pas installé"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose n'est pas installé"
        exit 1
    fi
    
    if [ ! -f ".env" ]; then
        error "Fichier .env non trouvé"
        exit 1
    fi
    
    log "Prérequis vérifiés ✓"
}

# Chargement des variables d'environnement
load_env() {
    log "Chargement des variables d'environnement..."
    
    # Source .env file
    set -a
    source .env
    set +a
    
    log "Variables d'environnement chargées ✓"
}

# Construction des images
build_images() {
    log "Construction des images Docker..."
    
    # Construction de l'image shared (dépendance commune)
    log "Génération du client Prisma pour shared..."
    cd shared && pnpm install && pnpm run generate && ./scripts/distribute.sh && cd ..

    cd translator
    # Construction des images principales
    log "Construction de l'image Translator..."
    docker build \
        --build-arg DATABASE_URL="${DATABASE_URL}" \
        --build-arg REDIS_URL="${REDIS_URL}" \
        --build-arg GRPC_HOST="${GRPC_HOST:-0.0.0.0}" \
        --build-arg GRPC_PORT="${GRPC_PORT:-50051}" \
        --build-arg HTTP_PORT="${HTTP_PORT:-8000}" \
        --build-arg FASTAPI_PORT="${FASTAPI_PORT:-8000}" \
        --build-arg ZMQ_PUSH_PORT="${ZMQ_PUSH_PORT:-5555}" \
        --build-arg ZMQ_SUB_PORT="${ZMQ_SUB_PORT:-5558}" \
        --build-arg LOG_LEVEL="${LOG_LEVEL:-info}" \
        --build-arg DEBUG="${DEBUG:-false}" \
        --build-arg SUPPORTED_LANGUAGES="${SUPPORTED_LANGUAGES:-fr,en,es,de,pt,zh,ja,ar}" \
        --build-arg DEFAULT_LANGUAGE="${DEFAULT_LANGUAGE:-fr}" \
        --build-arg MAX_TEXT_LENGTH="${MAX_TEXT_LENGTH:-5000}" \
        --build-arg BASIC_MODEL="${BASIC_MODEL:-t5-small}" \
        --build-arg MEDIUM_MODEL="${MEDIUM_MODEL:-nllb-200-distilled-600M}" \
        --build-arg PREMIUM_MODEL="${PREMIUM_MODEL:-nllb-200-distilled-1.3B}" \
        --build-arg DEVICE="${DEVICE:-cpu}" \
        --build-arg ML_BATCH_SIZE="${ML_BATCH_SIZE:-32}" \
        --build-arg GPU_MEMORY_FRACTION="${GPU_MEMORY_FRACTION:-0.8}" \
        --build-arg TRANSLATION_TIMEOUT="${TRANSLATION_TIMEOUT:-30}" \
        --build-arg CONCURRENT_TRANSLATIONS="${CONCURRENT_TRANSLATIONS:-10}" \
        --build-arg WORKERS="${WORKERS:-4}" \
        --build-arg TRANSLATION_WORKERS="${TRANSLATION_WORKERS:-10}" \
        --build-arg PRISMA_POOL_SIZE="${PRISMA_POOL_SIZE:-15}" \
        --build-arg CACHE_MAX_ENTRIES="${CACHE_MAX_ENTRIES:-10000}" \
        --build-arg AUTO_DETECT_LANGUAGE="${AUTO_DETECT_LANGUAGE:-true}" \
        --build-arg AUTO_CLEANUP_CORRUPTED_MODELS="${AUTO_CLEANUP_CORRUPTED_MODELS:-true}" \
        --build-arg FORCE_MODEL_REDOWNLOAD="${FORCE_MODEL_REDOWNLOAD:-false}" \
        --build-arg TRANSLATION_CACHE_TTL="${TRANSLATION_CACHE_TTL:-3600}" \
        --build-arg NORMAL_POOL_SIZE="${NORMAL_POOL_SIZE:-10000}" \
        --build-arg ANY_POOL_SIZE="${ANY_POOL_SIZE:-10000}" \
        --build-arg NORMAL_WORKERS="${NORMAL_WORKERS:-3}" \
        --build-arg ANY_WORKERS="${ANY_WORKERS:-2}" \
        -f translator/Dockerfile \
        -t meeshy-translator:latest \
        .

    cd ../gateway
    log "Construction de l'image Gateway..."
    docker build \
        --build-arg DATABASE_URL="${DATABASE_URL}" \
        --build-arg REDIS_URL="${REDIS_URL}" \
        --build-arg JWT_SECRET="${JWT_SECRET}" \
        --build-arg JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-24h}" \
        --build-arg FASTIFY_PORT="${GATEWAY_PORT:-3000}" \
        --build-arg FASTIFY_HOST="${FASTIFY_HOST:-0.0.0.0}" \
        --build-arg GATEWAY_PORT="${GATEWAY_PORT:-3000}" \
        --build-arg LOG_LEVEL="${LOG_LEVEL:-info}" \
        --build-arg DEBUG="${DEBUG:-false}" \
        --build-arg WS_MAX_CONNECTIONS="${WS_MAX_CONNECTIONS:-100000}" \
        --build-arg WS_PING_INTERVAL="${WS_PING_INTERVAL:-30000}" \
        --build-arg RATE_LIMIT_MAX="${RATE_LIMIT_MAX:-1000}" \
        --build-arg RATE_LIMIT_WINDOW="${RATE_LIMIT_WINDOW:-60000}" \
        --build-arg CORS_ORIGINS="${CORS_ORIGINS}" \
        --build-arg ALLOWED_ORIGINS="${ALLOWED_ORIGINS}" \
        --build-arg FRONTEND_URL="${FRONTEND_URL:-http://localhost:3100}" \
        --build-arg BCRYPT_ROUNDS="${BCRYPT_ROUNDS:-12}" \
        --build-arg GRPC_TRANSLATION_HOST="translator" \
        --build-arg GRPC_TRANSLATION_PORT="50051" \
        --build-arg TRANSLATOR_GRPC_URL="translator:50051" \
        --build-arg ZMQ_TRANSLATOR_HOST="translator" \
        --build-arg ZMQ_TRANSLATOR_PUSH_PORT="${ZMQ_TRANSLATOR_PUSH_PORT:-5555}" \
        --build-arg ZMQ_TRANSLATOR_SUB_PORT="${ZMQ_TRANSLATOR_SUB_PORT:-5558}" \
        --build-arg ZMQ_TRANSLATOR_PORT="${ZMQ_TRANSLATOR_PORT:-5555}" \
        --build-arg ZMQ_TIMEOUT="${ZMQ_TIMEOUT:-30000}" \
        -f gateway/Dockerfile \
        -t meeshy-gateway:latest \
        .
    
    cd ../frontend
    log "Construction de l'image Frontend..."
    docker build \
        --build-arg NODE_ENV="production" \
        --build-arg PORT="${FRONTEND_PORT:-3100}" \
        --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL}" \
        --build-arg NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_WS_URL}" \
        --build-arg NEXT_PUBLIC_BACKEND_URL="${NEXT_PUBLIC_BACKEND_URL}" \
        --build-arg NEXT_TELEMETRY_DISABLED="1" \
        --build-arg NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION="true" \
        --build-arg NEXT_PUBLIC_USE_API_TRANSLATION_ONLY="true" \
        --build-arg DATABASE_URL="${DATABASE_URL}" \
        -f frontend/Dockerfile \
        -t meeshy-frontend:latest \
        .
    
    log "Images construites avec succès ✓"
}

# Affichage des images construites
show_images() {
    log "Images Docker construites:"
    docker images | grep "meeshy-"
}

# Fonction principale
main() {
    log "=== Construction des images Docker pour Meeshy ==="
    
    check_prerequisites
    load_env
    build_images
    show_images
    
    log "=== Construction terminée avec succès ==="
    log "Utilisez 'docker-compose up' pour démarrer les services"
}

# Exécution du script
main "$@"
