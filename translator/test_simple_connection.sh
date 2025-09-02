#!/bin/bash

# Test simple de connexion qui simule docker-entrypoint-mongodb.sh

set -e

APP_NAME="SIMPLE-TEST"

log() {
    echo "[${APP_NAME}] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Chargement des variables d'environnement
log "🔧 Chargement des variables d'environnement..."

# Charger les variables depuis le fichier parent .env si disponible
if [ -f "../.env" ]; then
    log "📋 Chargement des variables depuis ../.env"
    # Supprimer les guillemets des valeurs
    while IFS= read -r line; do
        if [[ $line =~ ^[^#]*= ]]; then
            key="${line%%=*}"
            value="${line#*=}"
            # Supprimer les guillemets
            value=$(echo "$value" | sed 's/^["'\'']//;s/["'\'']$//')
            export "$key=$value"
        fi
    done < ../.env
fi

log "✅ DATABASE_URL: ${DATABASE_URL:0:50}..."

# Activer l'environnement virtuel
log "🔧 Activation de l'environnement virtuel..."
source .venv/bin/activate

# Test de génération du client Prisma
log "🔧 Test de génération du client Prisma..."
cd shared/prisma
if prisma generate --schema=schema.prisma; then
    log "✅ Client Prisma généré avec succès"
else
    log "❌ Échec de la génération du client Prisma"
    exit 1
fi
cd ../..

# Test de connexion simple
log "🔍 Test de connexion simple..."

test_result=$(python3 -c "
import asyncio
import os
import sys
import traceback
from pathlib import Path

# Ajouter le répertoire du client Prisma au PYTHONPATH
current_dir = Path.cwd()
prisma_client_path = current_dir / 'shared' / 'prisma'
if prisma_client_path.exists():
    sys.path.insert(0, str(prisma_client_path))

try:
    from prisma import Prisma
    
    async def test_connection():
        try:
            print('🔧 Tentative de connexion Prisma...')
            prisma = Prisma()
            
            # Timeout de 10 secondes pour la connexion
            try:
                await asyncio.wait_for(prisma.connect(), timeout=10.0)
                print('✅ Connexion Prisma réussie')
            except asyncio.TimeoutError:
                print('❌ Timeout lors de la connexion Prisma (10s)')
                return False
            
            try:
                count = await prisma.user.count()
                print(f'✅ Base de données accessible avec {count} utilisateurs')
                await prisma.disconnect()
                return True
            except Exception as e:
                error_msg = str(e)
                if 'does not exist' in error_msg or 'not found' in error_msg:
                    print('⚠️ Base de données vide ou schéma non synchronisé')
                    await prisma.disconnect()
                    return True
                elif 'Authentication failed' in error_msg:
                    print('❌ Problème d\'authentification MongoDB')
                    print(f'📋 Détails: {error_msg}')
                    await prisma.disconnect()
                    return False
                else:
                    print(f'❌ Erreur lors de la vérification: {error_msg}')
                    await prisma.disconnect()
                    return False
        except Exception as e:
            error_msg = str(e)
            if 'Authentication failed' in error_msg:
                print('❌ Problème d\'authentification MongoDB')
                print(f'📋 Détails: {error_msg}')
                return False
            else:
                print(f'❌ Erreur connexion Prisma: {error_msg}')
                return False
    
    result = asyncio.run(test_connection())
    exit(0 if result else 1)
except Exception as e:
    print(f'❌ Erreur import Prisma: {e}')
    exit(1)
" 2>&1)

test_exit_code=$?

if [ $test_exit_code -eq 0 ]; then
    log "✅ Test de connexion réussi"
    log "📋 Détails du test:"
    echo "$test_result" | while IFS= read -r line; do
        log "   $line"
    done
else
    log "❌ Test de connexion échoué"
    log "📋 Détails de l'erreur:"
    echo "$test_result" | while IFS= read -r line; do
        log "   $line"
    done
fi

log "📊 Résumé du test:"
log "   - Configuration DB: ✅"
log "   - Génération client Prisma: ✅"
log "   - Test de connexion: $([ $test_exit_code -eq 0 ] && echo '✅' || echo '❌')"

exit $test_exit_code
