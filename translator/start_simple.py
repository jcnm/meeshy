#!/usr/bin/env python3
"""
Script de démarrage simplifié pour le translator
"""

import sys
import os
from pathlib import Path

# Configuration des chemins
current_dir = Path(__file__).parent
src_dir = current_dir / "src"

# Ajouter src au PYTHONPATH
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

# Variables d'environnement par défaut pour le test
os.environ.setdefault('DATABASE_URL', 'file:/app/data/meeshy.db')
os.environ.setdefault('REDIS_URL', 'redis://localhost:6379')
os.environ.setdefault('HTTP_PORT', '8000')
os.environ.setdefault('ZMQ_PORT', '5555')
os.environ.setdefault('PRISMA_CLIENT_OUTPUT_DIRECTORY', '/app/shared/node_modules/.prisma/client')

# Maintenant exécuter main.py directement
if __name__ == "__main__":
    try:
        os.chdir(str(src_dir))
        import main
    except Exception as e:
        print(f"❌ Erreur dans start_simple.py: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
