#!/bin/bash

# Script pour vérifier la connectivité WebSocket de Meeshy

echo "🔍 Vérification de la connectivité WebSocket Meeshy..."

# Vérifier si les ports sont ouverts
echo "📡 Vérification des ports..."
if lsof -i :3000 >/dev/null 2>&1; then
    echo "✅ Port 3000 (Backend) : OUVERT"
else
    echo "❌ Port 3000 (Backend) : FERMÉ"
fi

if lsof -i :3001 >/dev/null 2>&1; then
    echo "✅ Port 3001 (Frontend) : OUVERT"
else
    echo "❌ Port 3001 (Frontend) : FERMÉ"
fi

# Tester l'endpoint de santé du backend
echo "🏥 Test de l'endpoint de santé du backend..."
if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    echo "✅ Backend API accessible"
else
    echo "❌ Backend API non accessible"
fi

# Tester l'accès au frontend
echo "🌐 Test de l'accès au frontend..."
if curl -s http://localhost:3001 >/dev/null 2>&1; then
    echo "✅ Frontend accessible"
else
    echo "❌ Frontend non accessible"
fi

echo ""
echo "📋 Résumé des problèmes identifiés:"
echo "1. Si le backend n'est pas accessible, lancez: cd backend && npm run start:dev"
echo "2. Si le frontend n'est pas accessible, lancez: npm run dev"
echo "3. Si les ports ne sont pas ouverts, vérifiez les processus en cours"
echo ""
echo "✅ Vérification terminée"
