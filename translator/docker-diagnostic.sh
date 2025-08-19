#!/bin/bash

# Script de diagnostic pour le service de traduction Meeshy dans Docker
# Identifie les problèmes courants avec les modèles ML

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 [DOCKER] Diagnostic du service de traduction Meeshy${NC}"
echo "=============================================="

# Variables
CONTAINER_NAME="translator"
MODELS_PATH="/app/models"

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

# 1. Vérifier que le conteneur est en cours d'exécution
echo -e "${BLUE}📋 Vérification du conteneur...${NC}"
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    error "Le conteneur $CONTAINER_NAME n'est pas en cours d'exécution"
    echo "Démarrage du conteneur..."
    docker-compose up -d translator
    sleep 10
fi

log "Conteneur $CONTAINER_NAME est en cours d'exécution"

# 2. Vérifier l'état de santé du conteneur
echo -e "${BLUE}🏥 Vérification de l'état de santé...${NC}"
HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null || echo "unknown")

if [ "$HEALTH_STATUS" = "healthy" ]; then
    log "Conteneur en bonne santé"
elif [ "$HEALTH_STATUS" = "starting" ]; then
    warn "Conteneur en cours de démarrage (peut prendre plusieurs minutes pour les modèles ML)"
else
    error "Conteneur en mauvais état: $HEALTH_STATUS"
fi

# 3. Vérifier les logs récents
echo -e "${BLUE}📝 Analyse des logs récents...${NC}"
echo "--- Derniers logs (50 lignes) ---"
docker logs --tail=50 $CONTAINER_NAME

# 4. Vérifier l'utilisation des ressources
echo -e "${BLUE}💾 Vérification des ressources...${NC}"
docker stats --no-stream $CONTAINER_NAME

# 5. Vérifier l'espace disque
echo -e "${BLUE}💿 Vérification de l'espace disque...${NC}"
docker exec $CONTAINER_NAME df -h /app/models 2>/dev/null || warn "Impossible de vérifier l'espace disque"

# 6. Vérifier les modèles ML
echo -e "${BLUE}🤖 Vérification des modèles ML...${NC}"
MODELS_COUNT=$(docker exec $CONTAINER_NAME find $MODELS_PATH -name "*.bin" -o -name "*.safetensors" 2>/dev/null | wc -l || echo "0")

if [ "$MODELS_COUNT" -gt 0 ]; then
    log "Modèles trouvés: $MODELS_COUNT"
    echo "--- Modèles disponibles ---"
    docker exec $CONTAINER_NAME find $MODELS_PATH -name "*.bin" -o -name "*.safetensors" 2>/dev/null | head -10
else
    warn "Aucun modèle ML trouvé dans $MODELS_PATH"
fi

# 7. Test de connectivité API
echo -e "${BLUE}🌐 Test de connectivité API...${NC}"
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    log "API FastAPI accessible"
else
    error "API FastAPI inaccessible"
fi

# 8. Test de connectivité ZMQ
echo -e "${BLUE}🔌 Test de connectivité ZMQ...${NC}"
if docker exec $CONTAINER_NAME python3 -c "import zmq; print('ZMQ disponible')" 2>/dev/null; then
    log "ZMQ disponible dans le conteneur"
else
    error "ZMQ non disponible dans le conteneur"
fi

# 9. Vérifier les variables d'environnement
echo -e "${BLUE}⚙️ Vérification des variables d'environnement...${NC}"
docker exec $CONTAINER_NAME env | grep -E "(ML_|MODEL_|DEVICE|TORCH)" | sort

# 10. Test de traduction simple
echo -e "${BLUE}🔄 Test de traduction simple...${NC}"
TEST_RESPONSE=$(curl -s -X POST "http://localhost:8000/translate" \
    -H "Content-Type: application/json" \
    -d '{"text":"Hello world","source_language":"en","target_language":"fr","model_type":"basic"}' \
    --max-time 30 2>/dev/null || echo "timeout")

if echo "$TEST_RESPONSE" | grep -q "translated_text"; then
    log "Test de traduction réussi"
    echo "Réponse: $TEST_RESPONSE"
else
    error "Test de traduction échoué"
    echo "Réponse: $TEST_RESPONSE"
fi

# 11. Recommandations
echo -e "${BLUE}💡 Recommandations...${NC}"

# Vérifier la mémoire disponible
MEMORY_LIMIT=$(docker inspect --format='{{.HostConfig.Memory}}' $CONTAINER_NAME 2>/dev/null || echo "0")
if [ "$MEMORY_LIMIT" -lt 8589934592 ]; then  # 8GB
    warn "Recommandation: Augmenter la limite de mémoire à au moins 8GB pour les modèles ML"
fi

# Vérifier les CPUs
CPU_LIMIT=$(docker inspect --format='{{.HostConfig.CpuCount}}' $CONTAINER_NAME 2>/dev/null || echo "0")
if [ "$CPU_LIMIT" -lt 4 ]; then
    warn "Recommandation: Allouer au moins 4 CPUs pour les performances ML"
fi

# Vérifier le temps de démarrage
START_TIME=$(docker inspect --format='{{.State.StartedAt}}' $CONTAINER_NAME 2>/dev/null)
if [ -n "$START_TIME" ]; then
    log "Conteneur démarré le: $START_TIME"
fi

echo -e "${GREEN}✅ Diagnostic terminé${NC}"
echo ""
echo -e "${BLUE}🔧 Solutions courantes:${NC}"
echo "1. Augmenter la mémoire Docker (8GB minimum)"
echo "2. Augmenter les CPUs (4 minimum)"
echo "3. Vérifier que les modèles sont téléchargés"
echo "4. Redémarrer le conteneur: docker-compose restart translator"
echo "5. Vérifier les logs: docker logs -f translator"
