#!/bin/bash

# Script de test pour vérifier la résolution du problème de rate limiting
# sur la page conversations

echo "🧪 Test de la page conversations après correction du rate limiting"
echo "=================================================="

echo "1. Vérification que les serveurs sont démarrés..."
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "❌ Backend non accessible sur le port 3000"
    exit 1
fi

if ! curl -s http://localhost:3001 > /dev/null; then
    echo "❌ Frontend non accessible sur le port 3001"
    exit 1
fi

echo "✅ Serveurs démarrés"

echo ""
echo "2. Test de l'endpoint conversations..."

# Test avec un token valide (utilisateur alice)
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}' | \
  grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Impossible d'obtenir un token d'authentification"
    exit 1
fi

echo "✅ Token obtenu: ${TOKEN:0:20}..."

echo ""
echo "3. Test de l'endpoint /conversations (plusieurs requêtes pour tester le rate limiting)..."

for i in {1..5}; do
    echo "Requête $i..."
    RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/response_$i.json \
      -H "Authorization: Bearer $TOKEN" \
      http://localhost:3000/conversations)
    
    if [ "$RESPONSE" = "200" ]; then
        echo "✅ Requête $i: 200 OK"
    elif [ "$RESPONSE" = "429" ]; then
        echo "⚠️  Requête $i: 429 Too Many Requests"
    else
        echo "❌ Requête $i: $RESPONSE"
    fi
    
    # Attendre un peu entre les requêtes
    sleep 0.2
done

echo ""
echo "4. Vérification du contenu de la réponse..."
if [ -f "/tmp/response_1.json" ]; then
    CONVERSATIONS_COUNT=$(cat /tmp/response_1.json | grep -o '"conversations":\[.*\]' | grep -o '\[.*\]' | grep -o ',' | wc -l)
    echo "✅ Nombre de conversations trouvées: $((CONVERSATIONS_COUNT + 1))"
else
    echo "❌ Aucune réponse trouvée"
fi

echo ""
echo "5. Nettoyage..."
rm -f /tmp/response_*.json

echo ""
echo "🎯 Test terminé ! Si vous voyez principalement des 200 OK, le problème est résolu."
echo "Si vous voyez des 429, le rate limiting est encore déclenché."
