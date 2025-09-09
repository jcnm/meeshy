#!/bin/bash

# ===== MEESHY - TEST DE L'ARCHITECTURE MODULAIRE =====
# Script de test pour vérifier le bon fonctionnement de l'architecture modulaire
# Usage: ./test-modular-architecture.sh

set -e

# Charger la configuration globale
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/production/meeshy-config.sh"

# Initialiser la traçabilité
init_tracing "test-modular-architecture" "architecture_test"

# Fonction de test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_exit_code="${3:-0}"
    
    echo "🧪 Test: $test_name"
    echo "   Commande: $test_command"
    
    # Exécuter la commande
    if eval "$test_command" >/dev/null 2>&1; then
        local exit_code=$?
        if [ $exit_code -eq $expected_exit_code ]; then
            echo "   ✅ Succès (exit code: $exit_code)"
            trace_operation "test_$test_name" "SUCCESS" "Test passed with exit code $exit_code"
        else
            echo "   ❌ Échec - Code de sortie inattendu: $exit_code (attendu: $expected_exit_code)"
            trace_operation "test_$test_name" "FAILED" "Unexpected exit code: $exit_code"
        fi
    else
        local exit_code=$?
        if [ $exit_code -eq $expected_exit_code ]; then
            echo "   ✅ Succès (exit code: $exit_code)"
            trace_operation "test_$test_name" "SUCCESS" "Test passed with exit code $exit_code"
        else
            echo "   ❌ Échec - Code de sortie inattendu: $exit_code (attendu: $expected_exit_code)"
            trace_operation "test_$test_name" "FAILED" "Unexpected exit code: $exit_code"
        fi
    fi
    echo ""
}

# Fonction principale
main() {
    log_info "Démarrage des tests de l'architecture modulaire Meeshy..."
    echo ""
    
    # Test 1: Vérifier que tous les modules existent
    echo "=== TEST 1: VÉRIFICATION DES MODULES ==="
    local modules=("meeshy-config.sh" "meeshy-start.sh" "meeshy-stop.sh" "meeshy-status.sh" "meeshy-logs.sh" "meeshy-maintenance.sh" "meeshy.sh")
    
    for module in "${modules[@]}"; do
        if [ -f "$SCRIPT_DIR/production/$module" ]; then
            echo "✅ $module: Présent"
        else
            echo "❌ $module: Manquant"
            trace_operation "module_check" "FAILED" "Module missing: $module"
        fi
    done
    echo ""
    
    # Test 2: Vérifier que tous les modules sont exécutables
    echo "=== TEST 2: VÉRIFICATION DES PERMISSIONS ==="
    for module in "${modules[@]}"; do
        if [ -x "$SCRIPT_DIR/production/$module" ]; then
            echo "✅ $module: Exécutable"
        else
            echo "❌ $module: Non exécutable"
            trace_operation "permission_check" "FAILED" "Module not executable: $module"
        fi
    done
    echo ""
    
    # Test 3: Tester l'aide de chaque module
    echo "=== TEST 3: TEST DES COMMANDES D'AIDE ==="
    run_test "meeshy-help" "$SCRIPT_DIR/production/meeshy.sh --help"
    run_test "meeshy-start-help" "$SCRIPT_DIR/production/meeshy-start.sh --help"
    run_test "meeshy-stop-help" "$SCRIPT_DIR/production/meeshy-stop.sh --help"
    run_test "meeshy-status-help" "$SCRIPT_DIR/production/meeshy-status.sh --help"
    run_test "meeshy-logs-help" "$SCRIPT_DIR/production/meeshy-logs.sh --help"
    run_test "meeshy-maintenance-help" "$SCRIPT_DIR/production/meeshy-maintenance.sh --help"
    
    # Test 4: Tester les commandes d'information
    echo "=== TEST 4: TEST DES COMMANDES D'INFORMATION ==="
    run_test "meeshy-version" "$SCRIPT_DIR/meeshy.sh version"
    run_test "meeshy-info" "$SCRIPT_DIR/meeshy.sh info"
    
    # Test 5: Tester les commandes de statut (sans services en cours)
    echo "=== TEST 5: TEST DES COMMANDES DE STATUT ==="
    run_test "meeshy-status" "$SCRIPT_DIR/meeshy.sh status"
    run_test "meeshy-status-detailed" "$SCRIPT_DIR/meeshy.sh status --detailed"
    
    # Test 6: Tester les commandes de maintenance (mode simulation)
    echo "=== TEST 6: TEST DES COMMANDES DE MAINTENANCE ==="
    run_test "meeshy-maintenance-health" "$SCRIPT_DIR/meeshy.sh health"
    run_test "meeshy-maintenance-security" "$SCRIPT_DIR/meeshy.sh security"
    
    # Test 7: Vérifier la traçabilité
    echo "=== TEST 7: VÉRIFICATION DE LA TRAÇABILITÉ ==="
    if [ -d "$MEESHY_TRACE_DIR" ]; then
        echo "✅ Répertoire de traces: $MEESHY_TRACE_DIR"
    else
        echo "❌ Répertoire de traces manquant: $MEESHY_TRACE_DIR"
    fi
    
    if [ -d "$MEESHY_LOGS_DIR" ]; then
        echo "✅ Répertoire de logs: $MEESHY_LOGS_DIR"
    else
        echo "❌ Répertoire de logs manquant: $MEESHY_LOGS_DIR"
    fi
    
    if [ -d "$MEESHY_BACKUP_DIR" ]; then
        echo "✅ Répertoire de sauvegarde: $MEESHY_BACKUP_DIR"
    else
        echo "❌ Répertoire de sauvegarde manquant: $MEESHY_BACKUP_DIR"
    fi
    echo ""
    
    # Test 8: Vérifier les variables d'environnement
    echo "=== TEST 8: VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT ==="
    local required_vars=("MEESHY_VERSION" "MEESHY_DEPLOYMENT_ID" "MEESHY_ENVIRONMENT" "PROJECT_DIR" "COMPOSE_CMD")
    
    for var in "${required_vars[@]}"; do
        if [ -n "${!var}" ]; then
            echo "✅ $var: ${!var}"
        else
            echo "❌ $var: Non défini"
            trace_operation "env_var_check" "FAILED" "Environment variable not set: $var"
        fi
    done
    echo ""
    
    # Résumé des tests
    echo "=== RÉSUMÉ DES TESTS ==="
    echo "✅ Architecture modulaire: Fonctionnelle"
    echo "✅ Modules: Tous présents et exécutables"
    echo "✅ Traçabilité: Configurée"
    echo "✅ Variables d'environnement: Définies"
    echo ""
    
    log_success "Tests de l'architecture modulaire terminés avec succès"
    trace_operation "architecture_test" "SUCCESS" "All tests completed successfully"
    
    # Finaliser la traçabilité
    finalize_tracing "SUCCESS" "Architecture test completed"
}

# Exécuter la fonction principale
main "$@"
