#!/usr/bin/env python3
"""
Test de connexion à la base de données pour le service Translator
Script pour vérifier que le service Prisma fonctionne correctement
"""

import asyncio
import logging
import sys
import os
from pathlib import Path

# Ajouter le répertoire src au PYTHONPATH
current_dir = Path(__file__).parent
src_dir = current_dir / "src"
sys.path.insert(0, str(src_dir))

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [TEST] [%(levelname)s] %(name)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

async def test_database_connection():
    """Test de connexion à la base de données"""
    try:
        logger.info("🧪 Début du test de connexion à la base de données")
        
        # Import du service de base de données
        from services.database_service import DatabaseService
        
        # Créer et initialiser le service
        db_service = DatabaseService()
        success = await db_service.initialize()
        
        if success:
            logger.info("✅ Test de connexion réussi !")
            
            # Tester le health check
            health = await db_service.health_check()
            logger.info(f"📊 Health check: {health}")
            
            # Tester les statistiques de connexion
            stats = await db_service.get_connection_stats()
            logger.info(f"📈 Statistiques: {stats}")
            
        else:
            logger.error("❌ Test de connexion échoué")
        
        # Nettoyer
        await db_service.cleanup()
        logger.info("🧹 Nettoyage terminé")
        
        return success
        
    except Exception as e:
        logger.error(f"💥 Erreur lors du test: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_translation_service_with_db():
    """Test du service de traduction avec base de données"""
    try:
        logger.info("🧪 Test du service de traduction avec base de données")
        
        from services.database_service import DatabaseService
        from services.translation_service import TranslationService
        
        # Initialiser la base de données
        db_service = DatabaseService()
        db_success = await db_service.initialize()
        
        # Initialiser le service de traduction
        translation_service = TranslationService(database_service=db_service)
        await translation_service.initialize(database_service=db_service)
        
        logger.info("✅ Service de traduction initialisé avec base de données")
        
        # Test de traduction simple
        result = await translation_service.translate_text(
            text="Hello world",
            source_language="en",
            target_language="fr",
            model_type="basic"
        )
        
        logger.info(f"🌍 Résultat de traduction: {result}")
        
        # Nettoyer
        await translation_service.cleanup()
        await db_service.cleanup()
        
        return True
        
    except Exception as e:
        logger.error(f"💥 Erreur lors du test de traduction: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Fonction principale de test"""
    logger.info("🚀 Début des tests du service Translator")
    
    # Test 1: Connexion de base de données seule
    logger.info("\n" + "="*50)
    logger.info("TEST 1: Connexion à la base de données")
    logger.info("="*50)
    
    db_test_success = await test_database_connection()
    
    # Test 2: Service de traduction avec base de données
    logger.info("\n" + "="*50)
    logger.info("TEST 2: Service de traduction avec base de données")
    logger.info("="*50)
    
    translation_test_success = await test_translation_service_with_db()
    
    # Résultats
    logger.info("\n" + "="*50)
    logger.info("RÉSULTATS DES TESTS")
    logger.info("="*50)
    logger.info(f"🗄️  Test de base de données: {'✅ RÉUSSI' if db_test_success else '❌ ÉCHOUÉ'}")
    logger.info(f"🤖 Test de traduction + DB: {'✅ RÉUSSI' if translation_test_success else '❌ ÉCHOUÉ'}")
    
    if db_test_success and translation_test_success:
        logger.info("🎉 Tous les tests sont réussis !")
        return 0
    else:
        logger.error("💥 Certains tests ont échoué")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
