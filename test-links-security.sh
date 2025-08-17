#!/bin/bash

# Script de test pour les améliorations du système /links

API_BASE="http://localhost:3000"
HEADERS_CONTENT="Content-Type: application/json"

echo "🧪 Test des améliorations du système /links"
echo "=============================================="

# Test 1: Vérifier la santé du serveur
echo ""
echo "1️⃣ Test de santé du serveur..."
curl -s "$API_BASE/health" | jq '.'

# Test 2: Essayer de créer un lien sans authentification (doit échouer)
echo ""
echo "2️⃣ Test création de lien sans authentification (doit échouer)..."
curl -s -X POST "$API_BASE/links" \
  -H "$HEADERS_CONTENT" \
  -d '{
    "name": "Test Link",
    "description": "Test de création de lien sans auth"
  }' | jq '.'

# Test 3: Test avec un faux Bearer token (doit échouer)
echo ""
echo "3️⃣ Test création de lien avec token invalide (doit échouer)..."
curl -s -X POST "$API_BASE/links" \
  -H "$HEADERS_CONTENT" \
  -H "Authorization: Bearer fake-token-12345" \
  -d '{
    "name": "Test Link",
    "description": "Test de création de lien avec faux token"
  }' | jq '.'

# Test 4: Test du middleware hybride - récupération de lien sans auth (doit échouer)
echo ""
echo "4️⃣ Test récupération de lien sans authentification (doit échouer)..."
curl -s "$API_BASE/links/test-link-id" | jq '.'

# Test 5: Test du middleware hybride avec session token invalide
echo ""
echo "5️⃣ Test récupération de lien avec session token invalide (doit échouer)..."
curl -s "$API_BASE/links/test-link-id" \
  -H "x-session-token: fake-session-token" | jq '.'

# Test 6: Test d'envoi de message sans session token (doit échouer)
echo ""
echo "6️⃣ Test envoi de message sans session token (doit échouer)..."
curl -s -X POST "$API_BASE/links/test-link-id/messages" \
  -H "$HEADERS_CONTENT" \
  -d '{
    "content": "Test message",
    "originalLanguage": "fr"
  }' | jq '.'

# Test 7: Test de mise à jour de lien sans authentification (doit échouer)
echo ""
echo "7️⃣ Test mise à jour de lien sans authentification (doit échouer)..."
curl -s -X PUT "$API_BASE/links/test-link-id" \
  -H "$HEADERS_CONTENT" \
  -d '{
    "name": "Updated Link Name"
  }' | jq '.'

echo ""
echo "🎯 Tests de sécurité terminés !"
echo "✅ Tous les tests ci-dessus doivent retourner des erreurs 401/403"
echo "   car ils testent les middlewares de sécurité sans authentification valide"
echo ""
echo "📋 Résumé des améliorations testées:"
echo "   - ✅ Middleware d'authentification hybride"
echo "   - ✅ Protection POST /links (accessToken requis)"
echo "   - ✅ Protection GET /links/:id (hybride: accessToken OU sessionToken)"
echo "   - ✅ Protection POST /links/:id/messages (sessionToken requis)"
echo "   - ✅ Protection PUT /links/:id (accessToken requis)"
echo ""
echo "🔗 Pour tester avec de vrais tokens, utilisez d'abord:"
echo "   POST /auth/login pour obtenir un accessToken"
echo "   POST /anonymous/join/:linkId pour obtenir un sessionToken"
