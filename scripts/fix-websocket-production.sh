#!/bin/bash

# Script pour corriger et redéployer la configuration WebSocket en production

set -e

echo "🔧 Correction de la configuration WebSocket Meeshy en production..."

# 1. Arrêter les services qui dépendent de Gateway
echo "🛑 Arrêt des services..."
docker-compose -f docker-compose.prod.yml down frontend gateway

# 2. Reconstruire les images avec les corrections
echo "🔨 Reconstruction de l'image Gateway..."
docker-compose -f docker-compose.prod.yml build gateway

echo "🔨 Reconstruction de l'image Frontend..."
docker-compose -f docker-compose.prod.yml build frontend

# 3. Redémarrer les services
echo "🚀 Redémarrage des services..."
docker-compose -f docker-compose.prod.yml up -d gateway

# Attendre que le gateway soit prêt
echo "⏳ Attente du démarrage du Gateway..."
sleep 10

# Vérifier le health check du gateway
echo "🏥 Vérification du health check Gateway..."
docker-compose -f docker-compose.prod.yml ps gateway

echo "🚀 Redémarrage du Frontend..."
docker-compose -f docker-compose.prod.yml up -d frontend

# 4. Vérification finale
echo "📊 Vérification des services..."
docker-compose -f docker-compose.prod.yml ps

echo "🔗 Test de connectivité WebSocket..."
# Test simple de connectivité
curl -f https://gate.meeshy.me/health || echo "❌ Gateway non accessible"
curl -f https://meeshy.me/ || echo "❌ Frontend non accessible"

echo "✅ Correction WebSocket terminée!"
echo ""
echo "📝 Changements appliqués:"
echo "  • Correction du path Socket.IO: /socket.io/ au lieu de /ws"
echo "  • Simplification de la configuration Traefik"
echo "  • Amélioration de l'authentification Socket.IO"
echo "  • Support des tokens auth et authToken"
echo ""
echo "🔍 Pour vérifier les logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f gateway"
echo "  docker-compose -f docker-compose.prod.yml logs -f frontend"
