#!/bin/bash

# Test du middleware d'authentification unifié
echo "🔐 Test du middleware d'authentification unifié Phase 3.1.1"
echo "=================================================="

# Test 1: JWT Token (utilisateur enregistré)
echo ""
echo "📋 Test 1: JWT Token (utilisateur enregistré)"
curl -s -X GET "http://localhost:3000/test-auth-type" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MzM2ODAyMzN9.signature" \
  | jq '.' 2>/dev/null || echo "Response: $(curl -s -X GET "http://localhost:3000/test-auth-type" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MzM2ODAyMzN9.signature")"

# Test 2: Session Token (utilisateur anonyme)
echo ""
echo "📋 Test 2: Session Token (utilisateur anonyme)"
curl -s -X GET "http://localhost:3000/test-auth-type" \
  -H "X-Session-Token: anonymous-session-12345" \
  | jq '.' 2>/dev/null || echo "Response: $(curl -s -X GET "http://localhost:3000/test-auth-type" -H "X-Session-Token: anonymous-session-12345")"

# Test 3: Aucun token (non authentifié)
echo ""
echo "📋 Test 3: Aucun token (non authentifié)"
curl -s -X GET "http://localhost:3000/test-auth-type" \
  | jq '.' 2>/dev/null || echo "Response: $(curl -s -X GET "http://localhost:3000/test-auth-type")"

# Test 4: Vérification du health endpoint avec JWT
echo ""
echo "📋 Test 4: Health endpoint avec JWT"
curl -s -X GET "http://localhost:3000/health" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MzM2ODAyMzN9.signature" \
  | jq '.' 2>/dev/null || echo "Response: $(curl -s -X GET "http://localhost:3000/health" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MzM2ODAyMzN9.signature")"

echo ""
echo "=================================================="
echo "✅ Tests du middleware d'authentification unifié terminés"
echo ""
echo "📝 Rappel - Types d'authentification:"
echo "   • JWT Token (Authorization: Bearer xxx) = Utilisateurs enregistrés"
echo "   • X-Session-Token = Utilisateurs anonymes"
echo "   • Aucun token = Non authentifié"
