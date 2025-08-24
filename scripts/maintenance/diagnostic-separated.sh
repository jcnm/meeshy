#!/bin/bash

# Script de diagnostic pour containers séparés Meeshy
echo "🔍 DIAGNOSTIC CONTAINERS SÉPARÉS MEESHY"
echo "======================================="

# Vérifier si Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution"
    exit 1
fi

echo "✅ Docker est actif"

# Vérifier les containers
echo ""
echo "📦 État des containers:"
docker ps --filter "name=meeshy" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Vérifier les réseaux
echo ""
echo "🌐 Réseaux Docker:"
docker network ls | grep meeshy || echo "Aucun réseau meeshy trouvé"

# Vérifier la connectivité entre containers
echo ""
echo "🔌 Test de connectivité entre containers:"
echo "----------------------------------------"

# Test depuis le frontend vers la gateway
echo "Test frontend -> gateway:"
docker exec meeshy-frontend curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n" http://gateway:3000/health 2>/dev/null || echo "❌ Frontend ne peut pas contacter gateway:3000"

# Test depuis l'extérieur vers la gateway
echo "Test externe -> gateway:"
curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n" http://localhost:3000/health 2>/dev/null || echo "❌ Impossible de contacter localhost:3000"

# Vérifier les variables d'environnement du frontend
echo ""
echo "📋 Variables d'environnement du frontend:"
echo "----------------------------------------"
docker exec meeshy-frontend env | grep -E "(NEXT_PUBLIC|INTERNAL)" | sort || echo "Aucune variable trouvée"

# Vérifier les logs du frontend
echo ""
echo "📋 Logs récents du frontend:"
echo "----------------------------"
docker logs --tail=10 meeshy-frontend 2>/dev/null || echo "Aucun log trouvé"

# Vérifier les logs de la gateway
echo ""
echo "📋 Logs récents de la gateway:"
echo "------------------------------"
docker logs --tail=10 meeshy-gateway 2>/dev/null || echo "Aucun log trouvé"

# Test de résolution DNS
echo ""
echo "🔍 Test de résolution DNS:"
echo "-------------------------"
echo "Résolution 'gateway' depuis le frontend:"
docker exec meeshy-frontend nslookup gateway 2>/dev/null || echo "❌ Impossible de résoudre 'gateway'"

echo "Résolution 'localhost' depuis le frontend:"
docker exec meeshy-frontend nslookup localhost 2>/dev/null || echo "❌ Impossible de résoudre 'localhost'"

# Vérifier les ports exposés
echo ""
echo "🔌 Ports exposés:"
echo "----------------"
netstat -tlnp 2>/dev/null | grep -E ':(3000|3100|8000)' || echo "Aucun port détecté"

echo ""
echo "✅ Diagnostic terminé"
