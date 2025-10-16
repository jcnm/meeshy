#!/bin/bash
# Script rapide pour build et push multi-plateforme du Gateway
# Usage: ./build-push.sh

set -e

cd "$(dirname "$0")/.."

echo "🚀 Build et push Gateway (multi-plateforme)..."
echo ""

./gateway/build-docker-monorepo.sh \
    isopen/meeshy-gateway:latest \
    linux/arm64,linux/amd64 \
    push

echo ""
echo "✅ Done!"
