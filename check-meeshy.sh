#!/bin/bash

# Script pour vérifier l'état des processus Meeshy
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🔍 État des processus Meeshy${NC}"
echo "=================================="

# Fonction pour vérifier un pattern de processus
check_processes() {
    pattern="$1"
    service_name="$2"
    
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [[ ! -z "$pids" ]]; then
        echo -e "${GREEN}✅ $service_name:${NC}"
        ps aux | grep -E "$pattern" | grep -v grep | while read line; do
            echo -e "   ${CYAN}$line${NC}"
        done
        echo
        return 0
    else
        echo -e "${RED}❌ $service_name: Aucun processus trouvé${NC}"
        return 1
    fi
}

# Fonction pour vérifier les ports
check_ports() {
    echo -e "${BLUE}🌐 État des ports:${NC}"
    
    for port in 3000 3100 8000 5555 5558; do
        if lsof -ti:$port >/dev/null 2>&1; then
            process_info=$(lsof -ti:$port | head -1 | xargs ps -p 2>/dev/null | tail -1 || echo "Processus inconnu")
            echo -e "${GREEN}✅ Port $port: Occupé${NC}"
            echo -e "   ${CYAN}$process_info${NC}"
        else
            echo -e "${RED}❌ Port $port: Libre${NC}"
        fi
    done
    echo
}

services_running=0

# Vérifier chaque service
echo -e "${YELLOW}📱 Services Meeshy:${NC}"

if check_processes "next dev.*turbopack" "Frontend (Next.js)"; then
    ((services_running++))
fi

if check_processes "tsx.*watch.*src/server.ts" "Gateway (Fastify/TSX)"; then
    ((services_running++))
fi

if check_processes "start_service.py" "Translator (Python/FastAPI)"; then
    ((services_running++))
fi

# Vérifier les scripts de démarrage
echo -e "${YELLOW}🔧 Scripts de démarrage:${NC}"
check_processes "start-all.sh" "Script Start All" || true
check_processes "start_meeshy_services.sh" "Script Start Services" || true
check_processes "frontend.sh" "Script Frontend" || true
check_processes "gateway.sh" "Script Gateway" || true
check_processes "translator.sh" "Script Translator" || true

echo

# Vérifier les ports
check_ports

# Résumé
echo -e "${BLUE}📊 Résumé:${NC}"
if [[ $services_running -eq 0 ]]; then
    echo -e "${RED}❌ Aucun service Meeshy en cours d'exécution${NC}"
elif [[ $services_running -eq 3 ]]; then
    echo -e "${GREEN}✅ Tous les services Meeshy sont en cours d'exécution ($services_running/3)${NC}"
    echo -e "${CYAN}🌐 Accès aux services:${NC}"
    echo -e "   🎨 Frontend:    ${BLUE}http://localhost:3100${NC}"
    echo -e "   ⚡ Gateway:     ${BLUE}http://localhost:3000${NC}"
    echo -e "   🐍 Translator:  ${BLUE}http://localhost:8000${NC}"
else
    echo -e "${YELLOW}⚠️  Services partiellement démarrés ($services_running/3)${NC}"
fi

echo
echo -e "${CYAN}💡 Commandes utiles:${NC}"
echo -e "   ${BLUE}./start-all.sh${NC}           - Démarrer tous les services"
echo -e "   ${BLUE}./kill-all-meeshy.sh${NC}     - Arrêter tous les processus Meeshy"
echo -e "   ${BLUE}./check-meeshy.sh${NC}        - Vérifier l'état des services"
