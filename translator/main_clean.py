#!/usr/bin/env python3
"""
Service de traduction Meeshy - Version clean et fonctionnelle
Point d'entrée principal pour le service Pipeline
"""

import sys
from pathlib import Path

# Ajouter le répertoire src au PYTHONPATH
current_dir = Path(__file__).parent
src_dir = current_dir / "src"
sys.path.insert(0, str(src_dir))

if __name__ == "__main__":
    from main_service import main
    import asyncio
    asyncio.run(main())
