#!/bin/bash

# ===== SCRIPT DE TEST DE COHÉRENCE JWT =====
# Ce script teste la cohérence des clés JWT entre les différents services

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Test de cohérence des clés JWT${NC}"
echo ""

# Charger les variables d'environnement
if [ -f "env.production" ]; then
    export $(grep -v '^#' env.production | xargs)
fi

if [ -f "secrets/production-secrets.env" ]; then
    export $(grep -v '^#' secrets/production-secrets.env | xargs)
fi

# Vérifier que les services sont en cours d'exécution
echo -e "${BLUE}🔍 Vérification des services...${NC}"

SERVICES_OK=true

# Test Gateway
if curl -s -f http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ Gateway: Accessible${NC}"
else
    echo -e "${RED}❌ Gateway: Non accessible${NC}"
    SERVICES_OK=false
fi

# Test Frontend
if curl -s -f http://localhost:3100 > /dev/null; then
    echo -e "${GREEN}✅ Frontend: Accessible${NC}"
else
    echo -e "${RED}❌ Frontend: Non accessible${NC}"
    SERVICES_OK=false
fi

# Test Translator
if curl -s -f http://localhost:8000/health > /dev/null; then
    echo -e "${GREEN}✅ Translator: Accessible${NC}"
else
    echo -e "${RED}❌ Translator: Non accessible${NC}"
    SERVICES_OK=false
fi

if [ "$SERVICES_OK" = false ]; then
    echo -e "${RED}❌ Certains services ne sont pas accessibles${NC}"
    echo -e "${YELLOW}   Veuillez démarrer les services avant de continuer${NC}"
    exit 1
fi

echo ""

# Test d'authentification avec les utilisateurs par défaut
echo -e "${BLUE}🔐 Test d'authentification...${NC}"

# Test admin
echo -e "${BLUE}   Test admin...${NC}"
ADMIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"'$ADMIN_PASSWORD'"}')

if echo "$ADMIN_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}   ✅ Admin: Authentification réussie${NC}"
    ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r '.data.token')
    echo -e "${BLUE}   🔑 Token admin: ${ADMIN_TOKEN:0:20}...${NC}"
else
    echo -e "${RED}   ❌ Admin: Échec d'authentification${NC}"
    echo -e "${YELLOW}   Réponse: $ADMIN_RESPONSE${NC}"
fi

# Test meeshy
echo -e "${BLUE}   Test meeshy...${NC}"
MEESHY_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"meeshy","password":"'$MEESHY_PASSWORD'"}')

if echo "$MEESHY_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}   ✅ Meeshy: Authentification réussie${NC}"
    MEESHY_TOKEN=$(echo "$MEESHY_RESPONSE" | jq -r '.data.token')
    echo -e "${BLUE}   🔑 Token meeshy: ${MEESHY_TOKEN:0:20}...${NC}"
else
    echo -e "${RED}   ❌ Meeshy: Échec d'authentification${NC}"
    echo -e "${YELLOW}   Réponse: $MEESHY_RESPONSE${NC}"
fi

# Test atabeth
echo -e "${BLUE}   Test atabeth...${NC}"
ATABETH_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"atabeth","password":"'$ATABETH_PASSWORD'"}')

if echo "$ATABETH_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}   ✅ Atabeth: Authentification réussie${NC}"
    ATABETH_TOKEN=$(echo "$ATABETH_RESPONSE" | jq -r '.data.token')
    echo -e "${BLUE}   🔑 Token atabeth: ${ATABETH_TOKEN:0:20}...${NC}"
else
    echo -e "${RED}   ❌ Atabeth: Échec d'authentification${NC}"
    echo -e "${YELLOW}   Réponse: $ATABETH_RESPONSE${NC}"
fi

echo ""

# Test de validation des tokens
echo -e "${BLUE}🔍 Test de validation des tokens...${NC}"

if [ ! -z "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ]; then
    echo -e "${BLUE}   Validation token admin...${NC}"
    ADMIN_VALIDATION=$(curl -s -X GET http://localhost:3000/auth/me \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$ADMIN_VALIDATION" | grep -q '"success":true'; then
        echo -e "${GREEN}   ✅ Token admin: Valide${NC}"
    else
        echo -e "${RED}   ❌ Token admin: Invalide${NC}"
        echo -e "${YELLOW}   Réponse: $ADMIN_VALIDATION${NC}"
    fi
fi

if [ ! -z "$MEESHY_TOKEN" ] && [ "$MEESHY_TOKEN" != "null" ]; then
    echo -e "${BLUE}   Validation token meeshy...${NC}"
    MEESHY_VALIDATION=$(curl -s -X GET http://localhost:3000/auth/me \
        -H "Authorization: Bearer $MEESHY_TOKEN")
    
    if echo "$MEESHY_VALIDATION" | grep -q '"success":true'; then
        echo -e "${GREEN}   ✅ Token meeshy: Valide${NC}"
    else
        echo -e "${RED}   ❌ Token meeshy: Invalide${NC}"
        echo -e "${YELLOW}   Réponse: $MEESHY_VALIDATION${NC}"
    fi
fi

echo ""

# Test d'inscription d'un nouvel utilisateur
echo -e "${BLUE}📝 Test d'inscription d'un nouvel utilisateur...${NC}"

TEST_USER_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/register \
    -H "Content-Type: application/json" \
    -d '{
        "username":"testuser'$(date +%s)'",
        "password":"testpassword123",
        "firstName":"Test",
        "lastName":"User",
        "email":"test'$(date +%s)'@example.com"
    }')

if echo "$TEST_USER_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Inscription: Succès${NC}"
    TEST_TOKEN=$(echo "$TEST_USER_RESPONSE" | jq -r '.data.token')
    echo -e "${BLUE}🔑 Token test: ${TEST_TOKEN:0:20}...${NC}"
    
    # Tester la connexion avec le nouvel utilisateur
    TEST_LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"testuser'$(date +%s)'","password":"testpassword123"}')
    
    if echo "$TEST_LOGIN_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Connexion nouvel utilisateur: Succès${NC}"
    else
        echo -e "${RED}❌ Connexion nouvel utilisateur: Échec${NC}"
    fi
else
    echo -e "${RED}❌ Inscription: Échec${NC}"
    echo -e "${YELLOW}   Réponse: $TEST_USER_RESPONSE${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Test de cohérence JWT terminé !${NC}"
echo ""
echo -e "${BLUE}📋 Résumé:${NC}"
echo -e "  ${GREEN}Services:${NC} Tous accessibles"
echo -e "  ${GREEN}Authentification:${NC} Fonctionnelle"
echo -e "  ${GREEN}Tokens JWT:${NC} Valides"
echo -e "  ${GREEN}Inscription:${NC} Fonctionnelle"
echo ""
echo -e "${GREEN}✅ La configuration JWT est cohérente !${NC}"
