# Mise à jour des variables d'environnement du Translator

## 🔄 **Changements majeurs**

### 1. **Configuration ZMQ avec deux ports distincts**

**Avant :**
```bash
ZMQ_PORT=5555
```

**Après :**
```bash
ZMQ_PUSH_PORT=5555    # Port PULL pour recevoir les commandes de traduction
ZMQ_SUB_PORT=5558     # Port PUB pour publier les résultats de traduction
```

**Explication :** Le Translator utilise maintenant une architecture ZMQ PUB/SUB + PUSH/PULL avec deux ports distincts :
- **ZMQ_PUSH_PORT (5555)** : Le Translator écoute en mode PULL pour recevoir les commandes de traduction du Gateway
- **ZMQ_SUB_PORT (5558)** : Le Translator publie en mode PUB les résultats de traduction vers le Gateway

### 2. **Nouvelles variables d'environnement ajoutées**

#### **Configuration générale :**
- `DEBUG` : Mode debug (false/true)
- `FASTAPI_PORT` : Port pour l'API FastAPI (différent de HTTP_PORT)

#### **Configuration des pools ZMQ :**
- `NORMAL_POOL_SIZE` : Taille de la pool pour les conversations normales (10000)
- `ANY_POOL_SIZE` : Taille de la pool pour la conversation "any" (10000)
- `NORMAL_WORKERS` : Nombre de workers pour les conversations normales (3)
- `ANY_WORKERS` : Nombre de workers pour la conversation "any" (2)

#### **Configuration des performances :**
- `TRANSLATION_WORKERS` : Nombre total de workers de traduction (10)
- `PRISMA_POOL_SIZE` : Taille de la pool de connexions Prisma (15)
- `CACHE_MAX_ENTRIES` : Nombre maximum d'entrées en cache (10000)
- `AUTO_DETECT_LANGUAGE` : Détection automatique de langue (true)

### 3. **Variables mises à jour**

#### **Modèles de traduction :**
- `BASIC_MODEL` : on maintient à `t5-small` toute référence à `nllb-200-distilled-600M` est une erreur
- `MEDIUM_MODEL` : Maintenu à `nllb-200-distilled-600M`
- `PREMIUM_MODEL` : Maintenu à `nllb-200-distilled-1.3B`

#### **Performances :**
- `ML_BATCH_SIZE` : Augmenté de 8 à 32 pour de meilleures performances
- `MAX_TEXT_LENGTH` : Augmenté de 1000 à 5000 caractères

## 📋 **Liste complète des variables d'environnement**

### **Configuration générale :**
```bash
DEBUG=false
LOG_LEVEL=info
WORKERS=4
```

### **Configuration des ports :**
```bash
GRPC_HOST=0.0.0.0
GRPC_PORT=50051
HTTP_PORT=8000
FASTAPI_PORT=8000
ZMQ_PUSH_PORT=5555
ZMQ_SUB_PORT=5558
```

### **Configuration base de données :**
```bash
DATABASE_URL=file:../shared/dev.db
PRISMA_POOL_SIZE=15
```

### **Configuration Redis (cache) :**
```bash
REDIS_URL=redis://localhost:6379
TRANSLATION_CACHE_TTL=3600
CACHE_MAX_ENTRIES=10000
```

### **Configuration Machine Learning :**
```bash
BASIC_MODEL=t5-small
MEDIUM_MODEL=nllb-200-distilled-600M
PREMIUM_MODEL=nllb-200-distilled-1.3B
DEVICE=cpu
ML_BATCH_SIZE=32
GPU_MEMORY_FRACTION=0.8
```

### **Configuration des langues :**
```bash
SUPPORTED_LANGUAGES=fr,en,es,de,pt,zh,ja,ar
DEFAULT_LANGUAGE=fr
AUTO_DETECT_LANGUAGE=true
```

### **Configuration des performances :**
```bash
TRANSLATION_TIMEOUT=30
MAX_TEXT_LENGTH=5000
CONCURRENT_TRANSLATIONS=10
TRANSLATION_WORKERS=10
```

### **Configuration des pools ZMQ :**
```bash
NORMAL_POOL_SIZE=10000
ANY_POOL_SIZE=10000
NORMAL_WORKERS=3
ANY_WORKERS=2
```

### **Configuration des modèles :**
```bash
AUTO_CLEANUP_CORRUPTED_MODELS=true
FORCE_MODEL_REDOWNLOAD=false
```

## 🚀 **Migration**

### **Étapes de migration :**

1. **Mettre à jour le fichier .env :**
   ```bash
   # Remplacer
   ZMQ_PORT=5555
   
   # Par
   ZMQ_PUSH_PORT=5555
   ZMQ_SUB_PORT=5558
   ```

2. **Ajouter les nouvelles variables :**
   ```bash
   DEBUG=false
   FASTAPI_PORT=8000
   TRANSLATION_WORKERS=10
   PRISMA_POOL_SIZE=15
   CACHE_MAX_ENTRIES=10000
   AUTO_DETECT_LANGUAGE=true
   NORMAL_POOL_SIZE=10000
   ANY_POOL_SIZE=10000
   NORMAL_WORKERS=3
   ANY_WORKERS=2
   ```

3. **Mettre à jour les modèles :**
   ```bash
   BASIC_MODEL=T5_SMALL
   MEDIUM_MODEL=NLLB_200_DIS
   PREMIUM_MODEL=NLLB_200_DIS_13B4. **Mettre à jour les performances :**
   
   ML_BATCH_SIZE=32
   MAX_TEXT_LENGTH=5000
   ```

### **Fichiers mis à jour :**

- `translator/Dockerfile` : Ajout de toutes les nouvelles variables d'environnement
- `build-docker-images.sh` : Mise à jour des build-args pour Docker
- `translator/env.example` : Documentation complète des variables
- `translator/VARIABLES_ENV_UPDATE.md` : Ce fichier de documentation

## ⚠️ **Points d'attention**

1. **Ports ZMQ** : Assurez-vous que les ports 5555 et 5558 sont disponibles
2. **Compatibilité** : Les anciennes configurations avec `ZMQ_PORT` ne fonctionneront plus
3. **Performance** : Les nouvelles valeurs par défaut sont optimisées pour de meilleures performances
4. **Modèles** : Le passage à NLLB améliore la qualité des traductions multilingues

## 🔧 **Test de la configuration**

Après la mise à jour, testez la configuration avec :

```bash
# Vérifier que le Translator démarre correctement
cd translator
python3 start_service.py

# Vérifier les logs pour s'assurer que les deux ports ZMQ sont bien configurés
# Vous devriez voir :
# 🔌 Socket PULL lié au port: 0.0.0.0:5555
# 🔌 Socket PUB lié au port: 0.0.0.0:5558
```
