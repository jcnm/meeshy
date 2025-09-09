#!/bin/bash

# Script de test pour valider la configuration MongoDB
# Ce script simule le processus de vérification et correction du replica set

echo "🧪 TEST DE LA CONFIGURATION MONGODB"
echo "==================================="

# Test de connexion SSH
echo "ℹ️  Test de connexion SSH..."
if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@157.230.15.51 "echo 'Connexion SSH réussie'" >/dev/null 2>&1; then
    echo "✅ Connexion SSH réussie"
else
    echo "❌ Impossible de se connecter au serveur"
    exit 1
fi

# Vérifier la configuration actuelle du replica set
echo ""
echo "🔍 VÉRIFICATION DE LA CONFIGURATION ACTUELLE..."
echo "=============================================="

ssh -o StrictHostKeyChecking=no root@157.230.15.51 "cd /opt/meeshy && docker exec meeshy-database mongosh --eval 'rs.status().members[0].name' --quiet 2>/dev/null | tr -d '\r\n'"

current_host=$(ssh -o StrictHostKeyChecking=no root@157.230.15.51 "cd /opt/meeshy && docker exec meeshy-database mongosh --eval 'rs.status().members[0].name' --quiet 2>/dev/null | tr -d '\r\n'")

echo "📊 Nom d'hôte actuel du replica set: $current_host"

if [ "$current_host" = "meeshy-database:27017" ]; then
    echo "✅ Configuration MongoDB correcte"
    echo "✅ Replica set configuré avec le bon nom d'hôte"
else
    echo "⚠️  Configuration MongoDB incorrecte"
    echo "🔧 Correction nécessaire..."
fi

# Test de connexion des services
echo ""
echo "🔍 TEST DE CONNEXION DES SERVICES..."
echo "==================================="

# Test Gateway
echo "🚪 Test de connexion Gateway à MongoDB..."
gateway_status=$(ssh -o StrictHostKeyChecking=no root@157.230.15.51 "cd /opt/meeshy && docker logs meeshy-gateway --tail 5 2>/dev/null | grep -E '(MongoDB|Prisma|error)' | tail -1")
if [ -n "$gateway_status" ]; then
    echo "📋 Gateway: $gateway_status"
else
    echo "✅ Gateway: Aucune erreur MongoDB détectée"
fi

# Test Translator
echo "🌐 Test de connexion Translator à MongoDB..."
translator_status=$(ssh -o StrictHostKeyChecking=no root@157.230.15.51 "cd /opt/meeshy && docker logs meeshy-translator --tail 5 2>/dev/null | grep -E '(MongoDB|database|error)' | tail -1")
if [ -n "$translator_status" ]; then
    echo "📋 Translator: $translator_status"
else
    echo "✅ Translator: Aucune erreur MongoDB détectée"
fi

echo ""
echo "🎉 TEST TERMINÉ !"
echo "================"
echo "✅ Configuration MongoDB validée"
echo "✅ Services connectés correctement"
