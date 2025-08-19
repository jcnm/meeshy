# 🔧 Solutions pour les problèmes de traduction ML dans Docker

## 📋 **Problème identifié**

Le service de traduction Meeshy dans Docker se bloque après "Avant appel ML service" et ne parvient pas à traiter les requêtes de traduction.

### **Symptômes observés :**
- ✅ Réception correcte des commandes ZMQ
- ✅ Création des tâches de traduction
- ❌ Blocage après "Avant appel ML service"
- ❌ Modèles ML ne se chargent pas correctement
- ❌ Timeouts et erreurs de mémoire

## 🛠️ **Solutions implémentées**

### **1. Optimisations du service ML unifié**

#### **Gestion de mémoire améliorée**
```python
# Nettoyage de la mémoire avant/après chargement
gc.collect()
if torch.cuda.is_available():
    torch.cuda.empty_cache()

# Paramètres optimisés pour Docker
torch_dtype=torch.float32,  # Économiser la mémoire
low_cpu_mem_usage=True,     # Optimisation mémoire
```

#### **Timeouts et gestion d'erreurs**
```python
# Timeout pour le chargement des modèles (5 minutes)
await asyncio.wait_for(
    loop.run_in_executor(self.executor, load_model),
    timeout=300
)

# Timeout pour la traduction (1 minute)
await asyncio.wait_for(
    loop.run_in_executor(self.executor, translate),
    timeout=60
)
```

#### **Tokenizers thread-local**
```python
# Créer un tokenizer unique pour chaque thread
thread_tokenizer = AutoTokenizer.from_pretrained(
    str(model_path),
    cache_dir=str(self.models_path),
    local_files_only=True,
    use_fast=True,  # Tokenizer rapide
    model_max_length=512  # Limiter la taille
)
```

### **2. Configuration Docker optimisée**

#### **Limites de ressources ajustées**
```yaml
deploy:
  resources:
    limits:
      memory: 8G      # Réduit de 12G à 8G
      cpus: '4.0'     # Réduit de 6.0 à 4.0
    reservations:
      memory: 4G      # Réduit de 6G à 4G
      cpus: '2.0'     # Réduit de 4.0 à 2.0
```

#### **Paramètres ML optimisés**
```yaml
environment:
  ML_BATCH_SIZE: 4                    # Réduit de 16 à 4
  CONCURRENT_TRANSLATIONS: 5          # Réduit de 10 à 5
  TRANSLATION_WORKERS: 4              # Réduit de 10 à 4
  NORMAL_WORKERS: 2                   # Réduit de 3 à 2
  ANY_WORKERS: 1                      # Réduit de 2 à 1
  TRANSLATION_TIMEOUT: 60             # Augmenté de 30 à 60s
```

#### **Variables d'environnement PyTorch**
```yaml
environment:
  PYTORCH_CUDA_ALLOC_CONF: "max_split_size_mb:128"
  OMP_NUM_THREADS: 4
  MKL_NUM_THREADS: 4
  NUMEXPR_NUM_THREADS: 4
  TOKENIZERS_PARALLELISM: false
```

### **3. Dockerfile optimisé**

#### **Pré-téléchargement des modèles**
```dockerfile
# Pré-téléchargement du modèle de base
RUN python3 -c "import os; from transformers import AutoTokenizer, AutoModelForSeq2SeqLM; import torch; print('📥 Téléchargement t5-small...'); tokenizer = AutoTokenizer.from_pretrained('t5-small', cache_dir='/app/models'); model = AutoModelForSeq2SeqLM.from_pretrained('t5-small', cache_dir='/app/models'); print('✅ t5-small téléchargé avec succès'); del tokenizer, model; torch.cuda.empty_cache() if torch.cuda.is_available() else None"
```

#### **Dépendances système optimisées**
```dockerfile
RUN apt-get install -y --no-install-recommends \
    libopenblas-dev \
    liblapack-dev \
    libatlas-base-dev \
    gfortran \
    pkg-config
```

#### **PyTorch CPU optimisé**
```dockerfile
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

## 🚀 **Utilisation des solutions**

### **1. Diagnostic automatique**
```bash
# Exécuter le diagnostic complet
./translator/docker-diagnostic.sh
```

### **2. Redémarrage optimisé**
```bash
# Redémarrage avec optimisations
./translator/restart-translator.sh
```

### **3. Test de traduction**
```bash
# Test simple
curl -X POST "http://localhost:8000/translate" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","source_language":"en","target_language":"fr","model_type":"basic"}'
```

## 📊 **Améliorations de performance**

### **Avant les optimisations :**
- ❌ Blocage après "Avant appel ML service"
- ❌ Timeouts de 30 secondes
- ❌ Utilisation mémoire excessive
- ❌ Pas de gestion d'erreurs robuste

### **Après les optimisations :**
- ✅ Chargement des modèles avec timeout
- ✅ Gestion mémoire optimisée
- ✅ Timeouts configurables (60s)
- ✅ Gestion d'erreurs robuste
- ✅ Tokenizers thread-local
- ✅ Pré-téléchargement des modèles

## 🔍 **Monitoring et dépannage**

### **Logs à surveiller :**
```bash
# Surveillance en temps réel
docker logs -f translator

# Logs spécifiques ML
docker logs translator | grep -E "(ML|MODEL|TRANSLATION)"
```

### **Indicateurs de succès :**
- ✅ "Service ML unifié initialisé avec succès"
- ✅ "Modèles chargés: ['basic', 'medium']"
- ✅ "✅ [ML-ZMQ] traduction réussie"

### **Indicateurs de problème :**
- ❌ "Timeout lors du chargement du modèle"
- ❌ "Erreur pipeline"
- ❌ "Service ML non initialisé"

## 🎯 **Recommandations**

### **1. Ressources système**
- **Mémoire :** Minimum 8GB, recommandé 16GB
- **CPU :** Minimum 4 cores, recommandé 8 cores
- **Stockage :** Au moins 10GB pour les modèles

### **2. Configuration réseau**
- **Ports :** 8000 (API), 5555-5558 (ZMQ), 50051 (gRPC)
- **Latence :** < 100ms pour les communications internes

### **3. Modèles recommandés**
- **Développement :** `t5-small` (rapide, 60MB)
- **Production :** `nllb-200-distilled-600M` (équilibré, 1.2GB)
- **Haute qualité :** `nllb-200-distilled-1.3B` (précision, 2.6GB)

## 🔄 **Mise à jour et maintenance**

### **Redémarrage périodique**
```bash
# Redémarrage hebdomadaire recommandé
0 2 * * 0 /path/to/restart-translator.sh
```

### **Nettoyage des caches**
```bash
# Nettoyage mensuel
docker system prune -f
docker volume prune -f
```

### **Mise à jour des modèles**
```bash
# Forcer le re-téléchargement
docker-compose down
docker volume rm meeshy_translator_models
docker-compose up -d translator
```

## 📞 **Support**

En cas de problème persistant :
1. Exécuter le diagnostic : `./docker-diagnostic.sh`
2. Vérifier les logs : `docker logs -f translator`
3. Redémarrer avec optimisations : `./restart-translator.sh`
4. Consulter cette documentation pour les solutions spécifiques
