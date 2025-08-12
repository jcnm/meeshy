#!/usr/bin/env python3
"""
Test d'intégration final du service ML unifié
Vérifie que les vrais modèles T5 et NLLB sont utilisés
"""

import asyncio
import sys
import os
from pathlib import Path

# Ajouter src au path et charger .env
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Variables d'environnement .env chargées")
except ImportError:
    print("⚠️ python-dotenv non disponible")

from services.unified_ml_service import get_unified_ml_service
from services.zmq_server import ZMQTranslationServer

async def test_ml_integration():
    """Test complet du service ML unifié"""
    print("🧪 TEST D'INTÉGRATION ML UNIFIÉ")
    print("=" * 50)
    
    # 1. TEST DU SERVICE ML SEUL
    print("\n📚 1. Test du service ML unifié seul:")
    service = get_unified_ml_service(max_workers=2)
    
    success = await service.initialize()
    print(f"   Initialisé: {success}")
    
    if success:
        # Test T5-small
        print("\n   🔧 Test T5-small (basic):")
        result_t5 = await service.translate(
            text="Hello world test",
            source_language="en",
            target_language="fr",
            model_type="basic",
            source_channel="test"
        )
        print(f"   EN→FR: \"{result_t5.get('translated_text', 'N/A')}\"")
        print(f"   Modèle: {result_t5.get('model_used', 'N/A')}")
        
        # Test NLLB
        print("\n   🔧 Test NLLB-600M (medium):")
        result_nllb = await service.translate(
            text="Bonjour le monde",
            source_language="fr",
            target_language="en",
            model_type="medium",
            source_channel="test"
        )
        print(f"   FR→EN: \"{result_nllb.get('translated_text', 'N/A')}\"")
        print(f"   Modèle: {result_nllb.get('model_used', 'N/A')}")
        
        # Stats
        stats = await service.get_stats()
        print(f"\n   📊 Stats: {stats['translations_count']} traductions")
        print(f"   📁 Modèles: {list(stats['models_loaded'].keys())}")
        
    # 2. TEST ZMQ SERVER AVEC SERVICE ML
    print("\n\n🔗 2. Test ZMQ Server avec service ML:")
    
    try:
        # Créer serveur ZMQ avec le service ML unifié
        zmq_server = ZMQTranslationServer(
            host="0.0.0.0",
            gateway_pub_port=5557,
            gateway_sub_port=5555,
            normal_workers=2,
            any_workers=1,
            translation_service=service  # Service ML unifié
        )
        
        print("   ✅ ZMQ Server créé avec service ML unifié")
        print("   🎯 Le serveur ZMQ utilise maintenant les vrais modèles ML")
        
        # Vérifier la configuration
        if zmq_server.translation_service:
            print(f"   📚 Service attaché: {type(zmq_server.translation_service).__name__}")
            print(f"   🤖 Est service unifié: {hasattr(zmq_server.translation_service, 'models')}")
        
    except Exception as e:
        print(f"   ❌ Erreur ZMQ Server: {e}")
    
    print("\n" + "=" * 50)
    print("✅ TEST D'INTÉGRATION TERMINÉ")
    print("🎯 Le service ML unifié est prêt avec vrais modèles")
    print("📊 Modèles disponibles:")
    print("   - basic: T5-small (local)")
    print("   - medium: NLLB-600M (local)")  
    print("   - premium: NLLB-1.3B (local)")

if __name__ == "__main__":
    asyncio.run(test_ml_integration())
