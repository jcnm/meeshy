#!/bin/bash

# Script de test pour le container unifié Meeshy
set -e

echo "🔧 Test du container unifié Meeshy"
echo "=================================="

# Nettoyer les containers existants
echo "🧹 Nettoyage des containers existants..."
docker stop meeshy-unified-test 2>/dev/null || true
docker rm meeshy-unified-test 2>/dev/null || true

# Construire l'image
echo "🔨 Construction de l'image unifiée..."
docker build -f Dockerfile.unified -t meeshy-unified:test .

# Démarrer le container
echo "🚀 Démarrage du container de test..."
docker run -d \
    --name meeshy-unified-test \
    -p 80:80 \
    -p 3000:3000 \
    -p 8000:8000 \
    -p 5432:5432 \
    -p 6379:6379 \
    -e USE_EXTERNAL_DB=false \
    -e USE_EXTERNAL_REDIS=false \
    meeshy-unified:test

# Attendre que le container démarre
echo "⏳ Attente du démarrage des services..."
sleep 30

# Vérifier les logs
echo "📋 Logs du container:"
docker logs meeshy-unified-test

# Vérifier l'état des services
echo "🔍 État des services dans le container:"
docker exec meeshy-unified-test supervisorctl status

# Test de connectivité
echo "🌐 Test de connectivité:"
echo "  - Frontend: http://localhost"
echo "  - Gateway: http://localhost/api"
echo "  - Translator: http://localhost/translate"

# Attendre l'entrée utilisateur
echo ""
echo "✅ Container démarré avec succès!"
echo "Appuyez sur Entrée pour arrêter le container..."
read

# Nettoyer
echo "🧹 Nettoyage..."
docker stop meeshy-unified-test
docker rm meeshy-unified-test
echo "✅ Test terminé"
