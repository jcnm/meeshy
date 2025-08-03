#!/usr/bin/env python3
"""
Service de traduction Meeshy - Version Pipeline
Point d'entrée principal avec gRPC et ZMQ
"""

import asyncio
import logging
import signal
import sys
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
    from services.translation_service_clean import TranslationService
    from config.settings import get_settings
except ImportError as e:
    logger.error(f"Erreur d'import: {e}")
    sys.exit(1)

class MeeshyTranslationServer:
    """Serveur de traduction principal avec pipeline optimisé"""
    
    def __init__(self):
        self.settings = get_settings()
        self.translation_service = None
        self.running = False
        
    async def initialize(self):
        """Initialise les services"""
        logger.info("🤖 Initialisation du serveur de traduction Meeshy Pipeline...")
        
        try:
            # Initialise le service de traduction
            self.translation_service = TranslationService()
            await self.translation_service.initialize()
            
            logger.info("✅ Service de traduction initialisé")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'initialisation: {e}")
            return False
    
    async def start_simple_server(self):
        """Démarre un serveur simple pour les tests"""
        logger.info("🚀 Démarrage du serveur de test simple...")
        
        # Test du service
        test_result = await self.translation_service.translate(
            text="Hello world",
            source_language="en", 
            target_language="fr",
            model_type="medium"
        )
        
        logger.info(f"🧪 Test de traduction: {test_result}")
        
        # Serveur simple qui écoute en boucle
        self.running = True
        logger.info("✅ Serveur de traduction prêt et en fonctionnement")
        logger.info("📍 Service disponible pour les requêtes de traduction")
        
        try:
            while self.running:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("🛑 Arrêt du serveur demandé")
        finally:
            await self.shutdown()
    
    async def shutdown(self):
        """Arrête proprement le serveur"""
        logger.info("🧹 Arrêt du serveur de traduction...")
        self.running = False
        
        if self.translation_service:
            # Décharger proprement tous les modèles
            await self.translation_service.cleanup()
            logger.info("✅ Service de traduction arrêté proprement")

async def main():
    """Fonction principale"""
    logger.info("🌟 Démarrage Meeshy Translation Service Pipeline")
    
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
        await server.start_simple_server()
        
    except Exception as e:
        logger.error(f"💥 Erreur critique: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
