#!/usr/bin/env python3
"""
Test simple pour vérifier que le service de traduction fonctionne
"""

import sys
import os
from pathlib import Path

# Ajouter src au PYTHONPATH
current_dir = Path(__file__).parent
src_dir = current_dir / "src"
sys.path.insert(0, str(src_dir))

# Changer vers le répertoire src
os.chdir(str(src_dir))

def test_imports():
    """Test des imports"""
    print("🧪 Test des imports...")
    try:
        from services.database_service import DatabaseService
        print("✅ DatabaseService importé")
        
        from services.translation_service import TranslationService
        print("✅ TranslationService importé")
        
        from config.settings import get_settings
        print("✅ Settings importé")
        
        return True
    except Exception as e:
        print(f"❌ Erreur d'import: {e}")
        return False

def test_database_service():
    """Test du service de base de données"""
    print("\n🧪 Test du service de base de données...")
    try:
        from services.database_service import DatabaseService
        db_service = DatabaseService()
        print("✅ DatabaseService créé")
        return True
    except Exception as e:
        print(f"❌ Erreur DatabaseService: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Test du service de traduction Meeshy")
    print("=" * 50)
    
    success = True
    success &= test_imports()
    success &= test_database_service()
    
    print("\n" + "=" * 50)
    if success:
        print("✅ Tous les tests sont passés")
    else:
        print("❌ Certains tests ont échoué")
