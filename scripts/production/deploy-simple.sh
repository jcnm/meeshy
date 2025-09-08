#!/bin/bash

# Script de déploiement simple pour corriger la gateway
set -e

DROPLET_IP="$1"

if [ -z "$DROPLET_IP" ]; then
    echo "Usage: $0 DROPLET_IP"
    exit 1
fi

echo "🚀 Déploiement simple de la gateway..."

# Créer répertoire temporaire
deploy_dir="/tmp/meeshy-deploy-simple-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$deploy_dir"

# Copier les fichiers essentiels
cp docker-compose.traefik.yml "$deploy_dir/docker-compose.yml"
cp env.digitalocean "$deploy_dir/.env"

# Ajouter les secrets
echo "" >> "$deploy_dir/.env"
echo "# ===== SECRETS DE PRODUCTION ======" >> "$deploy_dir/.env"
echo "# Générés automatiquement le $(date)" >> "$deploy_dir/.env"
cat secrets/production-secrets.env >> "$deploy_dir/.env"

# Configuration Docker essentielle
mkdir -p "$deploy_dir/docker"
cp -r docker/nginx "$deploy_dir/docker/"
cp -r docker/supervisor "$deploy_dir/docker/"

# Fichiers shared essentiels
mkdir -p "$deploy_dir/shared"
cp shared/schema.prisma "$deploy_dir/shared/"
cp shared/schema.postgresql.prisma "$deploy_dir/shared/"
cp shared/init-postgresql.sql "$deploy_dir/shared/"
cp shared/init-database.sh "$deploy_dir/shared/"
cp shared/init-mongodb-replica.sh "$deploy_dir/shared/"
cp shared/mongodb-keyfile "$deploy_dir/shared/"

mkdir -p "$deploy_dir/shared/proto"
cp shared/proto/messaging.proto "$deploy_dir/shared/proto/"

# Envoyer sur serveur
echo "📤 Envoi des fichiers..."
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "mkdir -p /opt/meeshy"
scp -o StrictHostKeyChecking=no "$deploy_dir/docker-compose.yml" root@$DROPLET_IP:/opt/meeshy/
scp -o StrictHostKeyChecking=no "$deploy_dir/.env" root@$DROPLET_IP:/opt/meeshy/
scp -r -o StrictHostKeyChecking=no "$deploy_dir/docker" root@$DROPLET_IP:/opt/meeshy/
scp -r -o StrictHostKeyChecking=no "$deploy_dir/shared" root@$DROPLET_IP:/opt/meeshy/

# Nettoyer
rm -rf "$deploy_dir"

# Déployer sur le serveur
echo "🚀 Déploiement sur le serveur..."
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose down --remove-orphans && docker-compose pull && docker-compose up -d"

echo "✅ Déploiement terminé"
echo "🔍 Vérification de l'état..."
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose ps"
