#!/bin/bash

# Script pour tester l'authentification robuste Meeshy
# Phase 3.1.1 - JWT vs Session Token Detection

echo "🧪 Test de l'authentification robuste Meeshy"
echo "=============================================="

GATEWAY_URL="http://localhost:3100"

echo ""
echo "1️⃣ Test sans authentification (anonyme)"
echo "------------------------------------------"
curl -X GET "$GATEWAY_URL/test-auth" \
    -H "Content-Type: application/json" \
    -w "\nStatus: %{http_code}\n" -s | jq .

echo ""
echo "2️⃣ Test avec JWT Token (utilisateur enregistré)"
echo "------------------------------------------------"
JWT_TOKEN="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MzM2ODAyMzN9.test"

curl -X GET "$GATEWAY_URL/test-auth" \
    -H "Authorization: $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -w "\nStatus: %{http_code}\n" -s | jq .

echo ""
echo "3️⃣ Test avec Session Token (utilisateur anonyme)"
echo "-------------------------------------------------"
SESSION_TOKEN="session_abc123def456"

curl -X GET "$GATEWAY_URL/test-auth" \
    -H "X-Session-Token: $SESSION_TOKEN" \
    -H "Content-Type: application/json" \
    -w "\nStatus: %{http_code}\n" -s | jq .

echo ""
echo "4️⃣ Test avec les deux tokens (conflit)"
echo "--------------------------------------"
curl -X GET "$GATEWAY_URL/test-auth" \
    -H "Authorization: $JWT_TOKEN" \
    -H "X-Session-Token: $SESSION_TOKEN" \
    -H "Content-Type: application/json" \
    -w "\nStatus: %{http_code}\n" -s | jq .

echo ""
echo "5️⃣ Test du endpoint simplifié (/test-auth-type)"
echo "------------------------------------------------"
curl -X GET "$GATEWAY_URL/test-auth-type" \
    -H "Authorization: $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -w "\nStatus: %{http_code}\n" -s | jq .

echo ""
echo "✅ Tests terminés. L'authentification robuste détecte:"
echo "   - JWT Token = Utilisateur enregistré"
echo "   - X-Session-Token = Utilisateur anonyme"
echo "   - Aucun token = Requête non authentifiée"
