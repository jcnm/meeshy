#!/bin/bash

echo "🔍 Diagnostic des services Meeshy"
echo "=================================="

# Vérifier si Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution"
    exit 1
fi

echo "✅ Docker est actif"

# Vérifier les conteneurs
echo ""
echo "📦 État des conteneurs:"
docker ps --filter "name=meeshy" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Vérifier les ports
echo ""
echo "🔌 Ports écoutés:"
netstat -an | grep -E "(3000|3100|8000)" | head -10

# Tester la connectivité au gateway
echo ""
echo "🌐 Test de connectivité au gateway:"
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Gateway HTTP accessible sur :3000"
else
    echo "❌ Gateway HTTP non accessible sur :3000"
fi

# Test WebSocket (nécessite wscat)
echo ""
echo "🔗 Test WebSocket (si wscat est installé):"
if command -v wscat &> /dev/null; then
    timeout 3 wscat -c ws://localhost:3000 --close || echo "❌ WebSocket non accessible"
else
    echo "⚠️ wscat non installé - impossible de tester WebSocket"
    echo "   Installation: npm install -g wscat"
fi

echo ""
echo "📋 Variables d'environnement frontend:"
echo "NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL:-'non définie'}"
echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-'non définie'}"

echo ""
echo "🏁 Diagnostic terminé"
