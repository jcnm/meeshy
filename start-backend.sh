#!/bin/bash

# ===== DÉMARRAGE RAPIDE MEESHY AVEC BACKEND REFACTORÉ =====

set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Démarrage de Meeshy avec Backend Fastify Refactoré${NC}"
echo "=============================================================="

# Vérifier si Docker est en cours d'exécution
if ! docker info &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker n'est pas en cours d'exécution. Veuillez le démarrer.${NC}"
    exit 1
fi

# Arrêter les services existants
echo -e "${BLUE}🛑 Arrêt des services existants...${NC}"
./docker-manage.sh stop

# Construire et démarrer les services
echo -e "${BLUE}🔨 Construction et démarrage des services...${NC}"
./docker-manage.sh start

# Attendre que les services soient prêts
echo -e "${BLUE}⏳ Attente du démarrage des services...${NC}"
sleep 30

# Vérifier la santé des services
echo -e "${BLUE}🏥 Vérification de la santé des services...${NC}"
./docker-manage.sh health

echo ""
echo -e "${GREEN}✅ Meeshy est maintenant en cours d'exécution !${NC}"
echo ""
echo "🔗 Services disponibles :"
echo "   • Frontend Next.js: http://localhost:3000"
echo "   • Backend Fastify: http://localhost:3001"
echo "   • API Health Check: http://localhost:3001/health"
echo "   • WebSocket: ws://localhost:3001/ws"
echo "   • Nginx Proxy: http://localhost:80"
echo "   • Grafana: http://localhost:3003 (admin/admin)"
echo "   • Prometheus: http://localhost:9090"
echo ""
echo "📋 Commandes utiles :"
echo "   • Voir les logs: ./docker-manage.sh logs"
echo "   • Status: ./docker-manage.sh status"
echo "   • Arrêter: ./docker-manage.sh stop"
echo "   • Test complet: ./test-integration.sh"
