#!/usr/bin/env python3
"""
Script de test pour le service de traduction Meeshy
Teste les endpoints API et valide le fonctionnement
"""

import asyncio
import aiohttp
import json
import time

async def test_translation_service():
    """Teste le service de traduction"""
    base_url = "http://localhost:8000"
    
    print("🧪 Test du service de traduction Meeshy")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        # Test 1: Health check
        print("\n1. Test du health check...")
        try:
            async with session.get(f"{base_url}/health") as response:
                if response.status == 200:
                    health = await response.json()
                    print(f"✅ Health check OK: {health.get('status', 'unknown')}")
                    print(f"   Services: {health.get('services', {})}")
                else:
                    print(f"❌ Health check failed: {response.status}")
        except Exception as e:
            print(f"❌ Erreur health check: {e}")
        
        # Test 2: Liste des langues supportées
        print("\n2. Test des langues supportées...")
        try:
            async with session.get(f"{base_url}/languages") as response:
                if response.status == 200:
                    languages = await response.json()
                    print(f"✅ Langues supportées: {len(languages.get('supported_languages', {}))}")
                    for code, name in list(languages.get('supported_languages', {}).items())[:3]:
                        print(f"   {code}: {name}")
                else:
                    print(f"❌ Languages failed: {response.status}")
        except Exception as e:
            print(f"❌ Erreur languages: {e}")
        
        # Test 3: Traduction simple
        print("\n3. Test de traduction simple...")
        test_translations = [
            {"text": "Hello world", "source": "en", "target": "fr", "model": "basic"},
            {"text": "Bonjour le monde", "source": "fr", "target": "en", "model": "medium"},
            {"text": "¿Cómo estás?", "source": "es", "target": "fr", "model": "basic"},
        ]
        
        for i, test in enumerate(test_translations, 1):
            try:
                translation_data = {
                    "text": test["text"],
                    "source_language": test["source"],
                    "target_language": test["target"],
                    "model_type": test["model"]
                }
                
                start_time = time.time()
                async with session.post(f"{base_url}/translate", json=translation_data) as response:
                    end_time = time.time()
                    
                    if response.status == 200:
                        result = await response.json()
                        print(f"✅ Traduction {i}: '{test['text']}' → '{result.get('translated_text', 'ERROR')}'")
                        print(f"   Modèle: {result.get('model_used', 'unknown')} | "
                              f"Temps: {end_time - start_time:.2f}s | "
                              f"Cache: {result.get('from_cache', False)}")
                    else:
                        print(f"❌ Traduction {i} failed: {response.status}")
                        error_text = await response.text()
                        print(f"   Erreur: {error_text[:100]}...")
                        
            except Exception as e:
                print(f"❌ Erreur traduction {i}: {e}")
        
        # Test 4: Statistiques de cache (debug)
        print("\n4. Test des statistiques de cache...")
        try:
            async with session.get(f"{base_url}/debug/cache") as response:
                if response.status == 200:
                    cache_stats = await response.json()
                    print(f"✅ Cache stats: {cache_stats}")
                else:
                    print(f"❌ Cache stats failed: {response.status}")
        except Exception as e:
            print(f"❌ Erreur cache stats: {e}")
        
        # Test 5: Modèles disponibles
        print("\n5. Test des modèles disponibles...")
        try:
            async with session.get(f"{base_url}/models") as response:
                if response.status == 200:
                    models = await response.json()
                    print(f"✅ Modèles disponibles: {len(models.get('available_models', {}))}")
                    for model_type, info in models.get('available_models', {}).items():
                        print(f"   {model_type}: {info.get('name', 'unknown')}")
                else:
                    print(f"❌ Models failed: {response.status}")
        except Exception as e:
            print(f"❌ Erreur models: {e}")
    
    print("\n" + "=" * 50)
    print("🎯 Tests terminés !")

if __name__ == "__main__":
    print("⏳ Démarrage des tests dans 3 secondes...")
    print("   (Assurez-vous que le service est démarré avec ./translator.sh)")
    time.sleep(3)
    
    try:
        asyncio.run(test_translation_service())
    except KeyboardInterrupt:
        print("\n🛑 Tests interrompus par l'utilisateur")
    except Exception as e:
        print(f"\n❌ Erreur critique: {e}")
