#!/bin/bash

# Script pour reconstruire le service de traduction avec optimisations réseau
# Résout les problèmes de téléchargement de modèles dans Docker

set -e

echo "🔧 Reconstruction du service de traduction avec optimisations réseau"
echo "=================================================================="

# Vérifier que Docker est disponible
if ! command -v docker > /dev/null 2>&1; then
    echo "❌ Docker n'est pas installé ou n'est pas dans le PATH"
    exit 1
fi

# Arrêter les services existants
echo "🛑 Arrêt des services existants..."
docker-compose down translator 2>/dev/null || true

# Nettoyer les images existantes
echo "🧹 Nettoyage des images existantes..."
docker rmi isopen/meeshy-translator:latest 2>/dev/null || true
docker rmi meeshy_translator 2>/dev/null || true

# Reconstruire l'image avec les optimisations réseau
echo "🔨 Reconstruction de l'image translator avec optimisations réseau..."
docker-compose build --no-cache translator

# Démarrer le service
echo "🚀 Démarrage du service translator..."
docker-compose up -d translator

# Attendre que le service démarre
echo "⏳ Attente du démarrage du service..."
sleep 30

# Vérifier l'état du service
echo "🔍 Vérification de l'état du service..."
if docker-compose ps translator | grep -q "Up"; then
    echo "✅ Service translator démarré avec succès"
else
    echo "❌ Service translator n'a pas démarré correctement"
    echo "📋 Logs du service:"
    docker-compose logs translator --tail=50
    exit 1
fi

# Exécuter le diagnostic réseau
echo "🔍 Exécution du diagnostic réseau..."
docker exec translator /app/docker-network-diagnostic.sh

# Vérifier la connectivité vers Hugging Face
echo "🤗 Test de connectivité vers Hugging Face..."
if docker exec translator curl -s --connect-timeout 10 https://huggingface.co > /dev/null; then
    echo "✅ Connectivité vers Hugging Face OK"
else
    echo "❌ Problème de connectivité vers Hugging Face"
fi

# Vérifier les variables d'environnement réseau
echo "⚙️ Vérification des variables d'environnement réseau..."
docker exec translator env | grep -E "(HF_HUB|REQUESTS|CURL)" || echo "⚠️ Variables d'environnement réseau non trouvées"

# Attendre un peu plus pour le chargement des modèles
echo "⏳ Attente du chargement des modèles (peut prendre plusieurs minutes)..."
sleep 60

# Vérifier les logs pour les erreurs de téléchargement
echo "📋 Vérification des logs récents..."
docker-compose logs translator --tail=20

# Test de santé du service
echo "🏥 Test de santé du service..."
if docker exec translator python3 -c "import requests; requests.get('http://localhost:8000/health', timeout=10)" 2>/dev/null; then
    echo "✅ Service de santé OK"
else
    echo "❌ Service de santé échoué"
fi

echo ""
echo "🎉 Reconstruction terminée!"
echo ""
echo "💡 Prochaines étapes:"
echo "1. Vérifiez les logs: docker-compose logs translator -f"
echo "2. Testez une traduction: curl -X POST http://localhost:8000/translate -H 'Content-Type: application/json' -d '{\"text\":\"hello\",\"source_language\":\"en\",\"target_language\":\"fr\"}'"
echo "3. Si problèmes persistants, exécutez: docker exec translator /app/docker-network-diagnostic.sh"
echo ""
echo "🔧 Si les modèles ne se téléchargent toujours pas:"
echo "- Vérifiez votre connexion Internet"
echo "- Essayez avec un VPN si vous êtes derrière un proxy d'entreprise"
echo "- Augmentez les timeouts dans docker-compose.yml"
echo "- Le service retournera des messages d'échec clairs"
