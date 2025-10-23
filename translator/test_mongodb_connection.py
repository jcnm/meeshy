#!/usr/bin/env python3
"""
Script de test pour diagnostiquer la connexion MongoDB avec Prisma Client Python
"""
import asyncio
import os
import sys
from datetime import datetime

# Test 1: Connexion directe avec PyMongo
print("=" * 80)
print("TEST 1: Connexion directe avec PyMongo")
print("=" * 80)

try:
    from pymongo import MongoClient
    from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
    
    # URLs à tester
    urls_to_test = [
        "mongodb://localhost:27017/meeshy",
        "mongodb://localhost:27017/meeshy?directConnection=true",
        "mongodb://localhost:27017/meeshy?replicaSet=rs0",
        "mongodb://localhost:27017/meeshy?replicaSet=rs0&directConnection=true",
    ]
    
    for url in urls_to_test:
        print(f"\n📡 Test URL: {url}")
        try:
            # Timeout court pour test rapide
            client = MongoClient(url, serverSelectionTimeoutMS=2000)
            # Ping pour forcer la connexion
            client.admin.command('ping')
            print(f"   ✅ SUCCÈS - Connexion établie")
            
            # Tester l'accès à la base
            db = client.meeshy
            collections = db.list_collection_names()
            print(f"   📚 Collections trouvées: {len(collections)}")
            if collections:
                print(f"      {', '.join(collections[:5])}")
            
            client.close()
        except ServerSelectionTimeoutError as e:
            print(f"   ❌ TIMEOUT - Impossible de se connecter au serveur")
            print(f"      Erreur: {str(e)[:100]}")
        except ConnectionFailure as e:
            print(f"   ❌ ÉCHEC - Erreur de connexion")
            print(f"      Erreur: {str(e)[:100]}")
        except Exception as e:
            print(f"   ❌ ERREUR - {type(e).__name__}")
            print(f"      Erreur: {str(e)[:100]}")

except ImportError:
    print("⚠️  PyMongo n'est pas installé. Installation recommandée:")
    print("   pip install pymongo")

# Test 2: Connexion avec Prisma Client Python
print("\n" + "=" * 80)
print("TEST 2: Connexion avec Prisma Client Python")
print("=" * 80)

async def test_prisma_connection():
    """Test de connexion Prisma avec différentes configurations"""
    
    # Vérifier les variables d'environnement
    print("\n🔍 Variables d'environnement:")
    db_url = os.getenv("DATABASE_URL", "Non définie")
    engine_type = os.getenv("PRISMA_CLIENT_ENGINE_TYPE", "Non définie")
    print(f"   DATABASE_URL: {db_url}")
    print(f"   PRISMA_CLIENT_ENGINE_TYPE: {engine_type}")
    
    try:
        from prisma import Prisma
        
        # Test avec différentes configurations
        configs = [
            {
                "name": "Config par défaut (depuis .env)",
                "prisma": Prisma()
            },
            {
                "name": "Config avec timeout explicite",
                "prisma": Prisma(
                    http={
                        'timeout': 5.0,
                        'limits': {
                            'max_connections': 5,
                            'max_keepalive_connections': 2
                        }
                    }
                )
            }
        ]
        
        for config in configs:
            print(f"\n📡 Test: {config['name']}")
            prisma = config['prisma']
            
            try:
                # Connexion avec timeout asyncio
                print("   ⏳ Tentative de connexion (timeout 10s)...")
                start_time = datetime.now()
                
                await asyncio.wait_for(prisma.connect(), timeout=10.0)
                
                elapsed = (datetime.now() - start_time).total_seconds()
                print(f"   ✅ SUCCÈS - Connexion établie en {elapsed:.2f}s")
                
                # Test d'une requête simple
                try:
                    # Compte le nombre d'utilisateurs (si la collection existe)
                    count = await prisma.user.count()
                    print(f"   📊 Nombre d'utilisateurs: {count}")
                except Exception as e:
                    print(f"   ⚠️  Impossible de compter les users: {type(e).__name__}")
                
                await prisma.disconnect()
                print(f"   🔌 Déconnexion réussie")
                
            except asyncio.TimeoutError:
                print(f"   ❌ TIMEOUT - La connexion a pris plus de 10 secondes")
                print(f"      Le processus semble bloqué à prisma.connect()")
            except Exception as e:
                print(f"   ❌ ERREUR - {type(e).__name__}")
                print(f"      Message: {str(e)[:200]}")
                import traceback
                print(f"      Traceback:")
                traceback.print_exc()
            finally:
                # Assurer la déconnexion
                try:
                    if prisma.is_connected():
                        await prisma.disconnect()
                except:
                    pass
    
    except ImportError as e:
        print(f"\n⚠️  Prisma Client Python n'est pas installé ou généré")
        print(f"   Erreur: {e}")
        print(f"   Commandes requises:")
        print(f"   1. pip install prisma")
        print(f"   2. prisma generate --schema=./schema.prisma")

# Test 3: Vérification de la configuration MongoDB
print("\n" + "=" * 80)
print("TEST 3: Diagnostic de la configuration MongoDB")
print("=" * 80)

try:
    from pymongo import MongoClient
    
    print("\n🔍 Analyse de la configuration du serveur MongoDB:")
    client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
    
    try:
        # Obtenir le statut du replica set
        status = client.admin.command('replSetGetStatus')
        print(f"   ℹ️  MongoDB configuré en REPLICA SET")
        print(f"      Nom du replica set: {status.get('set', 'N/A')}")
        print(f"      Membres: {len(status.get('members', []))}")
    except Exception as e:
        if "not running with --replSet" in str(e):
            print(f"   ℹ️  MongoDB configuré en STANDALONE (pas de replica set)")
            print(f"      ⚠️  IMPORTANT: Ne pas utiliser 'replicaSet=rs0' dans l'URL!")
        else:
            print(f"   ⚠️  Impossible de déterminer la config: {str(e)[:100]}")
    
    # Informations serveur
    server_info = client.server_info()
    print(f"\n📋 Informations serveur:")
    print(f"   Version MongoDB: {server_info.get('version', 'N/A')}")
    print(f"   Uptime: {server_info.get('uptime', 'N/A')}s")
    
    client.close()
    
except Exception as e:
    print(f"❌ Impossible de se connecter au serveur MongoDB local")
    print(f"   Erreur: {str(e)[:100]}")
    print(f"\n💡 Vérifications:")
    print(f"   1. MongoDB est-il démarré? docker ps | grep mongo")
    print(f"   2. Port 27017 accessible? lsof -i :27017")

# Exécution du test Prisma
print("\n" + "=" * 80)
print("EXÉCUTION DES TESTS PRISMA")
print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_prisma_connection())

print("\n" + "=" * 80)
print("TESTS TERMINÉS")
print("=" * 80)
print("\n💡 Recommandations basées sur les résultats:")
print("   1. Si PyMongo fonctionne mais pas Prisma:")
print("      → Vérifier PRISMA_CLIENT_ENGINE_TYPE='binary'")
print("      → Régénérer le client: prisma generate")
print("   2. Si MongoDB est en STANDALONE:")
print("      → Utiliser: DATABASE_URL='mongodb://localhost:27017/meeshy'")
print("   3. Si MongoDB est en REPLICA SET:")
print("      → Utiliser: DATABASE_URL='mongodb://localhost:27017/meeshy?replicaSet=rs0'")
print("   4. Si tous les tests échouent:")
print("      → Vérifier que MongoDB est démarré: docker ps")
