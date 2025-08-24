#!/bin/bash

# Script de diagnostic pour les tâches de maintenance
set -e

echo "🔍 Diagnostic des tâches de maintenance automatiques"
echo "=================================================="

# Variables
GATEWAY_URL="http://localhost:3000"
MAINTENANCE_URL="$GATEWAY_URL/maintenance"

echo "📊 1. Vérification du service de maintenance..."
STATS=$(curl -s "$MAINTENANCE_URL/stats")
echo "   Réponse: $STATS"

# Extraire les informations
ONLINE_USERS=$(echo $STATS | jq -r '.data.onlineUsers')
TOTAL_USERS=$(echo $STATS | jq -r '.data.totalUsers')
MAINTENANCE_ACTIVE=$(echo $STATS | jq -r '.data.maintenanceActive')
OFFLINE_THRESHOLD=$(echo $STATS | jq -r '.data.offlineThresholdMinutes')

echo "   Utilisateurs en ligne: $ONLINE_USERS/$TOTAL_USERS"
echo "   Maintenance active: $MAINTENANCE_ACTIVE"
echo "   Seuil hors ligne: $OFFLINE_THRESHOLD minutes"

echo ""
echo "🔧 2. Test des fonctionnalités manuelles..."

# Test du nettoyage
echo "   → Test nettoyage des données..."
CLEANUP_RESPONSE=$(curl -s -X POST "$MAINTENANCE_URL/cleanup")
echo "   Réponse: $CLEANUP_RESPONSE"

# Test de mise à jour de statut
echo "   → Test mise à jour statut utilisateur..."
TEST_USER_ID="debug-user-$(date +%s)"
STATUS_RESPONSE=$(curl -s -X POST "$MAINTENANCE_URL/user-status" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$TEST_USER_ID\",\"isOnline\":true}")
echo "   Réponse: $STATUS_RESPONSE"

echo ""
echo "📋 3. Vérification des logs de démarrage..."

# Chercher les logs de maintenance dans les derniers logs
echo "   → Recherche dans les logs récents..."
MAINTENANCE_LOGS=$(tail -n 1000 logs/gateway.log | grep -E "(maintenance|MaintenanceService|startMaintenanceTasks)" | wc -l)
echo "   Logs de maintenance trouvés: $MAINTENANCE_LOGS"

if [ "$MAINTENANCE_LOGS" -eq 0 ]; then
    echo "   ⚠️  Aucun log de maintenance trouvé"
    echo "   → Recherche des logs d'initialisation..."
    INIT_LOGS=$(tail -n 1000 logs/gateway.log | grep -E "(MeeshySocketIOManager.*initialisé|✅.*initialisé)" | wc -l)
    echo "   Logs d'initialisation trouvés: $INIT_LOGS"
fi

echo ""
echo "🔍 4. Vérification des erreurs..."

# Chercher les erreurs dans les logs
ERROR_LOGS=$(tail -n 1000 logs/gateway.log | grep -E "(error|Error|ERROR|❌)" | wc -l)
echo "   Erreurs trouvées: $ERROR_LOGS"

if [ "$ERROR_LOGS" -gt 0 ]; then
    echo "   → Dernières erreurs:"
    tail -n 1000 logs/gateway.log | grep -E "(error|Error|ERROR|❌)" | tail -3
fi

echo ""
echo "📊 5. Vérification des processus..."

# Vérifier si le processus gateway fonctionne
GATEWAY_PROCESSES=$(ps aux | grep -E "(gateway|node.*gateway)" | grep -v grep | wc -l)
echo "   Processus gateway actifs: $GATEWAY_PROCESSES"

if [ "$GATEWAY_PROCESSES" -gt 0 ]; then
    echo "   → Processus gateway:"
    ps aux | grep -E "(gateway|node.*gateway)" | grep -v grep | head -3
fi

echo ""
echo "🎯 6. Diagnostic des tâches automatiques..."

if [ "$MAINTENANCE_ACTIVE" = "false" ]; then
    echo "   ❌ Les tâches de maintenance automatiques ne sont pas actives"
    echo ""
    echo "🔍 Causes possibles:"
    echo "   1. Erreur lors de l'initialisation du MaintenanceService"
    echo "   2. Erreur lors du démarrage des tâches automatiques"
    echo "   3. Le code de maintenance n'est pas exécuté"
    echo "   4. Problème de compilation TypeScript"
    echo ""
    echo "💡 Solutions:"
    echo "   - Vérifier les logs d'erreur"
    echo "   - Redémarrer le service gateway"
    echo "   - Vérifier la compilation TypeScript"
    echo "   - Ajouter plus de logs de débogage"
else
    echo "   ✅ Les tâches de maintenance automatiques sont actives"
fi

echo ""
echo "✅ Diagnostic terminé"
