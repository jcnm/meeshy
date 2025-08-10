#!/usr/bin/env python3
"""
Meeshy Translation Service - Point d'entrée principal
Service de traduction avec FastAPI + ZMQ intégrés
"""

import asyncio
import logging
import signal
import sys
import uvicorn
import threading
from pathlib import Path

# Ajouter le répertoire src au PYTHONPATH
current_dir = Path(__file__).parent
src_dir = current_dir / "src"
sys.path.insert(0, str(src_dir))

# Configuration du logging
log_dir = current_dir / "logs"
log_dir.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [TRA] [%(levelname)s] %(name)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_dir / 'translation_service.log')
    ]
)

logger = logging.getLogger(__name__)

# Imports locaux
try:
    from services.database_service import DatabaseService
    from services.translation_service import TranslationService
    from services.zmq_server import ZMQTranslationServer
    from api.translation_api import TranslationAPI
    from config.settings import get_settings
except ImportError as e:
    logger.error(f"Erreur d'import: {e}")
    sys.exit(1)

class MeeshyTranslationServer:
    """Serveur de traduction intégré avec FastAPI et ZMQ"""
    
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
                logger.info("✅ Service de base de données initialisé avec succès")
            else:
                logger.warning("⚠️  Service de base de données non disponible - Mode dégradé")
            
            # 2. Initialise le service de traduction avec la base de données
            self.translation_service = TranslationService(database_service=self.database_service)
            await self.translation_service.initialize(database_service=self.database_service)
            logger.info("✅ Service de traduction initialisé")
            
            # 3. Initialise le serveur ZMQ
            zmq_port = int(self.settings.zmq_port or 5555)
            self.zmq_server = ZMQTranslationServer(
                translation_service=self.translation_service,
                port=zmq_port
            )
            logger.info(f"✅ Serveur ZMQ configuré sur port {zmq_port}")
            
            # 4. Initialise l'API FastAPI avec tous les services
            self.translation_api = TranslationAPI(
                translation_service=self.translation_service,
                database_service=self.database_service,
                zmq_server=self.zmq_server
            )
            logger.info("✅ API FastAPI configurée")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'initialisation: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def start_zmq_server(self):
        """Démarre le serveur ZMQ dans une tâche asyncio"""
        try:
            logger.info("🔌 Démarrage du serveur ZMQ...")
            await self.zmq_server.start()
        except Exception as e:
            logger.error(f"❌ Erreur serveur ZMQ: {e}")
    
    def start_fastapi_server(self):
        """Démarre le serveur FastAPI dans un thread séparé"""
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
    
    async def start_server(self):
        """Démarre le serveur intégré"""
        logger.info("🚀 Démarrage du serveur intégré (FastAPI + ZMQ)...")
        
        # Test du service de traduction
        test_result = await self.translation_service.translate_text(
            text="Hello Meeshy",
            source_language="en", 
            target_language="fr",
            model_type="basic"
        )
        logger.info(f"🧪 Test de traduction: {test_result}")
        
        # Démarrage FastAPI en thread
        fastapi_thread = self.start_fastapi_server()
        
        # Démarrage ZMQ en arrière-plan
        self.running = True
        self.zmq_task = asyncio.create_task(self.start_zmq_server())
        
        logger.info("✅ Serveur Meeshy prêt et en fonctionnement")
        logger.info(f"📍 FastAPI: http://0.0.0.0:{self.settings.fastapi_port or 8000}")
        logger.info(f"📍 ZMQ: tcp://0.0.0.0:{self.settings.zmq_port or 5555}")
        
        try:
            # Attendre l'arrêt
            while self.running:
                await asyncio.sleep(1)
                
                # Vérifier si ZMQ est encore vivant
                if self.zmq_task.done():
                    exception = self.zmq_task.exception()
                    if exception:
                        logger.error(f"❌ ZMQ task terminated with error: {exception}")
                        break
                        
        except KeyboardInterrupt:
            logger.info("🛑 Arrêt du serveur demandé")
        finally:
            await self.shutdown()
    
    async def shutdown(self):
        """Arrête proprement le serveur"""
        logger.info("🧹 Arrêt du serveur...")
        self.running = False
        
        # Arrêter ZMQ
        if self.zmq_server:
            await self.zmq_server.stop()
            logger.info("✅ Serveur ZMQ arrêté")
        
        # Annuler la tâche ZMQ
        if self.zmq_task and not self.zmq_task.done():
            self.zmq_task.cancel()
            try:
                await self.zmq_task
            except asyncio.CancelledError:
                pass
        
        # Arrêter le service de traduction
        if self.translation_service:
            await self.translation_service.cleanup()
            logger.info("✅ Service de traduction arrêté proprement")
        
        # Arrêter le service de base de données
        if self.database_service:
            await self.database_service.cleanup()
            logger.info("✅ Service de base de données arrêté proprement")

async def main():
    """Fonction principale"""
    logger.info("🌟 Démarrage Meeshy Translation Service")
    
    # Gestionnaire de signal pour arrêt propre
    server = MeeshyTranslationServer()
    
    def signal_handler(signum, frame):
        logger.info(f"📨 Signal reçu: {signum}")
        server.running = False
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Initialisation
        if not await server.initialize():
            sys.exit(1)
        
        # Démarrage du serveur
        await server.start_server()
        
    except Exception as e:
        logger.error(f"💥 Erreur critique: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
