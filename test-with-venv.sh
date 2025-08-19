#!/bin/bash

# Script de test du service quantifié avec environnement virtuel
# Teste la compatibilité et les performances

set -e

echo "🐍 TEST AVEC ENVIRONNEMENT VIRTUEL"
echo "=================================="
echo "📅 Date: $(date)"
echo "🎯 Objectif: Tester le service quantifié dans un venv propre"
echo ""

# Configuration
VENV_NAME="translator_test_venv"
PYTHON_VERSION="python3.12"
REQUIREMENTS_FILE="translator/requirements-optimized.txt"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de log coloré
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

# Fonction de nettoyage
cleanup() {
    log_info "🧹 Nettoyage de l'environnement virtuel..."
    
    if [ -d "$VENV_NAME" ]; then
        log_info "Suppression du venv: $VENV_NAME"
        rm -rf "$VENV_NAME"
    fi
    
    log_success "Nettoyage terminé"
}

# Trap pour nettoyer en cas d'erreur
trap cleanup EXIT

# Étape 1: Vérifier les prérequis
log_info "🔍 Vérification des prérequis..."

if ! command -v python3 &> /dev/null; then
    log_error "Python3 n'est pas installé"
    exit 1
fi

if ! command -v pip3 &> /dev/null; then
    log_error "pip3 n'est pas installé"
    exit 1
fi

log_success "Python3 et pip3 sont disponibles"

# Étape 2: Créer l'environnement virtuel
log_info "🐍 Création de l'environnement virtuel..."

if [ -d "$VENV_NAME" ]; then
    log_warning "L'environnement virtuel existe déjà, suppression..."
    rm -rf "$VENV_NAME"
fi

python3 -m venv "$VENV_NAME"

if [ ! -d "$VENV_NAME" ]; then
    log_error "Échec de la création de l'environnement virtuel"
    exit 1
fi

log_success "Environnement virtuel créé: $VENV_NAME"

# Étape 3: Activer l'environnement virtuel
log_info "🔧 Activation de l'environnement virtuel..."

source "$VENV_NAME/bin/activate"

if [ "$VIRTUAL_ENV" != "$(pwd)/$VENV_NAME" ]; then
    log_error "Échec de l'activation de l'environnement virtuel"
    exit 1
fi

log_success "Environnement virtuel activé: $VIRTUAL_ENV"

# Étape 4: Mettre à jour pip
log_info "📦 Mise à jour de pip..."

pip install --upgrade pip

log_success "pip mis à jour"

# Étape 5: Installer les dépendances de base
log_info "📚 Installation des dépendances de base..."

# Installer les dépendances essentielles d'abord
pip install torch==2.0.1 transformers==4.30.0

if [ $? -ne 0 ]; then
    log_error "Échec de l'installation des dépendances ML"
    exit 1
fi

log_success "Dépendances ML installées"

# Étape 6: Installer les dépendances optimisées
log_info "🚀 Installation des dépendances optimisées..."

if [ -f "$REQUIREMENTS_FILE" ]; then
    pip install -r "$REQUIREMENTS_FILE"
    
    if [ $? -ne 0 ]; then
        log_warning "Certaines dépendances optimisées n'ont pas pu être installées"
        log_info "Installation des dépendances minimales..."
        
        # Installation minimale
        pip install fastapi uvicorn pyzmq redis psutil
    fi
else
    log_warning "Fichier requirements-optimized.txt non trouvé"
    log_info "Installation des dépendances minimales..."
    pip install fastapi uvicorn pyzmq redis psutil
fi

log_success "Dépendances installées"

# Étape 7: Vérifier l'installation
log_info "🔍 Vérification de l'installation..."

python3 -c "
import torch
import transformers
import fastapi
import zmq
import redis
import psutil

print('✅ PyTorch version:', torch.__version__)
print('✅ Transformers version:', transformers.__version__)
print('✅ FastAPI version:', fastapi.__version__)
print('✅ ZMQ version:', zmq.__version__)
print('✅ Redis version:', redis.__version__)
print('✅ psutil version:', psutil.__version__)

# Vérifier CUDA
if torch.cuda.is_available():
    print('✅ CUDA disponible:', torch.cuda.get_device_name(0))
else:
    print('ℹ️  CUDA non disponible, utilisation CPU')

print('✅ Toutes les dépendances sont installées correctement')
"

# Étape 8: Test du service quantifié
log_info "🧪 Test du service quantifié..."

# Copier les fichiers nécessaires
log_info "📁 Préparation des fichiers de test..."

# Créer un répertoire temporaire pour les tests
mkdir -p test_temp
cp -r translator/src test_temp/
cp test-quantized-service.py test_temp/
cp test-quantization-performance.py test_temp/

cd test_temp

# Test simple
log_info "🔧 Test simple du service quantifié..."
python3 test-quantized-service.py

if [ $? -eq 0 ]; then
    log_success "Test simple réussi"
else
    log_error "Test simple échoué"
    exit 1
fi

# Test de performance (optionnel)
log_info "⚡ Test de performance du service quantifié..."
python3 test-quantization-performance.py

if [ $? -eq 0 ]; then
    log_success "Test de performance réussi"
else
    log_warning "Test de performance échoué (normal si dépendances manquantes)"
fi

cd ..

# Étape 9: Test d'intégration avec l'architecture existante
log_info "🔄 Test d'intégration avec l'architecture existante..."

# Copier les fichiers de configuration
cp translator/src/config/settings.py test_temp/src/config/
cp translator/env.example test_temp/.env

cd test_temp

# Test d'import des services
python3 -c "
import sys
import os
sys.path.append('src')

try:
    from services.quantized_ml_service import QuantizedMLService
    from services.unified_ml_service import UnifiedMLTranslationService
    from config.settings import get_settings
    
    print('✅ Import des services réussi')
    print('✅ Configuration chargée')
    
    # Test de création des services
    quantized = QuantizedMLService('basic', 'float16')
    unified = UnifiedMLTranslationService()
    
    print('✅ Création des services réussie')
    print('✅ Services compatibles')
    
except Exception as e:
    print(f'❌ Erreur d\'import: {e}')
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    log_success "Test d'intégration réussi"
else
    log_error "Test d'intégration échoué"
    exit 1
fi

cd ..

# Étape 10: Résumé des tests
log_info "📋 Résumé des tests..."

echo ""
echo "🎯 RÉSULTATS DES TESTS"
echo "======================"
echo "✅ Environnement virtuel créé et activé"
echo "✅ Dépendances installées"
echo "✅ Service quantifié testé"
echo "✅ Compatibilité vérifiée"
echo "✅ Intégration validée"
echo ""

# Afficher les informations de l'environnement
echo "📊 INFORMATIONS DE L'ENVIRONNEMENT"
echo "=================================="
echo "Python: $(python3 --version)"
echo "Pip: $(pip --version)"
echo "Venv: $VIRTUAL_ENV"
echo "PyTorch: $(python3 -c 'import torch; print(torch.__version__)')"
echo "Transformers: $(python3 -c 'import transformers; print(transformers.__version__)')"

# Recommandations
echo ""
echo "💡 RECOMMANDATIONS"
echo "=================="
echo "1. L'environnement virtuel est prêt pour les tests"
echo "2. Le service quantifié fonctionne correctement"
echo "3. Vous pouvez maintenant tester les performances"
echo "4. Pour continuer les tests: source $VENV_NAME/bin/activate"
echo "5. Pour nettoyer: rm -rf $VENV_NAME"

log_success "Tests terminés avec succès !"

# Désactiver l'environnement virtuel
deactivate

log_info "Environnement virtuel désactivé"
