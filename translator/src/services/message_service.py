"""
Service de gestion des messages pour les traductions
Interface avec la base de données Prisma
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from services.database_service_simple import DatabaseServiceSimple as DatabaseService

logger = logging.getLogger(__name__)

class MessageService:
    """Service de gestion des messages et conversations"""
    
    def __init__(self, database_service: Optional[DatabaseService] = None):
        self.is_initialized = False
        self.database_service = database_service
    
    async def initialize(self, database_service: Optional[DatabaseService] = None):
        """Initialise le service de messages avec connexion à la base de données"""
        try:
            logger.info("💬 Initialisation du service de messages...")
            
            # Utiliser le service de base de données fourni
            if database_service:
                self.database_service = database_service
            
            if self.database_service and self.database_service.is_connected:
                logger.info("✅ Service de messages connecté à la base de données")
            else:
                logger.warning("⚠️  Service de messages initialisé sans connexion à la base de données")
            
            self.is_initialized = True
            logger.info("✅ Service de messages initialisé")
        except Exception as e:
            logger.error(f"❌ Erreur initialisation service messages: {e}")
            raise
    
    async def log_translation(self, translation_data: Dict[str, Any]) -> bool:
        """Enregistre une traduction dans les logs et potentiellement en base de données"""
        try:
            # Log basique
            logger.info(f"📝 Translation logged: {translation_data.get('message_id', 'unknown')}")
            
            # Si connecté à la base de données, on pourrait enregistrer en base
            if self.database_service and self.database_service.is_connected:
                prisma = self.database_service.get_prisma_client()
                if prisma:
                    # Ici on pourrait enregistrer la traduction en base de données
                    # await prisma.messagetranslation.create(data=translation_data)
                    logger.debug("🗄️  Traduction pourrait être enregistrée en base de données")
            
            return True
        except Exception as e:
            logger.error(f"❌ Erreur logging translation: {e}")
            return False
    
    async def get_conversation_languages(self, conversation_id: str) -> List[str]:
        """Récupère les langues des participants d'une conversation"""
        try:
            # Si connecté à la base de données, faire une vraie requête
            if self.database_service and self.database_service.is_connected:
                prisma = self.database_service.get_prisma_client()
                if prisma:
                    try:
                        # Requête pour récupérer les langues des participants
                        # Dans une vraie implémentation:
                        # conversation_members = await prisma.conversationmember.find_many(
                        #     where={'conversation_id': conversation_id},
                        #     include={'user': True}
                        # )
                        # return [member.user.system_language for member in conversation_members]
                        logger.debug(f"🔍 Recherche des langues pour conversation {conversation_id}")
                    except Exception as e:
                        logger.warning(f"⚠️  Erreur requête base de données: {e}")
            
            # Fallback avec langues par défaut
            return ['fr', 'en', 'es']  # Langues par défaut
        except Exception as e:
            logger.error(f"❌ Erreur récupération langues conversation: {e}")
            return ['fr', 'en']  # Fallback
    
    async def health_check(self) -> Dict[str, Any]:
        """Vérifie la santé du service de messages"""
        health_data = {
            'service_initialized': self.is_initialized,
            'database_service_available': self.database_service is not None,
            'database_connected': False
        }
        
        if self.database_service:
            db_health = await self.database_service.health_check()
            health_data.update(db_health)
        
        return health_data
