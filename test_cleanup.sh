#!/bin/bash

# Script de test pour vérifier le nettoyage des processus
set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🧪 Test du nettoyage des processus Meeshy${NC}"
echo "============================================="

# Fonction pour vérifier si des processus sont actifs sur les ports Meeshy
check_meeshy_processes() {
    local processes_found=0
    
    echo -e "${YELLOW}🔍 Vérification des processus sur les ports Meeshy...${NC}"
    
    # Vérifier les ports un par un
    for port in 3000 3100 8000 5555 5558; do
        if lsof -ti:$port 2>/dev/null; then
            echo -e "${RED}❌ Processus trouvé sur le port $port:${NC}"
            lsof -i:$port 2>/dev/null || true
            processes_found=1
        else
            echo -e "${GREEN}✅ Port $port libre${NC}"
        fi
    done
    
    return $processes_found
}

# Vérification initiale
echo -e "${BLUE}📊 État initial:${NC}"
check_meeshy_processes

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Aucun processus Meeshy détecté${NC}"
else
    echo -e "${YELLOW}⚠️  Des processus Meeshy sont déjà actifs${NC}"
    echo -e "${YELLOW}🧹 Nettoyage préalable...${NC}"
    
    # Nettoyage préalable
    for port in 3000 3100 8000 5555 5558; do
        lsof -ti:$port 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    done
    
    sleep 3
    
    # Forcer l'arrêt si nécessaire
    for port in 3000 3100 8000 5555 5558; do
        lsof -ti:$port 2>/dev/null | xargs kill -KILL 2>/dev/null || true
    done
    
    echo -e "${GREEN}✅ Nettoyage préalable terminé${NC}"
fi

echo ""
echo -e "${BLUE}🎯 Instructions de test:${NC}"
echo "1. Démarrez un des scripts (start-all.sh ou start_services_simple.sh)"
echo "2. Attendez que les services se lancent"
echo "3. Appuyez sur Ctrl+C pour tester l'arrêt"
echo "4. Lancez ce script pour vérifier le nettoyage"
echo ""
echo -e "${YELLOW}💡 Exemple:${NC}"
echo "   ./start_services_simple.sh"
echo "   # Appuyez sur Ctrl+C après quelques secondes"
echo "   ./test_cleanup.sh"
