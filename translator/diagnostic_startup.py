#!/usr/bin/env python3
"""
Script de diagnostic pour le démarrage du service Translator
Vérifie tous les composants nécessaires avant le démarrage
"""

import asyncio
import logging
import sys
import os
from pathlib import Path
from datetime import datetime

# Ajouter le répertoire src au PYTHONPATH
current_dir = Path(__file__).parent
src_dir = current_dir / "src"
sys.path.insert(0, str(src_dir))

# Configuration du logging avec format coloré
class ColoredFormatter(logging.Formatter):
    """Formatter avec couleurs pour les logs"""
    
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Vert
        'WARNING': '\033[33m',  # Jaune
        'ERROR': '\033[31m',    # Rouge
        'CRITICAL': '\033[35m', # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record):
        log_color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{log_color}[{record.levelname}]{self.RESET}"
        return super().format(record)

# Configuration du logging
log_dir = current_dir / "logs"
log_dir.mkdir(exist_ok=True)

# Handler pour console avec couleurs
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(ColoredFormatter(
    '%(asctime)s [DIAG] %(levelname)s %(name)s - %(message)s'
))

# Handler pour fichier sans couleurs
file_handler = logging.FileHandler(log_dir / 'diagnostic.log')
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s [DIAG] [%(levelname)s] %(name)s - %(message)s'
))

logging.basicConfig(
    level=logging.INFO,
    handlers=[console_handler, file_handler]
)

logger = logging.getLogger(__name__)

async def check_environment():
    """Vérifie l'environnement de déploiement"""
    logger.info("🔍 Vérification de l'environnement...")
    
    checks = {
        'python_version': sys.version_info >= (3, 8),
        'working_directory': Path.cwd().exists(),
        'src_directory': src_dir.exists(),
        'logs_directory': log_dir.exists(),
    }
    
    # Vérifier les variables d'environnement importantes
    env_vars = [
        'DATABASE_URL',
        'NODE_ENV',
        'LOG_LEVEL'
    ]
    
    for var in env_vars:
        value = os.getenv(var)
        checks[f'env_{var}'] = value is not None
        if value:
            logger.info(f"✅ {var} = {value}")
        else:
            logger.warning(f"⚠️  {var} non défini")
    
    # Résultats
    for check, result in checks.items():
        if result:
            logger.info(f"✅ {check}: OK")
        else:
            logger.error(f"❌ {check}: FAIL")
    
    return all(checks.values())

async def check_database_connectivity():
    """Vérifie la connectivité à la base de données"""
    logger.info("🗄️  Vérification de la connectivité à la base de données...")
    
    try:
        from services.database_service import DatabaseService
        
        db_service = DatabaseService()
        
        # Test de connexion
        start_time = datetime.now()
        success = await db_service.initialize()
        end_time = datetime.now()
        
        connection_time = (end_time - start_time).total_seconds()
        
        if success:
            logger.info(f"✅ Connexion à la base de données réussie en {connection_time:.2f}s")
            
            # Détails de connexion
            health = await db_service.health_check()
            stats = await db_service.get_connection_stats()
            
            logger.info(f"📊 Health check: {health}")
            logger.info(f"📈 Stats de connexion: {stats}")
            
            # Test de requête
            prisma = db_service.get_prisma_client()
            if prisma:
                logger.info("🔌 Client Prisma disponible")
            
        else:
            logger.error("❌ Impossible de se connecter à la base de données")
        
        # Nettoyer
        await db_service.cleanup()
        return success
        
    except Exception as e:
        logger.error(f"💥 Erreur lors de la vérification de la base de données: {e}")
        import traceback
        traceback.print_exc()
        return False

async def check_services_initialization():
    """Vérifie l'initialisation de tous les services"""
    logger.info("🤖 Vérification de l'initialisation des services...")
    
    try:
        from services.database_service import DatabaseService
        from services.translation_service import TranslationService
        from services.cache_service import CacheService
        from services.message_service import MessageService
        
        results = {}
        
        # 1. Service de base de données
        logger.info("📡 Initialisation du service de base de données...")
        db_service = DatabaseService()
        results['database'] = await db_service.initialize()
        
        # 2. Service de cache
        logger.info("💾 Initialisation du service de cache...")
        cache_service = CacheService()
        await cache_service.initialize()
        results['cache'] = True
        
        # 3. Service de messages
        logger.info("💬 Initialisation du service de messages...")
        message_service = MessageService(database_service=db_service if results['database'] else None)
        await message_service.initialize(database_service=db_service if results['database'] else None)
        results['messages'] = True
        
        # 4. Service de traduction
        logger.info("🌍 Initialisation du service de traduction...")
        translation_service = TranslationService(
            cache_service=cache_service,
            database_service=db_service if results['database'] else None
        )
        init_result = await translation_service.initialize(
            database_service=db_service if results['database'] else None
        )
        results['translation'] = True
        logger.info(f"🎯 Résultat initialisation traduction: {init_result}")
        
        # Nettoyer
        await translation_service.cleanup()
        await db_service.cleanup()
        
        # Résultats
        for service, status in results.items():
            if status:
                logger.info(f"✅ Service {service}: INITIALISÉ")
            else:
                logger.error(f"❌ Service {service}: ÉCHEC")
        
        return all(results.values())
        
    except Exception as e:
        logger.error(f"💥 Erreur lors de l'initialisation des services: {e}")
        import traceback
        traceback.print_exc()
        return False

async def full_startup_simulation():
    """Simule un démarrage complet du service"""
    logger.info("🚀 Simulation d'un démarrage complet...")
    
    try:
        # Import de la classe principale
        from main import MeeshyTranslationServer
        
        # Créer le serveur
        server = MeeshyTranslationServer()
        
        # Initialiser
        logger.info("⚙️  Initialisation complète du serveur...")
        success = await server.initialize()
        
        if success:
            logger.info("✅ Serveur initialisé avec succès")
            
            # Vérifier les composants
            if server.database_service:
                db_health = await server.database_service.health_check()
                logger.info(f"🗄️  Base de données: {db_health}")
            
            if server.translation_service:
                logger.info("🤖 Service de traduction disponible")
            
        else:
            logger.error("❌ Échec de l'initialisation du serveur")
        
        # Nettoyer
        await server.shutdown()
        
        return success
        
    except Exception as e:
        logger.error(f"💥 Erreur lors de la simulation de démarrage: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Fonction principale de diagnostic"""
    logger.info("🏥 DIAGNOSTIC DE DÉMARRAGE DU SERVICE TRANSLATOR")
    logger.info("=" * 60)
    
    results = {}
    
    # Test 1: Environnement
    logger.info("\n📋 TEST 1: Vérification de l'environnement")
    logger.info("-" * 40)
    results['environment'] = await check_environment()
    
    # Test 2: Base de données
    logger.info("\n🗄️  TEST 2: Connectivité base de données")
    logger.info("-" * 40)
    results['database'] = await check_database_connectivity()
    
    # Test 3: Services
    logger.info("\n🔧 TEST 3: Initialisation des services")
    logger.info("-" * 40)
    results['services'] = await check_services_initialization()
    
    # Test 4: Démarrage complet
    logger.info("\n🚀 TEST 4: Simulation de démarrage complet")
    logger.info("-" * 40)
    results['startup'] = await full_startup_simulation()
    
    # Rapport final
    logger.info("\n" + "=" * 60)
    logger.info("📊 RAPPORT FINAL")
    logger.info("=" * 60)
    
    all_passed = True
    for test, passed in results.items():
        status = "✅ RÉUSSI" if passed else "❌ ÉCHOUÉ"
        logger.info(f"{test.upper()}: {status}")
        if not passed:
            all_passed = False
    
    if all_passed:
        logger.info("\n🎉 TOUS LES TESTS SONT RÉUSSIS - LE SERVICE EST PRÊT !")
        logger.info("🚀 Vous pouvez démarrer le service avec: python main.py")
    else:
        logger.error("\n💥 CERTAINS TESTS ONT ÉCHOUÉ")
        logger.error("🔧 Vérifiez les erreurs ci-dessus avant de démarrer le service")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
