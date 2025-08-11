#!/usr/bin/env python3
"""
Test de la communication ZMQ corrigée entre Gateway et Translator
"""

import asyncio
import json
import zmq
import zmq.asyncio
import time
from dataclasses import dataclass
from typing import List

@dataclass
class TestMessage:
    messageId: str
    text: str
    sourceLanguage: str
    targetLanguages: List[str]
    conversationId: str

async def test_gateway_simulator():
    """Simule le Gateway - PUB/SUB avec bind"""
    print("🚀 Démarrage du simulateur Gateway...")
    
    context = zmq.asyncio.Context()
    
    try:
        # Socket PUB - le Gateway se lie (bind) pour envoyer les requêtes
        pub_socket = context.socket(zmq.PUB)
        pub_socket.bind("tcp://localhost:5560")  # Port de test différent
        print("🔌 Gateway PUB socket lié au port 5560")
        
        # Socket SUB - le Gateway se lie (bind) pour recevoir les résultats
        sub_socket = context.socket(zmq.SUB)
        sub_socket.bind("tcp://localhost:5561")  # Port de test différent
        sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")
        print("🔌 Gateway SUB socket lié au port 5561")
        
        # Attendre que les connexions s'établissent
        print("⏳ Attente établissement des connexions...")
        await asyncio.sleep(3)
        
        # Envoyer un message de test
        test_message = {
            "taskId": "test-123",
            "messageId": "msg-456",
            "text": "Bonjour le monde",
            "sourceLanguage": "fr",
            "targetLanguages": ["en", "es"],
            "conversationId": "test-conv",
            "modelType": "basic",
            "timestamp": time.time()
        }
        
        print(f"📤 Envoi message de test: {test_message}")
        await pub_socket.send(json.dumps(test_message).encode('utf-8'))
        print("✅ Message envoyé avec succès")
        
        # Écouter les résultats
        print("🎧 Écoute des résultats...")
        timeout_count = 0
        max_timeouts = 3
        
        while timeout_count < max_timeouts:
            try:
                # Timeout de 5 secondes
                message = await asyncio.wait_for(sub_socket.recv(), timeout=5.0)
                result = json.loads(message.decode('utf-8'))
                print(f"📥 Résultat reçu: {result}")
                
                if result.get('type') == 'translation_completed':
                    print(f"✅ Traduction terminée: {result['result']['translatedText']}")
                elif result.get('type') == 'translation_error':
                    print(f"❌ Erreur: {result['error']}")
                    
            except asyncio.TimeoutError:
                timeout_count += 1
                print(f"⏰ Timeout {timeout_count}/{max_timeouts} - aucun résultat reçu")
                
        print("🏁 Gateway simulator terminé")
                
    except Exception as e:
        print(f"❌ Erreur Gateway simulator: {e}")
        import traceback
        traceback.print_exc()
    finally:
        try:
            pub_socket.close()
            sub_socket.close()
        except:
            pass
        context.term()
        print("✅ Gateway simulator fermé")

async def test_translator_simulator():
    """Simule le Translator - PUB/SUB avec connect"""
    print("🚀 Démarrage du simulateur Translator...")
    
    context = zmq.asyncio.Context()
    
    try:
        # Attendre que le Gateway soit prêt
        await asyncio.sleep(1)
        
        # Socket SUB - le Translator se connecte au Gateway PUB
        sub_socket = context.socket(zmq.SUB)
        sub_socket.connect("tcp://localhost:5560")  # Port de test Gateway PUB
        sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")
        print("🔌 Translator SUB socket connecté au Gateway PUB 5560")
        
        # Socket PUB - le Translator se connecte au Gateway SUB
        pub_socket = context.socket(zmq.PUB)
        pub_socket.connect("tcp://localhost:5561")  # Port de test Gateway SUB
        print("🔌 Translator PUB socket connecté au Gateway SUB 5561")
        
        # Attendre que les connexions s'établissent
        print("⏳ Attente établissement des connexions...")
        await asyncio.sleep(2)
        
        print("🎧 Écoute des requêtes...")
        timeout_count = 0
        max_timeouts = 5
        
        while timeout_count < max_timeouts:
            try:
                # Recevoir une requête
                message = await asyncio.wait_for(sub_socket.recv(), timeout=3.0)
                request = json.loads(message.decode('utf-8'))
                print(f"📥 Requête reçue: {request}")
                
                # Simuler le traitement pour chaque langue cible
                for target_lang in request.get('targetLanguages', []):
                    result = {
                        'type': 'translation_completed',
                        'taskId': request['taskId'],
                        'result': {
                            'messageId': request['messageId'],
                            'translatedText': f"[{target_lang.upper()}] {request['text']}",
                            'sourceLanguage': request['sourceLanguage'],
                            'targetLanguage': target_lang,
                            'confidenceScore': 0.95,
                            'processingTime': 0.1,
                            'modelType': request.get('modelType', 'basic'),
                            'workerName': 'test-worker'
                        },
                        'targetLanguage': target_lang,
                        'timestamp': time.time()
                    }
                    
                    print(f"📤 Envoi résultat: {result}")
                    await pub_socket.send(json.dumps(result).encode('utf-8'))
                    await asyncio.sleep(0.1)  # Petit délai entre les résultats
                    
                timeout_count = 0  # Reset timeout count après une requête réussie
                    
            except asyncio.TimeoutError:
                timeout_count += 1
                print(f"⏰ Timeout {timeout_count}/{max_timeouts} - aucune requête reçue")
                
        print("🏁 Translator simulator terminé")
                
    except Exception as e:
        print(f"❌ Erreur Translator simulator: {e}")
        import traceback
        traceback.print_exc()
    finally:
        try:
            sub_socket.close()
            pub_socket.close()
        except:
            pass
        context.term()
        print("✅ Translator simulator fermé")

async def run_test():
    """Lance le test complet"""
    print("="*60)
    print("🧪 TEST COMMUNICATION ZMQ CORRIGÉE")
    print("="*60)
    
    # Lancer les deux simulateurs en parallèle
    await asyncio.gather(
        test_gateway_simulator(),
        test_translator_simulator(),
        return_exceptions=True
    )

if __name__ == "__main__":
    try:
        asyncio.run(run_test())
    except KeyboardInterrupt:
        print("\n🛑 Test interrompu par l'utilisateur")
    except Exception as e:
        print(f"❌ Erreur test: {e}")
        import traceback
        traceback.print_exc()
