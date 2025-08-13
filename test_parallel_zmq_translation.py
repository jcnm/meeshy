#!/usr/bin/env python3
"""
Test de traduction parallèle ZMQ pour vérifier la correction de l'erreur "Already borrowed"
Tests multiple requêtes simultanées pour stresser les tokenizers thread-local
"""

import asyncio
import json
import zmq
import zmq.asyncio
import time
import threading
import concurrent.futures
from typing import List, Dict, Any
from dataclasses import dataclass

@dataclass
class TranslationTestResult:
    success: bool
    processing_time: float
    translated_text: str = ""
    error_message: str = ""
    target_language: str = ""
    source_text: str = ""

class ParallelZMQTranslationTester:
    """Testeur de traductions parallèles via ZMQ"""
    
    def __init__(self):
        self.context = zmq.asyncio.Context()
        self.pub_socket = None
        self.sub_socket = None
        self.results = []
        self.errors = []
        
    async def setup_sockets(self):
        """Configure les sockets ZMQ pour se connecter au service translator existant"""
        # Socket pour envoyer des requêtes au Translator (port 5557)
        self.pub_socket = self.context.socket(zmq.PUB)
        self.pub_socket.connect("tcp://localhost:5557")
        print("🔌 Socket PUB connecté au port 5557 (Test → Translator)")
        
        # Socket pour recevoir les résultats du Translator (port 5555)
        self.sub_socket = self.context.socket(zmq.SUB)
        self.sub_socket.connect("tcp://localhost:5555")
        self.sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")
        print("🔌 Socket SUB connecté au port 5555 (Translator → Test)")
        
        # Attendre l'établissement des connexions
        print("⏳ Attente établissement des connexions ZMQ...")
        await asyncio.sleep(3)
    
    async def send_translation_request(self, request_id: str, text: str, source_lang: str, target_langs: List[str], model_type: str = "basic") -> None:
        """Envoie une requête de traduction via ZMQ"""
        request = {
            "taskId": f"parallel-test-{request_id}",
            "messageId": f"msg-{request_id}",
            "text": text,
            "sourceLanguage": source_lang,
            "targetLanguages": target_langs,
            "conversationId": f"test-conv-{request_id}",
            "modelType": model_type,
            "timestamp": time.time()
        }
        
        await self.pub_socket.send(json.dumps(request).encode('utf-8'))
        print(f"📤 Requête {request_id} envoyée: '{text}' ({source_lang} → {target_langs})")
    
    async def listen_for_results(self, expected_results: int, timeout: float = 30.0) -> List[TranslationTestResult]:
        """Écoute les résultats de traduction"""
        results = []
        start_time = time.time()
        
        print(f"🎧 Écoute de {expected_results} résultats (timeout: {timeout}s)...")
        
        while len(results) < expected_results:
            try:
                remaining_time = timeout - (time.time() - start_time)
                if remaining_time <= 0:
                    print(f"⏰ Timeout global atteint ({timeout}s)")
                    break
                
                message = await asyncio.wait_for(
                    self.sub_socket.recv(), 
                    timeout=min(5.0, remaining_time)
                )
                result_data = json.loads(message.decode('utf-8'))
                
                if result_data.get('type') == 'translation_completed':
                    result = result_data['result']
                    test_result = TranslationTestResult(
                        success=True,
                        processing_time=result.get('processingTime', 0.0),
                        translated_text=result.get('translatedText', ''),
                        target_language=result.get('targetLanguage', ''),
                        source_text=result.get('originalText', '')
                    )
                    results.append(test_result)
                    print(f"✅ Résultat {len(results)}: '{test_result.translated_text}' ({test_result.target_language}) - {test_result.processing_time:.3f}s")
                    
                elif result_data.get('type') == 'translation_error':
                    error_result = TranslationTestResult(
                        success=False,
                        processing_time=0.0,
                        error_message=result_data.get('error', 'Erreur inconnue')
                    )
                    results.append(error_result)
                    print(f"❌ Erreur {len(results)}: {error_result.error_message}")
                    
            except asyncio.TimeoutError:
                print(f"⏰ Timeout ponctuel (résultats reçus: {len(results)}/{expected_results})")
                continue
            except Exception as e:
                print(f"❌ Erreur réception: {e}")
                break
        
        return results
    
    async def test_single_parallel_batch(self, batch_id: int, texts: List[str], source_lang: str, target_langs: List[str], model_type: str = "basic") -> List[TranslationTestResult]:
        """Test un batch de traductions parallèles"""
        print(f"\n🧪 Batch {batch_id}: {len(texts)} textes × {len(target_langs)} langues = {len(texts) * len(target_langs)} traductions")
        
        # Envoyer toutes les requêtes rapidement (parallélisme)
        start_time = time.time()
        for i, text in enumerate(texts):
            request_id = f"{batch_id}-{i}"
            await self.send_translation_request(request_id, text, source_lang, target_langs, model_type)
            await asyncio.sleep(0.1)  # Petit délai pour éviter la saturation
        
        send_time = time.time() - start_time
        expected_results = len(texts) * len(target_langs)
        
        print(f"📊 {len(texts)} requêtes envoyées en {send_time:.3f}s")
        
        # Écouter tous les résultats
        results = await self.listen_for_results(expected_results, timeout=60.0)
        
        return results
    
    async def run_stress_test(self, num_batches: int = 3, texts_per_batch: int = 5, delay_between_batches: float = 2.0):
        """Lance un test de stress complet"""
        print(f"🚀 TEST DE STRESS TRADUCTION PARALLÈLE ZMQ")
        print(f"📊 Configuration: {num_batches} batches × {texts_per_batch} textes")
        print("="*70)
        
        await self.setup_sockets()
        
        # Textes de test variés
        test_texts = [
            "Bonjour le monde !",
            "Ceci est un test de traduction parallèle.",
            "L'intelligence artificielle transforme notre société.",
            "Les tokenizers thread-local permettent d'éviter les erreurs de concurrence.",
            "Cette traduction doit fonctionner sans erreur 'Already borrowed'.",
            "Test de performance avec plusieurs modèles ML simultanés.",
            "La technologie ZMQ offre une communication haute performance.",
            "Chaque thread dispose de son propre tokenizer pour éviter les conflits."
        ]
        
        target_languages = ["en", "es", "de", "pt"]
        source_language = "fr"
        
        all_results = []
        total_start_time = time.time()
        
        for batch_id in range(num_batches):
            # Sélectionner des textes pour ce batch
            batch_texts = test_texts[batch_id * texts_per_batch:(batch_id + 1) * texts_per_batch]
            if not batch_texts:
                batch_texts = test_texts[:texts_per_batch]  # Réutiliser si pas assez
            
            # Tester différents modèles
            model_type = ["basic", "medium", "premium"][batch_id % 3]
            
            batch_results = await self.test_single_parallel_batch(
                batch_id, batch_texts, source_language, target_languages, model_type
            )
            all_results.extend(batch_results)
            
            # Délai entre les batches
            if batch_id < num_batches - 1:
                print(f"⏸️ Pause {delay_between_batches}s avant le batch suivant...")
                await asyncio.sleep(delay_between_batches)
        
        total_time = time.time() - total_start_time
        
        # Analyse des résultats
        self.analyze_results(all_results, total_time)
        
    def analyze_results(self, results: List[TranslationTestResult], total_time: float):
        """Analyse et affiche les résultats du test"""
        print(f"\n📊 ANALYSE DES RÉSULTATS")
        print("="*50)
        
        successful = [r for r in results if r.success]
        failed = [r for r in results if not r.success]
        
        print(f"📈 Total des traductions: {len(results)}")
        print(f"✅ Succès: {len(successful)} ({len(successful)/len(results)*100:.1f}%)")
        print(f"❌ Échecs: {len(failed)} ({len(failed)/len(results)*100:.1f}%)")
        
        if successful:
            processing_times = [r.processing_time for r in successful]
            avg_time = sum(processing_times) / len(processing_times)
            min_time = min(processing_times)
            max_time = max(processing_times)
            
            print(f"⏱️ Temps de traitement:")
            print(f"   Moyenne: {avg_time:.3f}s")
            print(f"   Min: {min_time:.3f}s")
            print(f"   Max: {max_time:.3f}s")
        
        print(f"🕐 Temps total: {total_time:.3f}s")
        print(f"⚡ Débit: {len(results)/total_time:.1f} traductions/seconde")
        
        # Vérifier les erreurs "Already borrowed"
        borrowed_errors = [r for r in failed if "already borrowed" in r.error_message.lower()]
        if borrowed_errors:
            print(f"\n❌ ERREURS 'Already borrowed' détectées: {len(borrowed_errors)}")
            print("🚨 Le problème de concurrence des tokenizers n'est pas résolu !")
        else:
            print(f"\n✅ Aucune erreur 'Already borrowed' détectée !")
            print("🎉 Les tokenizers thread-local fonctionnent correctement !")
        
        if failed:
            print(f"\n📋 Détail des erreurs ({len(failed)}):")
            for i, fail in enumerate(failed[:5]):  # Afficher max 5 erreurs
                print(f"   {i+1}. {fail.error_message}")
            if len(failed) > 5:
                print(f"   ... et {len(failed)-5} autres erreurs")
    
    async def cleanup(self):
        """Nettoie les ressources"""
        if self.pub_socket:
            self.pub_socket.close()
        if self.sub_socket:
            self.sub_socket.close()
        self.context.term()
        print("✅ Ressources ZMQ nettoyées")

async def main():
    """Fonction principale de test"""
    tester = ParallelZMQTranslationTester()
    
    try:
        print("🧪 Test de traduction parallèle ZMQ pour vérifier les tokenizers thread-local")
        print("🎯 Objectif: S'assurer qu'aucune erreur 'Already borrowed' ne se produit")
        print("⚠️  Assurez-vous que le service translator est démarré (./translator.sh)")
        
        input("\n⏸️ Appuyez sur Entrée pour commencer le test...")
        
        await tester.run_stress_test(
            num_batches=5,
            texts_per_batch=4,
            delay_between_batches=1.0
        )
        
    except KeyboardInterrupt:
        print("\n🛑 Test interrompu par l'utilisateur")
    except Exception as e:
        print(f"❌ Erreur fatale: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await tester.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
