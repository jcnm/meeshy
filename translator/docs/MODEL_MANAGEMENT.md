# Gestion des Modèles ML - Meeshy Translator

## Vue d'ensemble

Le système de gestion des modèles ML a été amélioré pour éviter les timeouts lors du chargement des modèles. Il vérifie maintenant l'existence locale des modèles avant de tenter de les télécharger.

## Fonctionnalités

### ✅ Vérification préalable des modèles
- Détection automatique des modèles existants localement
- Évite les téléchargements inutiles
- Vérification des fichiers essentiels (config.json, tokenizer.json, etc.)

### 📥 Téléchargement intelligent
- Téléchargement uniquement des modèles manquants
- Support des formats modernes (.safetensors)
- Reprise automatique des téléchargements interrompus
- Gestion des erreurs et timeouts

### 🧹 Nettoyage automatique
- Suppression des téléchargements incomplets
- Optimisation de l'espace disque
- Détection des fichiers corrompus

## Architecture

### ModelManager
```python
from utils.model_utils import create_model_manager

# Créer un gestionnaire
manager = create_model_manager("/path/to/models")

# Vérifier un modèle
if manager.is_model_downloaded("facebook/nllb-200-distilled-600M"):
    print("Modèle disponible localement")

# Télécharger si nécessaire
success = manager.download_model_if_needed("facebook/nllb-200-distilled-600M")
```

### QuantizedMLService
Le service de traduction intègre maintenant automatiquement la vérification des modèles :

```python
# Le service vérifie automatiquement les modèles au démarrage
service = QuantizedMLService(model_type="all")
await service.initialize()  # Vérification + téléchargement automatique
```

## Scripts utilitaires

### 1. Vérification des modèles
```bash
cd translator
python check_and_download_models.py --check
```

### 2. Téléchargement des modèles manquants
```bash
python check_and_download_models.py --download
```

### 3. Nettoyage des téléchargements incomplets
```bash
python check_and_download_models.py --cleanup
```

### 4. Toutes les opérations
```bash
python check_and_download_models.py --all
```

### 5. Démarrage avec vérification automatique
```bash
python start_service_with_model_check.py
```

## Configuration

### Variables d'environnement
```bash
# Chemin des modèles
MODELS_PATH=/app/models

# Timeouts pour le chargement
MODEL_LOAD_TIMEOUT=160
TOKENIZER_LOAD_TIMEOUT=30
HUGGINGFACE_TIMEOUT=120

# Modèles configurés
BASIC_MODEL=facebook/nllb-200-distilled-600M
MEDIUM_MODEL=facebook/nllb-200-distilled-600M
PREMIUM_MODEL=facebook/nllb-200-distilled-1.3B
```

### Structure des répertoires
```
models/
├── facebook_nllb-200-distilled-600M/
│   ├── config.json
│   ├── pytorch_model.bin (ou *.safetensors)
│   ├── tokenizer.json
│   └── tokenizer_config.json
└── facebook_nllb-200-distilled-1.3B/
    ├── config.json
    ├── pytorch_model.bin (ou *.safetensors)
    ├── tokenizer.json
    └── tokenizer_config.json
```

## Tests

### Test complet du système
```bash
python test_model_verification.py
```

Ce test vérifie :
- ✅ Vérification de l'existence des modèles
- ✅ Téléchargement des modèles manquants
- ✅ Chargement des modèles depuis le stockage local
- ✅ Test de traduction avec les modèles chargés

## Résolution des problèmes

### Erreur de timeout
Si vous rencontrez encore des timeouts :

1. **Vérifiez la connectivité réseau**
   ```bash
   ping huggingface.co
   ```

2. **Vérifiez l'espace disque**
   ```bash
   df -h /path/to/models
   ```

3. **Nettoyez les téléchargements incomplets**
   ```bash
   python check_and_download_models.py --cleanup
   ```

4. **Forcez le re-téléchargement**
   ```bash
   python check_and_download_models.py --download --force
   ```

### Modèles corrompus
Si un modèle semble corrompu :

1. **Supprimez le répertoire du modèle**
   ```bash
   rm -rf models/facebook_nllb-200-distilled-600M
   ```

2. **Re-téléchargez le modèle**
   ```bash
   python check_and_download_models.py --download
   ```

## Performance

### Optimisations implémentées
- ✅ Chargement depuis le stockage local (plus rapide)
- ✅ Vérification préalable (évite les timeouts)
- ✅ Téléchargement concurrent des modèles
- ✅ Support des formats optimisés (.safetensors)
- ✅ Quantification automatique (float16, int8)

### Métriques attendues
- **Temps de chargement** : < 30s pour les modèles locaux
- **Temps de téléchargement** : Variable selon la bande passante
- **Espace disque** : ~2.5GB pour tous les modèles
- **Mémoire** : Optimisée selon la quantification

## Logs

### Messages d'information
```
🔍 Vérification de la disponibilité des modèles...
✅ Modèle facebook/nllb-200-distilled-600M trouvé localement
📥 Modèle manquant: facebook/nllb-200-distilled-1.3B (1.2 GB)
🚀 Téléchargement de 1 modèle(s) manquant(s)...
✅ Modèle facebook/nllb-200-distilled-1.3B téléchargé avec succès
```

### Messages d'erreur
```
❌ Fichier manquant: /path/to/models/config.json
❌ Erreur téléchargement facebook/nllb-200-distilled-600M: Timeout
⚠️ Quantification int8 échouée, fallback float32
```

## Support

Pour toute question ou problème :
1. Consultez les logs détaillés
2. Vérifiez la configuration
3. Testez avec les scripts utilitaires
4. Consultez la documentation HuggingFace
