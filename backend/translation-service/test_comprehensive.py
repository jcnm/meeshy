#!/usr/bin/env python3
"""
🧪 Test Complet du Service de Traduction Meeshy
==============================================

Tests de performance et fonctionnalité avec métriques détaillées
pour messages complexes et variés.
"""

import grpc
import time
import statistics
import json
from datetime import datetime
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import des messages gRPC générés
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from src import translation_pb2
    from src import translation_pb2_grpc
except ImportError as e:
    print(f"❌ Erreur d'import gRPC: {e}")
    print("Assurez-vous que les fichiers .proto sont compilés avec:")
    print("python -m grpc_tools.protoc --python_out=src --grpc_python_out=src --proto_path=. translation.proto")
    sys.exit(1)

class TranslationTester:
    """Testeur complet pour le service de traduction"""
    
    def __init__(self, host='localhost', port=50051):
        self.host = host
        self.port = port
        self.channel = None
        self.stub = None
        self.results = []
        
    def connect(self):
        """Connexion au service gRPC"""
        try:
            self.channel = grpc.insecure_channel(f'{self.host}:{self.port}')
            self.stub = translation_pb2_grpc.TranslationServiceStub(self.channel)
            
            # Test de connexion
            health_request = translation_pb2.HealthCheckRequest()
            response = self.stub.HealthCheck(health_request, timeout=5.0)
            print(f"✅ Connexion établie - Service: {response.status}")
            return True
            
        except Exception as e:
            print(f"❌ Erreur de connexion: {e}")
            return False
    
    def disconnect(self):
        """Fermeture de la connexion"""
        if self.channel:
            self.channel.close()
    
    def get_test_messages(self) -> List[Dict[str, Any]]:
        """Messages de test complexes et variés"""
        return [
            # Messages courts et simples
            {
                "text": "Bonjour",
                "source": "fr",
                "target": "en",
                "category": "simple",
                "expected_complexity": "faible"
            },
            {
                "text": "¿Cómo estás?",
                "source": "es", 
                "target": "fr",
                "category": "simple",
                "expected_complexity": "faible"
            },
            
            # Messages de longueur moyenne
            {
                "text": "Je voudrais réserver une table pour deux personnes ce soir s'il vous plaît.",
                "source": "fr",
                "target": "en", 
                "category": "medium",
                "expected_complexity": "moyenne"
            },
            {
                "text": "The weather is absolutely beautiful today, perfect for a walk in the park.",
                "source": "en",
                "target": "es",
                "category": "medium", 
                "expected_complexity": "moyenne"
            },
            
            # Messages longs et complexes
            {
                "text": "L'intelligence artificielle transforme notre façon de communiquer en brisant les barrières linguistiques grâce à des algorithmes sophistiqués de traduction automatique qui permettent une compréhension mutuelle entre les personnes de différentes cultures.",
                "source": "fr",
                "target": "en",
                "category": "complex",
                "expected_complexity": "élevée"
            },
            {
                "text": "In the rapidly evolving landscape of modern technology, machine learning algorithms have revolutionized various industries by providing unprecedented capabilities for data analysis, pattern recognition, and automated decision-making processes.",
                "source": "en",
                "target": "de",
                "category": "complex",
                "expected_complexity": "élevée"
            },
            
            # Messages avec contexte technique
            {
                "text": "npm install react typescript next.js pour initialiser le projet frontend",
                "source": "fr",
                "target": "en",
                "category": "technical",
                "expected_complexity": "moyenne"
            },
            {
                "text": "docker run -p 3000:3000 -v $(pwd):/app node:18-alpine",
                "source": "en",
                "target": "fr",
                "category": "technical",
                "expected_complexity": "moyenne"
            },
            
            # Messages conversationnels
            {
                "text": "Salut ! Comment ça va ? J'espère que tu passes une excellente journée. On se voit toujours demain pour notre rendez-vous ?",
                "source": "fr",
                "target": "en",
                "category": "conversational",
                "expected_complexity": "moyenne"
            },
            {
                "text": "Hey there! I was wondering if you'd like to grab coffee sometime this week. I know this amazing little café downtown.",
                "source": "en",
                "target": "es",
                "category": "conversational",
                "expected_complexity": "moyenne"
            },
            
            # Messages avec émotions
            {
                "text": "Je suis tellement excité pour ce nouveau projet ! C'était exactement ce dont j'avais besoin pour avancer dans ma carrière.",
                "source": "fr",
                "target": "en",
                "category": "emotional",
                "expected_complexity": "moyenne"
            },
            {
                "text": "I'm feeling quite overwhelmed with all these deadlines, but I'm confident we can pull through together as a team.",
                "source": "en",
                "target": "fr",
                "category": "emotional",
                "expected_complexity": "moyenne"
            },
            
            # Messages avec références culturelles
            {
                "text": "C'est le 14 juillet, la fête nationale française ! Vive la République et les feux d'artifice sur les Champs-Élysées.",
                "source": "fr",
                "target": "en",
                "category": "cultural",
                "expected_complexity": "élevée"
            },
            {
                "text": "Thanksgiving is around the corner, time to prepare the traditional turkey dinner with family and friends.",
                "source": "en",
                "target": "es",
                "category": "cultural",
                "expected_complexity": "élevée"
            },
            
            # Messages métaphoriques
            {
                "text": "Il pleut des cordes aujourd'hui, on ferait mieux de rester au chaud à la maison avec une tasse de thé.",
                "source": "fr",
                "target": "en",
                "category": "metaphorical",
                "expected_complexity": "élevée"
            },
            {
                "text": "Time flies when you're having fun, it feels like we just started this project yesterday.",
                "source": "en",
                "target": "de",
                "category": "metaphorical",
                "expected_complexity": "élevée"
            },
            
            # Messages multilingues (pour test de détection)
            {
                "text": "Hello, je suis bilingue and I speak deux langues fluently.",
                "source": "auto",
                "target": "es",
                "category": "multilingual",
                "expected_complexity": "élevée"
            },
            
            # Messages avec nombres et dates
            {
                "text": "Rendez-vous le 15 décembre 2024 à 14h30 précises, salle de conférence numéro 237.",
                "source": "fr",
                "target": "en",
                "category": "data_rich",
                "expected_complexity": "moyenne"
            },
            {
                "text": "The meeting is scheduled for March 22nd, 2024 at 9:00 AM sharp in conference room B-204.",
                "source": "en",
                "target": "fr",
                "category": "data_rich",
                "expected_complexity": "moyenne"
            },
            
            # Messages scientifiques
            {
                "text": "La photosynthèse est le processus biochimique par lequel les plantes convertissent la lumière solaire en énergie chimique stockée sous forme de glucose.",
                "source": "fr",
                "target": "en",
                "category": "scientific",
                "expected_complexity": "élevée"
            },
            {
                "text": "Quantum entanglement is a physical phenomenon where particles remain connected so that the quantum state of each particle cannot be described independently.",
                "source": "en",
                "target": "fr",
                "category": "scientific",
                "expected_complexity": "élevée"
            }
        ]
    
    def translate_message(self, message_data: Dict[str, Any]) -> Dict[str, Any]:
        """Traduction d'un message avec métriques"""
        start_time = time.time()
        
        try:
            request = translation_pb2.TranslateRequest(
                text=message_data["text"],
                source_language=message_data["source"],
                target_language=message_data["target"]
            )
            
            response = self.stub.TranslateText(request, timeout=30.0)
            
            end_time = time.time()
            translation_time = (end_time - start_time) * 1000  # en millisecondes
            
            # Extraction des métadonnées selon le proto actuel
            processing_time_ms = response.metadata.processing_time * 1000 if response.metadata else 0
            
            result = {
                "original": message_data,
                "translation": response.translated_text,
                "metadata": {
                    "model_used": response.model_used,
                    "confidence": response.confidence,
                    "cache_hit": response.cached,
                    "processing_time_ms": processing_time_ms,
                    "detected_language": response.source_language,
                    "device": response.metadata.device if response.metadata else "unknown",
                    "input_length": response.metadata.input_length if response.metadata else len(message_data["text"]),
                    "output_length": response.metadata.output_length if response.metadata else len(response.translated_text),
                    "word_count": response.metadata.word_count if response.metadata else len(message_data["text"].split())
                },
                "performance": {
                    "total_time_ms": translation_time,
                    "text_length": len(message_data["text"]),
                    "words_count": len(message_data["text"].split()),
                    "chars_per_second": len(message_data["text"]) / (translation_time / 1000) if translation_time > 0 else 0,
                    "words_per_second": len(message_data["text"].split()) / (translation_time / 1000) if translation_time > 0 else 0
                },
                "success": True,
                "timestamp": datetime.now().isoformat()
            }
            
            return result
            
        except Exception as e:
            end_time = time.time()
            translation_time = (end_time - start_time) * 1000
            
            return {
                "original": message_data,
                "translation": None,
                "error": str(e),
                "performance": {
                    "total_time_ms": translation_time,
                    "text_length": len(message_data["text"]),
                    "words_count": len(message_data["text"].split())
                },
                "success": False,
                "timestamp": datetime.now().isoformat()
            }
    
    def run_sequential_tests(self) -> List[Dict[str, Any]]:
        """Tests séquentiels pour mesurer les performances"""
        print("\n🔄 Démarrage des tests séquentiels...")
        
        messages = self.get_test_messages()
        results = []
        
        for i, message in enumerate(messages, 1):
            print(f"📝 Test {i}/{len(messages)} - Catégorie: {message['category']}")
            print(f"   Texte: {message['text'][:50]}{'...' if len(message['text']) > 50 else ''}")
            
            result = self.translate_message(message)
            results.append(result)
            
            if result["success"]:
                print(f"   ✅ Traduit en {result['performance']['total_time_ms']:.0f}ms")
                print(f"   🔄 Modèle: {result['metadata']['model_used']}")
                print(f"   💾 Cache: {'Oui' if result['metadata']['cache_hit'] else 'Non'}")
            else:
                print(f"   ❌ Erreur: {result['error']}")
            
            print()
        
        return results
    
    def run_concurrent_tests(self, max_workers=3) -> List[Dict[str, Any]]:
        """Tests concurrents pour mesurer la charge"""
        print(f"\n⚡ Démarrage des tests concurrents ({max_workers} workers)...")
        
        messages = self.get_test_messages()
        results = []
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Soumission de tous les jobs
            future_to_message = {
                executor.submit(self.translate_message, message): (i, message)
                for i, message in enumerate(messages, 1)
            }
            
            # Récupération des résultats
            for future in as_completed(future_to_message):
                i, message = future_to_message[future]
                
                try:
                    result = future.result()
                    results.append(result)
                    
                    if result["success"]:
                        print(f"✅ Test {i} terminé - {result['performance']['total_time_ms']:.0f}ms")
                    else:
                        print(f"❌ Test {i} échoué - {result['error']}")
                        
                except Exception as e:
                    print(f"❌ Erreur test {i}: {e}")
        
        return results
    
    def analyze_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyse des résultats avec métriques détaillées"""
        successful_results = [r for r in results if r["success"]]
        failed_results = [r for r in results if not r["success"]]
        
        if not successful_results:
            return {"error": "Aucun test réussi"}
        
        # Métriques de temps
        times = [r["performance"]["total_time_ms"] for r in successful_results]
        processing_times = [r["metadata"]["processing_time_ms"] for r in successful_results if r["metadata"]["processing_time_ms"] > 0]
        
        # Métriques par catégorie
        categories = {}
        for result in successful_results:
            cat = result["original"]["category"]
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(result["performance"]["total_time_ms"])
        
        # Métriques de modèles
        models = {}
        for result in successful_results:
            model = result["metadata"]["model_used"]
            if model not in models:
                models[model] = {"count": 0, "times": []}
            models[model]["count"] += 1
            models[model]["times"].append(result["performance"]["total_time_ms"])
        
        # Cache hits
        cache_hits = sum(1 for r in successful_results if r["metadata"]["cache_hit"])
        cache_rate = (cache_hits / len(successful_results)) * 100 if successful_results else 0
        
        # Performances texte
        chars_per_sec = [r["performance"]["chars_per_second"] for r in successful_results if r["performance"]["chars_per_second"] > 0]
        words_per_sec = [r["performance"]["words_per_second"] for r in successful_results if r["performance"]["words_per_second"] > 0]
        
        analysis = {
            "summary": {
                "total_tests": len(results),
                "successful": len(successful_results),
                "failed": len(failed_results),
                "success_rate": (len(successful_results) / len(results)) * 100 if results else 0
            },
            "performance": {
                "total_time": {
                    "min_ms": min(times) if times else 0,
                    "max_ms": max(times) if times else 0,
                    "mean_ms": statistics.mean(times) if times else 0,
                    "median_ms": statistics.median(times) if times else 0,
                    "stdev_ms": statistics.stdev(times) if len(times) > 1 else 0
                },
                "processing_time": {
                    "min_ms": min(processing_times) if processing_times else 0,
                    "max_ms": max(processing_times) if processing_times else 0,
                    "mean_ms": statistics.mean(processing_times) if processing_times else 0,
                    "median_ms": statistics.median(processing_times) if processing_times else 0
                },
                "throughput": {
                    "mean_chars_per_sec": statistics.mean(chars_per_sec) if chars_per_sec else 0,
                    "mean_words_per_sec": statistics.mean(words_per_sec) if words_per_sec else 0
                }
            },
            "categories": {
                cat: {
                    "count": len(times),
                    "mean_ms": statistics.mean(times),
                    "min_ms": min(times),
                    "max_ms": max(times)
                }
                for cat, times in categories.items()
            },
            "models": {
                model: {
                    "usage_count": data["count"],
                    "usage_percent": (data["count"] / len(successful_results)) * 100,
                    "mean_time_ms": statistics.mean(data["times"]),
                    "min_time_ms": min(data["times"]),
                    "max_time_ms": max(data["times"])
                }
                for model, data in models.items()
            },
            "cache": {
                "hits": cache_hits,
                "total": len(successful_results),
                "hit_rate_percent": cache_rate
            },
            "errors": [
                {
                    "message": r["original"]["text"][:100],
                    "error": r["error"],
                    "category": r["original"]["category"]
                }
                for r in failed_results
            ]
        }
        
        return analysis
    
    def print_analysis(self, analysis: Dict[str, Any]):
        """Affichage formaté de l'analyse"""
        print("\n" + "="*60)
        print("📊 RAPPORT D'ANALYSE DES PERFORMANCES")
        print("="*60)
        
        # Résumé
        summary = analysis["summary"]
        print(f"\n📈 RÉSUMÉ:")
        print(f"   Tests totaux: {summary['total_tests']}")
        print(f"   Réussites: {summary['successful']} ({summary['success_rate']:.1f}%)")
        print(f"   Échecs: {summary['failed']}")
        
        # Performances temporelles
        perf = analysis["performance"]
        print(f"\n⏱️  TEMPS DE TRADUCTION:")
        print(f"   Minimum: {perf['total_time']['min_ms']:.0f}ms")
        print(f"   Maximum: {perf['total_time']['max_ms']:.0f}ms")
        print(f"   Moyenne: {perf['total_time']['mean_ms']:.0f}ms")
        print(f"   Médiane: {perf['total_time']['median_ms']:.0f}ms")
        print(f"   Écart-type: {perf['total_time']['stdev_ms']:.0f}ms")
        
        # Débit
        throughput = perf["throughput"]
        print(f"\n🚀 DÉBIT:")
        print(f"   Caractères/sec: {throughput['mean_chars_per_sec']:.0f}")
        print(f"   Mots/sec: {throughput['mean_words_per_sec']:.1f}")
        
        # Modèles utilisés
        print(f"\n🧠 MODÈLES UTILISÉS:")
        for model, stats in analysis["models"].items():
            print(f"   {model}:")
            print(f"     Usage: {stats['usage_count']} fois ({stats['usage_percent']:.1f}%)")
            print(f"     Temps moyen: {stats['mean_time_ms']:.0f}ms")
        
        # Performance par catégorie
        print(f"\n📂 PERFORMANCE PAR CATÉGORIE:")
        for category, stats in analysis["categories"].items():
            print(f"   {category.title()}:")
            print(f"     Messages: {stats['count']}")
            print(f"     Temps moyen: {stats['mean_ms']:.0f}ms")
            print(f"     Plage: {stats['min_ms']:.0f}-{stats['max_ms']:.0f}ms")
        
        # Cache
        cache = analysis["cache"]
        print(f"\n💾 CACHE:")
        print(f"   Taux de succès: {cache['hit_rate_percent']:.1f}%")
        print(f"   Hits: {cache['hits']}/{cache['total']}")
        
        # Erreurs
        if analysis["errors"]:
            print(f"\n❌ ERREURS ({len(analysis['errors'])}):")
            for error in analysis["errors"][:3]:  # Limite à 3 erreurs
                print(f"   - {error['message']}...")
                print(f"     Erreur: {error['error']}")
    
    def save_results(self, results: List[Dict[str, Any]], analysis: Dict[str, Any], filename: str = None):
        """Sauvegarde des résultats en JSON"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"translation_test_results_{timestamp}.json"
        
        data = {
            "test_info": {
                "timestamp": datetime.now().isoformat(),
                "service_host": self.host,
                "service_port": self.port,
                "total_messages": len(results)
            },
            "results": results,
            "analysis": analysis
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"\n💾 Résultats sauvegardés dans: {filename}")
        return filename

def main():
    """Fonction principale"""
    print("🌍 Test Complet du Service de Traduction Meeshy")
    print("=" * 50)
    
    tester = TranslationTester()
    
    # Connexion au service
    if not tester.connect():
        print("❌ Impossible de se connecter au service")
        return
    
    try:
        # Menu interactif
        while True:
            print("\n🎯 OPTIONS DE TEST:")
            print("1. Tests séquentiels complets")
            print("2. Tests concurrents (charge)")
            print("3. Test personnalisé")
            print("4. Quitter")
            
            choice = input("\nChoisissez une option (1-4): ").strip()
            
            if choice == "1":
                results = tester.run_sequential_tests()
                analysis = tester.analyze_results(results)
                tester.print_analysis(analysis)
                tester.save_results(results, analysis)
                
            elif choice == "2":
                workers = input("Nombre de workers concurrents (défaut: 3): ").strip()
                workers = int(workers) if workers.isdigit() else 3
                
                results = tester.run_concurrent_tests(max_workers=workers)
                analysis = tester.analyze_results(results)
                tester.print_analysis(analysis)
                tester.save_results(results, analysis, f"concurrent_test_{workers}workers.json")
                
            elif choice == "3":
                text = input("Texte à traduire: ").strip()
                source = input("Langue source (ex: fr, en, auto): ").strip()
                target = input("Langue cible (ex: en, es, fr): ").strip()
                
                if text and source and target:
                    message_data = {
                        "text": text,
                        "source": source,
                        "target": target,
                        "category": "custom",
                        "expected_complexity": "personnalisée"
                    }
                    
                    result = tester.translate_message(message_data)
                    
                    if result["success"]:
                        print(f"\n✅ Traduction réussie:")
                        print(f"   Original: {result['original']['text']}")
                        print(f"   Traduit: {result['translation']}")
                        print(f"   Modèle: {result['metadata']['model_used']}")
                        print(f"   Temps: {result['performance']['total_time_ms']:.0f}ms")
                        print(f"   Cache: {'Oui' if result['metadata']['cache_hit'] else 'Non'}")
                    else:
                        print(f"\n❌ Erreur: {result['error']}")
                
            elif choice == "4":
                break
                
            else:
                print("❌ Option invalide")
    
    finally:
        tester.disconnect()
        print("\n👋 Tests terminés")

if __name__ == "__main__":
    main()
