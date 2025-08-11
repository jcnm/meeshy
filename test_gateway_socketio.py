#!/usr/bin/env python3
"""
Test de la Gateway via Socket.IO
Se connecte à la Gateway et teste l'envoi de messages et la réception des traductions
"""

import asyncio
import json
import time
import uuid
import socketio
from typing import Dict, List
import logging

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('test_gateway_socketio.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class GatewaySocketIOTest:
    """Test de la Gateway via Socket.IO"""
    
    def __init__(self, gateway_url: str = "ws://localhost:3000/socket.io/?EIO=4&transport=websocket"):
        self.gateway_url = gateway_url
        self.sio = socketio.AsyncClient()
        self.connected = False
        
        self.stats = {
            'messages_sent': 0,
            'translations_received': 0,
            'socketio_events': 0,
            'errors': 0,
            'start_time': time.time()
        }
        
        # Cache des messages envoyés pour traçabilité
        self.sent_messages = {}
        
        # Configurer les événements Socket.IO
        self._setup_socketio_events()
    
    def _setup_socketio_events(self):
        """Configure les événements Socket.IO"""
        
        @self.sio.event
        async def connect():
            logger.info("✅ Connecté à la Gateway via Socket.IO")
            self.connected = True
            
            # Authentification anonyme
            await self._authenticate_anonymous()
        
        @self.sio.event
        async def disconnect():
            logger.info("🔌 Déconnecté de la Gateway")
            self.connected = False
        
        @self.sio.event
        async def message_sent(data):
            message_id = data.get('messageId')
            status = data.get('status')
            logger.info(f"✅ Message confirmé: {message_id} - {status}")
            self.stats['socketio_events'] += 1
        
        @self.sio.event
        async def new_message(data):
            message_id = data.get('id')
            content = data.get('content')
            sender_id = data.get('senderId') or data.get('anonymousSenderId')
            logger.info(f"📨 Nouveau message: {message_id} de {sender_id} - {content[:50]}...")
            self.stats['socketio_events'] += 1
        
        @self.sio.event
        async def message_translated(data):
            message_id = data.get('messageId')
            translated_text = data.get('translatedText')
            target_language = data.get('targetLanguage')
            confidence_score = data.get('confidenceScore')
            
            logger.info(f"🌐 Traduction reçue: {message_id} -> {target_language}")
            logger.info(f"   Texte: {translated_text}")
            logger.info(f"   Confiance: {confidence_score}")
            
            self.stats['translations_received'] += 1
            self.stats['socketio_events'] += 1
        
        @self.sio.event
        async def translation_error(data):
            error = data.get('error')
            logger.error(f"❌ Erreur traduction: {error}")
            self.stats['errors'] += 1
            self.stats['socketio_events'] += 1
        
        @self.sio.event
        async def error(data):
            error_message = data.get('message')
            logger.error(f"❌ Erreur Gateway: {error_message}")
            self.stats['errors'] += 1
            self.stats['socketio_events'] += 1
    
    async def connect(self):
        """Se connecte à la Gateway"""
        try:
            logger.info(f"🔌 Connexion à {self.gateway_url}...")
            await self.sio.connect("http://localhost:3000")
            
        except Exception as e:
            logger.error(f"❌ Erreur connexion: {e}")
            raise
    
    async def _authenticate_anonymous(self):
        """Authentification anonyme"""
        try:
            auth_data = {
                'userId': f'anonymous_{uuid.uuid4().hex[:8]}',
                'isAnonymous': True,
                'language': 'fr'
            }
            
            await self.sio.emit('authenticate', auth_data)
            logger.info("🔐 Authentification anonyme envoyée")
            
        except Exception as e:
            logger.error(f"❌ Erreur authentification: {e}")
    
    async def send_message(self, conversation_id: str, content: str, original_language: str = 'en'):
        """Envoie un message à la Gateway"""
        try:
            message_data = {
                'conversationId': conversation_id,
                'content': content,
                'originalLanguage': original_language,
                'messageType': 'text'
            }
            
            await self.sio.emit('send_message', message_data)
            
            # Stocker pour traçabilité
            message_id = str(uuid.uuid4())
            self.sent_messages[message_id] = {
                'timestamp': time.time(),
                'content': content,
                'conversation_id': conversation_id
            }
            
            self.stats['messages_sent'] += 1
            logger.info(f"📤 Message envoyé: {content[:50]}...")
            
            return message_id
            
        except Exception as e:
            logger.error(f"❌ Erreur envoi message: {e}")
            self.stats['errors'] += 1
            return None
    
    async def wait_for_translations(self, duration: int = 30):
        """Attend les traductions pendant une durée donnée"""
        logger.info(f"⏳ Attente des traductions pendant {duration} secondes...")
        
        start_time = time.time()
        
        while time.time() - start_time < duration and self.connected:
            await asyncio.sleep(1)
    
    def print_stats(self):
        """Affiche les statistiques"""
        duration = time.time() - self.stats['start_time']
        
        print("\n" + "="*60)
        print("📊 STATISTIQUES DU TEST GATEWAY SOCKET.IO")
        print("="*60)
        print(f"⏱️  Durée: {duration:.2f} secondes")
        print(f"📤 Messages envoyés: {self.stats['messages_sent']}")
        print(f"🌐 Traductions reçues: {self.stats['translations_received']}")
        print(f"📡 Événements Socket.IO: {self.stats['socketio_events']}")
        print(f"❌ Erreurs: {self.stats['errors']}")
        
        if self.stats['messages_sent'] > 0:
            success_rate = (self.stats['translations_received'] / self.stats['messages_sent']) * 100
            print(f"🎯 Taux de succès: {success_rate:.1f}%")
        
        print("="*60)
    
    async def close(self):
        """Ferme la connexion"""
        if self.connected:
            await self.sio.disconnect()
        logger.info("🔌 Connexion fermée")

async def main():
    """Fonction principale"""
    print("🧪 Test de la Gateway via Socket.IO")
    print("="*50)
    
    # Configuration
    gateway_url = "ws://localhost:3000/socket.io/?EIO=4&transport=websocket"
    
    print(f"🌐 Gateway: {gateway_url}")
    print(f"📝 Logs: test_gateway_socketio.log")
    print("="*50)
    
    test = GatewaySocketIOTest(gateway_url)
    
    try:
        # Se connecter
        await test.connect()
        
        # Attendre que la connexion soit établie
        await asyncio.sleep(3)
        
        # Envoyer quelques messages de test
        print("\n📤 Envoi des messages de test...")
        
        # Test 1: Message normal
        await test.send_message("test_conversation_1", "Hello, how are you today?", "en")
        await asyncio.sleep(3)
        
        # Test 2: Message français
        await test.send_message("test_conversation_2", "Bonjour, comment allez-vous ?", "fr")
        await asyncio.sleep(3)
        
        # Test 3: Message espagnol
        await test.send_message("test_conversation_3", "Hola, ¿cómo estás?", "es")
        await asyncio.sleep(3)
        
        # Test 4: Message long
        await test.send_message("test_conversation_4", "This is a longer message to test the translation performance with more complex content and multiple sentences.", "en")
        await asyncio.sleep(3)
        
        # Attendre les traductions
        print("\n⏳ Attente des traductions...")
        await test.wait_for_translations(20)
        
    except KeyboardInterrupt:
        print("\n🛑 Arrêt demandé par l'utilisateur")
    except Exception as e:
        logger.error(f"❌ Erreur test: {e}")
    finally:
        # Afficher les statistiques
        test.print_stats()
        
        # Fermer
        await test.close()

if __name__ == "__main__":
    asyncio.run(main())
