#!/bin/bash

# Script pour déployer sur le serveur DigitalOcean distant
# Utilise SSH pour se connecter au serveur de production

set -e

# Configuration du serveur (à adapter selon votre configuration)
PRODUCTION_SERVER="root@meeshy.me"  # Ou l'IP de votre serveur DigitalOcean
PROJECT_PATH="/root/meeshy"  # Chemin du projet sur le serveur

echo "🚀 Déploiement distant sur serveur DigitalOcean"
echo "=============================================="
echo "Serveur: $PRODUCTION_SERVER"
echo "Chemin: $PROJECT_PATH"
echo ""

# Vérifier la connexion SSH
echo "🔍 Test de connexion SSH..."
if ssh -o ConnectTimeout=10 -o BatchMode=yes $PRODUCTION_SERVER "echo 'Connexion SSH OK'" 2>/dev/null; then
    echo "✅ Connexion SSH réussie"
else
    echo "❌ Impossible de se connecter au serveur"
    echo "   Vérifiez:"
    echo "   - Que la clé SSH est configurée"
    echo "   - Que le serveur est accessible"
    echo "   - Que l'utilisateur a les permissions"
    exit 1
fi

# Copier le script de déploiement sur le serveur
echo "📋 Copie du script de déploiement..."
scp scripts/deploy-to-production.sh $PRODUCTION_SERVER:$PROJECT_PATH/scripts/

# Exécuter le déploiement sur le serveur
echo "🚀 Exécution du déploiement sur le serveur..."
ssh $PRODUCTION_SERVER "cd $PROJECT_PATH && chmod +x scripts/deploy-to-production.sh && ./scripts/deploy-to-production.sh"

echo ""
echo "✅ Déploiement distant terminé !"
echo "🌐 Vérifiez l'application sur: http://meeshy.me"
