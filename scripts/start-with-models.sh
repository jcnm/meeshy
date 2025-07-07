#!/bin/bash

# Script de démarrage automatique de Meeshy avec téléchargement des modèles
# Télécharge les modèles si nécessaire, puis démarre l'application

set -e

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODELS_DIR="$PROJECT_ROOT/public/models"

echo "🚀 === DÉMARRAGE AUTOMATIQUE DE MEESHY ==="
echo ""

# Fonction pour vérifier si Node.js est installé
check_node() {
    if ! command -v node >/dev/null 2>&1; then
        echo "❌ Node.js requis mais non installé"
        echo "💡 Installez Node.js depuis: https://nodejs.org/"
        exit 1
    fi
    
    echo "✅ Node.js $(node --version) détecté"
}

# Fonction pour vérifier si les dépendances sont installées
check_dependencies() {
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        echo "📦 Installation des dépendances..."
        cd "$PROJECT_ROOT"
        npm install
        echo "✅ Dépendances installées"
    else
        echo "✅ Dépendances déjà installées"
    fi
}

# Fonction pour vérifier et télécharger les modèles
check_and_download_models() {
    echo "🧠 Vérification des modèles..."
    
    # Vérifier si des modèles essentiels existent
    local models_exist=false
    
    if [ -f "$MODELS_DIR/mt5-small/model.json" ] || [ -f "$MODELS_DIR/nllb-200-distilled-600M/model.json" ]; then
        models_exist=true
        echo "✅ Modèles détectés"
    fi
    
    if [ "$models_exist" = false ]; then
        echo "📥 Aucun modèle détecté, téléchargement automatique..."
        
        # Vérifier si le script de téléchargement existe
        if [ -f "$SCRIPT_DIR/download-models.sh" ]; then
            echo "🔄 Lancement du téléchargement des modèles..."
            
            # Exécuter le script de téléchargement
            if bash "$SCRIPT_DIR/download-models.sh"; then
                echo "✅ Modèles téléchargés avec succès"
            else
                echo "⚠️ Erreur lors du téléchargement des modèles"
                echo "💡 L'application fonctionnera avec des modèles de démonstration"
            fi
        else
            echo "⚠️ Script de téléchargement non trouvé"
            echo "💡 Téléchargement manuel requis ou utilisation de modèles de démonstration"
        fi
    fi
}

# Fonction pour démarrer l'application
start_application() {
    echo "🚀 Démarrage de l'application Meeshy..."
    cd "$PROJECT_ROOT"
    
    # Démarrer en mode développement par défaut
    if [ "${NODE_ENV:-development}" = "production" ]; then
        echo "🏭 Mode production"
        npm run build
        npm start
    else
        echo "🔧 Mode développement"
        npm run dev
    fi
}

# Fonction pour afficher les informations d'accès
show_access_info() {
    echo ""
    echo "🌐 === ACCÈS À L'APPLICATION ==="
    echo ""
    echo "   🏠 Interface utilisateur: http://localhost:3000"
    echo "   ⚙️  Paramètres:          http://localhost:3000/settings"
    echo "   🧪 Tests:               http://localhost:3000/test"
    echo "   💬 Conversations:       http://localhost:3000/conversations"
    echo ""
    echo "🛠️ OUTILS DE DÉVELOPPEMENT:"
    echo "   📊 Ouvrez F12 dans le navigateur"
    echo "   🔍 Tapez 'meeshyDebug.help()' dans la console"
    echo "   🧠 Vérifiez les modèles avec 'meeshyDebug.diagnoseModels()'"
    echo ""
}

# Fonction principale
main() {
    echo "📁 Répertoire de travail: $PROJECT_ROOT"
    echo ""
    
    # Vérifications préliminaires
    check_node
    check_dependencies
    
    # Gestion des modèles
    check_and_download_models
    
    # Affichage des informations
    show_access_info
    
    # Pause pour laisser le temps de lire
    echo "⏱️  Démarrage dans 3 secondes... (Ctrl+C pour annuler)"
    sleep 3
    
    # Démarrage
    start_application
}

# Gestion des signaux pour arrêt propre
trap 'echo ""; echo "👋 Arrêt de Meeshy..."; exit 0' INT TERM

# Exécution
main "$@"
