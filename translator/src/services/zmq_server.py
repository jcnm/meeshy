"""
Serveur ZeroMQ haute performance pour le service de traduction Meeshy
Architecture: PUB/SUB + REQ/REP avec pool de connexions et traitement asynchrone
"""

import asyncio
import logging
import json
import zmq
import zmq.asyncio
from typing import Dict, Any, Optional, List
import time
import uuid
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import threading

logger = logging.getLogger(__name__)

@dataclass
class TranslationTask:
    """Tâche de traduction"""
    task_id: str
    message_id: str
    text: str
    source_language: str
    target_language: str
    model_type: str
    conversation_id: Optional[str] = None
    participant_ids: Optional[List[str]] = None
    request_type: str = 'direct_translation'
    created_at: float = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = time.time()

class ZMQTranslationServer:
    """Serveur ZMQ haute performance pour la traduction"""
    
    def __init__(self, translation_service, port: int = 5555, max_workers: int = 10):
        self.translation_service = translation_service
        self.port = port
        self.max_workers = max_workers
        
        # Contexte ZMQ
        self.context = None
        
        # Socket REQ/REP pour les requêtes
        self.rep_socket = None
        
        # Socket PUB pour les notifications
        self.pub_socket = None
        self.pub_port = port + 1
        
        # État du serveur
        self.running = False
        self.task_queue = asyncio.Queue()
        self.active_tasks: Dict[str, TranslationTask] = {}
        self.task_results: Dict[str, Dict] = {}
        
        # Pool de workers
        self.worker_pool = ThreadPoolExecutor(max_workers=max_workers)
        self.worker_lock = threading.Lock()
        
        # Statistiques
        self.stats = {
            'requests_received': 0,
            'translations_completed': 0,
            'errors': 0,
            'avg_processing_time': 0.0
        }
    
    async def start(self):
        """Démarre le serveur ZMQ haute performance"""
        logger.info(f"🚀 Démarrage serveur ZMQ haute performance sur port {self.port}")
        
        try:
            # Créer le contexte ZMQ
            self.context = zmq.asyncio.Context()
            
            # Socket REP pour les requêtes (avec LINGER pour éviter les blocages)
            self.rep_socket = self.context.socket(zmq.REP)
            self.rep_socket.setsockopt(zmq.LINGER, 1000)  # 1 seconde de linger
            self.rep_socket.bind(f"tcp://*:{self.port}")
            
            # Socket PUB pour les notifications
            self.pub_socket = self.context.socket(zmq.PUB)
            self.pub_socket.setsockopt(zmq.LINGER, 1000)
            self.pub_socket.bind(f"tcp://*:{self.pub_port}")
            
            self.running = True
            logger.info(f"✅ Serveur ZMQ en écoute:")
            logger.info(f"   📥 REQ/REP: tcp://0.0.0.0:{self.port}")
            logger.info(f"   📤 PUB: tcp://0.0.0.0:{self.pub_port}")
            logger.info(f"   👥 Workers: {self.max_workers}")
            
            # Démarrer les workers asynchrones
            worker_tasks = [
                asyncio.create_task(self._worker_loop())
                for _ in range(self.max_workers)
            ]
            
            # Boucle principale d'écoute des requêtes
            while self.running:
                try:
                    # Attendre une requête avec timeout
                    try:
                        message = await asyncio.wait_for(
                            self.rep_socket.recv(),
                            timeout=1.0  # Timeout de 1 seconde
                        )
                        
                        # Traiter la requête de manière asynchrone
                        await self._handle_request(message)
                        
                    except asyncio.TimeoutError:
                        # Timeout normal, continuer
                        continue
                        
                except zmq.Again:
                    # Timeout ZMQ, continuer
                    continue
                except Exception as e:
                    logger.error(f"❌ Erreur boucle principale ZMQ: {e}")
                    await asyncio.sleep(0.1)  # Pause courte en cas d'erreur
            
            # Attendre la fin des workers
            await asyncio.gather(*worker_tasks, return_exceptions=True)
                        
        except Exception as e:
            logger.error(f"❌ Erreur serveur ZMQ: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await self.stop()
    
    async def _handle_request(self, message: bytes):
        """Traite une requête de traduction de manière asynchrone"""
        try:
            # Décoder le message JSON
            request_text = message.decode('utf-8')
            request_data = json.loads(request_text)
            
            self.stats['requests_received'] += 1
            logger.info(f"📥 ZMQ Requête reçue #{self.stats['requests_received']}: {request_data.get('text', '')[:50]}...")
            
            # Extraire les données de la requête
            text = request_data.get('text', '')
            source_language = request_data.get('sourceLanguage', 'auto')
            target_language = request_data.get('targetLanguage', 'en')
            message_id = request_data.get('messageId', str(uuid.uuid4()))
            model_type = request_data.get('modelType', 'basic')
            conversation_id = request_data.get('conversationId')
            participant_ids = request_data.get('participantIds')
            request_type = request_data.get('requestType', 'direct_translation')
            
            if not text or not target_language:
                # Réponse immédiate pour erreur de validation
                error_response = self._create_error_response("Text and target language are required")
                await self.rep_socket.send(error_response)
                return
            
            # Créer une tâche de traduction
            task_id = str(uuid.uuid4())
            task = TranslationTask(
                task_id=task_id,
                message_id=message_id,
                text=text,
                source_language=source_language,
                target_language=target_language,
                model_type=model_type,
                conversation_id=conversation_id,
                participant_ids=participant_ids,
                request_type=request_type
            )
            
            # Ajouter à la file d'attente
            await self.task_queue.put(task)
            self.active_tasks[task_id] = task
            
            # Réponse immédiate avec task_id
            response_data = {
                "taskId": task_id,
                "messageId": message_id,
                "status": "queued",
                "estimatedProcessingTime": self._estimate_processing_time(text, model_type)
            }
            
            await self.rep_socket.send(json.dumps(response_data).encode('utf-8'))
            
            logger.info(f"✅ Tâche {task_id} ajoutée à la file d'attente")
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Erreur JSON dans requête ZMQ: {e}")
            error_response = self._create_error_response("Invalid JSON format")
            await self.rep_socket.send(error_response)
            
        except Exception as e:
            logger.error(f"❌ Erreur traitement requête ZMQ: {e}")
            error_response = self._create_error_response(str(e))
            await self.rep_socket.send(error_response)
    
    async def _worker_loop(self):
        """Boucle de travail pour les workers"""
        worker_id = id(asyncio.current_task())
        logger.info(f"👷 Worker {worker_id} démarré")
        
        while self.running:
            try:
                # Récupérer une tâche de la file d'attente
                task = await asyncio.wait_for(
                    self.task_queue.get(),
                    timeout=1.0
                )
                
                logger.info(f"👷 Worker {worker_id} traite tâche {task.task_id}")
                
                # Traiter la traduction
                result = await self._process_translation(task)
                
                # Stocker le résultat
                self.task_results[task.task_id] = result
                
                # Publier la notification
                await self._publish_translation_result(task.task_id, result)
                
                # Nettoyer
                if task.task_id in self.active_tasks:
                    del self.active_tasks[task.task_id]
                
                self.stats['translations_completed'] += 1
                
                logger.info(f"✅ Worker {worker_id} terminé tâche {task.task_id}")
                
            except asyncio.TimeoutError:
                # Timeout normal, continuer
                continue
            except Exception as e:
                logger.error(f"❌ Erreur worker {worker_id}: {e}")
                self.stats['errors'] += 1
                await asyncio.sleep(0.1)
    
    async def _process_translation(self, task: TranslationTask) -> Dict:
        """Traite une traduction"""
        start_time = time.time()
        
        try:
            # Appeler le service de traduction
            translation_result = await self.translation_service.translate(
                text=task.text,
                source_language=task.source_language,
                target_language=task.target_language,
                model_type=task.model_type
            )
            
            processing_time = time.time() - start_time
            
            # Mettre à jour les statistiques
            self._update_avg_processing_time(processing_time)
            
            # Formater la réponse
            result = {
                "taskId": task.task_id,
                "messageId": task.message_id,
                "translatedText": translation_result.get('translated_text', task.text),
                "detectedSourceLanguage": translation_result.get('detected_language', task.source_language),
                "status": 1,  # SUCCESS
                "metadata": {
                    "confidenceScore": translation_result.get('confidence', 0.9),
                    "fromCache": translation_result.get('from_cache', False),
                    "modelUsed": translation_result.get('model_used', task.model_type),
                    "processingTimeMs": int(processing_time * 1000),
                    "workerId": id(asyncio.current_task())
                }
            }
            
            logger.info(f"📤 Traduction terminée {task.task_id}: {result['translatedText'][:50]}...")
            return result
            
        except Exception as e:
            processing_time = time.time() - start_time
            logger.error(f"❌ Erreur traduction {task.task_id}: {e}")
            
            return {
                "taskId": task.task_id,
                "messageId": task.message_id,
                "translatedText": f"[ERREUR] {task.text}",
                "detectedSourceLanguage": task.source_language,
                "status": 0,  # FAILURE
                "metadata": {
                    "error": str(e),
                    "confidenceScore": 0.0,
                    "fromCache": False,
                    "modelUsed": "error",
                    "processingTimeMs": int(processing_time * 1000)
                }
            }
    
    async def _publish_translation_result(self, task_id: str, result: Dict):
        """Publie le résultat de traduction via PUB socket"""
        try:
            notification = {
                "type": "translation_completed",
                "taskId": task_id,
                "result": result,
                "timestamp": time.time()
            }
            
            message = json.dumps(notification).encode('utf-8')
            await self.pub_socket.send(message)
            
            logger.info(f"📤 Notification publiée pour tâche {task_id}")
            
        except Exception as e:
            logger.error(f"❌ Erreur publication notification {task_id}: {e}")
    
    def _estimate_processing_time(self, text: str, model_type: str) -> int:
        """Estime le temps de traitement en millisecondes"""
        base_time = len(text) * 2  # 2ms par caractère de base
        
        if model_type == 'basic':
            return min(base_time, 1000)  # Max 1 seconde
        elif model_type == 'medium':
            return min(base_time * 2, 2000)  # Max 2 secondes
        else:  # premium
            return min(base_time * 3, 5000)  # Max 5 secondes
    
    def _update_avg_processing_time(self, new_time: float):
        """Met à jour le temps de traitement moyen"""
        completed = self.stats['translations_completed']
        if completed > 0:
            self.stats['avg_processing_time'] = (
                (self.stats['avg_processing_time'] * (completed - 1) + new_time) / completed
            )
        else:
            self.stats['avg_processing_time'] = new_time
    
    def _create_error_response(self, error_message: str) -> bytes:
        """Crée une réponse d'erreur"""
        error_response = {
            "taskId": "error",
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
    
    async def get_task_result(self, task_id: str) -> Optional[Dict]:
        """Récupère le résultat d'une tâche"""
        return self.task_results.get(task_id)
    
    async def get_stats(self) -> Dict:
        """Récupère les statistiques du serveur"""
        return {
            **self.stats,
            "queue_size": self.task_queue.qsize(),
            "active_tasks": len(self.active_tasks),
            "cached_results": len(self.task_results)
        }
    
    async def stop(self):
        """Arrête le serveur ZMQ"""
        logger.info("🛑 Arrêt du serveur ZMQ haute performance...")
        
        self.running = False
        
        # Fermer les sockets
        if self.rep_socket:
            self.rep_socket.close()
        
        if self.pub_socket:
            self.pub_socket.close()
        
        # Fermer le contexte
        if self.context:
            self.context.term()
        
        # Fermer le pool de workers
        self.worker_pool.shutdown(wait=True)
        
        logger.info("✅ Serveur ZMQ haute performance arrêté")
    
    @property
    def is_running(self) -> bool:
        """Vérifie si le serveur ZMQ est en cours d'exécution"""
        return self.running and self.rep_socket is not None
    
    async def health_check(self) -> bool:
        """Vérifie si le serveur ZMQ fonctionne"""
        return self.is_running
