#!/bin/bash

# Script pour corriger les doublons dans message_status
# Résout l'erreur: E11000 duplicate key error collection: meeshy.message_status

set -e

echo "🔧 [FIX] Correction des doublons dans message_status"
echo "=================================================="
echo ""

# Vérifier que le service MongoDB est en cours d'exécution
if ! docker-compose ps meeshy-database | grep -q "Up"; then
    echo "❌ [ERREUR] Le service meeshy-database n'est pas démarré"
    echo "   Lancez d'abord: docker-compose up -d meeshy-database"
    exit 1
fi

echo "✅ [OK] Service MongoDB détecté"
echo ""

# Copier le script dans le conteneur
echo "📋 [FIX] Copie du script de nettoyage dans le conteneur..."
docker cp scripts/fix-message-status-duplicates.js meeshy-database:/tmp/

# Exécuter le script
echo "🚀 [FIX] Exécution du script de nettoyage..."
echo ""
docker-compose exec -T meeshy-database mongosh meeshy /tmp/fix-message-status-duplicates.js

echo ""
echo "=================================================="
echo "✅ [FIX] Script de correction terminé"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Vérifier les résultats ci-dessus"
echo "   2. Redémarrer le translator:"
echo "      docker-compose restart meeshy-translator"
echo ""


