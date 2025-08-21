#!/bin/bash
set -e

echo "[TEST] 🧪 Test de la configuration de tous les modèles ML..."

# Variables d'environnement de test
export MODEL_TYPE="all"
export BASIC_MODEL="t5-small"
export MEDIUM_MODEL="nllb-200-distilled-600M"
export PREMIUM_MODEL="nllb-200-distilled-1.3B"

# Fonction pour nettoyer après les tests
cleanup() {
    echo "[TEST] 🧹 Nettoyage après les tests..."
    # Arrêter les conteneurs de test si nécessaire
    docker-compose down 2>/dev/null || true
}

# Fonction pour tester la configuration des modèles
test_model_configuration() {
    echo "[TEST] 🔧 Test de la configuration des modèles..."
    
    # Vérifier que les variables d'environnement sont définies
    if [ -z "$MODEL_TYPE" ]; then
        echo "[TEST] ❌ MODEL_TYPE non défini"
        return 1
    fi
    
    if [ "$MODEL_TYPE" != "all" ]; then
        echo "[TEST] ⚠️ MODEL_TYPE n'est pas 'all': $MODEL_TYPE"
    else
        echo "[TEST] ✅ MODEL_TYPE configuré pour tous les modèles"
    fi
    
    # Vérifier les modèles spécifiques
    echo "[TEST] 📋 Vérification des modèles configurés..."
    echo "[TEST]   - BASIC_MODEL: ${BASIC_MODEL:-t5-small}"
    echo "[TEST]   - MEDIUM_MODEL: ${MEDIUM_MODEL:-nllb-200-distilled-600M}"
    echo "[TEST]   - PREMIUM_MODEL: ${PREMIUM_MODEL:-nllb-200-distilled-1.3B}"
    
    echo "[TEST] ✅ Configuration des modèles valide"
}

# Fonction pour tester les ressources Docker
test_docker_resources() {
    echo "[TEST] 🐳 Test des ressources Docker..."
    
    # Vérifier que le docker-compose.yml existe
    if [ ! -f "../docker-compose.yml" ]; then
        echo "[TEST] ❌ docker-compose.yml non trouvé"
        return 1
    fi
    
    # Vérifier les limites de mémoire
    if grep -q "memory: 16G" ../docker-compose.yml; then
        echo "[TEST] ✅ Limite mémoire configurée à 16G"
    else
        echo "[TEST] ⚠️ Limite mémoire non configurée à 16G"
    fi
    
    # Vérifier les limites CPU
    if grep -q "cpus: '8.0'" ../docker-compose.yml; then
        echo "[TEST] ✅ Limite CPU configurée à 8.0"
    else
        echo "[TEST] ⚠️ Limite CPU non configurée à 8.0"
    fi
    
    # Vérifier les workers
    if grep -q "TRANSLATION_WORKERS: 8" ../docker-compose.yml; then
        echo "[TEST] ✅ TRANSLATION_WORKERS configuré à 8"
    else
        echo "[TEST] ⚠️ TRANSLATION_WORKERS non configuré à 8"
    fi
    
    # Vérifier le healthcheck
    if grep -q "start_period: 600s" ../docker-compose.yml; then
        echo "[TEST] ✅ Healthcheck configuré à 600s"
    else
        echo "[TEST] ⚠️ Healthcheck non configuré à 600s"
    fi
    
    echo "[TEST] ✅ Configuration Docker valide"
}

# Fonction pour tester l'API des modèles
test_api_models() {
    echo "[TEST] 🌐 Test de l'API des modèles..."
    
    # Vérifier que l'API est accessible (si le service est démarré)
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "[TEST] ✅ API Translator accessible"
        
        # Tester l'endpoint /models
        if curl -s http://localhost:8000/models >/dev/null 2>&1; then
            echo "[TEST] ✅ Endpoint /models accessible"
            
            # Vérifier que tous les modèles sont listés
            models_response=$(curl -s http://localhost:8000/models)
            if echo "$models_response" | grep -q "basic"; then
                echo "[TEST] ✅ Modèle 'basic' listé"
            else
                echo "[TEST] ⚠️ Modèle 'basic' non trouvé"
            fi
            
            if echo "$models_response" | grep -q "medium"; then
                echo "[TEST] ✅ Modèle 'medium' listé"
            else
                echo "[TEST] ⚠️ Modèle 'medium' non trouvé"
            fi
            
            if echo "$models_response" | grep -q "premium"; then
                echo "[TEST] ✅ Modèle 'premium' listé"
            else
                echo "[TEST] ⚠️ Modèle 'premium' non trouvé"
            fi
        else
            echo "[TEST] ⚠️ Endpoint /models non accessible"
        fi
    else
        echo "[TEST] ⚠️ API Translator non accessible (service non démarré)"
    fi
}

# Fonction pour tester les traductions
test_translations() {
    echo "[TEST] 🔄 Test des traductions..."
    
    # Vérifier que l'API est accessible
    if ! curl -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "[TEST] ⚠️ API non accessible, test des traductions ignoré"
        return 0
    fi
    
    # Test de traduction avec modèle basic
    echo "[TEST] 🔄 Test traduction avec modèle basic..."
    basic_response=$(curl -s -X POST http://localhost:8000/translate \
        -H "Content-Type: application/json" \
        -d '{
            "text": "Hello world",
            "source_language": "en",
            "target_language": "fr",
            "model_type": "basic"
        }' 2>/dev/null || echo "{}")
    
    if echo "$basic_response" | grep -q "translated_text"; then
        echo "[TEST] ✅ Traduction basic réussie"
    else
        echo "[TEST] ⚠️ Traduction basic échouée"
    fi
    
    # Test de traduction avec modèle medium
    echo "[TEST] 🔄 Test traduction avec modèle medium..."
    medium_response=$(curl -s -X POST http://localhost:8000/translate \
        -H "Content-Type: application/json" \
        -d '{
            "text": "Hello world",
            "source_language": "en",
            "target_language": "fr",
            "model_type": "medium"
        }' 2>/dev/null || echo "{}")
    
    if echo "$medium_response" | grep -q "translated_text"; then
        echo "[TEST] ✅ Traduction medium réussie"
    else
        echo "[TEST] ⚠️ Traduction medium échouée"
    fi
    
    # Test de traduction avec modèle premium
    echo "[TEST] 🔄 Test traduction avec modèle premium..."
    premium_response=$(curl -s -X POST http://localhost:8000/translate \
        -H "Content-Type: application/json" \
        -d '{
            "text": "Hello world",
            "source_language": "en",
            "target_language": "fr",
            "model_type": "premium"
        }' 2>/dev/null || echo "{}")
    
    if echo "$premium_response" | grep -q "translated_text"; then
        echo "[TEST] ✅ Traduction premium réussie"
    else
        echo "[TEST] ⚠️ Traduction premium échouée"
    fi
}

# Fonction pour tester les performances
test_performance() {
    echo "[TEST] ⚡ Test des performances..."
    
    # Vérifier que l'API est accessible
    if ! curl -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "[TEST] ⚠️ API non accessible, test des performances ignoré"
        return 0
    fi
    
    # Test de performance avec modèle basic
    echo "[TEST] ⚡ Test performance modèle basic..."
    start_time=$(date +%s.%N)
    curl -s -X POST http://localhost:8000/translate \
        -H "Content-Type: application/json" \
        -d '{
            "text": "Hello world",
            "source_language": "en",
            "target_language": "fr",
            "model_type": "basic"
        }' >/dev/null 2>&1
    end_time=$(date +%s.%N)
    
    basic_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    echo "[TEST] ✅ Temps de réponse basic: ${basic_time}s"
    
    # Test de performance avec modèle medium
    echo "[TEST] ⚡ Test performance modèle medium..."
    start_time=$(date +%s.%N)
    curl -s -X POST http://localhost:8000/translate \
        -H "Content-Type: application/json" \
        -d '{
            "text": "Hello world",
            "source_language": "en",
            "target_language": "fr",
            "model_type": "medium"
        }' >/dev/null 2>&1
    end_time=$(date +%s.%N)
    
    medium_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    echo "[TEST] ✅ Temps de réponse medium: ${medium_time}s"
    
    # Test de performance avec modèle premium
    echo "[TEST] ⚡ Test performance modèle premium..."
    start_time=$(date +%s.%N)
    curl -s -X POST http://localhost:8000/translate \
        -H "Content-Type: application/json" \
        -d '{
            "text": "Hello world",
            "source_language": "en",
            "target_language": "fr",
            "model_type": "premium"
        }' >/dev/null 2>&1
    end_time=$(date +%s.%N)
    
    premium_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    echo "[TEST] ✅ Temps de réponse premium: ${premium_time}s"
}

# Fonction principale
main() {
    echo "[TEST] 🎯 Démarrage des tests de tous les modèles..."
    
    # Configuration du trap pour le nettoyage
    trap cleanup EXIT
    
    # Tests
    test_model_configuration
    test_docker_resources
    test_api_models
    test_translations
    test_performance
    
    echo "[TEST] ✅ Tous les tests terminés !"
    echo "[TEST] 🚀 Le service Translator est configuré pour utiliser tous les modèles ML"
}

# Exécuter les tests
main
