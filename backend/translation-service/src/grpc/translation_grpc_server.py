"""
Serveur gRPC pour le service de traduction
Implémente les services définis dans translation.proto
"""

import asyncio
import logging
import time
from concurrent import futures
from typing import Dict, Any

import grpc
from grpc_reflection.v1alpha import reflection

# Import des modules protobuf générés
try:
    import sys
    from pathlib import Path
    current_dir = Path(__file__).parent
    proto_dir = current_dir.parent / "translation"
    sys.path.insert(0, str(proto_dir))
    
    import translation_pb2
    import translation_pb2_grpc
    PROTOBUF_AVAILABLE = True
except ImportError as e:
    logging.error(f"❌ Modules protobuf non disponibles: {e}")
    PROTOBUF_AVAILABLE = False

from services.translation_service import TranslationService
from services.message_service import MessageService

logger = logging.getLogger(__name__)

class TranslationGRPCServicer(translation_pb2_grpc.TranslationServiceServicer):
    """Implémentation du service gRPC de traduction"""
    
    def __init__(self, translation_service: TranslationService, message_service: MessageService):
        self.translation_service = translation_service
        self.message_service = message_service
        self.stats = {
            'requests_count': 0,
            'errors_count': 0
        }
    
    async def TranslateMessage(self, request, context):
        """Traduit un message simple"""
        self.stats['requests_count'] += 1
        
        try:
            # Validation des paramètres
            if not request.text.strip():
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("Empty text")
                return translation_pb2.TranslateResponse()
            
            if not request.target_language:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("Target language required")
                return translation_pb2.TranslateResponse()
            
            # Détecter la langue source si non spécifiée
            source_language = request.source_language
            if not source_language:
                detection_result = await self.translation_service.detect_language(request.text)
                source_language = detection_result['detected_language']
            
            # Effectuer la traduction
            result = await self.translation_service.translate_text(
                text=request.text,
                source_lang=source_language,
                target_lang=request.target_language,
                model_tier=request.model_tier or "basic"
            )
            
            if not result['success']:
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(result.get('error', 'Translation failed'))
                return translation_pb2.TranslateResponse()
            
            # Construire la réponse
            metadata = translation_pb2.BasicMetadata(
                confidence_score=result['metadata'].get('confidence', 0.85),
                from_cache=result['metadata'].get('from_cache', False),
                model_used=result['metadata'].get('model_used', 'basic')
            )
            
            status = translation_pb2.TranslationStatus.SUCCESS
            
            return translation_pb2.TranslateResponse(
                message_id=request.message_id,
                translated_text=result['translated_text'],
                detected_source_language=source_language,
                metadata=metadata,
                status=status
            )
            
        except Exception as e:
            self.stats['errors_count'] += 1
            logger.error(f"❌ Erreur gRPC TranslateMessage: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return translation_pb2.TranslateResponse()
    
    async def TranslateToAllLanguages(self, request, context):
        """Traduit un message vers toutes les langues requises"""
        self.stats['requests_count'] += 1
        
        try:
            # Validation
            if not request.text.strip():
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("Empty text")
                return translation_pb2.TranslateBatchResponse()
            
            if not request.target_languages:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("Target languages required")
                return translation_pb2.TranslateBatchResponse()
            
            # Détecter la langue source si nécessaire
            source_language = request.source_language
            if not source_language:
                detection_result = await self.translation_service.detect_language(request.text)
                source_language = detection_result['detected_language']
            
            # Effectuer les traductions
            result = await self.translation_service.translate_to_multiple_languages(
                text=request.text,
                source_lang=source_language,
                target_languages=list(request.target_languages)
            )
            
            # Construire les traductions pour la réponse
            translations = []
            for target_lang, translation_data in result.get('results', {}).items():
                batch_translation = translation_pb2.BatchTranslation(
                    target_language=target_lang,
                    translated_text=translation_data['translated_text'],
                    confidence_score=translation_data['metadata'].get('confidence', 0.85),
                    from_cache=translation_data['metadata'].get('from_cache', False)
                )
                translations.append(batch_translation)
            
            # Déterminer le statut
            if result['success']:
                if result['successful_translations'] == len(request.target_languages):
                    status = translation_pb2.TranslationStatus.SUCCESS
                else:
                    status = translation_pb2.TranslationStatus.PARTIAL_SUCCESS
            else:
                status = translation_pb2.TranslationStatus.FAILED
            
            return translation_pb2.TranslateBatchResponse(
                message_id=request.message_id,
                detected_source_language=source_language,
                translations=translations,
                status=status
            )
            
        except Exception as e:
            self.stats['errors_count'] += 1
            logger.error(f"❌ Erreur gRPC TranslateToAllLanguages: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return translation_pb2.TranslateBatchResponse()
    
    async def DetectLanguage(self, request, context):
        """Détecte la langue d'un texte"""
        try:
            if not request.text.strip():
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("Empty text")
                return translation_pb2.DetectLanguageResponse()
            
            result = await self.translation_service.detect_language(request.text)
            
            return translation_pb2.DetectLanguageResponse(
                detected_language=result['detected_language'],
                confidence_score=result['confidence'],
                recommended_model_tier="basic"  # TODO: logique de recommandation
            )
            
        except Exception as e:
            logger.error(f"❌ Erreur gRPC DetectLanguage: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return translation_pb2.DetectLanguageResponse()
    
    async def CheckCache(self, request, context):
        """Vérifie si une traduction est en cache"""
        try:
            # Reconstruction de la clé de cache
            # Note: dans un vrai système, le client devrait calculer le hash correctement
            cache_key = f"translation:{request.text_hash}"
            
            cached_result = await self.translation_service.cache_service.get_translation(cache_key)
            
            if cached_result:
                return translation_pb2.CacheCheckResponse(
                    cache_hit=True,
                    cached_translation=cached_result.get('translated_text', ''),
                    ttl_seconds=3600  # TODO: TTL réel
                )
            else:
                return translation_pb2.CacheCheckResponse(
                    cache_hit=False,
                    cached_translation="",
                    ttl_seconds=0
                )
                
        except Exception as e:
            logger.error(f"❌ Erreur gRPC CheckCache: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return translation_pb2.CacheCheckResponse()

class HealthGRPCServicer(translation_pb2_grpc.HealthServiceServicer):
    """Implémentation du service gRPC de santé"""
    
    def __init__(self, translation_service: TranslationService, message_service: MessageService):
        self.translation_service = translation_service
        self.message_service = message_service
        self.start_time = time.time()
    
    async def CheckHealth(self, request, context):
        """Vérification de santé du service"""
        try:
            response_time = int((time.time() - time.time()) * 1000)  # Temps de traitement
            
            # Vérifier l'état des services
            if (self.translation_service.is_initialized and 
                self.message_service.is_initialized):
                status = translation_pb2.HealthStatus.UP
            else:
                status = translation_pb2.HealthStatus.DEGRADED
            
            return translation_pb2.HealthCheckResponse(
                status=status,
                response_time_ms=response_time
            )
            
        except Exception as e:
            logger.error(f"❌ Erreur gRPC CheckHealth: {e}")
            return translation_pb2.HealthCheckResponse(
                status=translation_pb2.HealthStatus.DOWN,
                response_time_ms=0
            )

async def start_grpc_server(
    translation_service: TranslationService, 
    message_service: MessageService, 
    port: int = 50051
):
    """Démarre le serveur gRPC"""
    
    if not PROTOBUF_AVAILABLE:
        logger.error("❌ Impossible de démarrer le serveur gRPC: modules protobuf manquants")
        return
    
    try:
        # Configuration du serveur
        server = grpc.aio.server(
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
        
        # Ajouter les services
        translation_servicer = TranslationGRPCServicer(translation_service, message_service)
        health_servicer = HealthGRPCServicer(translation_service, message_service)
        
        translation_pb2_grpc.add_TranslationServiceServicer_to_server(
            translation_servicer, server
        )
        translation_pb2_grpc.add_HealthServiceServicer_to_server(
            health_servicer, server
        )
        
        # Ajouter la réflection gRPC (pour debugging)
        SERVICE_NAMES = (
            translation_pb2.DESCRIPTOR.services_by_name['TranslationService'].full_name,
            translation_pb2.DESCRIPTOR.services_by_name['HealthService'].full_name,
            reflection.SERVICE_NAME,
        )
        reflection.enable_server_reflection(SERVICE_NAMES, server)
        
        # Démarrer le serveur
        listen_addr = f'[::]:{port}'
        server.add_insecure_port(listen_addr)
        
        await server.start()
        logger.info(f"🔌 Serveur gRPC démarré sur {listen_addr}")
        
        # Maintenir le serveur en vie
        try:
            await server.wait_for_termination()
        except asyncio.CancelledError:
            logger.info("🛑 Arrêt du serveur gRPC...")
            await server.stop(5)  # Grace period de 5 secondes
            
    except Exception as e:
        logger.error(f"❌ Erreur serveur gRPC: {e}")
        raise
