#!/bin/bash

# Script de démarrage complet pour Meeshy
# Lance le frontend et le backend en parallèle

echo "🚀 Démarrage de Meeshy..."
echo "📦 Backend : http://localhost:3000"
echo "🌐 Frontend : http://localhost:3100"

# Fonction pour nettoyer les processus en arrière-plan
cleanup() {
  echo "🛑 Arrêt des services..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}

# Capturer Ctrl+C pour nettoyer proprement
trap cleanup SIGINT

# Vérifier que les dépendances sont installées
if [ ! -d "node_modules" ]; then
  echo "📦 Installation des dépendances frontend..."
  npm install
fi

if [ ! -d "backend/node_modules" ]; then
  echo "📦 Installation des dépendances backend..."
  cd backend && npm install && cd ..
fi

# Démarrer le backend
echo "🔧 Démarrage du backend NestJS..."
cd backend && npm run start:dev &
BACKEND_PID=$! 

# Attendre que le backend démarre
sleep 3

# Démarrer le frontend
echo "🎨 Démarrage du frontend Next.js..."
npm run dev &
FRONTEND_PID=$!

# Attendre que les services démarrent
sleep 5

echo "✅ Services démarrés !"
echo "📱 Frontend: http://localhost:3000 (ou port alternatif)"
echo "🔧 Backend: http://localhost:3000"
echo ""
echo "💡 Modèles de traduction disponibles :"
echo "   - mT5: Messages simples (≤100 caractères)"
echo "   - NLLB: Messages complexes (>100 caractères)"
echo ""
echo "🎯 Fonctionnalités clés :"
echo "   ✓ Traduction automatique côté client"
echo "   ✓ Cache persistant avec IndexedDB"
echo "   ✓ Modèles adaptatifs selon les capacités système"
echo "   ✓ Fallback API en cas d'échec des modèles"
echo "   ✓ Interface responsive et moderne"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter tous les services"

# Attendre indéfiniment
wait
