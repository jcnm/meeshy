#!/bin/bash

echo "🔧 Redémarrage du service de traduction avec corrections..."

# Arrêter le service de traduction
echo "⏹️  Arrêt du service de traduction..."
docker-compose stop translator

# Reconstruire l'image avec les corrections
echo "🔨 Reconstruction de l'image translator..."
docker-compose build translator

# Redémarrer le service
echo "▶️  Redémarrage du service de traduction..."
docker-compose up -d translator

# Attendre que le service soit prêt
echo "⏳ Attente du démarrage du service..."
sleep 10

# Vérifier les logs
echo "📋 Vérification des logs du service de traduction..."
docker-compose logs --tail=20 translator

echo "✅ Service de traduction redémarré avec les corrections de timeout"
