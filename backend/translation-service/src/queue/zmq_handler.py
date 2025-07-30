"""
Gestionnaire ZeroMQ pour la communication asynchrone
Traite les requêtes de traduction via ZeroMQ selon l'architecture Meeshy
"""

import asyncio
import logging
import json
import time
from typing import Dict, Any, Optional

try:
    import zmq
    import zmq.asyncio
    ZMQ_AVAILABLE = True
except ImportError:
    ZMQ_AVAILABLE = False

from services.translation_service import TranslationService
from services.message_service import MessageService

logger = logging.getLogger(__name__)

class ZMQTranslationHandler:
    """Gestionnaire ZeroMQ pour les requêtes de traduction"""
    
    def __init__(self, translation_service: TranslationService, message_service: MessageService):
        self.translation_service = translation_service
        self.message_service = message_service
        self.context: Optional[zmq.asyncio.Context] = None
        self.socket: Optional[zmq.asyncio.Socket] = None
        self.is_running = False
        
        # Statistiques
        self.stats = {
            'messages_processed': 0,
            'errors': 0,
            'translations_performed': 0
        }
    
    async def start(self, port: int = 5555):
        """Démarre le gestionnaire ZeroMQ"""
        
        if not ZMQ_AVAILABLE:
            logger.error("❌ ZeroMQ non disponible")
            return
        
        try:
            # Initialiser le contexte ZeroMQ
            self.context = zmq.asyncio.Context()
            self.socket = self.context.socket(zmq.REP)  # Socket Reply
            self.socket.bind(f"tcp://*:{port}")
            
            self.is_running = True
            logger.info(f"⚡ Handler ZeroMQ démarré sur le port {port}")
            
            # Boucle de traitement des messages
            while self.is_running:
                try:
                    # Recevoir le message
                    message_bytes = await self.socket.recv()
                    message_data = json.loads(message_bytes.decode('utf-8'))
                    
                    # Traiter le message
                    response = await self._process_message(message_data)
                    
                    # Envoyer la réponse
                    response_bytes = json.dumps(response).encode('utf-8')
                    await self.socket.send(response_bytes)
                    
                    self.stats['messages_processed'] += 1
                    
                except asyncio.CancelledError:
                    logger.info("🛑 Handler ZeroMQ interrompu")
                    break
                except Exception as e:
                    logger.error(f"❌ Erreur traitement ZeroMQ: {e}")
                    self.stats['errors'] += 1
                    
                    # Envoyer une réponse d'erreur
                    error_response = {
                        'success': False,
                        'error': str(e),
                        'timestamp': time.time()
                    }
                    try:
                        error_bytes = json.dumps(error_response).encode('utf-8')
                        await self.socket.send(error_bytes)
                    except:
                        pass  # Si on ne peut pas envoyer l'erreur, continuer
                    
        except Exception as e:
            logger.error(f"❌ Erreur démarrage ZeroMQ: {e}")
            self.is_running = False
    
    async def _process_message(self, message_data: Dict[str, Any]) -> Dict[str, Any]:
        """Traite un message ZeroMQ selon son type"""
        
        message_type = message_data.get('type', 'unknown')
        
        try:
            if message_type == 'translate_text':
                return await self._handle_translate_text(message_data)
            elif message_type == 'translate_message':
                return await self._handle_translate_message(message_data)
            elif message_type == 'detect_language':
                return await self._handle_detect_language(message_data)
            elif message_type == 'batch_translate':
                return await self._handle_batch_translate(message_data)
            elif message_type == 'health_check':
                return await self._handle_health_check(message_data)
            else:
                return {
                    'success': False,
                    'error': f'Unknown message type: {message_type}',
                    'timestamp': time.time()
                }
                
        except Exception as e:
            logger.error(f"❌ Erreur traitement message {message_type}: {e}")
            return {
                'success': False,
                'error': str(e),
                'message_type': message_type,
                'timestamp': time.time()
            }
    
    async def _handle_translate_text(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Traite une requête de traduction simple"""
        
        required_fields = ['text', 'target_language']
        for field in required_fields:
            if field not in data:
                return {
                    'success': False,
                    'error': f'Missing required field: {field}',
                    'timestamp': time.time()
                }
        
        # Effectuer la traduction
        result = await self.translation_service.translate_text(
            text=data['text'],
            source_lang=data.get('source_language', ''),
            target_lang=data['target_language'],
            model_tier=data.get('model_tier', 'basic')
        )
        
        if result['success']:
            self.stats['translations_performed'] += 1
        
        # Ajouter des métadonnées
        result['timestamp'] = time.time()
        result['message_id'] = data.get('message_id', '')
        
        return result
    
    async def _handle_translate_message(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Traite une requête de traduction avec création de message en DB"""
        
        required_fields = ['content', 'sender_id', 'conversation_id', 'source_language', 'target_languages']
        for field in required_fields:
            if field not in data:
                return {
                    'success': False,
                    'error': f'Missing required field: {field}',
                    'timestamp': time.time()
                }
        
        # Créer le message avec traductions
        result = await self.message_service.create_message_with_translations(
            content=data['content'],
            sender_id=data['sender_id'],
            conversation_id=data['conversation_id'],
            source_language=data['source_language'],
            target_languages=data['target_languages'],
            message_type=data.get('message_type', 'text'),
            model_tier=data.get('model_tier', 'basic')
        )
        
        if result['success']:
            self.stats['translations_performed'] += len(result.get('translations', {}))
        
        result['timestamp'] = time.time()
        return result
    
    async def _handle_detect_language(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Traite une requête de détection de langue"""
        
        if 'text' not in data:
            return {
                'success': False,
                'error': 'Missing required field: text',
                'timestamp': time.time()
            }
        
        result = await self.translation_service.detect_language(data['text'])
        result['success'] = True
        result['timestamp'] = time.time()
        
        return result
    
    async def _handle_batch_translate(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Traite une requête de traduction batch"""
        
        required_fields = ['text', 'source_language', 'target_languages']
        for field in required_fields:
            if field not in data:
                return {
                    'success': False,
                    'error': f'Missing required field: {field}',
                    'timestamp': time.time()
                }
        
        result = await self.translation_service.translate_to_multiple_languages(
            text=data['text'],
            source_lang=data['source_language'],
            target_languages=data['target_languages'],
            model_tier=data.get('model_tier', 'basic')
        )
        
        if result['success']:
            self.stats['translations_performed'] += result.get('successful_translations', 0)
        
        result['timestamp'] = time.time()
        return result
    
    async def _handle_health_check(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Traite une requête de vérification de santé"""
        
        return {
            'success': True,
            'status': 'healthy',
            'services': {
                'translation': 'initialized' if self.translation_service.is_initialized else 'not_initialized',
                'messages': 'initialized' if self.message_service.is_initialized else 'not_initialized'
            },
            'stats': self.stats,
            'timestamp': time.time()
        }
    
    async def stop(self):
        """Arrête le gestionnaire ZeroMQ"""
        
        self.is_running = False
        
        if self.socket:
            self.socket.close()
            
        if self.context:
            self.context.term()
            
        logger.info("✅ Handler ZeroMQ arrêté")

async def start_zmq_handler(
    translation_service: TranslationService,
    message_service: MessageService,
    port: int = 5555
):
    """Démarre le gestionnaire ZeroMQ"""
    
    handler = ZMQTranslationHandler(translation_service, message_service)
    
    try:
        await handler.start(port)
    except asyncio.CancelledError:
        await handler.stop()
    except Exception as e:
        logger.error(f"❌ Erreur handler ZeroMQ: {e}")
        await handler.stop()
        raise
