#!/bin/bash

# Script pour tuer tous les processus Meeshy en cours
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}🛑 Arrêt de tous les processus Meeshy...${NC}"

# Fonction pour tuer les processus avec un pattern
kill_processes() {
    pattern="$1"
    description="$2"
    
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [[ ! -z "$pids" ]]; then
        echo -e "${BLUE}   Arrêt des processus $description...${NC}"
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 1
        # Forcer si nécessaire
        remaining_pids=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [[ ! -z "$remaining_pids" ]]; then
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
        fi
    fi
}

# Tuer les processus Frontend (Next.js)
kill_processes "next dev.*turbopack" "Frontend Next.js"
kill_processes "next-server" "Next.js Server"
kill_processes "meeshy-frontend" "Frontend Meeshy"
kill_processes "frontend.sh" "Script Frontend"

# Tuer les processus Gateway (Fastify/TSX)
kill_processes "tsx.*watch.*src/server.ts" "Gateway TSX"
kill_processes "node.*tsx.*gateway" "Gateway Node.js"
kill_processes "fastify.*gateway" "Gateway Fastify"
kill_processes "gateway.sh" "Script Gateway"
kill_processes "pnpm run dev.*gateway" "Gateway Dev"

# Tuer les processus Translator (Python/FastAPI)
kill_processes "start_service.py" "Translator Python"
kill_processes "uvicorn.*translator" "Translator Uvicorn"
kill_processes "python.*translator" "Translator Service"
kill_processes "translator.sh" "Script Translator"

# Tuer les scripts de démarrage
kill_processes "start-all.sh" "Script Start All"
kill_processes "start_meeshy_services.sh" "Script Start Services"
kill_processes "start_services_simple.sh" "Script Start Simple"

# Nettoyer les ports utilisés par Meeshy
echo -e "${BLUE}   Nettoyage des ports Meeshy...${NC}"

# Ports principaux
for port in 3000 3100 8000 5555 5558; do
    pids=$(lsof -ti:$port 2>/dev/null || true)
    if [[ ! -z "$pids" ]]; then
        echo -e "${BLUE}     Port $port...${NC}"
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 1
        # Forcer si nécessaire
        remaining_pids=$(lsof -ti:$port 2>/dev/null || true)
        if [[ ! -z "$remaining_pids" ]]; then
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
        fi
    fi
done

# Attendre que tout se termine
sleep 2

# Vérification finale
echo -e "${BLUE}🔍 Vérification finale...${NC}"

remaining_processes=""

# Vérifier s'il reste des processus
if pgrep -f "tsx.*watch.*src/server.ts" >/dev/null 2>&1; then
    remaining_processes+="Gateway TSX, "
fi

if pgrep -f "start_service.py" >/dev/null 2>&1; then
    remaining_processes+="Translator Python, "
fi

if pgrep -f "next dev.*turbopack" >/dev/null 2>&1; then
    remaining_processes+="Frontend Next.js, "
fi

# Vérifier les ports
for port in 3000 3100 8000; do
    if lsof -ti:$port >/dev/null 2>&1; then
        remaining_processes+="Port $port, "
    fi
done

if [[ ! -z "$remaining_processes" ]]; then
    remaining_processes=${remaining_processes%, }  # Enlever la dernière virgule
    echo -e "${YELLOW}⚠️  Processus encore actifs: $remaining_processes${NC}"
    echo -e "${YELLOW}💡 Utilisez 'ps aux | grep -E \"(tsx|start_service|next)\"' pour plus de détails${NC}"
else
    echo -e "${GREEN}✅ Tous les processus Meeshy ont été arrêtés${NC}"
fi

echo -e "${GREEN}🎉 Nettoyage terminé !${NC}"