#!/usr/bin/env python3
"""
Test simple de la communication ZMQ avec le Translator en cours d'exécution
"""

import asyncio
import json
import zmq
import zmq.asyncio
import time

async def test_zmq_communication():
    """Test la communication avec le Translator en cours d'exécution"""
    print("🧪 TEST COMMUNICATION ZMQ AVEC TRANSLATOR")
    print("="*50)
    
    context = zmq.asyncio.Context()
    
    try:
        # Socket PUB pour envoyer une requête (simule le Gateway)
        pub_socket = context.socket(zmq.PUB)
        pub_socket.bind("tcp://localhost:5557")  # Gateway PUB port
        print("🔌 Socket PUB lié au port 5557 (Gateway)")
        
        # Socket SUB pour recevoir les résultats (simule le Gateway)
        sub_socket = context.socket(zmq.SUB)
        sub_socket.bind("tcp://localhost:5555")  # Gateway SUB port
        sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")
        print("🔌 Socket SUB lié au port 5555 (Gateway)")
        
        # Attendre que les connexions s'établissent
        print("⏳ Attente établissement des connexions...")
        await asyncio.sleep(3)
        
        # Envoyer une requête de test
        test_request = {
            "taskId": "test-real-communication",
            "messageId": "msg-test-123",
            "text": "Bonjour tout le monde",
            "sourceLanguage": "fr",
            "targetLanguages": ["en", "es"],
            "conversationId": "test-conversation",
            "modelType": "basic",
            "timestamp": time.time()
        }
        
        print(f"📤 Envoi requête: {test_request}")
        await pub_socket.send(json.dumps(test_request).encode('utf-8'))
        print("✅ Requête envoyée avec succès")
        
        # Écouter les résultats
        print("🎧 Écoute des résultats...")
        results_received = 0
        max_results = 2  # On attend 2 résultats (en + es)
        
        while results_received < max_results:
            try:
                # Timeout de 10 secondes
                message = await asyncio.wait_for(sub_socket.recv(), timeout=10.0)
                result = json.loads(message.decode('utf-8'))
                
                print(f"📥 Résultat reçu: {result}")
                
                if result.get('type') == 'translation_completed':
                    translated_text = result['result']['translatedText']
                    target_lang = result['result']['targetLanguage']
                    print(f"✅ Traduction: '{test_request['text']}' -> '{translated_text}' ({target_lang})")
                    results_received += 1
                elif result.get('type') == 'translation_error':
                    print(f"❌ Erreur: {result['error']}")
                    results_received += 1
                    
            except asyncio.TimeoutError:
                print("⏰ Timeout - aucun résultat reçu")
                break
        
        if results_received == max_results:
            print("🎉 TEST RÉUSSI - Communication ZMQ fonctionnelle !")
        else:
            print(f"⚠️ Test partiel - {results_received}/{max_results} résultats reçus")
            
    except Exception as e:
        print(f"❌ Erreur test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        pub_socket.close()
        sub_socket.close()
        context.term()
        print("✅ Test terminé")

if __name__ == "__main__":
    try:
        asyncio.run(test_zmq_communication())
    except KeyboardInterrupt:
        print("\n🛑 Test interrompu par l'utilisateur")
    except Exception as e:
        print(f"❌ Erreur fatale: {e}")
