#!/usr/bin/env python3
"""
Script de test client gRPC pour le service de traduction Meeshy
"""

import grpc
import sys
import time
from pathlib import Path

# Ajouter le répertoire src au path
sys.path.append(str(Path(__file__).parent / 'src'))

import translation_pb2_grpc
import translation_pb2

def test_grpc_service():
    """Test complet du service gRPC de traduction"""
    
    print("🔍 Test du service gRPC de traduction Meeshy")
    print("=" * 60)
    
    try:
        # Connexion au serveur
        print("📡 Connexion au serveur gRPC (localhost:50051)...")
        channel = grpc.insecure_channel('localhost:50051')
        stub = translation_pb2_grpc.TranslationServiceStub(channel)
        
        # Test 1: Statistiques du service
        print("\n🔸 Test 1: Statistiques du service")
        try:
            stats_request = translation_pb2.ServiceStatsRequest()
            stats_response = stub.GetServiceStats(stats_request)
            print(f"   Service prêt: {stats_response.is_ready}")
            print(f"   Taille cache: {stats_response.cache_size}")
            print(f"   Langues supportées: {stats_response.supported_languages_count}")
            print(f"   Modèles chargés: {stats_response.models_loaded}")
            print(f"   Device: {stats_response.device}")
        except Exception as e:
            print(f"   ❌ Erreur stats: {e}")
        
        # Test 2: Détection de langue
        print("\n🔸 Test 2: Détection de langue")
        test_texts = [
            "Hello world",
            "Bonjour le monde",
            "Hola mundo",
            "Guten Tag"
        ]
        
        for text in test_texts:
            try:
                request = translation_pb2.DetectLanguageRequest(text=text)
                response = stub.DetectLanguage(request)
                print(f"   '{text}' -> {response.language} (confiance: {response.confidence:.2f})")
            except Exception as e:
                print(f"   ❌ Erreur détection '{text}': {e}")
        
        # Test 3: Traduction simple
        print("\n🔸 Test 3: Traduction simple")
        translations = [
            ("Hello world", "fr", "en"),
            ("Bonjour le monde", "en", "fr"),
            ("Comment allez-vous ?", "es", "fr"),
            ("How are you doing today?", "de", "en")
        ]
        
        for text, target_lang, source_lang in translations:
            try:
                request = translation_pb2.TranslateTextRequest(
                    text=text,
                    target_language=target_lang,
                    source_language=source_lang,
                    user_id='test-user'
                )
                response = stub.TranslateText(request)
                print(f"   {source_lang}->{target_lang}: '{text}' -> '{response.translated_text}'")
                print(f"      Modèle: {response.model_tier}, Temps: {response.processing_time_ms}ms, Cache: {response.from_cache}")
            except Exception as e:
                print(f"   ❌ Erreur traduction '{text}': {e}")
        
        # Test 4: Traduction multiple
        print("\n🔸 Test 4: Traduction multiple")
        try:
            request = translation_pb2.TranslateMultipleRequest(
                text="Bonjour, comment allez-vous aujourd'hui ?",
                target_languages=["en", "es", "de"],
                source_language="fr",
                user_id="test-user"
            )
            response = stub.TranslateMultiple(request)
            print(f"   Texte original: '{response.original_text}'")
            print(f"   Langue source: {response.source_language}")
            for translation in response.translations:
                print(f"   -> {translation.target_language}: '{translation.translated_text}'")
                print(f"      Modèle: {translation.model_tier}, Temps: {translation.processing_time_ms}ms")
        except Exception as e:
            print(f"   ❌ Erreur traduction multiple: {e}")
        
        print("\n✅ Tests terminés avec succès !")
        
    except grpc.RpcError as e:
        print(f"❌ Erreur gRPC: {e.code()}: {e.details()}")
        return False
    except Exception as e:
        print(f"❌ Erreur générale: {e}")
        return False
    finally:
        channel.close()
    
    return True

def wait_for_server(max_attempts=30, delay=1):
    """Attend que le serveur soit disponible"""
    print(f"⏳ Attente du serveur gRPC (max {max_attempts}s)...")
    
    for attempt in range(max_attempts):
        try:
            channel = grpc.insecure_channel('localhost:50051')
            stub = translation_pb2_grpc.TranslationServiceStub(channel)
            
            # Test simple de connexion
            request = translation_pb2.DetectLanguageRequest(text="test")
            response = stub.DetectLanguage(request, timeout=2)
            
            channel.close()
            print("✅ Serveur disponible !")
            return True
            
        except Exception:
            if attempt < max_attempts - 1:
                print(f"   Tentative {attempt + 1}/{max_attempts}...")
                time.sleep(delay)
            else:
                print("❌ Serveur non disponible après timeout")
                return False
    
    return False

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Test du service gRPC de traduction")
    parser.add_argument("--wait", action="store_true", help="Attendre que le serveur soit disponible")
    parser.add_argument("--timeout", type=int, default=30, help="Timeout d'attente (secondes)")
    
    args = parser.parse_args()
    
    if args.wait:
        if not wait_for_server(max_attempts=args.timeout):
            sys.exit(1)
    
    success = test_grpc_service()
    sys.exit(0 if success else 1)
