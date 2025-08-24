#!/bin/bash

# Script de test pour l'environnement de développement local

echo "🧪 Test de l'environnement de développement local..."

# Activer l'environnement virtuel
source .venv/bin/activate

# Test 1: Vérifier Python et les dépendances
echo "✅ Test 1: Vérification Python et dépendances..."
python --version
pip list | grep -E "(torch|transformers|fastapi|uvicorn|pyzmq|prisma)" | head -10

# Test 2: Vérifier la structure des dossiers
echo "✅ Test 2: Vérification de la structure..."
ls -la src/
ls -la models/
ls -la ../shared/

# Test 3: Test de génération Prisma
echo "✅ Test 3: Test de génération Prisma..."
prisma generate --schema=../shared/schema.prisma

# Test 4: Test d'import des modules
echo "✅ Test 4: Test d'import des modules..."
python -c "
import sys
sys.path.insert(0, 'src')
try:
    from config.settings import get_settings
    from services.quantized_ml_service import QuantizedMLService
    print('✅ Imports réussis')
except Exception as e:
    print(f'❌ Erreur d\'import: {e}')
"

# Test 5: Test de configuration
echo "✅ Test 5: Test de configuration..."
python -c "
import sys
sys.path.insert(0, 'src')
try:
    from config.settings import get_settings
    settings = get_settings()
    print(f'✅ Configuration chargée: DEBUG={settings.debug}, WORKERS={settings.workers}')
except Exception as e:
    print(f'❌ Erreur de configuration: {e}')
"

echo "�� Tests terminés !"
