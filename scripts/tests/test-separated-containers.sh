#!/bin/bash

# Script de test pour containers séparés Meeshy
echo "🧪 TEST CONFIGURATION CONTAINERS SÉPARÉS MEESHY"
echo "==============================================="

# Vérifier les fichiers de configuration
echo ""
echo "📁 Vérification des fichiers de configuration :"
echo "-----------------------------------------------"

# Vérifier docker-compose.yml
if grep -q "INTERNAL_BACKEND_URL: http://gateway:3000" docker-compose.yml; then
    echo "✅ docker-compose.yml: INTERNAL_BACKEND_URL configuré correctement"
else
    echo "❌ docker-compose.yml: INTERNAL_BACKEND_URL manquant ou incorrect"
fi

if grep -q "NEXT_PUBLIC_BACKEND_URL.*localhost:3000" docker-compose.yml; then
    echo "✅ docker-compose.yml: NEXT_PUBLIC_BACKEND_URL configuré correctement"
else
    echo "❌ docker-compose.yml: NEXT_PUBLIC_BACKEND_URL manquant ou incorrect"
fi

# Vérifier config.ts
if grep -q "INTERNAL_BACKEND_URL" frontend/lib/config.ts; then
    echo "✅ config.ts: Utilise INTERNAL_BACKEND_URL pour SSR"
else
    echo "❌ config.ts: INTERNAL_BACKEND_URL non utilisé"
fi

if grep -q "NEXT_PUBLIC_BACKEND_URL" frontend/lib/config.ts; then
    echo "✅ config.ts: Utilise NEXT_PUBLIC_BACKEND_URL pour client"
else
    echo "❌ config.ts: NEXT_PUBLIC_BACKEND_URL non utilisé"
fi

echo ""
echo "🔧 Variables d'environnement attendues :"
echo "----------------------------------------"
echo "NEXT_PUBLIC_API_URL=http://localhost:3000"
echo "NEXT_PUBLIC_WS_URL=ws://localhost:3000"
echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:3000 (pour client/navigateur)"
echo "INTERNAL_BACKEND_URL=http://gateway:3000 (pour SSR/containers)"
echo "INTERNAL_WS_URL=ws://gateway:3000 (pour SSR/containers)"

echo ""
echo "📋 Configuration actuelle dans docker-compose.yml :"
echo "---------------------------------------------------"
grep -A 8 -B 2 "INTERNAL_BACKEND_URL\|NEXT_PUBLIC_BACKEND_URL" docker-compose.yml || echo "Aucune variable trouvée"

echo ""
echo "🌐 Architecture des containers :"
echo "-------------------------------"
echo "Frontend Container:"
echo "  - Port exposé: 3100"
echo "  - SSR utilise: http://gateway:3000 (INTERNAL_BACKEND_URL)"
echo "  - Client utilise: http://localhost:3000 (NEXT_PUBLIC_BACKEND_URL)"
echo ""
echo "Gateway Container:"
echo "  - Port exposé: 3000"
echo "  - Nom réseau: gateway"
echo "  - Accessible via: http://localhost:3000"

echo ""
echo "✅ Test de configuration terminé"
