#!/usr/bin/env python3
"""
Serveur de test pour valider l'architecture PUB/SUB avec pools FIFO séparées
Simule un client WebSocket et trace toutes les communications
"""

import asyncio
import json
import logging
import time
import uuid
import zmq
import zmq.asyncio
from datetime import datetime
from typing import Dict, List, Optional
import websockets
from websockets.server import serve

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('test_server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class TestServer:
    """Serveur de test pour valider l'architecture complète"""
    
    def __init__(self, 
                 zmq_host: str = "localhost",
                 zmq_sub_port: int = 5555,
                 zmq_pub_port: int = 5556,
                 websocket_port: int = 8080):
        
        self.zmq_host = zmq_host
        self.zmq_sub_port = zmq_sub_port
        self.zmq_pub_port = zmq_pub_port
        self.websocket_port = websocket_port
        
        # Contexte ZMQ
        self.context = zmq.asyncio.Context()
        
        # Sockets ZMQ
        self.pub_socket = None  # Pour envoyer les requêtes de traduction
        self.sub_socket = None  # Pour recevoir les résultats
        
        # WebSocket clients
        self.websocket_clients = set()
        
        # Statistiques de test
        self.stats = {
            'messages_sent': 0,
            'translations_received': 0,
            'websocket_events': 0,
            'errors': 0,
            'start_time': time.time()
        }
        
        # Cache des requêtes en cours
        self.pending_requests: Dict[str, Dict] = {}
        
        logger.info(f"TestServer initialisé: ZMQ {zmq_host}:{zmq_sub_port}/{zmq_pub_port}, WS {websocket_port}")
    
    async def initialize(self):
        """Initialise les connexions ZMQ et WebSocket"""
        try:
            # Socket PUB pour envoyer les requêtes
            self.pub_socket = self.context.socket(zmq.PUB)
            await self.pub_socket.bind(f"tcp://{self.zmq_host}:{self.zmq_sub_port}")
            
            # Socket SUB pour recevoir les résultats
            self.sub_socket = self.context.socket(zmq.SUB)
            await self.sub_socket.connect(f"tcp://{self.zmq_host}:{self.zmq_pub_port}")
            await self.sub_socket.subscribe('')
            
            logger.info("✅ Sockets ZMQ initialisés")
            
        except Exception as e:
            logger.error(f"❌ Erreur initialisation ZMQ: {e}")
            raise
    
    async def start_websocket_server(self):
        """Démarre le serveur WebSocket"""
        try:
            async with serve(self._handle_websocket, "localhost", self.websocket_port):
                logger.info(f"✅ Serveur WebSocket démarré sur port {self.websocket_port}")
                await asyncio.Future()  # Run forever
        except Exception as e:
            logger.error(f"❌ Erreur serveur WebSocket: {e}")
            raise
    
    async def _handle_websocket(self, websocket, path):
        """Gère les connexions WebSocket"""
        client_id = str(uuid.uuid4())[:8]
        self.websocket_clients.add(websocket)
        
        logger.info(f"🔌 Client WebSocket connecté: {client_id}")
        
        try:
            async for message in websocket:
                await self._handle_websocket_message(websocket, message, client_id)
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Client WebSocket déconnecté: {client_id}")
        except Exception as e:
            logger.error(f"❌ Erreur WebSocket {client_id}: {e}")
        finally:
            self.websocket_clients.discard(websocket)
    
    async def _handle_websocket_message(self, websocket, message: str, client_id: str):
        """Traite les messages WebSocket"""
        try:
            data = json.loads(message)
            event_type = data.get('type')
            
            logger.info(f"📨 WebSocket {client_id}: {event_type}")
            self.stats['websocket_events'] += 1
            
            if event_type == 'send_message':
                await self._handle_send_message(data, client_id)
            elif event_type == 'request_translation':
                await self._handle_request_translation(data, client_id)
            elif event_type == 'ping':
                await websocket.send(json.dumps({'type': 'pong', 'timestamp': time.time()}))
            else:
                logger.warning(f"⚠️ Événement WebSocket inconnu: {event_type}")
                
        except json.JSONDecodeError as e:
            logger.error(f"❌ Erreur JSON WebSocket {client_id}: {e}")
        except Exception as e:
            logger.error(f"❌ Erreur traitement WebSocket {client_id}: {e}")
    
    async def _handle_send_message(self, data: Dict, client_id: str):
        """Simule l'envoi d'un message via l'architecture Gateway"""
        try:
            conversation_id = data.get('conversationId', 'test_conversation')
            content = data.get('content', 'Hello World')
            original_language = data.get('originalLanguage', 'en')
            
            logger.info(f"📝 Message de {client_id}: {content} -> {conversation_id}")
            
            # Simuler la sauvegarde du message (Gateway)
            message_id = str(uuid.uuid4())
            
            # Simuler l'extraction des langues (Gateway)
            target_languages = ['fr', 'es', 'de', 'it']
            
            # Envoyer la requête de traduction (Gateway -> Translator)
            await self._send_translation_request(message_id, content, original_language, target_languages, conversation_id)
            
            # Simuler la réponse immédiate du Gateway
            response = {
                'type': 'message_sent',
                'messageId': message_id,
                'status': 'message_saved',
                'timestamp': datetime.now().isoformat()
            }
            
            # Diffuser aux clients WebSocket
            await self._broadcast_to_websockets(response)
            
            logger.info(f"✅ Message {message_id} traité et diffusé")
            
        except Exception as e:
            logger.error(f"❌ Erreur envoi message: {e}")
            self.stats['errors'] += 1
    
    async def _handle_request_translation(self, data: Dict, client_id: str):
        """Simule une demande de traduction spécifique"""
        try:
            message_id = data.get('messageId')
            target_language = data.get('targetLanguage', 'fr')
            
            logger.info(f"🌍 Demande traduction {client_id}: {message_id} -> {target_language}")
            
            # Simuler la récupération depuis le cache/DB
            translation = {
                'type': 'translation_received',
                'messageId': message_id,
                'translatedText': f"[{target_language.upper()}] Traduction simulée",
                'targetLanguage': target_language,
                'confidenceScore': 0.95
            }
            
            await self._broadcast_to_websockets(translation)
            
        except Exception as e:
            logger.error(f"❌ Erreur demande traduction: {e}")
            self.stats['errors'] += 1
    
    async def _send_translation_request(self, message_id: str, text: str, source_language: str, target_languages: List[str], conversation_id: str):
        """Envoie une requête de traduction via ZMQ PUB"""
        try:
            task_id = str(uuid.uuid4())
            
            request = {
                'taskId': task_id,
                'messageId': message_id,
                'text': text,
                'sourceLanguage': source_language,
                'targetLanguages': target_languages,
                'conversationId': conversation_id,
                'modelType': 'basic',
                'timestamp': time.time()
            }
            
            # Envoyer via PUB
            await self.pub_socket.send(json.dumps(request).encode('utf-8'))
            
            # Stocker pour traçabilité
            self.pending_requests[task_id] = {
                'timestamp': time.time(),
                'request': request
            }
            
            self.stats['messages_sent'] += 1
            logger.info(f"📤 Requête envoyée: {task_id} ({len(target_languages)} langues)")
            
        except Exception as e:
            logger.error(f"❌ Erreur envoi requête: {e}")
            self.stats['errors'] += 1
    
    async def start_result_listener(self):
        """Démarre l'écoute des résultats de traduction"""
        logger.info("🎧 Démarrage écoute des résultats...")
        
        while True:
            try:
                message = await self.sub_socket.recv()
                await self._handle_translation_result(message)
            except Exception as e:
                logger.error(f"❌ Erreur réception résultat: {e}")
                break
    
    async def _handle_translation_result(self, message: bytes):
        """Traite un résultat de traduction reçu"""
        try:
            data = json.loads(message.decode('utf-8'))
            
            if data.get('type') == 'translation_completed':
                task_id = data.get('taskId')
                result = data.get('result', {})
                target_language = data.get('targetLanguage')
                
                if task_id in self.pending_requests:
                    request_info = self.pending_requests[task_id]
                    latency = time.time() - request_info['timestamp']
                    
                    logger.info(f"✅ Résultat reçu: {task_id} -> {target_language} (latence: {latency:.3f}s)")
                    
                    # Supprimer de la liste des requêtes en cours
                    del self.pending_requests[task_id]
                
                self.stats['translations_received'] += 1
                
                # Diffuser aux clients WebSocket
                translation_event = {
                    'type': 'message_translated',
                    'messageId': result.get('messageId'),
                    'translatedText': result.get('translatedText'),
                    'targetLanguage': target_language,
                    'confidenceScore': result.get('confidenceScore', 0.95),
                    'processingTime': result.get('processingTime', 0),
                    'timestamp': datetime.now().isoformat()
                }
                
                await self._broadcast_to_websockets(translation_event)
                
            elif data.get('type') == 'translation_error':
                task_id = data.get('taskId')
                error = data.get('error')
                
                logger.error(f"❌ Erreur traduction: {error} pour {task_id}")
                
                # Nettoyer la requête en cours
                if task_id in self.pending_requests:
                    del self.pending_requests[task_id]
                
                self.stats['errors'] += 1
                
                # Diffuser l'erreur aux clients WebSocket
                error_event = {
                    'type': 'translation_error',
                    'taskId': task_id,
                    'error': error,
                    'timestamp': datetime.now().isoformat()
                }
                
                await self._broadcast_to_websockets(error_event)
                
        except Exception as e:
            logger.error(f"❌ Erreur traitement résultat: {e}")
            self.stats['errors'] += 1
    
    async def _broadcast_to_websockets(self, message: Dict):
        """Diffuse un message à tous les clients WebSocket"""
        if not self.websocket_clients:
            return
        
        message_str = json.dumps(message)
        disconnected_clients = set()
        
        for websocket in self.websocket_clients:
            try:
                await websocket.send(message_str)
            except websockets.exceptions.ConnectionClosed:
                disconnected_clients.add(websocket)
            except Exception as e:
                logger.error(f"❌ Erreur envoi WebSocket: {e}")
                disconnected_clients.add(websocket)
        
        # Nettoyer les clients déconnectés
        self.websocket_clients -= disconnected_clients
    
    async def run_test_scenario(self):
        """Exécute un scénario de test automatique"""
        logger.info("🧪 Démarrage scénario de test automatique...")
        
        # Attendre que les connexions soient établies
        await asyncio.sleep(2)
        
        # Scénario 1: Message normal
        await self._send_test_message("test_normal", "Hello, how are you?", "en")
        await asyncio.sleep(1)
        
        # Scénario 2: Message conversation "any"
        await self._send_test_message("test_any", "Bonjour, comment allez-vous ?", "fr")
        await asyncio.sleep(1)
        
        # Scénario 3: Message avec plusieurs langues
        await self._send_test_message("test_multi", "Hola, ¿cómo estás?", "es")
        await asyncio.sleep(1)
        
        # Scénario 4: Message long
        await self._send_test_message("test_long", "This is a longer message to test the translation performance with more complex content.", "en")
        await asyncio.sleep(1)
        
        logger.info("✅ Scénario de test terminé")
    
    async def _send_test_message(self, conversation_id: str, content: str, original_language: str):
        """Envoie un message de test"""
        try:
            message_id = str(uuid.uuid4())
            target_languages = ['fr', 'es', 'de', 'it']
            
            logger.info(f"🧪 Test message: {content} -> {conversation_id}")
            
            await self._send_translation_request(message_id, content, original_language, target_languages, conversation_id)
            
        except Exception as e:
            logger.error(f"❌ Erreur message de test: {e}")
    
    def print_stats(self):
        """Affiche les statistiques de test"""
        duration = time.time() - self.stats['start_time']
        
        print("\n" + "="*60)
        print("📊 STATISTIQUES DU SERVEUR DE TEST")
        print("="*60)
        print(f"⏱️  Durée: {duration:.2f} secondes")
        print(f"📤 Messages envoyés: {self.stats['messages_sent']}")
        print(f"📥 Traductions reçues: {self.stats['translations_received']}")
        print(f"🔌 Événements WebSocket: {self.stats['websocket_events']}")
        print(f"❌ Erreurs: {self.stats['errors']}")
        print(f"⏳ Requêtes en cours: {len(self.pending_requests)}")
        print(f"👥 Clients WebSocket: {len(self.websocket_clients)}")
        
        if self.stats['messages_sent'] > 0:
            success_rate = (self.stats['translations_received'] / self.stats['messages_sent']) * 100
            print(f"🎯 Taux de succès: {success_rate:.1f}%")
        
        print("="*60)
    
    async def close(self):
        """Ferme les connexions"""
        try:
            if self.pub_socket:
                await self.pub_socket.close()
            if self.sub_socket:
                await self.sub_socket.close()
            if self.context:
                await self.context.term()
            
            logger.info("✅ TestServer fermé")
        except Exception as e:
            logger.error(f"❌ Erreur fermeture TestServer: {e}")

async def main():
    """Fonction principale"""
    print("🚀 Serveur de test pour l'architecture PUB/SUB")
    print("="*50)
    
    # Configuration
    zmq_host = "localhost"
    zmq_sub_port = 5555
    zmq_pub_port = 5556
    websocket_port = 8080
    
    print(f"📡 ZMQ: {zmq_host}:{zmq_sub_port}/{zmq_pub_port}")
    print(f"🌐 WebSocket: localhost:{websocket_port}")
    print(f"📝 Logs: test_server.log")
    print("="*50)
    
    server = TestServer(zmq_host, zmq_sub_port, zmq_pub_port, websocket_port)
    
    try:
        # Initialiser
        await server.initialize()
        
        # Démarrer les tâches en parallèle
        tasks = [
            asyncio.create_task(server.start_websocket_server()),
            asyncio.create_task(server.start_result_listener()),
            asyncio.create_task(server.run_test_scenario())
        ]
        
        # Attendre la fin ou interruption
        try:
            await asyncio.gather(*tasks)
        except KeyboardInterrupt:
            print("\n🛑 Arrêt demandé par l'utilisateur")
        
    except Exception as e:
        logger.error(f"❌ Erreur serveur de test: {e}")
    finally:
        # Afficher les statistiques
        server.print_stats()
        
        # Fermer
        await server.close()

if __name__ == "__main__":
    asyncio.run(main())
