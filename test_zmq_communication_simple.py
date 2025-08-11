#!/usr/bin/env python3

import asyncio
import zmq
import zmq.asyncio
import json
import time

async def test_zmq_communication():
    """Test simple de communication ZMQ"""
    print("🧪 Test de communication ZMQ...")
    
    # Créer le contexte ZMQ
    context = zmq.asyncio.Context()
    
    try:
        # Socket PUB pour envoyer une requête (comme la Gateway)
        pub_socket = context.socket(zmq.PUB)
        await pub_socket.connect("tcp://localhost:5555")
        print("✅ Socket PUB connecté au Translator")
        
        # Socket SUB pour recevoir les résultats (comme la Gateway)
        sub_socket = context.socket(zmq.SUB)
        await sub_socket.connect("tcp://localhost:5556")
        await sub_socket.subscribe("")
        print("✅ Socket SUB connecté au Translator")
        
        # Envoyer une requête de test
        test_request = {
            "taskId": "test-task-123",
            "messageId": "test-msg-123",
            "text": "Hello world",
            "sourceLanguage": "en",
            "targetLanguages": ["fr"],
            "conversationId": "test-conv",
            "modelType": "basic",
            "timestamp": time.time()
        }
        
        print(f"📤 Envoi de la requête: {test_request}")
        await pub_socket.send(json.dumps(test_request).encode('utf-8'))
        
        # Attendre une réponse avec timeout
        print("⏳ Attente de la réponse...")
        try:
            # Attendre 5 secondes pour une réponse
            for i in range(50):  # 50 * 0.1 = 5 secondes
                try:
                    message = await asyncio.wait_for(sub_socket.recv(), timeout=0.1)
                    response = json.loads(message.decode('utf-8'))
                    print(f"📥 Réponse reçue: {response}")
                    break
                except asyncio.TimeoutError:
                    continue
            else:
                print("❌ Timeout: Aucune réponse reçue")
        except Exception as e:
            print(f"❌ Erreur réception: {e}")
        
        # Fermer les sockets
        pub_socket.close()
        sub_socket.close()
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        import traceback
        traceback.print_exc()
    finally:
        context.term()

if __name__ == "__main__":
    asyncio.run(test_zmq_communication())
