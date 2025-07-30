#!/usr/bin/env python3
"""
Serveur gRPC optimisé pour le service de traduction Meeshy
Initialisation progressive des modèles et gestion des ressources intelligente
"""

import asyncio
import grpc
from concurrent import futures
import logging
import sys
import os
from pathlib import Path
import threading
import time
from typing import Dict, Optional

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ajouter le répertoire src au path
sys.path.append(str(Path(__file__).parent))

# Imports des modules de traduction
try:
    import translation_pb2
    import translation_pb2_grpc
    from advanced_translation_service import MeeshyTranslationService, ModelTier, initialize_translation_service
    logger.info("✅ Imports gRPC et service de traduction réussis")
except ImportError as e:
    logger.error(f"❌ Erreur import gRPC: {e}")
    sys.exit(1)

class OptimizedTranslationServicer(translation_pb2_grpc.TranslationServiceServicer):
    """
    Servicer gRPC optimisé avec initialisation progressive
    """
    
    def __init__(self):
        self.translation_service: Optional[MeeshyTranslationService] = None
        self.initialization_lock = threading.Lock()
        self.is_initializing = False
        self.is_initialized = False
        self.initialization_error: Optional[str] = None
        
        logger.info("🔧 Servicer gRPC créé - Initialisation différée")
    
    def _ensure_service_initialized(self) -> bool:
        """
        Assure que le service de traduction est initialisé
        Utilise un pattern de lazy loading thread-safe
        
        Returns:
            True si le service est prêt, False sinon
        """
        if self.is_initialized and self.translation_service:
            return True
            
        if self.initialization_error:
            logger.error(f"Service en erreur: {self.initialization_error}")
            return False
            
        with self.initialization_lock:
            # Double-check pattern
            if self.is_initialized and self.translation_service:
                return True
                
            if self.is_initializing:
                logger.info("⏳ Initialisation en cours, attente...")
                # Attendre jusqu'à 30 secondes pour l'initialisation
                for _ in range(300):  # 30 secondes max
                    time.sleep(0.1)
                    if self.is_initialized or self.initialization_error:
                        break
                return self.is_initialized and self.translation_service is not None
            
            # Démarrer l'initialisation
            self.is_initializing = True
            logger.info("🚀 Démarrage de l'initialisation du service de traduction...")
            
            try:
                # Initialisation synchrone pour le thread principal
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                self.translation_service = MeeshyTranslationService()
                loop.run_until_complete(self.translation_service.initialize())
                
                self.is_initialized = True
                logger.info("✅ Service de traduction initialisé avec succès")
                return True
                
            except Exception as e:
                error_msg = f"Erreur initialisation service: {e}"
                logger.error(f"❌ {error_msg}")
                self.initialization_error = error_msg
                return False
                
            finally:
                self.is_initializing = False
    
    async def DetectLanguage(self, request, context):
        """Détecte la langue d'un texte"""
        try:
            logger.info(f"🔍 Détection langue pour: '{request.text[:50]}...'")
            
            if not self._ensure_service_initialized():
                context.set_code(grpc.StatusCode.UNAVAILABLE)
                context.set_details("Service de traduction non disponible")
                return translation_pb2.DetectLanguageResponse()
            
            # Détection de langue
            detected_lang, confidence = self.translation_service.language_detector.detect_language(
                request.text
            )
            
            logger.info(f"✅ Langue détectée: {detected_lang} (confiance: {confidence:.2f})")
            
            return translation_pb2.DetectLanguageResponse(
                language=detected_lang,
                confidence=confidence
            )
            
        except Exception as e:
            logger.error(f"❌ Erreur détection langue: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Erreur détection: {str(e)}")
            return translation_pb2.DetectLanguageResponse()
    
    async def TranslateText(self, request, context):
        """Traduit un texte vers une langue cible"""
        try:
            logger.info(f"🔄 Traduction {request.source_language or 'auto'}->{request.target_language}: '{request.text[:50]}...'")
            
            if not self._ensure_service_initialized():
                context.set_code(grpc.StatusCode.UNAVAILABLE)
                context.set_details("Service de traduction non disponible")
                return translation_pb2.TranslateTextResponse()
            
            # Traduction vers une seule langue
            results = await self.translation_service.translate_message(
                text=request.text,
                target_languages=[request.target_language],
                source_language=request.source_language if request.source_language else None
            )
            
            if not results:
                logger.warning("⚠️ Aucun résultat de traduction")
                return translation_pb2.TranslateTextResponse(
                    translated_text=request.text,  # Retourner le texte original
                    source_language=request.source_language or 'fr',
                    confidence_score=0.0,
                    model_tier='basic',
                    processing_time_ms=0,
                    from_cache=False
                )
            
            result = results[0]
            logger.info(f"✅ Traduction réussie en {result.processing_time_ms}ms avec {result.model_tier.value}")
            
            return translation_pb2.TranslateTextResponse(
                translated_text=result.translated_text,
                source_language=result.source_language,
                confidence_score=result.confidence_score,
                model_tier=result.model_tier.value,
                processing_time_ms=result.processing_time_ms,
                from_cache=result.from_cache
            )
            
        except Exception as e:
            logger.error(f"❌ Erreur traduction: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Erreur traduction: {str(e)}")
            return translation_pb2.TranslateTextResponse()
    
    async def TranslateMultiple(self, request, context):
        """Traduit un texte vers plusieurs langues cibles"""
        try:
            target_languages = list(request.target_languages)
            logger.info(f"🔄 Traduction multiple vers {len(target_languages)} langues: {target_languages}")
            
            if not self._ensure_service_initialized():
                context.set_code(grpc.StatusCode.UNAVAILABLE)
                context.set_details("Service de traduction non disponible")
                return translation_pb2.TranslateMultipleResponse()
            
            # Traduction vers plusieurs langues
            results = await self.translation_service.translate_message(
                text=request.text,
                target_languages=target_languages,
                source_language=request.source_language if request.source_language else None
            )
            
            # Convertir les résultats
            translations = []
            for result in results:
                translation = translation_pb2.Translation(
                    target_language=result.target_language,
                    translated_text=result.translated_text,
                    confidence_score=result.confidence_score,
                    model_tier=result.model_tier.value,
                    processing_time_ms=result.processing_time_ms,
                    from_cache=result.from_cache
                )
                translations.append(translation)
            
            # Déterminer la langue source
            source_language = results[0].source_language if results else (request.source_language or 'fr')
            
            logger.info(f"✅ Traduction multiple terminée: {len(translations)} résultats")
            
            return translation_pb2.TranslateMultipleResponse(
                translations=translations,
                source_language=source_language,
                original_text=request.text
            )
            
        except Exception as e:
            logger.error(f"❌ Erreur traduction multiple: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Erreur traduction multiple: {str(e)}")
            return translation_pb2.TranslateMultipleResponse()
    
    async def GetServiceStats(self, request, context):
        """Retourne les statistiques du service"""
        try:
            if not self._ensure_service_initialized():
                return translation_pb2.ServiceStatsResponse(
                    is_ready=False,
                    error_message="Service non initialisé"
                )
            
            stats = self.translation_service.get_stats()
            
            return translation_pb2.ServiceStatsResponse(
                is_ready=True,
                cache_size=stats["cache_size"],
                supported_languages_count=stats["supported_languages"],
                models_loaded=stats["models_loaded"],
                device=stats["device"],
                uptime_seconds=int(time.time())  # Approximation
            )
            
        except Exception as e:
            logger.error(f"❌ Erreur stats service: {e}")
            return translation_pb2.ServiceStatsResponse(
                is_ready=False,
                error_message=str(e)
            )

async def serve():
    """
    Démarre le serveur gRPC avec configuration optimisée
    """
    # Configuration du serveur
    max_workers = 4
    port = 50051
    
    # Options de performance gRPC
    options = [
        ('grpc.keepalive_time_ms', 30000),
        ('grpc.keepalive_timeout_ms', 5000),
        ('grpc.keepalive_permit_without_calls', True),
        ('grpc.http2.max_pings_without_data', 0),
        ('grpc.http2.min_time_between_pings_ms', 10000),
        ('grpc.http2.min_ping_interval_without_data_ms', 300000),
        ('grpc.max_receive_message_length', 4 * 1024 * 1024),  # 4MB
        ('grpc.max_send_message_length', 4 * 1024 * 1024),     # 4MB
    ]
    
    # Créer le serveur
    server = grpc.aio.server(
        futures.ThreadPoolExecutor(max_workers=max_workers),
        options=options
    )
    
    # Ajouter le servicer
    servicer = OptimizedTranslationServicer()
    translation_pb2_grpc.add_TranslationServiceServicer_to_server(servicer, server)
    
    # Configuration de l'écoute
    listen_addr = f'[::]:{port}'
    server.add_insecure_port(listen_addr)
    
    logger.info(f"🚀 Démarrage serveur gRPC sur {listen_addr}")
    logger.info(f"📊 Configuration: {max_workers} workers, initialisation différée")
    
    # Démarrer le serveur
    await server.start()
    logger.info("✅ Serveur gRPC démarré et prêt à recevoir des requêtes")
    
    try:
        await server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("🛑 Arrêt du serveur demandé")
        await server.stop(grace=5)
        logger.info("✅ Serveur arrêté proprement")

def main():
    """Point d'entrée principal"""
    try:
        logger.info("🌟 Démarrage du serveur de traduction gRPC optimisé Meeshy")
        asyncio.run(serve())
    except Exception as e:
        logger.error(f"❌ Erreur fatale: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
