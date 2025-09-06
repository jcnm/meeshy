#!/bin/bash

# Script pour corriger et redéployer la configuration WebSocket avec Traefik

set -e

echo "🔧 Correction de la configuration WebSocket Meeshy avec Traefik..."

# 1. Vérifier que les variables d'environnement sont correctes
echo "🔍 Vérification des variables d'environnement..."
if [ ! -f ".env" ]; then
    echo "❌ Fichier .env non trouvé. Copiez env.digitalocean vers .env"
    exit 1
fi

# 2. Arrêter les services qui dépendent de Gateway
echo "🛑 Arrêt des services..."
docker-compose -f docker-compose.traefik.yml down frontend gateway

# 3. Reconstruire les images avec les corrections
echo "🔨 Reconstruction de l'image Gateway..."
docker-compose -f docker-compose.traefik.yml build gateway

echo "🔨 Reconstruction de l'image Frontend..."
docker-compose -f docker-compose.traefik.yml build frontend

# 4. Redémarrer les services
echo "🚀 Redémarrage du Gateway..."
docker-compose -f docker-compose.traefik.yml up -d gateway

# Attendre que le gateway soit prêt
echo "⏳ Attente du démarrage du Gateway..."
sleep 15

# Vérifier le health check du gateway
echo "🏥 Vérification du health check Gateway..."
docker-compose -f docker-compose.traefik.yml ps gateway

echo "🚀 Redémarrage du Frontend..."
docker-compose -f docker-compose.traefik.yml up -d frontend

# 5. Vérification finale
echo "📊 Vérification des services..."
docker-compose -f docker-compose.traefik.yml ps

echo "🔗 Test de connectivité..."
# Test simple de connectivité
DOMAIN=${DOMAIN:-localhost}
echo "Testing https://gate.${DOMAIN}/health"
curl -f https://gate.${DOMAIN}/health || echo "❌ Gateway non accessible"
echo "Testing https://${DOMAIN}/"
curl -f https://${DOMAIN}/ || echo "❌ Frontend non accessible"

echo ""
echo "✅ Correction WebSocket avec Traefik terminée!"
echo ""
echo "📝 Changements appliqués:"
echo "  • Correction NEXT_PUBLIC_WS_URL: wss://gate.${DOMAIN} (sans /ws)"
echo "  • Support authToken explicite dans Socket.IO"
echo "  • Types de tokens précis (jwt/anonymous)"
echo "  • Validation des types de session"
echo "  • Path Socket.IO: /socket.io/"
echo ""
echo "🔍 Pour vérifier les logs:"
echo "  docker-compose -f docker-compose.traefik.yml logs -f gateway"
echo "  docker-compose -f docker-compose.traefik.yml logs -f frontend"
echo ""
echo "🌐 URLs d'accès:"
echo "  • Frontend: https://${DOMAIN}"
echo "  • API Gateway: https://gate.${DOMAIN}"
echo "  • ML Service: https://ml.${DOMAIN}"
echo "  • Traefik Dashboard: https://traefik.${DOMAIN}"
