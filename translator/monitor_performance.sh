#!/bin/bash

# Script de monitoring en temps réel pour l'architecture de traduction
# Affiche les métriques de performance en continu

set -e

# Configuration
HOST=${ZMQ_HOST:-"localhost"}
PORT=${ZMQ_PORT:-5555}
INTERVAL=${MONITOR_INTERVAL:-5}  # Intervalle de rafraîchissement en secondes
LOG_FILE="monitor_$(date +%Y%m%d_%H%M%S).log"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Fonction de logging
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

# Fonction pour obtenir les statistiques
get_stats() {
    # Créer un script Python pour récupérer les stats
    cat > /tmp/get_stats.py << 'EOF'
#!/usr/bin/env python3
import asyncio
import json
import zmq
import zmq.asyncio

async def get_stats():
    context = zmq.asyncio.Context()
    socket = context.socket(zmq.REQ)
    socket.setsockopt(zmq.LINGER, 1000)
    
    try:
        await socket.connect("tcp://localhost:5555")
        
        # Demander les stats
        request = {
            "messageId": "stats-request",
            "text": "stats",
            "sourceLanguage": "en",
            "targetLanguage": "en",
            "requestType": "stats_request"
        }
        
        await socket.send(json.dumps(request).encode('utf-8'))
        response = await socket.receive()
        response_data = json.loads(response[0].decode('utf-8'))
        
        print(json.dumps(response_data, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
    finally:
        await socket.close()
        context.term()

if __name__ == "__main__":
    asyncio.run(get_stats())
EOF

    python3 /tmp/get_stats.py 2>/dev/null || echo '{"error": "Service non accessible"}'
    rm -f /tmp/get_stats.py
}

# Fonction pour afficher les métriques
display_metrics() {
    local stats_json="$1"
    
    # Extraire les métriques avec jq si disponible
    if command -v jq &> /dev/null; then
        local requests_received=$(echo "$stats_json" | jq -r '.stats.requests_received // 0')
        local translations_completed=$(echo "$stats_json" | jq -r '.stats.translations_completed // 0')
        local errors=$(echo "$stats_json" | jq -r '.stats.errors // 0')
        local avg_processing_time=$(echo "$stats_json" | jq -r '.stats.avg_processing_time // 0')
        local queue_size=$(echo "$stats_json" | jq -r '.stats.queue_size // 0')
        local active_tasks=$(echo "$stats_json" | jq -r '.stats.active_tasks // 0')
        local requests_per_second=$(echo "$stats_json" | jq -r '.stats.requests_per_second // 0')
        local memory_usage=$(echo "$stats_json" | jq -r '.stats.memory_usage_mb // 0')
        local uptime=$(echo "$stats_json" | jq -r '.stats.uptime_seconds // 0')
    else
        # Fallback sans jq
        local requests_received=0
        local translations_completed=0
        local errors=0
        local avg_processing_time=0
        local queue_size=0
        local active_tasks=0
        local requests_per_second=0
        local memory_usage=0
        local uptime=0
    fi
    
    # Calculer le taux de succès
    local success_rate=0
    if [ "$requests_received" -gt 0 ]; then
        success_rate=$(echo "scale=1; ($translations_completed / $requests_received) * 100" | bc -l 2>/dev/null || echo "0")
    fi
    
    # Formater l'uptime
    local uptime_formatted=""
    if [ "$uptime" -gt 0 ]; then
        local hours=$((uptime / 3600))
        local minutes=$(((uptime % 3600) / 60))
        local seconds=$((uptime % 60))
        uptime_formatted=$(printf "%02d:%02d:%02d" $hours $minutes $seconds)
    fi
    
    # Afficher le tableau de bord
    clear
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    📊 MONITORING ARCHITECTURE HAUTE PERFORMANCE              ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}🕐 $(date '+%Y-%m-%d %H:%M:%S')${NC} | ${BLUE}🔄 Rafraîchissement: ${INTERVAL}s${NC} | ${BLUE}📝 Log: $LOG_FILE${NC}"
    echo ""
    
    # Métriques principales
    echo -e "${GREEN}📈 MÉTRIQUES PRINCIPALES${NC}"
    echo -e "   • Requêtes reçues: ${YELLOW}$requests_received${NC}"
    echo -e "   • Traductions terminées: ${GREEN}$translations_completed${NC}"
    echo -e "   • Erreurs: ${RED}$errors${NC}"
    echo -e "   • Taux de succès: ${GREEN}${success_rate}%${NC}"
    echo -e "   • Requêtes/sec: ${CYAN}${requests_per_second}${NC}"
    echo ""
    
    # Performance
    echo -e "${GREEN}⚡ PERFORMANCE${NC}"
    echo -e "   • Temps de traitement moyen: ${YELLOW}${avg_processing_time}ms${NC}"
    echo -e "   • Taille de la file d'attente: ${YELLOW}$queue_size${NC}"
    echo -e "   • Tâches actives: ${YELLOW}$active_tasks${NC}"
    echo -e "   • Utilisation mémoire: ${YELLOW}${memory_usage}MB${NC}"
    echo -e "   • Uptime: ${CYAN}${uptime_formatted}${NC}"
    echo ""
    
    # Évaluation des performances
    echo -e "${GREEN}🎯 ÉVALUATION${NC}"
    if (( $(echo "$requests_per_second >= 10" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "   • Gateway (10+ req/sec): ${GREEN}✅ ATTEINT${NC} (${requests_per_second} req/sec)"
    else
        echo -e "   • Gateway (10+ req/sec): ${RED}❌ NON ATTEINT${NC} (${requests_per_second} req/sec)"
    fi
    
    if (( $(echo "$requests_per_second >= 100" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "   • Translator (100+ req/sec): ${GREEN}✅ ATTEINT${NC} (${requests_per_second} req/sec)"
    elif (( $(echo "$requests_per_second >= 50" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "   • Translator (100+ req/sec): ${YELLOW}⚠️ PARTIEL${NC} (${requests_per_second} req/sec)"
    else
        echo -e "   • Translator (100+ req/sec): ${RED}❌ NON ATTEINT${NC} (${requests_per_second} req/sec)"
    fi
    
    if (( $(echo "$success_rate >= 95" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "   • Fiabilité (95%+): ${GREEN}✅ EXCELLENTE${NC} (${success_rate}%)"
    elif (( $(echo "$success_rate >= 90" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "   • Fiabilité (95%+): ${YELLOW}⚠️ BONNE${NC} (${success_rate}%)"
    else
        echo -e "   • Fiabilité (95%+): ${RED}❌ INSUFFISANTE${NC} (${success_rate}%)"
    fi
    echo ""
    
    # Statut du service
    if [ "$requests_received" -gt 0 ] || [ "$translations_completed" -gt 0 ]; then
        echo -e "${GREEN}🟢 SERVICE ACTIF${NC}"
    else
        echo -e "${RED}🔴 SERVICE INACTIF${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Appuyez sur Ctrl+C pour arrêter le monitoring${NC}"
}

# Fonction principale
main() {
    log "🚀 Démarrage du monitoring haute performance"
    log "Configuration: $HOST:$PORT, intervalle: ${INTERVAL}s"
    
    # Test de connectivité initial
    if ! timeout 5 nc -z "$HOST" "$PORT" 2>/dev/null; then
        log "⚠️ Service non accessible, monitoring en mode dégradé"
    fi
    
    # Boucle de monitoring
    while true; do
        stats_json=$(get_stats)
        display_metrics "$stats_json"
        sleep "$INTERVAL"
    done
}

# Gestion des signaux
trap 'echo -e "\n${BLUE}🛑 Monitoring arrêté${NC}"; exit 0' INT TERM

# Gestion des arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h                    Affiche cette aide"
        echo "  --interval SECONDS            Intervalle de rafraîchissement (défaut: 5)"
        echo ""
        echo "Variables d'environnement:"
        echo "  ZMQ_HOST                      Host du service ZMQ"
        echo "  ZMQ_PORT                      Port du service ZMQ"
        echo "  MONITOR_INTERVAL              Intervalle de rafraîchissement"
        echo ""
        echo "Exemples:"
        echo "  $0                            # Monitoring par défaut"
        echo "  $0 --interval 2               # Rafraîchissement toutes les 2 secondes"
        exit 0
        ;;
    --interval)
        INTERVAL="$2"
        shift 2
        ;;
esac

# Exécution
main "$@"
