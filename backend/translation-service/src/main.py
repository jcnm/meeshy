#!/usr/bin/env python3
"""
Service de traduction FastAPI pour Meeshy
Architecture: FastAPI + Prisma + MT5/NLLB + Redis + gRPC/ZMQ
Responsabilités: CRUD Messages & MessageTranslations, traduction multi-langues
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ajouter les chemins nécessaires
current_dir = Path(__file__).parent
shared_dir = current_dir.parent.parent / "shared"
sys.path.insert(0, str(shared_dir))
sys.path.insert(0, str(current_dir))

# Services principaux
from services.translation_service import TranslationService
from services.message_service import MessageService  
from services.cache_service import CacheService
from api.translation_router import translation_router
from api.message_router import message_router
from api.health_router import health_router
from grpc.translation_grpc_server import start_grpc_server
from queue.zmq_handler import start_zmq_handler
from config.settings import get_settings

# Gestionnaire de cycle de vie de l'application
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestionnaire de cycle de vie de l'application"""
    settings = get_settings()
    
    # Initialisation des services
    logger.info("🚀 Initialisation du service de traduction Meeshy...")
    
    try:
        # 1. Initialisation du cache Redis
        cache_service = CacheService()
        await cache_service.initialize()
        app.state.cache_service = cache_service
        logger.info("✅ Cache Redis initialisé")
        
        # 2. Initialisation du service de traduction (modèles ML)
        translation_service = TranslationService(cache_service)
        await translation_service.initialize()
        app.state.translation_service = translation_service
        logger.info("✅ Service de traduction initialisé")
        
        # 3. Initialisation du service de messages (Prisma)
        message_service = MessageService(translation_service, cache_service)
        await message_service.initialize()
        app.state.message_service = message_service
        logger.info("✅ Service de messages initialisé")
        
        # 4. Démarrage du serveur gRPC en arrière-plan
        grpc_task = asyncio.create_task(
            start_grpc_server(translation_service, message_service, settings.grpc_port)
        )
        app.state.grpc_task = grpc_task
        logger.info(f"✅ Serveur gRPC démarré sur le port {settings.grpc_port}")
        
        # 5. Démarrage du handler ZMQ en arrière-plan
        zmq_task = asyncio.create_task(
            start_zmq_handler(translation_service, message_service, settings.zmq_port)
        )
        app.state.zmq_task = zmq_task
        logger.info(f"✅ Handler ZMQ démarré sur le port {settings.zmq_port}")
        
        # Application prête
        logger.info("🌍 Service de traduction Meeshy prêt!")
        logger.info(f"📊 FastAPI: http://localhost:{settings.fastapi_port}")
        logger.info(f"🔌 gRPC: localhost:{settings.grpc_port}")
        logger.info(f"⚡ ZMQ: localhost:{settings.zmq_port}")
        
        yield
        
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'initialisation: {e}")
        raise
    
    # Nettoyage lors de l'arrêt
    logger.info("🛑 Arrêt du service de traduction...")
    
    try:
        # Arrêt des tâches en arrière-plan
        if hasattr(app.state, 'grpc_task'):
            app.state.grpc_task.cancel()
        if hasattr(app.state, 'zmq_task'):
            app.state.zmq_task.cancel()
            
        # Nettoyage des services
        if hasattr(app.state, 'cache_service'):
            await app.state.cache_service.cleanup()
        if hasattr(app.state, 'translation_service'):
            await app.state.translation_service.cleanup()
        if hasattr(app.state, 'message_service'):
            await app.state.message_service.cleanup()
            
        logger.info("✅ Nettoyage terminé")
        
    except Exception as e:
        logger.error(f"❌ Erreur lors du nettoyage: {e}")

# Configuration de l'application FastAPI
app = FastAPI(
    title="Meeshy Translation Service",
    description="Service de traduction haute performance avec support multi-langues",
    version="1.0.0",
    lifespan=lifespan
)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, spécifier les domaines autorisés
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enregistrement des routeurs
app.include_router(translation_router, prefix="/api/v1/translation", tags=["Translation"])
app.include_router(message_router, prefix="/api/v1/messages", tags=["Messages"])
app.include_router(health_router, prefix="/api/v1/health", tags=["Health"])

# Endpoint racine
@app.get("/")
async def root():
    """Point d'entrée racine du service"""
    return {
        "service": "Meeshy Translation Service",
        "version": "1.0.0",
        "status": "running",
        "architecture": "FastAPI + Prisma + MT5/NLLB + Redis + gRPC/ZMQ",
        "endpoints": {
            "docs": "/docs",
            "health": "/api/v1/health",
            "translation": "/api/v1/translation",
            "messages": "/api/v1/messages"
        }
    }

# Point d'entrée principal
if __name__ == "__main__":
    import uvicorn
    from config.settings import get_settings
    
    settings = get_settings()
    
    # Configuration pour le développement
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.fastapi_port,
        reload=settings.debug,
        log_level="info" if settings.debug else "warning",
        workers=1 if settings.debug else settings.workers
    )
