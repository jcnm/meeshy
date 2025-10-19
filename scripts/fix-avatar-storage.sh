#!/bin/bash

# Script de déploiement de la correction de persistance des avatars
# Ce script met à jour docker-compose.traefik.yml et redémarre le service frontend
# avec le nouveau volume persistant pour les avatars

set -e

echo "=========================================="
echo "  Correction de persistance des avatars"
echo "=========================================="
echo ""

# Déterminer si on est en production ou local
if [ -d "/opt/meeshy" ]; then
    MEESHY_DIR="/opt/meeshy"
    echo "🌐 Environnement: PRODUCTION"
else
    MEESHY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    echo "💻 Environnement: LOCAL"
fi

cd "$MEESHY_DIR"
echo "📂 Répertoire: $MEESHY_DIR"
echo ""

# Vérifier que docker-compose.traefik.yml existe
if [ ! -f "docker-compose.traefik.yml" ]; then
    echo "❌ Erreur: docker-compose.traefik.yml non trouvé"
    exit 1
fi

# Sauvegarder le fichier actuel
echo "💾 Sauvegarde de docker-compose.traefik.yml..."
cp docker-compose.traefik.yml docker-compose.traefik.yml.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup créé"
echo ""

# Vérifier si le volume frontend_uploads est déjà configuré
if grep -q "frontend_uploads:" docker-compose.traefik.yml; then
    echo "✅ Volume frontend_uploads déjà configuré dans docker-compose.traefik.yml"
else
    echo "⚠️  Volume frontend_uploads NON configuré"
    echo "   Veuillez mettre à jour docker-compose.traefik.yml manuellement ou via git pull"
    exit 1
fi

# Vérifier si le montage du volume est configuré pour le service frontend
if grep -q "frontend_uploads:/app/public/i" docker-compose.traefik.yml; then
    echo "✅ Volume monté sur le service frontend"
else
    echo "⚠️  Volume NON monté sur le service frontend"
    echo "   Veuillez mettre à jour docker-compose.traefik.yml manuellement"
    exit 1
fi

echo ""
echo "🔄 Recréation du service frontend avec le volume persistant..."
echo ""

# Arrêter le frontend
echo "⏸️  Arrêt du service frontend..."
docker compose -f docker-compose.traefik.yml stop frontend

# Recréer le service avec le nouveau volume
echo "🚀 Démarrage du service frontend avec le nouveau volume..."
docker compose -f docker-compose.traefik.yml up -d frontend

echo ""
echo "⏳ Attente du démarrage du service (10 secondes)..."
sleep 10

# Vérifier que le volume est bien monté
echo ""
echo "🔍 Vérification du montage du volume..."
if docker inspect meeshy-frontend | grep -q "frontend_uploads"; then
    echo "✅ Volume frontend_uploads correctement monté"
    
    # Afficher les détails du montage
    echo ""
    echo "📋 Détails du montage:"
    docker inspect meeshy-frontend --format '{{range .Mounts}}{{if eq .Destination "/app/public/i"}}Type: {{.Type}}, Source: {{.Source}}, Destination: {{.Destination}}{{end}}{{end}}'
else
    echo "❌ Erreur: Volume non monté correctement"
    exit 1
fi

# Vérifier que le service est démarré
echo ""
echo "🔍 Vérification du statut du service..."
if docker ps | grep -q meeshy-frontend; then
    echo "✅ Service frontend démarré"
else
    echo "❌ Erreur: Service frontend non démarré"
    docker logs meeshy-frontend --tail 50
    exit 1
fi

# Vérifier les permissions du dossier
echo ""
echo "🔍 Vérification des permissions..."
docker exec meeshy-frontend ls -ld /app/public/i 2>/dev/null || echo "⚠️  Impossible de vérifier les permissions"

# Vérifier s'il y a déjà des avatars
echo ""
echo "🔍 Vérification des avatars existants..."
AVATAR_COUNT=$(docker exec meeshy-frontend find /app/public/i -name "avatar_*" -type f 2>/dev/null | wc -l)
echo "   Avatars trouvés: $AVATAR_COUNT"

# Afficher les informations du volume
echo ""
echo "📊 Informations du volume:"
docker volume inspect meeshy_frontend_uploads --format 'Name: {{.Name}}, Mountpoint: {{.Mountpoint}}' 2>/dev/null || \
    docker volume inspect frontend_uploads --format 'Name: {{.Name}}, Mountpoint: {{.Mountpoint}}' 2>/dev/null || \
    echo "⚠️  Impossible de récupérer les informations du volume"

echo ""
echo "=========================================="
echo "  ✅ Déploiement terminé avec succès!"
echo "=========================================="
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Tester l'upload d'un nouvel avatar depuis l'interface web"
echo "   2. Vérifier que l'image s'affiche correctement"
echo "   3. Redémarrer le frontend et vérifier que l'image persiste:"
echo "      docker compose -f docker-compose.traefik.yml restart frontend"
echo ""
echo "📚 Documentation complète: docs/AVATAR_STORAGE_FIX.md"
echo ""

