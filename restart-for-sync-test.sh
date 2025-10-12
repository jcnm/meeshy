#!/bin/bash

# Script pour redémarrer les services et préparer les tests de synchronisation temps réel

echo "======================================"
echo "🔄 Redémarrage pour Test de Sync"
echo "======================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  Ce script va redémarrer le Gateway pour appliquer les changements${NC}"
echo ""
read -p "Continuer? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Annulé."
    exit 0
fi

echo ""
echo -e "${BLUE}1/4 - Arrêt du Gateway...${NC}"
cd gateway
pkill -f "node.*gateway" || true
sleep 2

echo ""
echo -e "${BLUE}2/4 - Installation des dépendances (si nécessaire)...${NC}"
if [ ! -d "node_modules" ]; then
    pnpm install
fi

echo ""
echo -e "${BLUE}3/4 - Compilation TypeScript...${NC}"
pnpm run build || {
    echo -e "${RED}❌ Erreur de compilation!${NC}"
    echo "Vérifiez les erreurs TypeScript ci-dessus."
    exit 1
}

echo ""
echo -e "${BLUE}4/4 - Démarrage du Gateway...${NC}"
pnpm run dev &
GATEWAY_PID=$!

echo ""
echo -e "${GREEN}✅ Gateway démarré (PID: $GATEWAY_PID)${NC}"
echo ""

# Attendre que le Gateway soit prêt
echo "⏳ Attente de la disponibilité du Gateway..."
for i in {1..30}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Gateway est prêt!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Timeout: Le Gateway ne répond pas${NC}"
        exit 1
    fi
    sleep 1
    echo -n "."
done

echo ""
echo ""
echo "======================================"
echo "📊 État des Services"
echo "======================================"
echo ""

# Vérifier le Frontend
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend${NC} - http://localhost:3000"
else
    echo -e "${YELLOW}⚠️  Frontend${NC} - Démarrez avec: cd frontend && pnpm run dev"
fi

# Vérifier le Gateway
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Gateway${NC} - http://localhost:3001"
else
    echo -e "${RED}❌ Gateway${NC} - Non disponible"
fi

# Vérifier Postgres
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL${NC} - localhost:5432"
else
    echo -e "${YELLOW}⚠️  PostgreSQL${NC} - Vérifiez avec: docker-compose ps postgres"
fi

# Vérifier Redis
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis${NC} - localhost:6379"
else
    echo -e "${YELLOW}⚠️  Redis${NC} - Vérifiez avec: docker-compose ps redis"
fi

echo ""
echo "======================================"
echo "🧪 Tests de Synchronisation"
echo "======================================"
echo ""

echo "Pour tester la synchronisation temps réel:"
echo ""
echo "1. Ouvrez 2 navigateurs différents (Chrome + Firefox)"
echo "2. Navigateur A: http://localhost:3000/"
echo "3. Navigateur B: http://localhost:3000/conversations/meeshy"
echo "4. Tapez dans A → Vérifiez que B voit l'indicateur"
echo "5. Envoyez un message dans A → Vérifiez qu'il apparaît dans B"
echo ""

echo "Ou exécutez le script de test:"
echo -e "${BLUE}./tests/test-realtime-sync.sh${NC}"
echo ""

echo "======================================"
echo "📝 Logs en Temps Réel"
echo "======================================"
echo ""

echo "Pour voir les logs du Gateway:"
echo -e "${BLUE}tail -f gateway/gateway.log | grep -E 'TYPING|MESSAGE|CONVERSATION'${NC}"
echo ""

echo "Pour voir les événements WebSocket:"
echo -e "${BLUE}docker-compose logs -f gateway | grep -E 'Socket|Room'${NC}"
echo ""

echo "======================================"
echo "✅ Prêt pour les tests!"
echo "======================================"
echo ""

# Garder le script en vie pour afficher les logs initiaux
echo "Logs Gateway (10 premières secondes):"
echo "--------------------------------------"
sleep 5
tail -n 20 gateway/gateway.log 2>/dev/null || echo "(Logs non disponibles)"
echo ""
echo -e "${GREEN}✅ Configuration terminée!${NC}"

