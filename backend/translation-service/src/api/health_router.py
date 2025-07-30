"""
Routeur API pour les vérifications de santé
"""

import logging
import time
from datetime import datetime
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# Modèles de réponse
class ServiceStatus(BaseModel):
    name: str
    status: str  # "healthy", "degraded", "unhealthy"
    message: str
    response_time_ms: Optional[float] = None

class HealthCheckResponse(BaseModel):
    service: str
    version: str
    status: str  # "healthy", "degraded", "unhealthy"
    timestamp: str
    uptime_seconds: float
    services: List[ServiceStatus]
    details: Dict[str, Any]

# Routeur
health_router = APIRouter()

@health_router.get("/", response_model=HealthCheckResponse)
async def health_check(request: Request) -> HealthCheckResponse:
    """Vérification de santé complète du service"""
    
    start_time = time.time()
    app_start_time = getattr(request.app.state, 'start_time', time.time())
    uptime = time.time() - app_start_time
    
    services_status = []
    overall_status = "healthy"
    
    # 1. Vérification du service de traduction
    translation_status = await _check_translation_service(request)
    services_status.append(translation_status)
    
    # 2. Vérification du service de cache
    cache_status = await _check_cache_service(request)
    services_status.append(cache_status)
    
    # 3. Vérification du service de messages (Prisma)
    message_status = await _check_message_service(request)
    services_status.append(message_status)
    
    # Déterminer le statut global
    unhealthy_services = [s for s in services_status if s.status == "unhealthy"]
    degraded_services = [s for s in services_status if s.status == "degraded"]
    
    if unhealthy_services:
        overall_status = "unhealthy"
    elif degraded_services:
        overall_status = "degraded"
    
    # Détails additionnels
    details = {
        "environment": "development",  # TODO: configurable
        "python_version": f"{__import__('sys').version_info.major}.{__import__('sys').version_info.minor}",
        "total_response_time_ms": (time.time() - start_time) * 1000,
        "healthy_services": len([s for s in services_status if s.status == "healthy"]),
        "total_services": len(services_status)
    }
    
    return HealthCheckResponse(
        service="Meeshy Translation Service",
        version="1.0.0",
        status=overall_status,
        timestamp=datetime.now().isoformat(),
        uptime_seconds=uptime,
        services=services_status,
        details=details
    )

@health_router.get("/ready")
async def readiness_check(request: Request):
    """Vérification de disponibilité (pour Kubernetes)"""
    
    # Vérifier les services critiques
    services_ready = []
    
    # Service de traduction
    if hasattr(request.app.state, 'translation_service'):
        translation_service = request.app.state.translation_service
        if translation_service.is_initialized:
            services_ready.append("translation")
    
    # Service de messages
    if hasattr(request.app.state, 'message_service'):
        message_service = request.app.state.message_service
        if message_service.is_initialized:
            services_ready.append("messages")
    
    # Service considéré prêt si au moins les services critiques sont initialisés
    is_ready = "translation" in services_ready and "messages" in services_ready
    
    if is_ready:
        return {
            "status": "ready",
            "services": services_ready,
            "timestamp": datetime.now().isoformat()
        }
    else:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not_ready",
                "services": services_ready,
                "timestamp": datetime.now().isoformat()
            }
        )

@health_router.get("/live")
async def liveness_check():
    """Vérification de vie (pour Kubernetes)"""
    
    return {
        "status": "alive",
        "timestamp": datetime.now().isoformat()
    }

# Fonctions utilitaires pour les vérifications de service

async def _check_translation_service(request: Request) -> ServiceStatus:
    """Vérifie l'état du service de traduction"""
    
    start_time = time.time()
    
    try:
        if not hasattr(request.app.state, 'translation_service'):
            return ServiceStatus(
                name="translation_service",
                status="unhealthy",
                message="Translation service not initialized",
                response_time_ms=(time.time() - start_time) * 1000
            )
        
        translation_service = request.app.state.translation_service
        
        if not translation_service.is_initialized:
            return ServiceStatus(
                name="translation_service",
                status="unhealthy",
                message="Translation models not loaded",
                response_time_ms=(time.time() - start_time) * 1000
            )
        
        # Test simple de traduction
        result = await translation_service.translate_text(
            text="hello",
            source_lang="en",
            target_lang="fr",
            model_tier="basic"
        )
        
        if result['success']:
            return ServiceStatus(
                name="translation_service",
                status="healthy",
                message=f"Models loaded: {list(translation_service.pipelines.keys())}",
                response_time_ms=(time.time() - start_time) * 1000
            )
        else:
            return ServiceStatus(
                name="translation_service",
                status="degraded",
                message=f"Translation test failed: {result.get('error', 'unknown')}",
                response_time_ms=(time.time() - start_time) * 1000
            )
        
    except Exception as e:
        return ServiceStatus(
            name="translation_service",
            status="unhealthy",
            message=f"Service error: {str(e)}",
            response_time_ms=(time.time() - start_time) * 1000
        )

async def _check_cache_service(request: Request) -> ServiceStatus:
    """Vérifie l'état du service de cache"""
    
    start_time = time.time()
    
    try:
        if not hasattr(request.app.state, 'cache_service'):
            return ServiceStatus(
                name="cache_service",
                status="unhealthy",
                message="Cache service not initialized",
                response_time_ms=(time.time() - start_time) * 1000
            )
        
        cache_service = request.app.state.cache_service
        stats = await cache_service.get_cache_stats()
        
        if stats.get('available', False):
            cache_type = stats.get('cache_type', 'unknown')
            return ServiceStatus(
                name="cache_service",
                status="healthy",
                message=f"Cache {cache_type} operational",
                response_time_ms=(time.time() - start_time) * 1000
            )
        else:
            return ServiceStatus(
                name="cache_service",
                status="degraded",
                message="Cache not available, using fallback",
                response_time_ms=(time.time() - start_time) * 1000
            )
        
    except Exception as e:
        return ServiceStatus(
            name="cache_service",
            status="unhealthy",
            message=f"Cache error: {str(e)}",
            response_time_ms=(time.time() - start_time) * 1000
        )

async def _check_message_service(request: Request) -> ServiceStatus:
    """Vérifie l'état du service de messages"""
    
    start_time = time.time()
    
    try:
        if not hasattr(request.app.state, 'message_service'):
            return ServiceStatus(
                name="message_service",
                status="unhealthy",
                message="Message service not initialized",
                response_time_ms=(time.time() - start_time) * 1000
            )
        
        message_service = request.app.state.message_service
        
        if not message_service.is_initialized:
            return ServiceStatus(
                name="message_service",
                status="unhealthy",
                message="Database connection not established",
                response_time_ms=(time.time() - start_time) * 1000
            )
        
        # Test simple de connexion DB
        stats = await message_service.get_stats()
        
        if stats.get('initialized', False):
            return ServiceStatus(
                name="message_service",
                status="healthy",
                message="Database connection active",
                response_time_ms=(time.time() - start_time) * 1000
            )
        else:
            return ServiceStatus(
                name="message_service",
                status="degraded",
                message="Database connection issues",
                response_time_ms=(time.time() - start_time) * 1000
            )
        
    except Exception as e:
        return ServiceStatus(
            name="message_service",
            status="unhealthy",
            message=f"Database error: {str(e)}",
            response_time_ms=(time.time() - start_time) * 1000
        )
