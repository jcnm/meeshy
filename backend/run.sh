#!/bin/bash

# Script d'exécution CORRIGÉ pour macOS
# Gère les différents modes de traduction

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

cleanup() {
    print_status "Arrêt du serveur..."
    jobs -p | xargs -r kill 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

print_status "🚀 Démarrage du serveur de chat - Version macOS corrigée"
echo "=================================================================="

# Vérifications préliminaires
if [ ! -d "venv" ]; then
    print_error "Environnement virtuel manquant. Exécutez: ./install.sh"
    exit 1
fi

if [ ! -f "main.py" ]; then
    print_error "Fichier main.py manquant. Réexécutez l'installation."
    exit 1
fi

# Activation de l'environnement
print_status "Activation de l'environnement virtuel..."
source venv/bin/activate
print_success "Environnement activé ✓"

# Chargement de la configuration
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
    print_success "Configuration chargée ✓"
fi

# Vérification du port
PORT=${PORT:-8000}
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Port $PORT déjà utilisé"
    print_status "Processus utilisant le port:"
    lsof -Pi :$PORT -sTCP:LISTEN 2>/dev/null || true
    
    # Proposer un port alternatif
    NEW_PORT=$((PORT + 1))
    print_status "Tentative sur le port $NEW_PORT..."
    PORT=$NEW_PORT
fi

# Détection du service de traduction disponible
print_status "Détection des services de traduction..."
TRANSLATION_STATUS=$(python3 -c "
try:
    import transformers, torch
    print('transformers')
except ImportError:
    try:
        import googletrans
        print('googletrans')
    except ImportError:
        print('none')
")

case $TRANSLATION_STATUS in
    "transformers")
        print_success "✅ Transformers disponible (recommandé)"
        ;;
    "googletrans")
        print_warning "⚠️  Google Translate disponible (fallback)"
        print_status "Note: Nécessite une connexion internet"
        ;;
    "none")
        print_warning "❌ Aucun service de traduction"
        print_status "Mode chat basique uniquement"
        ;;
esac

# Vérification de l'espace disque
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}' | sed 's/G//' | cut -d'.' -f1)
if [ "$AVAILABLE_SPACE" -lt 2 ]; then
    print_warning "Espace disque faible: ${AVAILABLE_SPACE}G"
fi

# Vérification de la mémoire (importante pour les modèles)
MEMORY_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
if [ "$MEMORY_GB" -lt 4 ]; then
    print_warning "Mémoire faible: ${MEMORY_GB}GB (4GB+ recommandés)"
    print_status "Utilisation du mode CPU uniquement"
fi

# Création des dossiers nécessaires
mkdir -p logs data

# Affichage des informations
echo ""
print_status "📋 Configuration du serveur:"
echo "  🌐 Host: ${HOST:-0.0.0.0}"
echo "  🔌 Port: $PORT"
echo "  🗄️  Base de données: ${DATABASE_PATH:-chat_app.db}"
echo "  🔧 Mode debug: ${DEBUG:-True}"
echo "  🌍 Traduction: $TRANSLATION_STATUS"
echo "  💾 Mémoire système: ${MEMORY_GB}GB"
echo ""

print_status "🌐 URLs disponibles:"
echo "  📡 API REST: http://localhost:$PORT"
echo "  📚 Documentation: http://localhost:$PORT/docs"
echo "  🔄 WebSocket: ws://localhost:$PORT/ws"
echo "  ❤️  Health: http://localhost:$PORT/health"
echo ""

# Test rapide avant démarrage
print_status "Test des dépendances critiques..."
python3 -c "
import sys
try:
    import fastapi, uvicorn, jwt, sqlite3
    from pydantic import BaseModel
    print('✅ Dépendances de base OK')
except ImportError as e:
    print(f'❌ Dépendance manquante: {e}')
    sys.exit(1)
"

print_success "Tests préliminaires réussis ✓"

# Variables d'environnement pour l'exécution
export PYTHONPATH="."
export PYTHONUNBUFFERED=1

print_status "⚡ Démarrage du serveur..."
print_warning "Appuyez sur Ctrl+C pour arrêter"
echo "=================================================================="

# Démarrage avec gestion d'erreurs améliorée
if ! python3 main.py --host ${HOST:-0.0.0.0} --port $PORT 2>&1 | tee logs/server.log; then
    print_error "Erreur lors du démarrage du serveur"
    print_status "Vérifiez les logs: tail -f logs/server.log"
    exit 1
fi

print_success "Serveur arrêté proprement"