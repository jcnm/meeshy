# Configuration Meeshy - Guide de mise à jour des variables d'environnement

## 🎯 Objectif
Ce document explique comment la plateforme Meeshy utilise maintenant les variables d'environnement depuis le fichier `.env` pour toutes les configurations de base et d'infrastructure.

## 📁 Fichiers mis à jour

### 1. **`.env`** - Configuration principale
```bash
# ===== CONFIGURATION MEESHY - ENVIRONNEMENT LOCAL =====

# === FRONTEND CONFIGURATION ===
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3100
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_TRANSLATION_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:3000

# === BACKEND FASTIFY CONFIGURATION ===
PORT=3000
FRONTEND_URL=http://localhost:3100
CORS_ORIGIN=http://localhost:3100

# === TRANSLATION SERVICE CONFIGURATION ===  
FASTAPI_PORT=8000
GRPC_PORT=50051
ZMQ_PORT=5555
TRANSLATION_SERVICE_URL=http://localhost:8000

# === DATABASE CONFIGURATION ===
DATABASE_URL="file:./dev.db"
PRISMA_POOL_SIZE=10

# === JWT CONFIGURATION ===
JWT_SECRET=meeshy-dev-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# === ML MODELS CONFIGURATION ===
BASIC_MODEL=mt5-small
MEDIUM_MODEL=nllb-200-distilled-600M
PREMIUM_MODEL=nllb-200-distilled-1.3B
MODELS_PATH=/Users/smpceo/Downloads/Meeshy/meeshy/public/models

# === PERFORMANCE CONFIGURATION ===
ML_BATCH_SIZE=8
GPU_MEMORY_FRACTION=0.8
TRANSLATION_TIMEOUT=30
MAX_TEXT_LENGTH=1000
CONCURRENT_TRANSLATIONS=10
WORKERS=4

# === LANGUAGE CONFIGURATION ===
DEFAULT_LANGUAGE=fr
SUPPORTED_LANGUAGES=fr,en,es,de,pt,zh,ja,ar
AUTO_DETECT_LANGUAGE=true

# === DEVELOPMENT CONFIGURATION ===
NODE_ENV=development
DEBUG=true
LOG_LEVEL=info
```

### 2. **`main_clean.py`** - Service de traduction Python
- ✅ Chargement automatique du fichier `.env`
- ✅ Configuration du logging depuis `LOG_LEVEL`
- ✅ Port configuré depuis `FASTAPI_PORT`
- ✅ Mode debug depuis `DEBUG`

### 3. **`src/lib/config.ts`** - Configuration centralisée TypeScript
- ✅ Interface TypeScript complète pour toutes les configurations
- ✅ Parsing automatique des booléens et arrays
- ✅ Valeurs par défaut pour tous les paramètres
- ✅ Fonctions helper pour le debugging

### 4. **`next.config.ts`** - Configuration Next.js
- ✅ URLs mises à jour pour utiliser `NEXT_PUBLIC_BACKEND_URL`
- ✅ Variables d'environnement publiques correctement configurées

### 5. **`launch_meeshy_clean.sh`** - Script de lancement
- ✅ Chargement automatique des variables depuis `.env`
- ✅ Ports dynamiques basés sur les variables d'environnement
- ✅ Affichage de la configuration active
- ✅ URLs générées dynamiquement

## 🔧 Utilisation

### Validation de la configuration
```bash
cd /Users/smpceo/Downloads/Meeshy/meeshy
npm run validate:config
```

### Lancement de la plateforme
```bash
cd /Users/smpceo/Downloads/Meeshy/meeshy
./launch_meeshy_clean.sh
```

### Modification des configurations
1. Éditer le fichier `.env`
2. Relancer les services concernés
3. Les nouvelles configurations sont automatiquement chargées

### Services et ports par défaut
- **Frontend Next.js**: http://localhost:3100
- **Backend Fastify**: http://localhost:3000  
- **Service de traduction**: http://localhost:8000

### Pages de test
- **Page principale**: http://localhost:3100
- **Test de traduction**: http://localhost:3100/demo-translation
- **Chat en temps réel**: http://localhost:3100/chat

## 🌟 Avantages de cette approche

### ✅ Centralisation
- Toutes les configurations dans un seul fichier `.env`
- Plus de duplication de valeurs dans le code
- Configuration cohérente entre tous les services

### ✅ Flexibilité
- Facile de changer les ports et URLs
- Support de différents environnements (dev, prod)
- Configuration personnalisable sans toucher au code

### ✅ Sécurité
- Secrets (JWT, API keys) dans des variables d'environnement
- Fichier `.env` peut être exclu du versioning
- Configuration spécifique par environnement

### ✅ Performance
- Configuration ML optimisable via variables
- Paramètres de performance ajustables
- Monitoring et debugging configurables

## 🚀 Pour l'optimisation des performances de traduction

La configuration permet maintenant d'ajuster facilement les paramètres ML pour atteindre 10+ traductions/seconde :

```bash
# Optimisation pour la performance (jusqu'à 10+ traductions/seconde)
ML_BATCH_SIZE=16                    # Traitement par batch plus large
CONCURRENT_TRANSLATIONS=20          # Plus de traductions simultanées  
WORKERS=8                          # Plus de workers Python
GPU_MEMORY_FRACTION=0.9            # Utilisation GPU maximale
TRANSLATION_TIMEOUT=60             # Timeout plus élevé pour les tâches complexes
```

## 📊 Monitoring et debugging

```bash
# Activer le mode debug détaillé
DEBUG=true
LOG_LEVEL=debug

# Vérifier les logs
tail -f translation_service.log
tail -f fastify_service.log
tail -f frontend_service.log
```

La plateforme Meeshy est maintenant **entièrement configurée via des variables d'environnement**, rendant la gestion, le déploiement et l'optimisation beaucoup plus flexibles et professionnelles ! 🎉
