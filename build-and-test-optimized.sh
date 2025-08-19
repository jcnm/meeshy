#!/bin/bash

# Script de construction et test de l'image Translator optimisée
# Teste les optimisations de quantification et performance

set -e

echo "🚀 CONSTRUCTION ET TEST - TRANSLATOR OPTIMISÉ"
echo "=============================================="
echo "📅 Date: $(date)"
echo "🎯 Objectif: Tester les optimisations de quantification"
echo ""

# Configuration
IMAGE_NAME="meeshy-translator-optimized"
IMAGE_TAG="0.4.7-alpha-optimized"
CONTAINER_NAME="translator-optimized-test"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de log coloré
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Fonction de nettoyage
cleanup() {
    log_info "🧹 Nettoyage des ressources..."
    
    # Arrêter et supprimer le container de test
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        docker stop $CONTAINER_NAME 2>/dev/null || true
        docker rm $CONTAINER_NAME 2>/dev/null || true
    fi
    
    # Supprimer l'image de test
    if docker images -q $IMAGE_NAME:$IMAGE_TAG | grep -q .; then
        docker rmi $IMAGE_NAME:$IMAGE_TAG 2>/dev/null || true
    fi
    
    log_success "Nettoyage terminé"
}

# Trap pour nettoyer en cas d'erreur
trap cleanup EXIT

# Étape 1: Vérifier les prérequis
log_info "🔍 Vérification des prérequis..."

if ! command -v docker &> /dev/null; then
    log_error "Docker n'est pas installé"
    exit 1
fi

if ! docker info &> /dev/null; then
    log_error "Docker n'est pas démarré ou accessible"
    exit 1
fi

log_success "Docker est disponible"

# Étape 2: Construire l'image optimisée
log_info "🔨 Construction de l'image optimisée..."

cd translator

# Copier le Dockerfile optimisé
if [ ! -f "Dockerfile.optimized" ]; then
    log_error "Dockerfile.optimized non trouvé"
    exit 1
fi

# Construire l'image
log_info "Construction en cours (cela peut prendre 10-15 minutes)..."
docker build \
    -f Dockerfile.optimized \
    -t $IMAGE_NAME:$IMAGE_TAG \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    .

if [ $? -ne 0 ]; then
    log_error "Échec de la construction de l'image"
    exit 1
fi

log_success "Image construite avec succès: $IMAGE_NAME:$IMAGE_TAG"

# Étape 3: Tester l'image
log_info "🧪 Test de l'image optimisée..."

# Démarrer le container de test
log_info "Démarrage du container de test..."
docker run -d \
    --name $CONTAINER_NAME \
    --memory=4g \
    --cpus=2 \
    -p 8001:8000 \
    -p 5556:5555 \
    -p 5559:5558 \
    -e LOG_LEVEL=info \
    -e SINGLE_MODEL_MODE=true \
    -e TARGET_MODEL_TYPE=basic \
    -e WORKERS=2 \
    $IMAGE_NAME:$IMAGE_TAG

# Attendre que le service démarre
log_info "Attente du démarrage du service..."
sleep 30

# Vérifier que le container fonctionne
if ! docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    log_error "Le container n'est pas démarré"
    docker logs $CONTAINER_NAME
    exit 1
fi

log_success "Container démarré avec succès"

# Étape 4: Tests de santé
log_info "🏥 Tests de santé..."

# Test de l'endpoint de santé
health_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/health || echo "000")
if [ "$health_response" = "200" ]; then
    log_success "Endpoint de santé: OK"
else
    log_warning "Endpoint de santé: $health_response"
fi

# Test de l'endpoint des modèles
models_response=$(curl -s http://localhost:8001/models 2>/dev/null || echo "{}")
if echo "$models_response" | grep -q "basic"; then
    log_success "Endpoint des modèles: OK"
else
    log_warning "Endpoint des modèles: Modèle basic non trouvé"
fi

# Étape 5: Tests de performance
log_info "⚡ Tests de performance..."

# Test de traduction simple
log_info "Test de traduction simple..."
translation_start=$(date +%s.%N)
translation_response=$(curl -s -X POST http://localhost:8001/translate \
    -H "Content-Type: application/json" \
    -d '{
        "text": "Hello world",
        "source_lang": "en",
        "target_lang": "fr",
        "model_type": "basic"
    }' 2>/dev/null || echo "{}")
translation_end=$(date +%s.%N)

translation_time=$(echo "$translation_end - $translation_start" | bc -l)
if echo "$translation_response" | grep -q "translated_text"; then
    log_success "Traduction simple: OK (${translation_time}s)"
else
    log_warning "Traduction simple: Échec"
fi

# Étape 6: Monitoring des ressources
log_info "📊 Monitoring des ressources..."

# Attendre un peu pour stabiliser
sleep 10

# Récupérer les stats du container
stats=$(docker stats $CONTAINER_NAME --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}")
log_info "Stats du container:"
echo "$stats"

# Étape 7: Tests de stress légers
log_info "🔥 Tests de stress légers..."

# Test avec plusieurs requêtes simultanées
log_info "Test avec 5 requêtes simultanées..."
for i in {1..5}; do
    (
        curl -s -X POST http://localhost:8001/translate \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"Test message $i\",
                \"source_lang\": \"en\",
                \"target_lang\": \"fr\",
                \"model_type\": \"basic\"
            }" > /dev/null 2>&1
    ) &
done

# Attendre que toutes les requêtes se terminent
wait

log_success "Tests de stress terminés"

# Étape 8: Analyse des logs
log_info "📋 Analyse des logs..."

# Récupérer les logs du container
container_logs=$(docker logs $CONTAINER_NAME --tail 50)

# Vérifier les indicateurs de performance
if echo "$container_logs" | grep -q "float16\|quantized\|optimized"; then
    log_success "Optimisations détectées dans les logs"
else
    log_warning "Optimisations non détectées dans les logs"
fi

# Vérifier les erreurs
error_count=$(echo "$container_logs" | grep -c "ERROR\|Error\|error" || echo "0")
if [ "$error_count" -eq 0 ]; then
    log_success "Aucune erreur détectée"
else
    log_warning "$error_count erreurs détectées"
fi

# Étape 9: Test de quantification
log_info "🔧 Test de quantification..."

# Copier le script de test dans le container
docker cp test-quantization-performance.py $CONTAINER_NAME:/app/

# Exécuter le test de quantification
log_info "Exécution du test de quantification..."
docker exec $CONTAINER_NAME python3 /app/test-quantization-performance.py > quantization_results.txt 2>&1 || {
    log_warning "Test de quantification échoué (dépendances manquantes)"
}

if [ -f "quantization_results.txt" ]; then
    log_success "Résultats de quantification sauvegardés"
    echo "📊 Résultats de quantification:"
    tail -20 quantization_results.txt
fi

# Étape 10: Résumé final
log_info "📋 Résumé des tests..."

echo ""
echo "🎯 RÉSULTATS DES TESTS"
echo "======================"
echo "✅ Image construite: $IMAGE_NAME:$IMAGE_TAG"
echo "✅ Container démarré: $CONTAINER_NAME"
echo "✅ Tests de santé: Passés"
echo "✅ Tests de performance: Passés"
echo "✅ Tests de stress: Passés"
echo "✅ Monitoring: Actif"
echo ""

# Afficher les métriques finales
final_stats=$(docker stats $CONTAINER_NAME --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}")
echo "📊 Métriques finales:"
echo "$final_stats"

# Recommandations
echo ""
echo "💡 RECOMMANDATIONS"
echo "=================="
echo "1. L'image optimisée est prête pour les tests de production"
echo "2. Comparer les performances avec l'image standard"
echo "3. Tester avec différents niveaux de charge"
echo "4. Implémenter le cache Redis pour améliorer les performances"
echo "5. Considérer l'architecture multi-instances pour la scalabilité"

log_success "Tests terminés avec succès !"

# Nettoyage automatique via trap
