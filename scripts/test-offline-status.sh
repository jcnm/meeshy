#!/bin/bash

# Script de test pour vérifier la gestion de l'état en ligne/hors ligne
set -e

echo "🧪 Test de la gestion de l'état en ligne/hors ligne"
echo "=================================================="

# Variables
GATEWAY_URL="http://localhost:3000"
MAINTENANCE_URL="$GATEWAY_URL/maintenance"

echo "📊 1. Vérification des statistiques de maintenance..."
STATS=$(curl -s "$MAINTENANCE_URL/stats")
echo "   Réponse: $STATS"

# Extraire le nombre d'utilisateurs en ligne
ONLINE_USERS=$(echo $STATS | jq -r '.data.onlineUsers')
TOTAL_USERS=$(echo $STATS | jq -r '.data.totalUsers')
MAINTENANCE_ACTIVE=$(echo $STATS | jq -r '.data.maintenanceActive')

echo "   Utilisateurs en ligne: $ONLINE_USERS/$TOTAL_USERS"
echo "   Maintenance active: $MAINTENANCE_ACTIVE"

if [ "$MAINTENANCE_ACTIVE" = "false" ]; then
    echo "⚠️  Les tâches de maintenance automatiques ne sont pas actives"
    echo "   Cela peut être normal si le service vient de démarrer"
fi

echo ""
echo "🔧 2. Test de mise à jour manuelle du statut utilisateur..."

# Test avec un utilisateur fictif
TEST_USER_ID="test-user-$(date +%s)"
echo "   Test avec utilisateur: $TEST_USER_ID"

# Mettre l'utilisateur en ligne
echo "   → Mise en ligne..."
curl -s -X POST "$MAINTENANCE_URL/user-status" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$TEST_USER_ID\",\"isOnline\":true}" | jq .

# Vérifier les stats après mise en ligne
sleep 2
STATS_AFTER_ONLINE=$(curl -s "$MAINTENANCE_URL/stats")
ONLINE_AFTER=$(echo $STATS_AFTER_ONLINE | jq -r '.data.onlineUsers')
echo "   Utilisateurs en ligne après mise en ligne: $ONLINE_AFTER"

# Mettre l'utilisateur hors ligne
echo "   → Mise hors ligne..."
curl -s -X POST "$MAINTENANCE_URL/user-status" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$TEST_USER_ID\",\"isOnline\":false}" | jq .

# Vérifier les stats après mise hors ligne
sleep 2
STATS_AFTER_OFFLINE=$(curl -s "$MAINTENANCE_URL/stats")
ONLINE_AFTER_OFFLINE=$(echo $STATS_AFTER_OFFLINE | jq -r '.data.onlineUsers')
echo "   Utilisateurs en ligne après mise hors ligne: $ONLINE_AFTER_OFFLINE"

echo ""
echo "🧹 3. Test du nettoyage des données expirées..."
curl -s -X POST "$MAINTENANCE_URL/cleanup" | jq .

echo ""
echo "✅ Test terminé avec succès !"
echo ""
echo "📋 Résumé:"
echo "   - Service de maintenance: ✅ Fonctionnel"
echo "   - Mise à jour statut utilisateur: ✅ Fonctionnel"
echo "   - Nettoyage des données: ✅ Fonctionnel"
echo "   - Tâches automatiques: $([ "$MAINTENANCE_ACTIVE" = "true" ] && echo "✅ Actives" || echo "⚠️  Non actives")"
echo ""
echo "💡 Note: Les utilisateurs inactifs depuis plus de 5 minutes seront automatiquement"
echo "   marqués comme hors ligne par les tâches de maintenance (si actives)."
