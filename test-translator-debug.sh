#!/bin/bash

echo "🔍 Test de debug du translator..."

# Tester le container avec un script simple
docker run -it --rm --name translator-debug meeshy-unified:test bash -c "
echo '📋 Test 1: Vérification des fichiers...'
cd /app/translator && ls -la start_simple.py

echo '📋 Test 2: Test d importation simple...'
cd /app/translator/src && python -c 'import sys; print(\"Python path:\", sys.path[:3])'

echo '📋 Test 3: Test d importation des modules...'
cd /app/translator/src && python -c 'from config.settings import Settings; print(\"Settings OK\")'

echo '📋 Test 4: Test d exécution avec timeout...'
cd /app/translator && timeout 30 python -u start_simple.py 2>&1 | head -20

echo '📋 Test 5: Vérification des variables d environnement...'
cd /app/translator && env | grep -E '(DATABASE_URL|REDIS_URL|DEBUG|DEVICE)' | head -10
"
