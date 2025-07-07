#!/bin/bash

# Script de création de modèles de démonstration pour Meeshy
# Crée des modèles TensorFlow.js factices pour les tests et le développement

set -e

MODELS_DIR="$(dirname "$0")/../public/models"

echo "🚀 === CRÉATION DES MODÈLES DE DÉMONSTRATION MEESHY ==="
echo ""

# Créer les répertoires nécessaires
mkdir -p "$MODELS_DIR"

# Fonction pour créer un modèle de démonstration
create_demo_model() {
    local model_name="$1"
    local family="$2"
    local size="$3"
    local model_dir="$MODELS_DIR/$model_name"
    
    echo "📦 Création du modèle de démonstration: $model_name"
    
    # Créer le répertoire du modèle
    mkdir -p "$model_dir"
    
    # Créer un model.json factice minimal
    cat > "$model_dir/model.json" << EOF
{
  "format": "layers-model",
  "generatedBy": "meeshy-demo",
  "convertedBy": "meeshy v1.0.0",
  "modelTopology": {
    "class_name": "Model",
    "config": {
      "name": "$model_name",
      "layers": []
    }
  },
  "weightsManifest": [],
  "modelInitializer": {},
  "trainingConfig": {}
}
EOF

    # Créer une configuration
    cat > "$model_dir/config.json" << EOF
{
  "name": "$model_name",
  "family": "$family",
  "size": "$size",
  "type": "demo",
  "languages": ["en", "fr", "es", "de", "it", "pt", "ru", "ja", "ko", "zh"],
  "maxLength": 512,
  "demo": true,
  "note": "Modèle de démonstration pour les tests"
}
EOF

    # Créer un tokenizer factice
    cat > "$model_dir/tokenizer.json" << EOF
{
  "version": "1.0",
  "truncation": null,
  "padding": null,
  "added_tokens": [],
  "normalizer": null,
  "pre_tokenizer": null,
  "post_processor": null,
  "decoder": null,
  "model": {
    "type": "BPE",
    "vocab": {}
  }
}
EOF

    # Créer un tokenizer_config.json
    cat > "$model_dir/tokenizer_config.json" << EOF
{
  "tokenizer_class": "T5Tokenizer",
  "eos_token": "</s>",
  "unk_token": "<unk>",
  "pad_token": "<pad>",
  "extra_ids": 100,
  "additional_special_tokens": [],
  "sp_model_kwargs": {},
  "name_or_path": "$model_name",
  "tokenizer_file": null,
  "special_tokens_map_file": null,
  "full_tokenizer_file": null
}
EOF
    
    # Créer un fichier d'informations
    cat > "$model_dir/info.json" << EOF
{
  "name": "$model_name",
  "family": "$family",
  "size": "$size",
  "downloadDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "meeshy-demo",
  "status": "demo",
  "type": "demonstration",
  "files": ["model.json", "config.json", "tokenizer.json", "tokenizer_config.json", "info.json"],
  "note": "Modèle de démonstration créé automatiquement pour les tests et le développement"
}
EOF

    echo "   ✅ Modèle de démonstration $model_name créé"
}

# Créer les modèles de démonstration
echo "📁 Répertoire des modèles: $MODELS_DIR"
echo ""

create_demo_model "mt5-small" "MT5" "small"
create_demo_model "nllb-200-distilled-600M" "NLLB" "600M"

# Créer un index des modèles disponibles
echo "📋 Création de l'index des modèles..."
cat > "$MODELS_DIR/index.json" << EOF
{
  "lastUpdate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "type": "demonstration",
  "note": "Modèles de démonstration pour le développement et les tests",
  "models": [
    {
      "name": "mt5-small",
      "path": "/models/mt5-small",
      "info": $(cat "$MODELS_DIR/mt5-small/info.json")
    },
    {
      "name": "nllb-200-distilled-600M", 
      "path": "/models/nllb-200-distilled-600M",
      "info": $(cat "$MODELS_DIR/nllb-200-distilled-600M/info.json")
    }
  ]
}
EOF

echo "✅ Index créé: $MODELS_DIR/index.json"

echo ""
echo "🎉 === MODÈLES DE DÉMONSTRATION CRÉÉS ==="
echo ""
echo "📊 Résumé:"
echo "   📂 Répertoire: $MODELS_DIR"
echo "   📋 Index: $MODELS_DIR/index.json"
echo "   🔢 Modèles de démonstration:"

for model_dir in "$MODELS_DIR"/*/; do
    if [ -d "$model_dir" ] && [ -f "$model_dir/model.json" ]; then
        model_name=$(basename "$model_dir")
        echo "      ✅ $model_name (démonstration)"
    fi
done

echo ""
echo "⚠️  IMPORTANT: Ces modèles sont des fichiers de démonstration"
echo "💡 Pour des vrais modèles TensorFlow.js, téléchargez-les depuis Hugging Face"
echo "🚀 L'application peut maintenant démarrer avec ces modèles de test"
