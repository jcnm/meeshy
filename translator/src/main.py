"""
Serveur de traduction haute performance Meeshy
Architecture: PUB/SUB + REQ/REP avec pool de connexions et traitement asynchrone
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Charger les variables d'environnement
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("[TRANSLATOR] ✅ Variables d'environnement .env chargées")
except ImportError:
    print("[TRANSLATOR] ⚠️ python-dotenv non disponible, utilisation des variables système")

# Ajouter le répertoire src au path
src_path = Path(__file__).parent
sys.path.insert(0, str(src_path))

from config.settings import Settings
from services.zmq_server import ZMQTranslationServer
from services.unified_ml_service import get_unified_ml_service
from api.translation_api import TranslationAPI

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('translator.log', mode='w')  # Mode 'w' pour écraser le fichier
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
        """Initialise le serveur de traduction avec architecture unifiée"""
        try:
            logger.info("[TRANSLATOR] 🚀 Initialisation du serveur de traduction avec ML unifié...")
            
            # 1. Initialiser le service ML unifié (Singleton)
            max_workers = int(os.getenv('TRANSLATION_WORKERS', '10'))
            self.translation_service = get_unified_ml_service(max_workers=max_workers)
            
            # Charger les modèles ML au démarrage
            logger.info("[TRANSLATOR] 📚 Chargement des modèles ML...")
            ml_initialized = await self.translation_service.initialize()
            if not ml_initialized:
                logger.warning("[TRANSLATOR] ⚠️ Modèles ML non disponibles, fonctionnement en mode fallback")
            else:
                logger.info("[TRANSLATOR] ✅ Service ML unifié initialisé avec succès")
            
            # 2. Initialiser le serveur ZMQ avec le service ML unifié
            self.zmq_server = ZMQTranslationServer(
                gateway_push_port=5555,  # Port où Translator PULL bind (Gateway PUSH connect ici)
                gateway_sub_port=5558,   # Port où Translator PUB bind (Gateway SUB connect ici)
                normal_workers=max_workers // 2,
                any_workers=max_workers // 4,
                translation_service=self.translation_service  # Service ML unifié
            )
            # Initialiser le serveur ZMQ
            await self.zmq_server.initialize()
            logger.info("[TRANSLATOR] ✅ Serveur ZMQ configuré avec service ML unifié")
            
            # 3. Initialiser l'API FastAPI avec le service ML unifié
            self.translation_api = TranslationAPI(
                translation_service=self.translation_service,  # Service ML unifié
                zmq_server=self.zmq_server
            )
            logger.info("[TRANSLATOR] ✅ API FastAPI configurée avec service ML unifié")
            
            self.is_initialized = True
            logger.info("[TRANSLATOR] ✅ Architecture unifiée initialisée avec succès")
            logger.info("[TRANSLATOR] 🎯 Tous les canaux (ZMQ, REST) utilisent le même service ML")
            
            return True
            
        except Exception as e:
            logger.error(f"[TRANSLATOR] ❌ Erreur lors de l'initialisation: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def start_zmq_server(self):
        """Démarre le serveur ZMQ haute performance"""
        try:
            logger.info("[TRANSLATOR] 🔌 Démarrage du serveur ZMQ haute performance...")
            # Marquer le serveur comme démarré
            self.zmq_server.running = True
            logger.info(f"[TRANSLATOR] ✅ Serveur ZMQ marqué comme démarré (running={self.zmq_server.running})")
            # Démarrer le serveur ZMQ en arrière-plan
            task = asyncio.create_task(self.zmq_server.start())
            logger.info("[TRANSLATOR] ✅ Tâche serveur ZMQ créée avec succès")
            return task
        except Exception as e:
            logger.error(f"[TRANSLATOR] ❌ Erreur serveur ZMQ: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def start_api_server(self):
        """Démarre l'API FastAPI"""
        try:
            logger.info("[TRANSLATOR] 🌐 Démarrage de l'API FastAPI...")
            import uvicorn
            
            host = "0.0.0.0"
            port = int(self.settings.fastapi_port or 8000)
            
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
            logger.error(f"[TRANSLATOR] ❌ Erreur API FastAPI: {e}")
    
    async def start(self):
        """Démarre le serveur de traduction"""
        if not await self.initialize():
            logger.error("[TRANSLATOR] ❌ Échec de l'initialisation, arrêt du serveur")
            return
        
        try:
            logger.info("[TRANSLATOR] 🚀 Démarrage du serveur de traduction haute performance...")
            
            # Démarrer le serveur ZMQ en arrière-plan
            zmq_task = await self.start_zmq_server()
            if not zmq_task:
                logger.error("[TRANSLATOR] ❌ Impossible de démarrer le serveur ZMQ")
                return
            
            logger.info("[TRANSLATOR] ✅ Serveur ZMQ démarré avec succès")
            
            # Démarrer l'API FastAPI en parallèle avec ZMQ
            api_task = asyncio.create_task(self.start_api_server())
            
            # Attendre que l'une des tâches se termine
            await asyncio.gather(zmq_task, api_task, return_exceptions=True)
            
        except KeyboardInterrupt:
            logger.info("[TRANSLATOR] 🛑 Arrêt demandé par l'utilisateur")
        except Exception as e:
            logger.error(f"[TRANSLATOR] ❌ Erreur serveur: {e}")
            import traceback
            traceback.print_exc()
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
