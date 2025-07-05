#!/bin/bash
# Script pour télécharger les modèles de traduction

echo "🚀 Téléchargement des modèles de traduction..."

# Créer les répertoires si nécessaire
mkdir -p public/models/mt5
mkdir -p public/models/nllb

# Fonction pour télécharger un modèle
download_model() {
    local model_name=$1
    local model_url=$2
    local destination=$3
    
    echo "📥 Téléchargement de $model_name..."
    
    if curl -L "$model_url" -o "$destination" --silent --show-error; then
        echo "✅ $model_name téléchargé avec succès"
    else
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
