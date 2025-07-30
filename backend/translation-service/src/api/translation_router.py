"""
Routeur API pour les fonctionnalités de traduction
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Modèles Pydantic pour les requêtes/réponses
class TranslationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000, description="Texte à traduire")
    source_language: str = Field(..., description="Langue source (code ISO 639-1)")
    target_language: str = Field(..., description="Langue cible (code ISO 639-1)")
    model_tier: str = Field("basic", description="Niveau de modèle (basic, medium, premium)")

class BatchTranslationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000, description="Texte à traduire")
    source_language: str = Field(..., description="Langue source (code ISO 639-1)")
    target_languages: List[str] = Field(..., description="Langues cibles")
    model_tier: str = Field("basic", description="Niveau de modèle")

class LanguageDetectionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000, description="Texte à analyser")

class TranslationResponse(BaseModel):
    success: bool
    translated_text: str = ""
    source_language: str = ""
    target_language: str = ""
    metadata: dict = {}
    error: Optional[str] = None

class BatchTranslationResponse(BaseModel):
    success: bool
    results: dict = {}
    errors: List[str] = []
    metadata: dict = {}

class LanguageDetectionResponse(BaseModel):
    detected_language: str
    confidence: float
    alternatives: List[dict] = []

# Dépendances
def get_translation_service(request: Request):
    """Récupère le service de traduction depuis l'état de l'application"""
    if not hasattr(request.app.state, 'translation_service'):
        raise HTTPException(status_code=503, detail="Translation service not available")
    return request.app.state.translation_service

# Routeur
translation_router = APIRouter()

@translation_router.post("/translate", response_model=TranslationResponse)
async def translate_text(
    request: TranslationRequest,
    translation_service=Depends(get_translation_service)
) -> TranslationResponse:
    """Traduit un texte d'une langue vers une autre"""
    
    try:
        result = await translation_service.translate_text(
            text=request.text,
            source_lang=request.source_language,
            target_lang=request.target_language,
            model_tier=request.model_tier
        )
        
        return TranslationResponse(
            success=result['success'],
            translated_text=result.get('translated_text', ''),
            source_language=request.source_language,
            target_language=request.target_language,
            metadata=result.get('metadata', {}),
            error=result.get('error')
        )
        
    except Exception as e:
        logger.error(f"❌ Erreur API traduction: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@translation_router.post("/translate/batch", response_model=BatchTranslationResponse)
async def translate_to_multiple_languages(
    request: BatchTranslationRequest,
    translation_service=Depends(get_translation_service)
) -> BatchTranslationResponse:
    """Traduit un texte vers plusieurs langues simultanément"""
    
    try:
        result = await translation_service.translate_to_multiple_languages(
            text=request.text,
            source_lang=request.source_language,
            target_languages=request.target_languages,
            model_tier=request.model_tier
        )
        
        return BatchTranslationResponse(
            success=result['success'],
            results=result.get('results', {}),
            errors=result.get('errors', []),
            metadata={
                'total_languages': result.get('total_languages', 0),
                'successful_translations': result.get('successful_translations', 0)
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Erreur API traduction batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@translation_router.post("/detect-language", response_model=LanguageDetectionResponse)
async def detect_language(
    request: LanguageDetectionRequest,
    translation_service=Depends(get_translation_service)
) -> LanguageDetectionResponse:
    """Détecte la langue d'un texte"""
    
    try:
        result = await translation_service.detect_language(request.text)
        
        return LanguageDetectionResponse(
            detected_language=result['detected_language'],
            confidence=result['confidence'],
            alternatives=result.get('alternatives', [])
        )
        
    except Exception as e:
        logger.error(f"❌ Erreur API détection langue: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@translation_router.get("/stats")
async def get_translation_stats(
    translation_service=Depends(get_translation_service)
):
    """Retourne les statistiques du service de traduction"""
    
    try:
        stats = await translation_service.get_stats()
        return stats
        
    except Exception as e:
        logger.error(f"❌ Erreur API stats traduction: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@translation_router.get("/supported-languages")
async def get_supported_languages():
    """Retourne la liste des langues supportées"""
    
    from config.settings import get_settings
    settings = get_settings()
    
    return {
        'supported_languages': settings.supported_languages_list,
        'default_language': settings.default_language,
        'auto_detect_enabled': settings.auto_detect_language
    }

@translation_router.delete("/cache")
async def clear_translation_cache(request: Request):
    """Vide le cache de traductions"""
    
    try:
        if not hasattr(request.app.state, 'cache_service'):
            raise HTTPException(status_code=503, detail="Cache service not available")
        
        cache_service = request.app.state.cache_service
        success = await cache_service.clear_cache()
        
        if success:
            return {"message": "Cache cleared successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to clear cache")
            
    except Exception as e:
        logger.error(f"❌ Erreur vidage cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))
