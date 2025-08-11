#!/usr/bin/env python3
"""
Test complet de l'architecture PUB/SUB avec pools FIFO séparées
Simule la Gateway et le Translator pour valider le flux complet
"""

import asyncio
import json
import time
import uuid
import zmq
import zmq.asyncio
import threading
from typing import Dict, List
import logging

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('test_complete_architecture.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MockGateway:
    """Gateway simulée qui fonctionne exactement comme la vraie Gateway"""
    
    def __init__(self, translator_host: str = "localhost", translator_sub_port: int = 5555, translator_pub_port: int = 5556):
        self.translator_host = translator_host
        self.translator_sub_port = translator_sub_port
        self.translator_pub_port = translator_pub_port
        self.context = zmq.Context()
        
        # Socket PUB pour envoyer les requêtes au Translator
        self.pub_socket = None
        
        # Socket SUB pour recevoir les résultats du Translator
        self.sub_socket = None
        
        # Cache des messages envoyés (comme la vraie Gateway)
        self.sent_messages = {}
        
        # Cache mémoire pour les traductions (comme la vraie Gateway)
        self.translation_cache = {}
        
        # Événements de traduction (comme la vraie Gateway)
        self.translation_events = []
        
        self.stats = {
            'messages_sent': 0,
            'translations_received': 0,
            'errors': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'start_time': time.time()
        }
    
    def initialize(self):
        """Initialise les sockets ZMQ"""
        logger.info("🔧 Initialisation de la Gateway simulée...")
        
        # Socket PUB pour envoyer les requêtes
        self.pub_socket = self.context.socket(zmq.PUB)
        self.pub_socket.connect(f"tcp://{self.translator_host}:{self.translator_sub_port}")
        
        # Socket SUB pour recevoir les résultats
        self.sub_socket = self.context.socket(zmq.SUB)
        self.sub_socket.connect(f"tcp://{self.translator_host}:{self.translator_pub_port}")
        self.sub_socket.subscribe('')
        
        logger.info("✅ Gateway simulée initialisée")
    
    def handle_new_message(self, conversation_id: str, content: str, original_language: str = 'en', sender_id: str = None):
        """Simule exactement le comportement de la vraie Gateway"""
        try:
            message_id = str(uuid.uuid4())
            
            # 1. SAUVEGARDER LE MESSAGE (simulation)
            logger.info(f"💾 [GATEWAY] Message sauvegardé en base: {message_id}")
            logger.info(f"   Conversation: {conversation_id}")
            logger.info(f"   Contenu: {content}")
            logger.info(f"   Langue: {original_language}")
            logger.info(f"   Expéditeur: {sender_id or 'anonyme'}")
            
            # 2. LIBÉRER LE CLIENT IMMÉDIATEMENT
            logger.info(f"✅ [GATEWAY] Client libéré immédiatement avec messageId: {message_id}")
            
            # 3. TRAITER LES TRADUCTIONS EN ASYNCHRONE
            self._process_translations_async(message_id, conversation_id, content, original_language)
            
            return message_id
            
        except Exception as e:
            logger.error(f"❌ [GATEWAY] Erreur traitement message: {e}")
            self.stats['errors'] += 1
            return None
    
    def _process_translations_async(self, message_id: str, conversation_id: str, content: str, original_language: str):
        """Traite les traductions en arrière-plan (comme la vraie Gateway)"""
        try:
            # Simuler l'extraction des langues de conversation
            target_languages = self._extract_conversation_languages(conversation_id, original_language)
            
            logger.info(f"🌍 [GATEWAY] Langues extraites pour {conversation_id}: {target_languages}")
            
            if target_languages:
                # Envoyer une seule requête avec toutes les langues
                self._send_translation_request(message_id, content, original_language, target_languages, conversation_id)
            else:
                logger.info(f"ℹ️ [GATEWAY] Aucune traduction nécessaire pour {conversation_id}")
                
        except Exception as e:
            logger.error(f"❌ [GATEWAY] Erreur traitement asynchrone: {e}")
            self.stats['errors'] += 1
    
    def _extract_conversation_languages(self, conversation_id: str, original_language: str):
        """Simule l'extraction des langues de conversation (comme la vraie Gateway)"""
        # Simulation des langues des participants
        if conversation_id == "any":
            # Conversation "any" - traduire vers plusieurs langues
            all_languages = ['fr', 'es', 'de', 'it', 'pt', 'en']
            return [lang for lang in all_languages if lang != original_language]
        else:
            # Conversation normale - langues typiques
            typical_languages = ['fr', 'es', 'de', 'it']
            return [lang for lang in typical_languages if lang != original_language]
    
    def _send_translation_request(self, message_id: str, content: str, source_language: str, target_languages: List[str], conversation_id: str):
        """Envoie une requête de traduction (comme la vraie Gateway)"""
        try:
            task_id = str(uuid.uuid4())
            
            request = {
                'taskId': task_id,
                'messageId': message_id,
                'text': content,
                'sourceLanguage': source_language,
                'targetLanguages': target_languages,
                'conversationId': conversation_id,
                'modelType': 'basic',
                'timestamp': time.time()
            }
            
            # Envoyer via PUB
            self.pub_socket.send(json.dumps(request).encode('utf-8'))
            
            # Stocker pour traçabilité
            self.sent_messages[task_id] = {
                'timestamp': time.time(),
                'message_id': message_id,
                'content': content,
                'conversation_id': conversation_id,
                'target_languages': target_languages
            }
            
            self.stats['messages_sent'] += 1
            logger.info(f"📤 [GATEWAY] Requête traduction envoyée: {task_id}")
            logger.info(f"   MessageId: {message_id}")
            logger.info(f"   Langues: {target_languages}")
            logger.info(f"   Conversation: {conversation_id}")
            
        except Exception as e:
            logger.error(f"❌ [GATEWAY] Erreur envoi requête: {e}")
            self.stats['errors'] += 1
    
    def listen_for_results(self, duration: int = 30):
        """Écoute les résultats de traduction (comme la vraie Gateway)"""
        logger.info(f"🎧 [GATEWAY] Écoute des résultats pendant {duration} secondes...")
        
        start_time = time.time()
        
        while time.time() - start_time < duration:
            try:
                # Attendre un message avec timeout
                try:
                    message = self.sub_socket.recv(zmq.NOBLOCK)
                    self._handle_translation_result(message)
                except zmq.Again:
                    # Pas de message disponible
                    time.sleep(0.1)
                    continue
                    
            except Exception as e:
                logger.error(f"❌ [GATEWAY] Erreur réception: {e}")
                break
    
    def _handle_translation_result(self, message: bytes):
        """Traite un résultat de traduction (comme la vraie Gateway)"""
        try:
            data = json.loads(message.decode('utf-8'))
            
            logger.info(f"📥 [GATEWAY] Message SUB reçu: {json.dumps(data, indent=2)}")
            
            if data.get('type') == 'translation_completed':
                task_id = data.get('taskId')
                result = data.get('result', {})
                target_language = data.get('targetLanguage')
                
                logger.info(f"✅ [GATEWAY] Traduction terminée reçue:")
                logger.info(f"   TaskId: {task_id}")
                logger.info(f"   MessageId: {result.get('messageId')}")
                logger.info(f"   Langue cible: {target_language}")
                logger.info(f"   Texte traduit: {result.get('translatedText')}")
                logger.info(f"   Score confiance: {result.get('confidenceScore')}")
                logger.info(f"   Modèle: {result.get('modelType')}")
                logger.info(f"   Worker: {result.get('workerName')}")
                
                if task_id in self.sent_messages:
                    request_info = self.sent_messages[task_id]
                    latency = time.time() - request_info['timestamp']
                    logger.info(f"   Latence: {latency:.3f}s")
                
                # Simuler la sauvegarde en base de données
                self._save_translation_to_database(result)
                
                # Simuler l'envoi aux clients WebSocket
                self._send_to_websocket_clients(result)
                
                self.stats['translations_received'] += 1
                
            elif data.get('type') == 'translation_error':
                task_id = data.get('taskId')
                error = data.get('error')
                
                logger.error(f"❌ [GATEWAY] Erreur traduction reçue:")
                logger.error(f"   TaskId: {task_id}")
                logger.error(f"   Erreur: {error}")
                
                # Simuler l'envoi d'erreur aux clients WebSocket
                self._send_error_to_websocket_clients(task_id, error)
                
                self.stats['errors'] += 1
                
        except Exception as e:
            logger.error(f"❌ [GATEWAY] Erreur traitement résultat: {e}")
            self.stats['errors'] += 1
    
    def _save_translation_to_database(self, result: dict):
        """Simule la sauvegarde en base de données (comme la vraie Gateway)"""
        try:
            message_id = result.get('messageId')
            target_language = result.get('targetLanguage')
            cache_key = f"{message_id}_{target_language}"
            
            # Simuler upsert en base
            logger.info(f"💾 [GATEWAY] Sauvegarde en base de données:")
            logger.info(f"   CacheKey: {cache_key}")
            logger.info(f"   MessageId: {message_id}")
            logger.info(f"   Langue: {target_language}")
            logger.info(f"   Contenu: {result.get('translatedText')}")
            logger.info(f"   Score: {result.get('confidenceScore')}")
            logger.info(f"   Modèle: {result.get('modelType')}")
            
            # Mettre en cache mémoire
            self.translation_cache[cache_key] = {
                'result': result,
                'timestamp': time.time()
            }
            
        except Exception as e:
            logger.error(f"❌ [GATEWAY] Erreur sauvegarde base: {e}")
    
    def _send_to_websocket_clients(self, result: dict):
        """Simule l'envoi aux clients WebSocket (comme la vraie Gateway)"""
        try:
            message_id = result.get('messageId')
            target_language = result.get('targetLanguage')
            
            # Simuler l'événement WebSocket
            websocket_event = {
                'type': 'message_translated',
                'messageId': message_id,
                'translatedText': result.get('translatedText'),
                'targetLanguage': target_language,
                'confidenceScore': result.get('confidenceScore'),
                'processingTime': result.get('processingTime'),
                'timestamp': time.time()
            }
            
            logger.info(f"📡 [GATEWAY] Envoi aux clients WebSocket:")
            logger.info(f"   Événement: {json.dumps(websocket_event, indent=2)}")
            
            # Stocker l'événement
            self.translation_events.append(websocket_event)
            
        except Exception as e:
            logger.error(f"❌ [GATEWAY] Erreur envoi WebSocket: {e}")
    
    def _send_error_to_websocket_clients(self, task_id: str, error: str):
        """Simule l'envoi d'erreur aux clients WebSocket"""
        try:
            error_event = {
                'type': 'translation_error',
                'taskId': task_id,
                'error': error,
                'timestamp': time.time()
            }
            
            logger.info(f"📡 [GATEWAY] Envoi erreur aux clients WebSocket:")
            logger.info(f"   Événement: {json.dumps(error_event, indent=2)}")
            
        except Exception as e:
            logger.error(f"❌ [GATEWAY] Erreur envoi erreur WebSocket: {e}")
    
    def print_stats(self):
        """Affiche les statistiques détaillées"""
        duration = time.time() - self.stats['start_time']
        
        print("\n" + "="*80)
        print("📊 STATISTIQUES DÉTAILLÉES DE LA GATEWAY SIMULÉE")
        print("="*80)
        print(f"⏱️  Durée: {duration:.2f} secondes")
        print(f"📤 Messages envoyés: {self.stats['messages_sent']}")
        print(f"🌐 Traductions reçues: {self.stats['translations_received']}")
        print(f"❌ Erreurs: {self.stats['errors']}")
        print(f"💾 Cache hits: {self.stats['cache_hits']}")
        print(f"💾 Cache misses: {self.stats['cache_misses']}")
        print(f"📡 Événements WebSocket: {len(self.translation_events)}")
        
        if self.stats['messages_sent'] > 0:
            success_rate = (self.stats['translations_received'] / self.stats['messages_sent']) * 100
            print(f"🎯 Taux de succès: {success_rate:.1f}%")
        
        print("\n📋 ÉVÉNEMENTS WEBSOCKET ENVOYÉS:")
        for i, event in enumerate(self.translation_events, 1):
            print(f"  {i}. {event['type']} - {event.get('messageId', 'N/A')} -> {event.get('targetLanguage', 'N/A')}")
        
        print("="*80)
    
    def close(self):
        """Ferme les connexions"""
        if self.pub_socket:
            self.pub_socket.close()
        if self.sub_socket:
            self.sub_socket.close()
        if self.context:
            self.context.term()

class MockTranslator:
    """Translator simulé avec pools FIFO séparées et vrais modèles"""
    
    def __init__(self, host: str = "localhost", sub_port: int = 5555, pub_port: int = 5556):
        self.host = host
        self.sub_port = sub_port
        self.pub_port = pub_port
        self.context = zmq.Context()
        self.running = False
        
        # Sockets
        self.sub_socket = None
        self.pub_socket = None
        
        # Pools FIFO séparées
        self.normal_pool = []
        self.any_pool = []
        
        # Workers
        self.normal_workers = []
        self.any_workers = []
        
        # Modèles de traduction simulés
        self.translation_models = {
            'basic': {
                'name': 't5-small',
                'processing_time': 0.1,
                'confidence_range': (0.7, 0.85)
            },
            'medium': {
                'name': 'nllb-200-distilled-600M',
                'processing_time': 0.2,
                'confidence_range': (0.8, 0.92)
            },
            'premium': {
                'name': 'nllb-200-distilled-1.3B',
                'processing_time': 0.3,
                'confidence_range': (0.9, 0.98)
            }
        }
        
        self.stats = {
            'requests_received': 0,
            'translations_completed': 0,
            'errors': 0,
            'pool_full_rejections': 0,
            'start_time': time.time()
        }
    
    def start(self):
        """Démarre le Translator simulé"""
        logger.info("🚀 Démarrage du Translator simulé...")
        
        self.running = True
        
        # Socket SUB pour recevoir les requêtes
        self.sub_socket = self.context.socket(zmq.SUB)
        self.sub_socket.bind(f"tcp://{self.host}:{self.sub_port}")
        self.sub_socket.subscribe('')
        
        # Socket PUB pour envoyer les résultats
        self.pub_socket = self.context.socket(zmq.PUB)
        self.pub_socket.bind(f"tcp://{self.host}:{self.pub_port}")
        
        logger.info(f"✅ Translator simulé démarré sur {self.host}:{self.sub_port}/{self.pub_port}")
        logger.info(f"🤖 Modèles disponibles: {list(self.translation_models.keys())}")
        
        # Démarrer les workers
        self._start_workers()
        
        # Démarrer le thread de traitement
        self.worker_thread = threading.Thread(target=self._worker_loop)
        self.worker_thread.daemon = True
        self.worker_thread.start()
    
    def _start_workers(self):
        """Démarre les workers pour les deux pools"""
        logger.info("👷 Démarrage des workers...")
        
        # Workers pour pool normale (3 workers)
        for i in range(3):
            worker = threading.Thread(target=self._normal_worker, args=(f"normal_worker_{i}",))
            worker.daemon = True
            worker.start()
            self.normal_workers.append(worker)
        
        # Workers pour pool "any" (2 workers)
        for i in range(2):
            worker = threading.Thread(target=self._any_worker, args=(f"any_worker_{i}",))
            worker.daemon = True
            worker.start()
            self.any_workers.append(worker)
        
        logger.info(f"✅ {len(self.normal_workers)} workers normaux et {len(self.any_workers)} workers 'any' démarrés")
    
    def _worker_loop(self):
        """Boucle principale de traitement des requêtes"""
        logger.info("🔄 Boucle de traitement démarrée...")
        
        while self.running:
            try:
                # Recevoir une requête
                message = self.sub_socket.recv(zmq.NOBLOCK)
                self._handle_request(message)
            except zmq.Again:
                # Pas de message disponible
                time.sleep(0.1)
            except Exception as e:
                logger.error(f"❌ Erreur worker loop: {e}")
                break
    
    def _handle_request(self, message: bytes):
        """Traite une requête de traduction"""
        try:
            data = json.loads(message.decode('utf-8'))
            
            task_id = data.get('taskId')
            conversation_id = data.get('conversationId')
            target_languages = data.get('targetLanguages', [])
            model_type = data.get('modelType', 'basic')
            
            self.stats['requests_received'] += 1
            
            logger.info(f"📥 [TRANSLATOR] Requête reçue:")
            logger.info(f"   TaskId: {task_id}")
            logger.info(f"   Conversation: {conversation_id}")
            logger.info(f"   Langues: {target_languages}")
            logger.info(f"   Modèle: {model_type}")
            
            # Router vers la bonne pool
            if conversation_id == "any":
                if len(self.any_pool) >= 10000:  # Pool pleine
                    logger.warning(f"🚫 [TRANSLATOR] Pool 'any' pleine, rejet de {task_id}")
                    self.stats['pool_full_rejections'] += 1
                    self._send_error(task_id, "translation pool full")
                    return
                
                self.any_pool.append(data)
                logger.info(f"📋 [TRANSLATOR] Tâche {task_id} enfilée dans pool 'any' (taille: {len(self.any_pool)})")
            else:
                if len(self.normal_pool) >= 10000:  # Pool pleine
                    logger.warning(f"🚫 [TRANSLATOR] Pool normale pleine, rejet de {task_id}")
                    self.stats['pool_full_rejections'] += 1
                    self._send_error(task_id, "translation pool full")
                    return
                
                self.normal_pool.append(data)
                logger.info(f"📋 [TRANSLATOR] Tâche {task_id} enfilée dans pool normale (taille: {len(self.normal_pool)})")
                
        except Exception as e:
            logger.error(f"❌ [TRANSLATOR] Erreur traitement requête: {e}")
            self.stats['errors'] += 1
    
    def _normal_worker(self, worker_name: str):
        """Worker pour la pool normale"""
        logger.info(f"👷 [TRANSLATOR] {worker_name} démarré")
        
        while self.running:
            try:
                if self.normal_pool:
                    # Défiler une tâche
                    task = self.normal_pool.pop(0)
                    self._process_task(task, worker_name)
                else:
                    time.sleep(0.1)
            except Exception as e:
                logger.error(f"❌ [TRANSLATOR] Erreur {worker_name}: {e}")
    
    def _any_worker(self, worker_name: str):
        """Worker pour la pool 'any'"""
        logger.info(f"👷 [TRANSLATOR] {worker_name} démarré")
        
        while self.running:
            try:
                if self.any_pool:
                    # Défiler une tâche
                    task = self.any_pool.pop(0)
                    self._process_task(task, worker_name)
                else:
                    time.sleep(0.1)
            except Exception as e:
                logger.error(f"❌ [TRANSLATOR] Erreur {worker_name}: {e}")
    
    def _process_task(self, task: dict, worker_name: str):
        """Traite une tâche de traduction"""
        try:
            task_id = task.get('taskId')
            message_id = task.get('messageId')
            text = task.get('text')
            source_language = task.get('sourceLanguage')
            target_languages = task.get('targetLanguages', [])
            model_type = task.get('modelType', 'basic')
            
            logger.info(f"🔄 [TRANSLATOR] {worker_name} traite {task_id}")
            logger.info(f"   MessageId: {message_id}")
            logger.info(f"   Texte: {text}")
            logger.info(f"   Langues: {target_languages}")
            logger.info(f"   Modèle: {model_type}")
            
            # Traduire en parallèle pour toutes les langues
            for target_language in target_languages:
                self._translate_single_language(task_id, message_id, text, source_language, target_language, model_type, worker_name)
                
        except Exception as e:
            logger.error(f"❌ [TRANSLATOR] Erreur traitement tâche {task_id}: {e}")
            self.stats['errors'] += 1
    
    def _translate_single_language(self, task_id: str, message_id: str, text: str, source_language: str, target_language: str, model_type: str, worker_name: str):
        """Traduit vers une langue spécifique avec le modèle approprié"""
        try:
            # Récupérer les paramètres du modèle
            model_config = self.translation_models.get(model_type, self.translation_models['basic'])
            
            # Simuler le traitement avec le modèle
            base_time = model_config['processing_time']
            processing_time = base_time + (hash(text) % 50) / 1000  # Variation
            time.sleep(processing_time)
            
            # Simuler le texte traduit avec le modèle
            model_name = model_config['name']
            translated_text = f"[{target_language.upper()}] {text} (via {model_name})"
            
            # Score de confiance basé sur le modèle
            min_conf, max_conf = model_config['confidence_range']
            confidence_score = min_conf + (hash(text) % int((max_conf - min_conf) * 100)) / 100
            
            # Créer le résultat
            result = {
                'messageId': message_id,
                'translatedText': translated_text,
                'sourceLanguage': source_language,
                'targetLanguage': target_language,
                'confidenceScore': confidence_score,
                'processingTime': processing_time,
                'modelType': model_type,
                'modelName': model_name,
                'workerName': worker_name
            }
            
            # Publier le résultat
            response = {
                'type': 'translation_completed',
                'taskId': task_id,
                'targetLanguage': target_language,
                'result': result,
                'timestamp': time.time()
            }
            
            self.pub_socket.send(json.dumps(response).encode('utf-8'))
            
            self.stats['translations_completed'] += 1
            logger.info(f"✅ [TRANSLATOR] {worker_name}: Traduction {task_id} -> {target_language}")
            logger.info(f"   Modèle: {model_name}")
            logger.info(f"   Score: {confidence_score:.3f}")
            logger.info(f"   Temps: {processing_time:.3f}s")
            
        except Exception as e:
            logger.error(f"❌ [TRANSLATOR] Erreur traduction {task_id} -> {target_language}: {e}")
            self._send_error(task_id, str(e))
    
    def _send_error(self, task_id: str, error_message: str):
        """Envoie un message d'erreur"""
        try:
            error_response = {
                'type': 'translation_error',
                'taskId': task_id,
                'error': error_message,
                'timestamp': time.time()
            }
            
            self.pub_socket.send(json.dumps(error_response).encode('utf-8'))
            self.stats['errors'] += 1
            
        except Exception as e:
            logger.error(f"❌ [TRANSLATOR] Erreur envoi erreur: {e}")
    
    def stop(self):
        """Arrête le Translator simulé"""
        logger.info("🛑 Arrêt du Translator simulé...")
        self.running = False
        
        if self.sub_socket:
            self.sub_socket.close()
        if self.pub_socket:
            self.pub_socket.close()
        if self.context:
            self.context.term()
        
        logger.info("✅ Translator simulé arrêté")
    
    def get_stats(self):
        """Retourne les statistiques"""
        duration = time.time() - self.stats['start_time']
        return {
            **self.stats,
            'duration': duration,
            'translations_per_second': self.stats['translations_completed'] / duration if duration > 0 else 0,
            'normal_pool_size': len(self.normal_pool),
            'any_pool_size': len(self.any_pool)
        }

def main():
    """Fonction principale"""
    print("🧪 Test complet de l'architecture PUB/SUB avec pools FIFO séparées")
    print("="*80)
    
    # Configuration
    host = "localhost"
    sub_port = 5555
    pub_port = 5556
    
    print(f"📡 ZMQ: {host}:{sub_port}/{pub_port}")
    print(f"📝 Logs: test_complete_architecture.log")
    print("="*80)
    
    # Démarrer le Translator simulé
    translator = MockTranslator(host, sub_port, pub_port)
    translator.start()
    
    # Attendre que le Translator soit prêt
    time.sleep(2)
    
    # Créer la Gateway simulée
    gateway = MockGateway(host, sub_port, pub_port)
    gateway.initialize()
    
    try:
        # Attendre un peu
        time.sleep(1)
        
        # Envoyer quelques messages de test
        print("\n📤 Envoi des messages de test...")
        
        # Test 1: Message normal
        gateway.handle_new_message("test_conversation_1", "Hello, how are you today?", "en", "user_123")
        time.sleep(1)
        
        # Test 2: Message conversation "any"
        gateway.handle_new_message("any", "Bonjour, comment allez-vous ?", "fr", "anonymous_456")
        time.sleep(1)
        
        # Test 3: Message espagnol
        gateway.handle_new_message("test_conversation_3", "Hola, ¿cómo estás?", "es", "user_789")
        time.sleep(1)
        
        # Test 4: Message long
        gateway.handle_new_message("test_conversation_4", "This is a longer message to test the translation performance with more complex content and multiple sentences.", "en", "user_101")
        time.sleep(1)
        
        # Écouter les résultats
        print("\n🎧 Écoute des résultats...")
        gateway.listen_for_results(20)
        
    except KeyboardInterrupt:
        print("\n🛑 Arrêt demandé par l'utilisateur")
    except Exception as e:
        logger.error(f"❌ Erreur test: {e}")
    finally:
        # Afficher les statistiques
        gateway.print_stats()
        
        # Statistiques du Translator
        translator_stats = translator.get_stats()
        print("\n" + "="*80)
        print("📊 STATISTIQUES DU TRANSLATOR SIMULÉ")
        print("="*80)
        print(f"⏱️  Durée: {translator_stats['duration']:.2f} secondes")
        print(f"📥 Requêtes reçues: {translator_stats['requests_received']}")
        print(f"✅ Traductions terminées: {translator_stats['translations_completed']}")
        print(f"❌ Erreurs: {translator_stats['errors']}")
        print(f"🚫 Rejets pool pleine: {translator_stats['pool_full_rejections']}")
        print(f"🚀 Traductions/seconde: {translator_stats['translations_per_second']:.2f}")
        print(f"📋 Pool normale: {translator_stats['normal_pool_size']} items")
        print(f"📋 Pool 'any': {translator_stats['any_pool_size']} items")
        print("="*80)
        
        # Fermer
        gateway.close()
        translator.stop()

if __name__ == "__main__":
    main()
