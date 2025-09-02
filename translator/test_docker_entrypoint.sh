#!/bin/bash
set -e

# Configuration
MAX_RETRIES=30
RETRY_DELAY=2
APP_NAME="TRANSLATOR"

# Charger les variables d'environnement du répertoire parent
if [ -f "../.env" ]; then
    export $(grep -v '^#' ../.env | xargs)
    echo "[${APP_NAME}] Variables d'environnement chargées depuis ../.env"
fi

log() {
    echo "[${APP_NAME}] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log "🚀 Démarrage du service ${APP_NAME}..."

# Fonction de vérification de la base de données
wait_for_database() {
    log "⏳ Attente de la disponibilité de la base de données..."
    
    local retries=0
    until [ $retries -ge $MAX_RETRIES ]; do
        log "Tentative de connexion DB ($((retries + 1))/${MAX_RETRIES})"
        
        # Test simple avec Python sans importer Prisma
        if python3 -c "
import os
from urllib.parse import urlparse
try:
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise Exception('DATABASE_URL non définie')
    
    # Test de parsing d'URL basique
    parsed = urlparse(db_url)
    if not parsed.hostname:
        raise Exception('URL MongoDB invalide')
    
    print('Configuration DB validée')
    exit(0)
except Exception as e:
    print(f'Erreur config DB: {e}')
    exit(1)
"; then
            log "✅ Configuration de base de données validée"
            return 0
        fi
        
        retries=$((retries + 1))
        if [ $retries -lt $MAX_RETRIES ]; then
            log "⏳ Nouvelle tentative dans ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
    done
    
    log "⚠️ Impossible de valider la DB après ${MAX_RETRIES} tentatives"
    log "🚀 Démarrage de l'application quand même (les reconnexions se feront au runtime)"
}

# Génération du client Prisma
generate_prisma_client() {
    log "🔧 Génération du client Prisma..."
    
    # Détecter le fichier schema
    local schema_path=""
    if [ -f "prisma/schema.prisma" ]; then
        schema_path="--schema prisma/schema.prisma"
        log "📋 Schéma trouvé: prisma/schema.prisma"
    elif [ -f "shared/prisma/schema.prisma" ]; then
        schema_path="--schema shared/prisma/schema.prisma"
        log "📋 Schéma trouvé: shared/prisma/schema.prisma"
    else
        log "📋 Utilisation du schéma par défaut"
    fi
    
    # Génération (critique - doit réussir)
    if python -m prisma generate $schema_path; then
        log "✅ Client Prisma généré avec succès"
    else
        log "❌ ERREUR: Impossible de générer le client Prisma"
        exit 1
    fi
}

# Test de connexion à la base de données avec Prisma
test_prisma_connection() {
    log "🔍 Test de connexion Prisma à la base de données..."
    
    if python3 -c "
import asyncio
import os
import sys
from pathlib import Path

# Ajouter le répertoire du client Prisma au PYTHONPATH
current_dir = Path.cwd()
prisma_client_path = current_dir / 'prisma'
if prisma_client_path.exists():
    sys.path.insert(0, str(prisma_client_path))

from prisma import Prisma

async def test_connection():
    try:
        prisma = Prisma()
        await prisma.connect()
        print('✅ Connexion Prisma réussie')
        await prisma.disconnect()
        return True
    except Exception as e:
        print(f'❌ Erreur connexion Prisma: {e}')
        return False

result = asyncio.run(test_connection())
exit(0 if result else 1)
"; then
        log "✅ Test de connexion Prisma réussi"
        return 0
    else
        log "❌ Test de connexion Prisma échoué"
        return 1
    fi
}

# Fonction principale
main() {
    log "🎯 Initialisation du service ${APP_NAME}..."
    
    # 1. Vérification de la configuration DB (avec timeout)
    wait_for_database
    
    # 2. Génération du client Prisma (critique)
    generate_prisma_client
    
    # 3. Test de connexion Prisma
    test_prisma_connection
    
    log "✅ Tous les tests sont passés avec succès !"
}

# Point d'entrée
main "$@"
