#!/usr/bin/env python3
"""
Script de test pour vérifier le système de fallback de traduction
Teste les différents niveaux de fallback : Premium -> Medium -> Basic -> Simple
"""

import asyncio
import logging
import sys
from pathlib import Path

# Ajouter le répertoire src au path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

from services.quantized_ml_service import QuantizedMLService
from services.simple_translation_service import SimpleTranslationService

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

async def test_quantized_service_fallback():
    """Teste le système de fallback du service quantifié"""
    logger.info("🧪 Test du système de fallback du service quantifié")
    
    # Test avec différents types de modèles
    test_cases = [
        ("premium", "float16"),
        ("medium", "float16"), 
        ("basic", "float16"),
        ("all", "float16")
    ]
    
    for model_type, quantization in test_cases:
        logger.info(f"\n🔍 Test avec model_type={model_type}, quantization={quantization}")
        
        try:
            service = QuantizedMLService(model_type, quantization, max_workers=2)
            initialized = await service.initialize()
            
            if initialized:
                available_models = service.get_available_models()
                logger.info(f"✅ Service initialisé avec succès")
                logger.info(f"📋 Modèles disponibles: {available_models}")
                
                # Test de traduction
                if available_models:
                    test_text = "Hello, how are you?"
                    result = await service.translate(test_text, "en", "fr", available_models[0])
                    logger.info(f"🔄 Traduction test: '{test_text}' -> '{result['translated_text']}'")
                    logger.info(f"📊 Modèle utilisé: {result['model_used']}")
                    logger.info(f"⏱️ Temps de traitement: {result['processing_time']:.3f}s")
                else:
                    logger.warning("⚠️ Aucun modèle disponible pour le test")
            else:
                logger.error("❌ Échec de l'initialisation du service")
                
        except Exception as e:
            logger.error(f"❌ Erreur lors du test: {e}")
        
        finally:
            if 'service' in locals():
                await service.cleanup()

async def test_simple_service():
    """Teste le service de traduction simple"""
    logger.info("\n🧪 Test du service de traduction simple")
    
    try:
        service = SimpleTranslationService()
        
        # Test avec des phrases basiques
        test_cases = [
            ("hello", "en", "fr"),
            ("thanks", "en", "es"),
            ("yes", "en", "de"),
            ("goodbye", "en", "pt"),
            ("This is a complex sentence that should not be translated", "en", "fr")
        ]
        
        for text, source, target in test_cases:
            result = await service.translate(text, source, target)
            logger.info(f"🔄 '{text}' ({source}->{target}) -> '{result['translated_text']}'")
            logger.info(f"📊 Confiance: {result['confidence']}, Temps: {result['processing_time']:.3f}s")
            
    except Exception as e:
        logger.error(f"❌ Erreur lors du test du service simple: {e}")

async def test_fallback_chain():
    """Teste la chaîne complète de fallback"""
    logger.info("\n🧪 Test de la chaîne complète de fallback")
    
    # Simuler un service qui échoue à charger les modèles ML
    logger.info("🔄 Simulation d'un échec de chargement des modèles ML...")
    
    try:
        # Créer un service avec un modèle inexistant pour forcer l'échec
        service = QuantizedMLService("premium", "float16", max_workers=1)
        
        # Modifier temporairement la configuration pour forcer l'échec
        service.model_configs['premium']['model_name'] = "inexistant/model"
        
        initialized = await service.initialize()
        
        if not initialized:
            logger.info("✅ Échec simulé avec succès")
            
            # Passer au service simple
            simple_service = SimpleTranslationService()
            result = await simple_service.translate("hello", "en", "fr")
            logger.info(f"🔄 Fallback vers service simple: 'hello' -> '{result['translated_text']}'")
        else:
            logger.warning("⚠️ Le service s'est initialisé malgré le modèle inexistant")
            
    except Exception as e:
        logger.info(f"✅ Exception attendue lors du test de fallback: {e}")

async def test_user_model_preference():
    """Teste que le système respecte le modèle demandé par l'utilisateur"""
    logger.info("\n🧪 Test du respect du modèle demandé par l'utilisateur")
    
    # Test avec différents modèles demandés
    test_cases = [
        ("premium", "float16"),
        ("medium", "float16"),
        ("basic", "float16")
    ]
    
    for requested_model, quantization in test_cases:
        logger.info(f"\n🔍 Test avec modèle demandé: {requested_model}")
        
        try:
            service = QuantizedMLService(requested_model, quantization, max_workers=2)
            initialized = await service.initialize()
            
            if initialized:
                available_models = service.get_available_models()
                logger.info(f"✅ Service initialisé avec succès")
                logger.info(f"📋 Modèles disponibles: {available_models}")
                logger.info(f"🎯 Modèle actif: {service.model_type}")
                
                # Vérifier que le modèle demandé est bien chargé ou qu'un fallback approprié a été utilisé
                if requested_model in available_models:
                    logger.info(f"✅ Le modèle demandé {requested_model} est disponible")
                else:
                    # Vérifier qu'un modèle de qualité inférieure a été utilisé
                    fallback_order = ['basic', 'medium', 'premium']
                    try:
                        requested_index = fallback_order.index(requested_model)
                        actual_index = fallback_order.index(service.model_type)
                        
                        if actual_index < requested_index:
                            logger.info(f"✅ Fallback approprié: {requested_model} -> {service.model_type} (modèle plus léger)")
                        else:
                            logger.warning(f"⚠️ Fallback inattendu: {requested_model} -> {service.model_type}")
                    except ValueError:
                        logger.warning(f"⚠️ Modèle non reconnu dans l'ordre de fallback: {service.model_type}")
                
                # Test de traduction avec le modèle demandé
                test_text = "Hello, how are you?"
                result = await service.translate(test_text, "en", "fr", requested_model)
                logger.info(f"🔄 Traduction avec modèle demandé '{requested_model}': '{test_text}' -> '{result['translated_text']}'")
                logger.info(f"📊 Modèle effectivement utilisé: {result['model_used']}")
                
            else:
                logger.error("❌ Échec de l'initialisation du service")
                
        except Exception as e:
            logger.error(f"❌ Erreur lors du test: {e}")
        
        finally:
            if 'service' in locals():
                await service.cleanup()

async def test_quality_degradation_fallback():
    """Teste le fallback vers des modèles de qualité inférieure"""
    logger.info("\n🧪 Test du fallback vers des modèles de qualité inférieure")
    
    try:
        # Créer un service avec seulement le modèle basic chargé
        service = QuantizedMLService("basic", "float16", max_workers=1)
        
        # Forcer le chargement de seulement le modèle basic
        service.model_configs['medium']['model_name'] = "inexistant/medium"
        service.model_configs['premium']['model_name'] = "inexistant/premium"
        
        initialized = await service.initialize()
        
        if initialized:
            available_models = service.get_available_models()
            logger.info(f"📋 Modèles disponibles: {available_models}")
            
            # Tester la traduction avec un modèle non disponible
            test_text = "Hello world"
            
            # Demander le modèle premium (non disponible)
            result = await service.translate(test_text, "en", "fr", "premium")
            logger.info(f"🔄 Demande modèle 'premium' -> Modèle utilisé: {result['model_used']}")
            
            # Demander le modèle medium (non disponible)
            result = await service.translate(test_text, "en", "fr", "medium")
            logger.info(f"🔄 Demande modèle 'medium' -> Modèle utilisé: {result['model_used']}")
            
            # Demander le modèle basic (disponible)
            result = await service.translate(test_text, "en", "fr", "basic")
            logger.info(f"🔄 Demande modèle 'basic' -> Modèle utilisé: {result['model_used']}")
            
        else:
            logger.error("❌ Échec de l'initialisation du service")
            
    except Exception as e:
        logger.error(f"❌ Erreur lors du test de dégradation: {e}")
    
    finally:
        if 'service' in locals():
            await service.cleanup()

async def main():
    """Fonction principale de test"""
    logger.info("🚀 Démarrage des tests du système de fallback")
    
    # Test 1: Service quantifié avec fallback automatique
    await test_quantized_service_fallback()
    
    # Test 2: Service de traduction simple
    await test_simple_service()
    
    # Test 3: Chaîne complète de fallback
    await test_fallback_chain()
    
    # Test 4: Respect du modèle demandé par l'utilisateur
    await test_user_model_preference()
    
    # Test 5: Fallback vers des modèles de qualité inférieure
    await test_quality_degradation_fallback()
    
    logger.info("\n✅ Tests du système de fallback terminés")

if __name__ == "__main__":
    asyncio.run(main())
