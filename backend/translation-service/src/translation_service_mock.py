#!/usr/bin/env python3
"""
Service de traduction gRPC simplifié pour test
Version mock temporaire
"""

import grpc
import sys
import os
import time
import json
import logging
from concurrent import futures
from pathlib import Path

# Configuration du logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Ajouter le chemin pour les imports
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Imports des services gRPC
try:
    import translation_pb2
    import translation_pb2_grpc
    logger.info("✅ Modules gRPC importés avec succès")
except ImportError as e:
    logger.error(f"❌ Erreur d'import gRPC: {e}")
    sys.exit(1)

# Langues supportées (mock)
SUPPORTED_LANGUAGES = {
    'fr': 'Français',
    'en': 'English',
    'es': 'Español',
    'de': 'Deutsch',
    'pt': 'Português',
    'zh': '中文',
    'ja': '日本語',
    'ar': 'العربية'
}

class MockTranslationService(translation_pb2_grpc.TranslationServiceServicer):
    """Service de traduction mock pour test"""
    
    def __init__(self):
        """Initialise le service mock"""
        self.cache = {}
        self.is_initialized = True
        self.start_time = time.time()
        self.stats = {
            'translations_count': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'errors': 0
        }
        
        # Dictionnaire de traductions mock
        self.mock_translations = {
            ('Hello world', 'en', 'fr'): 'Bonjour le monde',
            ('Hello', 'en', 'fr'): 'Bonjour',
            ('Thank you', 'en', 'fr'): 'Merci',
            ('How are you?', 'en', 'fr'): 'Comment allez-vous ?',
            ('Good morning', 'en', 'fr'): 'Bonjour',
            ('Good evening', 'en', 'fr'): 'Bonsoir',
            ('Yes', 'en', 'fr'): 'Oui',
            ('No', 'en', 'fr'): 'Non',
            ('Please', 'en', 'fr'): 'S\'il vous plaît',
            ('Excuse me', 'en', 'fr'): 'Excusez-moi',
            
            ('Bonjour', 'fr', 'en'): 'Hello',
            ('Merci', 'fr', 'en'): 'Thank you',
            ('Comment ça va?', 'fr', 'en'): 'How are you?',
            ('Au revoir', 'fr', 'en'): 'Goodbye',
            ('Oui', 'fr', 'en'): 'Yes',
            ('Non', 'fr', 'en'): 'No',
            
            ('Hola', 'es', 'en'): 'Hello',
            ('Gracias', 'es', 'en'): 'Thank you',
            ('¿Cómo estás?', 'es', 'en'): 'How are you?',
            
            ('Hello', 'en', 'es'): 'Hola',
            ('Thank you', 'en', 'es'): 'Gracias',
            ('How are you?', 'en', 'es'): '¿Cómo estás?',
            
            ('Guten Tag', 'de', 'en'): 'Good day',
            ('Danke', 'de', 'en'): 'Thank you',
            ('Hello', 'en', 'de'): 'Hallo',
            ('Thank you', 'en', 'de'): 'Danke',
        }
        
        logger.info("✅ Service de traduction mock initialisé")
    
    def _get_cache_key(self, text: str, source_lang: str, target_lang: str) -> str:
        """Génère une clé de cache unique"""
        import hashlib
        key_content = f"{text.strip().lower()}|{source_lang}|{target_lang}"
        return hashlib.sha256(key_content.encode()).hexdigest()[:16]
    
    def _mock_translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """Traduction mock basée sur un dictionnaire ou génération simple"""
        # Vérifier dans les traductions prédéfinies
        key = (text, source_lang, target_lang)
        if key in self.mock_translations:
            return self.mock_translations[key]
        
        # Traduction générique pour les textes inconnus
        if source_lang == target_lang:
            return text
        
        # Traduction mock simple
        prefixes = {
            'fr': '[FR]',
            'en': '[EN]',
            'es': '[ES]',
            'de': '[DE]',
            'pt': '[PT]',
            'zh': '[ZH]',
            'ja': '[JA]',
            'ar': '[AR]'
        }
        
        prefix = prefixes.get(target_lang, '[MOCK]')
        return f"{prefix} {text}"
    
    def TranslateText(self, request, context):
        """Traduit un texte en utilisant le service mock"""
        # Validation des paramètres
        if not request.text.strip():
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details("Texte vide")
            return translation_pb2.TranslateResponse()
        
        if request.source_language not in SUPPORTED_LANGUAGES:
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details(f"Langue source non supportée: {request.source_language}")
            return translation_pb2.TranslateResponse()
            
        if request.target_language not in SUPPORTED_LANGUAGES:
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details(f"Langue cible non supportée: {request.target_language}")
            return translation_pb2.TranslateResponse()
        
        # Vérifier le cache
        cache_key = self._get_cache_key(request.text, request.source_language, request.target_language)
        if cache_key in self.cache:
            self.stats['cache_hits'] += 1
            cached_result = self.cache[cache_key]
            logger.info(f"📦 Cache hit: {request.text[:30]}...")
            
            return translation_pb2.TranslateResponse(
                translated_text=cached_result['translated_text'],
                source_language=request.source_language,
                target_language=request.target_language,
                model_used="mock-nllb-600m",
                confidence=0.95,
                cached=True,
                metadata=translation_pb2.TranslationMetadata(
                    input_length=len(request.text),
                    output_length=len(cached_result['translated_text']),
                    word_count=len(request.text.split()),
                    processing_time=0.001,  # Cache très rapide
                    device="cache"
                )
            )
        
        try:
            # Traduction mock
            start_time = time.time()
            
            translated_text = self._mock_translate(
                request.text,
                request.source_language,
                request.target_language
            )
            
            processing_time = time.time() - start_time
            
            # Simuler un temps de traitement réaliste
            import random
            time.sleep(random.uniform(0.1, 0.5))
            processing_time = time.time() - start_time
            
            # Mise en cache
            self.cache[cache_key] = {
                'translated_text': translated_text,
                'model_used': 'mock-nllb-600m',
                'confidence': random.uniform(0.85, 0.98),
                'device': 'cpu'
            }
            
            self.stats['translations_count'] += 1
            self.stats['cache_misses'] += 1
            
            logger.info(f"✅ Traduction: '{request.text[:30]}...' -> '{translated_text[:30]}...'")
            
            return translation_pb2.TranslateResponse(
                translated_text=translated_text,
                source_language=request.source_language,
                target_language=request.target_language,
                model_used="mock-nllb-600m",
                confidence=random.uniform(0.85, 0.98),
                cached=False,
                metadata=translation_pb2.TranslationMetadata(
                    input_length=len(request.text),
                    output_length=len(translated_text),
                    word_count=len(request.text.split()),
                    processing_time=processing_time,
                    device="cpu"
                )
            )
            
        except Exception as e:
            self.stats['errors'] += 1
            logger.error(f"❌ Erreur de traduction: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Erreur de traduction: {str(e)}")
            return translation_pb2.TranslateResponse()
    
    def DetectLanguage(self, request, context):
        """Détecte la langue d'un texte (mock)"""
        if not request.text.strip():
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details("Texte vide")
            return translation_pb2.DetectLanguageResponse()
        
        # Détection mock basée sur des mots-clés
        text_lower = request.text.lower()
        
        # Patterns de détection simples
        patterns = {
            'fr': ['bonjour', 'merci', 'comment', 'français', 'je', 'tu', 'nous', 'vous'],
            'en': ['hello', 'thank', 'how', 'english', 'the', 'and', 'you', 'are'],
            'es': ['hola', 'gracias', 'cómo', 'español', 'que', 'es', 'de', 'la'],
            'de': ['hallo', 'danke', 'wie', 'deutsch', 'der', 'die', 'das', 'und'],
            'pt': ['olá', 'obrigado', 'como', 'português', 'que', 'de', 'a', 'o'],
        }
        
        scores = {}
        for lang, words in patterns.items():
            score = sum(1 for word in words if word in text_lower) / len(words)
            scores[lang] = score
        
        # Langue la plus probable
        detected_lang = max(scores, key=scores.get) if scores else 'en'
        confidence = max(scores.values()) if scores else 0.5
        
        # Si aucun pattern trouvé, détecter par défaut
        if confidence < 0.1:
            detected_lang = 'en'
            confidence = 0.6
        
        # Alternatives
        alternatives = []
        for lang, score in sorted(scores.items(), key=lambda x: x[1], reverse=True)[:3]:
            if lang != detected_lang:
                alternatives.append(translation_pb2.LanguageScore(
                    language=lang,
                    score=score
                ))
        
        return translation_pb2.DetectLanguageResponse(
            language=detected_lang,
            confidence=confidence,
            alternatives=alternatives
        )
    
    def HealthCheck(self, request, context):
        """Vérifie la santé du service"""
        uptime = time.time() - self.start_time
        
        services = []
        services.append(translation_pb2.ServiceStatus(
            name="translator",
            status="SERVING",
            message=f"{len(self.cache)} traductions en cache"
        ))
        
        # Détails du système
        details = {
            "service": "Meeshy Translation Service (Mock)",
            "version": "1.0.0-mock",
            "mode": "test",
            "uptime_seconds": uptime,
            "uptime_formatted": f"{int(uptime//3600)}h {int((uptime%3600)//60)}m {int(uptime%60)}s",
            "translator_available": True,
            "translator_initialized": self.is_initialized,
            "cache_size": len(self.cache),
            "supported_languages": list(SUPPORTED_LANGUAGES.keys()),
            "statistics": self.stats
        }
        
        return translation_pb2.HealthCheckResponse(
            status="SERVING",
            services=services,
            details=json.dumps(details, indent=2)
        )

def serve():
    """Démarre le serveur gRPC mock"""
    logger.info("🚀 Démarrage du service de traduction Meeshy (Mock)...")
    
    # Configuration du serveur
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ('grpc.keepalive_time_ms', 30000),
            ('grpc.keepalive_timeout_ms', 10000),
            ('grpc.keepalive_permit_without_calls', True),
            ('grpc.http2.max_pings_without_data', 0),
            ('grpc.http2.min_time_between_pings_ms', 10000),
            ('grpc.http2.min_ping_interval_without_data_ms', 300000)
        ]
    )
    
    # Ajouter le service
    translation_pb2_grpc.add_TranslationServiceServicer_to_server(
        MockTranslationService(), server
    )
    
    # Écouter sur le port 50051
    listen_addr = '[::]:50051'
    server.add_insecure_port(listen_addr)
    
    # Démarrer le serveur
    server.start()
    
    print("=" * 60)
    print("🌍 MEESHY TRANSLATION SERVICE (MOCK)")
    print("=" * 60)
    print(f"📡 Serveur gRPC: {listen_addr}")
    print(f"🧠 Mode: Mock/Test")
    print(f"🔧 Status: 🟢 Prêt")
    print("💡 Langues supportées: fr, en, es, de, pt, zh, ja, ar")
    print("📋 Test avec: python test_connectivity.py")
    print("🛑 Arrêt avec: Ctrl+C")
    print("=" * 60)
    
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        print("\n🛑 Arrêt du serveur en cours...")
        server.stop(5)  # Grace period de 5 secondes
        logger.info("✅ Serveur arrêté")

if __name__ == '__main__':
    serve()
