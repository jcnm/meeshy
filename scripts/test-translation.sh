#!/bin/bash

# Script de test complet pour Meeshy
echo "🚀 Test complet du système Meeshy"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Plan de test:${NC}"
echo "1. Test de détection de langue"
echo "2. Test de téléchargement de modèles (mode test)"
echo "3. Test de traduction avec modèles simulés"
echo "4. Test de traduction avec API fallback"
echo "5. Test du cache de traduction"
echo ""

# Test 1: Détection de langue
echo -e "${YELLOW}🔍 Test 1: Détection de langue${NC}"
node -e "
const { detectLanguage } = require('./src/utils/translation.ts');

const tests = [
  { text: 'Hello how are you?', expected: 'en' },
  { text: 'Bonjour comment allez-vous?', expected: 'fr' },
  { text: 'Hola ¿cómo estás?', expected: 'es' },
  { text: 'Guten Tag wie geht es dir?', expected: 'de' }
];

tests.forEach(test => {
  const detected = detectLanguage(test.text);
  const status = detected === test.expected ? '✅' : '❌';
  console.log(\`\${status} \"\${test.text}\" → \${detected} (attendu: \${test.expected})\`);
});
" 2>/dev/null || echo -e "${RED}❌ Test de détection échoué (nécessite compilation TypeScript)${NC}"

# Test 2: Vérifier l'API de traduction directement
echo -e "${YELLOW}🌐 Test 2: API de traduction directe${NC}"
echo "Test de traduction EN→FR..."
result=$(curl -s "https://api.mymemory.translated.net/get?q=Hello&langpair=en|fr" | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
if (data.responseStatus === 200) {
  console.log('✅ API fonctionnelle:', data.responseData.translatedText);
} else {
  console.log('❌ API échoué:', data);
}
" 2>/dev/null) || echo -e "${RED}❌ Test API échoué${NC}"

# Test 3: Vérifier les dépendances
echo -e "${YELLOW}📦 Test 3: Vérifications des dépendances${NC}"

# Vérifier TensorFlow.js
if npm list @tensorflow/tfjs > /dev/null 2>&1; then
  echo "✅ TensorFlow.js installé"
else
  echo "❌ TensorFlow.js manquant"
fi

# Vérifier les composants UI
if npm list @radix-ui/react-tabs > /dev/null 2>&1; then
  echo "✅ Composants UI installés"
else
  echo "❌ Composants UI manquants"
fi

# Test 4: Services en cours
echo -e "${YELLOW}🔄 Test 4: Services en cours${NC}"

# Vérifier frontend
if curl -s http://localhost:3001 > /dev/null; then
  echo "✅ Frontend disponible (port 3001)"
else
  echo "❌ Frontend non accessible"
fi

# Vérifier backend
if curl -s http://localhost:3100/users > /dev/null; then
  echo "✅ Backend disponible (port 3002)"
else
  echo "❌ Backend non accessible"
fi

echo ""
echo -e "${GREEN}🎯 Test Manuel Recommandé:${NC}"
echo "1. Ouvrir http://localhost:3001/test"
echo "2. Aller dans l'onglet 'Gestion des Modèles'"
echo "3. Télécharger un modèle MT5-small"
echo "4. Aller dans l'onglet 'Test de Traduction'"
echo "5. Tester: 'Hello' (en) → français"
echo "6. Vérifier que la traduction fonctionne"
echo ""

echo -e "${BLUE}📁 Fichiers de logs à vérifier:${NC}"
echo "- Console du navigateur (F12)"
echo "- Terminal du frontend (Next.js)"
echo "- Terminal du backend (NestJS)"
