#!/bin/bash

# Script de nettoyage automatique pour le projet Meeshy
# Usage: ./scripts/maintenance/cleanup.sh

set -e

echo "🧹 Début du nettoyage du projet Meeshy..."

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
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

# Fonction pour supprimer les fichiers avec confirmation
remove_files() {
    local pattern="$1"
    local description="$2"
    
    if find . -name "$pattern" -not -path "./.git/*" | grep -q .; then
        log_info "Suppression des $description..."
        find . -name "$pattern" -not -path "./.git/*" -delete
        log_success "$description supprimés"
    else
        log_info "Aucun $description trouvé"
    fi
}

# Fonction pour supprimer les dossiers avec confirmation
remove_dirs() {
    local pattern="$1"
    local description="$2"
    
    if find . -name "$pattern" -type d -not -path "./.git/*" | grep -q .; then
        log_info "Suppression des $description..."
        find . -name "$pattern" -type d -not -path "./.git/*" -exec rm -rf {} + 2>/dev/null || true
        log_success "$description supprimés"
    else
        log_info "Aucun $description trouvé"
    fi
}

# 1. Fichiers système macOS
log_info "Nettoyage des fichiers système..."
remove_files ".DS_Store" "fichiers .DS_Store"

# 2. Fichiers de logs
log_info "Nettoyage des fichiers de logs..."
remove_files "*.log" "fichiers de logs"
remove_dirs "logs" "dossiers de logs"

# 3. Fichiers temporaires
log_info "Nettoyage des fichiers temporaires..."
remove_files "*.tmp" "fichiers temporaires"
remove_files "*.temp" "fichiers temporaires"

# 4. Cache Python
log_info "Nettoyage du cache Python..."
remove_files "*.pyc" "fichiers Python compilés"
remove_files "*.pyo" "fichiers Python optimisés"
remove_files "*.pyd" "fichiers Python dynamiques"
remove_dirs "__pycache__" "dossiers __pycache__"
remove_dirs ".pytest_cache" "dossiers .pytest_cache"

# 5. Cache Node.js
log_info "Nettoyage du cache Node.js..."
remove_dirs ".cache" "dossiers .cache"
remove_files ".eslintcache" "fichiers .eslintcache"
remove_files "*.tsbuildinfo" "fichiers TypeScript build info"

# 6. Coverage et tests
log_info "Nettoyage des rapports de coverage..."
remove_dirs "coverage" "dossiers coverage"
remove_dirs "htmlcov" "dossiers htmlcov"
remove_files ".coverage" "fichiers .coverage"

# 7. Fichiers de build
log_info "Nettoyage des fichiers de build..."
remove_dirs "dist" "dossiers dist"
remove_dirs "build" "dossiers build"
remove_dirs ".next" "dossiers .next"
remove_dirs "out" "dossiers out"

# 8. Fichiers IDE
log_info "Nettoyage des fichiers IDE..."
remove_files "*.swp" "fichiers swap Vim"
remove_files "*.swo" "fichiers swap Vim"
remove_files "*~" "fichiers de sauvegarde"

# 9. Fichiers de verrouillage (optionnel)
if [[ "$1" == "--force" ]]; then
    log_warning "Mode force activé - suppression des fichiers de verrouillage..."
    remove_files "*.lock" "fichiers de verrouillage"
    remove_files "pnpm-lock.yaml" "fichiers pnpm-lock.yaml"
    remove_files "yarn.lock" "fichiers yarn.lock"
    remove_files "package-lock.json" "fichiers package-lock.json"
fi

# 10. Vérification de l'espace disque libéré
log_info "Calcul de l'espace disque libéré..."
if command -v du >/dev/null 2>&1; then
    BEFORE=$(du -sh . 2>/dev/null | cut -f1)
    log_info "Taille du projet avant nettoyage: $BEFORE"
fi

# 11. Nettoyage des dossiers node_modules (optionnel)
if [[ "$1" == "--deep" ]]; then
    log_warning "Mode deep activé - suppression des node_modules..."
    remove_dirs "node_modules" "dossiers node_modules"
fi

# 12. Vérification finale
log_info "Vérification de la structure du projet..."

# Vérifier les fichiers restants
REMAINING_LOGS=$(find . -name "*.log" -not -path "./.git/*" 2>/dev/null | wc -l)
REMAINING_CACHE=$(find . -name "__pycache__" -type d -not -path "./.git/*" 2>/dev/null | wc -l)
REMAINING_TEMP=$(find . -name "*.tmp" -not -path "./.git/*" 2>/dev/null | wc -l)

if [ "$REMAINING_LOGS" -eq 0 ] && [ "$REMAINING_CACHE" -eq 0 ] && [ "$REMAINING_TEMP" -eq 0 ]; then
    log_success "Nettoyage terminé avec succès !"
else
    log_warning "Certains fichiers n'ont pas pu être supprimés:"
    [ "$REMAINING_LOGS" -gt 0 ] && log_warning "- $REMAINING_LOGS fichiers de logs restants"
    [ "$REMAINING_CACHE" -gt 0 ] && log_warning "- $REMAINING_CACHE dossiers de cache restants"
    [ "$REMAINING_TEMP" -gt 0 ] && log_warning "- $REMAINING_TEMP fichiers temporaires restants"
fi

# 13. Affichage de l'espace disque final
if command -v du >/dev/null 2>&1; then
    AFTER=$(du -sh . 2>/dev/null | cut -f1)
    log_info "Taille du projet après nettoyage: $AFTER"
fi

echo ""
log_success "🧹 Nettoyage terminé !"
echo ""
echo "📋 Options disponibles:"
echo "  ./scripts/maintenance/cleanup.sh        # Nettoyage standard"
echo "  ./scripts/maintenance/cleanup.sh --force # Supprime aussi les fichiers de verrouillage"
echo "  ./scripts/maintenance/cleanup.sh --deep  # Supprime aussi les node_modules"
echo ""
echo "💡 Conseil: Exécutez ce script régulièrement pour maintenir la propreté du projet"
