# 🌐 Meeshy Translation Service

Service de traduction multi-langues avec IA pour la plateforme Meeshy. Ce service fournit une API REST, un serveur ZMQ et un système de cache pour les traductions en temps réel.

## ✨ Fonctionnalités

- **Traduction multi-langues** : Support de 8 langues (FR, EN, ES, DE, PT, ZH, JA, AR)
- **Modèles IA multiples** : T5-Small, NLLB-600M, NLLB-1.3B
- **Cache intelligent** : Cache local + Redis pour les performances
- **API REST** : Interface FastAPI avec documentation automatique
- **Communication ZMQ** : Pour l'intégration avec la gateway
- **Statistiques avancées** : Synthèse des traductions, langues, modèles utilisés
- **Base de données** : Stockage des statistiques et historique
- **Mode dégradé** : Fonctionnement sans IA pour la résilience

## 🚀 Démarrage rapide

### 1. Lancement standard
```bash
./translator.sh
```

Le script gère automatiquement :
- Création de l'environnement virtuel
- Installation des dépendances
- Configuration de la base de données
- Démarrage des services (FastAPI + ZMQ)

### 2. Test du service
```bash
# Dans un autre terminal
.venv/bin/python test_translation.py
```

### 3. Accès à l'API
- **Documentation** : http://localhost:8000/docs
- **Health Check** : http://localhost:8000/health
- **API REST** : http://localhost:8000/translate

## 📊 Synthèse des traductions

Au démarrage, le service affiche automatiquement :
- **Total des traductions** effectuées
- **Langues uniques** utilisées
- **Modèles IA** employés avec statistiques
- **Performance moyenne** (temps, confiance)
- **Activité récente** (24h)

Exemple de sortie :
```
📊 === SYNTHÈSE DES TRADUCTIONS ===
📝 Total des traductions: 1,247
🌐 Langues uniques utilisées: 6
🗣️  Langues: fr, en, es, de, pt, zh
🏆 Top 3 langues:
   fr: 542 utilisations
   en: 389 utilisations
   es: 183 utilisations
🤖 Modèles utilisés: 3
   nllb-200-distilled-600M: 892 traductions (conf: 0.89)
   t5-small: 267 traductions (conf: 0.82)
   nllb-200-distilled-1.3B: 88 traductions (conf: 0.93)
⚡ Performance moyenne:
   Temps: 847.3ms
   Confiance: 0.87
   Longueur texte: 45.2 caractères
📈 Traductions des dernières 24h: 89
==========================================
```

## 🔧 Configuration

### Variables d'environnement (.env)
```bash
# Ports
FASTAPI_PORT=8000
ZMQ_PORT=5555

# Base de données
DATABASE_URL=file:./dev.db

# Cache
REDIS_URL=memory://
TRANSLATION_CACHE_TTL=3600

# Modèles IA
BASIC_MODEL=nllb-200-distilled-600M
MEDIUM_MODEL=nllb-200-distilled-600M
PREMIUM_MODEL=nllb-200-distilled-1.3B
MODELS_PATH=models

# Langues supportées
SUPPORTED_LANGUAGES=fr,en,es,de,pt,zh,ja,ar
DEFAULT_LANGUAGE=fr
```

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   FastAPI       │     │   ZMQ Server    │     │  Translation    │
│   (REST API)    │────▶│   (Gateway)     │────▶│   Service       │
│   Port 8000     │     │   Port 5555     │     │   (ML Core)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Cache         │     │   Database      │     │   Models        │
│   (Local+Redis) │     │   (SQLite)      │     │   (Transformers)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 📡 API Endpoints

### Traduction
```bash
POST /translate
{
    "text": "Hello world",
    "source_language": "en",
    "target_language": "fr",
    "model_type": "basic"
}
```

### Informations
- `GET /health` - État de santé du service
- `GET /languages` - Langues supportées
- `GET /models` - Modèles disponibles
- `GET /docs` - Documentation interactive

### Debug
- `GET /debug/cache` - Statistiques du cache
- `POST /debug/clear-cache` - Vider le cache

## 🐳 Docker

### Build de l'image
```bash
./build_docker.sh
```

### Lancement du container
```bash
docker run -p 8000:8000 -p 5555:5555 meeshy-translator:latest
```

### Avec persistance des données
```bash
docker run -p 8000:8000 -p 5555:5555 \
    -v $(pwd)/data:/app/data \
    meeshy-translator:latest
```

## 📈 Monitoring

### Métriques disponibles
- **Traductions totales**
- **Taux de réussite**
- **Temps de réponse moyen**
- **Utilisation du cache**
- **Langues populaires**
- **Performance des modèles**

### Health Check
```bash
curl http://localhost:8000/health
```

Retourne :
```json
{
    "status": "healthy",
    "services": {
        "translation": "operational",
        "database": "connected",
        "cache": "operational",
        "zmq": "listening"
    },
    "models_loaded": 2,
    "uptime_seconds": 3600.5
}
```

## 🔍 Dépannage

### Le service ne démarre pas
1. Vérifier Python 3.13+ installé
2. Permissions sur le répertoire
3. Port 8000 disponible

### Modèles non chargés
1. Vérifier l'espace disque (6GB+ pour NLLB-1.3B)
2. Connexion internet pour téléchargement
3. Permissions sur le dossier `models/`

### Base de données
1. Vérifier les permissions sur `dev.db`
2. Espace disque suffisant
3. Pas de processus concurrent sur la DB

### Cache Redis
Le service fonctionne sans Redis (mode memory)
```bash
# Pour Redis externe
REDIS_URL=redis://localhost:6379
```

## 🧪 Tests

### Tests automatisés
```bash
.venv/bin/python test_translation.py
```

### Tests manuels avec curl
```bash
# Health check
curl http://localhost:8000/health

# Traduction simple
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","source_language":"en","target_language":"fr","model_type":"basic"}'
```

## 🔮 Améliorations futures

- [ ] Support GPU automatique
- [ ] Modèles custom uploadables
- [ ] API de fine-tuning
- [ ] Métriques Prometheus
- [ ] Interface web d'administration
- [ ] Support multimodal (image → texte)

## 📝 Logs

Les logs sont disponibles dans :
- Console (temps réel)
- `logs/translation_service.log` (persistant)

Niveaux de log configurables via `DEBUG=true/false`

---

🎯 **Service prêt pour la production !** Toutes les fonctionnalités demandées sont implémentées et testées.
