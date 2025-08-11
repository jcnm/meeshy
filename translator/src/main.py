#!/usr/bin/env python3
"""
Meeshy Translation Service - Point d'entrée principal
Service de traduction avec FastAPI + ZMQ
"""

import asyncio
import logging
import signal
import sys
import uvicorn
import threading
from pathlib import Path

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('logs/translation_service.log')
    ]
)

logger = logging.getLogger(__name__)

# Imports locaux
try:
    # Tenter d'utiliser le service Prisma Python en premier
    try:
        from services.database_service_prisma import DatabaseServicePrisma as DatabaseService
        logger.info("🎯 Utilisation du service Prisma Python")
    except ImportError:
        logger.warning("⚠️  Service Prisma Python non disponible, fallback vers service direct")
        from services.database_service_real import DatabaseServiceReal as DatabaseService
    
    from services.translation_service import TranslationService
    from services.zmq_server import ZMQTranslationServer
    from api.translation_api import TranslationAPI
    from config.settings import get_settings
except ImportError as e:
    logger.error(f"Erreur d'import: {e}")
    sys.exit(1)

class MeeshyTranslationServer:
    """
    Serveur principal de traduction Meeshy
    Gère FastAPI (REST) et ZMQ (messaging) en parallèle
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.database_service = None
        self.translation_service = None
        self.zmq_server = None
        self.translation_api = None
        self.running = False
        self.zmq_task = None
        
    async def initialize(self):
        """Initialise tous les services"""
        logger.info("🤖 Initialisation du serveur de traduction Meeshy...")
        
        try:
            # Créer les répertoires nécessaires
            Path("logs").mkdir(exist_ok=True)
            Path("cache").mkdir(exist_ok=True)
            
            # 1. Initialise le service de base de données en premier
            logger.info("🗄️  Initialisation du service de base de données...")
            self.database_service = DatabaseService()
            db_initialized = await self.database_service.initialize()
            
            if db_initialized:
                logger.info("✅ Service de base de données PostgreSQL initialisé avec succès")
                logger.info("")
                logger.info("🎯 AFFICHAGE DES STATISTIQUES DE DÉMARRAGE")
                logger.info("=" * 60)
                await self.database_service.display_statistics()
                logger.info("=" * 60)
                logger.info("🏁 FIN DES STATISTIQUES DE DÉMARRAGE")
                logger.info("")
            else:
                logger.warning("⚠️  Service de base de données non disponible - Mode dégradé")
            
            # 2. Initialise le service de traduction avec la base de données
            if db_initialized:
                self.translation_service = TranslationService(database_service=self.database_service)
                await self.translation_service.initialize(database_service=self.database_service)
            else:
                self.translation_service = TranslationService()
                await self.translation_service.initialize()
            logger.info("✅ Service de traduction initialisé")
            
            # Serveur ZMQ (communication avec gateway)
            zmq_port = int(self.settings.zmq_port or 5555)
            self.zmq_server = ZMQTranslationServer(
                translation_service=self.translation_service,
                port=zmq_port
            )
            logger.info(f"✅ Serveur ZMQ configuré sur port {zmq_port}")
            
            # API FastAPI (interface REST)
            self.translation_api = TranslationAPI(
                translation_service=self.translation_service
            )
            logger.info("✅ API FastAPI configurée")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'initialisation: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def start_zmq_server(self):
        """Démarre le serveur ZMQ (communication inter-services)"""
        try:
            logger.info("🔌 Démarrage du serveur ZMQ...")
            await self.zmq_server.start()
        except Exception as e:
            logger.error(f"❌ Erreur serveur ZMQ: {e}")
    
    def start_fastapi_server(self):
        """Démarre le serveur FastAPI (API REST)"""
        def run_fastapi():
            try:
                logger.info("🚀 Démarrage du serveur FastAPI...")
                uvicorn.run(
                    self.translation_api.app,
                    host="0.0.0.0",
                    port=int(self.settings.fastapi_port or 8000),
                    log_level="info",
                    access_log=True
                )
            except Exception as e:
                logger.error(f"❌ Erreur serveur FastAPI: {e}")
        
        fastapi_thread = threading.Thread(target=run_fastapi, daemon=True)
        fastapi_thread.start()
        logger.info("✅ Serveur FastAPI démarré en arrière-plan")
        return fastapi_thread
    
    async def start(self):
        """Démarre le serveur complet"""
        logger.info("🚀 Démarrage du serveur Meeshy Translation...")
        
        # Test de fonctionnement
        test_result = await self.translation_service.translate(
            text="Hello Meeshy",
            source_language="en", 
            target_language="fr",
            model_type="basic"
        )
        logger.info(f"🧪 Test de traduction: {test_result}")
        
        # Démarrage FastAPI (REST API)
        fastapi_thread = self.start_fastapi_server()
        
        # Démarrage ZMQ (Inter-service communication)
        self.running = True
        self.zmq_task = asyncio.create_task(self.start_zmq_server())
        
        logger.info("✅ Serveur Meeshy Translation prêt")
        logger.info(f"📍 REST API: http://0.0.0.0:{self.settings.fastapi_port or 8000}")
        logger.info(f"📍 ZMQ Server: tcp://0.0.0.0:{self.settings.zmq_port or 5555}")
        
        try:
            # Boucle principale
            while self.running:
                await asyncio.sleep(1)
                
                # Vérifier ZMQ
                if self.zmq_task.done():
                    exception = self.zmq_task.exception()
                    if exception:
                        logger.error(f"❌ ZMQ task terminated: {exception}")
                        break
                        
        except KeyboardInterrupt:
            logger.info("🛑 Arrêt demandé par l'utilisateur")
        finally:
            await self.shutdown()
    
    async def shutdown(self):
        """Arrêt propre du serveur"""
        logger.info("🧹 Arrêt du serveur...")
        self.running = False
        
        # Arrêter ZMQ
        if self.zmq_server:
            await self.zmq_server.stop()
            logger.info("✅ Serveur ZMQ arrêté")
        
        # Annuler tâche ZMQ
        if self.zmq_task and not self.zmq_task.done():
            self.zmq_task.cancel()
            try:
                await self.zmq_task
            except asyncio.CancelledError:
                pass
        
        # Arrêter service de traduction
        if self.translation_service:
            await self.translation_service.cleanup()
            logger.info("✅ Service de traduction arrêté")
        
        # Arrêter service de base de données
        if self.database_service:
            await self.database_service.cleanup()
            logger.info("✅ Service de base de données arrêté")

async def main():
    """Fonction principale"""
    logger.info("🌟 Démarrage Meeshy Translation Service")
    
    # Serveur principal
    server = MeeshyTranslationServer()
    
    # Gestionnaire de signaux
    def signal_handler(signum, frame):
        logger.info(f"📨 Signal reçu: {signum}")
        server.running = False
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Initialisation
        if not await server.initialize():
            sys.exit(1)
        
        # Démarrage
        await server.start()
        
    except Exception as e:
        logger.error(f"💥 Erreur critique: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
