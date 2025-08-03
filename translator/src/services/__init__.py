"""Initialisation du package services"""

# Imports conditionnels pour éviter les problèmes de dépendances
def get_cache_service():
    """Import conditionnel du CacheService"""
    from .cache_service import CacheService
    return CacheService

def get_translation_service():
    """Import conditionnel du TranslationService"""
    from .translation_service import TranslationService
    return TranslationService

def get_message_service():
    """Import conditionnel du MessageService"""
    from .message_service import MessageService
    return MessageService

# Exports pour la compatibilité
__all__ = [
    'get_cache_service',
    'get_translation_service', 
    'get_message_service'
]
