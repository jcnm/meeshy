#!/usr/bin/env python3
"""
Script de test pour vérifier le système de partage de modèles
Teste l'optimisation mémoire quand plusieurs types utilisent le même modèle
"""

import asyncio
import logging
import sys
from pathlib import Path

# Ajouter le répertoire src au path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

from services.quantized_ml_service import QuantizedMLService

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

async def test_model_sharing():
    """Teste le système de partage de modèles"""
    logger.info("🧪 Test du système de partage de modèles")
    
    # Configuration avec modèles partagés
    # Simuler une configuration où basic et medium utilisent le même modèle
    service = QuantizedMLService("all", "float16", max_workers=2)
    
    # Modifier la configuration pour simuler des modèles partagés
    service.model_configs['basic']['model_name'] = 'facebook/nllb-200-distilled-600M'
    service.model_configs['medium']['model_name'] = 'facebook/nllb-200-distilled-600M'
    service.model_configs['premium']['model_name'] = 'facebook/nllb-200-distilled-1.3B'
    
    logger.info("🔧 Configuration de test:")
    for model_type, config in service.model_configs.items():
        logger.info(f"  {model_type}: {config['model_name']}")
    
    try:
        # Initialiser le service
        initialized = await service.initialize()
        
        if initialized:
            # Obtenir les statistiques
            stats = service.get_stats()
            
            logger.info("\n📊 Statistiques de partage:")
            logger.info(f"  Modèles partagés: {stats['shared_models_count']}")
            logger.info(f"  Types de modèles: {stats['total_model_types']}")
            logger.info(f"  Modèles uniques chargés: {stats['unique_models_loaded']}")
            logger.info(f"  Modèles économisés: {stats['models_saved']}")
            logger.info(f"  Mémoire économisée (estimée): {stats['estimated_memory_saved_mb']:.1f} MB")
            
            # Afficher les détails des modèles partagés
            if stats['shared_models_info']:
                logger.info("\n🔄 Modèles partagés:")
                for model_name, info in stats['shared_models_info'].items():
                    logger.info(f"  {model_name}: utilisé par {info['users']}")
            
            # Tester les traductions avec différents types
            test_text = "Hello, how are you?"
            
            logger.info("\n🔄 Tests de traduction:")
            for model_type in ['basic', 'medium', 'premium']:
                if model_type in service.models:
                    result = await service.translate(test_text, "en", "fr", model_type)
                    logger.info(f"  {model_type}: '{test_text}' -> '{result['translated_text']}'")
                    logger.info(f"    Modèle utilisé: {result['model_used']}")
                else:
                    logger.warning(f"  {model_type}: modèle non disponible")
            
            # Vérifier que les modèles partagés pointent vers la même instance
            if 'basic' in service.models and 'medium' in service.models:
                basic_model_id = id(service.models['basic'])
                medium_model_id = id(service.models['medium'])
                
                if basic_model_id == medium_model_id:
                    logger.info("✅ Confirmation: basic et medium utilisent la même instance de modèle")
                else:
                    logger.warning("⚠️ Erreur: basic et medium utilisent des instances différentes")
            
        else:
            logger.error("❌ Échec de l'initialisation du service")
            
    except Exception as e:
        logger.error(f"❌ Erreur lors du test: {e}")
    
    finally:
        if 'service' in locals():
            await service.cleanup()

async def test_no_sharing():
    """Teste le comportement sans partage de modèles"""
    logger.info("\n🧪 Test sans partage de modèles")
    
    # Configuration avec modèles différents
    service = QuantizedMLService("all", "float16", max_workers=2)
    
    # Modifier la configuration pour des modèles différents
    service.model_configs['basic']['model_name'] = 't5-small'
    service.model_configs['medium']['model_name'] = 'facebook/nllb-200-distilled-600M'
    service.model_configs['premium']['model_name'] = 'facebook/nllb-200-distilled-1.3B'
    
    logger.info("🔧 Configuration de test (modèles différents):")
    for model_type, config in service.model_configs.items():
        logger.info(f"  {model_type}: {config['model_name']}")
    
    try:
        # Initialiser le service
        initialized = await service.initialize()
        
        if initialized:
            # Obtenir les statistiques
            stats = service.get_stats()
            
            logger.info("\n📊 Statistiques sans partage:")
            logger.info(f"  Modèles partagés: {stats['shared_models_count']}")
            logger.info(f"  Types de modèles: {stats['total_model_types']}")
            logger.info(f"  Modèles uniques chargés: {stats['unique_models_loaded']}")
            logger.info(f"  Modèles économisés: {stats['models_saved']}")
            
            # Vérifier que les modèles sont différents
            model_ids = set()
            for model_type in ['basic', 'medium', 'premium']:
                if model_type in service.models:
                    model_ids.add(id(service.models[model_type]))
            
            if len(model_ids) == 3:
                logger.info("✅ Confirmation: tous les modèles sont des instances différentes")
            else:
                logger.warning(f"⚠️ Inattendu: {len(model_ids)} instances uniques pour 3 modèles")
            
        else:
            logger.error("❌ Échec de l'initialisation du service")
            
    except Exception as e:
        logger.error(f"❌ Erreur lors du test: {e}")
    
    finally:
        if 'service' in locals():
            await service.cleanup()

async def test_memory_optimization():
    """Teste l'optimisation mémoire"""
    logger.info("\n🧪 Test d'optimisation mémoire")
    
    # Configuration avec partage maximal
    service = QuantizedMLService("all", "float16", max_workers=2)
    
    # Tous les modèles utilisent le même modèle
    service.model_configs['basic']['model_name'] = 'facebook/nllb-200-distilled-600M'
    service.model_configs['medium']['model_name'] = 'facebook/nllb-200-distilled-600M'
    service.model_configs['premium']['model_name'] = 'facebook/nllb-200-distilled-600M'
    
    logger.info("🔧 Configuration avec partage maximal:")
    for model_type, config in service.model_configs.items():
        logger.info(f"  {model_type}: {config['model_name']}")
    
    try:
        # Initialiser le service
        initialized = await service.initialize()
        
        if initialized:
            # Obtenir les statistiques
            stats = service.get_stats()
            
            logger.info("\n📊 Optimisation mémoire maximale:")
            logger.info(f"  Modèles partagés: {stats['shared_models_count']}")
            logger.info(f"  Types de modèles: {stats['total_model_types']}")
            logger.info(f"  Modèles uniques chargés: {stats['unique_models_loaded']}")
            logger.info(f"  Modèles économisés: {stats['models_saved']}")
            logger.info(f"  Mémoire économisée (estimée): {stats['estimated_memory_saved_mb']:.1f} MB")
            
            # Vérifier que tous les modèles pointent vers la même instance
            model_ids = set()
            for model_type in ['basic', 'medium', 'premium']:
                if model_type in service.models:
                    model_ids.add(id(service.models[model_type]))
            
            if len(model_ids) == 1:
                logger.info("✅ Optimisation maximale: tous les modèles utilisent la même instance")
            else:
                logger.warning(f"⚠️ Optimisation partielle: {len(model_ids)} instances pour 3 modèles")
            
        else:
            logger.error("❌ Échec de l'initialisation du service")
            
    except Exception as e:
        logger.error(f"❌ Erreur lors du test: {e}")
    
    finally:
        if 'service' in locals():
            await service.cleanup()

async def main():
    """Fonction principale de test"""
    logger.info("🚀 Démarrage des tests du système de partage de modèles")
    
    # Test 1: Partage de modèles
    await test_model_sharing()
    
    # Test 2: Sans partage
    await test_no_sharing()
    
    # Test 3: Optimisation mémoire maximale
    await test_memory_optimization()
    
    logger.info("\n✅ Tests du système de partage terminés")

if __name__ == "__main__":
    asyncio.run(main())
