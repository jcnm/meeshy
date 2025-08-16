#!/bin/bash

echo "🔍 Diagnostic d'authentification Meeshy"
echo "======================================"

# Vérifier si les services sont en cours d'exécution
echo "📋 Vérification des services..."

# Vérifier le gateway
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Gateway (port 3000) - OK"
else
    echo "❌ Gateway (port 3000) - Non accessible"
    echo "   Démarrez avec: ./start_meeshy_services.sh"
fi

# Vérifier le frontend
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo "✅ Frontend (port 3001) - OK"
else
    echo "❌ Frontend (port 3001) - Non accessible"
    echo "   Démarrez avec: ./start_meeshy_services.sh"
fi

echo ""
echo "🧪 Tests d'authentification"
echo "=========================="

# Test de connexion
echo "🔐 Test de connexion..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice_fr","password":"password123"}')

echo "Réponse de connexion:"
echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"

# Extraire le token si la connexion réussit
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // empty' 2>/dev/null)

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo ""
    echo "✅ Connexion réussie, token obtenu"
    echo "🔑 Token: ${TOKEN:0:20}..."
    
    echo ""
    echo "👤 Test de vérification /auth/me..."
    AUTH_RESPONSE=$(curl -s -X GET http://localhost:3000/auth/me \
      -H "Authorization: Bearer $TOKEN")
    
    echo "Réponse /auth/me:"
    echo "$AUTH_RESPONSE" | jq '.' 2>/dev/null || echo "$AUTH_RESPONSE"
    
    # Vérifier si la réponse contient un utilisateur
    USER_ID=$(echo "$AUTH_RESPONSE" | jq -r '.data.user.id // .user.id // empty' 2>/dev/null)
    
    if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
        echo "✅ Vérification réussie, utilisateur: $USER_ID"
    else
        echo "❌ Vérification échouée, pas d'utilisateur trouvé"
    fi
else
    echo "❌ Échec de la connexion"
fi

echo ""
echo "🌐 URLs de test"
echo "=============="
echo "Frontend: http://localhost:3001"
echo "Page de login: http://localhost:3001/login"
echo "Page de conversations: http://localhost:3001/conversations"
echo "Page de statut auth: http://localhost:3001/auth-status"
echo "Test API HTML: http://localhost:3001/test-auth-api.html"

echo ""
echo "📝 Instructions de débogage"
echo "=========================="
echo "1. Ouvrez http://localhost:3001/auth-status dans votre navigateur"
echo "2. Vérifiez les logs dans la console du navigateur (F12)"
echo "3. Testez la connexion via http://localhost:3001/login"
echo "4. Naviguez vers /conversations et observez les logs"
echo "5. Utilisez http://localhost:3001/test-auth-api.html pour tester l'API"

echo ""
echo "🔧 Commandes utiles"
echo "=================="
echo "Redémarrer les services: ./start_meeshy_services.sh"
echo "Voir les logs gateway: ./monitor_gateway_logs.sh"
echo "Voir les logs frontend: ./monitor_logs.sh"
echo "Nettoyer tout: ./kill-all-meeshy.sh"
