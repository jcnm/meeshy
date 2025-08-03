"""
API de santé pour le service de traduction Meeshy
Routes basiques de monitoring et health checks
"""

from fastapi import APIRouter
from typing import Dict, Any
import time
import logging

logger = logging.getLogger(__name__)

# Router pour les routes de santé
health_router = APIRouter(prefix="/api/v1", tags=["health"])

# Variable globale pour le temps de démarrage
startup_time = time.time()

@health_router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check basique"""
    return {
        "status": "healthy",
        "service": "meeshy-translator",
        "version": "1.0.0",
        "timestamp": time.time(),
        "uptime_seconds": time.time() - startup_time
    }

@health_router.get("/ready") 
async def readiness_check() -> Dict[str, str]:
    """Readiness check"""
    return {"status": "ready"}

@health_router.get("/live")
async def liveness_check() -> Dict[str, str]:
    """Liveness check"""
    return {"status": "alive"}

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

# Instance globale du service de traduction
translation_service = None

def set_translation_service(service):
    """Définit l'instance du service de traduction globalement"""
    global translation_service
    translation_service = service

def create_health_router() -> APIRouter:
    """Crée le routeur pour les endpoints de santé"""
    router = APIRouter(tags=["health"])
    
    @router.get("/health")
    async def health_check() -> Dict[str, Any]:
        """Endpoint de vérification de santé du service"""
        try:
            if translation_service is None:
                return {
                    "status": "unhealthy",
                    "message": "Translation service not initialized",
                    "service": "meeshy-translator",
                    "version": "1.0.0"
                }
            
            # Obtenir l'état de santé détaillé du service
            health_data = await translation_service.health_check()
            
            # Déterminer le statut global
            is_healthy = (
                health_data.get('service_initialized', False) and
                health_data.get('transformers_available', False)
            )
            
            return {
                "status": "healthy" if is_healthy else "degraded",
                "message": "Service operational" if is_healthy else "Service in degraded mode",
                "service": "meeshy-translator",
                "version": "1.0.0",
                "details": health_data
            }
            
        except Exception as e:
            logger.error(f"Health check error: {e}")
            return {
                "status": "unhealthy",
                "message": f"Health check failed: {str(e)}",
                "service": "meeshy-translator",
                "version": "1.0.0"
            }
    
    @router.get("/ready")
    async def readiness_check() -> Dict[str, Any]:
        """Endpoint de vérification de disponibilité"""
        try:
            if translation_service is None:
                raise HTTPException(status_code=503, detail="Service not ready")
            
            is_ready = (
                translation_service.is_initialized and
                len(translation_service.models) > 0
            )
            
            if not is_ready:
                raise HTTPException(status_code=503, detail="Service not ready")
            
            return {
                "status": "ready",
                "message": "Service is ready to handle requests",
                "models_loaded": len(translation_service.models),
                "pipelines_loaded": len(translation_service.pipelines)
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Readiness check error: {e}")
            raise HTTPException(status_code=503, detail=f"Readiness check failed: {str(e)}")
    
    @router.get("/live")
    async def liveness_check() -> Dict[str, Any]:
        """Endpoint de vérification de vitalité (simple)"""
        return {
            "status": "alive",
            "message": "Service is alive",
            "service": "meeshy-translator"
        }
    
    return router
