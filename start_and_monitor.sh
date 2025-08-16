#!/bin/bash

# Script de démarrage et surveillance des services Meeshy
# Usage: ./start_and_monitor.sh

echo "🚀 Démarrage et surveillance des services Meeshy"
echo "================================================"

# Arrêter les services existants
echo "🧹 Nettoyage des services existants..."
pkill -f "gateway" 2>/dev/null
pkill -f "frontend" 2>/dev/null
pkill -f "translator" 2>/dev/null
sleep 2

# Créer le fichier de logs
LOG_FILE="meeshy-logs-$(date +%Y%m%d-%H%M%S).log"
echo "📝 Logs redirigés vers: $LOG_FILE"

# Démarrer les services en arrière-plan avec logs
echo "🐍 Démarrage du traducteur..."
cd translator && python main.py >> "../$LOG_FILE" 2>&1 &
TRANSLATOR_PID=$!
cd ..

echo "🌐 Démarrage du gateway..."
cd gateway && npm run dev >> "../$LOG_FILE" 2>&1 &
GATEWAY_PID=$!
cd ..

echo "🎨 Démarrage du frontend..."
cd frontend && npm run dev >> "../$LOG_FILE" 2>&1 &
FRONTEND_PID=$!
cd ..

echo "⏳ Attente du démarrage des services..."
sleep 15

# Surveillance continue
echo "🔍 Surveillance des services en cours..."
echo "Appuyez sur Ctrl+C pour arrêter"
echo "================================================"

while true; do
    clear
    echo "🔍 État des services Meeshy - $(date)"
    echo "================================================"
    
    # Vérification des processus
    echo "📊 Processus:"
    if ps -p $TRANSLATOR_PID > /dev/null; then
        echo "  ✅ Traducteur (PID: $TRANSLATOR_PID)"
    else
        echo "  ❌ Traducteur arrêté"
    fi
    
    if ps -p $GATEWAY_PID > /dev/null; then
        echo "  ✅ Gateway (PID: $GATEWAY_PID)"
    else
        echo "  ❌ Gateway arrêté"
    fi
    
    if ps -p $FRONTEND_PID > /dev/null; then
        echo "  ✅ Frontend (PID: $FRONTEND_PID)"
    else
        echo "  ❌ Frontend arrêté"
    fi
    
    # Test de connectivité
    echo ""
    echo "🌐 Connectivité:"
    if curl -s http://localhost:3000/health >/dev/null 2>&1; then
        echo "  ✅ Gateway accessible"
    else
        echo "  ❌ Gateway non accessible"
    fi
    
    if curl -s http://localhost:3100 >/dev/null 2>&1; then
        echo "  ✅ Frontend accessible"
    else
        echo "  ❌ Frontend non accessible"
    fi
    
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "  ✅ Translator accessible"
    else
        echo "  ❌ Translator non accessible"
    fi
    
    # Dernières lignes des logs
    echo ""
    echo "📝 Derniers logs (dernières 5 lignes):"
    tail -n 5 "$LOG_FILE" 2>/dev/null || echo "  Aucun log disponible"
    
    echo ""
    echo "🔄 Actualisation dans 5 secondes... (Ctrl+C pour arrêter)"
    sleep 5
done
