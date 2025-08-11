#!/usr/bin/env python3
"""
Serveur de test simplifié pour valider l'architecture PUB/SUB avec pools FIFO séparées
Utilise seulement les modules Python standard
"""

import asyncio
import json
import logging
import time
import uuid
import zmq
import zmq.asyncio
from datetime import datetime
from typing import Dict, List
import socket
import threading

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

class SimpleWebSocketServer:
    """Serveur WebSocket simple utilisant socket standard"""
    
    def __init__(self, host: str = "localhost", port: int = 8080):
        self.host = host
        self.port = port
        self.clients = []
        self.running = False
        
    def start(self):
        """Démarre le serveur WebSocket"""
        self.running = True
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(5)
        
        logger.info(f"✅ Serveur WebSocket simple démarré sur {self.host}:{self.port}")
        
        # Accepter les connexions dans un thread séparé
        self.accept_thread = threading.Thread(target=self._accept_connections)
        self.accept_thread.daemon = True
        self.accept_thread.start()
    
    def _accept_connections(self):
        """Accepte les connexions clients"""
        while self.running:
            try:
                client_socket, address = self.server_socket.accept()
                logger.info(f"🔌 Client connecté: {address}")
                
                # Ajouter le client à la liste
                self.clients.append(client_socket)
                
                # Gérer le client dans un thread séparé
                client_thread = threading.Thread(target=self._handle_client, args=(client_socket, address))
                client_thread.daemon = True
                client_thread.start()
                
            except Exception as e:
                if self.running:
                    logger.error(f"❌ Erreur acceptation connexion: {e}")
    
    def _handle_client(self, client_socket, address):
        """Gère un client WebSocket"""
        try:
            # Lecture simple des messages
            while self.running:
                try:
                    data = client_socket.recv(1024)
                    if not data:
                        break
                    
                    message = data.decode('utf-8')
                    logger.info(f"📨 Message de {address}: {message[:100]}...")
                    
                    # Réponse simple
                    response = json.dumps({
                        'type': 'pong',
                        'timestamp': datetime.now().isoformat(),
                        'message': 'Message reçu'
                    })
                    client_socket.send(response.encode('utf-8'))
                    
                except Exception as e:
                    logger.error(f"❌ Erreur lecture client {address}: {e}")
                    break
                    
        except Exception as e:
            logger.error(f"❌ Erreur gestion client {address}: {e}")
        finally:
            # Nettoyer
            if client_socket in self.clients:
                self.clients.remove(client_socket)
            client_socket.close()
            logger.info(f"🔌 Client déconnecté: {address}")
    
    def broadcast(self, message: Dict):
        """Diffuse un message à tous les clients"""
        message_str = json.dumps(message)
        disconnected_clients = []
        
        for client_socket in self.clients:
            try:
                client_socket.send(message_str.encode('utf-8'))
            except Exception as e:
                logger.error(f"❌ Erreur envoi client: {e}")
                disconnected_clients.append(client_socket)
        
        # Nettoyer les clients déconnectés
        for client_socket in disconnected_clients:
            if client_socket in self.clients:
                self.clients.remove(client_socket)
    
    def stop(self):
        """Arrête le serveur"""
        self.running = False
        if hasattr(self, 'server_socket'):
            self.server_socket.close()
        logger.info("✅ Serveur WebSocket arrêté")

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
        
        # Serveur WebSocket simple
        self.websocket_server = SimpleWebSocketServer("localhost", websocket_port)
        
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
            
            # Démarrer le serveur WebSocket
            self.websocket_server.start()
            
        except Exception as e:
            logger.error(f"❌ Erreur initialisation: {e}")
            raise
    
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
                
                self.websocket_server.broadcast(translation_event)
                
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
                
                self.websocket_server.broadcast(error_event)
                
        except Exception as e:
            logger.error(f"❌ Erreur traitement résultat: {e}")
            self.stats['errors'] += 1
    
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
        print(f"👥 Clients WebSocket: {len(self.websocket_server.clients)}")
        
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
            
            self.websocket_server.stop()
            
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
