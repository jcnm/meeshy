#!/usr/bin/env python3
"""
Script de test pour le serveur ZMQ du translator
"""

import zmq
import json
import time

def test_zmq_translator():
    """Test du serveur ZMQ"""
    print("🔌 Test du serveur ZMQ Translation...")
    
    # Créer le contexte et socket ZMQ
    context = zmq.Context()
    socket = context.socket(zmq.REQ)
    socket.connect("tcp://localhost:5555")
    
    try:
        # Créer une requête de traduction (format attendu par le serveur ZMQ)
        request = {
            "text": "Hello ZMQ!",
            "sourceLanguage": "en",
            "targetLanguage": "fr",
            "modelType": "basic",
            "messageId": "test_001"
        }
        
        print(f"📤 Envoi requête ZMQ: {request}")
        
        # Envoyer la requête
        socket.send_string(json.dumps(request))
        
        # Attendre la réponse (avec timeout)
        poller = zmq.Poller()
        poller.register(socket, zmq.POLLIN)
        
        if poller.poll(5000):  # 5 secondes timeout
            response_str = socket.recv_string()
            response = json.loads(response_str)
            print(f"📥 Réponse ZMQ reçue: {response}")
            
            if response.get("status") == 1:  # 1 = SUCCESS dans le protocole ZMQ
                print("✅ Test ZMQ réussi!")
                print(f"   Message ID: {response.get('messageId')}")
                print(f"   Original:   {request['text']}")
                print(f"   Traduit:    {response.get('translatedText')}")
                print(f"   Modèle:     {response.get('metadata', {}).get('modelUsed')}")
                print(f"   Temps:      {response.get('metadata', {}).get('processingTimeMs')}ms")
            else:
                print(f"❌ Erreur ZMQ: {response.get('metadata', {}).get('error', 'Erreur inconnue')}")
        else:
            print("❌ Timeout - Pas de réponse du serveur ZMQ")
            
    except Exception as e:
        print(f"❌ Erreur lors du test ZMQ: {e}")
    finally:
        socket.close()
        context.term()

if __name__ == "__main__":
    test_zmq_translator()
