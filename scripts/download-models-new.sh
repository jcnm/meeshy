#!/bin/bash

# Script de téléchargement automatique des modèles TensorFlow.js pour Meeshy
# Télécharge les modèles depuis Hugging Face et les place dans public/models

set -e

MODELS_DIR="$(dirname "$0")/../public/models"
TEMP_DIR="/tmp/meeshy-models-download"

echo "🚀 === TÉLÉCHARGEMENT AUTOMATIQUE DES MODÈLES MEESHY ==="
echo ""

# Créer les répertoires nécessaires
mkdir -p "$MODELS_DIR"
mkdir -p "$TEMP_DIR"

# Configuration des modèles à télécharger
declare -A MODELS=(
    # Modèles mT5 (plus petits, optimisés pour les messages courts)
    ["mt5-small"]="https://huggingface.co/Xenova/mt5-small/resolve/main"
    
    # Modèles NLLB (multilingues, optimisés pour les langues rares)  
    ["nllb-200-distilled-600M"]="https://huggingface.co/Xenova/nllb-200-distilled-600M/resolve/main"
)

# Fonction pour télécharger un fichier avec retry
download_with_retry() {
    local url="$1"
    local output="$2"
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "   Tentative $attempt/$max_attempts: $(basename "$output")"
        
        if curl -L --fail --silent --show-error \
           --connect-timeout 30 \
           --max-time 300 \
           -o "$output" \
           "$url"; then
            echo "   ✅ Téléchargé: $(basename "$output")"
            return 0
        else
            echo "   ❌ Échec tentative $attempt"
            attempt=$((attempt + 1))
            [ $attempt -le $max_attempts ] && sleep 2
        fi
    done
    
    echo "   💥 Échec définitif après $max_attempts tentatives"
    return 1
}

# Fonction pour télécharger un modèle complet
download_model() {
    local model_name="$1"
    local base_url="$2"
    local model_dir="$MODELS_DIR/$model_name"
    
    echo "📦 Téléchargement du modèle: $model_name"
    
    # Créer le répertoire du modèle
    mkdir -p "$model_dir"
    
    # Fichiers essentiels pour TensorFlow.js
    local files=(
        "model.json"
        "config.json"
        "tokenizer.json"
        "tokenizer_config.json"
    )
    
    # Télécharger les fichiers de poids (variables)
    local weight_files=(
        "model.safetensors"
        "pytorch_model.bin"
    )
    
    # Télécharger les fichiers de configuration
    for file in "${files[@]}"; do
        local url="$base_url/$file"
        local output="$model_dir/$file"
        
        if ! download_with_retry "$url" "$output"; then
            echo "   ⚠️ Fichier optionnel manquant: $file"
        fi
    done
    
    # Télécharger au moins un fichier de poids
    local weight_downloaded=false
    for weight_file in "${weight_files[@]}"; do
        local url="$base_url/$weight_file"
        local output="$model_dir/$weight_file"
        
        if download_with_retry "$url" "$output"; then
            weight_downloaded=true
            break
        fi
    done
    
    # Vérifier qu'on a au minimum model.json
    if [ -f "$model_dir/model.json" ]; then
        echo "   ✅ Modèle $model_name téléchargé avec succès"
        
        # Créer un fichier de métadonnées
        cat > "$model_dir/info.json" << EOF
{
  "name": "$model_name",
  "downloadDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "$base_url",
  "status": "ready",
  "files": $(ls "$model_dir" | jq -R . | jq -s . 2>/dev/null || echo '[]')
}
EOF
        return 0
    else
        echo "   ❌ Échec du téléchargement de $model_name"
        rm -rf "$model_dir"
        return 1
    fi
}

# Fonction pour vérifier si un modèle existe déjà
model_exists() {
    local model_name="$1"
    local model_dir="$MODELS_DIR/$model_name"
    
    [ -f "$model_dir/model.json" ] && [ -f "$model_dir/info.json" ]
}

# Fonction pour mettre à jour un modèle si nécessaire
check_and_update_model() {
    local model_name="$1"
    local base_url="$2"
    
    if model_exists "$model_name"; then
        echo "✅ Modèle $model_name déjà présent"
        
        # Vérifier l'âge du modèle (renouveler si > 7 jours)
        local info_file="$MODELS_DIR/$model_name/info.json"
        if [ -f "$info_file" ]; then
            local download_date=$(jq -r '.downloadDate' "$info_file" 2>/dev/null || echo "")
            if [ -n "$download_date" ]; then
                if command -v date >/dev/null 2>&1; then
                    local age_days=$(( ($(date +%s) - $(date -d "$download_date" +%s 2>/dev/null || echo 0)) / 86400 ))
                    if [ $age_days -gt 7 ]; then
                        echo "   🔄 Modèle ancien ($age_days jours), mise à jour..."
                        rm -rf "$MODELS_DIR/$model_name"
                        download_model "$model_name" "$base_url"
                    fi
                fi
            fi
        fi
    else
        echo "📥 Modèle $model_name manquant, téléchargement..."
        download_model "$model_name" "$base_url"
    fi
}

# Vérifier les dépendances
command -v curl >/dev/null 2>&1 || { echo "❌ curl requis mais non installé"; exit 1; }

echo "📁 Répertoire des modèles: $MODELS_DIR"
echo ""

# Télécharger tous les modèles
for model_name in "${!MODELS[@]}"; do
    base_url="${MODELS[$model_name]}"
    check_and_update_model "$model_name" "$base_url"
    echo ""
done

# Créer un index des modèles disponibles
echo "📋 Création de l'index des modèles..."
cat > "$MODELS_DIR/index.json" << EOF
{
  "lastUpdate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "models": [
$(for model_dir in "$MODELS_DIR"/*/; do
    if [ -d "$model_dir" ] && [ -f "$model_dir/info.json" ]; then
        model_name=$(basename "$model_dir")
        echo "    {"
        echo "      \"name\": \"$model_name\","
        echo "      \"path\": \"/models/$model_name\","
        echo "      \"info\": $(cat "$model_dir/info.json")"
        echo "    },"
    fi
done | sed '$ s/,$//')
  ]
}
EOF

echo "✅ Index créé: $MODELS_DIR/index.json"

# Nettoyage
rm -rf "$TEMP_DIR"

echo ""
echo "🎉 === TÉLÉCHARGEMENT TERMINÉ ==="
echo ""
echo "📊 Résumé:"
echo "   📂 Répertoire: $MODELS_DIR"
echo "   📋 Index: $MODELS_DIR/index.json" 
echo "   🔢 Modèles disponibles:"

for model_dir in "$MODELS_DIR"/*/; do
    if [ -d "$model_dir" ] && [ -f "$model_dir/model.json" ]; then
        model_name=$(basename "$model_dir")
        size=$(du -sh "$model_dir" 2>/dev/null | cut -f1 || echo "?")
        echo "      ✅ $model_name ($size)"
    fi
done

echo ""
echo "💡 Les modèles sont maintenant disponibles pour l'application Meeshy"
echo "🚀 Démarrez l'application avec: npm run dev"
