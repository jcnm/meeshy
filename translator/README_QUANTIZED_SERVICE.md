# Service de Traduction Quantifié - Améliorations

## Problème résolu

Le service `quantized_ml_service` se bloquait lors du chargement des modèles ML sans afficher de progression et avec des timeouts infinis.

## Améliorations apportées

### 1. Affichage de progression détaillé

- **Progression par modèle** : Affichage du numéro du modèle en cours de chargement (ex: `[1/3]`)
- **Temps de chargement** : Mesure et affichage du temps de chargement pour chaque étape
- **Logs détaillés** : Informations sur chaque étape du processus de chargement

### 2. Gestion des timeouts

- **Timeout tokenizer** : 30 secondes (configurable via `TOKENIZER_LOAD_TIMEOUT`)
- **Timeout modèle** : 60 secondes (configurable via `MODEL_LOAD_TIMEOUT`)
- **Timeout HuggingFace** : 120 secondes (configurable via `HUGGINGFACE_TIMEOUT`)
- **Timeout traduction** : Réduit de 30 à 15 secondes

### 3. Système de retry avec backoff

- **3 tentatives** de chargement par modèle
- **Délai croissant** : 5s, 10s, 20s entre les tentatives
- **Gestion d'erreur** robuste avec logs détaillés

### 4. Configuration améliorée

Nouveaux paramètres dans `settings.py` :

```python
# Configuration des timeouts pour le chargement des modèles
self.model_load_timeout = int(os.getenv("MODEL_LOAD_TIMEOUT", "60"))
self.tokenizer_load_timeout = int(os.getenv("TOKENIZER_LOAD_TIMEOUT", "30"))
self.huggingface_timeout = int(os.getenv("HUGGINGFACE_TIMEOUT", "120"))
```

## Utilisation

### Variables d'environnement recommandées

```bash
# Timeouts pour éviter les blocages
MODEL_LOAD_TIMEOUT=60
TOKENIZER_LOAD_TIMEOUT=30
HUGGINGFACE_TIMEOUT=120

# Performance
TRANSLATION_TIMEOUT=15
TRANSLATION_WORKERS=50

# Quantification
QUANTIZATION_LEVEL=float16
```

### Test du service

```bash
cd translator
python test_quantized_service.py
```

## Exemple de sortie

```
2025-08-23 10:00:00 - services.quantized_ml_service - INFO - 🤖 Service ML Quantifié créé: basic avec float16 (2 workers)
2025-08-23 10:00:00 - services.quantized_ml_service - INFO - 🚀 Initialisation modèle(s) quantifié(s): basic (float16)
2025-08-23 10:00:00 - services.quantized_ml_service - INFO - 📚 Chargement modèle unique basic...
2025-08-23 10:00:00 - services.quantized_ml_service - INFO - 📥 Chargement modèle basic (float16): facebook/nllb-200-distilled-600M
2025-08-23 10:00:00 - services.quantized_ml_service - INFO - 🔄 Tentative 1/3 de chargement du modèle basic
2025-08-23 10:00:00 - services.quantized_ml_service - INFO - 📥 Chargement tokenizer pour facebook/nllb-200-distilled-600M
2025-08-23 10:00:00 - services.quantized_ml_service - INFO - ⏱️ Timeout tokenizer: 30s
2025-08-23 10:00:05 - services.quantized_ml_service - INFO - ✅ Tokenizer chargé pour basic en 5.23s
2025-08-23 10:00:05 - services.quantized_ml_service - INFO - ✅ accelerate disponible, device_map activé
2025-08-23 10:00:05 - services.quantized_ml_service - INFO - 📥 Chargement modèle avec quantification float16
2025-08-23 10:00:05 - services.quantized_ml_service - INFO - ⏱️ Timeout modèle: 60s
2025-08-23 10:00:05 - services.quantized_ml_service - INFO - 🔧 Configuration float16...
2025-08-23 10:00:15 - services.quantized_ml_service - INFO - ✅ Modèle basic chargé avec succès (float16) en 10.45s
2025-08-23 10:00:15 - services.quantized_ml_service - INFO - ⏱️ Temps total de chargement: 15.68s
2025-08-23 10:00:15 - services.quantized_ml_service - INFO - 💾 Mémoire GPU utilisée: 1250.45 MB
2025-08-23 10:00:15 - services.quantized_ml_service - INFO - ✅ Modèle quantifié chargé: basic (float16)
```

## Avantages

1. **Visibilité** : L'utilisateur voit exactement où le processus en est
2. **Fiabilité** : Les timeouts évitent les blocages infinis
3. **Robustesse** : Le système de retry gère les erreurs temporaires
4. **Performance** : Configuration optimisée pour un démarrage rapide
5. **Maintenabilité** : Logs détaillés facilitent le debugging

## Troubleshooting

### Si le chargement échoue

1. Vérifier la connexion internet
2. Augmenter les timeouts si nécessaire
3. Vérifier l'espace disque disponible
4. Consulter les logs pour identifier l'erreur spécifique

### Variables d'environnement pour le debugging

```bash
DEBUG=true
MODEL_LOAD_TIMEOUT=120
TOKENIZER_LOAD_TIMEOUT=60
HUGGINGFACE_TIMEOUT=300
```
