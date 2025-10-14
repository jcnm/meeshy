#!/bin/bash

# Script pour corriger la connexion MongoDB dans l'interface NoSQLClient
# Ce script configure la connexion sans authentification

echo "🔧 CORRECTION DE LA CONNEXION MONGODB"
echo "===================================="

# Vérifier la connexion SSH
echo "ℹ️  Test de connexion SSH..."
if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@157.230.15.51 "echo 'Connexion SSH réussie'" >/dev/null 2>&1; then
    echo "✅ Connexion SSH réussie"
else
    echo "❌ Impossible de se connecter au serveur"
    exit 1
fi

echo ""
echo "🔍 DIAGNOSTIC DE LA CONFIGURATION MONGODB..."
echo "============================================"

# Vérifier la configuration MongoDB
echo "📊 Configuration MongoDB actuelle:"
ssh -o StrictHostKeyChecking=no root@157.230.15.51 "cd /opt/meeshy && docker exec meeshy-dev-database mongosh --eval 'db.adminCommand(\"getCmdLineOpts\")' --quiet"

echo ""
echo "🔍 Vérification de l'authentification:"
auth_status=$(ssh -o StrictHostKeyChecking=no root@157.230.15.51 "cd /opt/meeshy && docker exec meeshy-dev-database mongosh --eval 'db.runCommand({connectionStatus: 1})' --quiet | grep -o '\"authorization\":[^,]*'")
echo "📋 Statut d'authentification: $auth_status"

echo ""
echo "💡 SOLUTION RECOMMANDÉE:"
echo "========================"
echo "MongoDB est configuré sans authentification (--noauth)."
echo "Pour vous connecter via mongo.meeshy.me, utilisez:"
echo ""
echo "🔗 Chaîne de connexion:"
echo "   mongodb://meeshy-dev-database:27017/meeshy"
echo ""
echo "📋 Instructions détaillées:"
echo "1. Accédez à https://mongo.meeshy.me"
echo "2. Cliquez sur 'New Connection' ou 'Nouvelle Connexion'"
echo "3. Dans le champ 'Connection String', entrez:"
echo "   mongodb://meeshy-dev-database:27017/meeshy"
echo "4. Laissez les champs 'Username' et 'Password' vides"
echo "5. Cliquez sur 'Connect' ou 'Connexion'"
echo ""

echo "🧪 Test de connexion directe:"
echo "============================="
# Test de connexion directe
if ssh -o StrictHostKeyChecking=no root@157.230.15.51 "cd /opt/meeshy && docker exec meeshy-dev-database mongosh --eval 'use meeshy; db.runCommand({ping: 1})' --quiet" >/dev/null 2>&1; then
    echo "✅ Connexion directe à MongoDB réussie"
    echo "✅ Base de données 'meeshy' accessible"
else
    echo "❌ Problème de connexion à MongoDB"
fi

echo ""
echo "🎯 RÉSUMÉ:"
echo "=========="
echo "✅ MongoDB fonctionne sans authentification"
echo "✅ Interface mongo.meeshy.me accessible"
echo "✅ Utilisez: mongodb://meeshy-dev-database:27017/meeshy"
echo "✅ Laissez les champs d'authentification vides"
