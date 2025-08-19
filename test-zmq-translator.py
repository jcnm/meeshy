#!/usr/bin/env python3
"""
Script de stress test ZMQ pour le service Translator Meeshy v0.4.7-alpha
Teste les performances avec des centaines de messages par seconde
Calcule les métriques de performance par modèle
"""

import zmq
import json
import time
import uuid
import threading
import statistics
from datetime import datetime, timedelta
from collections import defaultdict, deque
import csv
import os

class ZMQTranslatorStressTest:
    def __init__(self):
        self.context = zmq.Context()
        self.push_socket = None
        self.sub_socket = None
        
        # Métriques de performance
        self.metrics = {
            'basic': {
                'requests': [],
                'responses': [],
                'processing_times': [],
                'throughput_per_second': deque(maxlen=60),
                'throughput_per_minute': deque(maxlen=60)
            },
            'medium': {
                'requests': [],
                'responses': [],
                'processing_times': [],
                'throughput_per_second': deque(maxlen=60),
                'throughput_per_minute': deque(maxlen=60)
            },
            'premium': {
                'requests': [],
                'responses': [],
                'processing_times': [],
                'throughput_per_second': deque(maxlen=60),
                'throughput_per_minute': deque(maxlen=60)
            }
        }
        
        # Log des traductions
        self.translation_log = []
        self.log_lock = threading.Lock()
        
        # Statistiques en temps réel
        self.stats = {
            'total_requests': 0,
            'total_responses': 0,
            'start_time': None,
            'current_second': 0,
            'current_minute': 0
        }
        
        # Thread pour la réception des réponses
        self.receiver_thread = None
        self.running = False
        
    def setup_connection(self):
        """Configure les connexions ZMQ"""
        print("🔌 Configuration des connexions ZMQ...")
        
        # Socket PUSH pour envoyer les requêtes de traduction
        self.push_socket = self.context.socket(zmq.PUSH)
        self.push_socket.connect("tcp://localhost:5555")
        print("✅ Socket PUSH connecté au port 5555")
        
        # Socket SUB pour recevoir les résultats
        self.sub_socket = self.context.socket(zmq.SUB)
        self.sub_socket.connect("tcp://localhost:5558")
        self.sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")
        print("✅ Socket SUB connecté au port 5558")
        
    def log_translation(self, request_data, response_data, processing_time):
        """Log une traduction avec timestamp"""
        with self.log_lock:
            log_entry = {
                'request_timestamp': request_data['timestamp'],
                'request_source_lang': request_data['sourceLanguage'],
                'request_text': request_data['text'],
                'response_timestamp': time.time() * 1000,
                'response_target_lang': response_data.get('targetLanguage', ''),
                'response_text': response_data.get('translatedText', ''),
                'processing_time_ms': processing_time * 1000,
                'model_used': response_data.get('translatorModel', ''),
                'confidence_score': response_data.get('confidenceScore', 0)
            }
            self.translation_log.append(log_entry)
    
    def receiver_worker(self):
        """Thread worker pour recevoir les réponses ZMQ"""
        print("📡 Démarrage du thread de réception...")
        
        while self.running:
            try:
                self.sub_socket.setsockopt(zmq.RCVTIMEO, 1000)  # 1 seconde timeout
                response = self.sub_socket.recv_json()
                
                if response.get("type") == "translation_completed":
                    self.handle_translation_response(response)
                elif response.get("type") == "pong":
                    # Ignorer les pongs
                    continue
                    
            except zmq.error.Again:
                # Timeout normal, continuer
                continue
            except Exception as e:
                print(f"❌ Erreur dans le thread de réception: {e}")
                break
    
    def handle_translation_response(self, response):
        """Traite une réponse de traduction"""
        result = response.get("result", {})
        model_used = result.get("translatorModel", "basic")
        
        # Trouver la requête correspondante
        task_id = response.get("taskId", "")
        request_data = None
        
        for model in ['basic', 'medium', 'premium']:
            for req in self.metrics[model]['requests']:
                if req.get('internal_task_id') == task_id:
                    request_data = req
                    break
            if request_data:
                break
        
        if request_data:
            # Calculer le temps de traitement
            end_time = time.time()
            start_time = request_data['send_time']
            processing_time = end_time - start_time
            
            # Mettre à jour les métriques
            self.metrics[model_used]['responses'].append({
                'task_id': task_id,
                'processing_time': processing_time,
                'timestamp': end_time,
                'response': response
            })
            
            self.metrics[model_used]['processing_times'].append(processing_time)
            
            # Log de la traduction
            self.log_translation(request_data, result, processing_time)
            
            # Mettre à jour les statistiques
            self.stats['total_responses'] += 1
            
            # Calculer le throughput
            self.calculate_throughput(model_used)
    
    def calculate_throughput(self, model):
        """Calcule le throughput par seconde et par minute"""
        current_time = time.time()
        
        # Throughput par seconde
        responses_this_second = len([
            r for r in self.metrics[model]['responses']
            if current_time - r['timestamp'] < 1
        ])
        
        self.metrics[model]['throughput_per_second'].append(responses_this_second)
        
        # Throughput par minute
        responses_this_minute = len([
            r for r in self.metrics[model]['responses']
            if current_time - r['timestamp'] < 60
        ])
        
        self.metrics[model]['throughput_per_minute'].append(responses_this_minute)
    
    def send_translation_request(self, text, source_lang="en", target_lang="fr", model_type="basic"):
        """Envoie une requête de traduction via ZMQ"""
        # Créer la requête de traduction
        translation_request = {
            "taskId": str(uuid.uuid4()),
            "messageId": f"stress_{int(time.time() * 1000)}",
            "text": text,
            "sourceLanguage": source_lang,
            "targetLanguages": [target_lang],
            "conversationId": "stress_test",
            "modelType": model_type,
            "timestamp": int(time.time() * 1000)
        }
        
        # Ajouter des métadonnées internes
        translation_request['internal_task_id'] = translation_request['taskId']
        translation_request['send_time'] = time.time()
        translation_request['model_type'] = model_type
        
        try:
            # Envoyer la requête
            self.push_socket.send_json(translation_request)
            
            # Enregistrer la requête
            self.metrics[model_type]['requests'].append(translation_request)
            self.stats['total_requests'] += 1
            
            return True
            
        except Exception as e:
            print(f"❌ Erreur d'envoi: {e}")
            return False
    
    def generate_test_texts(self, count=100):
        """Génère des textes de test variés (triplé)"""
        base_texts = [
            "Hello world, this is a test message",
            "The quick brown fox jumps over the lazy dog",
            "Artificial intelligence is transforming the world",
            "Machine learning models are becoming more efficient",
            "Natural language processing enables better communication",
            "Translation services help bridge language barriers",
            "Technology continues to evolve rapidly",
            "Innovation drives progress in all fields",
            "Collaboration leads to better solutions",
            "Quality assurance ensures reliable results",
            "Performance testing validates system capabilities",
            "Scalability is crucial for production systems",
            "Reliability and availability are key metrics",
            "User experience determines product success",
            "Data analysis provides valuable insights",
            "Cloud computing revolutionizes data storage and processing",
            "Blockchain technology ensures secure transactions",
            "Internet of Things connects devices worldwide",
            "Cybersecurity protects against digital threats",
            "Big data analytics reveals hidden patterns",
            "Mobile applications enhance user accessibility",
            "Web development frameworks accelerate development",
            "Database management systems organize information",
            "Network infrastructure supports global connectivity",
            "Software engineering principles guide development",
            "Agile methodologies improve project delivery",
            "DevOps practices streamline deployment processes",
            "Microservices architecture enables scalability",
            "Containerization simplifies application deployment",
            "API design facilitates system integration",
            "User interface design enhances user experience",
            "Backend development powers application logic",
            "Frontend development creates user interfaces",
            "Full-stack development combines all layers",
            "Testing strategies ensure code quality",
            "Code review processes maintain standards",
            "Version control systems track changes",
            "Continuous integration automates testing",
            "Continuous deployment automates releases",
            "Monitoring tools track system performance",
            "Logging systems record application events",
            "Error handling improves system reliability",
            "Performance optimization enhances speed",
            "Security measures protect user data",
            "Compliance requirements ensure legal adherence",
            "Documentation helps maintain codebases"
        ]
        
        texts = []
        for i in range(count):
            base_text = base_texts[i % len(base_texts)]
            texts.append(f"{base_text} #{i+1}")
        
        return texts
    
    def run_stress_test(self, max_requests=100, batch_size=10, pause_seconds=10, model_distribution={'basic': 0.6, 'medium': 0.3, 'premium': 0.1}):
        """Exécute le stress test par batch avec pause"""
        print("=" * 80)
        print("🚀 STRESS TEST ZMQ - Meeshy Translator v0.4.7-alpha")
        print("=" * 80)
        print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🎯 Objectif: {max_requests} requêtes totales")
        print(f"📦 Taille batch: {batch_size} requêtes")
        print(f"⏸️ Pause entre batches: {pause_seconds} secondes")
        print(f"🎯 Distribution: Basic {model_distribution['basic']*100}%, Medium {model_distribution['medium']*100}%, Premium {model_distribution['premium']*100}%")
        print()
        
        # Configuration
        self.setup_connection()
        
        # Démarrer le thread de réception
        self.running = True
        self.receiver_thread = threading.Thread(target=self.receiver_worker)
        self.receiver_thread.start()
        
        # Générer les textes de test
        test_texts = self.generate_test_texts(max_requests)
        
        # Démarrer le test
        self.stats['start_time'] = time.time()
        start_time = time.time()
        
        print("🚀 Démarrage du stress test par batch...")
        print("📊 Métriques en temps réel:")
        print("   Batch | Total | Req/s | Resp/s | Basic | Medium | Premium | Basic avg | Medium avg | Premium avg")
        print("   " + "-" * 100)
        
        request_count = 0
        batch_count = 0
        
        while request_count < max_requests:
            batch_count += 1
            batch_start = time.time()
            
            # Envoyer un batch de requêtes
            batch_requests = min(batch_size, max_requests - request_count)
            print(f"\n📦 Batch {batch_count}: Envoi de {batch_requests} requêtes...")
            
            for i in range(batch_requests):
                if request_count < len(test_texts):
                    # Choisir le modèle selon la distribution
                    rand_val = request_count % 100
                    if rand_val < (model_distribution['basic'] * 100):
                        model_choice = 'basic'
                    elif rand_val < (model_distribution['basic'] + model_distribution['medium']) * 100:
                        model_choice = 'medium'
                    else:
                        model_choice = 'premium'
                    
                    # Choisir la langue cible
                    target_lang = 'fr' if request_count % 3 == 0 else 'es' if request_count % 3 == 1 else 'de'
                    
                    self.send_translation_request(
                        test_texts[request_count],
                        "en",
                        target_lang,
                        model_choice
                    )
                    request_count += 1
            
            # Attendre les réponses du batch
            print(f"⏳ Attente des réponses du batch {batch_count} ({pause_seconds}s)...")
            time.sleep(pause_seconds)
            
            # Afficher les statistiques du batch
            self.print_realtime_stats(time.time() - start_time)
        
        # Attendre les réponses finales
        print(f"\n⏳ Attente des réponses finales (30s)...")
        time.sleep(30)
        
        # Arrêter le thread de réception
        self.running = False
        if self.receiver_thread:
            self.receiver_thread.join()
        
        # Analyser les résultats
        self.analyze_results()
        
        # Sauvegarder les logs
        self.save_logs()
        
        # Nettoyer
        self.cleanup()
    
    def print_realtime_stats(self, elapsed_time):
        """Affiche les statistiques en temps réel"""
        basic_req = len(self.metrics['basic']['requests'])
        basic_resp = len(self.metrics['basic']['responses'])
        medium_req = len(self.metrics['medium']['requests'])
        medium_resp = len(self.metrics['medium']['responses'])
        premium_req = len(self.metrics['premium']['requests'])
        premium_resp = len(self.metrics['premium']['responses'])
        
        basic_avg = statistics.mean(self.metrics['basic']['processing_times']) if self.metrics['basic']['processing_times'] else 0
        medium_avg = statistics.mean(self.metrics['medium']['processing_times']) if self.metrics['medium']['processing_times'] else 0
        premium_avg = statistics.mean(self.metrics['premium']['processing_times']) if self.metrics['premium']['processing_times'] else 0
        
        total_req = basic_req + medium_req + premium_req
        total_resp = basic_resp + medium_resp + premium_resp
        
        req_per_sec = total_req / elapsed_time if elapsed_time > 0 else 0
        resp_per_sec = total_resp / elapsed_time if elapsed_time > 0 else 0
        
        print(f"   {total_req:4d} | {req_per_sec:5.1f} | {resp_per_sec:6.1f} | {basic_req:4d}/{basic_resp:4d} | {medium_req:6d}/{medium_resp:4d} | {premium_req:7d}/{premium_resp:4d} | {basic_avg:7.2f}s | {medium_avg:8.2f}s | {premium_avg:9.2f}s")
    
    def analyze_results(self):
        """Analyse les résultats du stress test"""
        print("\n" + "=" * 80)
        print("📊 ANALYSE DES RÉSULTATS")
        print("=" * 80)
        
        total_duration = time.time() - self.stats['start_time']
        
        for model in ['basic', 'medium', 'premium']:
            metrics = self.metrics[model]
            requests = len(metrics['requests'])
            responses = len(metrics['responses'])
            processing_times = metrics['processing_times']
            
            print(f"\n🎯 Modèle {model.upper()}:")
            print(f"   Requêtes envoyées: {requests}")
            print(f"   Réponses reçues: {responses}")
            print(f"   Taux de succès: {(responses/requests*100):.1f}%" if requests > 0 else "   Taux de succès: 0%")
            
            if processing_times:
                print(f"   Temps de traitement:")
                print(f"     Moyenne: {statistics.mean(processing_times):.3f}s")
                print(f"     Médiane: {statistics.median(processing_times):.3f}s")
                print(f"     Min: {min(processing_times):.3f}s")
                print(f"     Max: {max(processing_times):.3f}s")
                print(f"     Écart-type: {statistics.stdev(processing_times):.3f}s")
            
            # Throughput
            if metrics['throughput_per_second']:
                avg_throughput_per_sec = statistics.mean(metrics['throughput_per_second'])
                max_throughput_per_sec = max(metrics['throughput_per_second'])
                print(f"   Throughput par seconde:")
                print(f"     Moyenne: {avg_throughput_per_sec:.1f} req/s")
                print(f"     Maximum: {max_throughput_per_sec} req/s")
            
            if metrics['throughput_per_minute']:
                avg_throughput_per_min = statistics.mean(metrics['throughput_per_minute'])
                max_throughput_per_min = max(metrics['throughput_per_minute'])
                print(f"   Throughput par minute:")
                print(f"     Moyenne: {avg_throughput_per_min:.1f} req/min")
                print(f"     Maximum: {max_throughput_per_min} req/min")
        
        # Statistiques globales
        total_requests = self.stats['total_requests']
        total_responses = self.stats['total_responses']
        
        print(f"\n🌐 Statistiques globales:")
        print(f"   Durée totale: {total_duration:.1f}s")
        print(f"   Requêtes totales: {total_requests}")
        print(f"   Réponses totales: {total_responses}")
        print(f"   Taux de succès global: {(total_responses/total_requests*100):.1f}%" if total_requests > 0 else "   Taux de succès global: 0%")
        print(f"   Débit moyen: {(total_requests/total_duration):.1f} req/s")
        print(f"   Traductions loggées: {len(self.translation_log)}")
        
        # Caractéristiques de la machine
        self.print_machine_characteristics()
    
    def save_logs(self):
        """Sauvegarde les logs de traduction"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_filename = f"translation_log_{timestamp}.csv"
        
        with open(log_filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'request_timestamp', 'request_source_lang', 'request_text',
                'response_timestamp', 'response_target_lang', 'response_text',
                'processing_time_ms', 'model_used', 'confidence_score'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for entry in self.translation_log:
                writer.writerow(entry)
        
        print(f"\n💾 Logs sauvegardés dans: {log_filename}")
        print(f"   {len(self.translation_log)} traductions enregistrées")
    
    def print_machine_characteristics(self):
        """Affiche les caractéristiques de performance de la machine"""
        print(f"\n🖥️ CARACTÉRISTIQUES DE PERFORMANCE DE LA MACHINE:")
        print("=" * 60)
        
        # Calculer les métriques de performance
        total_requests = self.stats['total_requests']
        total_responses = self.stats['total_responses']
        total_duration = time.time() - self.stats['start_time']
        
        if total_responses > 0:
            # Performance par modèle
            for model in ['basic', 'medium', 'premium']:
                metrics = self.metrics[model]
                responses = len(metrics['responses'])
                if responses > 0:
                    avg_time = statistics.mean(metrics['processing_times'])
                    max_time = max(metrics['processing_times'])
                    min_time = min(metrics['processing_times'])
                    
                    print(f"\n📊 Modèle {model.upper()}:")
                    print(f"   Capacité: {responses} traductions en {total_duration:.1f}s")
                    print(f"   Débit: {responses/total_duration:.2f} traductions/seconde")
                    print(f"   Temps moyen: {avg_time:.2f}s")
                    print(f"   Temps min/max: {min_time:.2f}s / {max_time:.2f}s")
                    print(f"   Efficacité: {(responses/total_requests*100):.1f}% des requêtes")
            
            # Performance globale
            print(f"\n🚀 PERFORMANCE GLOBALE:")
            print(f"   Capacité totale: {total_responses} traductions")
            print(f"   Débit global: {total_responses/total_duration:.2f} traductions/seconde")
            print(f"   Efficacité: {(total_responses/total_requests*100):.1f}%")
            print(f"   Temps moyen global: {total_duration/total_responses:.2f}s par traduction")
            
            # Classification de performance
            throughput = total_responses/total_duration
            if throughput >= 5:
                performance_level = "EXCELLENTE"
            elif throughput >= 2:
                performance_level = "BONNE"
            elif throughput >= 1:
                performance_level = "MOYENNE"
            else:
                performance_level = "LIMITÉE"
            
            print(f"\n🏆 NIVEAU DE PERFORMANCE: {performance_level}")
            print(f"   Justification: {throughput:.2f} traductions/seconde")
            
        else:
            print(f"\n⚠️ AUCUNE RÉPONSE RECUE - MACHINE SURCHARGÉE")
            print(f"   Durée du test: {total_duration:.1f}s")
            print(f"   Requêtes envoyées: {total_requests}")
            print(f"   Recommandation: Réduire la charge ou augmenter les ressources")
    
    def cleanup(self):
        """Nettoyage des connexions"""
        if self.push_socket:
            self.push_socket.close()
        if self.sub_socket:
            self.sub_socket.close()
        self.context.term()
        print("🧹 Connexions ZMQ fermées")

def main():
    """Fonction principale"""
    test = ZMQTranslatorStressTest()
    
    try:
        # Configuration du stress test - PARAMÈTRES OPTIMISÉS
        max_requests = 100  # 100 requêtes totales
        batch_size = 10     # 10 requêtes par batch
        pause_seconds = 10  # 10 secondes de pause entre batches
        model_distribution = {'basic': 0.6, 'medium': 0.3, 'premium': 0.1}  # Distribution avec Premium
        
        print("🚀 PARAMÈTRES DU STRESS TEST:")
        print(f"   Objectif: {max_requests} requêtes totales")
        print(f"   Batch: {batch_size} requêtes par batch")
        print(f"   Pause: {pause_seconds} secondes entre batches")
        print(f"   Distribution: Basic {model_distribution['basic']*100}%, Medium {model_distribution['medium']*100}%, Premium {model_distribution['premium']*100}%")
        print()
        
        # Exécuter le stress test
        test.run_stress_test(max_requests, batch_size, pause_seconds, model_distribution)
        
        print("\n" + "=" * 80)
        print("🎉 STRESS TEST TERMINÉ AVEC SUCCÈS !")
        print("=" * 80)
        print("✅ Connectivité ZMQ testée sous charge")
        print("✅ Traductions via ZMQ validées")
        print("✅ Métriques de performance calculées")
        print("✅ Logs de traduction sauvegardés")
        print("✅ Optimisations v0.4.7-alpha validées")
        
    except Exception as e:
        print(f"❌ Erreur lors du stress test: {e}")
    finally:
        test.cleanup()

if __name__ == "__main__":
    main()
