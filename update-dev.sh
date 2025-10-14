#!/bin/bash

# Script de mise à jour automatique pour Meeshy
# Télécharge les dernières images et redémarre les services

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        MEESHY - Mise à Jour Automatique                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Fonction pour afficher les messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    log_error "Docker n'est pas en cours d'exécution"
    exit 1
fi

# Demander confirmation
echo -e "${YELLOW}Cette opération va:${NC}"
echo "  1. Télécharger les dernières images Docker"
echo "  2. Arrêter les services actuels"
echo "  3. Redémarrer avec les nouvelles images"
echo ""
read -p "Voulez-vous continuer ? (oui/non): " confirm

if [ "$confirm" != "oui" ]; then
    log_warning "Mise à jour annulée"
    exit 0
fi

echo ""
log_info "🚀 Démarrage de la mise à jour..."
echo ""

# Étape 1: Télécharger les dernières images
log_info "📥 Téléchargement des dernières images Docker..."
docker-compose -f docker-compose.dev.yml pull

if [ $? -eq 0 ]; then
    log_success "Images téléchargées avec succès"
else
    log_error "Échec du téléchargement des images"
    exit 1
fi

echo ""

# Étape 2: Arrêter les services
log_info "⏹️  Arrêt des services actuels..."
docker-compose -f docker-compose.dev.yml down

if [ $? -eq 0 ]; then
    log_success "Services arrêtés"
else
    log_error "Échec de l'arrêt des services"
    exit 1
fi

echo ""

# Étape 3: Redémarrer avec les nouvelles images
log_info "🔄 Redémarrage des services avec les nouvelles images..."
docker-compose -f docker-compose.dev.yml --env-file .env.dev up -d

if [ $? -eq 0 ]; then
    log_success "Services redémarrés avec succès"
else
    log_error "Échec du redémarrage des services"
    exit 1
fi

echo ""
log_info "⏳ Attente de la stabilisation des services (30 secondes)..."
sleep 30

echo ""
log_info "🏥 Vérification de la santé des services..."
echo ""

# Vérifier les services
./health-check.sh

if [ $? -eq 0 ]; then
    echo ""
    log_success "✨ Mise à jour terminée avec succès!"
    echo ""
    log_info "📋 Résumé de la mise à jour:"
    echo "   - Nouvelles images téléchargées et déployées"
    echo "   - Tous les services sont opérationnels"
    echo ""
    log_info "📍 URLs d'accès:"
    echo "   - Frontend:        ${GREEN}http://localhost:3100${NC}"
    echo "   - Gateway API:     ${GREEN}http://localhost:3000${NC}"
    echo "   - Translator API:  ${GREEN}http://localhost:8000${NC}"
    echo ""
else
    log_warning "⚠️  Certains services ont des problèmes après la mise à jour"
    echo ""
    log_info "💡 Actions recommandées:"
    echo "   1. Vérifier les logs: ./start-dev.sh logs"
    echo "   2. Redémarrer les services: ./start-dev.sh restart"
    echo ""
fi
