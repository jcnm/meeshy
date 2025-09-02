#!/bin/bash

# Script de test pour docker-entrypoint-mongodb.sh
# Reproduit l'approche de test_docker_entrypoint.sh

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="TRANSLATOR-TEST"

# Fonction de logging
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

# Charger les variables locales si disponibles
if [ -f ".env" ]; then
    log "📋 Chargement des variables depuis .env local"
    # Supprimer les guillemets des valeurs
    while IFS= read -r line; do
        if [[ $line =~ ^[^#]*= ]]; then
            key="${line%%=*}"
            value="${line#*=}"
            # Supprimer les guillemets
            value=$(echo "$value" | sed 's/^["'\'']//;s/["'\'']$//')
            export "$key=$value"
        fi
    done < .env
fi

# Vérifier la configuration de la base de données
log "🔍 Vérification de la configuration de la base de données..."

if [ -z "$DATABASE_URL" ]; then
    log "❌ DATABASE_URL non définie"
    log "📋 Variables d'environnement disponibles:"
    env | grep -E "(DATABASE|MONGODB|DB)" || log "   Aucune variable de base de données trouvée"
    exit 1
fi

log "✅ DATABASE_URL définie: ${DATABASE_URL:0:50}..."

# Vérifier l'environnement virtuel
log "🔍 Vérification de l'environnement virtuel..."

if [ ! -d ".venv" ]; then
    log "❌ Environnement virtuel .venv non trouvé"
    log "📋 Création de l'environnement virtuel..."
    python3 -m venv .venv
fi

if [ ! -f ".venv/bin/activate" ]; then
    log "❌ Script d'activation .venv/bin/activate non trouvé"
    exit 1
fi

log "✅ Environnement virtuel trouvé"

# Activer l'environnement virtuel
log "🔧 Activation de l'environnement virtuel..."
source .venv/bin/activate

# Vérifier les dépendances Python
log "🔍 Vérification des dépendances Python..."

if ! python3 -c "import prisma" 2>/dev/null; then
    log "⚠️ Module prisma non trouvé, installation..."
    pip install prisma
fi

if ! python3 -c "import fastapi" 2>/dev/null; then
    log "⚠️ Module fastapi non trouvé, installation..."
    pip install fastapi uvicorn
fi

log "✅ Dépendances Python vérifiées"

# Vérifier la structure des fichiers
log "🔍 Vérification de la structure des fichiers..."

if [ ! -f "shared/prisma/schema.prisma" ]; then
    log "❌ Fichier shared/prisma/schema.prisma non trouvé"
    log "📋 Exécution du script distribute.sh..."
    if [ -f "../shared/scripts/distribute.sh" ]; then
        cd ..
        bash shared/scripts/distribute.sh
        cd translator
    else
        log "❌ Script distribute.sh non trouvé"
        exit 1
    fi
fi

if [ ! -f "shared/prisma/schema.prisma" ]; then
    log "❌ Fichier shared/prisma/schema.prisma toujours non trouvé après distribute.sh"
    exit 1
fi

log "✅ Fichier schema.prisma trouvé: shared/prisma/schema.prisma"

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

# Test de connexion à la base de données
log "🔍 Test de connexion à la base de données..."

# Test simple avec Python (sans timeout sur macOS)
log "🔧 Test de connexion Prisma..."
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
                await asyncio.wait_for(prisma.connect(), timeout=5.0)
                print('✅ Connexion Prisma réussie')
            except asyncio.TimeoutError:
                print('❌ Timeout lors de la connexion Prisma (5s)')
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
                    print('🔄 La synchronisation sera effectuée par Prisma db push')
                    await prisma.disconnect()
                    return True
                elif 'Authentication failed' in error_msg:
                    print('❌ Problème d\'authentification MongoDB')
                    print(f'📋 Détails: {error_msg}')
                    await prisma.disconnect()
                    return False
                else:
                    print(f'❌ Erreur lors de la vérification: {error_msg}')
                    print(f'📋 Détails: {traceback.format_exc()}')
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
                print(f'📋 Détails: {traceback.format_exc()}')
                return False
    
    result = asyncio.run(test_connection())
    exit(0 if result else 1)
except Exception as e:
    print(f'❌ Erreur import Prisma: {e}')
    print(f'📋 Détails: {traceback.format_exc()}')
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
    
    # Diagnostic des problèmes d'authentification
    log "🔍 Diagnostic des problèmes d'authentification MongoDB..."
    
    diagnose_result=$(python3 -c "
import os
import sys
import traceback
from urllib.parse import urlparse

try:
    # Récupérer l'URL de la base de données
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print('❌ DATABASE_URL non définie')
        exit(1)
    
    print(f'🔧 URL de base de données: {db_url}')
    
    # Parser l'URL pour extraire les informations
    parsed = urlparse(db_url)
    host = parsed.hostname
    port = parsed.port or 27017
    database = parsed.path.lstrip('/') or 'meeshy'
    username = parsed.username
    password = '***' if parsed.password else None
    
    print(f'📋 Host: {host}')
    print(f'📋 Port: {port}')
    print(f'📋 Database: {database}')
    print(f'📋 Username: {username}')
    print(f'📋 Password: {"défini" if password else "non défini"}')
    
    # Vérifier les paramètres de l'URL
    if 'authMechanism' in db_url:
        print('✅ authMechanism spécifié dans l\'URL')
    else:
        print('⚠️ authMechanism non spécifié dans l\'URL')
    
    if 'tls=true' in db_url:
        print('✅ TLS activé dans l\'URL')
    else:
        print('⚠️ TLS non activé dans l\'URL')
    
    if 'replicaSet' in db_url:
        print('✅ ReplicaSet spécifié dans l\'URL')
    else:
        print('⚠️ ReplicaSet non spécifié dans l\'URL')
    
    print('✅ Diagnostic terminé')
    exit(0)
    
except Exception as e:
    print(f'❌ Erreur diagnostic: {e}')
    print(f'📋 Détails: {traceback.format_exc()}')
    exit(1)
" 2>&1)
    
    log "📋 Détails du diagnostic:"
    echo "$diagnose_result" | while IFS= read -r line; do
        log "   $line"
    done
fi

# Test de synchronisation du schéma
log "🔧 Test de synchronisation du schéma..."

cd shared/prisma
sync_result=$(prisma db push --accept-data-loss 2>&1)
sync_exit_code=$?

if [ $sync_exit_code -eq 0 ]; then
    log "✅ Synchronisation du schéma réussie"
    log "📋 Détails de la synchronisation:"
    echo "$sync_result" | while IFS= read -r line; do
        log "   $line"
    done
else
    log "⚠️ Synchronisation du schéma échouée, tentative avec force-reset..."
    sync_result=$(prisma db push --accept-data-loss --force-reset 2>&1)
    sync_exit_code=$?
    
    if [ $sync_exit_code -eq 0 ]; then
        log "✅ Synchronisation du schéma réussie avec force-reset"
        log "📋 Détails de la synchronisation:"
        echo "$sync_result" | while IFS= read -r line; do
            log "   $line"
        done
    else
        log "❌ Synchronisation du schéma échouée même avec force-reset"
        log "📋 Détails de l'erreur:"
        echo "$sync_result" | while IFS= read -r line; do
            log "   $line"
        done
    fi
fi
cd ../..

# Test final de connexion
log "🔍 Test final de connexion..."

log "🔧 Test final de connexion Prisma..."
final_test_result=$(python3 -c "
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
    
    async def final_test():
        try:
            print('🔧 Test final de connexion...')
            prisma = Prisma()
            
            # Timeout de 10 secondes pour la connexion
            try:
                await asyncio.wait_for(prisma.connect(), timeout=10.0)
                print('✅ Connexion Prisma réussie')
            except asyncio.TimeoutError:
                print('❌ Timeout lors de la connexion Prisma (10s)')
                return False
            
            count = await prisma.user.count()
            print(f'✅ Base de données accessible avec {count} utilisateurs')
            await prisma.disconnect()
            return True
        except Exception as e:
            print(f'❌ Erreur test final: {e}')
            print(f'📋 Détails: {traceback.format_exc()}')
            return False
    
    result = asyncio.run(final_test())
    exit(0 if result else 1)
except Exception as e:
    print(f'❌ Erreur import Prisma: {e}')
    print(f'📋 Détails: {traceback.format_exc()}')
    exit(1)
" 2>&1)

final_test_exit_code=$?

if [ $final_test_exit_code -eq 0 ]; then
    log "✅ Test final réussi"
    log "📋 Détails du test final:"
    echo "$final_test_result" | while IFS= read -r line; do
        log "   $line"
    done
else
    log "❌ Test final échoué"
    log "📋 Détails de l'erreur:"
    echo "$final_test_result" | while IFS= read -r line; do
        log "   $line"
    done
fi

# Résumé des tests
log "📊 Résumé des tests:"
log "   - Configuration DB: ✅"
log "   - Environnement virtuel: ✅"
log "   - Dépendances Python: ✅"
log "   - Fichier schema.prisma: ✅"
log "   - Génération client Prisma: ✅"
log "   - Test de connexion initial: $([ $test_exit_code -eq 0 ] && echo '✅' || echo '❌')"
log "   - Synchronisation schéma: $([ $sync_exit_code -eq 0 ] && echo '✅' || echo '❌')"
log "   - Test de connexion final: $([ $final_test_exit_code -eq 0 ] && echo '✅' || echo '❌')"

if [ $test_exit_code -eq 0 ] && [ $sync_exit_code -eq 0 ] && [ $final_test_exit_code -eq 0 ]; then
    log "🎉 Tous les tests sont passés avec succès!"
    exit 0
else
    log "❌ Certains tests ont échoué"
    exit 1
fi
