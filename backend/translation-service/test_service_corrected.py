#!/usr/bin/env python3
"""
Test rapide du service de traduction corrigé
Valide les principales fonctionnalités selon les instructions Meeshy
"""

import asyncio
import httpx
import json
import time
import sys
from pathlib import Path

# Ajouter le chemin src pour les imports
current_dir = Path(__file__).parent
src_dir = current_dir / "src"
sys.path.insert(0, str(src_dir))

async def test_service_health():
    """Test de santé générale du service"""
    print("🔍 Test de santé du service...")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8000/api/v1/health")
            
            if response.status_code == 200:
                health_data = response.json()
                print(f"✅ Service en bonne santé : {health_data['status']}")
                print(f"   Services actifs: {len(health_data['services'])}")
                return True
            else:
                print(f"❌ Service non disponible (code {response.status_code})")
                return False
                
    except Exception as e:
        print(f"❌ Erreur connexion service: {e}")
        return False

async def test_translation_api():
    """Test de l'API de traduction REST"""
    print("\n🔄 Test API de traduction...")
    
    try:
        async with httpx.AsyncClient() as client:
            # Test traduction simple
            translation_request = {
                "text": "Hello world",
                "source_language": "en",
                "target_language": "fr",
                "model_tier": "basic"
            }
            
            response = await client.post(
                "http://localhost:8000/api/v1/translation/translate",
                json=translation_request,
                timeout=30.0
            )
            
            if response.status_code == 200:
                result = response.json()
                if result['success']:
                    print(f"✅ Traduction réussite: '{translation_request['text']}' → '{result['translated_text']}'")
                    print(f"   Modèle: {result['metadata'].get('model_used', 'unknown')}")
                    print(f"   Temps: {result['metadata'].get('processing_time', 0):.3f}s")
                    return True
                else:
                    print(f"❌ Traduction échouée: {result.get('error', 'unknown')}")
                    return False
            else:
                print(f"❌ Erreur API traduction (code {response.status_code})")
                return False
                
    except Exception as e:
        print(f"❌ Erreur test traduction: {e}")
        return False

async def test_batch_translation():
    """Test de traduction batch"""
    print("\n🔄 Test traduction batch...")
    
    try:
        async with httpx.AsyncClient() as client:
            batch_request = {
                "text": "Good morning everyone!",
                "source_language": "en", 
                "target_languages": ["fr", "es", "de"],
                "model_tier": "basic"
            }
            
            response = await client.post(
                "http://localhost:8000/api/v1/translation/translate/batch",
                json=batch_request,
                timeout=60.0
            )
            
            if response.status_code == 200:
                result = response.json()
                if result['success']:
                    print(f"✅ Traduction batch réussie:")
                    for lang, translation in result['results'].items():
                        print(f"   {lang}: {translation['translated_text']}")
                    print(f"   Langues traitées: {result['metadata']['successful_translations']}/{result['metadata']['total_languages']}")
                    return True
                else:
                    print(f"❌ Traduction batch échouée: {result.get('errors', [])}")
                    return False
            else:
                print(f"❌ Erreur API batch (code {response.status_code})")
                return False
                
    except Exception as e:
        print(f"❌ Erreur test batch: {e}")
        return False

async def test_language_detection():
    """Test de détection de langue"""
    print("\n🔍 Test détection de langue...")
    
    try:
        async with httpx.AsyncClient() as client:
            detection_request = {
                "text": "Bonjour tout le monde, comment allez-vous ?"
            }
            
            response = await client.post(
                "http://localhost:8000/api/v1/translation/detect-language",
                json=detection_request,
                timeout=10.0
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Langue détectée: {result['detected_language']} (confiance: {result['confidence']:.2f})")
                if result.get('alternatives'):
                    print("   Alternatives:", [alt['language'] for alt in result['alternatives'][:2]])
                return True
            else:
                print(f"❌ Erreur détection langue (code {response.status_code})")
                return False
                
    except Exception as e:
        print(f"❌ Erreur test détection: {e}")
        return False

async def test_message_creation():
    """Test de création de message avec traductions"""
    print("\n💬 Test création message avec traductions...")
    
    try:
        async with httpx.AsyncClient() as client:
            message_request = {
                "content": "Hello team, let's start the meeting!",
                "sender_id": "test_user_123",
                "conversation_id": "test_conv_456",
                "source_language": "en",
                "target_languages": ["fr", "es"],
                "message_type": "text",
                "model_tier": "basic"
            }
            
            response = await client.post(
                "http://localhost:8000/api/v1/messages/",
                json=message_request,
                timeout=60.0
            )
            
            if response.status_code == 200:
                result = response.json()
                if result['success']:
                    print(f"✅ Message créé: {result['message_id']}")
                    print(f"   Traductions générées: {len(result['translations'])}")
                    for lang, translation in result['translations'].items():
                        print(f"   {lang}: {translation['translated_text'][:50]}...")
                    return result['message_id']
                else:
                    print(f"❌ Création message échouée: {result.get('error', 'unknown')}")
                    return None
            else:
                print(f"❌ Erreur API message (code {response.status_code})")
                return None
                
    except Exception as e:
        print(f"❌ Erreur test message: {e}")
        return None

async def test_message_retrieval(message_id):
    """Test de récupération de message"""
    if not message_id:
        print("\n⏭️ Test récupération ignoré (pas de message_id)")
        return False
        
    print(f"\n📖 Test récupération message {message_id[:8]}...")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://localhost:8000/api/v1/messages/{message_id}?user_language=fr",
                timeout=10.0
            )
            
            if response.status_code == 200:
                result = response.json()
                if result['success']:
                    message = result['message']
                    print(f"✅ Message récupéré:")
                    print(f"   Contenu (fr): {message['content'][:50]}...")
                    print(f"   Langue originale: {message['original_language']}")
                    print(f"   Traductions disponibles: {len(result['translations'])}")
                    return True
                else:
                    print(f"❌ Récupération échouée: {result.get('error', 'unknown')}")
                    return False
            else:
                print(f"❌ Erreur récupération (code {response.status_code})")
                return False
                
    except Exception as e:
        print(f"❌ Erreur test récupération: {e}")
        return False

async def test_service_stats():
    """Test des statistiques du service"""
    print("\n📊 Test statistiques du service...")
    
    try:
        async with httpx.AsyncClient() as client:
            # Stats de traduction
            response = await client.get("http://localhost:8000/api/v1/translation/stats")
            
            if response.status_code == 200:
                stats = response.json()
                print(f"✅ Statistiques traduction:")
                print(f"   Service: {stats['service_status']}")
                print(f"   Modèles chargés: {stats['models_loaded']}")
                print(f"   Traductions effectuées: {stats['translations_performed']}")
                print(f"   Taux cache hit: {stats['cache_hit_rate']:.2f}")
                return True
            else:
                print(f"❌ Erreur stats (code {response.status_code})")
                return False
                
    except Exception as e:
        print(f"❌ Erreur test stats: {e}")
        return False

async def main():
    """Fonction principale de test"""
    print("=" * 60)
    print("🧪 TEST DU SERVICE DE TRADUCTION MEESHY CORRIGÉ")
    print("=" * 60)
    
    start_time = time.time()
    tests_passed = 0
    total_tests = 7
    
    # Tests séquentiels
    if await test_service_health():
        tests_passed += 1
    
    if await test_translation_api():
        tests_passed += 1
    
    if await test_batch_translation():
        tests_passed += 1
    
    if await test_language_detection():
        tests_passed += 1
    
    message_id = await test_message_creation()
    if message_id:
        tests_passed += 1
    
    if await test_message_retrieval(message_id):
        tests_passed += 1
    
    if await test_service_stats():
        tests_passed += 1
    
    # Résultats
    total_time = time.time() - start_time
    print("\n" + "=" * 60)
    print("📋 RÉSULTATS DES TESTS")
    print("=" * 60)
    print(f"✅ Tests réussis: {tests_passed}/{total_tests}")
    print(f"⏱️ Temps total: {total_time:.2f}s")
    
    if tests_passed == total_tests:
        print("🎉 TOUS LES TESTS SONT PASSÉS!")
        print("✅ Le service de traduction Meeshy est fonctionnel")
    else:
        print(f"⚠️ {total_tests - tests_passed} test(s) ont échoué")
        print("💡 Vérifiez que le service est démarré et que toutes les dépendances sont installées")
    
    print("=" * 60)
    
    return tests_passed == total_tests

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n🛑 Tests interrompus par l'utilisateur")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Erreur fatale lors des tests: {e}")
        sys.exit(1)
