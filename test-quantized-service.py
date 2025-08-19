#!/usr/bin/env python3
"""
Script de test simple pour le service quantifié
Teste la compatibilité avec UnifiedMLService
"""

import asyncio
import time
import sys
import os

# Ajouter le chemin du projet
sys.path.append(os.path.join(os.path.dirname(__file__), 'translator/src'))

async def test_quantized_service():
    """Test simple du service quantifié"""
    print("🧪 TEST DU SERVICE QUANTIFIÉ")
    print("=" * 50)
    
    try:
        # Importer le service quantifié
        from services.quantized_ml_service import QuantizedMLService
        
        # Test avec différents niveaux de quantification
        quantization_levels = ["float32", "float16", "int8"]
        
        for level in quantization_levels:
            print(f"\n🔧 Test avec {level}...")
            
            # Créer le service
            service = QuantizedMLService("basic", level)
            
            # Initialiser
            print(f"  📥 Initialisation...")
            success = await service.initialize()
            
            if not success:
                print(f"  ❌ Échec initialisation {level}")
                continue
            
            print(f"  ✅ Initialisation réussie")
            
            # Test de traduction
            test_text = "Hello world, this is a test message"
            print(f"  🔄 Traduction: '{test_text}'")
            
            start_time = time.time()
            result = await service.translate(
                text=test_text,
                source_lang="en",
                target_lang="fr",
                model_type="basic",
                source_channel="test"
            )
            translation_time = time.time() - start_time
            
            print(f"  ✅ Résultat: '{result['translated_text']}'")
            print(f"  ⏱️  Temps: {translation_time:.3f}s")
            print(f"  📊 Stats: {result}")
            
            # Nettoyer
            await service.cleanup()
            
        print(f"\n🎉 Tests terminés avec succès !")
        
    except ImportError as e:
        print(f"❌ Erreur d'import: {e}")
        print("💡 Assurez-vous d'être dans le bon répertoire")
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
        import traceback
        traceback.print_exc()

async def test_compatibility():
    """Test de compatibilité avec UnifiedMLService"""
    print("\n🔄 TEST DE COMPATIBILITÉ")
    print("=" * 50)
    
    try:
        # Importer les deux services
        from services.quantized_ml_service import QuantizedMLService
        from services.unified_ml_service import UnifiedMLTranslationService
        
        print("✅ Import des services réussi")
        
        # Vérifier les interfaces
        quantized = QuantizedMLService("basic", "float16")
        unified = UnifiedMLTranslationService()
        
        # Vérifier les méthodes communes
        methods_quantized = dir(quantized)
        methods_unified = dir(unified)
        
        common_methods = [
            'translate',
            'initialize', 
            'get_stats',
            'cleanup'
        ]
        
        for method in common_methods:
            if method in methods_quantized and method in methods_unified:
                print(f"✅ Méthode {method}: Compatible")
            else:
                print(f"❌ Méthode {method}: Manquante")
        
        print("✅ Test de compatibilité terminé")
        
    except Exception as e:
        print(f"❌ Erreur compatibilité: {e}")

async def main():
    """Fonction principale"""
    print("🚀 DÉMARRAGE DES TESTS")
    print("=" * 50)
    
    # Test du service quantifié
    await test_quantized_service()
    
    # Test de compatibilité
    await test_compatibility()
    
    print("\n" + "=" * 50)
    print("🎉 TOUS LES TESTS TERMINÉS !")

if __name__ == "__main__":
    asyncio.run(main())
