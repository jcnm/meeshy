#!/usr/bin/env python3
"""
Script de test de performance pour les modèles quantifiés
Compare float32, float16, int8 et ONNX
"""

import asyncio
import time
import statistics
import psutil
import os
import sys
from typing import Dict, List, Any

# Ajouter le chemin du projet
sys.path.append(os.path.join(os.path.dirname(__file__), 'translator/src'))

from services.quantized_ml_service import QuantizedMLService

class QuantizationPerformanceTest:
    def __init__(self):
        self.test_texts = [
            "Hello world, this is a test message",
            "The quick brown fox jumps over the lazy dog",
            "Artificial intelligence is transforming the world",
            "Machine learning models are becoming more efficient",
            "Natural language processing enables better communication",
            "Translation services help bridge language barriers",
            "Technology continues to evolve rapidly",
            "Innovation drives progress in all fields",
            "Collaboration leads to better solutions",
            "Quality assurance ensures reliable results"
        ]
        
        self.quantization_levels = ["float32", "float16", "int8"]
        self.model_types = ["basic", "medium"]
        
        self.results = {}
        
    async def run_performance_test(self):
        """Exécute les tests de performance pour tous les modèles et niveaux de quantification"""
        print("🚀 TEST DE PERFORMANCE - MODÈLES QUANTIFIÉS")
        print("=" * 80)
        print(f"📅 Date: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🧪 Modèles: {', '.join(self.model_types)}")
        print(f"🔧 Niveaux: {', '.join(self.quantization_levels)} (sans ONNX)")
        print(f"📝 Textes: {len(self.test_texts)}")
        print()
        
        for model_type in self.model_types:
            print(f"🎯 TESTING MODEL: {model_type.upper()}")
            print("-" * 50)
            
            for quantization_level in self.quantization_levels:
                print(f"\n🔧 Testing {quantization_level}...")
                
                try:
                    # Créer le service
                    service = QuantizedMLService(model_type, quantization_level)
                    
                    # Initialiser
                    start_time = time.time()
                    success = await service.initialize()
                    init_time = time.time() - start_time
                    
                    if not success:
                        print(f"❌ Échec initialisation {quantization_level}")
                        continue
                    
                    # Mesurer la mémoire après initialisation
                    memory_after_init = psutil.Process().memory_info().rss / 1024 / 1024
                    
                    # Tests de traduction
                    translation_times = []
                    translation_results = []
                    
                    for i, text in enumerate(self.test_texts):
                        start_time = time.time()
                        result = await service.translate(text, "en", "fr")
                        translation_time = time.time() - start_time
                        
                        translation_times.append(translation_time)
                        translation_results.append(result)
                        
                        print(f"   {i+1:2d}/10: {translation_time:.3f}s - {result['translated_text'][:50]}...")
                    
                    # Mesurer la mémoire après traduction
                    memory_after_translation = psutil.Process().memory_info().rss / 1024 / 1024
                    
                    # Calculer les statistiques
                    avg_time = statistics.mean(translation_times)
                    min_time = min(translation_times)
                    max_time = max(translation_times)
                    std_time = statistics.stdev(translation_times) if len(translation_times) > 1 else 0
                    
                    # Stocker les résultats
                    self.results[f"{model_type}_{quantization_level}"] = {
                        'model_type': model_type,
                        'quantization_level': quantization_level,
                        'init_time': init_time,
                        'avg_translation_time': avg_time,
                        'min_translation_time': min_time,
                        'max_translation_time': max_time,
                        'std_translation_time': std_time,
                        'memory_after_init': memory_after_init,
                        'memory_after_translation': memory_after_translation,
                        'memory_increase': memory_after_translation - memory_after_init,
                        'translation_results': translation_results
                    }
                    
                    print(f"✅ {quantization_level}: {avg_time:.3f}s avg, {memory_after_translation:.1f}MB")
                    
                    # Nettoyer
                    await service.cleanup()
                    
                except Exception as e:
                    print(f"❌ Erreur {quantization_level}: {e}")
                    continue
        
        # Analyser les résultats
        self.analyze_results()
        
    def analyze_results(self):
        """Analyse et affiche les résultats"""
        print("\n" + "=" * 80)
        print("📊 ANALYSE DES RÉSULTATS")
        print("=" * 80)
        
        for model_type in self.model_types:
            print(f"\n🎯 MODÈLE {model_type.upper()}")
            print("-" * 50)
            
            model_results = {k: v for k, v in self.results.items() if k.startswith(model_type)}
            
            if not model_results:
                print("❌ Aucun résultat pour ce modèle")
                continue
            
            # Tableau de comparaison
            print(f"{'Niveau':<12} {'Init(s)':<8} {'Avg(s)':<8} {'Min(s)':<8} {'Max(s)':<8} {'Mémoire(MB)':<12}")
            print("-" * 70)
            
            baseline = None
            for quantization_level in self.quantization_levels:
                key = f"{model_type}_{quantization_level}"
                if key in model_results:
                    result = model_results[key]
                    
                    if baseline is None:
                        baseline = result
                    
                    # Calculer les améliorations par rapport au baseline
                    speed_improvement = ((baseline['avg_translation_time'] - result['avg_translation_time']) / baseline['avg_translation_time']) * 100
                    memory_improvement = ((baseline['memory_after_translation'] - result['memory_after_translation']) / baseline['memory_after_translation']) * 100
                    
                    print(f"{quantization_level:<12} {result['init_time']:<8.3f} {result['avg_translation_time']:<8.3f} {result['min_translation_time']:<8.3f} {result['max_translation_time']:<8.3f} {result['memory_after_translation']:<12.1f}")
                    
                    if quantization_level != "float32":
                        print(f"           → Vitesse: {speed_improvement:+.1f}%, Mémoire: {memory_improvement:+.1f}%")
            
            # Recommandations
            print(f"\n💡 RECOMMANDATIONS POUR {model_type.upper()}:")
            
            # Meilleur compromis vitesse/mémoire
            best_compromise = min(model_results.values(), 
                                key=lambda x: x['avg_translation_time'] * x['memory_after_translation'])
            print(f"   🏆 Meilleur compromis: {best_compromise['quantization_level']}")
            print(f"      Temps: {best_compromise['avg_translation_time']:.3f}s, Mémoire: {best_compromise['memory_after_translation']:.1f}MB")
            
            # Plus rapide
            fastest = min(model_results.values(), key=lambda x: x['avg_translation_time'])
            print(f"   ⚡ Plus rapide: {fastest['quantization_level']} ({fastest['avg_translation_time']:.3f}s)")
            
            # Moins de mémoire
            lowest_memory = min(model_results.values(), key=lambda x: x['memory_after_translation'])
            print(f"   💾 Moins de mémoire: {lowest_memory['quantization_level']} ({lowest_memory['memory_after_translation']:.1f}MB)")
    
    def save_results(self, filename: str = "quantization_results.json"):
        """Sauvegarde les résultats en JSON"""
        import json
        
        # Nettoyer les résultats pour la sérialisation
        clean_results = {}
        for key, result in self.results.items():
            clean_result = {k: v for k, v in result.items() if k != 'translation_results'}
            clean_results[key] = clean_result
        
        with open(filename, 'w') as f:
            json.dump(clean_results, f, indent=2)
        
        print(f"\n💾 Résultats sauvegardés dans: {filename}")

async def main():
    """Fonction principale"""
    test = QuantizationPerformanceTest()
    
    try:
        await test.run_performance_test()
        test.save_results()
        
        print("\n" + "=" * 80)
        print("🎉 TESTS DE QUANTIFICATION TERMINÉS !")
        print("=" * 80)
        print("✅ Performance comparée pour tous les niveaux")
        print("✅ Recommandations générées")
        print("✅ Résultats sauvegardés")
        
    except Exception as e:
        print(f"❌ Erreur lors des tests: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
