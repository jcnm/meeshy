"""
Health check simple pour débuguer le problème de sérialisation
"""

from fastapi import APIRouter
import logging
import time

logger = logging.getLogger(__name__)

# Router simple pour test
simple_health_router = APIRouter(prefix="", tags=["debug"])

# Temps de démarrage
startup_time = time.time()

@simple_health_router.get("/health")
async def working_health_check():
    """Health check qui remplace temporairement le principal"""
    # Variables globales pour les services (à remplacer par l'import depuis health.py)
    from api.health import translation_service, database_service, zmq_server
    
    # Vérifications simples et sécurisées
    db_connected = False
    if database_service:
        try:
            db_connected = bool(hasattr(database_service, 'is_connected') and database_service.is_connected)
        except:
            db_connected = False
    
    zmq_running = False
    if zmq_server:
        try:
            zmq_running = bool(hasattr(zmq_server, 'running') and zmq_server.running)
        except:
            zmq_running = False
    
    models_loaded = False
    models_count = 0
    if translation_service:
        try:
            if hasattr(translation_service, 'models') and translation_service.models:
                models_count = len(translation_service.models)
                models_loaded = models_count > 0
        except:
            pass
    
    # Déterminer le statut global
    if db_connected and zmq_running:
        overall_status = "degraded" if not models_loaded else "healthy"
    else:
        overall_status = "unhealthy"
    
    return {
        "status": overall_status,
        "service": "meeshy-translator",
        "version": "1.0.0",
        "timestamp": time.time(),
        "uptime_seconds": time.time() - startup_time,
        "components": {
            "database": {
                "connected": db_connected,
                "status": "degraded_mode" if db_connected else "disconnected"
            },
            "zmq_server": {
                "running": zmq_running,
                "status": "healthy" if zmq_running else "stopped",
                "port": 5555,
                "address": "tcp://0.0.0.0:5555"
            },
            "translation_models": {
                "loaded": models_loaded,
                "count": models_count,
                "status": "healthy" if models_loaded else "degraded_mode",
                "degraded_mode": not models_loaded
            }
        },
        "summary": {
            "database_connected": db_connected,
            "zmq_running": zmq_running,
            "models_loaded": models_loaded,
            "total_models": models_count
        }
    }

@simple_health_router.get("/ready")
async def working_ready_check():
    """Ready check simplifié"""
    from api.health import database_service, zmq_server
    
    db_ready = database_service is not None
    zmq_ready = zmq_server is not None and hasattr(zmq_server, 'running') and zmq_server.running
    
    if not (db_ready and zmq_ready):
        return {
            "status": "not_ready",
            "message": "Service not ready", 
            "database_ready": db_ready,
            "zmq_ready": zmq_ready
        }
    
    return {
        "status": "ready",
        "message": "Service ready to handle translation requests",
        "database_ready": db_ready,
        "zmq_ready": zmq_ready
    }
