#!/usr/bin/env python3
"""
Test simple de communication ZMQ
"""

import asyncio
import zmq.asyncio
import json
import time

async def test_zmq():
    """Test simple de communication ZMQ"""
    
    print("🧪 Test simple de communication ZMQ")
    
    # 1. Créer le contexte ZMQ
    context = zmq.asyncio.Context()
    
    # 2. Socket SUB pour recevoir des réponses du Translator
    print("🎧 Création socket SUB sur port 5555 (pour recevoir du Translator)")
    sub_socket = context.socket(zmq.SUB)
    sub_socket.connect("tcp://localhost:5555")
    sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")
    
    # 3. Socket PUB temporaire pour envoyer un message
    # On utilise un port différent pour éviter le conflit
    print("📤 Création socket PUB temporaire sur port 5558")
    pub_socket = context.socket(zmq.PUB)
    pub_socket.bind("tcp://localhost:5558")
    

    
    # Attendre un peu
    await asyncio.sleep(1)
    
    # 4. Envoyer un message de test
    test_message = {
        'taskId': 'test-123',
        'messageId': 'msg-456',
        'text': 'Hello world',
        'sourceLanguage': 'en',
        'targetLanguages': ['fr'],
        'conversationId': 'test-conv',
        'modelType': 'basic',
        'timestamp': int(time.time() * 1000)
    }
    
    print(f"📤 Envoi message vers Translator: {test_message}")
    await pub_socket.send(json.dumps(test_message).encode('utf-8'))
    
    # 5. Attendre une réponse
    print("🎧 Attente réponse du Translator...")
    try:
        response = await asyncio.wait_for(sub_socket.recv(), timeout=5.0)
        data = json.loads(response.decode('utf-8'))
        print(f"📥 Réponse reçue du Translator: {data}")
    except asyncio.TimeoutError:
        print("⏰ Aucune réponse reçue dans les 5 secondes")
    
    # 6. Nettoyer
    pub_socket.close()
    sub_socket.close()
    context.term()
    
    print("✅ Test terminé")

if __name__ == "__main__":
    asyncio.run(test_zmq())
