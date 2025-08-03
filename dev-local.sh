#!/bin/bash

# Meeshy - Script de développement local
# Exécute tous les services en mode développement sur la machine locale

set -e

echo "🚀 Démarrage de Meeshy en mode développement local..."

# Vérification des prérequis
check_prerequisites() {
    echo "🔍 Vérification des prérequis..."
    
    # Node.js et pnpm
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js n'est pas installé. Veuillez installer Node.js 18+ depuis nodejs.org"
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        echo "❌ pnpm n'est pas installé. Installation avec corepack..."
        corepack enable
        corepack prepare pnpm@latest --activate
    fi
    
    # Python pour le translator
    if ! command -v python3 &> /dev/null; then
        echo "❌ Python 3 n'est pas installé. Veuillez installer Python 3.9+"
        exit 1
    fi
    
    # PostgreSQL
    if ! command -v pg_isready &> /dev/null; then
        echo "⚠️  PostgreSQL n'est pas détecté. Assurez-vous qu'une instance PostgreSQL est disponible."
        echo "   Vous pouvez utiliser Docker: docker run -d -p 5432:5432 -e POSTGRES_DB=meeshy -e POSTGRES_USER=meeshy -e POSTGRES_PASSWORD=MeeshyP@ssword postgres:15-alpine"
    fi
    
    # Redis
    if ! command -v redis-cli &> /dev/null; then
        echo "⚠️  Redis n'est pas détecté. Assurez-vous qu'une instance Redis est disponible."
        echo "   Vous pouvez utiliser Docker: docker run -d -p 6379:6379 redis:7-alpine"
    fi
    
    echo "✅ Prérequis vérifiés"
}

# Installation des dépendances
install_dependencies() {
    echo "📦 Installation des dépendances..."
    
    # Frontend
    echo "   Frontend (Next.js)..."
    cd frontend && pnpm install && cd ..
    
    # Shared/Prisma
    echo "   Base de données (Prisma)..."
    cd shared && pnpm install && cd ..
    
    # Translator (Python)
    echo "   Translator (Python)..."
    cd translator && pip install -r requirements.txt && cd ..
    
    echo "✅ Dépendances installées"
}

# Configuration de la base de données
setup_database() {
    echo "🗄️  Configuration de la base de données..."
    cd shared
    
    # Génération du client Prisma
    pnpm prisma generate
    
    # Migration de la base de données
    if pnpm prisma migrate deploy; then
        echo "✅ Base de données configurée"
    else
        echo "⚠️  Erreur lors de la migration. Continuons..."
    fi
    
    cd ..
}

# Démarrage des services
start_services() {
    echo "🎯 Démarrage des services..."
    
    # Variables d'environnement par défaut
    export DATABASE_URL="postgresql://meeshy:MeeshyP@ssword@localhost:5432/meeshy"
    export REDIS_URL="redis://localhost:6379"
    export NEXT_PUBLIC_API_URL="http://localhost:3000"
    export NEXT_PUBLIC_WS_URL="ws://localhost:3000"
    
    # Démarrage du translator (FastAPI)
    echo "   🐍 Translator (FastAPI) sur le port 8000..."
    cd translator
    python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
    TRANSLATOR_PID=$!
    cd ..
    
    # Attendre que le translator soit prêt
    sleep 5
    
    # Démarrage du gateway (Fastify) - si disponible
    if [ -d "gateway" ]; then
        echo "   ⚡ Gateway (Fastify) sur le port 3000..."
        cd gateway
        pnpm install
        pnpm run dev &
        GATEWAY_PID=$!
        cd ..
        sleep 3
    fi
    
    # Démarrage du frontend (Next.js)
    echo "   🎨 Frontend (Next.js) sur le port 3100..."
    cd frontend
    pnpm run dev &
    FRONTEND_PID=$!
    cd ..
    
    echo "✅ Services démarrés!"
    echo ""
    echo "🌐 Accès aux services:"
    echo "   • Frontend: http://localhost:3100"
    echo "   • API Gateway: http://localhost:3000 (si disponible)"
    echo "   • Translator API: http://localhost:8000"
    echo "   • Translator gRPC: localhost:50051"
    echo ""
    echo "📝 Logs en temps réel - Appuyez sur Ctrl+C pour arrêter tous les services"
    
    # Fonction de nettoyage
    cleanup() {
        echo ""
        echo "🛑 Arrêt des services..."
        [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
        [ -n "$GATEWAY_PID" ] && kill $GATEWAY_PID 2>/dev/null || true
        [ -n "$TRANSLATOR_PID" ] && kill $TRANSLATOR_PID 2>/dev/null || true
        echo "✅ Services arrêtés"
        exit 0
    }
    
    trap cleanup SIGINT SIGTERM
    
    # Attendre indéfiniment
    wait
}

# Exécution principale
main() {
    check_prerequisites
    install_dependencies
    setup_database
    start_services
}

# Lancement du script
main "$@"
