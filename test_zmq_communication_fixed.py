#!/usr/bin/env python3
"""
Test de la communication ZMQ entre Gateway et Translator avec la configuration corrigée
"""

import asyncio
import json
import zmq
import zmq.asyncio
import time
import uuid
from dataclasses import dataclass

@dataclass
class TranslationRequest:
    taskId: str
    messageId: str
    text: str
    sourceLanguage: str
    targetLanguages: list
    conversationId: str
    modelType: str
    timestamp: float

async def test_translator_zmq_server():
    """Test du serveur ZMQ du Translator"""
    print("🚀 Test du serveur ZMQ du Translator")
    print("="*50)
    
    context = zmq.asyncio.Context()
    
    try:
        # Socket SUB pour recevoir les requêtes (se lie au port 5557)
        sub_socket = context.socket(zmq.SUB)
        sub_socket.bind("tcp://0.0.0.0:5557")
        sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")
        print("🔌 Socket SUB lié au port 5557 (réception requêtes)")
        
        # Socket PUB pour publier les résultats (se lie au port 5555)
        pub_socket = context.socket(zmq.PUB)
        pub_socket.bind("tcp://0.0.0.0:5555")
        print("🔌 Socket PUB lié au port 5555 (envoi résultats)")
        
        # Attendre que les sockets soient prêts
        await asyncio.sleep(1)
        
        print("✅ Serveur ZMQ du Translator prêt")
        print("🎧 En attente de requêtes...")
        
        # Écouter les requêtes pendant 10 secondes
        start_time = time.time()
        while time.time() - start_time < 10:
            try:
                # Recevoir une requête avec timeout
                message = await asyncio.wait_for(sub_socket.recv(), timeout=1.0)
                request_data = json.loads(message.decode('utf-8'))
                
                print(f"📥 Requête reçue: {request_data}")
                
                # Simuler une traduction
                translated_text = f"Traduit: {request_data['text']}"
                
                # Publier le résultat
                result = {
                    'type': 'translation_completed',
                    'taskId': request_data['taskId'],
                    'result': {
                        'messageId': request_data['messageId'],
                        'translatedText': translated_text,
                        'sourceLanguage': request_data['sourceLanguage'],
                        'targetLanguage': request_data['targetLanguages'][0],
                        'confidenceScore': 0.95,
                        'processingTime': 100,
                        'modelType': request_data['modelType']
                    },
                    'targetLanguage': request_data['targetLanguages'][0],
                    'timestamp': time.time()
                }
                
                await pub_socket.send(json.dumps(result).encode('utf-8'))
                print(f"📤 Résultat envoyé: {result['taskId']}")
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"❌ Erreur: {e}")
                break
        
        print("✅ Test du serveur ZMQ terminé")
        
    except Exception as e:
        print(f"❌ Erreur serveur ZMQ: {e}")
    finally:
        if 'sub_socket' in locals():
            sub_socket.close()
        if 'pub_socket' in locals():
            pub_socket.close()
        context.term()

async def test_gateway_zmq_client():
    """Test du client ZMQ du Gateway"""
    print("\n🚀 Test du client ZMQ du Gateway")
    print("="*50)
    
    context = zmq.asyncio.Context()
    
    try:
        # Socket PUB pour envoyer les requêtes (se connecte au port 5557 du Translator)
        pub_socket = context.socket(zmq.PUB)
        pub_socket.connect("tcp://localhost:5557")
        print("🔌 Socket PUB connecté au port 5557 (envoi requêtes)")
        
        # Socket SUB pour recevoir les résultats (se connecte au port 5555 du Translator)
        sub_socket = context.socket(zmq.SUB)
        sub_socket.connect("tcp://localhost:5555")
        sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")
        print("🔌 Socket SUB connecté au port 5555 (réception résultats)")
        
        # Attendre que les connexions s'établissent
        await asyncio.sleep(1)
        
        # Envoyer une requête de test
        test_request = TranslationRequest(
            taskId=str(uuid.uuid4()),
            messageId="test-msg-123",
            text="Bonjour tout le monde !",
            sourceLanguage="fr",
            targetLanguages=["en"],
            conversationId="test-conv-456",
            modelType="basic",
            timestamp=time.time()
        )
        
        print(f"📤 Envoi requête: {test_request.text}")
        await pub_socket.send(json.dumps(test_request.__dict__).encode('utf-8'))
        
        # Attendre le résultat
        print("⏳ Attente du résultat...")
        try:
            message = await asyncio.wait_for(sub_socket.recv(), timeout=5.0)
            result = json.loads(message.decode('utf-8'))
            print(f"📥 Résultat reçu: {result}")
            print(f"✅ Traduction: {result['result']['translatedText']}")
        except asyncio.TimeoutError:
            print("❌ Timeout - Aucun résultat reçu")
        
    except Exception as e:
        print(f"❌ Erreur client ZMQ: {e}")
    finally:
        if 'pub_socket' in locals():
            pub_socket.close()
        if 'sub_socket' in locals():
            sub_socket.close()
        context.term()

async def main():
    """Test complet de la communication ZMQ"""
    print("🧪 Test de communication ZMQ Gateway ↔ Translator")
    print("="*60)
    
    # Démarrer le serveur Translator en arrière-plan
    translator_task = asyncio.create_task(test_translator_zmq_server())
    
    # Attendre un peu que le serveur démarre
    await asyncio.sleep(2)
    
    # Tester le client Gateway
    await test_gateway_zmq_client()
    
    # Attendre que le serveur se termine
    await translator_task
    
    print("\n✅ Test terminé")

if __name__ == "__main__":
    asyncio.run(main())
