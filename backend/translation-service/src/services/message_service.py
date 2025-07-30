"""
Service de gestion des messages avec Prisma
Responsabilité: CRUD complet sur Messages et MessageTranslations
"""

import asyncio
import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path
import sys

# Ajouter le chemin vers le client Prisma généré
current_dir = Path(__file__).parent
shared_dir = current_dir.parent.parent.parent / "shared"
sys.path.insert(0, str(shared_dir / "generated"))

try:
    from prisma import Prisma
    from prisma.models import Message, MessageTranslation, User, Conversation
    PRISMA_AVAILABLE = True
except ImportError as e:
    logger = logging.getLogger(__name__)
    logger.error(f"❌ Prisma non disponible: {e}")
    PRISMA_AVAILABLE = False

from config.settings import get_settings
from services.translation_service import TranslationService
from services.cache_service import CacheService

logger = logging.getLogger(__name__)

class MessageService:
    """Service de gestion des messages avec Prisma"""
    
    def __init__(self, translation_service: TranslationService, cache_service: CacheService):
        self.settings = get_settings()
        self.translation_service = translation_service
        self.cache_service = cache_service
        self.prisma: Optional[Prisma] = None
        self.is_initialized = False
        
        # Statistiques
        self.stats = {
            'messages_created': 0,
            'translations_created': 0,
            'database_errors': 0
        }
    
    async def initialize(self):
        """Initialise la connexion Prisma"""
        if not PRISMA_AVAILABLE:
            logger.error("❌ Prisma non disponible")
            raise ImportError("Prisma client not available")
        
        try:
            self.prisma = Prisma()
            await self.prisma.connect()
            self.is_initialized = True
            logger.info("✅ Connexion Prisma établie")
            
        except Exception as e:
            logger.error(f"❌ Erreur connexion Prisma: {e}")
            raise
    
    async def create_message_with_translations(
        self,
        content: str,
        sender_id: str,
        conversation_id: str,
        source_language: str,
        target_languages: List[str],
        message_type: str = "text",
        model_tier: str = "basic"
    ) -> Dict[str, Any]:
        """
        Crée un message et ses traductions selon l'architecture Meeshy
        Cette fonction implémente le flux complet de traduction multi-langues
        """
        
        if not self.is_initialized:
            return {
                'success': False,
                'error': 'Service not initialized',
                'message_id': None,
                'translations': {}
            }
        
        try:
            # 1. Créer le message principal
            message = await self.prisma.message.create({
                'content': content,
                'senderId': sender_id,
                'conversationId': conversation_id,
                'originalLanguage': source_language,
                'messageType': message_type,
                'createdAt': datetime.now(),
                'updatedAt': datetime.now()
            })
            
            self.stats['messages_created'] += 1
            logger.info(f"📝 Message créé: {message.id}")
            
            # 2. Déterminer les langues cibles nécessaires
            required_languages = [lang for lang in target_languages if lang != source_language]
            
            if not required_languages:
                # Pas de traduction nécessaire
                return {
                    'success': True,
                    'message_id': message.id,
                    'original_text': content,
                    'source_language': source_language,
                    'translations': {},
                    'metadata': {
                        'translation_count': 0,
                        'processing_time': 0.001
                    }
                }
            
            # 3. Effectuer les traductions
            translation_result = await self.translation_service.translate_to_multiple_languages(
                content, source_language, required_languages, model_tier
            )
            
            if not translation_result['success']:
                logger.warning(f"⚠️ Échec partiel des traductions pour le message {message.id}")
            
            # 4. Stocker les traductions dans la base de données
            translations_created = {}
            for target_lang, translation_data in translation_result['results'].items():
                try:
                    # Générer la clé de cache
                    cache_key = self.cache_service.generate_cache_key(
                        content, source_language, target_lang, model_tier
                    )
                    
                    # Créer l'enregistrement MessageTranslation
                    translation_record = await self.prisma.messagetranslation.create({
                        'messageId': message.id,
                        'sourceLanguage': source_language,
                        'targetLanguage': target_lang,
                        'translatedContent': translation_data['translated_text'],
                        'translationModel': translation_data['metadata'].get('model_used', model_tier),
                        'cacheKey': cache_key,
                        'createdAt': datetime.now()
                    })
                    
                    translations_created[target_lang] = {
                        'id': translation_record.id,
                        'translated_text': translation_data['translated_text'],
                        'model_used': translation_data['metadata'].get('model_used', model_tier),
                        'confidence': translation_data['metadata'].get('confidence', 0.85),
                        'from_cache': translation_data['metadata'].get('from_cache', False),
                        'cache_key': cache_key
                    }
                    
                    self.stats['translations_created'] += 1
                    
                except Exception as e:
                    logger.error(f"❌ Erreur création traduction {target_lang}: {e}")
                    self.stats['database_errors'] += 1
            
            logger.info(f"✅ Message {message.id} avec {len(translations_created)} traductions créé")
            
            return {
                'success': True,
                'message_id': message.id,
                'original_text': content,
                'source_language': source_language,
                'translations': translations_created,
                'metadata': {
                    'translation_count': len(translations_created),
                    'requested_languages': len(required_languages),
                    'processing_time': sum(
                        t.get('metadata', {}).get('processing_time', 0) 
                        for t in translation_result['results'].values()
                    )
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur création message: {e}")
            self.stats['database_errors'] += 1
            return {
                'success': False,
                'error': str(e),
                'message_id': None,
                'translations': {}
            }
    
    async def get_message_with_translations(
        self, 
        message_id: str, 
        user_language: Optional[str] = None
    ) -> Dict[str, Any]:
        """Récupère un message avec ses traductions"""
        
        if not self.is_initialized:
            return {'success': False, 'error': 'Service not initialized'}
        
        try:
            # Récupérer le message avec ses traductions
            message = await self.prisma.message.find_unique(
                where={'id': message_id},
                include={
                    'translations': True,
                    'sender': {
                        'select': {
                            'id': True,
                            'username': True,
                            'displayName': True,
                            'avatar': True
                        }
                    }
                }
            )
            
            if not message:
                return {'success': False, 'error': 'Message not found'}
            
            # Organiser les traductions par langue
            translations = {}
            for translation in message.translations:
                translations[translation.targetLanguage] = {
                    'id': translation.id,
                    'translated_text': translation.translatedContent,
                    'model_used': translation.translationModel,
                    'cache_key': translation.cacheKey,
                    'created_at': translation.createdAt.isoformat()
                }
            
            # Déterminer le contenu à retourner selon la langue utilisateur
            display_content = message.content
            display_language = message.originalLanguage
            
            if user_language and user_language != message.originalLanguage:
                if user_language in translations:
                    display_content = translations[user_language]['translated_text']
                    display_language = user_language
            
            return {
                'success': True,
                'message': {
                    'id': message.id,
                    'content': display_content,
                    'original_content': message.content,
                    'original_language': message.originalLanguage,
                    'display_language': display_language,
                    'message_type': message.messageType,
                    'sender': message.sender,
                    'conversation_id': message.conversationId,
                    'created_at': message.createdAt.isoformat(),
                    'updated_at': message.updatedAt.isoformat()
                },
                'translations': translations
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur récupération message: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_conversation_messages(
        self,
        conversation_id: str,
        user_language: str,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Récupère les messages d'une conversation avec traductions filtrées"""
        
        if not self.is_initialized:
            return {'success': False, 'error': 'Service not initialized'}
        
        try:
            messages = await self.prisma.message.find_many(
                where={'conversationId': conversation_id},
                include={
                    'translations': {
                        'where': {'targetLanguage': user_language}
                    },
                    'sender': {
                        'select': {
                            'id': True,
                            'username': True,
                            'displayName': True,
                            'avatar': True
                        }
                    }
                },
                order_by={'createdAt': 'desc'},
                take=limit,
                skip=offset
            )
            
            # Formatter les messages selon la langue utilisateur
            formatted_messages = []
            for message in messages:
                # Déterminer le contenu à afficher
                if message.originalLanguage == user_language:
                    # Message déjà dans la bonne langue
                    display_content = message.content
                    is_translated = False
                else:
                    # Chercher la traduction appropriée
                    translation = next(
                        (t for t in message.translations if t.targetLanguage == user_language),
                        None
                    )
                    
                    if translation:
                        display_content = translation.translatedContent
                        is_translated = True
                    else:
                        # Pas de traduction disponible, utiliser l'original
                        display_content = message.content
                        is_translated = False
                
                formatted_messages.append({
                    'id': message.id,
                    'content': display_content,
                    'original_language': message.originalLanguage,
                    'is_translated': is_translated,
                    'sender': message.sender,
                    'message_type': message.messageType,
                    'created_at': message.createdAt.isoformat()
                })
            
            return {
                'success': True,
                'messages': formatted_messages,
                'total_count': len(formatted_messages),
                'user_language': user_language
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur récupération messages conversation: {e}")
            return {'success': False, 'error': str(e)}
    
    async def update_message(
        self,
        message_id: str,
        new_content: str,
        user_id: str
    ) -> Dict[str, Any]:
        """Met à jour un message et re-génère ses traductions si nécessaire"""
        
        if not self.is_initialized:
            return {'success': False, 'error': 'Service not initialized'}
        
        try:
            # Vérifier que l'utilisateur peut modifier ce message
            message = await self.prisma.message.find_unique(
                where={'id': message_id},
                include={'translations': True}
            )
            
            if not message:
                return {'success': False, 'error': 'Message not found'}
            
            if message.senderId != user_id:
                return {'success': False, 'error': 'Unauthorized'}
            
            # Mettre à jour le message
            updated_message = await self.prisma.message.update(
                where={'id': message_id},
                data={
                    'content': new_content,
                    'isEdited': True,
                    'editedAt': datetime.now(),
                    'updatedAt': datetime.now()
                }
            )
            
            # Si le contenu a changé, supprimer les anciennes traductions
            if message.content != new_content:
                await self.prisma.messagetranslation.delete_many(
                    where={'messageId': message_id}
                )
                
                # TODO: Re-générer les traductions si nécessaire
                # Cela nécessiterait de connaître les langues cibles requises
                
            return {
                'success': True,
                'message_id': message_id,
                'updated_content': new_content,
                'edited_at': updated_message.editedAt.isoformat() if updated_message.editedAt else None
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur mise à jour message: {e}")
            return {'success': False, 'error': str(e)}
    
    async def delete_message(self, message_id: str, user_id: str) -> Dict[str, Any]:
        """Supprime un message et ses traductions"""
        
        if not self.is_initialized:
            return {'success': False, 'error': 'Service not initialized'}
        
        try:
            # Vérifier les permissions
            message = await self.prisma.message.find_unique(
                where={'id': message_id}
            )
            
            if not message:
                return {'success': False, 'error': 'Message not found'}
            
            if message.senderId != user_id:
                return {'success': False, 'error': 'Unauthorized'}
            
            # Marquer comme supprimé (soft delete)
            await self.prisma.message.update(
                where={'id': message_id},
                data={
                    'isDeleted': True,
                    'deletedAt': datetime.now(),
                    'updatedAt': datetime.now()
                }
            )
            
            return {'success': True, 'message_id': message_id}
            
        except Exception as e:
            logger.error(f"❌ Erreur suppression message: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_required_languages_for_conversation(self, conversation_id: str) -> List[str]:
        """Détermine les langues requises pour une conversation selon les préférences utilisateur"""
        
        if not self.is_initialized:
            return []
        
        try:
            # Récupérer les membres de la conversation
            members = await self.prisma.conversationmember.find_many(
                where={
                    'conversationId': conversation_id,
                    'isActive': True
                },
                include={'user': True}
            )
            
            languages = set()
            
            for member in members:
                user = member.user
                
                # Logique selon les instructions Meeshy
                if user.useCustomDestination and user.customDestinationLanguage:
                    languages.add(user.customDestinationLanguage)
                elif user.translateToSystemLanguage:
                    languages.add(user.systemLanguage)
                elif user.translateToRegionalLanguage:
                    languages.add(user.regionalLanguage)
                else:
                    languages.add(user.systemLanguage)  # fallback
            
            return list(languages)
            
        except Exception as e:
            logger.error(f"❌ Erreur récupération langues conversation: {e}")
            return []
    
    async def get_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques du service"""
        try:
            if not self.is_initialized:
                return {'initialized': False}
            
            # Statistiques de base
            stats = {
                'initialized': True,
                'messages_created': self.stats['messages_created'],
                'translations_created': self.stats['translations_created'],
                'database_errors': self.stats['database_errors']
            }
            
            # Statistiques de la base de données
            try:
                message_count = await self.prisma.message.count()
                translation_count = await self.prisma.messagetranslation.count()
                
                stats.update({
                    'total_messages_in_db': message_count,
                    'total_translations_in_db': translation_count
                })
            except Exception as e:
                logger.error(f"❌ Erreur stats DB: {e}")
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Erreur récupération stats: {e}")
            return {'error': str(e)}
    
    async def cleanup(self):
        """Nettoie les ressources lors de l'arrêt"""
        try:
            if self.prisma:
                await self.prisma.disconnect()
                logger.info("✅ Connexion Prisma fermée")
        except Exception as e:
            logger.error(f"❌ Erreur fermeture Prisma: {e}")
