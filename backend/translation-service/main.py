#!/usr/bin/env python3
"""
Point d'entrée principal pour le service de traduction Meeshy
"""

import sys
from pathlib import Path

# Ajouter le chemin src au PYTHONPATH
current_dir = Path(__file__).parent
src_dir = current_dir / "src"
sys.path.insert(0, str(src_dir))

if __name__ == "__main__":
    from translation_service import serve
    serve()
