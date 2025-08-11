#!/usr/bin/env python3
"""
Test de la communication ZMQ entre Gateway et Translator réels
"""

import asyncio
import json
import zmq
import zmq.asyncio
import time
import requests
from dataclasses import dataclass

async def test_gateway_zmq_client():
    """Simule un client ZMQ qui envoie des requêtes au Gateway"""
    print("🚀 Test de communication ZMQ Gateway → Translator")
    print("="*60)
    
    context = zmq.asyncio.Context()
    
    try:
        # Socket pour envoyer des requêtes au Gateway PUB (port 5557)
        pub_socket = context.socket(zmq.PUB)
        pub_socket.connect("tcp://localhost:5557")
        print("🔌 Connecté au Gateway PUB socket (port 5557)")
        
        # Socket pour recevoir les résultats du Gateway SUB (port 5555)
        sub_socket = context.socket(zmq.SUB)
        sub_socket.connect("tcp://localhost:5555")
        sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")
        print("🔌 Connecté au Gateway SUB socket (port 5555)")
        
        # Attendre que les connexions s'établissent
        print("⏳ Attente établissement des connexions...")
        await asyncio.sleep(2)
        
        # Envoyer une requête de traduction
        test_request = {
            "taskId": "test-zmq-123",
            "messageId": "msg-456",
            "text": "Bonjour tout le monde !",
            "sourceLanguage": "fr",
            "targetLanguages": ["en", "es"],
            "conversationId": "test-conv-zmq",
            "modelType": "basic",
            "timestamp": time.time()
        }
        
        print(f"📤 Envoi requête de traduction ZMQ:")
        print(f"   Texte: '{test_request['text']}'")
        print(f"   Source: {test_request['sourceLanguage']}")
        print(f"   Cibles: {test_request['targetLanguages']}")
        
        await pub_socket.send(json.dumps(test_request).encode('utf-8'))
        print("✅ Requête envoyée avec succès")
        
        # Écouter les résultats
        print("\n🎧 Écoute des résultats de traduction...")
        results_received = 0
        expected_results = len(test_request['targetLanguages'])
        timeout_count = 0
        max_timeouts = 10
        
        while results_received < expected_results and timeout_count < max_timeouts:
            try:
                # Timeout de 3 secondes par résultat
                message = await asyncio.wait_for(sub_socket.recv(), timeout=3.0)
                result = json.loads(message.decode('utf-8'))
                
                print(f"\n📥 Résultat reçu:")
                print(f"   Type: {result.get('type', 'N/A')}")
                print(f"   TaskId: {result.get('taskId', 'N/A')}")
                
                if result.get('type') == 'translation_completed':
                    translation_result = result['result']
                    print(f"   ✅ Traduction '{translation_result['targetLanguage']}': '{translation_result['translatedText']}'")
                    print(f"   ⏱️  Temps: {translation_result['processingTime']:.3f}s")
                    print(f"   🎯 Modèle: {translation_result['modelType']}")
                    results_received += 1
                    
                elif result.get('type') == 'translation_error':
                    print(f"   ❌ Erreur: {result.get('error', 'N/A')}")
                    
                timeout_count = 0  # Reset timeout après un résultat
                    
            except asyncio.TimeoutError:
                timeout_count += 1
                print(f"⏰ Timeout {timeout_count}/{max_timeouts}")
                
        print(f"\n🏁 Test terminé: {results_received}/{expected_results} résultats reçus")
        
        if results_received == expected_results:
            print("✅ Communication ZMQ Gateway ↔ Translator fonctionne parfaitement !")
        else:
            print("❌ Communication ZMQ incomplète")
                
    except Exception as e:
        print(f"❌ Erreur test ZMQ: {e}")
        import traceback
        traceback.print_exc()
    finally:
        try:
            pub_socket.close()
            sub_socket.close()
        except:
            pass
        context.term()
        print("✅ Test ZMQ client fermé")

async def test_rest_comparison():
    """Compare avec l'API REST pour vérifier la cohérence"""
    print("\n" + "="*60)
    print("🔄 Test de comparaison REST vs ZMQ")
    print("="*60)
    
    # Test REST direct sur le Translator
    print("📡 Test REST Translator direct...")
    try:
        response = requests.post("http://localhost:8000/translate", 
            json={
                "text": "Bonjour tout le monde !",
                "source_language": "fr",
                "target_language": "en"
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ REST Translator: '{result['translated_text']}'")
        else:
            print(f"❌ REST Translator erreur: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Erreur REST Translator: {e}")
    
    # Test REST via Gateway
    print("📡 Test REST Gateway...")
    try:
        response = requests.post("http://localhost:3000/translate", 
            json={
                "text": "Bonjour tout le monde !",
                "sourceLanguage": "fr",
                "targetLanguage": "en"
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"✅ REST Gateway: '{result['data']['translated_text']}'")
            else:
                print(f"❌ REST Gateway échec: {result}")
        else:
            print(f"❌ REST Gateway erreur: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Erreur REST Gateway: {e}")

async def main():
    """Lance tous les tests"""
    print("🧪 TEST COMPLET COMMUNICATION ZMQ GATEWAY ↔ TRANSLATOR")
    print("📝 Services requis:")
    print("   - Gateway sur port 3000 avec ZMQ PUB:5557, SUB:5555")
    print("   - Translator sur port 8000 avec ZMQ SUB→5557, PUB→5555")
    print()
    
    # Test ZMQ principal
    await test_gateway_zmq_client()
    
    # Test de comparaison REST
    await test_rest_comparison()
    
    print("\n" + "="*60)
    print("🎯 RÉSUMÉ:")
    print("   Si ZMQ fonctionne → Architecture corrigée avec succès ✅")
    print("   Si ZMQ échoue → Il reste des problèmes de configuration ❌")
    print("="*60)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Test interrompu par l'utilisateur")
    except Exception as e:
        print(f"❌ Erreur test: {e}")
        import traceback
        traceback.print_exc()
