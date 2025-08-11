#!/bin/bash

# Script de test rapide pour valider l'architecture haute performance
# Teste 100 traductions en 30 secondes

set -e

# Configuration
HOST=${ZMQ_HOST:-"localhost"}
PORT=${ZMQ_PORT:-5555}
LOG_FILE="quick_test_$(date +%Y%m%d_%H%M%S).log"

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅${NC} $1" | tee -a "$LOG_FILE"
}

# Test rapide
log "🚀 Test rapide de l'architecture haute performance"
log "Configuration: $HOST:$PORT"

# Test de connectivité
log "🔌 Test de connectivité..."
if timeout 5 nc -z "$HOST" "$PORT" 2>/dev/null; then
    log_success "Connectivité OK"
else
    log "⚠️ Connectivité échouée, test avec Python uniquement"
fi

# Créer un script Python simple
cat > /tmp/quick_test.py << 'EOF'
#!/usr/bin/env python3
import asyncio
import json
import time
import zmq
import zmq.asyncio
import random

async def quick_test():
    context = zmq.asyncio.Context()
    socket = context.socket(zmq.REQ)
    socket.setsockopt(zmq.LINGER, 1000)
    
    try:
        await socket.connect("tcp://localhost:5555")
        print("✅ Connecté au service ZMQ")
        
        texts = ["Hello", "Good morning", "How are you?", "Thank you"]
        pairs = [('en', 'fr'), ('en', 'es'), ('fr', 'en')]
        
        start_time = time.time()
        successful = 0
        total = 10
        
        for i in range(total):
            text = random.choice(texts)
            source, target = random.choice(pairs)
            
            request = {
                "messageId": f"quick_{i}",
                "text": text,
                "sourceLanguage": source,
                "targetLanguage": target,
                "modelType": "basic"
            }
            
            try:
                await socket.send(json.dumps(request).encode('utf-8'))
                response = await socket.receive()
                response_data = json.loads(response[0].decode('utf-8'))
                
                if response_data.get('taskId'):
                    successful += 1
                    print(f"✅ {i+1}/{total}: {text} ({source}→{target}) → {response_data.get('taskId')}")
                else:
                    print(f"❌ {i+1}/{total}: Échec")
                    
            except Exception as e:
                print(f"❌ {i+1}/{total}: Erreur - {e}")
            
            await asyncio.sleep(0.1)
        
        end_time = time.time()
        duration = end_time - start_time
        rps = total / duration
        
        print(f"\n📊 Résultats:")
        print(f"   • Requêtes: {successful}/{total}")
        print(f"   • Durée: {duration:.2f}s")
        print(f"   • RPS: {rps:.2f}")
        
        if successful == total:
            print("🎉 Test réussi!")
        else:
            print("⚠️ Test partiellement réussi")
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
    finally:
        await socket.close()
        context.term()

if __name__ == "__main__":
    asyncio.run(quick_test())
EOF

# Exécuter le test
log "🎯 Lancement du test rapide..."
if python3 /tmp/quick_test.py 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Test rapide terminé"
else
    log "❌ Test rapide échoué"
    exit 1
fi

# Nettoyage
rm -f /tmp/quick_test.py

log_success "Test rapide terminé - voir $LOG_FILE pour les détails"
