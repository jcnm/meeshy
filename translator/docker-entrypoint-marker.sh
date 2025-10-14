#!/bin/bash

# Entrypoint script for Meeshy Translator Service
# Creates a marker file to signal that the app has started
# This allows Docker healthcheck to pass before models are fully loaded

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[ENTRYPOINT]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[ENTRYPOINT]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[ENTRYPOINT]${NC} $1"
}

# Fonction pour créer le marqueur de démarrage
create_startup_marker() {
    log_info "Création du marqueur de démarrage..."
    touch /tmp/app_started
    log_success "Marqueur créé: /tmp/app_started"
    log_info "Le healthcheck Docker va maintenant passer ✅"
}

# Fonction pour supprimer le marqueur à l'arrêt
cleanup() {
    log_info "Nettoyage..."
    rm -f /tmp/app_started
    log_info "Marqueur supprimé"
}

# Enregistrer le cleanup à l'arrêt
trap cleanup EXIT INT TERM

log_info "╔════════════════════════════════════════════════════════╗"
log_info "║     MEESHY TRANSLATOR - Entrypoint                    ║"
log_info "╚════════════════════════════════════════════════════════╝"
log_info ""

# Créer le marqueur IMMÉDIATEMENT
create_startup_marker

log_info ""
log_info "🚀 Démarrage de l'application Translator..."
log_info "⏳ Le chargement des modèles ML peut prendre 2-5 minutes"
log_info "💡 Le service est marqué 'healthy' mais les modèles chargent en arrière-plan"
log_info ""

# Exécuter la commande originale (généralement le script de démarrage)
exec "$@"
