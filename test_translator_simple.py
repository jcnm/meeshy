#!/usr/bin/env python3
"""
Script de test simplifié pour le Translator
Teste uniquement la communication ZMQ PUB/SUB
"""

import asyncio
import json
import time
import uuid
import zmq
import zmq.asyncio
from typing import Dict, List

class SimpleTranslatorTest:
    """Test simple du Translator"""
    
    def __init__(self, host: str = "localhost", sub_port: int = 5555, pub_port: int = 5556):
        self.host = host
        self.sub_port = sub_port
        self.pub_port = pub_port
        self.context = zmq.asyncio.Context()
        
        # Socket PUB pour envoyer les requêtes
        self.pub_socket = None
        
        # Socket SUB pour recevoir les résultats
        self.sub_socket = None
        
        self.stats = {
            'requests_sent': 0,
            'results_received': 0,
            'errors': 0,
            'start_time': time.time()
        }
        
        self.pending_requests = {}
    
    async def initialize(self):
        """Initialise les sockets ZMQ"""
        print("🔧 Initialisation des sockets ZMQ...")
        
        # Socket PUB pour envoyer les requêtes
        self.pub_socket = self.context.socket(zmq.PUB)
        self.pub_socket.bind(f"tcp://{self.host}:{self.sub_port}")
        
        # Socket SUB pour recevoir les résultats
        self.sub_socket = self.context.socket(zmq.SUB)
        self.sub_socket.connect(f"tcp://{self.host}:{self.pub_port}")
        self.sub_socket.subscribe('')
        
        print("✅ Sockets ZMQ initialisés")
    
    async def send_test_request(self, conversation_id: str, text: str, target_languages: List[str]):
        """Envoie une requête de test"""
        try:
            task_id = str(uuid.uuid4())
            message_id = str(uuid.uuid4())
            
            request = {
                'taskId': task_id,
                'messageId': message_id,
                'text': text,
                'sourceLanguage': 'en',
                'targetLanguages': target_languages,
                'conversationId': conversation_id,
                'modelType': 'basic',
                'timestamp': time.time()
            }
            
            # Envoyer via PUB
            self.pub_socket.send(json.dumps(request).encode('utf-8'))
            
            # Stocker pour traçabilité
            self.pending_requests[task_id] = {
                'timestamp': time.time(),
                'request': request
            }
            
            self.stats['requests_sent'] += 1
            print(f"📤 Requête envoyée: {task_id} ({len(target_languages)} langues)")
            
            return task_id
            
        except Exception as e:
            print(f"❌ Erreur envoi requête: {e}")
            self.stats['errors'] += 1
            return None
    
    async def listen_for_results(self, duration: int = 10):
        """Écoute les résultats pendant une durée donnée"""
        print(f"🎧 Écoute des résultats pendant {duration} secondes...")
        
        start_time = time.time()
        
        while time.time() - start_time < duration:
            try:
                # Attendre un message avec timeout
                try:
                    message = await asyncio.wait_for(
                        asyncio.get_event_loop().run_in_executor(None, self.sub_socket.recv), 
                        timeout=1.0
                    )
                    await self._handle_result(message)
                except asyncio.TimeoutError:
                    continue
                    
            except Exception as e:
                print(f"❌ Erreur réception: {e}")
                break
    
    async def _handle_result(self, message: bytes):
        """Traite un résultat reçu"""
        try:
            data = json.loads(message.decode('utf-8'))
            
            if data.get('type') == 'translation_completed':
                task_id = data.get('taskId')
                result = data.get('result', {})
                target_language = data.get('targetLanguage')
                
                if task_id in self.pending_requests:
                    request_info = self.pending_requests[task_id]
                    latency = time.time() - request_info['timestamp']
                    
                    print(f"✅ Résultat reçu: {task_id} -> {target_language} (latence: {latency:.3f}s)")
                    print(f"   Texte: {result.get('translatedText', 'N/A')}")
                    
                    # Supprimer de la liste des requêtes en cours
                    del self.pending_requests[task_id]
                
                self.stats['results_received'] += 1
                
            elif data.get('type') == 'translation_error':
                task_id = data.get('taskId')
                error = data.get('error')
                
                print(f"❌ Erreur traduction: {error} pour {task_id}")
                
                # Nettoyer la requête en cours
                if task_id in self.pending_requests:
                    del self.pending_requests[task_id]
                
                self.stats['errors'] += 1
                
        except Exception as e:
            print(f"❌ Erreur traitement résultat: {e}")
            self.stats['errors'] += 1
    
    def print_stats(self):
        """Affiche les statistiques"""
        duration = time.time() - self.stats['start_time']
        
        print("\n" + "="*50)
        print("📊 STATISTIQUES DU TEST")
        print("="*50)
        print(f"⏱️  Durée: {duration:.2f} secondes")
        print(f"📤 Requêtes envoyées: {self.stats['requests_sent']}")
        print(f"📥 Résultats reçus: {self.stats['results_received']}")
        print(f"❌ Erreurs: {self.stats['errors']}")
        print(f"⏳ Requêtes en cours: {len(self.pending_requests)}")
        
        if self.stats['requests_sent'] > 0:
            success_rate = (self.stats['results_received'] / self.stats['requests_sent']) * 100
            print(f"🎯 Taux de succès: {success_rate:.1f}%")
        
        print("="*50)
    
    async def close(self):
        """Ferme les connexions"""
        if self.pub_socket:
            self.pub_socket.close()
        if self.sub_socket:
            self.sub_socket.close()
        if self.context:
            self.context.term()

async def main():
    """Fonction principale"""
    print("🧪 Test simple du Translator")
    print("="*30)
    
    test = SimpleTranslatorTest()
    
    try:
        # Initialiser
        await test.initialize()
        
        # Attendre un peu
        await asyncio.sleep(1)
        
        # Envoyer quelques requêtes de test
        print("\n📤 Envoi des requêtes de test...")
        
        # Test 1: Conversation normale
        await test.send_test_request("test_normal", "Hello, how are you?", ["fr", "es", "de"])
        await asyncio.sleep(0.5)
        
        # Test 2: Conversation "any"
        await test.send_test_request("test_any", "Bonjour, comment allez-vous ?", ["en", "es", "it"])
        await asyncio.sleep(0.5)
        
        # Test 3: Message long
        await test.send_test_request("test_long", "This is a longer message to test the translation performance.", ["fr", "de", "it"])
        await asyncio.sleep(0.5)
        
        # Écouter les résultats
        print("\n🎧 Écoute des résultats...")
        await test.listen_for_results(15)
        
    except Exception as e:
        print(f"❌ Erreur test: {e}")
    finally:
        # Afficher les statistiques
        test.print_stats()
        
        # Fermer
        await test.close()

if __name__ == "__main__":
    asyncio.run(main())
