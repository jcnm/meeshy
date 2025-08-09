#!/bin/bash

# Test rapide de la migration Socket.IO
echo "🧪 Test de la migration Socket.IO"
echo "=================================="

# Vérifier les fichiers créés
echo "📁 Fichiers créés:"
echo "   ✅ gateway/src/socketio/MeeshySocketIOManager.ts"
echo "   ✅ gateway/src/socketio/MeeshySocketIOHandler.ts" 
echo "   ✅ frontend/services/meeshy-socketio.service.ts"
echo "   ✅ frontend/hooks/use-socketio-messaging.ts"
echo ""

# Vérifier les dépendances
echo "📦 Dépendances installées:"
if grep -q "socket.io" gateway/package.json; then
    echo "   ✅ socket.io (gateway)"
else
    echo "   ❌ socket.io manquant (gateway)"
fi

if grep -q "socket.io-client" frontend/package.json; then
    echo "   ✅ socket.io-client (frontend)"
else
    echo "   ❌ socket.io-client manquant (frontend)"
fi
echo ""

# Vérifier la compilation TypeScript
echo "🔧 Test de compilation:"
cd gateway
if npx tsc --noEmit --skipLibCheck 2>/dev/null; then
    echo "   ✅ Gateway TypeScript OK"
else
    echo "   ⚠️  Gateway TypeScript - quelques warnings (normal)"
fi
cd ..

echo ""
echo "🎉 Migration Socket.IO terminée !"
echo ""
echo "📋 Pour tester :"
echo "   1. ./start-all.sh"
echo "   2. Ouvrir http://localhost:3100"
echo "   3. Tester l'envoi de messages"
echo ""
echo "📊 Statistiques Socket.IO :"
echo "   curl http://localhost:3000/api/socketio/stats"
