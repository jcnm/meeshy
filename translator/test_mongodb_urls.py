#!/usr/bin/env python3

import asyncio
import os
import sys
import traceback
from pathlib import Path
from urllib.parse import urlparse

print("🔍 Test de différentes variantes d'URL MongoDB...")

# Charger les variables d'environnement depuis ../.env
env_file = Path("../.env")
if env_file.exists():
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    value = value.strip('"\'')
                    os.environ[key] = value

original_url = os.environ.get('DATABASE_URL')
if not original_url:
    print("❌ DATABASE_URL non définie")
    exit(1)

parsed = urlparse(original_url)
host = parsed.hostname
port = parsed.port or 27017
database = parsed.path.lstrip('/') or 'meeshy'
username = parsed.username
password = parsed.password

print(f"📋 URL originale: {original_url[:50]}...")

# Différentes variantes d'URL à tester
url_variants = [
    # Variante 1: Sans authMechanism
    f"mongodb+srv://{username}:{password}@{host}/{database}?replicaSet=replicaset&tls=true",
    
    # Variante 2: Avec SCRAM-SHA-1
    f"mongodb+srv://{username}:{password}@{host}/{database}?replicaSet=replicaset&tls=true&authMechanism=SCRAM-SHA-1",
    
    # Variante 3: Avec SCRAM-SHA-256
    f"mongodb+srv://{username}:{password}@{host}/{database}?replicaSet=replicaset&tls=true&authMechanism=SCRAM-SHA-256",
    
    # Variante 4: Sans TLS
    f"mongodb+srv://{username}:{password}@{host}/{database}?replicaSet=replicaset&authMechanism=SCRAM-SHA-256",
    
    # Variante 5: URL simple
    f"mongodb+srv://{username}:{password}@{host}/{database}",
]

try:
    import pymongo
    
    for i, url in enumerate(url_variants, 1):
        print(f"\n🔧 Test variante {i}: {url[:50]}...")
        
        try:
            client = pymongo.MongoClient(url, serverSelectionTimeoutMS=5000)
            client.admin.command('ping')
            print(f"✅ Variante {i} - Connexion réussie")
            
            # Test de la base de données
            db = client[database]
            collections = db.list_collection_names()
            print(f"✅ Variante {i} - Base accessible, collections: {collections}")
            
            client.close()
            print(f"🎉 Variante {i} fonctionne parfaitement!")
            break
            
        except Exception as e:
            print(f"❌ Variante {i} - Erreur: {str(e)[:100]}...")
            client.close() if 'client' in locals() else None
            
except ImportError:
    print("❌ pymongo non installé")

print("\n✅ Test des variantes terminé")
