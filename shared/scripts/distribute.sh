#!/bin/bash

# Script de distribution des fichiers générés vers les services
# Copie les fichiers Prisma et Proto générés vers chaque service

set -e

echo "🚀 Distribution des fichiers générés vers les services..."

# Répertoire de base (supposé être exécuté depuis shared/)
SHARED_DIR="$(pwd)"
ROOT_DIR="$(dirname "$SHARED_DIR")"

# Services cibles
GATEWAY_DIR="$ROOT_DIR/gateway"
FRONTEND_DIR="$ROOT_DIR/frontend" 
TRANSLATOR_DIR="$ROOT_DIR/translator"

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire shared/"
    exit 1
fi

# Vérifier que le build a été fait
if [ ! -d "dist" ]; then
    echo "❌ Erreur: Le dossier dist/ n'existe pas. Lancez 'pnpm build:types' d'abord."
    exit 1
fi

rm -rf "./node_modules"
rm -rf "./prisma/client"

# Fonction pour créer le répertoire libs et copier les fichiers
distribute_to_service() {
    local service_name=$1
    local service_dir=$2
    local target_lang=$3
    
    echo "📦 Distribution vers $service_name..."
    
    if [ ! -d "$service_dir" ]; then
        echo "⚠️  Répertoire $service_dir non trouvé, ignoré"
        return
    fi
    
    # Nettoyer l'ancien contenu shared pour éviter les conflits
    rm -rf "$service_dir/shared"
    mkdir -p "$service_dir/shared"

    case $target_lang in
        "typescript")
            # Pour TypeScript (Gateway, Frontend) - Copier le contenu compilé de dist/
            echo "  📝 Distribution shared vers $service_name/shared"
            
            # Copier les types compilés depuis dist/
            if [ -d "dist" ]; then
                cp -pir dist/* "$service_dir/shared/" 2>/dev/null || true
                echo "  ✅ Types compilés copiés depuis dist/ vers $service_name/shared/"
            fi
            
            # Copier le dossier types/ source pour le frontend
            if [ -d "types" ]; then
                cp -pir types "$service_dir/shared/" 2>/dev/null || true
                echo "  ✅ Dossier types/ source copié vers $service_name/shared/types/"
            fi
            
            # Copier le client Prisma généré
            if [ -d "prisma/client" ]; then
                mkdir -p "$service_dir/shared/prisma"
                cp -pir prisma/client "$service_dir/shared/prisma/" 2>/dev/null || true
                echo "  ✅ Client Prisma copié vers $service_name/shared/prisma/"
            fi
            
            # Créer le dossier prisma pour la génération du client
            mkdir -p "$service_dir/shared/prisma"
            if [ -f "schema.prisma" ]; then
                cp schema.prisma "$service_dir/shared/prisma/"
                echo "  ✅ Schema Prisma copié vers $service_name/shared/prisma/"
            fi

            # Copier les fichiers Proto s'ils existent
            if [ -d "proto" ]; then
                mkdir -p "$service_dir/shared/proto"
                cp -pir proto/* "$service_dir/shared/proto/" 2>/dev/null || true
                echo "  ✅ Fichiers Proto copiés vers $service_name/shared/proto/"
            fi

            ;;
            
        "python")
            # Pour Python (Translator)
            echo "  🐍 Distribution Python vers $service_name"
    
            # Pour Python, on copie le schema Prisma avec générateur Python
            if [ -f "schema.prisma" ]; then
                echo "  ✅ Création du schema Prisma Python vers $service_name/shared/prisma/"
                rm -rf "$service_dir/shared"
                mkdir -p "$service_dir/shared/prisma"
                
                # Créer une version Python du schema avec l'en-tête modifié
                python_schema="$service_dir/shared/prisma/schema.prisma"
                
                # Modifier le générateur pour Python avec interface asyncio et corriger binaryTargets
                sed 's/provider = "prisma-client-js"/provider = "prisma-client-py"\n  interface = "asyncio"\n  recursive_type_depth = 5/' schema.prisma | \
                sed 's/output   = "\.\/client"//' | \
                sed 's/engine_type = "library"//' | \
                sed 's/binaryTargets = \["native", "linux-musl-arm64-openssl-3.0.x", "linux-musl", "linux-musl-openssl-3.0.x", "linux-musl-arm64-openssl-1.1.x", "linux-musl-arm64-openssl-3.0.x"\]/binaryTargets = ["native"]/' > "$python_schema"
                
                echo "  ✅ Schema Prisma Python généré avec interface asyncio"
                
                # Aussi copier les migrations directement dans le translator pour utilisation immédiate (si elles existent)
                if [ -d "migrations" ]; then
                    cp -pri migrations "$service_dir/shared/prisma/"
                    echo "  ✅ Migrations copiées vers $service_name/shared/prisma"
                else
                    echo "  ⚠️  Dossier migrations non trouvé, ignoré"
                fi
            fi
   
            # Copier les fichiers Proto source pour génération Python
            if [ -d "proto" ]; then
                echo "  ✅ Copie des fichiers Proto source vers $service_name/shared/proto/"
                mkdir -p "$service_dir/shared/proto"
                cp proto/*.proto "$service_dir/shared/proto/" 2>/dev/null || true
                
                # Copier les fichiers Python générés s'ils existent
                find proto -name "*_pb2.py" -exec cp {} "$service_dir/shared/proto/" \; 2>/dev/null || true
                find proto -name "*_pb2_grpc.py" -exec cp {} "$service_dir/shared/proto/" \; 2>/dev/null || true
            fi

            # Créer un __init__.py pour faire de shared un package Python
            touch "$service_dir/shared/__init__.py"
            touch "$service_dir/shared/proto/__init__.py" 2>/dev/null || true
            ;;
    esac
    
    echo "  ✅ Distribution vers $service_name terminée"
}

# Distribution vers chaque service
distribute_to_service "Gateway" "$GATEWAY_DIR" "typescript"
distribute_to_service "Frontend" "$FRONTEND_DIR" "typescript"  
distribute_to_service "Translator" "$TRANSLATOR_DIR" "python"

# Créer un fichier de version pour tracking
VERSION=$(date '+%Y%m%d_%H%M%S')
mkdir -p "$SHARED_DIR/dist"
echo "$VERSION" > "$SHARED_DIR/dist/version.txt"

# Copier le fichier de version vers chaque service
for service_dir in "$GATEWAY_DIR" "$FRONTEND_DIR" "$TRANSLATOR_DIR"; do
    if [ -d "$service_dir/shared" ]; then
        echo "$VERSION" > "$service_dir/shared/version.txt"
    fi
done

echo "🎉 Distribution terminée ! Version: $VERSION"
echo ""
echo "📋 Résumé:"
echo "  TypeScript Services (Gateway, Frontend):"
echo "    - Prisma Client JS généré -> */shared/"
echo "    - Proto TypeScript -> */shared/proto/"
echo "    - Types TypeScript -> */shared/types/"
echo "  Python Service (Translator):"
echo "    - Schema Prisma Python -> translator/shared/prisma/ + translator/schema.prisma"
echo "    - Generator: prisma-client-py avec interface asyncio"
echo "    - Proto source + Python générés -> translator/shared/proto/"
echo "  - Version: $VERSION"
