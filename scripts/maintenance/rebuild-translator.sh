#!/bin/bash

echo "🔧 Reconstruction de l'image Translator avec corrections Prisma"
echo "=============================================================="

# Arrêter le service translator
echo "🛑 Arrêt du service translator..."
docker-compose stop translator

# Supprimer l'ancienne image
echo "🗑️ Suppression de l'ancienne image translator..."
docker rmi isopen/meeshy-translator:latest 2>/dev/null || echo "Image non trouvée, continuation..."

# Nettoyer les volumes de cache pour forcer le re-téléchargement des binaires Prisma
echo "🧹 Nettoyage des volumes de cache..."
docker volume rm meeshy_translator_cache 2>/dev/null || echo "Volume de cache non trouvé"

# Reconstruire l'image avec les corrections
echo "🔨 Reconstruction de l'image translator..."
docker-compose build --no-cache translator

# Démarrer le service
echo "🚀 Démarrage du service translator..."
docker-compose up -d translator

# Attendre que le service soit prêt
echo "⏳ Attente du démarrage du service..."
sleep 30

# Vérifier l'état du service
echo "🔍 Vérification de l'état du service..."
docker-compose ps translator

# Afficher les logs récents
echo "📝 Logs récents du service translator:"
docker-compose logs --tail=20 translator

echo "✅ Reconstruction terminée"
echo ""
echo "💡 Si le problème persiste, vous pouvez exécuter le diagnostic:"
echo "   docker exec translator /app/docker-diagnostic.sh"
