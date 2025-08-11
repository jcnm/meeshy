#!/bin/bash

# Script de diagnostic des services Meeshy
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}🔍 [DIAGNOSTIC] Diagnostic des services Meeshy${NC}"
echo "================================================="

# Fonction pour vérifier si un port est ouvert
check_port() {
    local port=$1
    local service=$2
    if lsof -i :$port >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Port $port ($service) - OUVERT${NC}"
        return 0
    else
        echo -e "${RED}❌ Port $port ($service) - FERMÉ${NC}"
        return 1
    fi
}

# Fonction pour vérifier un processus
check_process() {
    local pattern=$1
    local service=$2
    if pgrep -f "$pattern" >/dev/null; then
        local pids=$(pgrep -f "$pattern")
        echo -e "${GREEN}✅ $service - ACTIF (PID: $pids)${NC}"
        return 0
    else
        echo -e "${RED}❌ $service - INACTIF${NC}"
        return 1
    fi
}

# 1. VÉRIFICATION DES PROCESSUS
echo -e "${CYAN}📊 [DIAGNOSTIC] Vérification des processus...${NC}"
echo "-------------------------------------------------"

translator_running=false
gateway_running=false

# Vérifier le traducteur Python
if check_process "start_service.py" "Traducteur Python"; then
    translator_running=true
fi

# Vérifier la gateway Node.js
if check_process "pnpm run dev" "Gateway Node.js"; then
    gateway_running=true
fi

# Vérifier les processus Node.js génériques
if check_process "node.*gateway" "Processus Node.js Gateway"; then
    gateway_running=true
fi

echo ""

# 2. VÉRIFICATION DES PORTS
echo -e "${CYAN}🔌 [DIAGNOSTIC] Vérification des ports...${NC}"
echo "-------------------------------------------------"

ports_status=0

# Ports du traducteur
check_port 8000 "API Traducteur (FastAPI)" || ports_status=1
check_port 5555 "ZMQ SUB (Traducteur)" || ports_status=1
check_port 5556 "ZMQ PUB (Traducteur)" || ports_status=1

# Ports de la gateway
check_port 3000 "Gateway (Fastify)" || ports_status=1
check_port 5557 "ZMQ SUB (Gateway)" || ports_status=1
check_port 5558 "ZMQ PUB (Gateway)" || ports_status=1

echo ""

# 3. VÉRIFICATION DES CONNEXIONS ZMQ
echo -e "${CYAN}🔌 [DIAGNOSTIC] Test des connexions ZMQ...${NC}"
echo "-------------------------------------------------"

# Test de connexion ZMQ simple
test_zmq_connection() {
    local port=$1
    local type=$2
    
    if command -v nc >/dev/null 2>&1; then
        if echo "test" | nc -w 1 localhost $port >/dev/null 2>&1; then
            echo -e "${GREEN}✅ ZMQ $type (port $port) - CONNEXION OK${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  ZMQ $type (port $port) - CONNEXION ÉCHOUÉE${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  ZMQ $type (port $port) - NC non disponible${NC}"
        return 1
    fi
}

test_zmq_connection 5555 "SUB (Traducteur)" || true
test_zmq_connection 5556 "PUB (Traducteur)" || true
test_zmq_connection 5557 "SUB (Gateway)" || true
test_zmq_connection 5558 "PUB (Gateway)" || true

echo ""

# 4. VÉRIFICATION DES FICHIERS DE CONFIGURATION
echo -e "${CYAN}📁 [DIAGNOSTIC] Vérification des fichiers...${NC}"
echo "-------------------------------------------------"

# Vérifier les fichiers essentiels
files_to_check=(
    "translator/requirements.txt:Requirements Python"
    "translator/src/main.py:Main Python"
    "translator/.venv/bin/python:Environnement virtuel"
    "gateway/package.json:Package.json Gateway"
    "gateway/src/server.ts:Server Gateway"
    "shared/schema.prisma:Schema Prisma"
)

for file_info in "${files_to_check[@]}"; do
    IFS=':' read -r file_path description <<< "$file_info"
    if [[ -f "$file_path" ]]; then
        echo -e "${GREEN}✅ $description - PRÉSENT${NC}"
    else
        echo -e "${RED}❌ $description - MANQUANT${NC}"
    fi
done

echo ""

# 5. VÉRIFICATION DES DÉPENDANCES
echo -e "${CYAN}📦 [DIAGNOSTIC] Vérification des dépendances...${NC}"
echo "-------------------------------------------------"

# Vérifier Python
if command -v python3 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Python3 - $(python3 --version)${NC}"
else
    echo -e "${RED}❌ Python3 - NON INSTALLÉ${NC}"
fi

# Vérifier Node.js
if command -v node >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Node.js - $(node --version)${NC}"
else
    echo -e "${RED}❌ Node.js - NON INSTALLÉ${NC}"
fi

# Vérifier pnpm
if command -v pnpm >/dev/null 2>&1; then
    echo -e "${GREEN}✅ pnpm - $(pnpm --version)${NC}"
else
    echo -e "${RED}❌ pnpm - NON INSTALLÉ${NC}"
fi

# Vérifier Prisma
if command -v prisma >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Prisma CLI - INSTALLÉ${NC}"
else
    echo -e "${YELLOW}⚠️  Prisma CLI - NON INSTALLÉ${NC}"
fi

echo ""

# 6. RÉSUMÉ ET RECOMMANDATIONS
echo -e "${CYAN}📋 [DIAGNOSTIC] Résumé et recommandations...${NC}"
echo "-------------------------------------------------"

if [[ "$translator_running" == true && "$gateway_running" == true && $ports_status -eq 0 ]]; then
    echo -e "${GREEN}🎉 [DIAGNOSTIC] Tous les services fonctionnent correctement !${NC}"
    echo -e "${BLUE}💡 [DIAGNOSTIC] Vous pouvez accéder à:${NC}"
    echo "   🌐 Gateway: http://localhost:3000"
    echo "   🐍 Traducteur: http://localhost:8000"
    echo "   📡 WebSocket: ws://localhost:3000/ws"
else
    echo -e "${YELLOW}⚠️  [DIAGNOSTIC] Problèmes détectés:${NC}"
    
    if [[ "$translator_running" == false ]]; then
        echo -e "${RED}   ❌ Le traducteur n'est pas démarré${NC}"
        echo -e "${BLUE}   💡 Solution: ./start_meeshy_services.sh${NC}"
    fi
    
    if [[ "$gateway_running" == false ]]; then
        echo -e "${RED}   ❌ La gateway n'est pas démarrée${NC}"
        echo -e "${BLUE}   💡 Solution: ./start_meeshy_services.sh${NC}"
    fi
    
    if [[ $ports_status -ne 0 ]]; then
        echo -e "${RED}   ❌ Certains ports sont fermés${NC}"
        echo -e "${BLUE}   💡 Vérifiez que les services sont démarrés${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}🔧 [DIAGNOSTIC] Actions recommandées:${NC}"
    echo "   1. Arrêter tous les processus existants"
    echo "   2. Exécuter: ./start_meeshy_services.sh"
    echo "   3. Attendre que tous les services soient démarrés"
    echo "   4. Relancer ce diagnostic"
fi

echo ""
echo -e "${BLUE}=================================================${NC}"
