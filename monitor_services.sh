#!/bin/bash

# Script de surveillance des services Meeshy
# Usage: ./monitor_services.sh

echo "🔍 Surveillance des services Meeshy - $(date)"
echo "================================================"

# Vérification des ports
echo "📡 Vérification des ports:"
echo "Port 3000 (Gateway):"
lsof -i :3000 2>/dev/null || echo "  ❌ Port 3000 non accessible"
echo "Port 3100 (Frontend):"
lsof -i :3100 2>/dev/null || echo "  ❌ Port 3100 non accessible"
echo "Port 8000 (Translator):"
lsof -i :8000 2>/dev/null || echo "  ❌ Port 8000 non accessible"

echo ""
echo "🌐 Test de connectivité:"
echo "Gateway (http://localhost:3000/health):"
if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    echo "  ✅ Gateway accessible"
else
    echo "  ❌ Gateway non accessible"
fi

echo "Frontend (http://localhost:3100):"
if curl -s http://localhost:3100 >/dev/null 2>&1; then
    echo "  ✅ Frontend accessible"
else
    echo "  ❌ Frontend non accessible"
fi

echo "Translator (http://localhost:8000/health):"
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo "  ✅ Translator accessible"
else
    echo "  ❌ Translator non accessible"
fi

echo ""
echo "📊 Processus actifs:"
ps aux | grep -E "(gateway|frontend|translator)" | grep -v grep | head -10

echo ""
echo "🔄 Redémarrage des services si nécessaire..."
echo "================================================"
