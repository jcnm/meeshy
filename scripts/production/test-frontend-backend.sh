#!/bin/bash

# ===== SCRIPT DE TEST FRONTEND-BACKEND =====
# Ce script teste la communication entre le frontend et le backend

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Test de Communication Frontend-Backend${NC}"
echo ""

# Vérifier que l'IP du droplet est fournie
if [ -z "$1" ]; then
    echo -e "${RED}❌ Usage: $0 DROPLET_IP${NC}"
    echo -e "${YELLOW}Exemple: $0 157.230.15.51${NC}"
    exit 1
fi

DROPLET_IP="$1"

echo -e "${BLUE}🎯 Cible: ${YELLOW}$DROPLET_IP${NC}"
echo ""

# Fonction pour afficher le statut
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

echo -e "${BLUE}🔍 Test 1: Accessibilité du Frontend${NC}"
if curl -s -f https://meeshy.me > /dev/null; then
    log_success "Frontend accessible sur https://meeshy.me"
else
    log_error "Frontend non accessible"
    exit 1
fi

echo ""
echo -e "${BLUE}🔍 Test 2: Accessibilité du Gateway${NC}"
if curl -s -f https://gate.meeshy.me/health > /dev/null; then
    log_success "Gateway accessible sur https://gate.meeshy.me"
else
    log_error "Gateway non accessible"
    exit 1
fi

echo ""
echo -e "${BLUE}🔍 Test 3: Santé du Gateway${NC}"
HEALTH_RESPONSE=$(curl -s https://gate.meeshy.me/health | jq -r '.status' 2>/dev/null || echo "error")
if [ "$HEALTH_RESPONSE" = "healthy" ]; then
    log_success "Gateway en bonne santé"
else
    log_error "Gateway en mauvaise santé: $HEALTH_RESPONSE"
fi

echo ""
echo -e "${BLUE}🔍 Test 4: Test d'inscription via API${NC}"
REGISTER_RESPONSE=$(curl -s -X POST https://gate.meeshy.me/auth/register \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser'$(date +%s)'","password":"password123","firstName":"Test","lastName":"User","email":"test'$(date +%s)'@example.com"}' \
    | jq -r '.success' 2>/dev/null || echo "error")

if [ "$REGISTER_RESPONSE" = "true" ]; then
    log_success "Inscription via API fonctionnelle"
else
    log_error "Inscription via API échouée: $REGISTER_RESPONSE"
fi

echo ""
echo -e "${BLUE}🔍 Test 5: Test de connexion via API${NC}"
LOGIN_RESPONSE=$(curl -s -X POST https://gate.meeshy.me/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser123","password":"password123"}' \
    | jq -r '.success' 2>/dev/null || echo "error")

if [ "$LOGIN_RESPONSE" = "true" ]; then
    log_success "Connexion via API fonctionnelle"
else
    log_warning "Connexion via API échouée: $LOGIN_RESPONSE (utilisateur peut ne pas exister)"
fi

echo ""
echo -e "${BLUE}🔍 Test 6: Configuration CORS${NC}"
CORS_TEST=$(curl -s -H "Origin: https://meeshy.me" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" \
    -X OPTIONS https://gate.meeshy.me/auth/register \
    -w "%{http_code}" -o /dev/null)

if [ "$CORS_TEST" = "200" ] || [ "$CORS_TEST" = "204" ]; then
    log_success "Configuration CORS correcte"
else
    log_warning "Configuration CORS problématique: HTTP $CORS_TEST"
fi

echo ""
echo -e "${BLUE}🔍 Test 7: Variables d'environnement Frontend${NC}"
FRONTEND_API_URL=$(ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker exec meeshy-frontend env | grep NEXT_PUBLIC_API_URL | cut -d'=' -f2" 2>/dev/null || echo "error")
if [ "$FRONTEND_API_URL" = "https://gate.meeshy.me" ]; then
    log_success "Configuration API Frontend correcte: $FRONTEND_API_URL"
else
    log_error "Configuration API Frontend incorrecte: $FRONTEND_API_URL"
fi

echo ""
echo -e "${BLUE}🔍 Test 8: Variables d'environnement Gateway${NC}"
GATEWAY_JWT=$(ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker exec meeshy-gateway env | grep JWT_SECRET | cut -d'=' -f2" 2>/dev/null || echo "error")
if [ -n "$GATEWAY_JWT" ] && [ "$GATEWAY_JWT" != "CHANGE_ME_JWT_SECRET" ]; then
    log_success "JWT_SECRET configuré dans le Gateway"
else
    log_error "JWT_SECRET non configuré dans le Gateway: $GATEWAY_JWT"
fi

echo ""
echo -e "${BLUE}🔍 Test 9: Statut des Services${NC}"
SERVICES_STATUS=$(ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cd /opt/meeshy && docker-compose ps --format json" 2>/dev/null | jq -r '.[] | select(.Service | contains("frontend") or contains("gateway")) | "\(.Service): \(.State)"' || echo "error")

if [ "$SERVICES_STATUS" != "error" ]; then
    log_success "Statut des services:"
    echo "$SERVICES_STATUS" | while read line; do
        echo "  • $line"
    done
else
    log_error "Impossible de récupérer le statut des services"
fi

echo ""
echo -e "${GREEN}🎉 Tests terminés !${NC}"
echo ""
echo -e "${YELLOW}💡 Si des tests échouent:${NC}"
echo -e "  • Vérifiez les logs: ${BLUE}docker logs meeshy-gateway${NC}"
echo -e "  • Vérifiez les logs: ${BLUE}docker logs meeshy-frontend${NC}"
echo -e "  • Redémarrez les services: ${BLUE}docker-compose restart${NC}"
echo -e "  • Videz le cache du navigateur (Ctrl+F5)"
echo ""
