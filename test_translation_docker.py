#!/usr/bin/env python3
"""
Test de traduction dans l'environnement Docker avec ZMQ corrigé
"""

import asyncio
import json
import zmq
import zmq.asyncio
import time
import uuid
import requests
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

async def test_docker_zmq_communication():
    """Test de communication ZMQ avec les conteneurs Docker"""
    print("🐳 Test de communication ZMQ avec Docker")
    print("="*50)
    
    context = zmq.asyncio.Context()
    
    try:
        # Socket PUB pour envoyer les requêtes au Translator (port 5557)
        pub_socket = context.socket(zmq.PUB)
        pub_socket.connect("tcp://localhost:5557")
        print("🔌 Connecté au Translator PUB (port 5557)")
        
        # Socket SUB pour recevoir les résultats du Translator (port 5555)
        sub_socket = context.socket(zmq.SUB)
        sub_socket.connect("tcp://localhost:5555")
        sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")
        print("🔌 Connecté au Translator SUB (port 5555)")
        
        # Attendre que les connexions s'établissent
        await asyncio.sleep(2)
        
        # Envoyer plusieurs requêtes de test
        test_messages = [
            "Bonjour tout le monde !",
            "Comment allez-vous ?",
            "Je suis très content de vous rencontrer.",
            "Le temps est magnifique aujourd'hui."
        ]
        
        for i, message in enumerate(test_messages):
            test_request = TranslationRequest(
                taskId=str(uuid.uuid4()),
                messageId=f"test-msg-{i+1}",
                text=message,
                sourceLanguage="fr",
                targetLanguages=["en", "es"],
                conversationId="test-conv-docker",
                modelType="basic",
                timestamp=time.time()
            )
            
            print(f"📤 Envoi requête {i+1}: '{message}'")
            await pub_socket.send(json.dumps(test_request.__dict__).encode('utf-8'))
            
            # Attendre le résultat
            try:
                message_result = await asyncio.wait_for(sub_socket.recv(), timeout=10.0)
                result = json.loads(message_result.decode('utf-8'))
                print(f"📥 Résultat reçu: {result['taskId']}")
                print(f"   Traduction: {result['result']['translatedText']}")
                print(f"   Langue cible: {result['targetLanguage']}")
                print(f"   Confiance: {result['result']['confidenceScore']}")
                print()
            except asyncio.TimeoutError:
                print(f"❌ Timeout pour la requête {i+1}")
                print()
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
    finally:
        if 'pub_socket' in locals():
            pub_socket.close()
        if 'sub_socket' in locals():
            sub_socket.close()
        context.term()

def test_translator_health():
    """Test de santé du service Translator"""
    print("🏥 Test de santé du Translator")
    print("="*30)
    
    try:
        # Test de l'API REST
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print("✅ API REST du Translator accessible")
            health_data = response.json()
            print(f"   Statut: {health_data.get('status', 'unknown')}")
        else:
            print(f"❌ API REST du Translator: {response.status_code}")
    except Exception as e:
        print(f"❌ Erreur API REST: {e}")
    
    try:
        # Test de l'API de traduction
        test_data = {
            "text": "Bonjour",
            "source_language": "fr",
            "target_language": "en"
        }
        response = requests.post("http://localhost:8000/translate", json=test_data, timeout=10)
        if response.status_code == 200:
            print("✅ API de traduction fonctionnelle")
            result = response.json()
            print(f"   Traduction: {result.get('translated_text', 'N/A')}")
        else:
            print(f"❌ API de traduction: {response.status_code}")
    except Exception as e:
        print(f"❌ Erreur API de traduction: {e}")

def test_gateway_health():
    """Test de santé du service Gateway"""
    print("\n🏥 Test de santé du Gateway")
    print("="*30)
    
    try:
        response = requests.get("http://localhost:3000/health", timeout=5)
        if response.status_code == 200:
            print("✅ API du Gateway accessible")
            health_data = response.json()
            print(f"   Statut: {health_data.get('status', 'unknown')}")
        else:
            print(f"❌ API du Gateway: {response.status_code}")
    except Exception as e:
        print(f"❌ Erreur API Gateway: {e}")

async def main():
    """Test complet de l'environnement Docker"""
    print("🧪 Test complet de l'environnement Docker")
    print("="*60)
    
    # Tests de santé
    test_translator_health()
    test_gateway_health()
    
    # Test de communication ZMQ
    print("\n" + "="*60)
    await test_docker_zmq_communication()
    
    print("\n✅ Tests terminés")

if __name__ == "__main__":
    asyncio.run(main())
