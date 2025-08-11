#!/bin/bash

# Script de test de stress pour l'architecture de traduction haute performance
# Teste plusieurs centaines de traductions par minute

set -e

# Configuration
HOST=${ZMQ_HOST:-"localhost"}
PORT=${ZMQ_PORT:-5555}
DURATION=${TEST_DURATION:-60}  # Durée du test en secondes
REQUESTS_PER_MINUTE=${REQUESTS_PER_MINUTE:-600}  # 600 = 10 req/sec
CONCURRENT_REQUESTS=${CONCURRENT_REQUESTS:-50}
LOG_FILE="stress_test_$(date +%Y%m%d_%H%M%S).log"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de logging
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌${NC} $1" | tee -a "$LOG_FILE"
}

# Vérification des dépendances
check_dependencies() {
    log "🔍 Vérification des dépendances..."
    
    if ! command -v python3 &> /dev/null; then
        log_error "Python3 n'est pas installé"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        log_error "curl n'est pas installé"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_warning "jq n'est pas installé, installation des métriques JSON limitée"
    fi
    
    log_success "Dépendances vérifiées"
}

# Test de connectivité
test_connectivity() {
    log "🔌 Test de connectivité vers $HOST:$PORT..."
    
    # Test simple avec netcat si disponible
    if command -v nc &> /dev/null; then
        if timeout 5 nc -z "$HOST" "$PORT" 2>/dev/null; then
            log_success "Connectivité ZMQ OK"
        else
            log_error "Impossible de se connecter à $HOST:$PORT"
            exit 1
        fi
    else
        log_warning "netcat non disponible, test de connectivité ignoré"
    fi
}

# Test de santé du service
test_health() {
    log "🏥 Test de santé du service..."
    
    # Test via l'API REST si disponible
    if curl -s -f "http://$HOST:8000/health" >/dev/null 2>&1; then
        log_success "Service API REST accessible"
    else
        log_warning "Service API REST non accessible, test ZMQ uniquement"
    fi
}

# Création du script Python de test
create_test_script() {
    cat > /tmp/stress_test.py << 'EOF'
#!/usr/bin/env python3
"""
Script de test de stress pour l'architecture de traduction
"""

import asyncio
import json
import time
import zmq
import zmq.asyncio
import random
import statistics
from typing import List, Dict
import signal
import sys

class StressTester:
    def __init__(self, host: str, port: int, duration: int, requests_per_minute: int, concurrent: int):
        self.host = host
        self.port = port
        self.duration = duration
        self.requests_per_minute = requests_per_minute
        self.concurrent = concurrent
        self.context = zmq.asyncio.Context()
        self.socket = None
        self.running = False
        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'latencies': [],
            'start_time': None,
            'end_time': None
        }
        
        # Textes de test
        self.test_texts = [
            "Hello world", "Good morning", "How are you?", "Thank you very much",
            "Have a nice day", "See you later", "What time is it?", "Where are you going?",
            "I love this place", "The weather is beautiful today", "How is everything?",
            "Nice to meet you", "What's your name?", "Where are you from?",
            "Do you speak English?", "I don't understand", "Can you help me?",
            "Excuse me", "I'm sorry", "You're welcome"
        ]
        
        self.language_pairs = [
            ('en', 'fr'), ('en', 'es'), ('fr', 'en'), ('es', 'en'),
            ('en', 'de'), ('en', 'it'), ('fr', 'es'), ('es', 'fr')
        ]
        
        # Gestionnaire de signal pour arrêt propre
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
    
    def signal_handler(self, signum, frame):
        print(f"\n🛑 Signal {signum} reçu, arrêt du test...")
        self.running = False
    
    async def initialize(self):
        """Initialise le client de test"""
        try:
            self.socket = self.context.socket(zmq.REQ)
            self.socket.setsockopt(zmq.LINGER, 1000)
            await self.socket.connect(f"tcp://{self.host}:{self.port}")
            print(f"✅ Connecté à tcp://{self.host}:{self.port}")
        except Exception as e:
            print(f"❌ Erreur connexion: {e}")
            raise
    
    async def send_translation_request(self) -> Dict:
        """Envoie une requête de traduction"""
        try:
            text = random.choice(self.test_texts)
            source_lang, target_lang = random.choice(self.language_pairs)
            
            request = {
                "messageId": f"stress_{int(time.time() * 1000000)}",
                "text": text,
                "sourceLanguage": source_lang,
                "targetLanguage": target_lang,
                "modelType": random.choice(['basic', 'medium', 'premium'])
            }
            
            start_time = time.time()
            await self.socket.send(json.dumps(request).encode('utf-8'))
            response = await self.socket.receive()
            end_time = time.time()
            
            response_data = json.loads(response[0].decode('utf-8'))
            
            return {
                'success': True,
                'latency': (end_time - start_time) * 1000,
                'task_id': response_data.get('taskId'),
                'status': response_data.get('status')
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'latency': 0
            }
    
    async def worker(self, worker_id: int):
        """Worker pour envoyer des requêtes"""
        print(f"👷 Worker {worker_id} démarré")
        
        while self.running:
            try:
                result = await self.send_translation_request()
                
                # Mettre à jour les statistiques
                self.stats['total_requests'] += 1
                if result['success']:
                    self.stats['successful_requests'] += 1
                    self.stats['latencies'].append(result['latency'])
                else:
                    self.stats['failed_requests'] += 1
                
                # Contrôle du débit
                requests_per_second = self.requests_per_minute / 60
                delay = 1.0 / (requests_per_second / self.concurrent)
                await asyncio.sleep(delay)
                
            except Exception as e:
                print(f"❌ Erreur worker {worker_id}: {e}")
                await asyncio.sleep(0.1)
    
    async def run_stress_test(self):
        """Lance le test de stress"""
        print(f"🚀 Démarrage du test de stress:")
        print(f"   • Durée: {self.duration} secondes")
        print(f"   • Requêtes/min: {self.requests_per_minute}")
        print(f"   • Concurrent: {self.concurrent}")
        print(f"   • Objectif: {self.requests_per_minute / 60:.1f} req/sec")
        
        await self.initialize()
        
        self.running = True
        self.stats['start_time'] = time.time()
        
        # Démarrer les workers
        workers = [asyncio.create_task(self.worker(i)) for i in range(self.concurrent)]
        
        # Timer pour arrêter le test
        await asyncio.sleep(self.duration)
        
        # Arrêter les workers
        self.running = False
        self.stats['end_time'] = time.time()
        
        # Attendre la fin des workers
        await asyncio.gather(*workers, return_exceptions=True)
        
        # Afficher les résultats
        self.print_results()
    
    def print_results(self):
        """Affiche les résultats du test"""
        total_time = self.stats['end_time'] - self.stats['start_time']
        actual_rps = self.stats['total_requests'] / total_time
        success_rate = (self.stats['successful_requests'] / self.stats['total_requests']) * 100 if self.stats['total_requests'] > 0 else 0
        
        print("\n" + "="*80)
        print("📊 RÉSULTATS DU TEST DE STRESS")
        print("="*80)
        print(f"⏱️  Durée totale: {total_time:.2f} secondes")
        print(f"📈 Requêtes totales: {self.stats['total_requests']}")
        print(f"✅ Requêtes réussies: {self.stats['successful_requests']}")
        print(f"❌ Requêtes échouées: {self.stats['failed_requests']}")
        print(f"🎯 Taux de succès: {success_rate:.2f}%")
        print(f"🚀 Requêtes par seconde: {actual_rps:.2f}")
        
        if self.stats['latencies']:
            print(f"⏳ Latence moyenne: {statistics.mean(self.stats['latencies']):.2f}ms")
            print(f"⏳ Latence médiane: {statistics.median(self.stats['latencies']):.2f}ms")
            print(f"⏳ Latence min: {min(self.stats['latencies']):.2f}ms")
            print(f"⏳ Latence max: {max(self.stats['latencies']):.2f}ms")
        
        # Évaluation des performances
        target_rps = self.requests_per_minute / 60
        if actual_rps >= target_rps * 0.9:
            print(f"🎉 PERFORMANCE EXCELLENTE: {actual_rps:.2f} req/sec (objectif: {target_rps:.2f})")
        elif actual_rps >= target_rps * 0.7:
            print(f"✅ PERFORMANCE BONNE: {actual_rps:.2f} req/sec (objectif: {target_rps:.2f})")
        else:
            print(f"⚠️ PERFORMANCE INSUFFISANTE: {actual_rps:.2f} req/sec (objectif: {target_rps:.2f})")
        
        print("="*80)
        
        # Sauvegarder les résultats
        results = {
            'timestamp': time.time(),
            'duration': total_time,
            'total_requests': self.stats['total_requests'],
            'successful_requests': self.stats['successful_requests'],
            'failed_requests': self.stats['failed_requests'],
            'success_rate': success_rate,
            'requests_per_second': actual_rps,
            'target_rps': target_rps,
            'latencies': self.stats['latencies'] if len(self.stats['latencies']) <= 1000 else self.stats['latencies'][-1000:]
        }
        
        with open('stress_test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        print("💾 Résultats sauvegardés dans stress_test_results.json")
    
    async def close(self):
        """Ferme le testeur"""
        if self.socket:
            await self.socket.close()
        self.context.term()

async def main():
    """Fonction principale"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Test de stress pour l\'architecture de traduction')
    parser.add_argument('--host', default='localhost', help='Host du service ZMQ')
    parser.add_argument('--port', type=int, default=5555, help='Port du service ZMQ')
    parser.add_argument('--duration', type=int, default=60, help='Durée du test en secondes')
    parser.add_argument('--requests-per-minute', type=int, default=600, help='Requêtes par minute')
    parser.add_argument('--concurrent', type=int, default=50, help='Requêtes concurrentes')
    
    args = parser.parse_args()
    
    tester = StressTester(
        host=args.host,
        port=args.port,
        duration=args.duration,
        requests_per_minute=args.requests_per_minute,
        concurrent=args.concurrent
    )
    
    try:
        await tester.run_stress_test()
    finally:
        await tester.close()

if __name__ == "__main__":
    asyncio.run(main())
EOF

    chmod +x /tmp/stress_test.py
    log_success "Script de test créé"
}

# Fonction principale
main() {
    log "🚀 Démarrage du test de stress haute performance"
    log "Configuration:"
    log "   • Host: $HOST"
    log "   • Port: $PORT"
    log "   • Durée: ${DURATION}s"
    log "   • Requêtes/min: $REQUESTS_PER_MINUTE"
    log "   • Concurrent: $CONCURRENT_REQUESTS"
    log "   • Log: $LOG_FILE"
    
    # Vérifications préalables
    check_dependencies
    test_connectivity
    test_health
    
    # Créer le script de test
    create_test_script
    
    # Lancer le test
    log "🎯 Lancement du test de stress..."
    log "Objectif: ${REQUESTS_PER_MINUTE} requêtes par minute (${REQUESTS_PER_MINUTE}/60 = $(echo "scale=1; $REQUESTS_PER_MINUTE/60" | bc) req/sec)"
    
    start_time=$(date +%s)
    
    # Exécuter le test Python
    if python3 /tmp/stress_test.py \
        --host "$HOST" \
        --port "$PORT" \
        --duration "$DURATION" \
        --requests-per-minute "$REQUESTS_PER_MINUTE" \
        --concurrent "$CONCURRENT_REQUESTS" 2>&1 | tee -a "$LOG_FILE"; then
        
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        
        log_success "Test terminé en ${duration}s"
        
        # Analyser les résultats
        if [ -f "stress_test_results.json" ]; then
            log "📊 Analyse des résultats..."
            
            if command -v jq &> /dev/null; then
                rps=$(jq -r '.requests_per_second' stress_test_results.json)
                success_rate=$(jq -r '.success_rate' stress_test_results.json)
                total_requests=$(jq -r '.total_requests' stress_test_results.json)
                
                log "Résultats:"
                log "   • Requêtes totales: $total_requests"
                log "   • Requêtes/sec: $rps"
                log "   • Taux de succès: ${success_rate}%"
                
                # Évaluation
                target_rps=$(echo "scale=1; $REQUESTS_PER_MINUTE/60" | bc)
                if (( $(echo "$rps >= $target_rps * 0.9" | bc -l) )); then
                    log_success "🎉 PERFORMANCE EXCELLENTE: $rps req/sec (objectif: $target_rps)"
                elif (( $(echo "$rps >= $target_rps * 0.7" | bc -l) )); then
                    log_success "✅ PERFORMANCE BONNE: $rps req/sec (objectif: $target_rps)"
                else
                    log_warning "⚠️ PERFORMANCE INSUFFISANTE: $rps req/sec (objectif: $target_rps)"
                fi
            else
                log "📄 Résultats sauvegardés dans stress_test_results.json"
            fi
        fi
        
    else
        log_error "Test échoué"
        exit 1
    fi
    
    # Nettoyage
    rm -f /tmp/stress_test.py
    
    log_success "Test de stress terminé"
}

# Gestion des arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h                    Affiche cette aide"
        echo "  --host HOST                   Host du service ZMQ (défaut: localhost)"
        echo "  --port PORT                   Port du service ZMQ (défaut: 5555)"
        echo "  --duration SECONDS            Durée du test en secondes (défaut: 60)"
        echo "  --requests-per-minute COUNT   Requêtes par minute (défaut: 600)"
        echo "  --concurrent COUNT            Requêtes concurrentes (défaut: 50)"
        echo ""
        echo "Variables d'environnement:"
        echo "  ZMQ_HOST                      Host du service ZMQ"
        echo "  ZMQ_PORT                      Port du service ZMQ"
        echo "  TEST_DURATION                 Durée du test en secondes"
        echo "  REQUESTS_PER_MINUTE           Requêtes par minute"
        echo "  CONCURRENT_REQUESTS           Requêtes concurrentes"
        echo ""
        echo "Exemples:"
        echo "  $0                                    # Test par défaut (600 req/min)"
        echo "  $0 --requests-per-minute 1200        # Test intensif (1200 req/min)"
        echo "  $0 --duration 300 --concurrent 100   # Test long avec plus de concurrence"
        exit 0
        ;;
    --host)
        HOST="$2"
        shift 2
        ;;
    --port)
        PORT="$2"
        shift 2
        ;;
    --duration)
        DURATION="$2"
        shift 2
        ;;
    --requests-per-minute)
        REQUESTS_PER_MINUTE="$2"
        shift 2
        ;;
    --concurrent)
        CONCURRENT_REQUESTS="$2"
        shift 2
        ;;
esac

# Exécution
main "$@"
