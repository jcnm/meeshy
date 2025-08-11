#!/usr/bin/env python3
"""
Test de communication ZMQ entre Gateway et Translator
"""

import zmq
import json
import time
import uuid

def test_zmq_communication():
    print("🔍 Test de communication ZMQ...")
    
    # Contexte ZMQ
    context = zmq.Context()
    
    # Socket PUB pour envoyer les requêtes (connecter au Translator)
    pub_socket = context.socket(zmq.PUB)
    pub_socket.connect("tcp://127.0.0.1:5556")
    print("✅ Socket PUB connecté au Translator sur port 5556")
    
    # Socket SUB pour recevoir les réponses (connecter au Translator)
    sub_socket = context.socket(zmq.SUB)
    sub_socket.connect("tcp://127.0.0.1:5555")
    sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")
    print("✅ Socket SUB connecté au Translator sur port 5555")
    
    # Attendre un peu pour que les connexions s'établissent
    time.sleep(1)
    
    # Créer une requête de test
    task_id = str(uuid.uuid4())
    request = {
        "task_id": task_id,
        "message_id": "test-msg-123",
        "text": "Hello world",
        "source_language": "en",
        "target_languages": ["fr"],
        "conversation_id": "test-conv",
        "model_type": "basic"
    }
    
    print(f"📤 Envoi de la requête: {json.dumps(request, indent=2)}")
    
    # Envoyer la requête
    pub_socket.send_string(json.dumps(request))
    
    # Attendre la réponse avec timeout
    print("⏳ Attente de la réponse...")
    sub_socket.setsockopt(zmq.RCVTIMEO, 5000)  # 5 secondes de timeout
    
    try:
        response = sub_socket.recv_string()
        print(f"📥 Réponse reçue: {response}")
        
        response_data = json.loads(response)
        print(f"✅ Communication ZMQ réussie!")
        print(f"   Task ID: {response_data.get('task_id')}")
        print(f"   Traduit: {response_data.get('result', {}).get('translated_text', 'N/A')}")
        
    except zmq.error.Again:
        print("❌ Timeout: Aucune réponse reçue du Translator")
        print("   Vérifiez que le Translator est démarré et écoute sur les ports ZMQ")
    except Exception as e:
        print(f"❌ Erreur: {e}")
    
    # Nettoyer
    pub_socket.close()
    sub_socket.close()
    context.term()

if __name__ == "__main__":
    test_zmq_communication()
