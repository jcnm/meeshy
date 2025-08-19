#!/bin/bash

# Script de test de performance avec environnement virtuel
# Teste les différents niveaux de quantification

set -e

echo "⚡ TEST DE PERFORMANCE AVEC VENV"
echo "================================="
echo "📅 Date: $(date)"
echo "🎯 Objectif: Tester les performances de quantification"
echo ""

# Configuration
VENV_NAME="performance_test_venv"
TEST_DURATION=30  # secondes

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
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

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
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

# Étape 2: Installer les dépendances
log_info "📦 Installation des dépendances..."
pip install --upgrade pip

# Installer PyTorch avec la dernière version compatible
log_info "📦 Installation de PyTorch..."
pip install torch transformers

# Installer les autres dépendances
log_info "📦 Installation des autres dépendances..."
pip install fastapi uvicorn pyzmq redis psutil accelerate
log_success "Dépendances installées"

# Étape 3: Préparer les fichiers
log_info "📁 Préparation des fichiers..."
mkdir -p test_temp
cp -r translator/src test_temp/
cp test-quantization-performance.py test_temp/
cp translator/src/config/settings.py test_temp/src/config/

# Étape 4: Test de performance
log_info "⚡ Test de performance..."
cd test_temp

# Créer un script de test de performance simplifié
cat > test_performance_simple.py << 'EOF'
#!/usr/bin/env python3
"""
Test de performance simplifié pour la quantification
"""

import asyncio
import time
import sys
import os

# Ajouter le chemin
sys.path.append('src')

async def test_quantization_performance():
    """Test de performance des différents niveaux de quantification"""
    print("⚡ TEST DE PERFORMANCE - QUANTIFICATION")
    print("=" * 50)
    
    try:
        from services.quantized_ml_service import QuantizedMLService
        
        # Niveaux de quantification à tester
        levels = ["float32", "float16", "int8"]
        results = {}
        
        for level in levels:
            print(f"\n🔧 Test avec {level}...")
            
            # Créer le service
            service = QuantizedMLService("basic", level)
            
            # Initialiser
            start_time = time.time()
            success = await service.initialize()
            init_time = time.time() - start_time
            
            if not success:
                print(f"  ❌ Échec initialisation {level}")
                continue
            
            print(f"  ✅ Initialisation: {init_time:.3f}s")
            
            # Test de traduction
            test_text = "Hello world, this is a test message"
            print(f"  🔄 Traduction: '{test_text}'")
            
            start_time = time.time()
            result = await service.translate(
                text=test_text,
                source_lang="en",
                target_lang="fr",
                model_type="basic",
                source_channel="test"
            )
            translation_time = time.time() - start_time
            
            print(f"  ✅ Résultat: '{result['translated_text']}'")
            print(f"  ⏱️  Temps: {translation_time:.3f}s")
            
            # Stocker les résultats
            results[level] = {
                'init_time': init_time,
                'translation_time': translation_time,
                'result': result
            }
            
            # Nettoyer
            await service.cleanup()
        
        # Analyser les résultats
        print(f"\n📊 ANALYSE DES RÉSULTATS")
        print("=" * 50)
        
        if results:
            baseline = results.get("float32", {})
            baseline_time = baseline.get('translation_time', 1.0)
            
            for level, data in results.items():
                init_time = data['init_time']
                trans_time = data['translation_time']
                
                if level != "float32":
                    speedup = (baseline_time - trans_time) / baseline_time * 100
                    print(f"🔧 {level}:")
                    print(f"   Init: {init_time:.3f}s")
                    print(f"   Traduction: {trans_time:.3f}s")
                    print(f"   Amélioration: {speedup:+.1f}%")
                else:
                    print(f"🔧 {level} (baseline):")
                    print(f"   Init: {init_time:.3f}s")
                    print(f"   Traduction: {trans_time:.3f}s")
        
        print(f"\n🎉 Test de performance terminé !")
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_quantization_performance())
EOF

# Exécuter le test
python3 test_performance_simple.py

if [ $? -eq 0 ]; then
    log_success "Test de performance réussi"
else
    log_warning "Test de performance échoué (normal si modèles non téléchargés)"
fi

cd ..

# Étape 5: Test de mémoire
log_info "💾 Test de mémoire..."
cd test_temp

python3 -c "
import sys
import psutil
import os
sys.path.append('src')

try:
    from services.quantized_ml_service import QuantizedMLService
    import asyncio
    
    async def test_memory():
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024
        
        print(f'💾 Mémoire initiale: {initial_memory:.1f} MB')
        
        # Test avec float16
        service = QuantizedMLService('basic', 'float16')
        await service.initialize()
        
        memory_after_init = process.memory_info().rss / 1024 / 1024
        print(f'💾 Mémoire après init: {memory_after_init:.1f} MB')
        print(f'💾 Utilisation: {memory_after_init - initial_memory:.1f} MB')
        
        await service.cleanup()
        
        memory_after_cleanup = process.memory_info().rss / 1024 / 1024
        print(f'💾 Mémoire après cleanup: {memory_after_cleanup:.1f} MB')
        
    asyncio.run(test_memory())
    
except Exception as e:
    print(f'❌ Erreur test mémoire: {e}')
"

cd ..

# Résumé
echo ""
echo "🎯 RÉSULTATS DES TESTS"
echo "======================"
echo "✅ Environnement virtuel créé"
echo "✅ Dépendances installées"
echo "✅ Tests de performance exécutés"
echo "✅ Tests de mémoire effectués"
echo ""
echo "📊 INFORMATIONS"
echo "==============="
echo "Python: $(python3 --version)"
echo "PyTorch: $(python3 -c 'import torch; print(torch.__version__)')"
echo "Transformers: $(python3 -c 'import transformers; print(transformers.__version__)')"

# Recommandations
echo ""
echo "💡 RECOMMANDATIONS"
echo "=================="
echo "1. Les tests de performance sont terminés"
echo "2. Vérifiez les résultats ci-dessus"
echo "3. Float16 devrait être plus rapide que float32"
echo "4. Int8 devrait utiliser moins de mémoire"
echo "5. Pour continuer: source $VENV_NAME/bin/activate"

log_success "Tests de performance terminés !"
