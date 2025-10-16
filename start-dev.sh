#!/bin/bash

# Script de démarrage pour l'environnement de développement local Meeshy
# Exécute les services en mode natif (translator, gateway, frontend)

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PIDs des processus
TRANSLATOR_PID=""
GATEWAY_PID=""
FRONTEND_PID=""

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

# Fonction pour arrêter tous les processus
cleanup() {
    log_warning "Arrêt des services..."
    
    if [ ! -z "$FRONTEND_PID" ]; then
        log_info "Arrêt du frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$GATEWAY_PID" ]; then
        log_info "Arrêt du gateway (PID: $GATEWAY_PID)..."
        kill $GATEWAY_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$TRANSLATOR_PID" ]; then
        log_info "Arrêt du translator (PID: $TRANSLATOR_PID)..."
        kill $TRANSLATOR_PID 2>/dev/null || true
    fi
    
    log_success "Tous les services ont été arrêtés"
    exit 0
}

# Capturer Ctrl+C pour arrêter proprement
trap cleanup SIGINT SIGTERM

# Capturer Ctrl+C pour arrêter proprement
trap cleanup SIGINT SIGTERM

# Vérifier les scripts de démarrage
check_scripts() {
    log_info "Vérification des scripts de démarrage..."
    
    if [ ! -f "translator/translator.sh" ]; then
        log_error "Script translator/translator.sh non trouvé"
        exit 1
    fi
    
    if [ ! -f "gateway/gateway.sh" ]; then
        log_error "Script gateway/gateway.sh non trouvé"
        exit 1
    fi
    
    if [ ! -f "frontend/frontend.sh" ]; then
        log_error "Script frontend/frontend.sh non trouvé"
        exit 1
    fi
    
    # Rendre les scripts exécutables
    chmod +x translator/translator.sh gateway/gateway.sh frontend/frontend.sh
    
    log_success "Tous les scripts sont prêts"
}

# Démarrer les services
start_services() {
    log_info "╔══════════════════════════════════════════════════════════╗"
    log_info "║     MEESHY - Démarrage en Mode Natif (Development)       ║"
    log_info "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    # 1. Démarrer le Translator
    log_info "🚀 Démarrage du service Translator..."
    cd translator
    ./translator.sh > ../logs/translator.log 2>&1 &
    TRANSLATOR_PID=$!
    cd ..
    log_success "Translator démarré (PID: $TRANSLATOR_PID)"
    
    # Attendre que le translator soit prêt
    log_info "Attente du démarrage du translator..."
    sleep 5
    
    # 2. Démarrer le Gateway
    log_info "🚀 Démarrage du service Gateway..."
    cd gateway
    ./gateway.sh > ../logs/gateway.log 2>&1 &
    GATEWAY_PID=$!
    cd ..
    log_success "Gateway démarré (PID: $GATEWAY_PID)"
    
    # Attendre que le gateway soit prêt
    log_info "Attente du démarrage du gateway..."
    sleep 3
    
    # 3. Démarrer le Frontend
    log_info "🚀 Démarrage du service Frontend..."
    cd frontend
    ./frontend.sh > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..
    log_success "Frontend démarré (PID: $FRONTEND_PID)"
    
    echo ""
    log_success "✨ Tous les services ont démarré avec succès!"
    echo ""
    log_info "📍 URLs d'accès:"
    echo "   - Frontend:        ${GREEN}http://localhost:3100${NC}"
    echo "   - Gateway API:     ${GREEN}http://localhost:3000${NC}"
    echo "   - Translator API:  ${GREEN}http://localhost:8000${NC}"
    echo ""
    log_info "📋 PIDs des processus:"
    echo "   - Translator:  ${YELLOW}$TRANSLATOR_PID${NC}"
    echo "   - Gateway:     ${YELLOW}$GATEWAY_PID${NC}"
    echo "   - Frontend:    ${YELLOW}$FRONTEND_PID${NC}"
    echo ""
    log_info "📝 Logs disponibles dans:"
    echo "   - logs/translator.log"
    echo "   - logs/gateway.log"
    echo "   - logs/frontend.log"
    echo ""
    log_info "💡 Appuyez sur ${YELLOW}Ctrl+C${NC} pour arrêter tous les services"
    echo ""
    
    # Attendre indéfiniment (jusqu'à Ctrl+C)
    wait
}

# Créer le répertoire logs si nécessaire
mkdir -p logs

# Vérifier les scripts
check_scripts

# Démarrer les services
start_services
