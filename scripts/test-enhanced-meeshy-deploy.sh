#!/bin/bash

# Script de test pour vérifier les améliorations de meeshy-deploy.sh
# Ce script teste les nouvelles fonctionnalités sans déployer réellement

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Test des améliorations de meeshy-deploy.sh${NC}"
echo "=============================================="
echo ""

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Test 1: Vérifier que le script existe et est exécutable
log_info "Test 1: Vérification de l'existence du script..."
if [ -f "./scripts/meeshy-deploy.sh" ]; then
    log_success "Script meeshy-deploy.sh trouvé"
else
    log_error "Script meeshy-deploy.sh non trouvé"
    exit 1
fi

if [ -x "./scripts/meeshy-deploy.sh" ]; then
    log_success "Script meeshy-deploy.sh est exécutable"
else
    log_warning "Script meeshy-deploy.sh n'est pas exécutable, correction..."
    chmod +x ./scripts/meeshy-deploy.sh
    log_success "Permissions corrigées"
fi

# Test 2: Vérifier que la nouvelle commande fix-translator est disponible
log_info "Test 2: Vérification de la nouvelle commande fix-translator..."
if ./scripts/meeshy-deploy.sh help 2>/dev/null | grep -q "fix-translator"; then
    log_success "Commande fix-translator disponible"
else
    log_error "Commande fix-translator non trouvée"
    exit 1
fi

# Test 3: Vérifier que la gestion des secrets est mentionnée
log_info "Test 3: Vérification de la gestion des secrets..."
if grep -q "secrets/production-secrets.env" ./scripts/meeshy-deploy.sh; then
    log_success "Gestion des secrets de production intégrée"
else
    log_error "Gestion des secrets de production non trouvée"
    exit 1
fi

# Test 4: Vérifier que la gestion avancée des volumes est intégrée
log_info "Test 4: Vérification de la gestion avancée des volumes..."
if grep -q "fix_volume_permissions" ./scripts/meeshy-deploy.sh; then
    log_success "Fonction fix_volume_permissions intégrée"
else
    log_error "Fonction fix_volume_permissions non trouvée"
    exit 1
fi

# Test 5: Vérifier que la gestion des volumes translator est améliorée
log_info "Test 5: Vérification de la gestion des volumes translator..."
if grep -q "meeshy_translator_cache\|meeshy_translator_generated" ./scripts/meeshy-deploy.sh; then
    log_success "Gestion des volumes translator améliorée"
else
    log_error "Gestion des volumes translator non améliorée"
    exit 1
fi

# Test 6: Vérifier que le nettoyage avancé est intégré
log_info "Test 6: Vérification du nettoyage avancé..."
if grep -q "\.pid\|\.DS_Store" ./scripts/meeshy-deploy.sh; then
    log_success "Nettoyage avancé intégré"
else
    log_error "Nettoyage avancé non intégré"
    exit 1
fi

# Test 7: Vérifier que la fonction fix_translator_permissions est définie
log_info "Test 7: Vérification de la fonction fix_translator_permissions..."
if grep -q "fix_translator_permissions()" ./scripts/meeshy-deploy.sh; then
    log_success "Fonction fix_translator_permissions définie"
else
    log_error "Fonction fix_translator_permissions non définie"
    exit 1
fi

# Test 8: Vérifier que la gestion des secrets est intégrée dans le déploiement
log_info "Test 8: Vérification de l'intégration des secrets dans le déploiement..."
if grep -q "Chargement des secrets de production" ./scripts/meeshy-deploy.sh; then
    log_success "Chargement des secrets intégré dans le déploiement"
else
    log_error "Chargement des secrets non intégré dans le déploiement"
    exit 1
fi

# Test 9: Vérifier que les exemples incluent la nouvelle commande
log_info "Test 9: Vérification des exemples..."
if ./scripts/meeshy-deploy.sh help 2>/dev/null | grep -q "fix-translator 157.230.15.51"; then
    log_success "Exemple fix-translator inclus dans l'aide"
else
    log_error "Exemple fix-translator non inclus dans l'aide"
    exit 1
fi

# Test 10: Vérifier la syntaxe du script
log_info "Test 10: Vérification de la syntaxe du script..."
if bash -n ./scripts/meeshy-deploy.sh 2>/dev/null; then
    log_success "Syntaxe du script valide"
else
    log_error "Erreurs de syntaxe dans le script"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Tous les tests sont passés avec succès !${NC}"
echo ""
echo -e "${CYAN}📋 Résumé des améliorations intégrées:${NC}"
echo -e "  ✅ Gestion avancée des permissions des volumes Docker"
echo -e "  ✅ Gestion des secrets de production"
echo -e "  ✅ Nouvelle commande fix-translator"
echo -e "  ✅ Nettoyage avancé des fichiers de verrouillage"
echo -e "  ✅ Support des volumes translator multiples"
echo -e "  ✅ Intégration des secrets dans le déploiement"
echo -e "  ✅ Fonction de correction des permissions du translator"
echo ""
echo -e "${YELLOW}💡 Utilisation de la nouvelle commande:${NC}"
echo -e "  ${CYAN}./scripts/meeshy-deploy.sh fix-translator DROPLET_IP${NC}"
echo ""
echo -e "${GREEN}🚀 Le script meeshy-deploy.sh est maintenant amélioré !${NC}"
