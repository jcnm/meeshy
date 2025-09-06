# ✅ Correction des Chemins Locaux - Translator et Gateway

## 🐛 Problèmes Identifiés

### 1. Chargement de Fichiers .env
**Problème :** Les scripts `translator.sh` et `gateway.sh` cherchaient le fichier `../.env` au lieu des fichiers `.env.local` spécifiques.

**Solution :** Modifié la fonction `load_env_file()` pour chercher dans l'ordre :
1. `.env.local` (local au service)
2. `../.env.local` (global)  
3. `../.env` (fallback)

### 2. Chemins `/workspace` pour Docker
**Problème :** Les services utilisaient des chemins Docker (`/workspace/models`, `/workspace/cache`, etc.) en mode développement local.

**Solution :** Ajouté des variables d'environnement locales dans tous les fichiers `.env.local`.

## 🔧 Modifications Apportées

### Scripts de Démarrage

#### `translator/translator.sh`
```bash
# Avant
load_env_file() {
    local env_file="../.env"
    # ...
}

# Après  
load_env_file() {
    local env_files=(".env.local" "../.env.local" "../.env")
    for env_file in "${env_files[@]}"; do
        if [[ -f "$env_file" ]]; then
            # Charge le premier fichier trouvé
            return 0
        fi
    done
}
```

#### `gateway/gateway.sh`
Même modification que pour le translator.

### Fichiers de Configuration

#### `.env.local` (global)
```bash
# Ajouté :
MODELS_PATH=./models
TORCH_HOME=./models
HF_HOME=./models
MODEL_CACHE_DIR=./models
CACHE_DIR=./cache
LOG_DIR=./logs
PRISMA_CLIENT_OUTPUT_DIRECTORY=./generated
```

#### `translator/.env.local`
```bash
# Ajouté :
MODELS_PATH=./models
TORCH_HOME=./models
HF_HOME=./models
MODEL_CACHE_DIR=./models
CACHE_DIR=./cache
LOG_DIR=./logs
PYTHONPATH=./generated
PRISMA_CLIENT_OUTPUT_DIRECTORY=./generated
```

#### `gateway/.env.local`
```bash
# Ajouté :
MODELS_PATH=./models
TORCH_HOME=./models
HF_HOME=./models
MODEL_CACHE_DIR=./models
CACHE_DIR=./cache
LOG_DIR=./logs
PRISMA_CLIENT_OUTPUT_DIRECTORY=./generated
```

### Script `start-local.sh`
Mis à jour pour générer automatiquement tous les fichiers `.env.local` avec les bonnes variables locales.

### Répertoires Créés
```bash
translator/
├── models/     # Modèles ML (remplace /workspace/models)
├── cache/      # Cache local (remplace /workspace/cache)
├── logs/       # Logs locaux (remplace /workspace/logs)
└── generated/  # Client Prisma généré

gateway/
├── models/     # Modèles ML
├── cache/      # Cache local
├── logs/       # Logs locaux
└── generated/  # Client Prisma généré
```

## ✅ Résultats Attendus

### Variables Correctement Configurées
```bash
# Au lieu de :
MODELS_PATH=/workspace/models      # ❌ Chemin Docker
TORCH_HOME=/workspace/models       # ❌ Chemin Docker
HF_HOME=/workspace/models          # ❌ Chemin Docker

# Maintenant :
MODELS_PATH=./models               # ✅ Chemin local
TORCH_HOME=./models                # ✅ Chemin local  
HF_HOME=./models                   # ✅ Chemin local
```

### Chargement des Fichiers
```bash
# Les services chargent maintenant dans l'ordre :
1. service/.env.local              # Configuration spécifique
2. ../.env.local                   # Configuration globale
3. ../.env                         # Fallback legacy
```

### Structure des Répertoires
```bash
# Chaque service a ses propres répertoires locaux :
translator/
├── .env.local          # ✅ Configuration locale
├── models/             # ✅ Modèles ML locaux
├── cache/              # ✅ Cache local
├── logs/               # ✅ Logs locaux
└── generated/          # ✅ Client Prisma local

gateway/
├── .env.local          # ✅ Configuration locale
├── models/             # ✅ Modèles ML locaux
├── cache/              # ✅ Cache local
├── logs/               # ✅ Logs locaux
└── generated/          # ✅ Client Prisma local
```

## 🎯 Test des Corrections

Pour tester que les corrections fonctionnent :

```bash
# 1. Vérifier que les fichiers .env.local sont bien chargés
cd translator && ./translator.sh
# Doit afficher : "✅ [TRA] Chargement des variables depuis .env.local"

cd ../gateway && ./gateway.sh  
# Doit afficher : "✅ [GWY] Chargement des variables depuis .env.local"

# 2. Vérifier les chemins dans les logs
# Les logs ne doivent plus contenir "/workspace" mais "./models", "./cache", etc.

# 3. Utiliser le script complet
cd .. && ./scripts/development/start-local.sh
# Tous les services doivent se configurer automatiquement avec les bons chemins
```

## 🚀 Avantages

✅ **Séparation DEV/PROD** : Chemins locaux pour dev, Docker pour prod  
✅ **Configuration automatique** : Le script `start-local.sh` configure tout  
✅ **Flexibilité** : Chaque service peut avoir sa config spécifique  
✅ **Compatibilité** : Fallback vers les anciens fichiers .env  
✅ **Isolation** : Chaque service a ses propres répertoires  

La configuration est maintenant **complètement locale** et ne dépend plus des chemins Docker ! 🎉
