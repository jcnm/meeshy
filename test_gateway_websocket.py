#!/usr/bin/env python3
"""
Test de la Gateway via WebSocket
Se connecte à la Gateway et teste l'envoi de messages et la réception des traductions
"""

import asyncio
import json
import time
import uuid
import websockets
from typing import Dict, List
import logging

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('test_gateway_websocket.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class GatewayWebSocketTest:
    """Test de la Gateway via WebSocket"""
    
    def __init__(self, gateway_url: str = "ws://localhost:3000"):
        self.gateway_url = gateway_url
        self.websocket = None
        self.connected = False
        
        self.stats = {
            'messages_sent': 0,
            'translations_received': 0,
            'websocket_events': 0,
            'errors': 0,
            'start_time': time.time()
        }
        
        # Cache des messages envoyés pour traçabilité
        self.sent_messages = {}
    
    async def connect(self):
        """Se connecte à la Gateway"""
        try:
            logger.info(f"🔌 Connexion à {self.gateway_url}...")
            self.websocket = await websockets.connect(self.gateway_url)
            self.connected = True
            logger.info("✅ Connecté à la Gateway")
            
            # Authentification anonyme
            await self._authenticate_anonymous()
            
        except Exception as e:
            logger.error(f"❌ Erreur connexion: {e}")
            raise
    
    async def _authenticate_anonymous(self):
        """Authentification anonyme"""
        try:
            auth_message = {
                'type': 'authenticate',
                'userId': f'anonymous_{uuid.uuid4().hex[:8]}',
                'isAnonymous': True,
                'systemLanguage': 'fr',
                'regionalLanguage': 'fr',
                'autoTranslateEnabled': True
            }
            
            await self.websocket.send(json.dumps(auth_message))
            logger.info("🔐 Authentification anonyme envoyée")
            
        except Exception as e:
            logger.error(f"❌ Erreur authentification: {e}")
    
    async def send_message(self, conversation_id: str, content: str, original_language: str = 'en'):
        """Envoie un message à la Gateway"""
        try:
            message_id = str(uuid.uuid4())
            
            message = {
                'type': 'send_message',
                'conversationId': conversation_id,
                'content': content,
                'originalLanguage': original_language,
                'messageType': 'text'
            }
            
            await self.websocket.send(json.dumps(message))
            
            # Stocker pour traçabilité
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
    
    async def listen_for_events(self, duration: int = 30):
        """Écoute les événements WebSocket"""
        logger.info(f"🎧 Écoute des événements pendant {duration} secondes...")
        
        start_time = time.time()
        
        while time.time() - start_time < duration and self.connected:
            try:
                # Attendre un message avec timeout
                try:
                    message = await asyncio.wait_for(self.websocket.recv(), timeout=1.0)
                    await self._handle_websocket_event(message)
                except asyncio.TimeoutError:
                    continue
                    
            except Exception as e:
                logger.error(f"❌ Erreur réception WebSocket: {e}")
                break
    
    async def _handle_websocket_event(self, message: str):
        """Traite un événement WebSocket"""
        try:
            data = json.loads(message)
            event_type = data.get('type')
            
            self.stats['websocket_events'] += 1
            
            if event_type == 'message_sent':
                message_id = data.get('messageId')
                status = data.get('status')
                logger.info(f"✅ Message confirmé: {message_id} - {status}")
                
            elif event_type == 'new_message':
                message_id = data.get('id')
                content = data.get('content')
                sender_id = data.get('senderId') or data.get('anonymousSenderId')
                logger.info(f"📨 Nouveau message: {message_id} de {sender_id} - {content[:50]}...")
                
            elif event_type == 'message_translated':
                message_id = data.get('messageId')
                translated_text = data.get('translatedText')
                target_language = data.get('targetLanguage')
                confidence_score = data.get('confidenceScore')
                
                logger.info(f"🌐 Traduction reçue: {message_id} -> {target_language}")
                logger.info(f"   Texte: {translated_text}")
                logger.info(f"   Confiance: {confidence_score}")
                
                self.stats['translations_received'] += 1
                
            elif event_type == 'translation_error':
                error = data.get('error')
                logger.error(f"❌ Erreur traduction: {error}")
                self.stats['errors'] += 1
                
            elif event_type == 'error':
                error_message = data.get('message')
                logger.error(f"❌ Erreur Gateway: {error_message}")
                self.stats['errors'] += 1
                
            else:
                logger.info(f"📡 Événement reçu: {event_type}")
                
        except Exception as e:
            logger.error(f"❌ Erreur traitement événement: {e}")
            self.stats['errors'] += 1
    
    def print_stats(self):
        """Affiche les statistiques"""
        duration = time.time() - self.stats['start_time']
        
        print("\n" + "="*60)
        print("📊 STATISTIQUES DU TEST GATEWAY WEBSOCKET")
        print("="*60)
        print(f"⏱️  Durée: {duration:.2f} secondes")
        print(f"📤 Messages envoyés: {self.stats['messages_sent']}")
        print(f"🌐 Traductions reçues: {self.stats['translations_received']}")
        print(f"📡 Événements WebSocket: {self.stats['websocket_events']}")
        print(f"❌ Erreurs: {self.stats['errors']}")
        
        if self.stats['messages_sent'] > 0:
            success_rate = (self.stats['translations_received'] / self.stats['messages_sent']) * 100
            print(f"🎯 Taux de succès: {success_rate:.1f}%")
        
        print("="*60)
    
    async def close(self):
        """Ferme la connexion"""
        if self.websocket:
            await self.websocket.close()
        self.connected = False
        logger.info("🔌 Connexion fermée")

async def main():
    """Fonction principale"""
    print("🧪 Test de la Gateway via WebSocket")
    print("="*50)
    
    # Configuration
    gateway_url = "ws://localhost:3000"
    
    print(f"🌐 Gateway: {gateway_url}")
    print(f"📝 Logs: test_gateway_websocket.log")
    print("="*50)
    
    test = GatewayWebSocketTest(gateway_url)
    
    try:
        # Se connecter
        await test.connect()
        
        # Attendre un peu
        await asyncio.sleep(2)
        
        # Envoyer quelques messages de test
        print("\n📤 Envoi des messages de test...")
        
        # Test 1: Message normal
        await test.send_message("test_conversation_1", "Hello, how are you today?", "en")
        await asyncio.sleep(2)
        
        # Test 2: Message français
        await test.send_message("test_conversation_2", "Bonjour, comment allez-vous ?", "fr")
        await asyncio.sleep(2)
        
        # Test 3: Message espagnol
        await test.send_message("test_conversation_3", "Hola, ¿cómo estás?", "es")
        await asyncio.sleep(2)
        
        # Test 4: Message long
        await test.send_message("test_conversation_4", "This is a longer message to test the translation performance with more complex content and multiple sentences.", "en")
        await asyncio.sleep(2)
        
        # Écouter les événements
        print("\n🎧 Écoute des événements...")
        await test.listen_for_events(20)
        
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
