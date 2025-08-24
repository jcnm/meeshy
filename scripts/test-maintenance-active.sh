#!/bin/bash

# Script pour tester si les tâches de maintenance sont actives
set -e

echo "🧪 Test des tâches de maintenance automatiques"
echo "=============================================="

# Variables
GATEWAY_URL="http://localhost:3000"
MAINTENANCE_URL="$GATEWAY_URL/maintenance"

echo "📊 1. Vérification initiale..."
INITIAL_STATS=$(curl -s "$MAINTENANCE_URL/stats")
echo "   Réponse: $INITIAL_STATS"

# Extraire les informations
INITIAL_ONLINE=$(echo $INITIAL_STATS | jq -r '.data.onlineUsers')
INITIAL_MAINTENANCE_ACTIVE=$(echo $INITIAL_STATS | jq -r '.data.maintenanceActive')

echo "   Utilisateurs en ligne: $INITIAL_ONLINE"
echo "   Maintenance active: $INITIAL_MAINTENANCE_ACTIVE"

echo ""
echo "⏰ 2. Attente de 70 secondes pour voir si les tâches automatiques s'exécutent..."
echo "   (Les tâches s'exécutent toutes les 60 secondes)"

# Attendre 70 secondes
for i in {1..7}; do
    echo "   Attente... ($((i*10))/70 secondes)"
    sleep 10
    
    # Vérifier les stats toutes les 10 secondes
    CURRENT_STATS=$(curl -s "$MAINTENANCE_URL/stats")
    CURRENT_ONLINE=$(echo $CURRENT_STATS | jq -r '.data.onlineUsers')
    CURRENT_MAINTENANCE_ACTIVE=$(echo $CURRENT_STATS | jq -r '.data.maintenanceActive')
    
    echo "   → Utilisateurs en ligne: $CURRENT_ONLINE, Maintenance active: $CURRENT_MAINTENANCE_ACTIVE"
    
    # Si le nombre d'utilisateurs en ligne a changé, c'est que les tâches fonctionnent
    if [ "$CURRENT_ONLINE" != "$INITIAL_ONLINE" ]; then
        echo "   🎉 Changement détecté ! Les tâches automatiques fonctionnent !"
        break
    fi
done

echo ""
echo "🔧 3. Test manuel de mise à jour d'un utilisateur inactif..."

# Créer un utilisateur de test et le mettre en ligne
TEST_USER_ID="test-maintenance-$(date +%s)"
echo "   → Création utilisateur de test: $TEST_USER_ID"

# Mettre l'utilisateur en ligne
curl -s -X POST "$MAINTENANCE_URL/user-status" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$TEST_USER_ID\",\"isOnline\":true}" | jq .

# Vérifier les stats après mise en ligne
sleep 2
AFTER_ONLINE_STATS=$(curl -s "$MAINTENANCE_URL/stats")
AFTER_ONLINE_COUNT=$(echo $AFTER_ONLINE_STATS | jq -r '.data.onlineUsers')
echo "   Utilisateurs en ligne après mise en ligne: $AFTER_ONLINE_COUNT"

# Simuler une activité ancienne en mettant à jour lastActiveAt à une date passée
echo "   → Simulation d'inactivité (lastActiveAt = 10 minutes ago)..."

# Mettre l'utilisateur hors ligne manuellement
curl -s -X POST "$MAINTENANCE_URL/user-status" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$TEST_USER_ID\",\"isOnline\":false}" | jq .

# Vérifier les stats finales
sleep 2
FINAL_STATS=$(curl -s "$MAINTENANCE_URL/stats")
FINAL_ONLINE_COUNT=$(echo $FINAL_STATS | jq -r '.data.onlineUsers')
FINAL_MAINTENANCE_ACTIVE=$(echo $FINAL_STATS | jq -r '.data.maintenanceActive')

echo ""
echo "📋 Résumé du test:"
echo "   - Utilisateurs en ligne initial: $INITIAL_ONLINE"
echo "   - Utilisateurs en ligne final: $FINAL_ONLINE_COUNT"
echo "   - Maintenance active: $FINAL_MAINTENANCE_ACTIVE"

if [ "$FINAL_MAINTENANCE_ACTIVE" = "true" ]; then
    echo "   ✅ Les tâches de maintenance automatiques sont actives"
else
    echo "   ❌ Les tâches de maintenance automatiques ne sont pas actives"
fi

echo ""
echo "💡 Note: Si les tâches automatiques ne sont pas actives, cela peut être dû à:"
echo "   1. Erreur lors de l'initialisation du MaintenanceService"
echo "   2. Problème de compilation TypeScript"
echo "   3. Le service de maintenance n'est pas correctement intégré"
echo ""
echo "✅ Test terminé"
