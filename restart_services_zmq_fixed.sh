#!/bin/bash

echo "🔄 Redémarrage des services avec configuration ZMQ corrigée"
echo "=========================================================="

# Arrêter les services existants
echo "🛑 Arrêt des services existants..."
docker-compose down

# Nettoyer les conteneurs et volumes si nécessaire
echo "🧹 Nettoyage des conteneurs..."
docker-compose rm -f

# Reconstruire les images avec la nouvelle configuration
echo "🔨 Reconstruction des images..."
docker-compose build --no-cache translator gateway

# Démarrer les services
echo "🚀 Démarrage des services..."
docker-compose up -d

# Attendre que les services démarrent
echo "⏳ Attente du démarrage des services..."
sleep 10

# Vérifier l'état des services
echo "📊 État des services:"
docker-compose ps

# Vérifier les logs du Translator
echo ""
echo "📋 Logs du Translator:"
docker-compose logs --tail=20 translator

# Vérifier les logs du Gateway
echo ""
echo "📋 Logs du Gateway:"
docker-compose logs --tail=20 gateway

echo ""
echo "✅ Services redémarrés avec la configuration ZMQ corrigée"
echo ""
echo "🔍 Pour surveiller les logs en temps réel:"
echo "   docker-compose logs -f translator"
echo "   docker-compose logs -f gateway"
