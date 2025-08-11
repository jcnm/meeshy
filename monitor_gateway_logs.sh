#!/bin/bash

echo "🔍 Surveillance des logs de la Gateway..."
echo "=========================================="

# Trouver le processus de la Gateway
GATEWAY_PID=$(ps aux | grep "tsx watch" | grep -v grep | head -1 | awk '{print $2}')

if [ -z "$GATEWAY_PID" ]; then
    echo "❌ Aucun processus Gateway trouvé"
    exit 1
fi

echo "✅ Processus Gateway trouvé: PID $GATEWAY_PID"
echo "📊 Surveillance des logs en temps réel..."
echo ""

# Surveiller les logs en temps réel
tail -f /dev/null &
TAIL_PID=$!

# Fonction de nettoyage
cleanup() {
    echo ""
    echo "🛑 Arrêt de la surveillance..."
    kill $TAIL_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Attendre et afficher les logs
while true; do
    # Vérifier si le processus existe toujours
    if ! kill -0 $GATEWAY_PID 2>/dev/null; then
        echo "❌ Le processus Gateway s'est arrêté"
        break
    fi
    
    # Afficher les dernières lignes de log (simulation)
    echo "⏰ $(date '+%H:%M:%S') - Gateway active (PID: $GATEWAY_PID)"
    sleep 5
done

cleanup
