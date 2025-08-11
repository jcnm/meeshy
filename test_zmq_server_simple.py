#!/usr/bin/env python3

import asyncio
import sys
import os
from pathlib import Path

# Ajouter le répertoire src au path
src_path = Path(__file__).parent / "translator" / "src"
sys.path.insert(0, str(src_path))

from services.zmq_server import ZMQTranslationServer

async def test_zmq_server():
    """Test simple du serveur ZMQ"""
    print("🧪 Test du serveur ZMQ...")
    
    try:
        # Créer le serveur ZMQ
        server = ZMQTranslationServer(
            host="localhost",
            port=5555,
            pub_port=5556,
            normal_workers=2,
            any_workers=1
        )
        
        print("✅ Serveur ZMQ créé")
        
        # Initialiser le serveur
        await server.initialize()
        print("✅ Serveur ZMQ initialisé")
        
        # Vérifier l'état
        stats = server.get_stats()
        print(f"📊 Stats: {stats}")
        
        # Démarrer le serveur en arrière-plan
        task = asyncio.create_task(server.start())
        print("✅ Serveur ZMQ démarré en arrière-plan")
        
        # Attendre un peu
        await asyncio.sleep(2)
        
        # Vérifier l'état après démarrage
        stats = server.get_stats()
        print(f"📊 Stats après démarrage: {stats}")
        
        # Arrêter le serveur
        await server.stop()
        print("✅ Serveur ZMQ arrêté")
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_zmq_server())
