#!/bin/bash

# Script de test simple pour Container Unifié Meeshy
set -e

VERSION="0.5.0-alpha"

echo "🚀 Test Container Unifié Simple Meeshy v${VERSION}..."

# 1. Nettoyer les conteneurs existants
echo "🧹 Nettoyage des conteneurs existants..."
docker-compose -f docker-compose.unified-simple.yml down --remove-orphans 2>/dev/null || true
docker rm -f meeshy-unified-simple 2>/dev/null || true

# 2. Build du container unifié simple
echo "🔨 Build du container unifié simple..."
docker build -f Dockerfile.unified-simple -t isopen/meeshy-unified-simple:${VERSION} .

# 3. Démarrer le container unifié
echo "🚀 Démarrage du container unifié..."
docker-compose -f docker-compose.unified-simple.yml up -d

# 4. Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 30

# 5. Vérifier l'état des services
echo "🔍 Vérification de l'état des services..."
docker-compose -f docker-compose.unified-simple.yml logs --tail=20

# 6. Tests de connectivité
echo "🧪 Tests de connectivité..."

# Test Frontend (port 80)
echo "  - Test Frontend (port 80)..."
if curl -f http://localhost/health >/dev/null 2>&1; then
    echo "    ✅ Frontend accessible"
else
    echo "    ❌ Frontend non accessible"
    echo "    Logs:"
    docker-compose -f docker-compose.unified-simple.yml logs --tail=10
    exit 1
fi

# Test Gateway API (port 3000)
echo "  - Test Gateway API (port 3000)..."
if curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "    ✅ Gateway API accessible"
else
    echo "    ❌ Gateway API non accessible"
fi

# Test Translator API (port 8000)
echo "  - Test Translator API (port 8000)..."
if curl -f http://localhost:8000/health >/dev/null 2>&1; then
    echo "    ✅ Translator API accessible"
else
    echo "    ❌ Translator API non accessible"
fi

echo ""
echo "✅ Tests terminés!"
echo ""
echo "🌐 Accès aux services:"
echo "  - Frontend: http://localhost"
echo "  - Gateway API: http://localhost:3000"
echo "  - Translator API: http://localhost:8000"
echo ""
echo "📋 Commandes utiles:"
echo "  - Logs: docker-compose -f docker-compose.unified-simple.yml logs -f"
echo "  - Arrêt: docker-compose -f docker-compose.unified-simple.yml down"
echo "  - Redémarrage: docker-compose -f docker-compose.unified-simple.yml restart"
