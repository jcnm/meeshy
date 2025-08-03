#!/usr/bin/env python3
"""
Test complet pour le service de traduction Meeshy
Teste à la fois FastAPI (REST) et ZMQ
"""

import asyncio
import aiohttp
import zmq
import zmq.asyncio
import sys
import json
import time

async def test_health_endpoint():
    """Test des endpoints de santé FastAPI"""
    try:
        async with aiohttp.ClientSession() as session:
            print("🔍 Test des endpoints de santé FastAPI...")
            
            # Test health
            async with session.get('http://localhost:8000/health') as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ Health check: {json.dumps(data, indent=2)}")
                else:
                    print(f"❌ Health check failed: {resp.status}")
                    return False
            
            # Test ready
            print("🔍 Test readiness...")
            async with session.get('http://localhost:8000/ready') as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ Readiness check: {json.dumps(data, indent=2)}")
                elif resp.status == 503:
                    data = await resp.json()
                    print(f"⚠️ Service not ready: {json.dumps(data, indent=2)}")
                else:
                    print(f"❌ Readiness check failed: {resp.status}")
                    return False
            
            # Test alive
            print("🔍 Test liveness...")
            async with session.get('http://localhost:8000/live') as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ Liveness check: {json.dumps(data, indent=2)}")
                else:
                    print(f"❌ Liveness check failed: {resp.status}")
                    return False
                    
            return True
            
    except Exception as e:
        print(f"❌ Erreur lors du test FastAPI: {e}")
        return False

async def test_fastapi_translation():
    """Test de traduction via REST API"""
    try:
        async with aiohttp.ClientSession() as session:
            print("\n🔍 Test de traduction FastAPI...")
            
            test_cases = [
                {
                    "text": "Hello world",
                    "source_language": "en",
                    "target_language": "fr",
                    "model_type": "basic"
                },
                {
                    "text": "Good morning",
                    "source_language": "en", 
                    "target_language": "fr",
                    "model_type": "basic"
                }
            ]
            
            for i, payload in enumerate(test_cases, 1):
                print(f"🧪 Test {i}: {payload['text']}")
                
                async with session.post('http://localhost:8000/translate', json=payload) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        print(f"✅ Translation {i}: {data['original_text']} → {data['translated_text']}")
                        print(f"   Model: {data['model_used']}, Confidence: {data['confidence_score']:.2f}")
                    elif resp.status == 503:
                        print(f"⚠️ Service not ready for translation {i}")
                        return False
                    else:
                        print(f"❌ Translation test {i} failed: {resp.status}")
                        text = await resp.text()
                        print(f"Response: {text}")
                        return False
                        
            return True
                    
    except Exception as e:
        print(f"❌ Erreur lors du test de traduction FastAPI: {e}")
        return False

async def test_zmq_translation():
    """Test de traduction via ZMQ"""
    try:
        print("\n🔍 Test de traduction ZMQ...")
        
        # Créer contexte ZMQ
        context = zmq.asyncio.Context()
        socket = context.socket(zmq.REQ)
        socket.connect("tcp://localhost:5555")
        
        test_cases = [
            {
                "text": "Hello Meeshy",
                "sourceLanguage": "en",
                "targetLanguage": "fr",
                "modelType": "basic",
                "messageId": "zmq_test_1"
            },
            {
                "text": "Thank you",
                "sourceLanguage": "en",
                "targetLanguage": "fr", 
                "modelType": "basic",
                "messageId": "zmq_test_2"
            }
        ]
        
        for i, request in enumerate(test_cases, 1):
            print(f"🧪 ZMQ Test {i}: {request['text']}")
            
            # Envoyer requête
            request_json = json.dumps(request)
            await socket.send(request_json.encode('utf-8'))
            
            # Recevoir réponse
            response_bytes = await socket.recv()
            response_data = json.loads(response_bytes.decode('utf-8'))
            
            if response_data.get('status') == 1:
                print(f"✅ ZMQ Translation {i}: {request['text']} → {response_data['translatedText']}")
                print(f"   Model: {response_data['metadata']['modelUsed']}, " +
                      f"Confidence: {response_data['metadata']['confidenceScore']:.2f}")
            else:
                print(f"❌ ZMQ Translation {i} failed: {response_data}")
                return False
        
        # Fermer socket
        socket.close()
        context.term()
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du test ZMQ: {e}")
        return False

async def test_api_info_endpoints():
    """Test des endpoints d'information"""
    try:
        async with aiohttp.ClientSession() as session:
            print("\n� Test des endpoints d'information...")
            
            # Test languages
            async with session.get('http://localhost:8000/languages') as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ Languages: {len(data['supported_languages'])} langues supportées")
                else:
                    print(f"❌ Languages endpoint failed: {resp.status}")
                    return False
            
            # Test models
            async with session.get('http://localhost:8000/models') as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ Models: {len(data['available_models'])} modèles disponibles")
                else:
                    print(f"❌ Models endpoint failed: {resp.status}")
                    return False
                    
            return True
            
    except Exception as e:
        print(f"❌ Erreur lors du test des endpoints info: {e}")
        return False

async def main():
    """Tests principaux"""
    print("�🚀 Début des tests complets du service de traduction Meeshy")
    print("=" * 60)
    
    tests_results = {}
    
    # Test 1: Santé des services
    print("📋 PHASE 1: Tests de santé")
    tests_results['health'] = await test_health_endpoint()
    
    # Test 2: API d'information
    if tests_results['health']:
        print("\n📋 PHASE 2: Tests d'information")
        tests_results['info'] = await test_api_info_endpoints()
    else:
        tests_results['info'] = False
    
    # Test 3: Traduction FastAPI
    if tests_results['health']:
        print("\n📋 PHASE 3: Tests de traduction FastAPI")
        tests_results['fastapi_translation'] = await test_fastapi_translation()
    else:
        tests_results['fastapi_translation'] = False
    
    # Test 4: Traduction ZMQ
    if tests_results['health']:
        print("\n📋 PHASE 4: Tests de traduction ZMQ")
        tests_results['zmq_translation'] = await test_zmq_translation()
    else:
        tests_results['zmq_translation'] = False
    
    # Résultats finaux
    print("\n" + "=" * 60)
    print("📊 RÉSULTATS DES TESTS:")
    print("=" * 60)
    
    total_tests = len(tests_results)
    passed_tests = sum(tests_results.values())
    
    for test_name, result in tests_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:20} : {status}")
    
    print(f"\nRésultat global: {passed_tests}/{total_tests} tests réussis")
    
    if passed_tests == total_tests:
        print("🎉 Tous les tests ont réussi ! Service complètement fonctionnel.")
        return 0
    elif passed_tests > 0:
        print("⚠️ Certains tests ont échoué. Service partiellement fonctionnel.")
        return 1
    else:
        print("❌ Tous les tests ont échoué. Service non fonctionnel.")
        return 2

if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n🛑 Tests interrompus par l'utilisateur")
        sys.exit(130)
