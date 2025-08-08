#!/bin/bash

echo "🚀 Démarrage de Meeshy en mode développement"
echo "============================================"

# Fonction pour gérer l'arrêt propre
cleanup() {
    echo ""
    echo "🛑 Arrêt des services..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Capturer Ctrl+C
trap cleanup SIGINT

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non trouvé"
    exit 1
fi

# Vérifier pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm non trouvé - installation avec npm install -g pnpm"
    exit 1
fi

echo "✅ Node.js et pnpm trouvés"

# Aller dans le répertoire du projet
cd "$(dirname "$0")/.."

# Variables d'environnement pour le développement
export NODE_ENV=development
export POSTGRES_DB=meeshy_dev
export POSTGRES_USER=meeshy
export POSTGRES_PASSWORD=dev_password
export DATABASE_URL="file:./dev.db"  # SQLite pour le développement
export REDIS_URL="redis://localhost:6379"
export FRONTEND_PORT=3100
export GATEWAY_PORT=3000
export NEXT_PUBLIC_WS_URL="ws://localhost:3000"
export NEXT_PUBLIC_API_URL="http://localhost:3000"

echo ""
echo "📦 Installation des dépendances..."

# Installer les dépendances
echo "🔧 Frontend..."
cd frontend && pnpm install --silent

echo "🔧 Gateway..."
cd ../gateway && pnpm install --silent

echo "🔧 Shared..."
cd ../shared && pnpm install --silent

cd ..

echo ""
echo "🏗️ Construction des composants partagés..."
cd shared && pnpm run generate && pnpm run build
cd ..

echo ""
echo "🚀 Démarrage des services..."

# Démarrer le gateway en arrière-plan
echo "🌐 Démarrage du gateway (port 3000)..."
cd gateway
pnpm run dev > ../logs/gateway.log 2>&1 &
GATEWAY_PID=$!
cd ..

# Attendre que le gateway démarre
sleep 3

# Démarrer le frontend en arrière-plan
echo "🖥️ Démarrage du frontend (port 3100)..."
cd frontend
pnpm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Créer le répertoire de logs s'il n'existe pas
mkdir -p logs

echo ""
echo "✅ Services démarrés !"
echo "   🌐 Gateway: http://localhost:3000"
echo "   🖥️ Frontend: http://localhost:3100"
echo "   📋 Logs: ./logs/"
echo ""
echo "🔍 Monitoring des services (Ctrl+C pour arrêter)..."
echo "   Gateway PID: $GATEWAY_PID"
echo "   Frontend PID: $FRONTEND_PID"

# Monitorer les processus
while true; do
    if ! kill -0 $GATEWAY_PID 2>/dev/null; then
        echo "❌ Gateway arrêté inopinément"
        break
    fi
    
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ Frontend arrêté inopinément"
        break
    fi
    
    sleep 5
done

cleanup
