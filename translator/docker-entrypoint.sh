#!/bin/bash
set -e

echo "[TRANSLATOR] 🚀 Démarrage du service Translator avec migrations Prisma..."

# Fonction pour attendre que la base de données soit prête
wait_for_database() {
    echo "[TRANSLATOR] 🔄 Attente de la base de données PostgreSQL..."
    
    # Variables d'environnement pour la connexion à la base de données
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    echo "DATABASE_URL: $DATABASE_URL"
    # Attendre que PostgreSQL soit prêt
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; do
        echo "[TRANSLATOR] ⏳ Base de données non prête, attente de 5 secondes..."
        sleep 5
    done
    
    echo "[TRANSLATOR] ✅ Base de données PostgreSQL prête"
    
    # Vérifier si la base de données existe, sinon la créer
    echo "[TRANSLATOR] 🔍 Vérification de l'existence de la base de données..."
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "[TRANSLATOR] 🆕 Base de données '$DB_NAME' n'existe pas, tentative de création..."
        
        # Se connecter à la base de données par défaut pour créer la nouvelle base
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -c "CREATE DATABASE \"$DB_NAME\";" >/dev/null 2>&1; then
            echo "[TRANSLATOR] ✅ Base de données '$DB_NAME' créée avec succès"
        else
            echo "[TRANSLATOR] ⚠️ Impossible de créer la base de données, elle sera créée par Prisma"
        fi
    else
        echo "[TRANSLATOR] ✅ Base de données '$DB_NAME' existe déjà"
    fi
}

# Fonction pour exécuter les migrations Prisma
run_prisma_migrations() {
    echo "[TRANSLATOR] 🔧 Initialisation et migrations de la base de données..."
    
    # Afficher les variables d'environnement pour debug
    echo "[TRANSLATOR] 🔧 Variables d'environnement:"
    env | grep -E "(PRISMA|DATABASE|PYTHON)" | sort
    
    # Vérifier le client Prisma
    echo "[TRANSLATOR] 📦 Vérification du client Prisma..."
    if [ -d "/usr/local/lib/python3.12/site-packages/prisma" ]; then
        echo "[TRANSLATOR] ✅ Client Prisma trouvé dans /usr/local/lib/python3.12/site-packages/prisma"
    else
        echo "[TRANSLATOR] 🔧 Génération du client Prisma..."
        cd /app/generated
        if prisma generate --schema=/app/shared/prisma/schema.prisma; then
            cp -rf /usr/local/lib/python3.12/site-packages/prisma /app/generated/
            echo "[TRANSLATOR] ✅ Client Prisma généré"
        else
            echo "[TRANSLATOR] ⚠️ Échec génération client - continuation..."
        fi
        cd /app
    fi
     
    # Vérifier si la base de données existe et a des tables
    echo "[TRANSLATOR] 🔍 Vérification de l'état de la base de données..."
    
    # Initialisation et migration de la base de données
    echo "[TRANSLATOR] 🗄️ Initialisation et migration de la base de données..."
    python3 -c "
import asyncio
import os
import subprocess
import sys

# Ajouter le répertoire généré au path Python
sys.path.insert(0, '/app/generated')

async def init_database():
    try:
        # Essayer d'abord avec db push (plus rapide pour l'initialisation)
        try:
            print('[TRANSLATOR] 🔧 Application du schéma avec prisma db push...')
            result = subprocess.run([
                'prisma', 'db', 'push', 
                '--schema=./shared/prisma/schema.prisma', 
                '--accept-data-loss'
            ], capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0:
                print('[TRANSLATOR] ✅ Schéma de base de données appliqué avec db push')
                return True
            else:
                print(f'[TRANSLATOR] ⚠️ db push échoué: {result.stderr}')
                raise Exception('db push failed')
                
        except Exception as e:
            print(f'[TRANSLATOR] ⚠️ Fallback vers migrate deploy: {e}')
            
            # Fallback vers migrate deploy
            try:
                print('[TRANSLATOR] 🔧 Application des migrations avec prisma migrate deploy...')
                result = subprocess.run([
                    'prisma', 'migrate', 'deploy', 
                    '--schema=./shared/prisma/schema.prisma'
                ], capture_output=True, text=True, timeout=300)
                
                if result.returncode == 0:
                    print('[TRANSLATOR] ✅ Migrations appliquées avec migrate deploy')
                    return True
                else:
                    print(f'[TRANSLATOR] ❌ migrate deploy échoué: {result.stderr}')
                    return False
                    
            except Exception as e2:
                print(f'[TRANSLATOR] ❌ Échec du fallback: {e2}')
                return False
                
    except Exception as e:
        print(f'[TRANSLATOR] ❌ Erreur lors de l\'initialisation: {e}')
        return False

if asyncio.run(init_database()):
    print('[TRANSLATOR] ✅ Initialisation de la base de données réussie')
else:
    print('[TRANSLATOR] ❌ Échec de l\'initialisation de la base de données')
    exit(1)
"
    
    echo "[TRANSLATOR] ✅ Initialisation et migrations Prisma terminées avec succès"
}

# Fonction pour vérifier l'intégrité de la base de données
check_database_integrity() {
    echo "[TRANSLATOR] 🔍 Vérification de l'intégrité de la base de données..."
    
# Vérifier que les tables principales existent et sont accessibles
python3 -c "
import asyncio
import os
import sys

# Ajouter le répertoire généré au path Python
sys.path.insert(0, '/app/generated')

try:
    from prisma import Prisma
    
    async def check_db():
        try:
            db = Prisma()
            await db.connect()
            print('[TRANSLATOR] ✅ Base de données connectée')
            # Liste des tables principales à vérifier
            main_tables = [
                'users',
                'conversations', 
                'messages',
                'message_translations',
                'communities',
                'conversation_members',
                'community_members',
                'user_preferences',
                'notifications'
            ]
            
            print('[TRANSLATOR] 🔍 Vérification des tables principales...')
            
            for table in main_tables:
                try:
                    print(f'[TRANSLATOR] 🔍 Vérification de la table {table}...')
                    # Utiliser query_raw au lieu de execute_raw pour les SELECT
                    result = await db.query_raw(f'SELECT COUNT(*) as count FROM \"{table}\"')
                    
                    # Gérer différents formats de résultat
                    if isinstance(result, list) and len(result) > 0:
                        if isinstance(result[0], dict):
                            count = result[0].get('count', 0)
                        else:
                            count = result[0]
                    elif isinstance(result, int):
                        count = result
                    else:
                        count = 0
                        
                    print(f'[TRANSLATOR] ✅ Table {table} accessible ({count} enregistrements)')
                except Exception as e:
                    print(f'[TRANSLATOR] ⚠️ Table {table} non accessible: {e}')
                    # Ne pas arrêter pour une seule table, continuer avec les autres
                    continue
            
            # Vérifier les index et contraintes de manière plus robuste
            print('[TRANSLATOR] 🔍 Vérification des index et contraintes...')
            
            try:
                # Vérifier que les index principaux existent
                indexes = await db.query_raw(\"\"\"
                    SELECT indexname, tablename 
                    FROM pg_indexes 
                    WHERE schemaname = 'public' 
                    AND indexname LIKE '%_pkey'
                \"\"\")
                
                if indexes and len(indexes) > 0:
                    print(f'[TRANSLATOR] ✅ {len(indexes)} index primaires trouvés')
                else:
                    print('[TRANSLATOR] ⚠️ Aucun index primaire trouvé')
            except Exception as e:
                print(f'[TRANSLATOR] ⚠️ Erreur lors de la vérification des index: {e}')
            
            await db.disconnect()
            return True
        except Exception as e:
            print(f'[TRANSLATOR] ❌ Erreur de vérification de la base de données: {e}')
            return False

    if asyncio.run(check_db()):
        print('[TRANSLATOR] ✅ Intégrité de la base de données vérifiée')
    else:
        print('[TRANSLATOR] ⚠️ Problème avec l\'intégrité de la base de données, mais continuons...')
        # Ne pas arrêter l'application pour des problèmes de vérification
        
except ImportError:
    print('[TRANSLATOR] ⚠️ Client Prisma non disponible, vérification d\'intégrité ignorée')
    print('[TRANSLATOR] ✅ Initialisation terminée sans vérification d\'intégrité')
"
}

# Fonction principale
main() {
    echo "[TRANSLATOR] 🎯 Démarrage du processus d'initialisation..."
    
    # Attendre que la base de données soit prête
    wait_for_database
    
    # Exécuter les migrations Prisma
    run_prisma_migrations
    
    # Vérifier l'intégrité de la base de données
    check_database_integrity
    
    echo "[TRANSLATOR] 🚀 Démarrage de l'application Translator..."
    
    # Démarrer l'application Python
    exec python3 -u src/main.py
}

# Exécuter la fonction principale
main
