#!/bin/bash

# Script pour copier les fichiers générés de shared vers tous les services
# Usage: ./scripts/sync-libs.sh

set -e

echo "🔄 Synchronisation des libs générées vers tous les services..."

# Répertoire racine du projet
PROJECT_ROOT=$(dirname "$0")/..
cd "$PROJECT_ROOT"

# Vérifier que shared/generated existe
if [ ! -d "shared/generated" ]; then
    echo "❌ Le dossier shared/generated n'existe pas. Exécutez d'abord la génération."
    exit 1
fi

# Services à synchroniser
SERVICES=("gateway" "frontend" "translator")

# Synchroniser chaque service
for service in "${SERVICES[@]}"; do
    if [ -d "$service" ]; then
        echo "📦 Synchronisation de $service..."
        
        # Créer le dossier libs/generated s'il n'existe pas
        mkdir -p "$service/libs/generated"
        
        # Copier tous les fichiers générés
        cp -r shared/generated/* "$service/libs/generated/"
        
        echo "✅ $service synchronisé"
    else
        echo "⚠️  Service $service non trouvé, ignoré"
    fi
done

echo "🎉 Synchronisation terminée !"
