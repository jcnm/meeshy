#!/bin/bash

# Script de test pour la nouvelle architecture PUB/SUB avec pools FIFO séparées
# Teste l'architecture complète : Gateway -> Translator -> Gateway

set -e

# Configuration
HOST="localhost"
SUB_PORT=5555  # Port pour recevoir les requêtes de traduction
PUB_PORT=5556  # Port pour publier les résultats
DURATION=30    # Durée du test en secondes
REQUESTS_PER_MINUTE=120  # 2 requêtes par seconde
CONCURRENT_REQUESTS=10

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Test de la nouvelle architecture PUB/SUB avec pools FIFO séparées${NC}"
echo -e "${CYAN}Configuration:${NC}"
echo -e "  📡 SUB Port: ${SUB_PORT} (réception requêtes)"
echo -e "  📤 PUB Port: ${PUB_PORT} (publication résultats)"
echo -e "  ⏱️  Durée: ${DURATION} secondes"
echo -e "  🚀 Requêtes/min: ${REQUESTS_PER_MINUTE}"
echo -e "  🔄 Concurrence: ${CONCURRENT_REQUESTS}"
echo ""

# Créer le script Python de test
cat > /tmp/test_new_architecture.py << 'EOF'
import asyncio
import json
import time
import zmq
import zmq.asyncio
import uuid
from typing import Dict, List
import statistics

class NewArchitectureTester:
    def __init__(self, host: str, sub_port: int, pub_port: int):
        self.host = host
        self.sub_port = sub_port
        self.pub_port = pub_port
        self.context = zmq.asyncio.Context()
        
        # Socket PUB pour envoyer les requêtes (Gateway -> Translator)
        self.pub_socket = None
        
        # Socket SUB pour recevoir les résultats (Translator -> Gateway)
        self.sub_socket = None
        
        # Statistiques
        self.stats = {
            'requests_sent': 0,
            'results_received': 0,
            'errors_received': 0,
            'pool_full_rejections': 0,
            'latencies': [],
            'start_time': time.time()
        }
        
        # Cache des requêtes en cours
        self.pending_requests: Dict[str, Dict] = {}
        
    async def initialize(self):
        """Initialise les sockets ZMQ"""
        print("🔧 Initialisation des sockets ZMQ...")
        
        # Socket PUB pour envoyer les requêtes
        self.pub_socket = self.context.socket(zmq.PUB)
        await self.pub_socket.bind(f"tcp://{self.host}:{self.sub_port}")
        
        # Socket SUB pour recevoir les résultats
        self.sub_socket = self.context.socket(zmq.SUB)
        await self.sub_socket.connect(f"tcp://{self.host}:{self.pub_port}")
        await self.sub_socket.subscribe('')  # S'abonner à tous les messages
        
        print("✅ Sockets initialisés")
        
    async def start_result_listener(self):
        """Démarre l'écoute des résultats"""
        print("🎧 Démarrage écoute des résultats...")
        
        while True:
            try:
                message = await self.sub_socket.recv()
                await self._handle_result(message)
            except Exception as e:
                print(f"❌ Erreur réception résultat: {e}")
                break
                
    async def _handle_result(self, message: bytes):
        """Traite un résultat reçu"""
        try:
            data = json.loads(message.decode('utf-8'))
            
            if data.get('type') == 'translation_completed':
                task_id = data.get('taskId')
                result = data.get('result', {})
                target_language = data.get('targetLanguage')
                
                if task_id in self.pending_requests:
                    request_info = self.pending_requests[task_id]
                    latency = time.time() - request_info['timestamp']
                    self.stats['latencies'].append(latency)
                    
                    print(f"✅ Résultat reçu: {task_id} -> {target_language} (latence: {latency:.3f}s)")
                    
                    # Supprimer de la liste des requêtes en cours
                    del self.pending_requests[task_id]
                    
                self.stats['results_received'] += 1
                
            elif data.get('type') == 'translation_error':
                task_id = data.get('taskId')
                error = data.get('error')
                
                if error == 'translation pool full':
                    self.stats['pool_full_rejections'] += 1
                    print(f"⚠️ Pool pleine pour {task_id}")
                else:
                    print(f"❌ Erreur traduction: {error} pour {task_id}")
                    
                self.stats['errors_received'] += 1
                
                # Nettoyer la requête en cours
                if task_id in self.pending_requests:
                    del self.pending_requests[task_id]
                    
        except Exception as e:
            print(f"❌ Erreur traitement résultat: {e}")
            
    async def send_translation_request(self, conversation_id: str, text: str, target_languages: List[str]) -> str:
        """Envoie une requête de traduction"""
        task_id = str(uuid.uuid4())
        
        request = {
            'taskId': task_id,
            'messageId': str(uuid.uuid4()),
            'text': text,
            'sourceLanguage': 'fr',
            'targetLanguages': target_languages,
            'conversationId': conversation_id,
            'modelType': 'basic',
            'timestamp': time.time()
        }
        
        # Envoyer via PUB
        await self.pub_socket.send(json.dumps(request).encode('utf-8'))
        
        # Stocker pour traçabilité
        self.pending_requests[task_id] = {
            'timestamp': time.time(),
            'request': request
        }
        
        self.stats['requests_sent'] += 1
        return task_id
        
    async def run_test(self, duration: int, requests_per_minute: int, concurrent_requests: int):
        """Exécute le test de charge"""
        print(f"🚀 Démarrage test de charge ({duration}s, {requests_per_minute} req/min, {concurrent_requests} concurrent)")
        
        # Démarrer l'écoute des résultats en arrière-plan
        listener_task = asyncio.create_task(self.start_result_listener())
        
        # Calculer l'intervalle entre les requêtes
        interval = 60.0 / requests_per_minute
        
        # Sémaphore pour limiter la concurrence
        semaphore = asyncio.Semaphore(concurrent_requests)
        
        async def send_request():
            async with semaphore:
                # Simuler différents types de conversations
                conversation_types = ['normal', 'any']
                conversation_id = f"test_{conversation_types[self.stats['requests_sent'] % 2]}"
                
                # Simuler différents textes
                texts = [
                    "Bonjour, comment allez-vous ?",
                    "Hello, how are you?",
                    "Hola, ¿cómo estás?",
                    "Ciao, come stai?",
                    "Hallo, wie geht es dir?"
                ]
                
                text = texts[self.stats['requests_sent'] % len(texts)]
                target_languages = ['en', 'es', 'it', 'de']
                
                try:
                    task_id = await self.send_translation_request(conversation_id, text, target_languages)
                    print(f"📤 Requête envoyée: {task_id} ({conversation_id}) -> {target_languages}")
                except Exception as e:
                    print(f"❌ Erreur envoi requête: {e}")
        
        # Boucle principale
        start_time = time.time()
        request_count = 0
        
        while time.time() - start_time < duration:
            # Envoyer les requêtes selon l'intervalle
            if request_count * interval <= time.time() - start_time:
                asyncio.create_task(send_request())
                request_count += 1
                
            await asyncio.sleep(0.01)  # Petite pause pour ne pas surcharger
            
        # Attendre que toutes les requêtes soient traitées
        print("⏳ Attente fin du traitement...")
        await asyncio.sleep(5)
        
        # Annuler l'écouteur
        listener_task.cancel()
        
        # Afficher les résultats
        self._print_results()
        
    def _print_results(self):
        """Affiche les résultats du test"""
        duration = time.time() - self.stats['start_time']
        
        print("\n" + "="*60)
        print("📊 RÉSULTATS DU TEST")
        print("="*60)
        
        print(f"⏱️  Durée totale: {duration:.2f} secondes")
        print(f"📤 Requêtes envoyées: {self.stats['requests_sent']}")
        print(f"📥 Résultats reçus: {self.stats['results_received']}")
        print(f"❌ Erreurs reçues: {self.stats['errors_received']}")
        print(f"⚠️  Rejets pool pleine: {self.stats['pool_full_rejections']}")
        print(f"⏳ Requêtes en cours: {len(self.pending_requests)}")
        
        if self.stats['latencies']:
            print(f"\n📈 LATENCES:")
            print(f"  Moyenne: {statistics.mean(self.stats['latencies']):.3f}s")
            print(f"  Médiane: {statistics.median(self.stats['latencies']):.3f}s")
            print(f"  Min: {min(self.stats['latencies']):.3f}s")
            print(f"  Max: {max(self.stats['latencies']):.3f}s")
            print(f"  Écart-type: {statistics.stdev(self.stats['latencies']):.3f}s")
        
        # Calculer les taux
        success_rate = (self.stats['results_received'] / self.stats['requests_sent']) * 100 if self.stats['requests_sent'] > 0 else 0
        requests_per_second = self.stats['requests_sent'] / duration if duration > 0 else 0
        
        print(f"\n🎯 PERFORMANCE:")
        print(f"  Taux de succès: {success_rate:.1f}%")
        print(f"  Requêtes/seconde: {requests_per_second:.2f}")
        print(f"  Requêtes/minute: {requests_per_second * 60:.2f}")
        
        # Évaluation
        print(f"\n🏆 ÉVALUATION:")
        if success_rate >= 95:
            print(f"  ✅ Excellente fiabilité ({success_rate:.1f}%)")
        elif success_rate >= 90:
            print(f"  🟡 Bonne fiabilité ({success_rate:.1f}%)")
        else:
            print(f"  ❌ Fiabilité insuffisante ({success_rate:.1f}%)")
            
        if requests_per_second >= 10:
            print(f"  ✅ Performance Gateway excellente ({requests_per_second:.2f} req/s)")
        elif requests_per_second >= 5:
            print(f"  🟡 Performance Gateway correcte ({requests_per_second:.2f} req/s)")
        else:
            print(f"  ❌ Performance Gateway insuffisante ({requests_per_second:.2f} req/s)")
            
        if self.stats['pool_full_rejections'] == 0:
            print(f"  ✅ Gestion des pools excellente (0 rejets)")
        elif self.stats['pool_full_rejections'] < self.stats['requests_sent'] * 0.01:
            print(f"  🟡 Gestion des pools correcte ({self.stats['pool_full_rejections']} rejets)")
        else:
            print(f"  ❌ Gestion des pools insuffisante ({self.stats['pool_full_rejections']} rejets)")
        
        print("="*60)
        
    async def close(self):
        """Ferme les connexions"""
        if self.pub_socket:
            await self.pub_socket.close()
        if self.sub_socket:
            await self.sub_socket.close()
        if self.context:
            await self.context.term()

async def main():
    # Configuration depuis les arguments
    import sys
    host = sys.argv[1] if len(sys.argv) > 1 else 'localhost'
    sub_port = int(sys.argv[2]) if len(sys.argv) > 2 else 5555
    pub_port = int(sys.argv[3]) if len(sys.argv) > 3 else 5556
    duration = int(sys.argv[4]) if len(sys.argv) > 4 else 30
    requests_per_minute = int(sys.argv[5]) if len(sys.argv) > 5 else 120
    concurrent_requests = int(sys.argv[6]) if len(sys.argv) > 6 else 10
    
    tester = NewArchitectureTester(host, sub_port, pub_port)
    
    try:
        await tester.initialize()
        await tester.run_test(duration, requests_per_minute, concurrent_requests)
    finally:
        await tester.close()

if __name__ == "__main__":
    asyncio.run(main())
EOF

echo -e "${YELLOW}🔧 Vérification de la disponibilité du Translator...${NC}"

# Vérifier que le Translator est accessible
if ! nc -z $HOST $SUB_PORT 2>/dev/null; then
    echo -e "${RED}❌ Translator non accessible sur $HOST:$SUB_PORT${NC}"
    echo -e "${YELLOW}💡 Assurez-vous que le Translator est démarré avec la nouvelle architecture${NC}"
    exit 1
fi

if ! nc -z $HOST $PUB_PORT 2>/dev/null; then
    echo -e "${RED}❌ Translator non accessible sur $HOST:$PUB_PORT${NC}"
    echo -e "${YELLOW}💡 Assurez-vous que le Translator est démarré avec la nouvelle architecture${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Translator accessible${NC}"
echo ""

# Lancer le test
echo -e "${PURPLE}🚀 Lancement du test de la nouvelle architecture...${NC}"
echo ""

python3 /tmp/test_new_architecture.py $HOST $SUB_PORT $PUB_PORT $DURATION $REQUESTS_PER_MINUTE $CONCURRENT_REQUESTS

# Nettoyer
rm -f /tmp/test_new_architecture.py

echo ""
echo -e "${GREEN}✅ Test terminé${NC}"
echo ""
echo -e "${CYAN}📋 Résumé de l'architecture testée:${NC}"
echo -e "  🔄 Gateway envoie requêtes via PUB (port $SUB_PORT)"
echo -e "  📥 Translator reçoit via SUB et enfile dans pools FIFO"
echo -e "  👷 Workers traitent en parallèle les traductions"
echo -e "  📤 Translator publie résultats via PUB (port $PUB_PORT)"
echo -e "  📥 Gateway reçoit résultats via SUB"
echo -e "  🎯 Pools séparées: normale (3 workers) et 'any' (2 workers)"
echo ""
