#!/usr/bin/env python3

import asyncio
import os
import sys
import traceback
from pathlib import Path

print("🔍 Test des champs du modèle Conversation...")

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

# Ajouter le répertoire du client Prisma au PYTHONPATH
current_dir = Path.cwd()
prisma_client_path = current_dir / 'shared' / 'prisma'
if prisma_client_path.exists():
    sys.path.insert(0, str(prisma_client_path))

try:
    from prisma import Prisma
    
    async def test_conversation_fields():
        try:
            print('🔧 Connexion à la base de données...')
            prisma = Prisma()
            
            try:
                await asyncio.wait_for(prisma.connect(), timeout=10.0)
                print('✅ Connexion Prisma réussie')
            except asyncio.TimeoutError:
                print('❌ Timeout lors de la connexion Prisma (10s)')
                return False
            
            # Test de création d'une conversation simple
            print('🔧 Test de création d\'une conversation...')
            
            conversation = await prisma.conversation.create({
                "type": "global",
                "title": "Test Conversation",
                "description": "Conversation de test"
            })
            
            print(f'✅ Conversation créée avec ID: {conversation.id}')
            
            # Lister les champs disponibles
            print('📋 Champs disponibles dans la conversation:')
            for field in dir(conversation):
                if not field.startswith('_'):
                    value = getattr(conversation, field, None)
                    print(f'  - {field}: {value}')
            
            # Essayer de mettre à jour avec identifier
            print('🔧 Test de mise à jour avec identifier...')
            try:
                updated = await prisma.conversation.update(
                    where={"id": conversation.id},
                    data={"identifier": "test-conversation"}
                )
                print(f'✅ Mise à jour réussie: {updated.identifier}')
            except Exception as e:
                print(f'❌ Erreur mise à jour: {e}')
            
            # Nettoyer
            await prisma.conversation.delete(where={"id": conversation.id})
            print('✅ Conversation de test supprimée')
            
            await prisma.disconnect()
            return True
            
        except Exception as e:
            error_msg = str(e)
            print(f'❌ Erreur: {error_msg}')
            print(f'📋 Détails: {traceback.format_exc()}')
            await prisma.disconnect()
            return False
    
    print("🚀 Lancement du test...")
    result = asyncio.run(test_conversation_fields())
    print(f"📊 Résultat: {result}")
    exit(0 if result else 1)
    
except Exception as e:
    print(f'❌ Erreur import Prisma: {e}')
    print(f'📋 Détails: {traceback.format_exc()}')
    exit(1)
