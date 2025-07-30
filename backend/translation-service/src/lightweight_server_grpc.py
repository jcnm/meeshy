#!/usr/bin/env python3
"""
Serveur gRPC allégé pour tests rapides - Meeshy Translation Service
"""
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
import grpc
from grpc import aio

# Import des fichiers générés par protobuf
import sys
import os
sys.path.append(os.path.dirname(__file__))

try:
    import translation_pb2
    import translation_pb2_grpc
    from lightweight_translation_service import LightweightTranslationService
    logging.info("✅ Imports gRPC réussis")
except ImportError as e:
    logging.error(f"❌ Erreur import: {e}")
    sys.exit(1)

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class LightweightTranslationServicer(translation_pb2_grpc.TranslationServiceServicer):
    """Servicer gRPC allégé"""
    
    def __init__(self):
        self.translation_service = LightweightTranslationService()
        logger.info("✅ Servicer gRPC allégé initialisé")
    
    async def TranslateText(self, request, context):
        """Traduit un texte"""
        try:
            logger.info(f"📨 Requête traduction: '{request.text}' -> {request.target_language}")
            
            result = await self.translation_service.translate_message(
                text=request.text,
                target_language=request.target_language,
                source_language=request.source_language if request.source_language else None,
                user_id=request.user_id if request.user_id else None,
                conversation_id=request.conversation_id if request.conversation_id else None
            )
            
            # Construction de la réponse
            response = translation_pb2.TranslateTextResponse(
                translated_text=result['translated_text'],
                source_language=result['source_language'],
                target_language=result['target_language'],
                success=result['success'],
                confidence_score=result.get('confidence_score', 0.0),
                model_used=result.get('model_used', 'unknown'),
                processing_time=result.get('processing_time', 0.0),
                from_cache=result.get('from_cache', False)
            )
            
            if not result['success']:
                response.error_message = result.get('error', 'Erreur inconnue')
            
            logger.info(f"✅ Traduction réussie: {result['success']}")
            return response
            
        except Exception as e:
            logger.error(f"❌ Erreur TranslateText: {e}")
            return translation_pb2.TranslateTextResponse(
                translated_text='',
                source_language='unknown',
                target_language=request.target_language,
                success=False,
                error_message=str(e),
                confidence_score=0.0,
                processing_time=0.0
            )
    
    async def TranslateMultiple(self, request, context):
        """Traduit plusieurs textes"""
        try:
            logger.info(f"📨 Requête traduction multiple: {len(request.requests)} textes")
            
            # Conversion des requêtes
            translation_requests = []
            for req in request.requests:
                translation_requests.append({
                    'text': req.text,
                    'target_language': req.target_language,
                    'source_language': req.source_language if req.source_language else None,
                    'user_id': req.user_id if req.user_id else None,
                    'conversation_id': req.conversation_id if req.conversation_id else None
                })
            
            # Traduction
            results = await self.translation_service.translate_multiple(translation_requests)
            
            # Construction de la réponse
            translations = []
            for result in results:
                trans = translation_pb2.TranslateTextResponse(
                    translated_text=result['translated_text'],
                    source_language=result['source_language'],
                    target_language=result['target_language'],
                    success=result['success'],
                    confidence_score=result.get('confidence_score', 0.0),
                    model_used=result.get('model_used', 'unknown'),
                    processing_time=result.get('processing_time', 0.0),
                    from_cache=result.get('from_cache', False)
                )
                
                if not result['success']:
                    trans.error_message = result.get('error', 'Erreur inconnue')
                
                translations.append(trans)
            
            response = translation_pb2.TranslateMultipleResponse(
                translations=translations,
                total_count=len(results),
                success_count=sum(1 for r in results if r['success'])
            )
            
            logger.info(f"✅ Traduction multiple réussie: {response.success_count}/{response.total_count}")
            return response
            
        except Exception as e:
            logger.error(f"❌ Erreur TranslateMultiple: {e}")
            return translation_pb2.TranslateMultipleResponse(
                translations=[],
                total_count=0,
                success_count=0
            )
    
    async def DetectLanguage(self, request, context):
        """Détecte la langue d'un texte"""
        try:
            logger.info(f"📨 Requête détection langue: '{request.text[:50]}...'")
            
            detected_lang, confidence = self.translation_service.language_detector.detect_language(request.text)
            
            response = translation_pb2.DetectLanguageResponse(
                language=detected_lang,
                confidence=confidence,
                success=True
            )
            
            logger.info(f"✅ Langue détectée: {detected_lang} (confiance: {confidence})")
            return response
            
        except Exception as e:
            logger.error(f"❌ Erreur DetectLanguage: {e}")
            return translation_pb2.DetectLanguageResponse(
                language='unknown',
                confidence=0.0,
                success=False,
                error_message=str(e)
            )
    
    async def GetServiceStats(self, request, context):
        """Retourne les statistiques du service"""
        try:
            logger.info("📨 Requête statistiques service")
            
            stats = self.translation_service.get_service_stats()
            
            response = translation_pb2.ServiceStatsResponse(
                service_name=stats['service_name'],
                uptime_seconds=stats['uptime_seconds'],
                total_translations=stats['translations_count'],
                cache_hits=stats['cache_hits'],
                cache_misses=stats['cache_misses'],
                cache_hit_rate=stats['cache_hit_rate'],
                errors_count=stats['errors_count'],
                models_loaded=stats['models_loaded'],
                supported_languages=stats['supported_languages'],
                device=stats['device'],
                cache_size=stats['cache_size']
            )
            
            logger.info("✅ Statistiques envoyées")
            return response
            
        except Exception as e:
            logger.error(f"❌ Erreur GetServiceStats: {e}")
            return translation_pb2.ServiceStatsResponse(
                service_name="Error",
                uptime_seconds=0,
                total_translations=0,
                cache_hits=0,
                cache_misses=0,
                cache_hit_rate=0.0,
                errors_count=1,
                models_loaded=[],
                supported_languages=[],
                device="unknown",
                cache_size=0
            )

async def serve():
    """Démarre le serveur gRPC allégé"""
    try:
        logger.info("🚀 Démarrage du serveur gRPC allégé...")
        
        # Création du serveur
        server = aio.server(ThreadPoolExecutor(max_workers=4))
        
        # Ajout du servicer
        servicer = LightweightTranslationServicer()
        translation_pb2_grpc.add_TranslationServiceServicer_to_server(servicer, server)
        
        # Configuration du port
        listen_addr = '[::]:50051'
        server.add_insecure_port(listen_addr)
        
        logger.info(f"✅ Serveur configuré sur {listen_addr}")
        
        # Démarrage
        await server.start()
        logger.info("🎉 Serveur gRPC allégé démarré avec succès!")
        
        # Attente infinie
        await server.wait_for_termination()
        
    except Exception as e:
        logger.error(f"❌ Erreur serveur: {e}")
        raise

if __name__ == "__main__":
    try:
        asyncio.run(serve())
    except KeyboardInterrupt:
        logger.info("🛑 Arrêt du serveur par l'utilisateur")
    except Exception as e:
        logger.error(f"❌ Erreur fatale: {e}")
        sys.exit(1)
