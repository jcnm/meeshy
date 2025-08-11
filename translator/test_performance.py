#!/usr/bin/env python3
"""
Script de test des performances pour l'architecture de traduction haute performance
Teste: 10+ requêtes/sec côté gateway, 100-1000 traductions/sec côté translator
"""

import asyncio
import time
import json
import zmq
import zmq.asyncio
import logging
from typing import List, Dict
import statistics

# Configuration du logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class PerformanceTester:
    """Testeur de performances pour l'architecture de traduction"""
    
    def __init__(self, host: str = 'localhost', port: int = 5555):
        self.host = host
        self.port = port
        self.context = zmq.asyncio.Context()
        self.socket = None
        
        # Données de test
        self.test_texts = [
            "Hello world",
            "Good morning",
            "How are you?",
            "Thank you very much",
            "Have a nice day",
            "See you later",
            "What time is it?",
            "Where are you going?",
            "I love this place",
            "The weather is beautiful today"
        ]
        
        self.language_pairs = [
            ('en', 'fr'),
            ('en', 'es'),
            ('fr', 'en'),
            ('es', 'en'),
            ('en', 'de')
        ]
    
    async def initialize(self):
        """Initialise le client de test"""
        try:
            self.socket = self.context.socket(zmq.REQ)
            self.socket.setsockopt(zmq.LINGER, 1000)
            await self.socket.connect(f"tcp://{self.host}:{self.port}")
            logger.info(f"✅ Client de test connecté à tcp://{self.host}:{self.port}")
        except Exception as e:
            logger.error(f"❌ Erreur connexion: {e}")
            raise
    
    async def test_single_translation(self, text: str, source_lang: str, target_lang: str) -> Dict:
        """Teste une traduction unique"""
        try:
            request = {
                "messageId": f"test_{int(time.time() * 1000)}",
                "text": text,
                "sourceLanguage": source_lang,
                "targetLanguage": target_lang,
                "modelType": "basic"
            }
            
            start_time = time.time()
            await self.socket.send(json.dumps(request).encode('utf-8'))
            response = await self.socket.receive()
            end_time = time.time()
            
            response_data = json.loads(response[0].decode('utf-8'))
            
            return {
                'success': True,
                'latency': (end_time - start_time) * 1000,  # en ms
                'task_id': response_data.get('taskId'),
                'status': response_data.get('status'),
                'estimated_time': response_data.get('estimatedProcessingTime', 0)
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur traduction: {e}")
            return {
                'success': False,
                'error': str(e),
                'latency': 0
            }
    
    async def test_concurrent_translations(self, num_requests: int, concurrent_limit: int = 10) -> Dict:
        """Teste des traductions concurrentes"""
        logger.info(f"🚀 Test de {num_requests} traductions avec limite de {concurrent_limit} concurrentes")
        
        results = []
        semaphore = asyncio.Semaphore(concurrent_limit)
        
        async def single_request():
            async with semaphore:
                import random
                text = random.choice(self.test_texts)
                source_lang, target_lang = random.choice(self.language_pairs)
                return await self.test_single_translation(text, source_lang, target_lang)
        
        start_time = time.time()
        tasks = [single_request() for _ in range(num_requests)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = time.time()
        
        # Traiter les résultats
        for response in responses:
            if isinstance(response, Exception):
                results.append({
                    'success': False,
                    'error': str(response),
                    'latency': 0
                })
            else:
                results.append(response)
        
        total_time = end_time - start_time
        successful_requests = [r for r in results if r['success']]
        failed_requests = [r for r in results if not r['success']]
        
        if successful_requests:
            latencies = [r['latency'] for r in successful_requests]
            stats = {
                'total_requests': num_requests,
                'successful_requests': len(successful_requests),
                'failed_requests': len(failed_requests),
                'success_rate': len(successful_requests) / num_requests * 100,
                'total_time': total_time,
                'requests_per_second': num_requests / total_time,
                'avg_latency_ms': statistics.mean(latencies),
                'min_latency_ms': min(latencies),
                'max_latency_ms': max(latencies),
                'median_latency_ms': statistics.median(latencies)
            }
        else:
            stats = {
                'total_requests': num_requests,
                'successful_requests': 0,
                'failed_requests': len(failed_requests),
                'success_rate': 0,
                'total_time': total_time,
                'requests_per_second': 0,
                'error': 'Aucune requête réussie'
            }
        
        return stats
    
    async def test_gateway_performance(self) -> Dict:
        """Teste les performances côté gateway (10+ req/sec)"""
        logger.info("🎯 Test des performances Gateway (objectif: 10+ req/sec)")
        
        # Test avec différentes charges
        test_scenarios = [
            {'requests': 50, 'concurrent': 5, 'name': 'Faible charge'},
            {'requests': 100, 'concurrent': 10, 'name': 'Charge moyenne'},
            {'requests': 200, 'concurrent': 20, 'name': 'Charge élevée'}
        ]
        
        results = {}
        
        for scenario in test_scenarios:
            logger.info(f"📊 {scenario['name']}: {scenario['requests']} requêtes, {scenario['concurrent']} concurrentes")
            
            stats = await self.test_concurrent_translations(
                scenario['requests'], 
                scenario['concurrent']
            )
            
            results[scenario['name']] = stats
            
            # Vérifier l'objectif
            if stats['requests_per_second'] >= 10:
                logger.info(f"✅ Objectif atteint: {stats['requests_per_second']:.2f} req/sec")
            else:
                logger.warning(f"⚠️ Objectif non atteint: {stats['requests_per_second']:.2f} req/sec")
        
        return results
    
    async def test_translator_performance(self) -> Dict:
        """Teste les performances côté translator (100-1000 req/sec)"""
        logger.info("🎯 Test des performances Translator (objectif: 100-1000 req/sec)")
        
        # Test avec charges élevées
        test_scenarios = [
            {'requests': 500, 'concurrent': 50, 'name': 'Charge modérée'},
            {'requests': 1000, 'concurrent': 100, 'name': 'Charge élevée'},
            {'requests': 2000, 'concurrent': 200, 'name': 'Charge très élevée'}
        ]
        
        results = {}
        
        for scenario in test_scenarios:
            logger.info(f"📊 {scenario['name']}: {scenario['requests']} requêtes, {scenario['concurrent']} concurrentes")
            
            stats = await self.test_concurrent_translations(
                scenario['requests'], 
                scenario['concurrent']
            )
            
            results[scenario['name']] = stats
            
            # Vérifier l'objectif
            if 100 <= stats['requests_per_second'] <= 1000:
                logger.info(f"✅ Objectif atteint: {stats['requests_per_second']:.2f} req/sec")
            elif stats['requests_per_second'] > 1000:
                logger.info(f"🚀 Performance excellente: {stats['requests_per_second']:.2f} req/sec")
            else:
                logger.warning(f"⚠️ Performance insuffisante: {stats['requests_per_second']:.2f} req/sec")
        
        return results
    
    async def test_multi_language_support(self) -> Dict:
        """Teste le support multi-langues"""
        logger.info("🌍 Test du support multi-langues")
        
        text = "Hello world"
        results = {}
        
        for source_lang, target_lang in self.language_pairs:
            logger.info(f"🔄 Test {source_lang} → {target_lang}")
            
            result = await self.test_single_translation(text, source_lang, target_lang)
            results[f"{source_lang}_to_{target_lang}"] = result
            
            if result['success']:
                logger.info(f"✅ {source_lang} → {target_lang}: {result['latency']:.2f}ms")
            else:
                logger.error(f"❌ {source_lang} → {target_lang}: {result.get('error', 'Unknown error')}")
        
        return results
    
    def print_summary(self, gateway_results: Dict, translator_results: Dict, multi_lang_results: Dict):
        """Affiche un résumé des tests"""
        logger.info("\n" + "="*80)
        logger.info("📊 RÉSUMÉ DES TESTS DE PERFORMANCE")
        logger.info("="*80)
        
        # Résultats Gateway
        logger.info("\n🎯 PERFORMANCES GATEWAY (objectif: 10+ req/sec)")
        logger.info("-" * 50)
        for name, stats in gateway_results.items():
            logger.info(f"{name}:")
            logger.info(f"  • Requêtes/sec: {stats['requests_per_second']:.2f}")
            logger.info(f"  • Taux de succès: {stats['success_rate']:.1f}%")
            logger.info(f"  • Latence moyenne: {stats.get('avg_latency_ms', 0):.2f}ms")
        
        # Résultats Translator
        logger.info("\n🎯 PERFORMANCES TRANSLATOR (objectif: 100-1000 req/sec)")
        logger.info("-" * 50)
        for name, stats in translator_results.items():
            logger.info(f"{name}:")
            logger.info(f"  • Requêtes/sec: {stats['requests_per_second']:.2f}")
            logger.info(f"  • Taux de succès: {stats['success_rate']:.1f}%")
            logger.info(f"  • Latence moyenne: {stats.get('avg_latency_ms', 0):.2f}ms")
        
        # Support multi-langues
        logger.info("\n🌍 SUPPORT MULTI-LANGUES")
        logger.info("-" * 50)
        successful_langs = [k for k, v in multi_lang_results.items() if v['success']]
        logger.info(f"Langues supportées: {len(successful_langs)}/{len(multi_lang_results)}")
        for lang_pair in successful_langs:
            latency = multi_lang_results[lang_pair]['latency']
            logger.info(f"  • {lang_pair}: {latency:.2f}ms")
        
        logger.info("\n" + "="*80)
    
    async def close(self):
        """Ferme le testeur"""
        if self.socket:
            await self.socket.close()
        self.context.term()

async def main():
    """Fonction principale de test"""
    logger.info("🚀 Démarrage des tests de performance")
    
    tester = PerformanceTester()
    
    try:
        await tester.initialize()
        
        # Tests de performance
        gateway_results = await tester.test_gateway_performance()
        translator_results = await tester.test_translator_performance()
        multi_lang_results = await tester.test_multi_language_support()
        
        # Affichage du résumé
        tester.print_summary(gateway_results, translator_results, multi_lang_results)
        
    except Exception as e:
        logger.error(f"❌ Erreur lors des tests: {e}")
    finally:
        await tester.close()

if __name__ == "__main__":
    asyncio.run(main())
