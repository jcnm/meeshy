#!/bin/bash

# Script de démarrage complet de Meeshy (Translator + Gateway)
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

echo -e "${BLUE}🚀 [MEESHY] Démarrage complet des services Meeshy${NC}"
echo "================================================="

# Variables globales pour les PIDs
GATEWAY_PID=""
TRANSLATOR_PID=""
CLEANUP_CALLED=false

# Fonction de nettoyage améliorée
cleanup() {
    if [[ "$CLEANUP_CALLED" == "true" ]]; then
        return
    fi
    CLEANUP_CALLED=true
    
    echo -e "\n${YELLOW}🛑 [MEESHY] Arrêt des services...${NC}"
    
    # Arrêter la gateway proprement
    if [[ ! -z "$GATEWAY_PID" ]] && kill -0 $GATEWAY_PID 2>/dev/null; then
        echo -e "${YELLOW}🛑 [MEESHY] Arrêt de la gateway (PID: $GATEWAY_PID)...${NC}"
        # Envoyer SIGTERM d'abord
        kill -TERM $GATEWAY_PID 2>/dev/null || true
        sleep 2
        # Si le processus existe encore, forcer l'arrêt
        if kill -0 $GATEWAY_PID 2>/dev/null; then
            echo -e "${YELLOW}⚠️  [MEESHY] Forçage de l'arrêt de la gateway...${NC}"
            kill -KILL $GATEWAY_PID 2>/dev/null || true
        fi
        wait $GATEWAY_PID 2>/dev/null || true
    fi
    
    # Arrêter le traducteur proprement
    if [[ ! -z "$TRANSLATOR_PID" ]] && kill -0 $TRANSLATOR_PID 2>/dev/null; then
        echo -e "${YELLOW}🛑 [MEESHY] Arrêt du traducteur (PID: $TRANSLATOR_PID)...${NC}"
        # Envoyer SIGTERM d'abord
        kill -TERM $TRANSLATOR_PID 2>/dev/null || true
        sleep 2
        # Si le processus existe encore, forcer l'arrêt
        if kill -0 $TRANSLATOR_PID 2>/dev/null; then
            echo -e "${YELLOW}⚠️  [MEESHY] Forçage de l'arrêt du traducteur...${NC}"
            kill -KILL $TRANSLATOR_PID 2>/dev/null || true
        fi
        wait $TRANSLATOR_PID 2>/dev/null || true
    fi
    
    # Nettoyer les processus enfants potentiels
    echo -e "${YELLOW}🧹 [MEESHY] Nettoyage des processus enfants...${NC}"
    
    # Tuer les processus Node.js liés à la gateway avec plus de précision
    pkill -f "tsx.*watch.*src/server.ts" 2>/dev/null || true
    pkill -f "pnpm run dev.*gateway" 2>/dev/null || true
    pkill -f "node.*src/server.ts.*dotenv" 2>/dev/null || true
    pkill -f "fastify.*gateway" 2>/dev/null || true
    pkill -f "gateway.sh" 2>/dev/null || true
    
    # Tuer les processus Python liés au traducteur
    pkill -f "start_service.py" 2>/dev/null || true
    pkill -f "uvicorn.*translator" 2>/dev/null || true
    pkill -f "python.*start_service.py" 2>/dev/null || true
    pkill -f "translator.sh" 2>/dev/null || true
    
    # Tuer tous les processus du script lui-même
    pkill -f "start_meeshy_services.sh" 2>/dev/null || true
    
    # Nettoyer les ports utilisés
    echo -e "${YELLOW}🧹 [MEESHY] Nettoyage des ports...${NC}"
    lsof -ti:3000 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    lsof -ti:8000 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    lsof -ti:5555 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    lsof -ti:5558 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    
    # Attendre un peu pour que les processus se terminent
    sleep 3
    
    # Forcer l'arrêt si nécessaire
    pkill -9 -f "tsx.*watch.*src/server.ts" 2>/dev/null || true
    pkill -9 -f "start_service.py" 2>/dev/null || true
    pkill -9 -f "start_meeshy_services.sh" 2>/dev/null || true
    pkill -9 -f "gateway.sh" 2>/dev/null || true
    pkill -9 -f "translator.sh" 2>/dev/null || true
    
    # Forcer l'arrêt des ports
    lsof -ti:3000 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    lsof -ti:8000 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    lsof -ti:5555 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    lsof -ti:5558 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    
    echo -e "${GREEN}✅ [MEESHY] Tous les services arrêtés proprement${NC}"
    exit 0
}

# Capturer les signaux d'arrêt
trap cleanup SIGINT SIGTERM EXIT

# Fonction pour nettoyer les processus existants
cleanup_existing_processes() {
    echo -e "${YELLOW}🧹 [MEESHY] Vérification des processus existants...${NC}"
    
    # Vérifier et tuer les processus existants
    local gateway_running=$(pgrep -f "tsx watch.*src/server.ts" | wc -l)
    local translator_running=$(pgrep -f "start_service.py" | wc -l)
    
    if [[ $gateway_running -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  [MEESHY] Processus gateway existant détecté, arrêt...${NC}"
        pkill -f "tsx watch.*src/server.ts" 2>/dev/null || true
        sleep 2
    fi
    
    if [[ $translator_running -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  [MEESHY] Processus traducteur existant détecté, arrêt...${NC}"
        pkill -f "start_service.py" 2>/dev/null || true
        sleep 2
    fi
    
    # Nettoyer les processus orphelins
    pkill -f "pnpm run dev" 2>/dev/null || true
    pkill -f "uvicorn.*:8000" 2>/dev/null || true
    
    echo -e "${GREEN}✅ [MEESHY] Nettoyage terminé${NC}"
}

# Nettoyer les processus existants au démarrage
cleanup_existing_processes

# 1. DÉMARRER LE TRADUCTEUR
echo -e "${CYAN}🐍 [MEESHY] Démarrage du traducteur Python...${NC}"
cd translator

# Vérifier si l'environnement virtuel existe
if [[ ! -d ".venv" ]]; then
    echo -e "${YELLOW}🔧 [MEESHY] Création de l'environnement virtuel Python...${NC}"
    python3 -m venv .venv
fi

# Installer les dépendances si nécessaire
if [[ ! -f ".venv/bin/uvicorn" ]]; then
    echo -e "${YELLOW}📦 [MEESHY] Installation des dépendances Python...${NC}"
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install --no-cache-dir prisma python-dotenv
    .venv/bin/pip install --default-timeout=300 --no-cache-dir -r requirements.txt
fi

# Générer le client Prisma si nécessaire
if [[ -f "shared/prisma/schema.prisma" ]]; then
    echo -e "${CYAN}⚙️  [MEESHY] Génération du client Prisma Python...${NC}"
    cp shared/prisma/schema.prisma ./schema.prisma
    .venv/bin/prisma generate || echo -e "${YELLOW}⚠️  [MEESHY] Génération Prisma échouée${NC}"
fi

# Démarrer le traducteur
echo -e "${GREEN}🚀 [MEESHY] Démarrage du service de traduction...${NC}"
.venv/bin/python start_service.py &
TRANSLATOR_PID=$!

# Attendre que le traducteur soit prêt
echo -e "${YELLOW}⏳ [MEESHY] Attente du démarrage du traducteur...${NC}"
sleep 8

# Vérifier si le traducteur fonctionne
if kill -0 $TRANSLATOR_PID 2>/dev/null; then
    echo -e "${GREEN}✅ [MEESHY] Traducteur démarré avec succès (PID: $TRANSLATOR_PID)${NC}"
    echo -e "${BLUE}🌐 [MEESHY] API de traduction disponible sur http://localhost:8000${NC}"
    echo -e "${BLUE}🔌 [MEESHY] ZMQ PUB sur localhost:5556, SUB sur localhost:5555${NC}"
else
    echo -e "${RED}❌ [MEESHY] Échec du démarrage du traducteur${NC}"
    exit 1
fi

cd ..

# 2. DÉMARRER LA GATEWAY
echo -e "${CYAN}🌐 [MEESHY] Démarrage de la gateway...${NC}"
cd gateway

# Vérifier les dépendances Node.js
if [[ ! -d "node_modules" ]]; then
    echo -e "${YELLOW}📦 [MEESHY] Installation des dépendances Node.js...${NC}"
    pnpm install
fi

# Vérifier la génération Prisma
if [[ ! -d "./shared/prisma/client" ]]; then
    echo -e "${YELLOW}🔧 [MEESHY] Génération du client Prisma Node.js...${NC}"
    cd ./shared
    pnpm prisma generate
    cd ..
fi

# Démarrer la gateway
echo -e "${GREEN}🚀 [MEESHY] Démarrage de la gateway...${NC}"
pnpm run dev &
GATEWAY_PID=$!

# Attendre que la gateway soit prête
echo -e "${YELLOW}⏳ [MEESHY] Attente du démarrage de la gateway...${NC}"
sleep 5

# Vérifier si la gateway fonctionne
if kill -0 $GATEWAY_PID 2>/dev/null; then
    echo -e "${GREEN}✅ [MEESHY] Gateway démarrée avec succès (PID: $GATEWAY_PID)${NC}"
    echo -e "${BLUE}🌐 [MEESHY] Gateway disponible sur http://localhost:3000${NC}"
    echo -e "${BLUE}📡 [MEESHY] WebSocket sur ws://localhost:3000/ws${NC}"
else
    echo -e "${RED}❌ [MEESHY] Échec du démarrage de la gateway${NC}"
    exit 1
fi

cd ..

# 3. AFFICHER LE RÉSUMÉ
echo -e "\n${GREEN}🎉 [MEESHY] Tous les services sont démarrés !${NC}"
echo "================================================="
echo -e "${BLUE}📊 [MEESHY] Services actifs:${NC}"
echo "   🐍 Traducteur: http://localhost:8000 (PID: $TRANSLATOR_PID)"
echo "   🌐 Gateway:    http://localhost:3000 (PID: $GATEWAY_PID)"
echo ""
echo -e "${BLUE}🔗 [MEESHY] Endpoints disponibles:${NC}"
echo "   🏥 Health:     http://localhost:3000/health"
echo "   📖 Info:       http://localhost:3000/info"
echo "   🔄 Translate:  http://localhost:3000/translate"
echo "   📡 WebSocket:  ws://localhost:3000/ws"
echo ""
echo -e "${YELLOW}💡 [MEESHY] Utilisez Ctrl+C pour arrêter tous les services${NC}"
echo "================================================="

# Fonction pour surveiller les processus
monitor_processes() {
    while true; do
        # Vérifier si les processus sont toujours en vie
        local gateway_alive=false
        local translator_alive=false
        
        if [[ ! -z "$GATEWAY_PID" ]] && kill -0 $GATEWAY_PID 2>/dev/null; then
            gateway_alive=true
        fi
        
        if [[ ! -z "$TRANSLATOR_PID" ]] && kill -0 $TRANSLATOR_PID 2>/dev/null; then
            translator_alive=true
        fi
        
        # Si un des processus est mort, arrêter l'autre et quitter
        if [[ "$gateway_alive" == "false" ]] || [[ "$translator_alive" == "false" ]]; then
            echo -e "${RED}⚠️  [MEESHY] Un des services s'est arrêté inopinément${NC}"
            if [[ "$gateway_alive" == "false" ]]; then
                echo -e "${RED}❌ [MEESHY] La gateway s'est arrêtée (PID: $GATEWAY_PID)${NC}"
            fi
            if [[ "$translator_alive" == "false" ]]; then
                echo -e "${RED}❌ [MEESHY] Le traducteur s'est arrêté (PID: $TRANSLATOR_PID)${NC}"
            fi
            cleanup
            break
        fi
        
        sleep 5
    done
}

# Attendre la fin des processus ou l'interruption
echo -e "${CYAN}⏳ [MEESHY] En attente de l'arrêt des services (Ctrl+C pour arrêter)...${NC}"

# Boucle d'attente simple
while true; do
    # Vérifier si les processus sont toujours en vie
    gateway_alive=false
    translator_alive=false
    
    if [[ ! -z "$GATEWAY_PID" ]] && kill -0 $GATEWAY_PID 2>/dev/null; then
        gateway_alive=true
    fi
    
    if [[ ! -z "$TRANSLATOR_PID" ]] && kill -0 $TRANSLATOR_PID 2>/dev/null; then
        translator_alive=true
    fi
    
    # Si un des processus est mort, arrêter l'autre et quitter
    if [[ "$gateway_alive" == "false" ]] || [[ "$translator_alive" == "false" ]]; then
        echo -e "${RED}⚠️  [MEESHY] Un des services s'est arrêté inopinément${NC}"
        if [[ "$gateway_alive" == "false" ]]; then
            echo -e "${RED}❌ [MEESHY] La gateway s'est arrêtée (PID: $GATEWAY_PID)${NC}"
        fi
        if [[ "$translator_alive" == "false" ]]; then
            echo -e "${RED}❌ [MEESHY] Le traducteur s'est arrêté (PID: $TRANSLATOR_PID)${NC}"
        fi
        cleanup
        break
    fi
    
    sleep 2
done
