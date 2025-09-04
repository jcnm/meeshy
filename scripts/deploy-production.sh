#!/bin/bash

# Script de déploiement en production
# Attend que le build du translator soit terminé puis déploie

set -e

echo "🚀 Déploiement en production Meeshy"
echo "=================================="

# Attendre 15 minutes pour que le build du translator se termine
echo "⏳ Attente de 15 minutes pour que le build du translator se termine..."
sleep 900

echo "🔍 Vérification du statut du build du translator..."

# Vérifier si l'image est disponible
if docker pull isopen/meeshy-translator:latest; then
    echo "✅ Image translator disponible, déploiement en cours..."
    
    # Se connecter au serveur de production (à adapter selon votre configuration)
    echo "📡 Connexion au serveur de production..."
    
    # Commandes à exécuter sur le serveur de production
    echo "🔄 Pull des dernières images..."
    echo "docker-compose -f docker-compose.prod.yml pull"
    
    echo "🔄 Redémarrage des services..."
    echo "docker-compose -f docker-compose.prod.yml up -d"
    
    echo "🔍 Vérification du statut des services..."
    echo "docker-compose -f docker-compose.prod.yml ps"
    
    echo "📊 Vérification des logs nginx..."
    echo "docker logs meeshy-nginx"
    
    echo "📊 Vérification des logs frontend..."
    echo "docker logs meeshy-frontend"
    
    echo "✅ Déploiement terminé !"
    echo "🌐 Testez l'accès via: http://meeshy.me"
    
else
    echo "❌ Image translator non disponible, veuillez réessayer plus tard"
    exit 1
fi
