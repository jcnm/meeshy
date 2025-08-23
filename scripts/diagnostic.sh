#!/bin/bash

# Script de diagnostic pour vérifier les variables d'environnement Meeshy
echo "🔍 DIAGNOSTIC DES VARIABLES D'ENVIRONNEMENT MEESHY"
echo "=================================================="

echo ""
echo "📋 Variables d'environnement Frontend :"
echo "----------------------------------------"
echo "NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-'NON DÉFINI'}"
echo "NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-'NON DÉFINI'}"
echo "NEXT_PUBLIC_BACKEND_URL: ${NEXT_PUBLIC_BACKEND_URL:-'NON DÉFINI'}"
echo "INTERNAL_BACKEND_URL: ${INTERNAL_BACKEND_URL:-'NON DÉFINI'}"
echo "INTERNAL_WS_URL: ${INTERNAL_WS_URL:-'NON DÉFINI'}"

echo ""
echo "🌐 Configuration réseau :"
echo "-------------------------"
echo "HOSTNAME: $(hostname)"
echo "IP interne: $(hostname -i)"
echo "Ports en écoute:"
netstat -tlnp 2>/dev/null | grep -E ':(3000|3100|8000|80)' || echo "Aucun port détecté"

echo ""
echo "🔧 Configuration des services :"
echo "-------------------------------"
echo "NODE_ENV: ${NODE_ENV:-'NON DÉFINI'}"
echo "PORT: ${PORT:-'NON DÉFINI'}"
echo "GATEWAY_PORT: ${GATEWAY_PORT:-'NON DÉFINI'}"

echo ""
echo "📁 Structure des répertoires :"
echo "------------------------------"
ls -la /app/ 2>/dev/null || echo "Répertoire /app/ non accessible"
ls -la /app/frontend/ 2>/dev/null || echo "Répertoire frontend non accessible"

echo ""
echo "🔌 Test de connectivité :"
echo "-------------------------"
echo "Test localhost:3000 (Gateway):"
curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n" http://localhost:3000/health 2>/dev/null || echo "❌ Impossible de contacter localhost:3000"

echo "Test localhost:3100 (Frontend):"
curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n" http://localhost:3100 2>/dev/null || echo "❌ Impossible de contacter localhost:3100"

echo ""
echo "📊 État des processus :"
echo "----------------------"
ps aux | grep -E "(node|python|nginx|postgres|redis)" | grep -v grep || echo "Aucun processus détecté"

echo ""
echo "✅ Diagnostic terminé"
