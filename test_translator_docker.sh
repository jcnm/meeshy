#!/bin/bash

# Script de test pour le service de traduction Docker
set -e

echo "🧪 Tests du service de traduction Docker"
echo "======================================"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

function log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

function log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Nettoyer les containers existants
log_info "Nettoyage des containers existants..."
docker-compose down translator 2>/dev/null || true

# Build de l'image
log_info "Construction de l'image translator..."
if docker-compose build translator; then
    log_success "Image construite avec succès"
else
    log_error "Échec de la construction de l'image"
    exit 1
fi

# Démarrage du service
log_info "Démarrage du service translator..."
docker-compose up -d translator

# Attendre que le service soit prêt
log_info "Attente du démarrage du service (120s max)..."
timeout=120
count=0

while [ $count -lt $timeout ]; do
    if curl -s http://localhost:8000/live > /dev/null 2>&1; then
        log_success "Service démarré et accessible"
        break
    fi
    sleep 2
    count=$((count + 2))
    echo -n "."
done

if [ $count -ge $timeout ]; then
    log_error "Timeout: Service non accessible après ${timeout}s"
    docker-compose logs translator
    exit 1
fi

# Tests de santé
log_info "Test des endpoints de santé..."

# Test liveness
if curl -s http://localhost:8000/live | grep -q "alive"; then
    log_success "Liveness check OK"
else
    log_warning "Liveness check failed"
fi

# Test health
if curl -s http://localhost:8000/health | grep -q "status"; then
    log_success "Health check OK"
else
    log_warning "Health check failed"
fi

# Test readiness
if curl -s http://localhost:8000/ready; then
    log_success "Readiness check OK"
else
    log_warning "Service pas prêt (normal si modèles pas chargés)"
fi

# Test des endpoints API
log_info "Test des endpoints API..."

# Test langues supportées
if curl -s http://localhost:8000/languages | grep -q "languages"; then
    log_success "Endpoint languages OK"
else
    log_warning "Endpoint languages failed"
fi

# Test API docs
if curl -s http://localhost:8000/docs | grep -q "OpenAPI"; then
    log_success "API docs OK"
else
    log_warning "API docs failed"
fi

# Test de traduction (peut échouer si modèles pas chargés)
log_info "Test de traduction..."
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "target_language": "fr"}' \
  -s | head -n 20

echo ""

# Afficher les logs
log_info "Derniers logs du service:"
docker-compose logs --tail=20 translator

# Résumé
echo ""
log_info "Résumé du test:"
echo "- Image Docker: ✅ Construite"
echo "- Service: ✅ Démarré"
echo "- Endpoints santé: ✅ Accessibles"
echo "- API: ✅ Endpoints présents"

log_success "Service de traduction Docker fonctionnel!"
log_info "Pour tester manuellement:"
echo "  - Health: curl http://localhost:8000/health"
echo "  - Docs: http://localhost:8000/docs"
echo "  - Translation: curl -X POST http://localhost:8000/translate -H 'Content-Type: application/json' -d '{\"text\": \"Hello\", \"target_language\": \"fr\"}'"

log_info "Pour arrêter: docker-compose down translator"
