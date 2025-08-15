#!/bin/bash

echo "🧹 NETTOYAGE DES PORTS DE TEST OBSOLÈTES"
echo "========================================"
echo ""

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fonction pour vérifier et arrêter les processus sur un port
check_and_cleanup_port() {
    local port=$1
    local service_name=$2
    
    echo ""
    log_info "Vérification du port $port ($service_name)..."
    
    # Trouver les processus utilisant ce port
    local pids=$(lsof -ti :$port 2>/dev/null)
    
    if [ -n "$pids" ]; then
        log_warn "Processus trouvés sur le port $port:"
        lsof -i :$port 2>/dev/null | head -10
        
        # Si c'est un port de test obsolète (pas les ports officiels 5555, 5558, 3000, 8000)
        if [[ "$port" != "5555" && "$port" != "5558" && "$port" != "3000" && "$port" != "8000" ]]; then
            echo ""
            read -p "❓ Voulez-vous arrêter ces processus ? (y/N): " response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                for pid in $pids; do
                    log_info "Arrêt du processus $pid..."
                    kill -TERM $pid 2>/dev/null || kill -KILL $pid 2>/dev/null
                done
                sleep 2
                
                # Vérifier si les processus sont toujours actifs
                local remaining_pids=$(lsof -ti :$port 2>/dev/null)
                if [ -n "$remaining_pids" ]; then
                    log_error "Certains processus sont toujours actifs sur le port $port"
                else
                    log_info "Port $port libéré avec succès"
                fi
            fi
        else
            log_info "Port $port est un port officiel, pas de nettoyage automatique"
        fi
    else
        log_info "Port $port libre"
    fi
}

# Liste des ports à vérifier
echo "🔍 Vérification des ports utilisés par les services Meeshy..."

# Ports officiels (ne pas nettoyer automatiquement)
log_info "=== PORTS OFFICIELS ==="
check_and_cleanup_port 5555 "Translator PULL (official)"
check_and_cleanup_port 5558 "Translator PUB (official)"
check_and_cleanup_port 3000 "Frontend (official)"
check_and_cleanup_port 8000 "Translator API FastAPI (official)"

# Ports de test potentiellement obsolètes
log_info "=== PORTS DE TEST POTENTIELS ==="
check_and_cleanup_port 5556 "Ancien port test (obsolète)"
check_and_cleanup_port 5557 "Port test potentiel (obsolète)"
check_and_cleanup_port 8001 "API test potentielle (obsolète)"
check_and_cleanup_port 8080 "Port test générique (obsolète)"

echo ""
log_info "=== RÉSUMÉ FINAL ==="
echo "Ports actuellement utilisés :"
lsof -i :5555 -i :5556 -i :5557 -i :5558 -i :3000 -i :8000 -i :8001 -i :8080 2>/dev/null || log_info "Aucun port Meeshy en cours d'utilisation"

echo ""
log_info "✅ Nettoyage terminé"
log_info ""
log_info "📋 PORTS OFFICIELS MEESHY :"
log_info "  • 5555 : Translator PULL (Gateway → Translator)"
log_info "  • 5558 : Translator PUB (Translator → Gateway)"
log_info "  • 3000 : Frontend Next.js"
log_info "  • 8000 : Translator API FastAPI"
log_info ""
log_info "⚠️  Si vous voyez d'autres ports, ils peuvent être des services de test obsolètes"
