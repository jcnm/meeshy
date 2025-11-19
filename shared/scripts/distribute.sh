#!/bin/bash

# Script de distribution des fichiers générés vers les services
# Copie les fichiers Prisma et Proto générés vers chaque service
# Configure également le workspace pour les builds Docker

set -e

echo "🚀 Distribution des fichiers générés vers les services..."

# Répertoire de base (supposé être exécuté depuis shared/)
SHARED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(dirname "$SHARED_DIR")"

# Services cibles
GATEWAY_DIR="$ROOT_DIR/gateway"
FRONTEND_DIR="$ROOT_DIR/frontend" 
TRANSLATOR_DIR="$ROOT_DIR/translator"

# Vérifier que nous sommes dans le bon répertoire
cd "$SHARED_DIR"
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire shared/"
    exit 1
fi

# Build shared types if needed
if [ ! -d "$SHARED_DIR/dist" ]; then
    echo "📦 Building shared types..."
    pnpm run build:types 2>/dev/null || npm run build:types || true
fi

# Vérifier que le build a été fait
if [ ! -d "dist" ]; then
    echo "⚠️  Le dossier dist/ n'existe pas. Tentative de build..."
    pnpm run build:types 2>/dev/null || npm run build:types || echo "⚠️  Build échoué, continuons..."
fi

rm -rf "./node_modules" 2>/dev/null || true
rm -rf "./prisma/client" 2>/dev/null || true

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
            # Pour TypeScript (Gateway, Frontend) - Copier les sources TypeScript (.ts)
            echo "  📝 Distribution shared vers $service_name/shared"
            
            # Copier le dossier types/ source (fichiers .ts uniquement)
            if [ -d "types" ]; then
                mkdir -p "$service_dir/shared/types"
                # Copier tous les fichiers .ts du dossier types
                cp types/*.ts "$service_dir/shared/types/" 2>/dev/null || true
                echo "  ✅ Dossier types/ source (.ts) copié vers $service_name/shared/types/"
            fi
            
            # Copier le dossier utils/ source (fichiers .ts uniquement)
            if [ -d "utils" ]; then
                mkdir -p "$service_dir/shared/utils"
                # Copier tous les fichiers .ts du dossier utils
                cp utils/*.ts "$service_dir/shared/utils/" 2>/dev/null || true
                echo "  ✅ Dossier utils/ source (.ts) copié vers $service_name/shared/utils/"
            fi

            # Copier le dossier encryption/ source (fichiers .ts uniquement)
            if [ -d "encryption" ]; then
                mkdir -p "$service_dir/shared/encryption"
                # Copier tous les fichiers .ts du dossier encryption
                cp encryption/*.ts "$service_dir/shared/encryption/" 2>/dev/null || true
                echo "  ✅ Dossier encryption/ source (.ts) copié vers $service_name/shared/encryption/"
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
                cp seed.ts "$service_dir/shared/prisma/" 2>/dev/null || true
                echo "  ✅ Schema Prisma copié vers $service_name/shared/prisma/"
            fi

            # Copier les fichiers Proto s'ils existent
            if [ -d "proto" ]; then
                mkdir -p "$service_dir/shared/proto"
                cp -pir proto/* "$service_dir/shared/proto/" 2>/dev/null || true
                echo "  ✅ Fichiers Proto copiés vers $service_name/shared/proto/"
            fi

            # Copier shared package.json (needed for pnpm workspace)
            echo "  📦 Copying shared package.json..."
            cp "$SHARED_DIR/package.json" "$service_dir/shared/package.json"
            
            # Copy pnpm workspace configuration
            echo "  📦 Copying pnpm workspace configuration..."
            cp "$ROOT_DIR/pnpm-workspace.yaml" "$service_dir/pnpm-workspace.yaml"
            
            # Create minimal pnpm-workspace.yaml for service context
            echo "  📦 Creating minimal pnpm-workspace.yaml for $service_name..."
            cat > "$service_dir/pnpm-workspace.yaml" << 'EOF'
packages:
  - '.'
  - 'shared'

ignoredBuiltDependencies:
  - '@tensorflow/tfjs-node'
  - core-js
  - onnxruntime-node
  - protobufjs
  - sharp
  - unrs-resolver

onlyBuiltDependencies:
  - '@prisma/client'
  - '@prisma/engines'
  - esbuild
  - prisma
EOF

            echo "  ✅ $service_name is now self-sufficient for Docker build!"
            echo "  ✅ - shared/ directory distributed"
            echo "  ✅ - pnpm-workspace.yaml configured for $service_name context"
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
            
            echo "  ✅ $service_name is now self-sufficient for Docker build!"
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

echo ""
echo "🎉 Distribution terminée ! Version: $VERSION"
echo ""
echo "📋 Résumé:"
echo "  TypeScript Services (Gateway, Frontend):"
echo "    - Prisma Client JS généré -> */shared/"
echo "    - Proto TypeScript -> */shared/proto/"
echo "    - Types TypeScript -> */shared/types/"
echo "    - Package.json + pnpm-workspace.yaml configurés"
echo "    - Services prêts pour Docker build ✓"
echo "  Python Service (Translator):"
echo "    - Schema Prisma Python -> translator/shared/prisma/ + translator/schema.prisma"
echo "    - Generator: prisma-client-py avec interface asyncio"
echo "    - Proto source + Python générés -> translator/shared/proto/"
echo "    - Service prêt pour Docker build ✓"
echo "  - Version: $VERSION"
echo ""
echo "✅ Vous pouvez maintenant lancer les builds Docker des services!"
