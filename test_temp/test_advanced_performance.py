#!/usr/bin/env python3
"""
Test de performance avancé avec charge continue
Teste tous les modèles et quantifications
"""

import asyncio
import time
import statistics
import json
from datetime import datetime
from typing import Dict, List, Any
import sys
import os

# Ajouter le chemin pour importer les services
sys.path.append('/Users/smpceo/Downloads/Meeshy/meeshy/translator/src')

async def test_model_performance(model_type: str, quantization_level: str, test_duration: int, target_tps: int):
    """Test de performance pour un modèle/quantification spécifique"""
    print(f"\n🔧 Test {model_type} avec {quantization_level}...")
    print("-" * 50)
    
    try:
        from services.quantized_ml_service import QuantizedMLService
        
        # Créer le service
        service = QuantizedMLService(model_type, quantization_level, max_workers=4)
        
        # Mesurer l'initialisation
        start_time = time.time()
        success = await service.initialize()
        init_time = time.time() - start_time
        
        if not success:
            print(f"❌ Échec initialisation {model_type} {quantization_level}")
            return None
            
        print(f"  ✅ Initialisation: {init_time:.3f}s")
        print(f"  📊 Workers: {service.max_workers}")
        
        # Textes de test
        test_texts = [
            "Hello world, this is a test message",
            "The quick brown fox jumps over the lazy dog", 
            "Machine learning models can translate text accurately",
            "Welcome to our translation service",
            "Good morning, how are you today?",
            "Artificial intelligence is transforming the world",
            "Bonjour le monde, ceci est un message de test",
            "La traduction automatique est très utile",
            "Comment allez-vous aujourd'hui?",
            "Bienvenue dans notre service de traduction",
            "Les nouvelles technologies facilitent la communication",
            "L'intelligence artificielle transforme le monde"
        ]
        
        # Calculer l'intervalle entre traductions
        interval = 1.0 / target_tps
        total_translations = test_duration * target_tps
        
        print(f"  🎯 Objectif: {target_tps} traductions/seconde")
        print(f"  ⏱️  Durée: {test_duration}s")
        print(f"  📊 Total prévu: {total_translations} traductions")
        print(f"  ⏰ Intervalle: {interval:.3f}s")
        
        # Variables de mesure
        translations_completed = 0
        translation_times = []
        errors = 0
        start_test_time = time.time()
        translations_log = []  # Nouveau: log des traductions
        
        print(f"\n  🚀 Début du test de charge...")
        
        # Boucle de test de charge
        for i in range(total_translations):
            # Sélectionner un texte de test (rotation)
            text = test_texts[i % len(test_texts)]
            
            # Déterminer la direction de traduction
            if text[0].isupper():
                source_lang, target_lang = "en", "fr"
            else:
                source_lang, target_lang = "fr", "en"
            
            # Mesurer le temps de traduction
            translation_start = time.time()
            request_timestamp = datetime.now().isoformat()
            
            try:
                result = await service.translate(
                    text=text,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    model_type=model_type,
                    source_channel="load_test"
                )
                translation_time = time.time() - translation_start
                response_timestamp = datetime.now().isoformat()
                translation_times.append(translation_time)
                translations_completed += 1
                
                # Extraire le texte traduit du résultat
                if isinstance(result, dict):
                    translated_text = result.get('translated_text', str(result))
                else:
                    translated_text = str(result)
                
                # Logger la traduction
                translations_log.append({
                    'request_id': i + 1,
                    'request_timestamp': request_timestamp,
                    'response_timestamp': response_timestamp,
                    'model_type': model_type,
                    'quantization_level': quantization_level,
                    'source_lang': source_lang,
                    'target_lang': target_lang,
                    'original_text': text,
                    'translated_text': translated_text,
                    'translation_time': translation_time,
                    'success': True
                })
                
                # Afficher le progrès tous les 10
                if (i + 1) % 10 == 0:
                    elapsed = time.time() - start_test_time
                    current_tps = (i + 1) / elapsed
                    print(f"    📈 {i + 1}/{total_translations} - TPS actuel: {current_tps:.2f}")
                    
            except Exception as e:
                errors += 1
                response_timestamp = datetime.now().isoformat()
                
                # Logger l'erreur
                translations_log.append({
                    'request_id': i + 1,
                    'request_timestamp': request_timestamp,
                    'response_timestamp': response_timestamp,
                    'model_type': model_type,
                    'quantization_level': quantization_level,
                    'source_lang': source_lang,
                    'target_lang': target_lang,
                    'original_text': text,
                    'translated_text': None,
                    'translation_time': 0,
                    'success': False,
                    'error': str(e)
                })
                
                print(f"    ❌ Erreur traduction {i + 1}: {e}")
            
            # Attendre l'intervalle (sauf pour la dernière)
            if i < total_translations - 1:
                await asyncio.sleep(interval)
        
        # Calculer les statistiques
        total_time = time.time() - start_test_time
        actual_tps = translations_completed / total_time if total_time > 0 else 0
        
        # Statistiques des temps de traduction
        if translation_times:
            avg_translation_time = statistics.mean(translation_times)
            min_translation_time = min(translation_times)
            max_translation_time = max(translation_times)
            p95_translation_time = statistics.quantiles(translation_times, n=20)[18] if len(translation_times) >= 20 else max_translation_time
        else:
            avg_translation_time = min_translation_time = max_translation_time = p95_translation_time = 0
        
        print(f"\n  📊 Résultats {model_type} {quantization_level}:")
        print(f"     Temps total: {total_time:.3f}s")
        print(f"     Traductions réussies: {translations_completed}")
        print(f"     Erreurs: {errors}")
        print(f"     TPS réel: {actual_tps:.2f}")
        print(f"     Temps moyen: {avg_translation_time:.3f}s")
        print(f"     Temps min: {min_translation_time:.3f}s")
        print(f"     Temps max: {max_translation_time:.3f}s")
        print(f"     P95: {p95_translation_time:.3f}s")
        
        # Nettoyer
        await service.cleanup()
        
        return {
            'model_type': model_type,
            'quantization_level': quantization_level,
            'init_time': init_time,
            'total_time': total_time,
            'translations_completed': translations_completed,
            'errors': errors,
            'actual_tps': actual_tps,
            'target_tps': target_tps,
            'avg_translation_time': avg_translation_time,
            'min_translation_time': min_translation_time,
            'max_translation_time': max_translation_time,
            'p95_translation_time': p95_translation_time,
            'success_rate': (translations_completed / total_translations) * 100 if total_translations > 0 else 0,
            'translations_log': translations_log  # Nouveau: inclure les logs
        }
        
    except Exception as e:
        print(f"❌ Erreur test {model_type} {quantization_level}: {e}")
        return None

async def run_all_tests():
    """Lance tous les tests de performance"""
    print("🧪 TEST DE PERFORMANCE AVANCÉ - CHARGE CONTINUE")
    print("=" * 60)
    
    # Configuration des tests
    test_duration = 3   # secondes
    target_tps = 3      # traductions par seconde
    
    # Modèles et quantifications à tester
    models = ['basic', 'medium', 'premium']
    quantizations = ['float32', 'float16', 'int8']
    
    results = []
    
    # Lancer tous les tests
    for model in models:
        for quantization in quantizations:
            result = await test_model_performance(model, quantization, test_duration, target_tps)
            if result:
                results.append(result)
    
    # Générer le rapport
    generate_report(results, test_duration, target_tps)

def generate_report(results: List[Dict], test_duration: int, target_tps: int):
    """Génère un rapport de synthèse"""
    print(f"\n📊 RAPPORT DE SYNTHÈSE")
    print("=" * 60)
    print(f"⏱️  Durée de test: {test_duration}s")
    print(f"🎯 TPS cible: {target_tps}")
    print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if not results:
        print("❌ Aucun résultat à analyser")
        return
    
    # Tableau des résultats
    print(f"\n📋 RÉSULTATS DÉTAILLÉS:")
    print("-" * 120)
    print(f"{'Modèle':<8} {'Quant.':<8} {'TPS':<6} {'Temps moy.':<10} {'P95':<8} {'Succès':<6} {'Erreurs':<8}")
    print("-" * 120)
    
    for result in results:
        print(f"{result['model_type']:<8} {result['quantization_level']:<8} "
              f"{result['actual_tps']:<6.2f} {result['avg_translation_time']:<10.3f} "
              f"{result['p95_translation_time']:<8.3f} {result['success_rate']:<6.1f}% "
              f"{result['errors']:<8}")
    
    # Analyse comparative
    print(f"\n🏆 ANALYSE COMPARATIVE:")
    print("-" * 60)
    
    # Meilleur TPS
    best_tps = max(results, key=lambda x: x['actual_tps'])
    print(f"🥇 Meilleur TPS: {best_tps['model_type']} {best_tps['quantization_level']} ({best_tps['actual_tps']:.2f})")
    
    # Plus rapide (temps moyen)
    fastest = min(results, key=lambda x: x['avg_translation_time'])
    print(f"⚡ Plus rapide: {fastest['model_type']} {fastest['quantization_level']} ({fastest['avg_translation_time']:.3f}s)")
    
    # Meilleur taux de succès
    most_reliable = max(results, key=lambda x: x['success_rate'])
    print(f"🛡️  Plus fiable: {most_reliable['model_type']} {most_reliable['quantization_level']} ({most_reliable['success_rate']:.1f}%)")
    
    # Recommandations
    print(f"\n💡 RECOMMANDATIONS:")
    print("-" * 30)
    
    # Pour la production (équilibre performance/fiabilité)
    production_candidates = [r for r in results if r['success_rate'] >= 95 and r['actual_tps'] >= target_tps * 0.8]
    if production_candidates:
        best_production = max(production_candidates, key=lambda x: x['actual_tps'])
        print(f"🏭 Production: {best_production['model_type']} {best_production['quantization_level']}")
    
    # Pour les performances maximales
    print(f"🚀 Performance max: {best_tps['model_type']} {best_tps['quantization_level']}")
    
    # Sauvegarder les résultats
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # 1. Fichier JSON avec résultats complets
    json_filename = f"performance_results_{timestamp}.json"
    with open(json_filename, 'w') as f:
        json.dump({
            'test_config': {
                'duration': test_duration,
                'target_tps': target_tps,
                'timestamp': datetime.now().isoformat()
            },
            'results': results
        }, f, indent=2)
    
    # 2. Fichier CSV détaillé avec toutes les traductions
    csv_filename = f"translations_log_{timestamp}.csv"
    import csv
    
    with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = [
            'request_id', 'request_timestamp', 'response_timestamp',
            'model_type', 'quantization_level', 'source_lang', 'target_lang',
            'original_text', 'translated_text', 'translation_time', 'success', 'error'
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        # Écrire toutes les traductions de tous les tests
        for result in results:
            if 'translations_log' in result:
                for log_entry in result['translations_log']:
                    writer.writerow(log_entry)
    
    # 3. Fichier texte lisible avec traductions formatées
    txt_filename = f"translations_readable_{timestamp}.txt"
    with open(txt_filename, 'w', encoding='utf-8') as f:
        f.write("RAPPORT DE TRADUCTIONS DÉTAILLÉ\n")
        f.write("=" * 50 + "\n")
        f.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Durée de test: {test_duration}s\n")
        f.write(f"TPS cible: {target_tps}\n\n")
        
        for result in results:
            if 'translations_log' in result:
                f.write(f"\n{result['model_type'].upper()} - {result['quantization_level'].upper()}\n")
                f.write("-" * 40 + "\n")
                f.write(f"TPS réel: {result['actual_tps']:.2f}\n")
                f.write(f"Temps moyen: {result['avg_translation_time']:.3f}s\n")
                f.write(f"Succès: {result['success_rate']:.1f}%\n\n")
                
                for i, log_entry in enumerate(result['translations_log'], 1):
                    f.write(f"Traduction #{log_entry['request_id']}\n")
                    f.write(f"  Direction: {log_entry['source_lang']} → {log_entry['target_lang']}\n")
                    f.write(f"  Original: {log_entry['original_text']}\n")
                    if log_entry['success']:
                        f.write(f"  Traduit:  {log_entry['translated_text']}\n")
                        f.write(f"  Temps:    {log_entry['translation_time']:.3f}s\n")
                    else:
                        f.write(f"  ERREUR:   {log_entry.get('error', 'Erreur inconnue')}\n")
                    f.write("\n")
    
    print(f"\n💾 Fichiers sauvegardés:")
    print(f"  📊 Résultats JSON: {json_filename}")
    print(f"  📋 Log CSV: {csv_filename}")
    print(f"  📖 Rapport lisible: {txt_filename}")
    print(f"\n📝 Pour vérifier la qualité des traductions:")
    print(f"  → Ouvrir {txt_filename} pour lecture facile")
    print(f"  → Ouvrir {csv_filename} dans Excel/LibreOffice")

if __name__ == "__main__":
    asyncio.run(run_all_tests())
