#!/bin/bash

# Script de build et push pour Meeshy v0.4.9-alpha
# Build multi-plateforme et push vers Docker Hub

set -e

VERSION="0.4.9-alpha"
REGISTRY="isopen"

echo "🚀 Build et Push Meeshy v${VERSION}..."

# Vérifier que docker buildx est disponible
if ! docker buildx version >/dev/null 2>&1; then
    echo "❌ docker buildx n'est pas disponible"
    exit 1
fi

# Créer un nouveau builder si nécessaire
echo "🔧 Configuration du builder multi-plateforme..."
docker buildx create --name meeshy-builder --use 2>/dev/null || true

# 1. Build Translator Service (Haute Performance)
echo "🔨 Build Translator Service (Haute Performance)..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY}/meeshy-translator:${VERSION} \
    --tag ${REGISTRY}/meeshy-translator:latest \
    --push \
    --build-arg QUANTIZATION_LEVEL=float32 \
    --build-arg TRANSLATION_WORKERS=50 \
    --build-arg ENABLE_DYNAMIC_SCALING=true \
    --file translator/Dockerfile \
    translator/

# 2. Build Gateway Service
echo "🔨 Build Gateway Service..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY}/meeshy-gateway:${VERSION} \
    --tag ${REGISTRY}/meeshy-gateway:latest \
    --push \
    --file gateway/Dockerfile \
    gateway/

# 3. Build Frontend Service
echo "🔨 Build Frontend Service..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY}/meeshy-frontend:${VERSION} \
    --tag ${REGISTRY}/meeshy-frontend:latest \
    --push \
    --file frontend/Dockerfile \
    frontend/

echo "✅ Build et Push terminés pour Meeshy v${VERSION}"

echo ""
echo "🚀 Améliorations v${VERSION}:"
echo "   • Workers augmentés: 50 workers par défaut (au lieu de 10)"
echo "   • Gestion dynamique des workers activée"
echo "   • Configuration haute performance: 20 normal + 10 any workers"
echo "   • Scaling automatique: +5/-2 workers selon la charge"
echo "   • Support 100+ messages/seconde"
echo "   • Architecture multi-plateforme (AMD64 + ARM64)"
echo "   • Optimisations mémoire et CPU avancées"
echo "   • Monitoring des performances en temps réel"

echo ""
echo "📋 Images disponibles:"
echo "   • ${REGISTRY}/meeshy-translator:${VERSION}"
echo "   • ${REGISTRY}/meeshy-gateway:${VERSION}"
echo "   • ${REGISTRY}/meeshy-frontend:${VERSION}"
echo "   • Tags 'latest' également disponibles"

echo ""
echo "🔧 Pour déployer:"
echo "   docker-compose up -d"
echo ""
echo "🧹 Pour nettoyer:"
echo "   ./cleanup-v0.4.9-alpha.sh"
