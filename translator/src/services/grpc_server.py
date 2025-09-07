"""
Service gRPC pour la retraduction des messages modifiés
"""

import asyncio
import logging
import grpc
from concurrent import futures
from typing import Dict, Any

# Import des services existants
from .database_service import DatabaseService
from .zmq_server import ZMQTranslationServer

logger = logging.getLogger(__name__)

class MessageRetranslationService:
    """Service gRPC pour gérer la retraduction des messages modifiés"""
    
    def __init__(self, database_service: DatabaseService, zmq_server: ZMQTranslationServer):
        self.database_service = database_service
        self.zmq_server = zmq_server
    
    async def retranslate_message(self, message_id: str, content: str, original_language: str, user_id: str) -> Dict[str, Any]:
        """
        Retraduit un message modifié
        
        Args:
            message_id: ID du message
            content: Nouveau contenu du message
            original_language: Langue originale
            user_id: ID de l'utilisateur
        
        Returns:
            Dict: Résultat de la retraduction
        """
        try:
            logger.info(f"🔄 [GRPC] Début retraduction message {message_id}")
            
            # 1. Invalider les traductions existantes
            invalidated = await self.database_service.invalidate_message_translations(message_id)
            if not invalidated:
                logger.warning(f"⚠️ [GRPC] Échec invalidation traductions pour {message_id}")
            
            # 2. Créer une tâche de retraduction via ZMQ
            from .zmq_server import TranslationTask
            import uuid
            import time
            
            # Langues cibles par défaut (peut être configuré)
            target_languages = ['en', 'es', 'de', 'it', 'pt', 'ru', 'ar', 'ja', 'zh']
            
            task = TranslationTask(
                task_id=str(uuid.uuid4()),
                message_id=message_id,
                text=content,
                source_language=original_language,
                target_languages=target_languages,
                conversation_id='retranslation',  # Identifiant spécial pour les retraductions
                model_type='basic',
                created_at=time.time()
            )
            
            # 3. Envoyer la tâche au serveur ZMQ
            if self.zmq_server:
                await self.zmq_server._handle_translation_request(task)
                logger.info(f"✅ [GRPC] Tâche de retraduction envoyée pour {message_id}")
                
                return {
                    'success': True,
                    'message_id': message_id,
                    'task_id': task.task_id,
                    'target_languages': target_languages,
                    'message': 'Retraduction initiée avec succès'
                }
            else:
                logger.error(f"❌ [GRPC] Serveur ZMQ non disponible pour {message_id}")
                return {
                    'success': False,
                    'message_id': message_id,
                    'error': 'Serveur de traduction non disponible'
                }
                
        except Exception as e:
            logger.error(f"❌ [GRPC] Erreur retraduction {message_id}: {e}")
            return {
                'success': False,
                'message_id': message_id,
                'error': str(e)
            }

class GrpcServer:
    """Serveur gRPC pour les services de retraduction"""
    
    def __init__(self, database_service: DatabaseService, zmq_server: ZMQTranslationServer):
        self.database_service = database_service
        self.zmq_server = zmq_server
        self.retranslation_service = MessageRetranslationService(database_service, zmq_server)
        self.server = None
    
    async def start(self, port: int = 50051):
        """Démarre le serveur gRPC"""
        try:
            # Créer le serveur gRPC
            self.server = grpc.aio.server(futures.ThreadPoolExecutor(max_workers=10))
            
            # Ajouter les services (simulation - les vrais services seraient générés depuis .proto)
            logger.info(f"🚀 [GRPC] Serveur gRPC démarré sur le port {port}")
            
            # Démarrer le serveur
            listen_addr = f'[::]:{port}'
            self.server.add_insecure_port(listen_addr)
            await self.server.start()
            
            logger.info(f"✅ [GRPC] Serveur gRPC en écoute sur {listen_addr}")
            
            # Attendre l'arrêt du serveur
            await self.server.wait_for_termination()
            
        except Exception as e:
            logger.error(f"❌ [GRPC] Erreur démarrage serveur: {e}")
            raise
    
    async def stop(self):
        """Arrête le serveur gRPC"""
        if self.server:
            logger.info("🛑 [GRPC] Arrêt du serveur gRPC...")
            await self.server.stop(grace=5.0)
            logger.info("✅ [GRPC] Serveur gRPC arrêté")

# Fonction utilitaire pour la retraduction depuis la Gateway
async def retranslate_message_async(message_id: str, content: str, original_language: str, user_id: str) -> Dict[str, Any]:
    """
    Fonction utilitaire pour retraduire un message depuis la Gateway
    
    Args:
        message_id: ID du message
        content: Nouveau contenu
        original_language: Langue originale
        user_id: ID de l'utilisateur
    
    Returns:
        Dict: Résultat de la retraduction
    """
    try:
        # Créer une instance temporaire du service
        database_service = DatabaseService()
        await database_service.initialize()
        
        retranslation_service = MessageRetranslationService(database_service, None)
        
        result = await retranslation_service.retranslate_message(
            message_id, content, original_language, user_id
        )
        
        await database_service.close()
        return result
        
    except Exception as e:
        logger.error(f"❌ [GRPC] Erreur retraduction utilitaire: {e}")
        return {
            'success': False,
            'message_id': message_id,
            'error': str(e)
        }
