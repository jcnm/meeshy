#!/bin/bash

# Script de déploiement sur le serveur DigitalOcean de production
# À exécuter sur le serveur de production

set -e

echo "🚀 Déploiement Meeshy sur serveur DigitalOcean"
echo "=============================================="

# Vérifier qu'on est sur le serveur de production
if [[ ! -f "/etc/digitalocean" ]] && [[ -z "$DIGITALOCEAN_TOKEN" ]]; then
    echo "⚠️  Ce script doit être exécuté sur le serveur DigitalOcean de production"
    echo "   ou avec les variables d'environnement DigitalOcean configurées"
fi

# Aller dans le répertoire du projet
cd /root/meeshy || cd /home/meeshy/meeshy || {
    echo "❌ Répertoire du projet non trouvé"
    echo "   Assurez-vous d'être dans le bon répertoire"
    exit 1
}

echo "📁 Répertoire de travail: $(pwd)"

# Pull des dernières modifications du repository
echo "🔄 Pull des dernières modifications..."
git pull origin main

# Copier le fichier d'environnement de production
echo "📋 Configuration de l'environnement..."
if [[ -f "env.digitalocean" ]]; then
    cp env.digitalocean .env
    echo "✅ Fichier .env configuré"
else
    echo "❌ Fichier env.digitalocean non trouvé"
    exit 1
fi

# Attendre que l'image translator soit disponible
echo "⏳ Vérification de la disponibilité de l'image translator..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker pull isopen/meeshy-translator:latest >/dev/null 2>&1; then
        echo "✅ Image translator disponible"
        break
    else
        echo "⏳ Tentative $((attempt + 1))/$max_attempts - Image translator non disponible, attente..."
        sleep 30
        attempt=$((attempt + 1))
    fi
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Timeout: Image translator non disponible après $max_attempts tentatives"
    echo "   Le build du translator n'est peut-être pas encore terminé"
    exit 1
fi

# Pull de toutes les images
echo "🔄 Pull des images Docker..."
docker-compose -f docker-compose.prod.yml pull

# Arrêt des services existants
echo "🛑 Arrêt des services existants..."
docker-compose -f docker-compose.prod.yml down

# Démarrage des services avec la nouvelle configuration
echo "🚀 Démarrage des services..."
docker-compose -f docker-compose.prod.yml up -d

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 30

# Vérification du statut des services
echo "🔍 Vérification du statut des services..."
docker-compose -f docker-compose.prod.yml ps

# Vérification des logs
echo "📊 Vérification des logs..."
echo "--- Nginx logs ---"
docker logs --tail 10 meeshy-nginx

echo "--- Frontend logs ---"
docker logs --tail 10 meeshy-frontend

echo "--- Gateway logs ---"
docker logs --tail 10 meeshy-gateway

# Test des endpoints
echo "🌐 Test des endpoints..."
if curl -s -o /dev/null -w "%{http_code}" "http://localhost" | grep -q "200\|301\|302"; then
    echo "✅ Frontend accessible via nginx"
else
    echo "❌ Frontend non accessible via nginx"
fi

if curl -s -o /dev/null -w "%{http_code}" "http://localhost/api/health" | grep -q "200"; then
    echo "✅ API accessible"
else
    echo "❌ API non accessible"
fi

echo ""
echo "✅ Déploiement terminé !"
echo "🌐 Application accessible via: http://meeshy.me"
echo "🔍 Vérifiez les logs avec: docker-compose -f docker-compose.prod.yml logs -f"
