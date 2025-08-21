#!/bin/bash
set -e

echo "[GATEWAY] 🚀 Démarrage du service Gateway avec initialisation de la base de données..."

# Fonction pour attendre que la base de données soit prête
wait_for_database() {
    echo "[GATEWAY] 🔄 Attente de la base de données PostgreSQL..."
    
    # Variables d'environnement pour la connexion à la base de données
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    # Attendre que PostgreSQL soit prêt
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; do
        echo "[GATEWAY] ⏳ Base de données non prête, attente de 5 secondes..."
        sleep 5
    done
    
    echo "[GATEWAY] ✅ Base de données PostgreSQL prête"
    
    # Vérifier si la base de données existe, sinon la créer
    echo "[GATEWAY] 🔍 Vérification de l'existence de la base de données..."
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "[GATEWAY] 🆕 Base de données '$DB_NAME' n'existe pas, tentative de création..."
        
        # Se connecter à la base de données par défaut pour créer la nouvelle base
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -c "CREATE DATABASE \"$DB_NAME\";" >/dev/null 2>&1; then
            echo "[GATEWAY] ✅ Base de données '$DB_NAME' créée avec succès"
        else
            echo "[GATEWAY] ⚠️ Impossible de créer la base de données, elle sera créée par Prisma"
        fi
    else
        echo "[GATEWAY] ✅ Base de données '$DB_NAME' existe déjà"
    fi
}

# Fonction pour exécuter les migrations Prisma
run_prisma_migrations() {
    echo "[GATEWAY] 🔧 Initialisation et migrations de la base de données..."
    
    # Vérifier si le client Prisma est déjà généré (pendant le build)
    echo "[GATEWAY] 📦 Vérification du client Prisma..."
    if [ -d "/app/shared/prisma" ] && [ -f "/app/shared/prisma/index.js" ]; then
        echo "[GATEWAY] ✅ Client Prisma déjà généré pendant le build"
    else
        echo "[GATEWAY] 🔧 Génération du client Prisma..."
        if npx prisma generate --schema=./shared/schema.prisma; then
            echo "[GATEWAY] ✅ Client Prisma généré avec succès"
        else
            echo "[GATEWAY] ⚠️ Échec de la génération du client Prisma"
            echo "[GATEWAY] 🔄 Continuation sans client Prisma généré"
        fi
    fi
    
    # Initialisation et migration de la base de données
    echo "[GATEWAY] 🗄️ Initialisation et migration de la base de données..."
    if npx prisma db push --schema=./shared/schema.prisma --accept-data-loss; then
        echo "[GATEWAY] ✅ Schéma de base de données appliqué avec db push"
    else
        echo "[GATEWAY] ⚠️ db push échoué, tentative avec migrate deploy..."
        if npx prisma migrate deploy --schema=./shared/schema.prisma; then
            echo "[GATEWAY] ✅ Migrations appliquées avec migrate deploy"
        else
            echo "[GATEWAY] ❌ Échec des migrations Prisma"
            exit 1
        fi
    fi
    
    echo "[GATEWAY] ✅ Initialisation et migrations Prisma terminées avec succès"
}

# Fonction pour vérifier l'intégrité de la base de données
check_database_integrity() {
    echo "[GATEWAY] 🔍 Vérification de l'intégrité de la base de données..."
    
    # Vérifier que les tables principales existent et sont accessibles
    node -e "
const { PrismaClient } = require('./shared/prisma/client');

async function checkDatabase() {
    const prisma = new PrismaClient();
    
    try {
        await prisma.\$connect();
        
        // Liste des tables principales à vérifier
        const mainTables = [
            'users',
            'conversations', 
            'messages',
            'communities',
            'conversation_members',
            'community_members',
            'user_preferences',
            'notifications'
        ];
        
        console.log('[GATEWAY] 🔍 Vérification des tables principales...');
        
        for (const table of mainTables) {
            try {
                const result = await prisma.\$executeRaw\`SELECT COUNT(*) as count FROM \${table}\`;
                console.log(\`[GATEWAY] ✅ Table \${table} accessible\`);
            } catch (error) {
                console.log(\`[GATEWAY] ⚠️ Table \${table} non accessible: \${error.message}\`);
                return false;
            }
        }
        
        console.log('[GATEWAY] ✅ Intégrité de la base de données vérifiée');
        return true;
    } catch (error) {
        console.log(\`[GATEWAY] ❌ Erreur de vérification de la base de données: \${error.message}\`);
        return false;
    } finally {
        await prisma.\$disconnect();
    }
}

checkDatabase().then(success => {
    if (!success) {
        process.exit(1);
    }
});
"
}

# Fonction principale
main() {
    echo "[GATEWAY] 🎯 Démarrage du processus d'initialisation..."
    
    # Attendre que la base de données soit prête
    wait_for_database
    
    # Exécuter les migrations Prisma
    run_prisma_migrations
    
    # Vérifier l'intégrité de la base de données
    check_database_integrity
    
    echo "[GATEWAY] 🚀 Démarrage de l'application Gateway..."
    
    # Changer vers l'utilisateur gateway pour la sécurité
    exec su gateway -c "node dist/src/server.js"
}

# Exécuter la fonction principale
main
