"""
Serveur ZeroMQ pour le service de traduction Meeshy
Permet la communication avec le gateway via ZMQ
"""

import asyncio
import logging
import json
import zmq
import zmq.asyncio
from typing import Dict, Any, Optional
import time

logger = logging.getLogger(__name__)

class ZMQTranslationServer:
    """Serveur ZMQ pour la traduction"""
    
    def __init__(self, translation_service, port: int = 5555):
        self.translation_service = translation_service
        self.port = port
        self.context = None
        self.socket = None
        self.running = False
    
    async def start(self):
        """Démarre le serveur ZMQ"""
        logger.info(f"🔌 Démarrage serveur ZMQ sur port {self.port}")
        
        try:
            # Créer le contexte ZMQ
            self.context = zmq.asyncio.Context()
            self.socket = self.context.socket(zmq.REP)
            self.socket.bind(f"tcp://*:{self.port}")
            
            self.running = True
            logger.info(f"✅ Serveur ZMQ en écoute sur tcp://0.0.0.0:{self.port}")
            
            # Boucle principale d'écoute
            while self.running:
                try:
                    # Attendre une requête
                    message = await self.socket.recv()
                    
                    # Traiter la requête
                    response = await self.handle_request(message)
                    
                    # Envoyer la réponse
                    await self.socket.send(response)
                    
                except zmq.Again:
                    # Timeout, continuer
                    continue
                except Exception as e:
                    logger.error(f"❌ Erreur traitement requête ZMQ: {e}")
                    # Envoyer une réponse d'erreur
                    error_response = json.dumps({
                        "messageId": "error",
                        "translatedText": "Error occurred",
                        "detectedSourceLanguage": "unknown",
                        "status": 0,
                        "metadata": {
                            "error": str(e),
                            "confidenceScore": 0.0,
                            "fromCache": False,
                            "modelUsed": "error"
                        }
                    }).encode('utf-8')
                    
                    try:
                        await self.socket.send(error_response)
                    except:
                        pass
                        
        except Exception as e:
            logger.error(f"❌ Erreur serveur ZMQ: {e}")
        finally:
            await self.stop()
    
    async def handle_request(self, message: bytes) -> bytes:
        """Traite une requête de traduction"""
        try:
            # Décoder le message JSON
            request_text = message.decode('utf-8')
            request_data = json.loads(request_text)
            
            logger.info(f"📥 ZMQ Requête reçue: {request_data}")
            
            # Extraire les données de la requête
            text = request_data.get('text', '')
            source_language = request_data.get('sourceLanguage', 'auto')
            target_language = request_data.get('targetLanguage', 'en')
            message_id = request_data.get('messageId', f'zmq_{int(time.time())}')
            model_type = request_data.get('modelType', 'basic')
            
            if not text or not target_language:
                raise ValueError("Text and target language are required")
            
            # Appeler le service de traduction
            start_time = time.time()
            
            translation_result = await self.translation_service.translate(
                text=text,
                source_language=source_language,
                target_language=target_language,
                model_type=model_type
            )
            
            processing_time = time.time() - start_time
            
            # Formater la réponse selon le protocole ZMQ
            response_data = {
                "messageId": message_id,
                "translatedText": translation_result.get('translated_text', text),
                "detectedSourceLanguage": translation_result.get('detected_language', source_language),
                "status": 1,  # SUCCESS
                "metadata": {
                    "confidenceScore": translation_result.get('confidence', 0.9),
                    "fromCache": translation_result.get('from_cache', False),
                    "modelUsed": translation_result.get('model_used', model_type),
                    "processingTimeMs": int(processing_time * 1000)
                }
            }
            
            logger.info(f"📤 ZMQ Réponse: {response_data['translatedText']}")
            
            return json.dumps(response_data).encode('utf-8')
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Erreur JSON dans requête ZMQ: {e}")
            return self._create_error_response("Invalid JSON format")
            
        except Exception as e:
            logger.error(f"❌ Erreur traitement ZMQ: {e}")
            return self._create_error_response(str(e))
    
    def _create_error_response(self, error_message: str) -> bytes:
        """Crée une réponse d'erreur"""
        error_response = {
            "messageId": "error",
            "translatedText": "Translation failed",
            "detectedSourceLanguage": "unknown",
            "status": 0,  # FAILURE
            "metadata": {
                "error": error_message,
                "confidenceScore": 0.0,
                "fromCache": False,
                "modelUsed": "error"
            }
        }
        
        return json.dumps(error_response).encode('utf-8')
    
    async def stop(self):
        """Arrête le serveur ZMQ"""
        logger.info("🛑 Arrêt du serveur ZMQ...")
        
        self.running = False
        
        if self.socket:
            self.socket.close()
        
        if self.context:
            self.context.term()
        
        logger.info("✅ Serveur ZMQ arrêté")
    
    async def health_check(self) -> bool:
        """Vérifie si le serveur ZMQ fonctionne"""
        return self.running and self.socket is not None
