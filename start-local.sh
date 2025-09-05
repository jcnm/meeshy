#!/bin/bash

# Script de démarrage pour l'environnement local
set -e

echo "🚀 Démarrage de l'environnement Meeshy en local..."

# Variables d'environnement pour le développement local
export DATABASE_TYPE=MONGODB
export DATABASE_URL="mongodb://meeshy:MeeshyPassword123@database:27017/meeshy?authSource=admin"
export PRISMA_SCHEMA_PATH="./shared/schema.prisma"

# URLs pour le frontend
export NEXT_PUBLIC_API_URL="http://meeshy.me/api"
export NEXT_PUBLIC_TRANSLATION_URL="http://meeshy.me/translate"
export NEXT_PUBLIC_WS_URL="ws://meeshy.me/api/ws"

# Images Docker (utiliser les images locales)
export TRANSLATOR_IMAGE="isopen/meeshy-translator:local"
export GATEWAY_IMAGE="isopen/meeshy-gateway:local"
export FRONTEND_IMAGE="isopen/meeshy-frontend:local"

# Environnement
export NODE_ENV="development"

# URLs de base de données corrigées
export REDIS_URL="redis://redis:6379"
export TRANSLATOR_URL="http://translator:8000"
export ZMQ_PUSH_URL="tcp://translator:5555"
export ZMQ_SUB_URL="tcp://translator:5558"

echo "📋 Variables d'environnement configurées:"
echo "  DATABASE_TYPE: $DATABASE_TYPE"
echo "  DATABASE_URL: ${DATABASE_URL/\/\/.*@/\/\/***@}"
echo "  TRANSLATOR_IMAGE: $TRANSLATOR_IMAGE"
echo "  GATEWAY_IMAGE: $GATEWAY_IMAGE"
echo "  FRONTEND_IMAGE: $FRONTEND_IMAGE"

# Vérifier si les images existent localement
echo "🔍 Vérification des images Docker locales..."

if ! docker image inspect "$TRANSLATOR_IMAGE" >/dev/null 2>&1; then
    echo "⚠️  Image $TRANSLATOR_IMAGE non trouvée localement"
    echo "   Construire l'image avec: ./scripts/deployment/build-and-push-docker-images.sh --skip-gateway --skip-frontend --skip-unified"
fi

if ! docker image inspect "$GATEWAY_IMAGE" >/dev/null 2>&1; then
    echo "⚠️  Image $GATEWAY_IMAGE non trouvée localement"
    echo "   Construire l'image avec: ./scripts/deployment/build-and-push-docker-images.sh --skip-translator --skip-frontend --skip-unified"
fi

if ! docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1; then
    echo "⚠️  Image $FRONTEND_IMAGE non trouvée localement"
    echo "   Construire l'image avec: ./scripts/deployment/build-and-push-docker-images.sh --skip-translator --skip-gateway --skip-unified"
fi

echo "🐳 Démarrage des services Docker..."
docker-compose up -d

echo "✅ Services démarrés !"
echo "📊 Statut des services:"
docker-compose ps

echo ""
echo "🌐 URLs d'accès:"
echo "  Frontend: http://localhost:3100"
echo "  Gateway:  http://localhost:3000"
echo "  Translator: http://localhost:8000"
echo "  Database: mongodb://localhost:27017"
echo "  Redis: redis://localhost:6379"
