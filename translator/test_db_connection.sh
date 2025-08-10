#!/bin/bash

# Script de test rapide pour la connectivité à la base de données
# Usage: ./test_db_connection.sh

set -e

echo "🧪 Test de connectivité à la base de données Translator"
echo "================================================="

# Vérifier si on est dans le bon répertoire
if [ ! -f "main.py" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire translator/"
    exit 1
fi

# Vérifier si les dépendances sont installées
echo "📦 Vérification des dépendances Python..."
if ! python -c "import prisma" 2>/dev/null; then
    echo "⚠️  Prisma non installé, installation en cours..."
    pip install -r requirements.txt
else
    echo "✅ Dépendances OK"
fi

# Test de connectivité simple
echo ""
echo "🔌 Test de connectivité à la base de données..."
python test_database_connection.py

# Test de diagnostic complet si le test simple réussit
if [ $? -eq 0 ]; then
    echo ""
    echo "🚀 Lancement du diagnostic complet..."
    python diagnostic_startup.py
else
    echo "❌ Test de connectivité échoué, diagnostic annulé"
    exit 1
fi

echo ""
echo "✅ Tests terminés avec succès !"
echo "🎯 Le service Translator est prêt à démarrer avec: python main.py"
