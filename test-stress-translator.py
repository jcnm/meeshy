#!/usr/bin/env python3
"""
Script de test de stress pour le service de traduction Meeshy v0.4.7-alpha
Évalue les performances avec les optimisations de logs et toasts
"""

import asyncio
import aiohttp
import time
import json
import statistics
from datetime import datetime
from typing import List, Dict
import psutil
import os

class TranslatorStressTest:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results = []
        self.start_time = None
        self.end_time = None
        
    async def test_single_translation(self, session: aiohttp.ClientSession, text: str, 
                                    source_lang: str = "en", target_lang: str = "fr", 
                                    model_type: str = "basic") -> Dict:
        """Test une traduction individuelle"""
        payload = {
            "text": text,
            "source_language": source_lang,
            "target_language": target_lang,
            "model_type": model_type
        }
        
        start_time = time.time()
        try:
            async with session.post(f"{self.base_url}/translate", 
                                  json=payload, 
                                  timeout=aiohttp.ClientTimeout(total=30)) as response:
                end_time = time.time()
                response_time = (end_time - start_time) * 1000  # en millisecondes
                
                if response.status == 200:
                    result = await response.json()
                    return {
                        "success": True,
                        "response_time": response_time,
                        "status_code": response.status,
                        "translated_text": result.get("translated_text", ""),
                        "confidence_score": result.get("confidence_score", 0),
                        "processing_time_ms": result.get("processing_time_ms", 0),
                        "model_used": result.get("model_used", "")
                    }
                else:
                    return {
                        "success": False,
                        "response_time": response_time,
                        "status_code": response.status,
                        "error": f"HTTP {response.status}"
                    }
        except Exception as e:
            end_time = time.time()
            response_time = (end_time - start_time) * 1000
            return {
                "success": False,
                "response_time": response_time,
                "error": str(e)
            }
    
    async def test_concurrent_translations(self, num_requests: int, 
                                         concurrent_limit: int = 10) -> List[Dict]:
        """Test des traductions concurrentes"""
        print(f"🚀 Démarrage du test de stress: {num_requests} requêtes, {concurrent_limit} concurrentes")
        
        # Textes de test variés
        test_texts = [
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
        
        semaphore = asyncio.Semaphore(concurrent_limit)
        
        async def limited_request(session, text, index):
            async with semaphore:
                return await self.test_single_translation(session, text)
        
        async with aiohttp.ClientSession() as session:
            tasks = []
            for i in range(num_requests):
                text = test_texts[i % len(test_texts)]
                task = limited_request(session, text, i)
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Filtrer les exceptions
            valid_results = []
            for result in results:
                if isinstance(result, dict):
                    valid_results.append(result)
                else:
                    valid_results.append({
                        "success": False,
                        "response_time": 0,
                        "error": str(result)
                    })
            
            return valid_results
    
    def analyze_results(self, results: List[Dict]) -> Dict:
        """Analyse les résultats du test"""
        successful_requests = [r for r in results if r.get("success", False)]
        failed_requests = [r for r in results if not r.get("success", False)]
        
        if not successful_requests:
            return {
                "total_requests": len(results),
                "successful_requests": 0,
                "failed_requests": len(failed_requests),
                "success_rate": 0,
                "error": "Aucune requête réussie"
            }
        
        response_times = [r["response_time"] for r in successful_requests]
        processing_times = [r.get("processing_time_ms", 0) for r in successful_requests]
        
        analysis = {
            "total_requests": len(results),
            "successful_requests": len(successful_requests),
            "failed_requests": len(failed_requests),
            "success_rate": (len(successful_requests) / len(results)) * 100,
            "response_time_stats": {
                "mean": statistics.mean(response_times),
                "median": statistics.median(response_times),
                "min": min(response_times),
                "max": max(response_times),
                "std_dev": statistics.stdev(response_times) if len(response_times) > 1 else 0
            },
            "processing_time_stats": {
                "mean": statistics.mean(processing_times),
                "median": statistics.median(processing_times),
                "min": min(processing_times),
                "max": max(processing_times)
            },
            "requests_per_second": len(successful_requests) / (self.end_time - self.start_time),
            "errors": [r.get("error", "Unknown error") for r in failed_requests]
        }
        
        return analysis
    
    def get_system_stats(self) -> Dict:
        """Récupère les statistiques système"""
        process = psutil.Process()
        return {
            "cpu_percent": process.cpu_percent(),
            "memory_mb": process.memory_info().rss / 1024 / 1024,
            "system_cpu_percent": psutil.cpu_percent(),
            "system_memory_percent": psutil.virtual_memory().percent
        }
    
    async def run_stress_test(self, num_requests: int = 100, concurrent_limit: int = 10):
        """Exécute le test de stress complet"""
        print("=" * 80)
        print("🧪 TEST DE STRESS - Meeshy Translator v0.4.7-alpha")
        print("=" * 80)
        print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🎯 Objectif: {num_requests} requêtes, {concurrent_limit} concurrentes")
        print()
        
        # Statistiques système avant le test
        print("📊 Statistiques système avant le test:")
        initial_stats = self.get_system_stats()
        print(f"   CPU: {initial_stats['cpu_percent']:.1f}%")
        print(f"   Mémoire: {initial_stats['memory_mb']:.1f} MB")
        print(f"   CPU système: {initial_stats['system_cpu_percent']:.1f}%")
        print(f"   Mémoire système: {initial_stats['system_memory_percent']:.1f}%")
        print()
        
        # Test de santé avant le stress
        print("🏥 Test de santé du service...")
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/health", timeout=5) as response:
                    if response.status == 200:
                        print("✅ Service en bonne santé")
                    else:
                        print(f"⚠️ Service répond mais statut: {response.status}")
        except Exception as e:
            print(f"❌ Erreur de santé: {e}")
            return
        
        print()
        print("🚀 Démarrage du test de stress...")
        
        self.start_time = time.time()
        results = await self.test_concurrent_translations(num_requests, concurrent_limit)
        self.end_time = time.time()
        
        # Statistiques système après le test
        final_stats = self.get_system_stats()
        
        # Analyse des résultats
        analysis = self.analyze_results(results)
        
        # Affichage des résultats
        print()
        print("=" * 80)
        print("📈 RÉSULTATS DU TEST DE STRESS")
        print("=" * 80)
        
        print(f"📊 Résumé général:")
        print(f"   Total des requêtes: {analysis['total_requests']}")
        print(f"   Requêtes réussies: {analysis['successful_requests']}")
        print(f"   Requêtes échouées: {analysis['failed_requests']}")
        print(f"   Taux de succès: {analysis['success_rate']:.1f}%")
        print(f"   Requêtes par seconde: {analysis['requests_per_second']:.1f}")
        
        print()
        print(f"⏱️ Temps de réponse (ms):")
        rt_stats = analysis['response_time_stats']
        print(f"   Moyenne: {rt_stats['mean']:.1f}")
        print(f"   Médiane: {rt_stats['median']:.1f}")
        print(f"   Min: {rt_stats['min']:.1f}")
        print(f"   Max: {rt_stats['max']:.1f}")
        print(f"   Écart-type: {rt_stats['std_dev']:.1f}")
        
        print()
        print(f"⚙️ Temps de traitement ML (ms):")
        pt_stats = analysis['processing_time_stats']
        print(f"   Moyenne: {pt_stats['mean']:.1f}")
        print(f"   Médiane: {pt_stats['median']:.1f}")
        print(f"   Min: {pt_stats['min']:.1f}")
        print(f"   Max: {pt_stats['max']:.1f}")
        
        print()
        print(f"💻 Utilisation système:")
        print(f"   CPU avant: {initial_stats['cpu_percent']:.1f}% → après: {final_stats['cpu_percent']:.1f}%")
        print(f"   Mémoire avant: {initial_stats['memory_mb']:.1f} MB → après: {final_stats['memory_mb']:.1f} MB")
        print(f"   CPU système: {initial_stats['system_cpu_percent']:.1f}% → {final_stats['system_cpu_percent']:.1f}%")
        print(f"   Mémoire système: {initial_stats['system_memory_percent']:.1f}% → {final_stats['system_memory_percent']:.1f}%")
        
        if analysis['errors']:
            print()
            print(f"❌ Erreurs rencontrées:")
            error_counts = {}
            for error in analysis['errors']:
                error_counts[error] = error_counts.get(error, 0) + 1
            for error, count in error_counts.items():
                print(f"   {error}: {count} fois")
        
        print()
        print("=" * 80)
        print("🎯 ÉVALUATION DES PERFORMANCES")
        print("=" * 80)
        
        # Évaluation des performances
        if analysis['success_rate'] >= 95:
            print("✅ Excellent: Taux de succès très élevé")
        elif analysis['success_rate'] >= 90:
            print("✅ Bon: Taux de succès élevé")
        elif analysis['success_rate'] >= 80:
            print("⚠️ Acceptable: Taux de succès correct")
        else:
            print("❌ Problématique: Taux de succès faible")
        
        if rt_stats['mean'] < 1000:
            print("✅ Excellent: Temps de réponse très rapide")
        elif rt_stats['mean'] < 2000:
            print("✅ Bon: Temps de réponse rapide")
        elif rt_stats['mean'] < 5000:
            print("⚠️ Acceptable: Temps de réponse correct")
        else:
            print("❌ Problématique: Temps de réponse lent")
        
        if analysis['requests_per_second'] > 10:
            print("✅ Excellent: Débit élevé")
        elif analysis['requests_per_second'] > 5:
            print("✅ Bon: Débit correct")
        elif analysis['requests_per_second'] > 2:
            print("⚠️ Acceptable: Débit modéré")
        else:
            print("❌ Problématique: Débit faible")
        
        print()
        print("🏁 Test de stress terminé!")

async def main():
    """Fonction principale"""
    test = TranslatorStressTest()
    
    # Tests avec différentes charges
    test_scenarios = [
        {"requests": 50, "concurrent": 5, "name": "Test léger"},
        {"requests": 100, "concurrent": 10, "name": "Test moyen"},
        {"requests": 200, "concurrent": 20, "name": "Test intensif"}
    ]
    
    for scenario in test_scenarios:
        print(f"\n{'='*20} {scenario['name']} {'='*20}")
        await test.run_stress_test(scenario['requests'], scenario['concurrent'])
        await asyncio.sleep(5)  # Pause entre les tests

if __name__ == "__main__":
    asyncio.run(main())
