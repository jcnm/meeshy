#!/usr/bin/env python3
"""
Script de test pour le service de traduction quantifié
Teste le chargement des modèles avec les nouveaux timeouts et l'affichage de progression
"""

import asyncio
import logging
import os
import sys
import time

# Ajouter le répertoire src au path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from services.quantized_ml_service import QuantizedMLService

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

async def test_quantized_service():
    """Test du service de traduction quantifié"""
    
    logger.info("🧪 Test du service de traduction quantifié")
    
    # Configuration des timeouts pour le test
    os.environ['MODEL_LOAD_TIMEOUT'] = '30'  # 30 secondes pour le test
    os.environ['TOKENIZER_LOAD_TIMEOUT'] = '15'  # 15 secondes pour le test
    os.environ['HUGGINGFACE_TIMEOUT'] = '60'  # 60 secondes pour le test
    
    try:
        # Créer le service avec un seul modèle pour le test
        logger.info("🔧 Création du service quantifié...")
        service = QuantizedMLService(
            model_type="basic",
            quantization_level="float16",
            max_workers=2
        )
        
        # Initialiser le service
        logger.info("🚀 Initialisation du service...")
        start_time = time.time()
        
        success = await service.initialize()
        
        init_time = time.time() - start_time
        logger.info(f"⏱️ Temps d'initialisation: {init_time:.2f}s")
        
        if success:
            logger.info("✅ Service initialisé avec succès!")
            
            # Test de traduction simple
            logger.info("🔤 Test de traduction...")
            result = await service.translate(
                text="Hello, how are you?",
                source_language="en",
                target_language="fr",
                model_type="basic"
            )
            
            logger.info(f"📝 Résultat de traduction: {result}")
            
            # Afficher les stats
            stats = service.get_stats()
            logger.info(f"📊 Stats du service: {stats}")
            
        else:
            logger.error("❌ Échec de l'initialisation du service")
            return False
            
    except Exception as e:
        logger.error(f"❌ Erreur lors du test: {e}")
        return False
    
    return True

async def main():
    """Fonction principale"""
    logger.info("🚀 Démarrage du test du service quantifié")
    
    success = await test_quantized_service()
    
    if success:
        logger.info("✅ Test réussi!")
        sys.exit(0)
    else:
        logger.error("❌ Test échoué!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
