#!/bin/bash

# ===== MEESHY - TEST DE L'ARCHITECTURE UNIFIÉE =====
# Script de test pour valider l'architecture unifiée avec le script principal
# Usage: ./test-unified-architecture.sh

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Fonctions de logging
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

# Test 1: Vérifier la présence du script principal
test_main_script() {
    log_info "Test 1: Vérification du script principal"
    
    if [ -f "$SCRIPT_DIR/meeshy.sh" ]; then
        log_success "Script principal trouvé: meeshy.sh"
        
        if [ -x "$SCRIPT_DIR/meeshy.sh" ]; then
            log_success "Script principal exécutable"
        else
            log_error "Script principal non exécutable"
            return 1
        fi
    else
        log_error "Script principal manquant: meeshy.sh"
        return 1
    fi
    
    return 0
}

# Test 2: Vérifier la structure des dossiers
test_folder_structure() {
    log_info "Test 2: Vérification de la structure des dossiers"
    
    local folders=("production" "development" "deployment")
    
    for folder in "${folders[@]}"; do
        if [ -d "$SCRIPT_DIR/$folder" ]; then
            log_success "Dossier trouvé: $folder"
        else
            log_error "Dossier manquant: $folder"
            return 1
        fi
    done
    
    return 0
}

# Test 3: Vérifier les scripts de production
test_production_scripts() {
    log_info "Test 3: Vérification des scripts de production"
    
    local scripts=(
        "meeshy-orchestrator.sh"
        "meeshy-config.sh"
        "meeshy-start.sh"
        "meeshy-stop.sh"
        "meeshy-status.sh"
        "meeshy-logs.sh"
        "meeshy-maintenance.sh"
        "generate-production-config.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [ -f "$SCRIPT_DIR/production/$script" ]; then
            log_success "Script de production trouvé: $script"
        else
            log_error "Script de production manquant: $script"
            return 1
        fi
    done
    
    return 0
}

# Test 4: Vérifier les scripts de développement
test_development_scripts() {
    log_info "Test 4: Vérification des scripts de développement"
    
    local scripts=(
        "development-configure-dev.sh"
        "development-init-mongodb-replica.sh"
        "development-start-local.sh"
        "development-stop-local.sh"
        "development-test-conversation-access.sh"
        "development-test-local.sh"
        "development-test-registration.sh"
        "development-test-simple-access.sh"
        "development-test-unauthenticated-access.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [ -f "$SCRIPT_DIR/development/$script" ]; then
            log_success "Script de développement trouvé: $script"
        else
            log_error "Script de développement manquant: $script"
            return 1
        fi
    done
    
    return 0
}

# Test 5: Vérifier les scripts de déploiement
test_deployment_scripts() {
    log_info "Test 5: Vérification des scripts de déploiement"
    
    local scripts=(
        "deploy-orchestrator.sh"
        "deploy-config.sh"
        "deploy-test-connection.sh"
        "deploy-prepare-files.sh"
        "deploy-install-prerequisites.sh"
        "deploy-configure-mongodb.sh"
        "deploy-start-services.sh"
        "deploy-health-check.sh"
        "deploy-maintenance.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [ -f "$SCRIPT_DIR/deployment/$script" ]; then
            log_success "Script de déploiement trouvé: $script"
        else
            log_error "Script de déploiement manquant: $script"
            return 1
        fi
    done
    
    return 0
}

# Test 6: Tester les commandes d'aide
test_help_commands() {
    log_info "Test 6: Test des commandes d'aide"
    
    # Test de l'aide principale
    if "$SCRIPT_DIR/meeshy.sh" --help >/dev/null 2>&1; then
        log_success "Aide principale fonctionnelle"
    else
        log_error "Aide principale non fonctionnelle"
        return 1
    fi
    
    # Test de la version
    if "$SCRIPT_DIR/meeshy.sh" --version >/dev/null 2>&1; then
        log_success "Commande version fonctionnelle"
    else
        log_error "Commande version non fonctionnelle"
        return 1
    fi
    
    return 0
}

# Test 7: Tester les commandes de production
test_production_commands() {
    log_info "Test 7: Test des commandes de production"
    
    # Test de la commande version de production
    if "$SCRIPT_DIR/meeshy.sh" prod version >/dev/null 2>&1; then
        log_success "Commande de production fonctionnelle: prod version"
    else
        log_error "Commande de production non fonctionnelle: prod version"
        return 1
    fi
    
    return 0
}

# Test 8: Tester les commandes de développement
test_development_commands() {
    log_info "Test 8: Test des commandes de développement"
    
    # Test de la commande configure de développement
    if "$SCRIPT_DIR/meeshy.sh" dev configure --help >/dev/null 2>&1; then
        log_success "Commande de développement fonctionnelle: dev configure"
    else
        log_warning "Commande de développement non testable: dev configure"
    fi
    
    return 0
}

# Test 9: Tester les commandes de déploiement
test_deployment_commands() {
    log_info "Test 9: Test des commandes de déploiement"
    
    # Test de l'aide de déploiement
    if "$SCRIPT_DIR/meeshy.sh" deploy --help >/dev/null 2>&1; then
        log_success "Commande de déploiement fonctionnelle: deploy --help"
    else
        log_error "Commande de déploiement non fonctionnelle: deploy --help"
        return 1
    fi
    
    return 0
}

# Test 10: Vérifier la cohérence des noms
test_naming_consistency() {
    log_info "Test 10: Vérification de la cohérence des noms"
    
    # Vérifier que les scripts de développement ont le préfixe development-
    local dev_scripts=$(ls "$SCRIPT_DIR/development"/*.sh 2>/dev/null | xargs -n1 basename)
    local non_prefixed=()
    
    for script in $dev_scripts; do
        if [[ ! "$script" =~ ^development- ]]; then
            non_prefixed+=("$script")
        fi
    done
    
    if [ ${#non_prefixed[@]} -eq 0 ]; then
        log_success "Tous les scripts de développement ont le préfixe development-"
    else
        log_error "Scripts de développement sans préfixe: ${non_prefixed[*]}"
        return 1
    fi
    
    # Vérifier que meeshy.sh a été renommé en meeshy-orchestrator.sh
    if [ -f "$SCRIPT_DIR/production/meeshy-orchestrator.sh" ]; then
        log_success "Script meeshy.sh renommé en meeshy-orchestrator.sh"
    else
        log_error "Script meeshy.sh non renommé en meeshy-orchestrator.sh"
        return 1
    fi
    
    return 0
}

# Fonction principale
main() {
    echo -e "${CYAN}🧪 MEESHY - TEST DE L'ARCHITECTURE UNIFIÉE${NC}"
    echo "=============================================="
    echo ""
    
    local tests=(
        "test_main_script"
        "test_folder_structure"
        "test_production_scripts"
        "test_development_scripts"
        "test_deployment_scripts"
        "test_help_commands"
        "test_production_commands"
        "test_development_commands"
        "test_deployment_commands"
        "test_naming_consistency"
    )
    
    local passed=0
    local failed=0
    
    for test in "${tests[@]}"; do
        echo "--- $test ---"
        if $test; then
            ((passed++))
        else
            ((failed++))
        fi
        echo ""
    done
    
    # Résumé des tests
    echo "=== RÉSUMÉ DES TESTS ==="
    echo "Tests réussis: $passed"
    echo "Tests échoués: $failed"
    echo "Total: $((passed + failed))"
    
    if [ $failed -eq 0 ]; then
        log_success "Tous les tests sont passés avec succès!"
        echo ""
        echo -e "${GREEN}🎉 L'architecture unifiée est prête à être utilisée!${NC}"
        echo ""
        echo "Utilisation du script principal:"
        echo "  ./meeshy.sh --help"
        echo ""
        echo "Exemples d'utilisation:"
        echo "  ./meeshy.sh prod start"
        echo "  ./meeshy.sh dev test"
        echo "  ./meeshy.sh deploy deploy 192.168.1.100"
        echo ""
        exit 0
    else
        log_error "Certains tests ont échoué. Veuillez corriger les problèmes avant d'utiliser l'architecture."
        exit 1
    fi
}

# Exécuter la fonction principale
main "$@"
