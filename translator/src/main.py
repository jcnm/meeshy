"""
Serveur de traduction haute performance Meeshy
Architecture: PUB/SUB + REQ/REP avec pool de connexions et traitement asynchrone
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Ajouter le répertoire src au path
src_path = Path(__file__).parent
sys.path.insert(0, str(src_path))

from config.settings import Settings
from services.zmq_server import ZMQTranslationServer
from services.translation_service import HighPerformanceTranslationService
from api.translation_api import TranslationAPI

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('translator.log')
    ]
)

logger = logging.getLogger(__name__)

class MeeshyTranslationServer:
    """Serveur de traduction haute performance Meeshy"""
    
    def __init__(self):
        self.settings = Settings()
        self.translation_service = None
        self.zmq_server = None
        self.translation_api = None
        self.is_initialized = False
    
    async def initialize(self) -> bool:
        """Initialise le serveur de traduction"""
        try:
            logger.info("🚀 Initialisation du serveur de traduction haute performance...")
            
            # 1. Initialiser le service de traduction haute performance
            max_workers = int(os.getenv('TRANSLATION_WORKERS', '20'))
            self.translation_service = HighPerformanceTranslationService(max_workers=max_workers)
            logger.info(f"✅ Service de traduction haute performance initialisé avec {max_workers} workers")
            
            # 2. Initialiser le serveur ZMQ haute performance
            zmq_port = int(self.settings.zmq_port or 5555)
            self.zmq_server = ZMQTranslationServer(
                translation_service=self.translation_service,
                port=zmq_port,
                max_workers=max_workers
            )
            logger.info(f"✅ Serveur ZMQ haute performance configuré sur port {zmq_port}")
            
            # 3. Initialiser l'API FastAPI (interface REST)
            self.translation_api = TranslationAPI(
                translation_service=self.translation_service
            )
            logger.info("✅ API FastAPI configurée")
            
            self.is_initialized = True
            logger.info("✅ Serveur de traduction haute performance initialisé avec succès")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'initialisation: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def start_zmq_server(self):
        """Démarre le serveur ZMQ haute performance"""
        try:
            logger.info("🔌 Démarrage du serveur ZMQ haute performance...")
            await self.zmq_server.start()
        except Exception as e:
            logger.error(f"❌ Erreur serveur ZMQ: {e}")
    
    async def start_api_server(self):
        """Démarre l'API FastAPI"""
        try:
            logger.info("🌐 Démarrage de l'API FastAPI...")
            import uvicorn
            
            host = self.settings.api_host or "0.0.0.0"
            port = int(self.settings.api_port or 8000)
            
            config = uvicorn.Config(
                app=self.translation_api.app,
                host=host,
                port=port,
                log_level="info",
                access_log=True
            )
            
            server = uvicorn.Server(config)
            await server.serve()
            
        except Exception as e:
            logger.error(f"❌ Erreur API FastAPI: {e}")
    
    async def start(self):
        """Démarre le serveur de traduction"""
        if not await self.initialize():
            logger.error("❌ Échec de l'initialisation, arrêt du serveur")
            return
        
        try:
            logger.info("🚀 Démarrage du serveur de traduction haute performance...")
            
            # Démarrer les serveurs en parallèle
            await asyncio.gather(
                self.start_zmq_server(),
                self.start_api_server()
            )
            
        except KeyboardInterrupt:
            logger.info("🛑 Arrêt demandé par l'utilisateur")
        except Exception as e:
            logger.error(f"❌ Erreur serveur: {e}")
        finally:
            await self.stop()
    
    async def stop(self):
        """Arrête le serveur de traduction"""
        logger.info("🛑 Arrêt du serveur de traduction haute performance...")
        
        try:
            if self.zmq_server:
                await self.zmq_server.stop()
            
            if self.translation_service:
                await self.translation_service.close()
            
            logger.info("✅ Serveur de traduction haute performance arrêté")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'arrêt: {e}")

async def main():
    """Point d'entrée principal"""
    server = MeeshyTranslationServer()
    await server.start()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Arrêt du programme")
    except Exception as e:
        logger.error(f"❌ Erreur fatale: {e}")
        sys.exit(1)
