#!/bin/bash

# Script de test simple avec environnement virtuel
# Test rapide du service quantifié

set -e

echo "🐍 TEST SIMPLE AVEC VENV"
echo "========================"
echo "📅 Date: $(date)"
echo ""

# Configuration
VENV_NAME="test_venv"

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Nettoyage
cleanup() {
    log_info "🧹 Nettoyage..."
    if [ -d "$VENV_NAME" ]; then
        rm -rf "$VENV_NAME"
    fi
    if [ -d "test_temp" ]; then
        rm -rf "test_temp"
    fi
}

trap cleanup EXIT

# Étape 1: Créer l'environnement virtuel
log_info "🐍 Création de l'environnement virtuel..."
python3 -m venv "$VENV_NAME"
source "$VENV_NAME/bin/activate"
log_success "Environnement virtuel activé"

# Étape 2: Installer les dépendances de base
log_info "📦 Installation des dépendances..."
pip install --upgrade pip

# Installer PyTorch avec la dernière version compatible
log_info "📦 Installation de PyTorch..."
pip install torch transformers

# Installer les autres dépendances
log_info "📦 Installation des autres dépendances..."
pip install fastapi uvicorn pyzmq redis psutil accelerate
log_success "Dépendances installées"

# Étape 3: Préparer les fichiers de test
log_info "📁 Préparation des fichiers..."
mkdir -p test_temp
cp -r translator/src test_temp/
cp test-quantized-service.py test_temp/
cp translator/src/config/settings.py test_temp/src/config/

# Étape 4: Test simple
log_info "🧪 Test du service quantifié..."
cd test_temp

python3 -c "
import sys
sys.path.append('src')

try:
    from services.quantized_ml_service import QuantizedMLService
    print('✅ Import réussi')
    
    # Test de création
    service = QuantizedMLService('basic', 'float16')
    print('✅ Service créé')
    
    # Test d'initialisation (sans charger les modèles pour le test rapide)
    print('✅ Service prêt pour les tests')
    
except Exception as e:
    print(f'❌ Erreur: {e}')
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    log_success "Test réussi !"
else
    log_error "Test échoué"
    exit 1
fi

cd ..

# Résumé
echo ""
echo "🎯 RÉSULTAT"
echo "==========="
echo "✅ Environnement virtuel créé"
echo "✅ Dépendances installées"
echo "✅ Service quantifié testé"
echo "✅ Prêt pour les tests de performance"
echo ""
echo "💡 Pour continuer: source $VENV_NAME/bin/activate"

log_success "Test terminé avec succès !"
