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
        echo "❌ Erreur lors du téléchargement de $model_name"
        return 1
    fi
}

# Télécharger MT5 (modèle léger pour développement)
echo "🧠 Préparation du modèle MT5..."
# Note: En réalité, nous utiliserons des modèles web-optimisés plus petits
# ou des API pour éviter de télécharger des modèles de plusieurs GB

# Créer des fichiers de métadonnées pour indiquer la disponibilité
cat > public/models/mt5/info.json << EOF
{
  "name": "MT5 Small",
  "version": "1.0.0",
  "description": "Modèle MT5 pour traductions courtes",
  "size": "lightweight",
  "languages": ["en", "fr", "es", "de", "it", "pt", "ru", "ja", "ko", "zh"],
  "maxTokens": 50,
  "status": "fallback_api"
}
EOF

cat > public/models/nllb/info.json << EOF
{
  "name": "NLLB Distilled",
  "version": "1.0.0", 
  "description": "Modèle NLLB pour traductions complexes",
  "size": "medium",
  "languages": ["en", "fr", "es", "de", "it", "pt", "ru", "ja", "ko", "zh", "ar", "hi", "tr"],
  "maxTokens": 500,
  "status": "fallback_api"
}
EOF

echo "📋 Fichiers de métadonnées créés"
echo "💡 Pour utiliser de vrais modèles TensorFlow.js, consultez public/models/README.md"
echo "🌐 L'application utilisera l'API MyMemory comme fallback"
echo "✨ Configuration terminée !"
