#!/bin/bash

# Script de build pour le service Gateway
# Copie shared dans le dossier gateway puis build l'image Docker

set -e

echo "🚀 Building Gateway Docker Image..."

# Aller dans le répertoire racine
cd "$(dirname "$0")"

# Nettoyer le dossier shared existant dans gateway s'il existe
if [ -d "gateway/shared" ]; then
    echo "🧹 Cleaning existing shared directory in gateway..."
    rm -rf gateway/shared
fi

# Copier shared dans gateway
echo "📂 Copying shared directory to gateway..."
cp -r shared gateway/

# Aller dans le dossier gateway
cd gateway

# Builder l'image Docker
echo "🐳 Building Docker image..."
docker build -t meeshy-gateway:latest .

# Nettoyer le dossier shared copié
echo "🧹 Cleaning up copied shared directory..."
rm -rf shared

echo "✅ Gateway Docker image built successfully!"
echo "🏃 You can now run: docker run -p 3000:3000 meeshy-gateway:latest"
