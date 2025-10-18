#!/bin/bash

# Script de mise à jour rapide de l'environnement de production
# Usage: ./scripts/update-env-production.sh [SERVER_IP]

set -e

SERVER_IP="${1:-157.230.15.51}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔄 Mise à jour du fichier .env en production"
echo "Serveur: $SERVER_IP"
echo ""

# Vérifier que env.production existe
if [ ! -f "$PROJECT_ROOT/env.production" ]; then
    echo "❌ Fichier env.production manquant"
    exit 1
fi

# Préparer le fichier .env avec échappement correct
echo "🔐 Préparation du fichier .env avec échappement des mots de passe..."
TEMP_ENV="/tmp/meeshy-env-escaped-$$"

# Copier env.production et échapper les variables contenant des mots de passe
while IFS='=' read -r key value; do
    # Ignorer les commentaires et lignes vides
    if [[ "$key" =~ ^[[:space:]]*# ]] || [[ -z "$key" ]]; then
        echo "$key=$value" >> "$TEMP_ENV"
        continue
    fi
    
    # Échapper les variables de mots de passe
    if [[ "$key" =~ (TRAEFIK_USERS|API_USERS|MONGO_USERS|REDIS_USERS) ]]; then
        # Supprimer les guillemets existants et échapper correctement
        clean_value=$(echo "$value" | sed 's/^"//;s/"$//')
        # Échapper les caractères spéciaux pour bash
        escaped_value=$(printf '%s' "$clean_value" | sed 's/\$/\\$/g; s/"/\\"/g; s/`/\\`/g')
        echo "$key=\"$escaped_value\"" >> "$TEMP_ENV"
    else
        echo "$key=$value" >> "$TEMP_ENV"
    fi
done < "$PROJECT_ROOT/env.production"

echo "✅ Fichier .env préparé"
echo ""

# Copier le fichier .env
echo "📤 Copie du fichier .env vers le serveur..."
scp -o StrictHostKeyChecking=no "$TEMP_ENV" root@$SERVER_IP:/opt/meeshy/.env

# Nettoyer le fichier temporaire
rm -f "$TEMP_ENV"

echo "✅ Fichier .env mis à jour"
echo ""

# Demander si on doit redémarrer les services
read -p "Redémarrer les services pour appliquer les changements? (yes/NO): " restart

if [ "$restart" = "yes" ]; then
    echo ""
    echo "🔄 Redémarrage des services..."
    ssh -o StrictHostKeyChecking=no root@$SERVER_IP << 'EOF'
        cd /opt/meeshy
        docker-compose restart
        echo "✅ Services redémarrés"
EOF
    echo ""
    echo "✅ Mise à jour complète"
else
    echo ""
    echo "⚠️  N'oubliez pas de redémarrer les services pour appliquer les changements:"
    echo "   ssh root@$SERVER_IP 'cd /opt/meeshy && docker-compose restart'"
fi
