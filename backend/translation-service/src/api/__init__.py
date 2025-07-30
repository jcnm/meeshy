"""Initialisation du package API"""

from .translation_router import translation_router
from .message_router import message_router
from .health_router import health_router

__all__ = [
    'translation_router',
    'message_router',
    'health_router'
]
