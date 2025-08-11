#!/bin/bash

# Script pour surveiller les logs du Translator en temps réel
echo "🔍 Surveillance des logs du Translator..."
echo "=========================================="

# Surveiller les logs du Translator
tail -f translator/translator.log 2>/dev/null || echo "Aucun fichier de log trouvé"

# Alternative : surveiller les logs système
echo "📋 Logs système du Translator :"
ps aux | grep "start_service.py" | grep -v grep
