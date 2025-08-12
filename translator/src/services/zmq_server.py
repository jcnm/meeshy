"""
Serveur ZeroMQ haute performance pour le service de traduction Meeshy
Architecture: PUB/SUB + REQ/REP avec pool de connexions et traitement asynchrone
"""

import asyncio
import json
import logging
import uuid
import zmq
import zmq.asyncio
from dataclasses import dataclass
from typing import Dict, List, Optional, Set
from concurrent.futures import ThreadPoolExecutor
import time
import psutil
from collections import defaultdict

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class TranslationTask:
    """Tâche de traduction avec support multi-langues"""
    task_id: str
    message_id: str
    text: str
    source_language: str
    target_languages: List[str]
    conversation_id: str
    model_type: str = "basic"
    created_at: float = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = time.time()

class TranslationPoolManager:
    """Gestionnaire des pools FIFO de traduction"""
    
    def __init__(self, 
                 normal_pool_size: int = 10000,
                 any_pool_size: int = 10000,
                 normal_workers: int = 3,
                 any_workers: int = 2,
                 translation_service=None):
        
        # Pools FIFO séparées
        self.normal_pool = asyncio.Queue(maxsize=normal_pool_size)
        self.any_pool = asyncio.Queue(maxsize=any_pool_size)
        
        # Configuration des workers
        self.normal_workers = normal_workers
        self.any_workers = any_workers
        
        # Thread pools pour les traductions
        self.normal_worker_pool = ThreadPoolExecutor(max_workers=normal_workers)
        self.any_worker_pool = ThreadPoolExecutor(max_workers=any_workers)
        
        # Service de traduction partagé
        self.translation_service = translation_service
        
        # Statistiques
        self.stats = {
            'normal_pool_size': 0,
            'any_pool_size': 0,
            'normal_workers_active': 0,
            'any_workers_active': 0,
            'tasks_processed': 0,
            'tasks_failed': 0,
            'translations_completed': 0,
            'pool_full_rejections': 0
        }
        
        # Workers actifs
        self.normal_workers_running = False
        self.any_workers_running = False
        
        logger.info(f"TranslationPoolManager initialisé: normal_pool({normal_pool_size}), any_pool({any_pool_size}), normal_workers({normal_workers}), any_workers({any_workers})")
    
    async def enqueue_task(self, task: TranslationTask) -> bool:
        """Enfile une tâche dans la pool appropriée"""
        try:
            if task.conversation_id == "any":
                # Pool spéciale pour conversation "any"
                if self.any_pool.full():
                    logger.warning(f"Pool 'any' pleine, rejet de la tâche {task.task_id}")
                    self.stats['pool_full_rejections'] += 1
                    return False
                
                await self.any_pool.put(task)
                self.stats['any_pool_size'] = self.any_pool.qsize()
                logger.info(f"Tâche {task.task_id} enfilée dans pool 'any' (taille: {self.stats['any_pool_size']})")
            else:
                # Pool normale pour autres conversations
                if self.normal_pool.full():
                    logger.warning(f"Pool normale pleine, rejet de la tâche {task.task_id}")
                    self.stats['pool_full_rejections'] += 1
                    return False
                
                await self.normal_pool.put(task)
                self.stats['normal_pool_size'] = self.normal_pool.qsize()
                logger.info(f"Tâche {task.task_id} enfilée dans pool normale (taille: {self.stats['normal_pool_size']})")
            
            return True
            
        except Exception as e:
            logger.error(f"Erreur lors de l'enfilage de la tâche {task.task_id}: {e}")
            return False
    
    async def start_workers(self):
        """Démarre tous les workers"""
        self.normal_workers_running = True
        self.any_workers_running = True
        
        # Démarrer les workers pour la pool normale
        normal_worker_tasks = [
            asyncio.create_task(self._normal_worker_loop(f"normal_worker_{i}"))
            for i in range(self.normal_workers)
        ]
        
        # Démarrer les workers pour la pool "any"
        any_worker_tasks = [
            asyncio.create_task(self._any_worker_loop(f"any_worker_{i}"))
            for i in range(self.any_workers)
        ]
        
        logger.info(f"Workers démarrés: {self.normal_workers} normal, {self.any_workers} any")
        return normal_worker_tasks + any_worker_tasks
    
    async def stop_workers(self):
        """Arrête tous les workers"""
        self.normal_workers_running = False
        self.any_workers_running = False
        logger.info("Arrêt des workers demandé")
    
    async def _normal_worker_loop(self, worker_name: str):
        """Boucle de travail pour les workers de la pool normale"""
        logger.info(f"Worker {worker_name} démarré")
        
        while self.normal_workers_running:
            try:
                # Attendre une tâche avec timeout
                try:
                    task = await asyncio.wait_for(self.normal_pool.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                
                self.stats['normal_workers_active'] += 1
                self.stats['normal_pool_size'] = self.normal_pool.qsize()
                
                logger.info(f"Worker {worker_name} traite la tâche {task.task_id} ({len(task.target_languages)} langues)")
                
                # Traiter la tâche
                await self._process_translation_task(task, worker_name)
                
                self.stats['normal_workers_active'] -= 1
                self.stats['tasks_processed'] += 1
                
            except Exception as e:
                logger.error(f"Erreur dans le worker {worker_name}: {e}")
                self.stats['tasks_failed'] += 1
        
        logger.info(f"Worker {worker_name} arrêté")
    
    async def _any_worker_loop(self, worker_name: str):
        """Boucle de travail pour les workers de la pool 'any'"""
        logger.info(f"Worker {worker_name} démarré")
        
        while self.any_workers_running:
            try:
                # Attendre une tâche avec timeout
                try:
                    task = await asyncio.wait_for(self.any_pool.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                
                self.stats['any_workers_active'] += 1
                self.stats['any_pool_size'] = self.any_pool.qsize()
                
                logger.info(f"Worker {worker_name} traite la tâche {task.task_id} ({len(task.target_languages)} langues)")
                
                # Traiter la tâche
                await self._process_translation_task(task, worker_name)
                
                self.stats['any_workers_active'] -= 1
                self.stats['tasks_processed'] += 1
                
            except Exception as e:
                logger.error(f"Erreur dans le worker {worker_name}: {e}")
                self.stats['tasks_failed'] += 1
        
        logger.info(f"Worker {worker_name} arrêté")
    
    async def _process_translation_task(self, task: TranslationTask, worker_name: str):
        """Traite une tâche de traduction avec traduction parallèle"""
        try:
            # Lancer les traductions en parallèle
            translation_tasks = []
            
            for target_language in task.target_languages:
                translation_task = asyncio.create_task(
                    self._translate_single_language(task, target_language, worker_name)
                )
                translation_tasks.append((target_language, translation_task))
            
            # Attendre toutes les traductions
            for target_language, translation_task in translation_tasks:
                try:
                    result = await translation_task
                    # Publier le résultat via PUB
                    await self._publish_translation_result(task.task_id, result, target_language)
                    self.stats['translations_completed'] += 1
                    
                except Exception as e:
                    logger.error(f"Erreur de traduction pour {target_language} dans {task.task_id}: {e}")
                    # Publier un résultat d'erreur
                    error_result = self._create_error_result(task, target_language, str(e))
                    await self._publish_translation_result(task.task_id, error_result, target_language)
            
        except Exception as e:
            logger.error(f"Erreur lors du traitement de la tâche {task.task_id}: {e}")
            self.stats['tasks_failed'] += 1
    
    async def _translate_single_language(self, task: TranslationTask, target_language: str, worker_name: str):
        """Traduit un texte vers une langue cible spécifique"""
        start_time = time.time()
        
        logger.info(f"🔄 [TRANSLATOR] Début traduction: worker={worker_name}, texte='{task.text[:30]}...', source={task.source_language}, target={target_language}")
        
        try:
            # Utiliser le service de traduction partagé
            if self.translation_service:
                # Effectuer la vraie traduction avec le service ML unifié
                result = await self.translation_service.translate(
                    text=task.text,
                    source_language=task.source_language,
                    target_language=target_language,
                    model_type=task.model_type,
                    source_channel='zmq'  # Identifier le canal source
                )
                
                processing_time = time.time() - start_time
                
                logger.info(f"✅ [TRANSLATOR] Traduction terminée: worker={worker_name}, '{task.text[:30]}...' → '{result['translated_text'][:30]}...' ({processing_time:.3f}s)")
                
                return {
                    'messageId': task.message_id,
                    'translatedText': result['translated_text'],
                    'sourceLanguage': result['detected_language'],
                    'targetLanguage': target_language,
                    'confidenceScore': result.get('confidence', 0.95),
                    'processingTime': processing_time,
                    'modelType': task.model_type,
                    'workerName': worker_name
                }
            else:
                # Fallback si pas de service de traduction
                translated_text = f"[{target_language.upper()}] {task.text}"
                processing_time = time.time() - start_time
                
                return {
                    'messageId': task.message_id,
                    'translatedText': translated_text,
                    'sourceLanguage': task.source_language,
                    'targetLanguage': target_language,
                    'confidenceScore': 0.1,
                    'processingTime': processing_time,
                    'modelType': 'fallback',
                    'workerName': worker_name,
                    'error': 'No translation service available'
                }
            
        except Exception as e:
            logger.error(f"Erreur de traduction dans {worker_name}: {e}")
            # Fallback en cas d'erreur
            translated_text = f"[{target_language.upper()}] {task.text}"
            processing_time = time.time() - start_time
            
            return {
                'messageId': task.message_id,
                'translatedText': translated_text,
                'sourceLanguage': task.source_language,
                'targetLanguage': target_language,
                'confidenceScore': 0.1,
                'processingTime': processing_time,
                'modelType': 'fallback',
                'workerName': worker_name,
                'error': str(e)
            }
    
    def _create_error_result(self, task: TranslationTask, target_language: str, error_message: str):
        """Crée un résultat d'erreur pour une traduction échouée"""
        return {
            'messageId': task.message_id,
            'translatedText': f"[ERREUR: {error_message}]",
            'sourceLanguage': task.source_language,
            'targetLanguage': target_language,
            'confidenceScore': 0.0,
            'processingTime': 0.0,
            'modelType': task.model_type,
            'error': error_message
        }
    
    async def _publish_translation_result(self, task_id: str, result: dict, target_language: str):
        """Publie un résultat de traduction via PUB"""
        try:
            # Cette méthode sera appelée par le serveur ZMQ principal
            # Le résultat sera publié via le socket PUB
            # Note: Cette méthode sera remplacée par le serveur ZMQ principal
            pass
        except Exception as e:
            logger.error(f"Erreur lors de la publication du résultat {task_id}: {e}")
    
    def get_stats(self) -> dict:
        """Retourne les statistiques actuelles"""
        return {
            **self.stats,
            'memory_usage_mb': psutil.Process().memory_info().rss / 1024 / 1024,
            'uptime_seconds': time.time() - getattr(self, '_start_time', time.time())
        }

class ZMQTranslationServer:
    """Serveur ZMQ pour la traduction avec architecture PUB/SUB"""
    
    def __init__(self, 
                 host: str = "localhost",
                 gateway_pub_port: int = 5557,  # Port PUB du Gateway (requêtes) - Translator SUB se connecte ici
                 gateway_sub_port: int = 5555,  # Port SUB du Gateway (résultats) - Translator PUB se connecte ici
                 normal_pool_size: int = 10000,
                 any_pool_size: int = 10000,
                 normal_workers: int = 3,
                 any_workers: int = 2,
                 translation_service=None):
        
        self.host = host
        self.gateway_pub_port = gateway_pub_port  # Port PUB du Gateway - Translator SUB se connecte
        self.gateway_sub_port = gateway_sub_port  # Port SUB du Gateway - Translator PUB se connecte
        self.context = zmq.asyncio.Context()
        
        # Sockets
        self.sub_socket = None  # Pour recevoir les requêtes de traduction
        self.pub_socket = None  # Pour publier les résultats
        
        # Pool manager
        self.pool_manager = TranslationPoolManager(
            normal_pool_size=normal_pool_size,
            any_pool_size=any_pool_size,
            normal_workers=normal_workers,
            any_workers=any_workers,
            translation_service=translation_service
        )
        
        # Remplacer la méthode de publication du pool manager
        self.pool_manager._publish_translation_result = self._publish_translation_result
        
        # État du serveur
        self.running = False
        self.worker_tasks = []
        
        logger.info(f"ZMQTranslationServer initialisé: Gateway PUB {host}:{gateway_pub_port} (SUB connecte), Gateway SUB {host}:{gateway_sub_port} (PUB connecte)")

    async def initialize(self):
        """Initialise les sockets ZMQ"""
        try:
            # Socket SUB pour recevoir les requêtes du Gateway (se lie au port 5557)
            self.sub_socket = self.context.socket(zmq.SUB)
            self.sub_socket.bind(f"tcp://{self.host}:{self.gateway_pub_port}")
            self.sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")  # S'abonner à tous les messages
            
            # Socket PUB pour publier les résultats vers le Gateway (se lie au port 5555)
            self.pub_socket = self.context.socket(zmq.PUB)
            self.pub_socket.bind(f"tcp://{self.host}:{self.gateway_sub_port}")
            
            # Petit délai pour établir les connexions ZMQ
            await asyncio.sleep(0.1)
            
            # Démarrer les workers
            self.worker_tasks = await self.pool_manager.start_workers()
            
            logger.info("ZMQTranslationServer initialisé avec succès")
            logger.info(f"🔌 Socket SUB lié au port: {self.host}:{self.gateway_pub_port}")
            logger.info(f"🔌 Socket PUB lié au port: {self.host}:{self.gateway_sub_port}")
            
        except Exception as e:
            logger.error(f"Erreur lors de l'initialisation: {e}")
            raise
    
    async def start(self):
        """Démarre le serveur"""
        if not self.sub_socket or not self.pub_socket:
            await self.initialize()
        
        self.running = True
        logger.info("ZMQTranslationServer démarré")
        logger.info(f"🔧 État du serveur: running={self.running}")
        logger.info(f"🔧 Socket SUB connecté: {self.sub_socket is not None}")
        logger.info(f"🔧 Socket PUB lié: {self.pub_socket is not None}")
        
        try:
            while self.running:
                try:
                    logger.info("🎧 En attente de messages ZMQ...")
                    # Recevoir une requête de traduction
                    message = await self.sub_socket.recv()
                    await self._handle_translation_request(message)
                    
                except zmq.ZMQError as e:
                    if self.running:
                        logger.error(f"Erreur ZMQ: {e}")
                    break
                except Exception as e:
                    logger.error(f"Erreur inattendue: {e}")
                    import traceback
                    traceback.print_exc()
                    
        except KeyboardInterrupt:
            logger.info("Arrêt demandé par l'utilisateur")
        finally:
            await self.stop()
    
    async def _handle_translation_request(self, message: bytes):
        """Traite une requête de traduction reçue via SUB"""
        try:
            request_data = json.loads(message.decode('utf-8'))
            
            logger.info(f"📥 [TRANSLATOR] Requête ZMQ reçue: {request_data}")
            
            # Créer la tâche de traduction
            task = TranslationTask(
                task_id=str(uuid.uuid4()),
                message_id=request_data.get('messageId'),
                text=request_data.get('text'),
                source_language=request_data.get('sourceLanguage', 'fr'),
                target_languages=request_data.get('targetLanguages', []),
                conversation_id=request_data.get('conversationId', 'unknown'),
                model_type=request_data.get('modelType', 'basic')
            )
            
            logger.info(f"🔧 [TRANSLATOR] Tâche créée: {task.task_id} pour {task.conversation_id} ({len(task.target_languages)} langues)")
            logger.info(f"📝 [TRANSLATOR] Détails: texte='{task.text[:50]}...', source={task.source_language}, target={task.target_languages}, modèle={task.model_type}")
            
            # Enfiler la tâche dans la pool appropriée
            success = await self.pool_manager.enqueue_task(task)
            
            if not success:
                # Pool pleine, publier un message d'erreur vers la gateway
                error_message = {
                    'type': 'translation_error',
                    'taskId': task.task_id,
                    'messageId': task.message_id,
                    'error': 'translation pool full',
                    'conversationId': task.conversation_id
                }
                # Utiliser le socket PUB configuré pour envoyer l'erreur à la gateway
                if self.pub_socket:
                    await self.pub_socket.send(json.dumps(error_message).encode('utf-8'))
                    logger.warning(f"Pool pleine, rejet de la tâche {task.task_id}")
                else:
                    logger.error("❌ Socket PUB non initialisé pour envoyer l'erreur")
            
        except json.JSONDecodeError as e:
            logger.error(f"Erreur de décodage JSON: {e}")
        except Exception as e:
            logger.error(f"Erreur lors du traitement de la requête: {e}")
    
    async def _publish_translation_result(self, task_id: str, result: dict, target_language: str):
        """Publie un résultat de traduction via PUB vers la gateway"""
        try:
            message = {
                'type': 'translation_completed',
                'taskId': task_id,
                'result': result,
                'targetLanguage': target_language,
                'timestamp': time.time()
            }
            
            logger.info(f"📤 [TRANSLATOR] Envoi résultat vers gateway: taskId={task_id}, target={target_language}, result={result}")
            
            # Utiliser le socket PUB configuré pour envoyer à la gateway
            if self.pub_socket:
                await self.pub_socket.send(json.dumps(message).encode('utf-8'))
                logger.info(f"📤 [TRANSLATOR] Résultat envoyé vers gateway: {task_id} -> {target_language}")
            else:
                logger.error("❌ Socket PUB non initialisé")
            
        except Exception as e:
            logger.error(f"Erreur lors de la publication du résultat: {e}")
    
    async def stop(self):
        """Arrête le serveur"""
        self.running = False
        
        # Arrêter les workers
        await self.pool_manager.stop_workers()
        
        # Attendre que tous les workers se terminent
        if self.worker_tasks:
            await asyncio.gather(*self.worker_tasks, return_exceptions=True)
        
        # Fermer les sockets
        if self.sub_socket:
            self.sub_socket.close()
        if self.pub_socket:
            self.pub_socket.close()
        
        logger.info("ZMQTranslationServer arrêté")
    
    def get_stats(self) -> dict:
        """Retourne les statistiques du serveur"""
        pool_stats = self.pool_manager.get_stats()
        
        return {
            'server_status': 'running' if self.running else 'stopped',
            'gateway_pub_port': self.gateway_pub_port,
            'gateway_sub_port': self.gateway_sub_port,
            'normal_workers': self.pool_manager.normal_workers,
            'any_workers': self.pool_manager.any_workers,
            **pool_stats
        }
    
    async def health_check(self) -> dict:
        """Vérification de santé du serveur"""
        try:
            stats = self.get_stats()
            return {
                'status': 'healthy',
                'running': self.running,
                'stats': stats
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e)
            }
