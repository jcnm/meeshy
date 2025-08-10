#!/usr/bin/env python3
"""
Script de démarrage qui gère correctement les imports pour éviter les problèmes
avec les imports relatifs de Prisma
"""

import sys
import os
from pathlib import Path

# Ajouter le répertoire racine au PYTHONPATH
current_dir = Path(__file__).parent
project_root = current_dir
sys.path.insert(0, str(project_root))

# NE PAS ajouter le répertoire generated pour éviter les conflits de modules

# Maintenant démarrer le service principal
if __name__ == "__main__":
    # Importer et démarrer le service principal
    os.chdir(str(project_root / "src"))
    exec(open(project_root / "main.py").read())
