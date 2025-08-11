#!/usr/bin/env python3
"""
Test complet avec Translator simulé
Démarre un Translator simulé et teste l'architecture PUB/SUB
"""

import asyncio
import json
import time
import uuid
import zmq
import zmq.asyncio
from typing import Dict, List
import threading

class MockTranslator:
    """Translator simulé pour tester l'architecture"""
    
    def __init__(self, host: str = "localhost", sub_port: int = 5555, pub_port: int = 5556):
        self.host = host
        self.sub_port = sub_port
        self.pub_port = pub_port
        self.context = zmq.Context()
        self.running = False
        
        # Socket SUB pour recevoir les requêtes
        self.sub_socket = None
        
        # Socket PUB pour envoyer les résultats
        self.pub_socket = None
        
        self.stats = {
            'requests_received': 0,
            'translations_completed': 0,
            'errors': 0,
            'start_time': time.time()
        }
    
    def start(self):
        """Démarre le Translator simulé"""
        print("🚀 Démarrage du Translator simulé...")
        
        self.running = True
        
        # Socket SUB pour recevoir les requêtes
        self.sub_socket = self.context.socket(zmq.SUB)
        self.sub_socket.bind(f"tcp://{self.host}:{self.sub_port}")
        self.sub_socket.subscribe('')
        
        # Socket PUB pour envoyer les résultats
        self.pub_socket = self.context.socket(zmq.PUB)
        self.pub_socket.bind(f"tcp://{self.host}:{self.pub_port}")
        
        print(f"✅ Translator simulé démarré sur {self.host}:{self.sub_port}/{self.pub_port}")
        
        # Démarrer le thread de traitement
        self.worker_thread = threading.Thread(target=self._worker_loop)
        self.worker_thread.daemon = True
        self.worker_thread.start()
    
    def _worker_loop(self):
        """Boucle de traitement des requêtes"""
        print("👷 Worker démarré, en attente de requêtes...")
        
        while self.running:
            try:
                # Recevoir une requête
                message = self.sub_socket.recv(zmq.NOBLOCK)
                self._handle_request(message)
            except zmq.Again:
                # Pas de message disponible
                time.sleep(0.1)
            except Exception as e:
                print(f"❌ Erreur worker: {e}")
                break
    
    def _handle_request(self, message: bytes):
        """Traite une requête de traduction"""
        try:
            data = json.loads(message.decode('utf-8'))
            
            task_id = data.get('taskId')
            message_id = data.get('messageId')
            text = data.get('text')
            source_language = data.get('sourceLanguage')
            target_languages = data.get('targetLanguages', [])
            conversation_id = data.get('conversationId')
            model_type = data.get('modelType', 'basic')
            
            self.stats['requests_received'] += 1
            
            print(f"📥 Requête reçue: {task_id} ({len(target_languages)} langues)")
            
            # Simuler le traitement en parallèle pour chaque langue
            for target_language in target_languages:
                self._simulate_translation(task_id, message_id, text, source_language, target_language, model_type, conversation_id)
                
        except Exception as e:
            print(f"❌ Erreur traitement requête: {e}")
            self.stats['errors'] += 1
    
    def _simulate_translation(self, task_id: str, message_id: str, text: str, source_language: str, target_language: str, model_type: str, conversation_id: str):
        """Simule une traduction"""
        try:
            # Simuler un délai de traitement
            processing_time = 0.1 + (hash(text) % 50) / 1000  # 100-150ms
            time.sleep(processing_time)
            
            # Simuler le texte traduit
            translated_text = f"[{target_language.upper()}] {text}"
            confidence_score = 0.85 + (hash(text) % 15) / 100  # 85-99%
            
            # Créer le résultat
            result = {
                'messageId': message_id,
                'translatedText': translated_text,
                'sourceLanguage': source_language,
                'targetLanguage': target_language,
                'confidenceScore': confidence_score,
                'processingTime': processing_time,
                'modelType': model_type,
                'workerName': f"worker_{conversation_id}"
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
            print(f"✅ Traduction terminée: {task_id} -> {target_language}")
            
        except Exception as e:
            print(f"❌ Erreur traduction: {e}")
            
            # Publier une erreur
            error_response = {
                'type': 'translation_error',
                'taskId': task_id,
                'error': str(e),
                'timestamp': time.time()
            }
            
            self.pub_socket.send(json.dumps(error_response).encode('utf-8'))
            self.stats['errors'] += 1
    
    def stop(self):
        """Arrête le Translator simulé"""
        print("🛑 Arrêt du Translator simulé...")
        self.running = False
        
        if self.sub_socket:
            self.sub_socket.close()
        if self.pub_socket:
            self.pub_socket.close()
        if self.context:
            self.context.term()
        
        print("✅ Translator simulé arrêté")
    
    def get_stats(self):
        """Retourne les statistiques"""
        duration = time.time() - self.stats['start_time']
        return {
            **self.stats,
            'duration': duration,
            'translations_per_second': self.stats['translations_completed'] / duration if duration > 0 else 0
        }

class TestClient:
    """Client de test pour valider l'architecture"""
    
    def __init__(self, host: str = "localhost", sub_port: int = 5555, pub_port: int = 5556):
        self.host = host
        self.sub_port = sub_port
        self.pub_port = pub_port
        self.context = zmq.Context()
        
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
    
    def initialize(self):
        """Initialise les sockets ZMQ"""
        print("🔧 Initialisation du client de test...")
        
        # Socket PUB pour envoyer les requêtes
        self.pub_socket = self.context.socket(zmq.PUB)
        self.pub_socket.connect(f"tcp://{self.host}:{self.sub_port}")
        
        # Socket SUB pour recevoir les résultats
        self.sub_socket = self.context.socket(zmq.SUB)
        self.sub_socket.connect(f"tcp://{self.host}:{self.pub_port}")
        self.sub_socket.subscribe('')
        
        print("✅ Client de test initialisé")
    
    def send_test_request(self, conversation_id: str, text: str, target_languages: List[str]):
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
    
    def listen_for_results(self, duration: int = 10):
        """Écoute les résultats pendant une durée donnée"""
        print(f"🎧 Écoute des résultats pendant {duration} secondes...")
        
        start_time = time.time()
        
        while time.time() - start_time < duration:
            try:
                # Attendre un message avec timeout
                try:
                    message = self.sub_socket.recv(zmq.NOBLOCK)
                    self._handle_result(message)
                except zmq.Again:
                    # Pas de message disponible
                    time.sleep(0.1)
                    continue
                    
            except Exception as e:
                print(f"❌ Erreur réception: {e}")
                break
    
    def _handle_result(self, message: bytes):
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
        
        print("\n" + "="*60)
        print("📊 STATISTIQUES DU TEST CLIENT")
        print("="*60)
        print(f"⏱️  Durée: {duration:.2f} secondes")
        print(f"📤 Requêtes envoyées: {self.stats['requests_sent']}")
        print(f"📥 Résultats reçus: {self.stats['results_received']}")
        print(f"❌ Erreurs: {self.stats['errors']}")
        print(f"⏳ Requêtes en cours: {len(self.pending_requests)}")
        
        if self.stats['requests_sent'] > 0:
            success_rate = (self.stats['results_received'] / self.stats['requests_sent']) * 100
            print(f"🎯 Taux de succès: {success_rate:.1f}%")
        
        print("="*60)
    
    def close(self):
        """Ferme les connexions"""
        if self.pub_socket:
            self.pub_socket.close()
        if self.sub_socket:
            self.sub_socket.close()
        if self.context:
            self.context.term()

def main():
    """Fonction principale"""
    print("🧪 Test complet avec Translator simulé")
    print("="*50)
    
    # Configuration
    host = "localhost"
    sub_port = 5555
    pub_port = 5556
    
    print(f"📡 ZMQ: {host}:{sub_port}/{pub_port}")
    print("="*50)
    
    # Démarrer le Translator simulé
    translator = MockTranslator(host, sub_port, pub_port)
    translator.start()
    
    # Attendre que le Translator soit prêt
    time.sleep(1)
    
    # Créer le client de test
    client = TestClient(host, sub_port, pub_port)
    client.initialize()
    
    try:
        # Attendre un peu
        time.sleep(1)
        
        # Envoyer quelques requêtes de test
        print("\n📤 Envoi des requêtes de test...")
        
        # Test 1: Conversation normale
        client.send_test_request("test_normal", "Hello, how are you?", ["fr", "es", "de"])
        time.sleep(0.5)
        
        # Test 2: Conversation "any"
        client.send_test_request("test_any", "Bonjour, comment allez-vous ?", ["en", "es", "it"])
        time.sleep(0.5)
        
        # Test 3: Message long
        client.send_test_request("test_long", "This is a longer message to test the translation performance.", ["fr", "de", "it"])
        time.sleep(0.5)
        
        # Écouter les résultats
        print("\n🎧 Écoute des résultats...")
        client.listen_for_results(15)
        
    except KeyboardInterrupt:
        print("\n🛑 Arrêt demandé par l'utilisateur")
    except Exception as e:
        print(f"❌ Erreur test: {e}")
    finally:
        # Afficher les statistiques
        client.print_stats()
        
        # Statistiques du Translator
        translator_stats = translator.get_stats()
        print("\n" + "="*60)
        print("📊 STATISTIQUES DU TRANSLATOR SIMULÉ")
        print("="*60)
        print(f"⏱️  Durée: {translator_stats['duration']:.2f} secondes")
        print(f"📥 Requêtes reçues: {translator_stats['requests_received']}")
        print(f"✅ Traductions terminées: {translator_stats['translations_completed']}")
        print(f"❌ Erreurs: {translator_stats['errors']}")
        print(f"🚀 Traductions/seconde: {translator_stats['translations_per_second']:.2f}")
        print("="*60)
        
        # Fermer
        client.close()
        translator.stop()

if __name__ == "__main__":
    main()
