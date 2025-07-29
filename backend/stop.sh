#!/bin/bash
echo "🛑 Arrêt du serveur..."
pkill -f "python main.py" || echo "Aucun processus trouvé"
