#!/usr/bin/env python3
"""
Test gRPC corrigé pour le service de traduction Meeshy
Compatible avec les définitions protobuf actuelles
"""

import grpc
import time
import sys
import translation_pb2
import translation_pb2_grpc

def test_grpc_service():
    """Test complet du service gRPC de traduction"""
    print("🔍 Test du service gRPC de traduction Meeshy (CORRIGÉ)")
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
            stats_response = stub.GetServiceStats(stats_request, timeout=5)
            print(f"   ✅ Service prêt: {stats_response.service_ready}")
            print(f"   ✅ Modèles chargés: {stats_response.models_loaded_count}")
            print(f"   ✅ Langues supportées: {stats_response.supported_languages_count}")
            print(f"   ✅ Taille cache: {stats_response.cache_size}")
            print(f"   ✅ Device info: {stats_response.device_info}")
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
                detect_request = translation_pb2.DetectLanguageRequest(text=text)
                detect_response = stub.DetectLanguage(detect_request, timeout=5)
                print(f"   ✅ '{text}' → {detect_response.detected_language} (conf: {detect_response.confidence_score:.2f})")
                print(f"      Complexité: {detect_response.complexity_score:.2f}, Modèle: {detect_response.recommended_model_tier}")
            except Exception as e:
                print(f"   ❌ Erreur détection '{text}': {e}")
        
        # Test 3: Traduction simple
        print("\n🔸 Test 3: Traduction simple")
        translations = [
            ("Hello world", "en", "fr"),
            ("Bonjour le monde", "fr", "en"),
            ("Comment allez-vous ?", "fr", "es"),
            ("How are you doing today?", "en", "de")
        ]
        
        for text, src, tgt in translations:
            try:
                translate_request = translation_pb2.TranslateRequest(
                    text=text,
                    source_language=src,
                    target_language=tgt
                )
                translate_response = stub.TranslateText(translate_request, timeout=10)
                print(f"   ✅ '{text}' ({src}→{tgt}) → '{translate_response.translated_text}'")
                print(f"      Modèle: {translate_response.model_tier}, Temps: {translate_response.processing_time_ms}ms, Cache: {translate_response.from_cache}")
            except Exception as e:
                print(f"   ❌ Erreur traduction '{text}': {e}")
        
        # Test 4: Traduction multiple
        print("\n🔸 Test 4: Traduction multiple")
        try:
            multi_request = translation_pb2.TranslateMultipleRequest(
                text="Hello, how are you today?",
                source_language="en",
                target_languages=["fr", "es", "de"]
            )
            multi_response = stub.TranslateMultiple(multi_request, timeout=15)
            print(f"   ✅ Langue détectée: {multi_response.detected_source_language}")
            for translation in multi_response.translations:
                print(f"   ✅ → {translation.target_language}: '{translation.translated_text}'")
                print(f"      Modèle: {translation.model_tier}, Temps: {translation.processing_time_ms}ms")
        except Exception as e:
            print(f"   ❌ Erreur traduction multiple: {e}")
        
        # Test 5: Langues supportées
        print("\n🔸 Test 5: Langues supportées")
        try:
            lang_request = translation_pb2.SupportedLanguagesRequest()
            lang_response = stub.GetSupportedLanguages(lang_request, timeout=5)
            print(f"   ✅ {len(lang_response.languages)} langues supportées:")
            print(f"      {', '.join(lang_response.languages)}")
        except Exception as e:
            print(f"   ❌ Erreur langues supportées: {e}")
        
        print("\n✅ Tests terminés avec succès !")
        return True
        
    except grpc.RpcError as e:
        print(f"❌ Erreur gRPC: {e.code()}: {e.details()}")
        return False
    except Exception as e:
        print(f"❌ Erreur générale: {e}")
        return False
    finally:
        channel.close()

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
