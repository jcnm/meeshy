#!/usr/bin/env python3
"""
Script de démarrage qui gère correctement les imports
"""

import sys
import os
import traceback
from pathlib import Path

# Configuration des chemins
current_dir = Path(__file__).parent
src_dir = current_dir / "src"

# Ajouter src au PYTHONPATH
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

# Maintenant exécuter main.py directement
if __name__ == "__main__":
    try:
        os.chdir(str(src_dir))
        import main
    except Exception as e:
        print(f"❌ Erreur dans start_service.py: {e}")
        traceback.print_exc()
        sys.exit(1)
