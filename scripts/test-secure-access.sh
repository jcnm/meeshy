#!/bin/bash

# Script de test des accès sécurisés Meeshy
# Usage: ./test-secure-access.sh [domain]

DOMAIN=${1:-meeshy.me}

echo "🔒 Test des accès sécurisés pour Meeshy sur ${DOMAIN}"
echo "=================================================="

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function pour tester l'accès sécurisé
test_secure_access() {
    local service_name=$1
    local url=$2
    local expected_status=$3
    
    echo -n "🔍 Test ${service_name}: "
    
    # Test sans authentification (doit retourner 401)
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ Sécurisé (${response})${NC}"
        return 0
    else
        echo -e "${RED}❌ Non sécurisé (${response})${NC}"
        return 1
    fi
}

# Function pour tester l'accès public
test_public_access() {
    local service_name=$1
    local url=$2
    
    echo -n "🌐 Test ${service_name}: "
    
    # Test d'accès public (doit retourner 200 ou 3xx)
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}")
    
    if [[ "$response" =~ ^[23][0-9][0-9]$ ]]; then
        echo -e "${GREEN}✅ Accessible (${response})${NC}"
        return 0
    else
        echo -e "${RED}❌ Non accessible (${response})${NC}"
        return 1
    fi
}

echo ""
echo "🔐 SERVICES SÉCURISÉS (doivent retourner 401 sans authentification)"
echo "----------------------------------------------------------------"

# Test des services sécurisés
test_secure_access "Traefik Dashboard" "https://traefik.${DOMAIN}" "401"
test_secure_access "MongoDB Interface" "https://mongo.${DOMAIN}" "401"
test_secure_access "Redis Interface" "https://redis.${DOMAIN}" "401"

echo ""
echo "🌍 SERVICES PUBLICS (doivent être accessibles)"
echo "----------------------------------------------"

# Test des services publics
test_public_access "Frontend Principal" "https://${DOMAIN}"
test_public_access "API Gateway" "https://gate.${DOMAIN}/health"
test_public_access "Service ML" "https://ml.${DOMAIN}/health"

echo ""
echo "🔧 TEST AVEC AUTHENTIFICATION"
echo "-----------------------------"

# Vérifier si les variables d'environnement sont définies
if [ -f ".env" ]; then
    echo "📋 Variables d'authentification trouvées dans .env"
    
    # Extraire les utilisateurs depuis .env (format simplifié)
    if grep -q "TRAEFIK_USERS=" .env; then
        echo "   ✅ TRAEFIK_USERS configuré"
    else
        echo "   ❌ TRAEFIK_USERS non configuré"
    fi
    
    if grep -q "MONGO_USERS=" .env; then
        echo "   ✅ MONGO_USERS configuré"
    else
        echo "   ❌ MONGO_USERS non configuré"
    fi
    
    if grep -q "REDIS_USERS=" .env; then
        echo "   ✅ REDIS_USERS configuré"
    else
        echo "   ❌ REDIS_USERS non configuré"
    fi
else
    echo "❌ Fichier .env non trouvé"
fi

echo ""
echo "💡 CONSEILS DE SÉCURITÉ"
echo "----------------------"
echo "1. Vérifiez que tous les services sécurisés retournent 401"
echo "2. Assurez-vous que les services publics sont accessibles"
echo "3. Testez l'authentification avec vos identifiants"
echo "4. Surveillez les logs d'accès avec: docker logs meeshy-traefik"

# Test de connectivité réseau
echo ""
echo "🌐 TEST DE CONNECTIVITÉ"
echo "----------------------"

for subdomain in traefik mongo redis gate ml ""; do
    if [ -z "$subdomain" ]; then
        host="${DOMAIN}"
    else
        host="${subdomain}.${DOMAIN}"
    fi
    
    echo -n "📡 DNS ${host}: "
    if nslookup "${host}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Résolu${NC}"
    else
        echo -e "${RED}❌ Non résolu${NC}"
    fi
done

echo ""
echo "🏁 Test terminé. Vérifiez les résultats ci-dessus."
echo "   Pour tester avec authentification:"
echo "   curl -u username:password https://traefik.${DOMAIN}"
