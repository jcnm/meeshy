#!/bin/bash

# Script de redémarrage optimisé pour le service de traduction Meeshy
# Inclut des optimisations pour les modèles ML

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 [DOCKER] Redémarrage optimisé du service de traduction Meeshy${NC}"
echo "=============================================="

# Variables
CONTAINER_NAME="translator"
SERVICE_NAME="translator"

# Fonction de log
log() {
    echo -e "${GREEN}✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. Arrêt propre du service
echo -e "${BLUE}🛑 Arrêt du service de traduction...${NC}"
if docker ps | grep -q "$CONTAINER_NAME"; then
    log "Arrêt du conteneur $CONTAINER_NAME"
    docker stop $CONTAINER_NAME
    sleep 5
else
    warn "Conteneur $CONTAINER_NAME non trouvé (déjà arrêté)"
fi

# 2. Nettoyage des ressources
echo -e "${BLUE}🧹 Nettoyage des ressources...${NC}"
docker system prune -f --volumes=false
log "Nettoyage des ressources terminé"

# 3. Vérification de la configuration Docker
echo -e "${BLUE}⚙️ Vérification de la configuration...${NC}"
if [ ! -f "docker-compose.yml" ]; then
    error "docker-compose.yml non trouvé"
    exit 1
fi

# 4. Redémarrage avec optimisations
echo -e "${BLUE}🚀 Redémarrage du service avec optimisations...${NC}"
docker-compose up -d $SERVICE_NAME

# 5. Attendre le démarrage
echo -e "${BLUE}⏳ Attente du démarrage (peut prendre plusieurs minutes pour les modèles ML)...${NC}"
sleep 30

# 6. Vérification de l'état
echo -e "${BLUE}🔍 Vérification de l'état du service...${NC}"
for i in {1..12}; do
    if docker ps | grep -q "$CONTAINER_NAME" && docker logs --tail=10 $CONTAINER_NAME 2>/dev/null | grep -q "✅"; then
        log "Service démarré avec succès"
        break
    else
        warn "Attente... ($i/12)"
        sleep 30
    fi
done

# 7. Test de connectivité
echo -e "${BLUE}🌐 Test de connectivité...${NC}"
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    log "API accessible"
else
    warn "API non encore accessible (normal pendant le chargement des modèles)"
fi

# 8. Affichage des logs récents
echo -e "${BLUE}📝 Logs récents...${NC}"
docker logs --tail=20 $CONTAINER_NAME

# 9. Informations finales
echo -e "${GREEN}✅ Redémarrage terminé${NC}"
echo ""
echo -e "${BLUE}💡 Informations importantes:${NC}"
echo "• Le chargement des modèles ML peut prendre 2-5 minutes"
echo "• Surveillez les logs: docker logs -f $CONTAINER_NAME"
echo "• Test de traduction: curl -X POST http://localhost:8000/translate -H 'Content-Type: application/json' -d '{\"text\":\"Hello\",\"source_language\":\"en\",\"target_language\":\"fr\",\"model_type\":\"basic\"}'"
echo "• Diagnostic complet: ./docker-diagnostic.sh"

# 10. Monitoring optionnel
read -p "Voulez-vous surveiller les logs en temps réel? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}📺 Surveillance des logs...${NC}"
    docker logs -f $CONTAINER_NAME
fi
