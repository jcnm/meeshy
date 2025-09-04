#!/bin/bash

# Script de vérification de la production
# Vérifie que tous les services fonctionnent correctement

set -e

echo "🔍 Vérification de la production Meeshy"
echo "======================================"

# Fonction pour tester une URL
test_url() {
    local url=$1
    local description=$2
    
    echo "Testing $description: $url"
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|301\|302"; then
        echo "✅ $description: OK"
        return 0
    else
        echo "❌ $description: FAILED"
        return 1
    fi
}

# Fonction pour tester les services Docker
test_docker_service() {
    local service=$1
    local description=$2
    
    echo "Testing Docker service: $description"
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$service.*Up"; then
        echo "✅ $description: Running"
        return 0
    else
        echo "❌ $description: Not running"
        return 1
    fi
}

echo "🐳 Vérification des services Docker..."
test_docker_service "meeshy-nginx" "Nginx"
test_docker_service "meeshy-frontend" "Frontend"
test_docker_service "meeshy-gateway" "Gateway"
test_docker_service "meeshy-translator" "Translator"
test_docker_service "meeshy-database" "Database"
test_docker_service "meeshy-redis" "Redis"

echo ""
echo "🌐 Vérification des endpoints..."

# Test des endpoints principaux
test_url "http://meeshy.me" "Frontend (HTTP)"
test_url "http://meeshy.me/api/health" "API Health Check"
test_url "http://meeshy.me/health" "Health Check via Nginx"

echo ""
echo "📊 Vérification des logs récents..."

echo "Nginx logs (dernières 10 lignes):"
docker logs --tail 10 meeshy-nginx 2>/dev/null || echo "Nginx non disponible"

echo ""
echo "Frontend logs (dernières 10 lignes):"
docker logs --tail 10 meeshy-frontend 2>/dev/null || echo "Frontend non disponible"

echo ""
echo "Gateway logs (dernières 10 lignes):"
docker logs --tail 10 meeshy-gateway 2>/dev/null || echo "Gateway non disponible"

echo ""
echo "✅ Vérification terminée !"
echo "🌐 Accédez à l'application via: http://meeshy.me"
