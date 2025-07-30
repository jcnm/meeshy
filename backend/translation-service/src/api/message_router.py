"""
Routeur API pour la gestion des messages
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request, Depends, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Modèles Pydantic
class CreateMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000, description="Contenu du message")
    sender_id: str = Field(..., description="ID de l'expéditeur")
    conversation_id: str = Field(..., description="ID de la conversation")
    source_language: str = Field(..., description="Langue source du message")
    target_languages: List[str] = Field(..., description="Langues cibles pour les traductions")
    message_type: str = Field("text", description="Type de message")
    model_tier: str = Field("basic", description="Niveau de modèle de traduction")

class UpdateMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000, description="Nouveau contenu")
    user_id: str = Field(..., description="ID de l'utilisateur demandant la modification")

class MessageResponse(BaseModel):
    success: bool
    message_id: Optional[str] = None
    original_text: Optional[str] = None
    source_language: Optional[str] = None
    translations: dict = {}
    metadata: dict = {}
    error: Optional[str] = None

class ConversationMessagesResponse(BaseModel):
    success: bool
    messages: List[dict] = []
    total_count: int = 0
    user_language: str = ""
    error: Optional[str] = None

# Dépendances
def get_message_service(request: Request):
    """Récupère le service de messages depuis l'état de l'application"""
    if not hasattr(request.app.state, 'message_service'):
        raise HTTPException(status_code=503, detail="Message service not available")
    return request.app.state.message_service

# Routeur
message_router = APIRouter()

@message_router.post("/", response_model=MessageResponse)
async def create_message(
    request: CreateMessageRequest,
    message_service=Depends(get_message_service)
) -> MessageResponse:
    """Crée un message avec ses traductions"""
    
    try:
        result = await message_service.create_message_with_translations(
            content=request.content,
            sender_id=request.sender_id,
            conversation_id=request.conversation_id,
            source_language=request.source_language,
            target_languages=request.target_languages,
            message_type=request.message_type,
            model_tier=request.model_tier
        )
        
        return MessageResponse(
            success=result['success'],
            message_id=result.get('message_id'),
            original_text=result.get('original_text'),
            source_language=result.get('source_language'),
            translations=result.get('translations', {}),
            metadata=result.get('metadata', {}),
            error=result.get('error')
        )
        
    except Exception as e:
        logger.error(f"❌ Erreur API création message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@message_router.get("/{message_id}")
async def get_message(
    message_id: str,
    user_language: Optional[str] = Query(None, description="Langue utilisateur pour affichage"),
    message_service=Depends(get_message_service)
):
    """Récupère un message avec ses traductions"""
    
    try:
        result = await message_service.get_message_with_translations(
            message_id=message_id,
            user_language=user_language
        )
        
        if not result['success']:
            raise HTTPException(status_code=404, detail=result.get('error', 'Message not found'))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erreur API récupération message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@message_router.put("/{message_id}")
async def update_message(
    message_id: str,
    request: UpdateMessageRequest,
    message_service=Depends(get_message_service)
):
    """Met à jour un message"""
    
    try:
        result = await message_service.update_message(
            message_id=message_id,
            new_content=request.content,
            user_id=request.user_id
        )
        
        if not result['success']:
            if 'not found' in result.get('error', '').lower():
                raise HTTPException(status_code=404, detail=result['error'])
            elif 'unauthorized' in result.get('error', '').lower():
                raise HTTPException(status_code=403, detail=result['error'])
            else:
                raise HTTPException(status_code=400, detail=result.get('error', 'Update failed'))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erreur API mise à jour message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@message_router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    user_id: str = Query(..., description="ID de l'utilisateur demandant la suppression"),
    message_service=Depends(get_message_service)
):
    """Supprime un message"""
    
    try:
        result = await message_service.delete_message(
            message_id=message_id,
            user_id=user_id
        )
        
        if not result['success']:
            if 'not found' in result.get('error', '').lower():
                raise HTTPException(status_code=404, detail=result['error'])
            elif 'unauthorized' in result.get('error', '').lower():
                raise HTTPException(status_code=403, detail=result['error'])
            else:
                raise HTTPException(status_code=400, detail=result.get('error', 'Delete failed'))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erreur API suppression message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@message_router.get("/conversation/{conversation_id}", response_model=ConversationMessagesResponse)
async def get_conversation_messages(
    conversation_id: str,
    user_language: str = Query(..., description="Langue utilisateur pour affichage"),
    limit: int = Query(50, ge=1, le=100, description="Nombre de messages à récupérer"),
    offset: int = Query(0, ge=0, description="Décalage pour la pagination"),
    message_service=Depends(get_message_service)
) -> ConversationMessagesResponse:
    """Récupère les messages d'une conversation avec traductions filtrées"""
    
    try:
        result = await message_service.get_conversation_messages(
            conversation_id=conversation_id,
            user_language=user_language,
            limit=limit,
            offset=offset
        )
        
        return ConversationMessagesResponse(
            success=result['success'],
            messages=result.get('messages', []),
            total_count=result.get('total_count', 0),
            user_language=result.get('user_language', user_language),
            error=result.get('error')
        )
        
    except Exception as e:
        logger.error(f"❌ Erreur API messages conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@message_router.get("/conversation/{conversation_id}/languages")
async def get_conversation_required_languages(
    conversation_id: str,
    message_service=Depends(get_message_service)
):
    """Retourne les langues requises pour une conversation"""
    
    try:
        languages = await message_service.get_required_languages_for_conversation(conversation_id)
        
        return {
            'conversation_id': conversation_id,
            'required_languages': languages,
            'count': len(languages)
        }
        
    except Exception as e:
        logger.error(f"❌ Erreur API langues conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@message_router.get("/stats")
async def get_message_stats(
    message_service=Depends(get_message_service)
):
    """Retourne les statistiques du service de messages"""
    
    try:
        stats = await message_service.get_stats()
        return stats
        
    except Exception as e:
        logger.error(f"❌ Erreur API stats messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))
