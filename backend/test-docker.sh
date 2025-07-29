# Script de test pour Docker
#!/bin/bash

echo "🚀 Test de la configuration Docker Meeshy Backend Refactored"
echo "============================================================"

# Test de la disponibilité des services
echo ""
echo "📋 Test des services..."

# Test Fastify API
echo -n "🔍 Fastify API (http://localhost:3001/health): "
if curl -f http://localhost:3001/health &> /dev/null; then
    echo "✅ OK"
else
    echo "❌ KO"
fi

# Test Nginx
echo -n "🔍 Nginx (http://localhost:80/health): "
if curl -f http://localhost:80/health &> /dev/null; then
    echo "✅ OK"
else
    echo "❌ KO"
fi

# Test API Info
echo -n "🔍 API Info (http://localhost:3001/api/info): "
if curl -f http://localhost:3001/api/info &> /dev/null; then
    echo "✅ OK"
else
    echo "❌ KO"
fi

echo ""
echo "🔌 Test des services de base de données..."

# Test PostgreSQL
echo -n "🔍 PostgreSQL: "
if docker exec meeshy-postgres pg_isready -U meeshy -d meeshy_db &> /dev/null; then
    echo "✅ OK"
else
    echo "❌ KO"
fi

# Test Redis
echo -n "🔍 Redis: "
if docker exec meeshy-redis redis-cli ping &> /dev/null; then
    echo "✅ OK"
else
    echo "❌ KO"
fi

echo ""
echo "📊 Informations système..."

# Status des conteneurs
echo "🐳 Conteneurs Docker:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "💾 Utilisation des volumes:"
docker volume ls | grep meeshy

echo ""
echo "🌐 Réseau Docker:"
docker network ls | grep meeshy

echo ""
echo "✅ Test terminé !"
echo ""
echo "🔗 URLs utiles:"
echo "   - API Fastify: http://localhost:3001"
echo "   - Health Check: http://localhost:3001/health"
echo "   - API Info: http://localhost:3001/api/info"
echo "   - Nginx: http://localhost:80"
echo ""
echo "📋 Commandes utiles:"
echo "   - Voir les logs: ./docker-manage.sh logs"
echo "   - Status: ./docker-manage.sh status"
echo "   - Arrêter: ./docker-manage.sh stop"
