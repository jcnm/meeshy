#!/usr/bin/env python3
"""
Script pour démarrer le Translator avec la nouvelle architecture PUB/SUB
"""

import asyncio
import sys
import os

# Charger les variables d'environnement
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Variables d'environnement .env chargées")
except ImportError:
    print("⚠️ python-dotenv non disponible, utilisation des variables système")

# Ajouter le répertoire src au path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from services.zmq_server import ZMQTranslationServer
from services.unified_ml_service import get_unified_ml_service

async def main():
    """Démarre le serveur Translator"""
    print("🚀 Démarrage du Translator avec architecture PUB/SUB")
    print("="*50)
    
    # Configuration
    host = "0.0.0.0"  # Écouter sur toutes les interfaces pour Docker
    translator_pub_port = 5557  # Port PUB du Translator (requêtes) - Gateway SUB se connecte
    translator_sub_port = 5555  # Port SUB du Translator (résultats) - Gateway PUB se connecte
    
    print(f"🔌 Écoute Translator PUB: {translator_pub_port} (réception requêtes)")
    print(f"🔌 Écoute Translator SUB: {translator_sub_port} (envoi résultats)")
    print(f"🏊 Pool normale: 10000 items, 3 workers")
    print(f"🏊 Pool 'any': 10000 items, 2 workers")
    print("="*50)
    
    # Créer le service ML unifié
    print("🧠 Initialisation du service ML unifié...")
    translation_service = get_unified_ml_service(max_workers=10)
    
    # Initialiser les modèles ML
    print("📚 Chargement des modèles ML...")
    ml_initialized = await translation_service.initialize()
    if ml_initialized:
        print("✅ Modèles ML chargés avec succès")
    else:
        print("⚠️ Modèles ML non disponibles, fonctionnement en mode fallback")
    print("✅ Service de traduction initialisé")
    
    # Créer le serveur ZMQ avec le service de traduction
    server = ZMQTranslationServer(
        host=host,
        gateway_pub_port=translator_pub_port,
        gateway_sub_port=translator_sub_port,
        normal_pool_size=10000,
        any_pool_size=10000,
        normal_workers=3,
        any_workers=2,
        translation_service=translation_service
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
