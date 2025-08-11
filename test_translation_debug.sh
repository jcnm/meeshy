#!/bin/bash

echo "🔍 Test de débogage de traduction"
echo "=================================="

# Attendre que les services soient prêts
echo "⏳ Attente des services..."
sleep 5

# Test 1: Vérifier la santé des services
echo ""
echo "🏥 Test 1: Vérification de la santé des services"
echo "------------------------------------------------"

echo "Gateway health:"
curl -s http://localhost:3000/health | jq .

echo ""
echo "Translator health:"
curl -s http://localhost:8000/health | jq .

# Test 2: Test direct du Translator
echo ""
echo "🐍 Test 2: Test direct du Translator"
echo "-----------------------------------"

echo "Requête directe au Translator:"
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "source_language": "en", "target_language": "fr", "model_type": "basic"}' \
  | jq .

# Test 3: Test de la Gateway avec logs
echo ""
echo "🌐 Test 3: Test de la Gateway avec surveillance des logs"
echo "-------------------------------------------------------"

echo "Envoi de la requête de traduction..."
echo ""

# Envoyer la requête et capturer la réponse
RESPONSE=$(curl -s -X POST http://localhost:3000/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "source_language": "en", "target_language": "fr", "conversation_id": "debug-test"}')

echo "Réponse reçue:"
echo "$RESPONSE" | jq .

# Test 4: Vérifier les logs du Translator
echo ""
echo "📋 Test 4: Vérification des logs du Translator"
echo "---------------------------------------------"

if [ -f "translator/translator.log" ]; then
    echo "Dernières lignes du log Translator:"
    tail -10 translator/translator.log
else
    echo "❌ Fichier translator.log non trouvé"
fi

echo ""
echo "✅ Test de débogage terminé"
