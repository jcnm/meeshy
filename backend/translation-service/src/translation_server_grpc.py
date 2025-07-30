#!/usr/bin/env python3
"""
Serveur gRPC de traduction pour Meeshy
Utilise le service de traduction avancé avec 3 niveaux de modèles
"""

import asyncio
import logging
import os
import sys
from typing import List, Dict, Any
from concurrent import futures
import json

# Imports gRPC
import grpc
from grpc import aio
import translation_pb2
import translation_pb2_grpc

# Import du service de traduction avancé
from advanced_translation_service import (
    translation_service,
    initialize_translation_service,
    TranslationResult,
    ModelTier
)

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MeeshyTranslationServicer(translation_pb2_grpc.TranslationServiceServicer):
    """Servicer gRPC pour les traductions Meeshy"""
    
    def __init__(self):
        self.service_ready = False
        
    async def initialize(self):
        """Initialise le service de traduction"""
        try:
            logger.info("🔄 Initialisation du servicer gRPC...")
            await initialize_translation_service()
            self.service_ready = True
            logger.info("✅ Servicer gRPC prêt")
        except Exception as e:
            logger.error(f"❌ Erreur initialisation servicer: {e}")
            raise
    
    async def TranslateText(self, request, context):
        """
        Traduit un texte simple vers une langue cible
        
        Args:
            request: TranslateRequest
            context: Contexte gRPC
            
        Returns:
            TranslateResponse
        """
        try:
            if not self.service_ready:
                context.set_code(grpc.StatusCode.UNAVAILABLE)
                context.set_details("Service de traduction non initialisé")
                return translation_pb2.TranslateResponse()
            
            logger.info(f"Demande traduction: '{request.text}' -> {request.target_language}")
            
            # Validation des paramètres
            if not request.text.strip():
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("Texte vide")
                return translation_pb2.TranslateResponse()
            
            if not request.target_language:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("Langue cible manquante")
                return translation_pb2.TranslateResponse()
            
            # Traduction
            results = await translation_service.translate_message(
                text=request.text,
                target_languages=[request.target_language],
                source_language=request.source_language if request.source_language else None
            )
            
            if not results:
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details("Échec de la traduction")
                return translation_pb2.TranslateResponse()
            
            result = results[0]
            
            # Construire la réponse
            response = translation_pb2.TranslateResponse(
                translated_text=result.translated_text,
                detected_source_language=result.source_language,
                confidence_score=result.confidence_score,
                model_tier=result.model_tier.value,
                processing_time_ms=result.processing_time_ms,
                from_cache=result.from_cache
            )
            
            logger.info(f"Traduction réussie: {result.model_tier.value} en {result.processing_time_ms}ms")
            return response
            
        except Exception as e:
            logger.error(f"Erreur TranslateText: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Erreur interne: {str(e)}")
            return translation_pb2.TranslateResponse()
    
    async def TranslateMultiple(self, request, context):
        """
        Traduit un texte vers plusieurs langues cibles
        
        Args:
            request: TranslateMultipleRequest
            context: Contexte gRPC
            
        Returns:
            TranslateMultipleResponse
        """
        try:
            if not self.service_ready:
                context.set_code(grpc.StatusCode.UNAVAILABLE)
                context.set_details("Service de traduction non initialisé")
                return translation_pb2.TranslateMultipleResponse()
            
            logger.info(f"Traduction multiple: '{request.text}' -> {list(request.target_languages)}")
            
            # Validation
            if not request.text.strip():
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("Texte vide")
                return translation_pb2.TranslateMultipleResponse()
            
            if not request.target_languages:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("Aucune langue cible")
                return translation_pb2.TranslateMultipleResponse()
            
            # Traduction vers toutes les langues
            results = await translation_service.translate_message(
                text=request.text,
                target_languages=list(request.target_languages),
                source_language=request.source_language if request.source_language else None
            )
            
            # Construire la réponse
            translations = []
            for result in results:
                translation = translation_pb2.TranslationResult(
                    target_language=result.target_language,
                    translated_text=result.translated_text,
                    confidence_score=result.confidence_score,
                    model_tier=result.model_tier.value,
                    processing_time_ms=result.processing_time_ms,
                    from_cache=result.from_cache
                )
                translations.append(translation)
            
            response = translation_pb2.TranslateMultipleResponse(
                translations=translations,
                detected_source_language=results[0].source_language if results else "unknown"
            )
            
            logger.info(f"Traduction multiple réussie: {len(results)} langues")
            return response
            
        except Exception as e:
            logger.error(f"Erreur TranslateMultiple: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Erreur interne: {str(e)}")
            return translation_pb2.TranslateMultipleResponse()
    
    async def DetectLanguage(self, request, context):
        """
        Détecte la langue d'un texte
        
        Args:
            request: DetectLanguageRequest
            context: Contexte gRPC
            
        Returns:
            DetectLanguageResponse
        """
        try:
            if not self.service_ready:
                context.set_code(grpc.StatusCode.UNAVAILABLE)
                context.set_details("Service de traduction non initialisé")
                return translation_pb2.DetectLanguageResponse()
            
            logger.info(f"Détection langue: '{request.text[:50]}...'")
            
            if not request.text.strip():
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("Texte vide")
                return translation_pb2.DetectLanguageResponse()
            
            # Détection de langue
            detected_lang, confidence = translation_service.language_detector.detect_language(request.text)
            
            # Analyse de complexité
            complexity_score = translation_service.complexity_analyzer.analyze_complexity(
                request.text, detected_lang
            )
            model_tier = translation_service.model_manager.get_model_tier(complexity_score)
            
            response = translation_pb2.DetectLanguageResponse(
                detected_language=detected_lang,
                confidence_score=confidence,
                complexity_score=complexity_score,
                recommended_model_tier=model_tier.value
            )
            
            logger.info(f"Langue détectée: {detected_lang} (confiance: {confidence:.2f}, complexité: {complexity_score:.2f})")
            return response
            
        except Exception as e:
            logger.error(f"Erreur DetectLanguage: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Erreur interne: {str(e)}")
            return translation_pb2.DetectLanguageResponse()
    
    async def GetSupportedLanguages(self, request, context):
        """
        Retourne la liste des langues supportées
        
        Args:
            request: Empty
            context: Contexte gRPC
            
        Returns:
            SupportedLanguagesResponse
        """
        try:
            if not self.service_ready:
                context.set_code(grpc.StatusCode.UNAVAILABLE)
                context.set_details("Service de traduction non initialisé")
                return translation_pb2.SupportedLanguagesResponse()
            
            supported_languages = translation_service.get_supported_languages()
            
            response = translation_pb2.SupportedLanguagesResponse(
                languages=supported_languages
            )
            
            logger.info(f"Langues supportées demandées: {len(supported_languages)} langues")
            return response
            
        except Exception as e:
            logger.error(f"Erreur GetSupportedLanguages: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Erreur interne: {str(e)}")
            return translation_pb2.SupportedLanguagesResponse()
    
    async def GetServiceStats(self, request, context):
        """
        Retourne les statistiques du service
        
        Args:
            request: Empty
            context: Contexte gRPC
            
        Returns:
            ServiceStatsResponse
        """
        try:
            if not self.service_ready:
                context.set_code(grpc.StatusCode.UNAVAILABLE)
                context.set_details("Service de traduction non initialisé")
                return translation_pb2.ServiceStatsResponse()
            
            stats = translation_service.get_stats()
            
            response = translation_pb2.ServiceStatsResponse(
                cache_size=stats["cache_size"],
                supported_languages_count=stats["supported_languages"],
                models_loaded_count=stats["models_loaded"],
                device_info=stats["device"],
                service_ready=self.service_ready
            )
            
            logger.info("Statistiques du service demandées")
            return response
            
        except Exception as e:
            logger.error(f"Erreur GetServiceStats: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Erreur interne: {str(e)}")
            return translation_pb2.ServiceStatsResponse()

class HealthCheckServicer(translation_pb2_grpc.HealthCheckServicer):
    """Servicer pour les vérifications de santé"""
    
    def __init__(self, translation_servicer):
        self.translation_servicer = translation_servicer
    
    async def Check(self, request, context):
        """Vérifie l'état de santé du service"""
        try:
            if self.translation_servicer.service_ready:
                status = translation_pb2.HealthCheckResponse.SERVING
                message = "Service opérationnel"
            else:
                status = translation_pb2.HealthCheckResponse.NOT_SERVING
                message = "Service en cours d'initialisation"
            
            return translation_pb2.HealthCheckResponse(
                status=status,
                message=message
            )
            
        except Exception as e:
            logger.error(f"Erreur health check: {e}")
            return translation_pb2.HealthCheckResponse(
                status=translation_pb2.HealthCheckResponse.NOT_SERVING,
                message=f"Erreur: {str(e)}"
            )

async def serve():
    """Lance le serveur gRPC"""
    # Configuration du serveur
    server = aio.server(futures.ThreadPoolExecutor(max_workers=10))
    
    # Ajout des servicers
    translation_servicer = MeeshyTranslationServicer()
    health_servicer = HealthCheckServicer(translation_servicer)
    
    translation_pb2_grpc.add_TranslationServiceServicer_to_server(translation_servicer, server)
    translation_pb2_grpc.add_HealthCheckServicer_to_server(health_servicer, server)
    
    # Configuration du port
    port = int(os.getenv('GRPC_PORT', '50051'))
    listen_addr = f'[::]:{port}'
    server.add_insecure_port(listen_addr)
    
    # Initialisation du service de traduction
    logger.info("🚀 Démarrage du serveur gRPC de traduction...")
    await translation_servicer.initialize()
    
    # Démarrage du serveur
    await server.start()
    logger.info(f"✅ Serveur gRPC démarré sur {listen_addr}")
    logger.info(f"📊 Langues supportées: {len(translation_service.get_supported_languages())}")
    logger.info(f"🤖 Modèles chargés: {len(translation_service.model_manager.models)}")
    logger.info(f"💾 Device: {translation_service.model_manager.device}")
    
    try:
        await server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("🛑 Arrêt du serveur...")
        await server.stop(grace=5)
        logger.info("✅ Serveur arrêté")

if __name__ == '__main__':
    try:
        asyncio.run(serve())
    except Exception as e:
        logger.error(f"❌ Erreur fatale: {e}")
        sys.exit(1)
