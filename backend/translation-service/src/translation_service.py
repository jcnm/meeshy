#!/usr/bin/env python3
"""
Service de traduction gRPC unifié
Utilise le service de traduction NLLB du dossier backend/translator
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

# Ajouter le chemin vers le service de traduction réel
current_dir = Path(__file__).parent
backend_translator_path = current_dir.parent.parent.parent / "backend" / "translator"
sys.path.insert(0, str(backend_translator_path))
sys.path.insert(0, str(current_dir))

# Imports des services gRPC
try:
    import translation_pb2
    import translation_pb2_grpc
    logger.info("✅ Modules gRPC importés avec succès")
except ImportError as e:
    logger.error(f"❌ Erreur d'import gRPC: {e}")
    sys.exit(1)

# Import du service de traduction réel
try:
    from translator import TranslationService
    from config import get_supported_languages, SUPPORTED_LANGUAGES
    REAL_TRANSLATOR_AVAILABLE = True
    logger.info("✅ Service de traduction NLLB importé avec succès")
except ImportError as e:
    logger.error(f"❌ Impossible d'importer le service NLLB: {e}")
    logger.error("Assurez-vous que le dossier backend/translator contient le service de traduction")
    REAL_TRANSLATOR_AVAILABLE = False

class UnifiedTranslationService(translation_pb2_grpc.TranslationServiceServicer):
    """Service de traduction unifié utilisant les vrais modèles NLLB"""
    
    def __init__(self):
        """Initialise le service de traduction"""
        self.translator = None
        self.cache = {}
        self.is_initialized = False
        self.start_time = time.time()
        self.stats = {
            'translations_count': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'errors': 0
        }
        
        # Initialiser le service
        if REAL_TRANSLATOR_AVAILABLE:
            self._initialize_translator()
        else:
            logger.error("❌ Service de traduction non disponible")
    
    def _initialize_translator(self):
        """Initialise le service de traduction NLLB"""
        try:
            logger.info("🔄 Initialisation du service de traduction NLLB...")
            self.translator = TranslationService()
            
            # Initialisation (peut prendre du temps pour charger les modèles)
            logger.info("⏳ Chargement des modèles NLLB... (cela peut prendre quelques minutes)")
            success = self.translator.initialize()
            
            if success:
                self.is_initialized = True
                logger.info("✅ Service de traduction NLLB prêt!")
                return True
            else:
                logger.error("❌ Échec de l'initialisation du service NLLB")
                return False
                
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'initialisation: {e}")
            return False
    
    def _get_cache_key(self, text: str, source_lang: str, target_lang: str) -> str:
        """Génère une clé de cache unique"""
        import hashlib
        key_content = f"{text.strip().lower()}|{source_lang}|{target_lang}"
        return hashlib.sha256(key_content.encode()).hexdigest()[:16]
    
    def TranslateText(self, request, context):
        """Traduit un texte en utilisant le service NLLB"""
        if not REAL_TRANSLATOR_AVAILABLE:
            context.set_code(grpc.StatusCode.UNIMPLEMENTED)
            context.set_details("Service de traduction NLLB non disponible")
            return translation_pb2.TranslateResponse()
            
        if not self.is_initialized:
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details("Service de traduction non initialisé")
            return translation_pb2.TranslateResponse()
        
        # Validation des paramètres
        if not request.text.strip():
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details("Texte vide")
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
                model_used=cached_result['model_used'],
                confidence=cached_result['confidence'],
                cached=True,
                metadata=translation_pb2.TranslationMetadata(
                    input_length=len(request.text),
                    output_length=len(cached_result['translated_text']),
                    word_count=len(request.text.split()),
                    processing_time=0.001,  # Cache très rapide
                    device=cached_result.get('device', 'cache')
                )
            )
        
        try:
            # Traduction avec le service NLLB
            start_time = time.time()
            
            result = self.translator.translate(
                text=request.text,
                source_lang=request.source_language,
                target_lang=request.target_language
            )
            
            processing_time = time.time() - start_time
            
            if not result['success']:
                self.stats['errors'] += 1
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(f"Erreur de traduction: {result['error']}")
                return translation_pb2.TranslateResponse()
            
            # Extraire les informations
            translated_text = result['translated_text']
            metadata = result.get('metadata', {})
            model_used = metadata.get('model_used', 'NLLB')
            device = metadata.get('device', 'unknown')
            
            # Mettre en cache le résultat
            cache_data = {
                'translated_text': translated_text,
                'model_used': model_used,
                'confidence': 0.95,  # Confiance élevée pour NLLB
                'device': device,
                'timestamp': time.time()
            }
            self.cache[cache_key] = cache_data
            
            # Limiter la taille du cache (garder les 1000 dernières traductions)
            if len(self.cache) > 1000:
                oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k]['timestamp'])
                del self.cache[oldest_key]
            
            # Statistiques
            self.stats['translations_count'] += 1
            self.stats['cache_misses'] += 1
            
            logger.info(f"✅ Traduction ({processing_time:.2f}s): '{request.text[:30]}...' "
                       f"({request.source_language}→{request.target_language}) = '{translated_text[:30]}...'")
            
            return translation_pb2.TranslateResponse(
                translated_text=translated_text,
                source_language=request.source_language,
                target_language=request.target_language,
                model_used=model_used,
                confidence=0.95,
                cached=False,
                metadata=translation_pb2.TranslationMetadata(
                    input_length=len(request.text),
                    output_length=len(translated_text),
                    word_count=metadata.get('word_count', len(request.text.split())),
                    processing_time=processing_time,
                    device=device
                )
            )
            
        except Exception as e:
            self.stats['errors'] += 1
            logger.error(f"❌ Erreur de traduction: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Erreur interne: {str(e)}")
            return translation_pb2.TranslateResponse()
    
    def DetectLanguage(self, request, context):
        """Détection de langue basique (peut être améliorée)"""
        text = request.text.lower().strip()
        
        if not text:
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details("Texte vide")
            return translation_pb2.DetectLanguageResponse()
        
        # Patterns de mots courants par langue
        language_patterns = {
            'fr': ['le', 'la', 'les', 'de', 'et', 'à', 'un', 'une', 'être', 'avoir', 'bonjour', 'merci', 'comment', 'vous'],
            'en': ['the', 'and', 'to', 'of', 'a', 'in', 'is', 'it', 'you', 'that', 'hello', 'thank', 'how', 'are'],
            'es': ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'hola', 'gracias', 'cómo', 'está'],
            'de': ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'mit', 'ist', 'hallo', 'danke', 'wie', 'sind'],
            'pt': ['o', 'a', 'de', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'olá', 'obrigado', 'como', 'você'],
            'zh': ['的', '了', '是', '我', '你', '他', '她', '在', '有', '这', '那', '一个', '不', '说'],
            'ja': ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ', 'ある', 'いる']
        }
        
        # Calculer les scores pour chaque langue
        word_scores = {}
        text_words = text.split()
        
        for lang, patterns in language_patterns.items():
            matches = sum(1 for word in text_words if word in patterns)
            if matches > 0:
                word_scores[lang] = matches / len(text_words)
        
        # Patterns de caractères spéciaux
        char_scores = {}
        if any(ord(c) >= 0x4e00 and ord(c) <= 0x9fff for c in text):  # Caractères chinois
            char_scores['zh'] = 0.8
        if any(ord(c) >= 0x3040 and ord(c) <= 0x309f for c in text):  # Hiragana
            char_scores['ja'] = 0.8
        if any(ord(c) >= 0x30a0 and ord(c) <= 0x30ff for c in text):  # Katakana
            char_scores['ja'] = 0.8
        
        # Combiner les scores
        final_scores = {}
        for lang in language_patterns.keys():
            score = word_scores.get(lang, 0) * 0.7 + char_scores.get(lang, 0) * 0.3
            if score > 0:
                final_scores[lang] = min(score, 1.0)
        
        # Déterminer la langue la plus probable
        if not final_scores:
            detected_lang = 'en'  # Fallback par défaut
            confidence = 0.5
        else:
            detected_lang = max(final_scores, key=final_scores.get)
            confidence = min(final_scores[detected_lang] * 1.5, 1.0)
        
        # Créer les alternatives
        alternatives = []
        sorted_scores = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)
        for lang, score in sorted_scores[1:4]:  # Top 3 alternatives
            alternatives.append(translation_pb2.LanguageScore(
                language=lang,
                score=score
            ))
        
        logger.info(f"🔍 Détection de langue: '{text[:30]}...' → {detected_lang} ({confidence:.2f})")
        
        return translation_pb2.DetectLanguageResponse(
            language=detected_lang,
            confidence=confidence,
            alternatives=alternatives
        )
    
    def HealthCheck(self, request, context):
        """Vérification de santé du service"""
        uptime = time.time() - self.start_time
        
        # État des services
        services = []
        
        # Service de traduction
        if self.is_initialized:
            services.append(translation_pb2.ServiceStatus(
                name="nllb_translator",
                status="SERVING",
                message="Service NLLB opérationnel"
            ))
        else:
            services.append(translation_pb2.ServiceStatus(
                name="nllb_translator",
                status="NOT_SERVING",
                message="Service NLLB non initialisé"
            ))
        
        # Cache
        services.append(translation_pb2.ServiceStatus(
            name="cache",
            status="SERVING",
            message=f"{len(self.cache)} traductions en cache"
        ))
        
        # Détails du système
        details = {
            "service": "Meeshy Translation Service",
            "version": "1.0.0",
            "mode": "production",
            "uptime_seconds": uptime,
            "uptime_formatted": f"{int(uptime//3600)}h {int((uptime%3600)//60)}m {int(uptime%60)}s",
            "translator_available": REAL_TRANSLATOR_AVAILABLE,
            "translator_initialized": self.is_initialized,
            "cache_size": len(self.cache),
            "supported_languages": list(SUPPORTED_LANGUAGES.keys()) if REAL_TRANSLATOR_AVAILABLE else [],
            "statistics": self.stats
        }
        
        overall_status = "SERVING" if self.is_initialized else "NOT_SERVING"
        
        return translation_pb2.HealthCheckResponse(
            status=overall_status,
            services=services,
            details=json.dumps(details, indent=2)
        )

def serve():
    """Démarre le serveur gRPC"""
    logger.info("🚀 Démarrage du service de traduction Meeshy...")
    
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
        UnifiedTranslationService(), server
    )
    
    # Écouter sur le port 50051
    listen_addr = '[::]:50051'
    server.add_insecure_port(listen_addr)
    
    # Démarrer le serveur
    server.start()
    
    print("=" * 60)
    print("🌍 MEESHY TRANSLATION SERVICE")
    print("=" * 60)
    print(f"📡 Serveur gRPC: {listen_addr}")
    print(f"🧠 Modèles NLLB: {'✅ Disponibles' if REAL_TRANSLATOR_AVAILABLE else '❌ Non disponibles'}")
    print(f"🔧 Status: {'🟢 Prêt' if REAL_TRANSLATOR_AVAILABLE else '🔴 Indisponible'}")
    print("💡 Langues supportées: fr, en, es, de, pt, zh, ja, ar")
    print("📋 Test avec: python test_interactive.py")
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
