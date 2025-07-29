#!/bin/bash
"""
Script de démarrage du service de traduction Meeshy
"""

echo "🚀 SERVICE DE TRADUCTION MEESHY"
echo "==============================="

# Vérifier si Python est disponible
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 n'est pas installé"
    exit 1
fi

# Vérifier les dépendances
echo "🔍 Vérification des dépendances..."
python3 -c "import grpc, torch, transformers" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️ Installation des dépendances requises..."
    pip3 install -r requirements.txt
fi

# Démarrer le serveur
echo "🌍 Démarrage du serveur de traduction..."
echo "💡 Arrêt avec Ctrl+C"
echo "📋 Test avec: python test_interactive.py"
echo "==============================="
echo ""

python3 src/translation_service.py

# Fonction d'aide
show_help() {
    echo "Usage: $0 [start|test|help]"
    echo ""
    echo "Commandes:"
    echo "  start  - Démarrer le serveur de traduction"
    echo "  test   - Lancer le test interactif"
    echo "  help   - Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0 start    # Démarre le serveur"
    echo "  $0 test     # Teste les traductions"
}

# Traitement des arguments
case "$1" in
    start)
        start_server
        ;;
    test)
        test_server
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "⚠️ Commande inconnue: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
