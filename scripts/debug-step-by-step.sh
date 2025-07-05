#!/bin/bash

# Script de test step-by-step pour déboguer Meeshy
echo "🧪 Test Step-by-Step du Système Meeshy"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== ÉTAPE 1: Test des Services de Base ===${NC}"

# Test 1.1: API Backend
echo -e "${YELLOW}🔄 Test 1.1: API Backend...${NC}"
if curl -s "http://localhost:3100/users" > /dev/null; then
  echo -e "${GREEN}✅ Backend accessible${NC}"
else
  echo -e "${RED}❌ Backend non accessible${NC}"
  echo "Démarrez le backend avec: cd backend && npm run start:dev"
  exit 1
fi

# Test 1.2: Frontend
echo -e "${YELLOW}🔄 Test 1.2: Frontend...${NC}"
if curl -s "http://localhost:3001" > /dev/null; then
  echo -e "${GREEN}✅ Frontend accessible${NC}"
else
  echo -e "${RED}❌ Frontend non accessible${NC}"
  echo "Démarrez le frontend avec: npm run dev"
  exit 1
fi

# Test 1.3: API de traduction externe
echo -e "${YELLOW}🔄 Test 1.3: API de traduction externe...${NC}"
translation_result=$(curl -s "https://api.mymemory.translated.net/get?q=Hello&langpair=en|fr")
if echo "$translation_result" | grep -q "Bonjour\|Salut"; then
  echo -e "${GREEN}✅ API de traduction fonctionnelle${NC}"
else
  echo -e "${RED}❌ API de traduction non disponible${NC}"
  echo "Résultat: $translation_result"
fi

echo ""
echo -e "${BLUE}=== ÉTAPE 2: Tests Manuels Recommandés ===${NC}"
echo "1. Ouvrir http://localhost:3001/test dans votre navigateur"
echo "2. Ouvrir les outils de développement (F12)"
echo "3. Aller dans l'onglet 'Gestion des Modèles'"
echo "4. Cliquer sur 'Télécharger' pour un modèle MT5-small"
echo "5. Vérifier les logs dans la console (messages 🔄, ✅)"
echo "6. Aller dans l'onglet 'Test de Traduction'"
echo "7. Entrer 'Hello' et traduire vers français"
echo "8. Vérifier le résultat"

echo ""
echo -e "${BLUE}=== ÉTAPE 3: Logs à Surveiller ===${NC}"
echo "Console navigateur (F12):"
echo "  - 🔄 Téléchargement simulé en cours..."
echo "  - ✅ Modèle téléchargé avec succès"
echo "  - 🤖 Tentative de traduction..."
echo "  - ✅ Traduction réussie avec API"

echo ""
echo "Logs terminal frontend:"
echo "  - Compilation réussie"
echo "  - Pas d'erreurs TypeScript"

echo ""
echo "Logs terminal backend:"
echo "  - Application Nest démarrée"
echo "  - WebSocket Gateway actif"

echo ""
echo -e "${GREEN}🎯 Points de Test Critique:${NC}"
echo "1. Le téléchargement de modèle affiche-t-il une barre de progression ?"
echo "2. Après téléchargement, le modèle apparaît-il comme 'Téléchargé' ?"
echo "3. La traduction fonctionne-t-elle (même avec l'API fallback) ?"
echo "4. Y a-t-il des erreurs dans la console ?"

echo ""
echo -e "${YELLOW}📝 Pour signaler un problème:${NC}"
echo "1. Copiez les logs d'erreur exacts"
echo "2. Indiquez à quelle étape l'erreur survient"
echo "3. Vérifiez la console du navigateur ET les terminaux"
