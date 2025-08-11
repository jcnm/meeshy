#!/usr/bin/env python3
"""
Script pour démarrer le Translator avec la nouvelle architecture PUB/SUB
"""

import asyncio
import sys
import os

# Ajouter le répertoire src au path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from services.zmq_server import ZMQTranslationServer

async def main():
    """Démarre le serveur Translator"""
    print("🚀 Démarrage du Translator avec architecture PUB/SUB")
    print("="*50)
    
    # Configuration
    host = "localhost"
    gateway_pub_port = 5557  # Port PUB du Gateway (requêtes) - Translator SUB se connecte
    gateway_sub_port = 5555  # Port SUB du Gateway (résultats) - Translator PUB se connecte
    
    print(f"� Connexion Gateway PUB: {gateway_pub_port} (réception requêtes)")
    print(f"� Connexion Gateway SUB: {gateway_sub_port} (envoi résultats)")
    print(f"🏊 Pool normale: 10000 items, 3 workers")
    print(f"🏊 Pool 'any': 10000 items, 2 workers")
    print("="*50)
    
    # Créer le serveur
    server = ZMQTranslationServer(
        host=host,
        gateway_pub_port=gateway_pub_port,
        gateway_sub_port=gateway_sub_port,
        normal_pool_size=10000,
        any_pool_size=10000,
        normal_workers=3,
        any_workers=2
    )
    
    try:
        # Initialiser
        await server.initialize()
        
        print("✅ Translator initialisé avec succès")
        print("🎧 En écoute des requêtes de traduction...")
        print("🛑 Appuyez sur Ctrl+C pour arrêter")
        
        # Démarrer le serveur
        await server.start()
        
    except KeyboardInterrupt:
        print("\n🛑 Arrêt demandé par l'utilisateur")
    except Exception as e:
        print(f"❌ Erreur serveur Translator: {e}")
    finally:
        # Arrêter proprement
        await server.stop()
        print("✅ Translator arrêté")

if __name__ == "__main__":
    asyncio.run(main())
