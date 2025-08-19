#!/bin/bash

# Script de build et push pour Meeshy v0.4.8-alpha
# Intégration du QuantizedMLService avec performances améliorées

set -e

VERSION="0.4.8-alpha"
REGISTRY="isopen"

echo "🚀 BUILD ET PUSH MEESHY v${VERSION}"
echo "=================================="
echo "📅 Date: $(date)"
echo "🎯 Version: ${VERSION}"
echo "🏗️  Architecture: Multi-plateforme (AMD64 + ARM64)"
echo ""

# Couleurs pour les logs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier que docker buildx est disponible
if ! docker buildx version > /dev/null 2>&1; then
    log_error "docker buildx n'est pas disponible"
    exit 1
fi

# Créer un nouveau builder si nécessaire
log_info "🔧 Configuration de docker buildx..."
docker buildx create --name meeshy-builder --use --driver docker-container 2>/dev/null || true

# 1. Build et push du service Translator (avec QuantizedMLService)
log_info "🔧 Build du service Translator (QuantizedMLService)..."
cd translator

docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY}/meeshy-translator:${VERSION} \
    --tag ${REGISTRY}/meeshy-translator:latest \
    --push \
    --build-arg QUANTIZATION_LEVEL=float32 \
    --build-arg TRANSLATION_WORKERS=10 \
    .

log_success "Translator buildé et poussé: ${REGISTRY}/meeshy-translator:${VERSION}"

cd ..

# 2. Build et push du service Gateway
log_info "🔧 Build du service Gateway..."
cd gateway

docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY}/meeshy-gateway:${VERSION} \
    --tag ${REGISTRY}/meeshy-gateway:latest \
    --push \
    .

log_success "Gateway buildé et poussé: ${REGISTRY}/meeshy-gateway:${VERSION}"

cd ..

# 3. Build et push du service Frontend
log_info "🔧 Build du service Frontend..."
cd frontend

docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY}/meeshy-frontend:${VERSION} \
    --tag ${REGISTRY}/meeshy-frontend:latest \
    --push \
    .

log_success "Frontend buildé et poussé: ${REGISTRY}/meeshy-frontend:${VERSION}"

cd ..

# 4. Vérification des images
log_info "🔍 Vérification des images poussées..."

echo ""
echo "📋 Images disponibles sur Docker Hub:"
echo "====================================="

docker buildx imagetools inspect ${REGISTRY}/meeshy-translator:${VERSION} | grep -E "(OS/Arch|Digest)" || log_warning "Translator non trouvé"
docker buildx imagetools inspect ${REGISTRY}/meeshy-gateway:${VERSION} | grep -E "(OS/Arch|Digest)" || log_warning "Gateway non trouvé"
docker buildx imagetools inspect ${REGISTRY}/meeshy-frontend:${VERSION} | grep -E "(OS/Arch|Digest)" || log_warning "Frontend non trouvé"

echo ""
log_success "🎉 Build et push terminés avec succès !"
echo ""
echo "📊 RÉSUMÉ:"
echo "=========="
echo "✅ Translator: ${REGISTRY}/meeshy-translator:${VERSION} (QuantizedMLService)"
echo "✅ Gateway: ${REGISTRY}/meeshy-gateway:${VERSION}"
echo "✅ Frontend: ${REGISTRY}/meeshy-frontend:${VERSION}"
echo ""
echo "🚀 Améliorations v${VERSION}:"
echo "   • QuantizedMLService intégré (tous les modèles)"
echo "   • Support float32 pour stabilité et performance"
echo "   • Architecture multi-plateforme (AMD64 + ARM64)"
echo "   • Optimisations mémoire et CPU"
echo ""
echo "📝 Prochaines étapes:"
echo "   • git add . && git commit -m 'feat: intégration QuantizedMLService v${VERSION}'"
echo "   • git tag v${VERSION}"
echo "   • git push origin main --tags"
