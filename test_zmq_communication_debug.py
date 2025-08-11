#!/usr/bin/env python3
"""
Script de test pour diagnostiquer la communication ZMQ
"""

import asyncio
import zmq.asyncio
import json
import time
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_zmq_communication():
    """Test la communication ZMQ entre Gateway et Translator"""
    
    logger.info("🧪 Démarrage du test de communication ZMQ")
    
    # Configuration des ports
    GATEWAY_PUB_PORT = 5557  # Gateway publie sur 5557
    TRANSLATOR_PUB_PORT = 5555  # Translator publie sur 5555
    
    try:
        # 1. Créer le contexte ZMQ
        context = zmq.asyncio.Context()
        
        # 2. Socket SUB pour écouter les requêtes envoyées par la Gateway
        logger.info(f"🎧 Création socket SUB pour écouter les requêtes Gateway sur port {GATEWAY_PUB_PORT}")
        sub_socket = context.socket(zmq.SUB)
        sub_socket.connect(f"tcp://localhost:{GATEWAY_PUB_PORT}")
        sub_socket.setsockopt_string(zmq.SUBSCRIBE, "")
        
        # 3. Socket PUB pour simuler les réponses du Translator
        logger.info(f"📤 Création socket PUB pour simuler les réponses Translator sur port {TRANSLATOR_PUB_PORT}")
        pub_socket = context.socket(zmq.PUB)
        pub_socket.bind(f"tcp://localhost:{TRANSLATOR_PUB_PORT}")
        
        logger.info("✅ Sockets ZMQ créés avec succès")
        
        # 4. Attendre un peu pour que les sockets se stabilisent
        await asyncio.sleep(1)
        
        # 5. Écouter les requêtes pendant 10 secondes
        logger.info("🎧 Écoute des requêtes de la Gateway pendant 10 secondes...")
        start_time = time.time()
        
        while time.time() - start_time < 10:
            try:
                # Essayer de recevoir une requête avec timeout
                message = await asyncio.wait_for(sub_socket.recv(), timeout=1.0)
                data = json.loads(message.decode('utf-8'))
                
                logger.info(f"📥 Requête reçue de la Gateway: {data}")
                
                # Simuler une réponse du Translator
                response = {
                    'type': 'translation_result',
                    'taskId': data.get('taskId'),
                    'messageId': data.get('messageId'),
                    'translatedText': f"[TEST-ZMQ] {data.get('text', '')}",
                    'sourceLanguage': data.get('sourceLanguage'),
                    'targetLanguage': data.get('targetLanguages', ['en'])[0],
                    'confidenceScore': 0.95,
                    'processingTime': 0.1,
                    'modelType': data.get('modelType'),
                    'workerName': 'test_worker'
                }
                
                logger.info(f"📤 Envoi réponse simulée: {response}")
                await pub_socket.send(json.dumps(response).encode('utf-8'))
                
            except asyncio.TimeoutError:
                # Pas de message reçu dans le timeout
                continue
            except Exception as e:
                logger.error(f"❌ Erreur lors de la réception: {e}")
                break
        
        logger.info("⏰ Fin de l'écoute")
        
        # 6. Nettoyer
        sub_socket.close()
        pub_socket.close()
        context.term()
        
        logger.info("✅ Test ZMQ terminé")
        
    except Exception as e:
        logger.error(f"❌ Erreur lors du test ZMQ: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(test_zmq_communication())
