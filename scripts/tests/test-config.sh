#!/bin/bash

# Script de test de configuration pour Meeshy
echo "🧪 TEST DE CONFIGURATION MEESHY"
echo "================================"

# Vérifier les fichiers de configuration
echo ""
echo "📁 Vérification des fichiers de configuration :"
echo "-----------------------------------------------"

# Vérifier docker-compose.unified.yml
if grep -q "INTERNAL_BACKEND_URL=http://localhost:3000" docker-compose.unified.yml; then
    echo "✅ docker-compose.unified.yml: INTERNAL_BACKEND_URL configuré correctement"
else
    echo "❌ docker-compose.unified.yml: INTERNAL_BACKEND_URL manquant ou incorrect"
fi

# Vérifier frontend.conf
if grep -q "INTERNAL_BACKEND_URL.*localhost:3000" docker/supervisor/frontend.conf; then
    echo "✅ frontend.conf: INTERNAL_BACKEND_URL configuré correctement"
else
    echo "❌ frontend.conf: INTERNAL_BACKEND_URL manquant ou incorrect"
fi

# Vérifier config.ts
if grep -q "INTERNAL_BACKEND_URL" frontend/lib/config.ts; then
    echo "✅ config.ts: Utilise INTERNAL_BACKEND_URL"
else
    echo "❌ config.ts: INTERNAL_BACKEND_URL non utilisé"
fi

echo ""
echo "🔧 Variables d'environnement attendues :"
echo "----------------------------------------"
echo "NEXT_PUBLIC_API_URL=http://localhost/api"
echo "NEXT_PUBLIC_WS_URL=ws://localhost/ws"
echo "NEXT_PUBLIC_BACKEND_URL=http://localhost/api"
echo "INTERNAL_BACKEND_URL=http://localhost:3000"
echo "INTERNAL_WS_URL=ws://localhost:3000"

echo ""
echo "📋 Configuration actuelle dans docker-compose.unified.yml :"
echo "-----------------------------------------------------------"
grep -A 5 -B 5 "NEXT_PUBLIC\|INTERNAL" docker-compose.unified.yml || echo "Aucune variable trouvée"

echo ""
echo "📋 Configuration actuelle dans frontend.conf :"
echo "----------------------------------------------"
grep "environment=" docker/supervisor/frontend.conf || echo "Variable environment non trouvée"

echo ""
echo "✅ Test de configuration terminé"


