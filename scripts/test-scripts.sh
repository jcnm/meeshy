#!/bin/bash

# 🧪 SCRIPT DE TEST DES SCRIPTS DE DÉPLOIEMENT
# Usage: ./scripts/test-scripts.sh
# Vérifie que tous les scripts sont correctement configurés

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Test des scripts requis
test_required_scripts() {
    log_info "🔍 Test des scripts requis..."
    
    local scripts=(
        "deploy-merged.sh"
        "test-deployment.sh"
        "verify-connections.sh"
        "start-deployment.sh"
    )
    
    local all_scripts_exist=true
    
    for script in "${scripts[@]}"; do
        local script_path="$SCRIPT_DIR/$script"
        if [ -f "$script_path" ]; then
            if [ -x "$script_path" ]; then
                log_success "$script: Présent et exécutable"
            else
                log_error "$script: Présent mais non exécutable"
                all_scripts_exist=false
            fi
        else
            log_error "$script: Introuvable"
            all_scripts_exist=false
        fi
    done
    
    if [ "$all_scripts_exist" = true ]; then
        log_success "Tous les scripts requis sont présents et exécutables"
        return 0
    else
        log_error "Certains scripts requis sont manquants ou non exécutables"
        return 1
    fi
}

# Test des fichiers de configuration
test_configuration_files() {
    log_info "🔍 Test des fichiers de configuration..."
    
    local config_files=(
        "docker-compose-mongodb-production.yml"
        "env.digitalocean"
        "shared/schema.prisma"
    )
    
    local all_configs_exist=true
    
    for config in "${config_files[@]}"; do
        local config_path="$PROJECT_ROOT/$config"
        if [ -f "$config_path" ]; then
            log_success "$config: Présent"
        else
            log_error "$config: Introuvable"
            all_configs_exist=false
        fi
    done
    
    if [ "$all_configs_exist" = true ]; then
        log_success "Tous les fichiers de configuration sont présents"
        return 0
    else
        log_error "Certains fichiers de configuration sont manquants"
        return 1
    fi
}

# Test de la syntaxe des scripts
test_script_syntax() {
    log_info "🔍 Test de la syntaxe des scripts..."
    
    local scripts=(
        "deploy-merged.sh"
        "test-deployment.sh"
        "verify-connections.sh"
        "start-deployment.sh"
    )
    
    local all_syntax_valid=true
    
    for script in "${scripts[@]}"; do
        local script_path="$SCRIPT_DIR/$script"
        if bash -n "$script_path" 2>/dev/null; then
            log_success "$script: Syntaxe valide"
        else
            log_error "$script: Erreur de syntaxe"
            all_syntax_valid=false
        fi
    done
    
    if [ "$all_syntax_valid" = true ]; then
        log_success "Tous les scripts ont une syntaxe valide"
        return 0
    else
        log_error "Certains scripts ont des erreurs de syntaxe"
        return 1
    fi
}

# Test des permissions
test_permissions() {
    log_info "🔍 Test des permissions..."
    
    local scripts=(
        "deploy-merged.sh"
        "test-deployment.sh"
        "verify-connections.sh"
        "start-deployment.sh"
    )
    
    local all_permissions_ok=true
    
    for script in "${scripts[@]}"; do
        local script_path="$SCRIPT_DIR/$script"
        if [ -r "$script_path" ] && [ -w "$script_path" ] && [ -x "$script_path" ]; then
            log_success "$script: Permissions correctes (rwx)"
        else
            log_error "$script: Permissions incorrectes"
            all_permissions_ok=false
        fi
    done
    
    if [ "$all_permissions_ok" = true ]; then
        log_success "Toutes les permissions sont correctes"
        return 0
    else
        log_error "Certaines permissions sont incorrectes"
        return 1
    fi
}

# Test de la configuration Docker Compose
test_docker_compose() {
    log_info "🔍 Test de la configuration Docker Compose..."
    
    local compose_file="$PROJECT_ROOT/docker-compose-mongodb-production.yml"
    
    if [ -f "$compose_file" ]; then
        # Vérifier que le fichier contient les services requis
        local required_services=("mongodb" "redis" "translator" "gateway" "frontend" "nginx")
        local all_services_present=true
        
        for service in "${required_services[@]}"; do
            if grep -q "^  $service:" "$compose_file"; then
                log_success "Service $service: Présent dans docker-compose"
            else
                log_error "Service $service: Manquant dans docker-compose"
                all_services_present=false
            fi
        done
        
        if [ "$all_services_present" = true ]; then
            log_success "Tous les services requis sont présents dans docker-compose"
            return 0
        else
            log_error "Certains services requis sont manquants dans docker-compose"
            return 1
        fi
    else
        log_error "Fichier docker-compose introuvable"
        return 1
    fi
}

# Test de la configuration Prisma
test_prisma_config() {
    log_info "🔍 Test de la configuration Prisma..."
    
    local schema_file="$PROJECT_ROOT/shared/schema.prisma"
    
    if [ -f "$schema_file" ]; then
        # Vérifier que le schéma utilise MongoDB
        if grep -q "provider = \"mongodb\"" "$schema_file"; then
            log_success "Schema Prisma: MongoDB configuré"
        else
            log_error "Schema Prisma: MongoDB non configuré"
            return 1
        fi
        
        # Vérifier que les modèles principaux sont présents
        local required_models=("User" "Conversation" "Message")
        local all_models_present=true
        
        for model in "${required_models[@]}"; do
            if grep -q "^model $model" "$schema_file"; then
                log_success "Modèle $model: Présent dans le schéma"
            else
                log_error "Modèle $model: Manquant dans le schéma"
                all_models_present=false
            fi
        done
        
        if [ "$all_models_present" = true ]; then
            log_success "Tous les modèles requis sont présents"
            return 0
        else
            log_error "Certains modèles requis sont manquants"
            return 1
        fi
    else
        log_error "Fichier schema.prisma introuvable"
        return 1
    fi
}

# Test de la configuration des variables d'environnement
test_env_config() {
    log_info "🔍 Test de la configuration des variables d'environnement..."
    
    local env_file="$PROJECT_ROOT/env.digitalocean"
    
    if [ -f "$env_file" ]; then
        # Vérifier les variables critiques
        local critical_vars=(
            "DATABASE_URL"
            "REDIS_URL"
            "JWT_SECRET"
            "ZMQ_TRANSLATOR_HOST"
            "ZMQ_TRANSLATOR_PUSH_PORT"
            "ZMQ_TRANSLATOR_SUB_PORT"
        )
        
        local all_vars_present=true
        
        for var in "${critical_vars[@]}"; do
            if grep -q "^$var=" "$env_file"; then
                log_success "Variable $var: Présente"
            else
                log_error "Variable $var: Manquante"
                all_vars_present=false
            fi
        done
        
        if [ "$all_vars_present" = true ]; then
            log_success "Toutes les variables critiques sont présentes"
            return 0
        else
            log_error "Certaines variables critiques sont manquantes"
            return 1
        fi
    else
        log_error "Fichier env.digitalocean introuvable"
        return 1
    fi
}

# Test de la structure des dossiers
test_directory_structure() {
    log_info "🔍 Test de la structure des dossiers..."
    
    local required_dirs=(
        "docker"
        "shared"
        "shared/prisma"
        "shared/proto"
    )
    
    local all_dirs_exist=true
    
    for dir in "${required_dirs[@]}"; do
        local dir_path="$PROJECT_ROOT/$dir"
        if [ -d "$dir_path" ]; then
            log_success "$dir: Présent"
        else
            log_error "$dir: Manquant"
            all_dirs_exist=false
        fi
    done
    
    if [ "$all_dirs_exist" = true ]; then
        log_success "Tous les dossiers requis sont présents"
        return 0
    else
        log_error "Certains dossiers requis sont manquants"
        return 1
    fi
}

# Test de l'aide des scripts
test_script_help() {
    log_info "🔍 Test des scripts (exécutabilité et présence)..."

    local all_scripts=(
        "deploy-merged.sh"
        "test-deployment.sh"
        "verify-connections.sh"
        "start-deployment.sh"
    )

    local all_scripts_ok=true

    for script in "${all_scripts[@]}"; do
        local script_path="$SCRIPT_DIR/$script"
        if [ -f "$script_path" ] && [ -x "$script_path" ]; then
            log_success "$script: Présent et exécutable"
        elif [ -f "$script_path" ]; then
            log_warning "$script: Présent mais non exécutable"
            all_scripts_ok=false
        else
            log_error "$script: Introuvable"
            all_scripts_ok=false
        fi
    done

    if [ "$all_scripts_ok" = true ]; then
        log_success "Tous les scripts sont présents et exécutables"
    else
        log_warning "Certains scripts ont des problèmes"
    fi

    log_success "Test des scripts terminé"
    return 0
}

# Test complet
run_complete_test() {
    echo -e "${BLUE}🧪 TEST COMPLET DES SCRIPTS DE DÉPLOIEMENT MEESHY${NC}"
    echo "====================================================="
    echo ""
    
    local tests=(
        "test_required_scripts"
        "test_configuration_files"
        "test_script_syntax"
        "test_permissions"
        "test_docker_compose"
        "test_prisma_config"
        "test_env_config"
        "test_directory_structure"
        "test_script_help"
    )
    
    local passed_tests=0
    local total_tests=${#tests[@]}
    
    for test in "${tests[@]}"; do
        echo "🔍 Exécution: $test"
        if $test; then
            ((passed_tests++))
        fi
        echo ""
    done
    
    # Résumé
    echo "📊 RÉSUMÉ DES TESTS"
    echo "==================="
    echo "Tests réussis: $passed_tests/$total_tests"
    
    if [ $passed_tests -eq $total_tests ]; then
        log_success "🎉 Tous les tests sont passés ! Les scripts sont prêts."
        echo ""
        echo "🚀 Vous pouvez maintenant utiliser:"
        echo "  ./scripts/start-deployment.sh"
        echo "  ./scripts/deploy-merged.sh"
        echo "  ./scripts/test-deployment.sh"
        echo "  ./scripts/verify-connections.sh"
        return 0
    else
        log_error "❌ Certains tests ont échoué. Vérifiez la configuration."
        echo ""
        echo "🔧 Actions recommandées:"
        echo "  1. Vérifiez que tous les fichiers sont présents"
        echo "  2. Assurez-vous que les scripts sont exécutables"
        echo "  3. Vérifiez la configuration Docker Compose"
        echo "  4. Vérifiez le schéma Prisma"
        return 1
    fi
}

# Test rapide
run_quick_test() {
    echo -e "${BLUE}🏥 TEST RAPIDE DES SCRIPTS DE DÉPLOIEMENT${NC}"
    echo "==============================================="
    echo ""
    
    local quick_tests=(
        "test_required_scripts"
        "test_configuration_files"
        "test_permissions"
    )
    
    local passed_tests=0
    local total_tests=${#quick_tests[@]}
    
    for test in "${quick_tests[@]}"; do
        echo "🔍 Exécution: $test"
        if $test; then
            ((passed_tests++))
        fi
        echo ""
    done
    
    # Résumé
    echo "📊 RÉSUMÉ DU TEST RAPIDE"
    echo "========================"
    echo "Tests réussis: $passed_tests/$total_tests"
    
    if [ $passed_tests -eq $total_tests ]; then
        log_success "✅ Test rapide réussi ! Scripts de base fonctionnels."
    else
        log_error "❌ Test rapide échoué. Vérifiez la configuration de base."
    fi
}

# Afficher l'aide
show_help() {
    echo -e "${BLUE}🧪 SCRIPT DE TEST DES SCRIPTS DE DÉPLOIEMENT MEESHY${NC}"
    echo "========================================================="
    echo ""
    echo -e "${GREEN}Usage:${NC}"
    echo "  $0 [OPTION]"
    echo ""
    echo -e "${GREEN}Options:${NC}"
    echo -e "${CYAN}  --quick${NC}     - Test rapide (scripts de base uniquement)"
    echo -e "${CYAN}  --full${NC}      - Test complet (tous les composants)"
    echo -e "${CYAN}  --help${NC}      - Afficher cette aide"
    echo ""
    echo -e "${GREEN}Exemples:${NC}"
    echo "  $0"
    echo "  $0 --quick"
    echo "  $0 --full"
    echo ""
    echo -e "${YELLOW}💡 Vérifie que tous les scripts de déploiement sont correctement configurés${NC}"
}

# Point d'entrée principal
main() {
    case "${1:-}" in
        "--help"|"-h"|"help")
            show_help
            exit 0
            ;;
        "--quick")
            run_quick_test
            ;;
        "--full"|"")
            run_complete_test
            ;;
        *)
            log_error "Option inconnue: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Exécuter le script principal
main "$@"
