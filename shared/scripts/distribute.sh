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
if [ ! -f "package.json" ] || [ ! -d "prisma/prisma" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire shared/ après génération"
    exit 1
fi

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
    
    case $target_lang in
        "typescript")
            # Pour TypeScript (Gateway, Frontend)
            echo "  📝 Distribution TypeScript vers $service_name"
            mkdir -p "$service_dir/libs/prisma/client"

            # Copier les fichiers Prisma générés (Client TypeScript)
            if [ -d "prisma" ]; then
                echo "  ✅ Copie des fichiers Prisma Client vers $service_name/libs/"
                cp -pr prisma/* "$service_dir/libs/" 2>/dev/null || true
            fi
            
            # Copier les fichiers Proto TypeScript
            if [ -d "proto" ]; then
                echo "  ✅ Copie des fichiers Proto TypeScript vers $service_name/libs/proto/"
                mkdir -p "$service_dir/libs/proto"
                cp proto/*.proto "$service_dir/libs/proto/" 2>/dev/null || true
                
                if [ -d "proto/generated" ]; then
                    cp -r proto/generated/* "$service_dir/libs/proto/" 2>/dev/null || true
                fi
            fi
            ;;
            
        "python")
            # Pour Python (Translator)
            echo "  🐍 Distribution Python vers $service_name"
            
            # Nettoyer l'ancien contenu libs pour éviter les conflits
            rm -rf "$service_dir/libs"
            mkdir -p "$service_dir/libs"
            
            # Pour Python, on copie le schema Prisma (pas le client généré)
            if [ -f "prisma/schema.prisma" ]; then
                echo "  ✅ Copie du schema Prisma vers $service_name/libs/"
                mkdir -p "$service_dir/libs/prisma"
                cp prisma/schema.prisma "$service_dir/libs/prisma/"
            fi
            
            # Copier les fichiers Proto source pour génération Python
            if [ -d "proto" ]; then
                echo "  ✅ Copie des fichiers Proto source vers $service_name/libs/proto/"
                mkdir -p "$service_dir/libs/proto"
                cp proto/*.proto "$service_dir/libs/proto/" 2>/dev/null || true
                
                # Copier les fichiers Python générés s'ils existent
                find proto -name "*_pb2.py" -exec cp {} "$service_dir/libs/proto/" \; 2>/dev/null || true
                find proto -name "*_pb2_grpc.py" -exec cp {} "$service_dir/libs/proto/" \; 2>/dev/null || true
            fi
            
            # Créer un __init__.py pour faire de libs un package Python
            touch "$service_dir/libs/__init__.py"
            touch "$service_dir/libs/proto/__init__.py" 2>/dev/null || true
            ;;
    esac
    
    echo "  ✅ Distribution vers $service_name terminée"
}

# Distribution vers chaque service
distribute_to_service "Gateway" "$GATEWAY_DIR" "typescript"
distribute_to_service "Frontend" "$FRONTEND_DIR" "typescript"  
distribute_to_service "Translator" "$TRANSLATOR_DIR" "python"

# Créer un fichier de version pour tracking
VERSION_FILE="$SHARED_DIR/prisma/prisma/client/version.txt"
if [ -f "$VERSION_FILE" ]; then
    VERSION=$(cat "$VERSION_FILE")
else
    VERSION=$(date '+%Y%m%d_%H%M%S')
    echo "$VERSION" > "$VERSION_FILE"
fi

# Copier le fichier de version vers chaque service
for service_dir in "$GATEWAY_DIR" "$FRONTEND_DIR" "$TRANSLATOR_DIR"; do
    if [ -d "$service_dir/libs" ]; then
        echo "$VERSION" > "$service_dir/libs/version.txt"
    fi
done

echo "🎉 Distribution terminée ! Version: $VERSION"
echo ""
echo "📋 Résumé:"
echo "  TypeScript Services (Gateway, Frontend):"
echo "    - Prisma Client généré -> */libs/"
echo "    - Proto TypeScript -> */libs/proto/"
echo "  Python Service (Translator):"
echo "    - Schema Prisma -> translator/libs/prisma/"
echo "    - Proto source + Python générés -> translator/libs/proto/"
echo "  - Version: $VERSION"
