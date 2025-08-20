#!/bin/bash

# Script de build et test pour Container Unifié Meeshy
set -e

VERSION="0.5.0-alpha"
REGISTRY="isopen"

echo "🚀 Build et Test Container Unifié Meeshy v${VERSION}..."

# 1. Nettoyer les conteneurs existants
echo "🧹 Nettoyage des conteneurs existants..."
docker-compose -f docker-compose.unified.yml down --remove-orphans 2>/dev/null || true
docker rm -f meeshy-unified 2>/dev/null || true

# 2. Build du container unifié
echo "🔨 Build du container unifié..."
docker build -f Dockerfile.unified -t ${REGISTRY}/meeshy-unified:${VERSION} .

# 3. Démarrer le container unifié
echo "🚀 Démarrage du container unifié..."
docker-compose -f docker-compose.unified.yml up -d

# 4. Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 30

# 5. Vérifier l'état des services
echo "🔍 Vérification de l'état des services..."
docker-compose -f docker-compose.unified.yml logs --tail=20

# 6. Tests de connectivité
echo "🧪 Tests de connectivité..."

# Test Frontend (port 80)
echo "  - Test Frontend (port 80)..."
if curl -f http://localhost/health >/dev/null 2>&1; then
    echo "    ✅ Frontend accessible"
else
    echo "    ❌ Frontend non accessible"
    exit 1
fi

# Test Gateway API (port 3000)
echo "  - Test Gateway API (port 3000)..."
if curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "    ✅ Gateway API accessible"
else
    echo "    ❌ Gateway API non accessible"
    exit 1
fi

# Test Translator API (port 8000)
echo "  - Test Translator API (port 8000)..."
if curl -f http://localhost:8000/health >/dev/null 2>&1; then
    echo "    ✅ Translator API accessible"
else
    echo "    ❌ Translator API non accessible"
    exit 1
fi

# 7. Test de traduction
echo "🧪 Test de traduction..."

# Test via Frontend (port 80)
echo "  - Test de traduction via Frontend..."
TRANSLATION_RESPONSE=$(curl -s -X POST http://localhost/translate \
    -H "Content-Type: application/json" \
    -d '{
        "text": "Hello world",
        "source_language": "en",
        "target_language": "fr",
        "model_type": "basic"
    }' 2>/dev/null || echo "ERROR")

if echo "$TRANSLATION_RESPONSE" | grep -q "Bonjour" || echo "$TRANSLATION_RESPONSE" | grep -q "translated_text"; then
    echo "    ✅ Traduction via Frontend réussie"
else
    echo "    ❌ Traduction via Frontend échouée"
    echo "    Réponse: $TRANSLATION_RESPONSE"
fi

# Test via Translator API direct (port 8000)
echo "  - Test de traduction via Translator API direct..."
TRANSLATION_RESPONSE_DIRECT=$(curl -s -X POST http://localhost:8000/translate \
    -H "Content-Type: application/json" \
    -d '{
        "text": "Hello world",
        "source_language": "en",
        "target_language": "fr",
        "model_type": "basic"
    }' 2>/dev/null || echo "ERROR")

if echo "$TRANSLATION_RESPONSE_DIRECT" | grep -q "Bonjour" || echo "$TRANSLATION_RESPONSE_DIRECT" | grep -q "translated_text"; then
    echo "    ✅ Traduction via Translator API direct réussie"
else
    echo "    ❌ Traduction via Translator API direct échouée"
    echo "    Réponse: $TRANSLATION_RESPONSE_DIRECT"
fi

# 8. Vérifier les logs
echo "📋 Logs des services..."
docker-compose -f docker-compose.unified.yml logs --tail=10

echo ""
echo "✅ Tests terminés avec succès!"
echo ""
echo "🌐 Accès aux services:"
echo "  - Frontend: http://localhost"
echo "  - Gateway API: http://localhost:3000"
echo "  - Translator API: http://localhost:8000"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "📋 Commandes utiles:"
echo "  - Logs: docker-compose -f docker-compose.unified.yml logs -f"
echo "  - Arrêt: docker-compose -f docker-compose.unified.yml down"
echo "  - Redémarrage: docker-compose -f docker-compose.unified.yml restart"
