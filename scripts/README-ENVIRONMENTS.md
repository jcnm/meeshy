# 🚀 Environnements Meeshy - DEV vs PROD

Ce document décrit la séparation claire entre les environnements de développement (DEV) et de production (PROD) pour Meeshy.

## 🎯 Démarrage Rapide

### Environnement DEV (Local)

```bash
# Démarrage complet de l'environnement local
./scripts/development/start-local.sh

# Test de l'environnement
./scripts/development/test-local.sh

# Arrêt: Ctrl+C dans le terminal du script start-local.sh
```

### Environnement PROD (DigitalOcean)

```bash
# Configuration de la production
./scripts/production/configure-production.sh

# Démarrage de la production
./scripts/production/start-production.sh

# Arrêt de la production
./scripts/production/stop-production.sh
```

## 📊 Comparaison des Environnements

| Aspect | DEV (Local) | PROD (DigitalOcean) |
|--------|-------------|---------------------|
| **Services** | Node.js natifs | Docker containers |
| **Base de données** | MongoDB Docker | MongoDB Docker |
| **Cache** | Redis Docker | Redis Docker |
| **Reverse Proxy** | Aucun | Traefik |
| **SSL/TLS** | Non | Let's Encrypt automatique |
| **Hot Reload** | ✅ Oui | ❌ Non |
| **Arrêt** | Ctrl+C | Script stop |

## 🏗️ Structure Simplifiée

```
scripts/
├── development/           # Scripts pour l'environnement DEV
│   ├── start-local.sh    # ⭐ Démarrage environnement local (tout-en-un)
│   ├── stop-local.sh     # 🛑 Arrêt environnement local (backup)
│   └── test-local.sh     # 🧪 Test des services locaux
├── production/            # Scripts pour l'environnement PROD
│   ├── start-production.sh     # ⭐ Démarrage production
│   ├── stop-production.sh      # 🛑 Arrêt production
│   └── configure-production.sh # 🔧 Configuration production
└── deployment/            # Scripts de déploiement (existants)
```

## � Environnement DEV - Détails

### Fonctionnalités du script start-local.sh

✅ **Configuration automatique** : Crée tous les fichiers `.env.local` nécessaires  
✅ **Démarrage Docker** : Lance MongoDB et Redis via `docker-compose.dev.yml`  
✅ **Démarrage des services** : Lance Translator, Gateway, Frontend en natif  
✅ **Monitoring intégré** : Surveille que tous les services restent actifs  
✅ **Arrêt propre avec Ctrl+C** : Nettoie tous les processus et Docker containers  
✅ **Gestion des variables d'environnement** : Configure tout pour localhost  

### URLs de développement

- **Frontend**: http://localhost:3100
- **Gateway**: http://localhost:3000  
- **Translator**: http://localhost:8000
- **MongoDB**: mongodb://localhost:27017
- **Redis**: redis://localhost:6379

### Configuration automatique

Le script `start-local.sh` configure automatiquement :

```bash
# Variables pour localhost
DATABASE_URL=mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/ws
# ... et toutes les autres variables nécessaires
```

## 🛠️ Utilisation

### Développement Normal

```bash
# Démarrer l'environnement
./scripts/development/start-local.sh

# Les services démarrent automatiquement :
# 1. MongoDB + Redis (Docker)
# 2. Translator (Python/FastAPI)
# 3. Gateway (Node.js/Fastify) 
# 4. Frontend (Next.js)

# Développer avec hot-reload activé
# - Frontend : Rechargement auto des modifications
# - Gateway : Redémarrage auto avec nodemon
# - Translator : Redémarrage auto avec uvicorn --reload

# Arrêter avec Ctrl+C
# - Arrête tous les services Node.js/Python
# - Arrête les containers Docker
# - Nettoie les fichiers de logs
```

### Test et Vérification

```bash
# Tester que tous les services fonctionnent
./scripts/development/test-local.sh

# Vérifier les logs en temps réel
tail -f translator/translator.log
tail -f gateway/gateway.log  
tail -f frontend/frontend.log
```

## 🐳 Docker Compose DEV

Le fichier `docker-compose.dev.yml` ne démarre que l'infrastructure :

```yaml
services:
  database:    # MongoDB sur port 27017
  redis:       # Redis sur port 6379
```

Les services applicatifs (Gateway, Translator, Frontend) sont démarrés nativement pour permettre le hot-reload et un développement plus rapide.

## 🎉 Avantages de la Nouvelle Structure

### Pour le Développement
- ✅ **Un seul script** pour tout démarrer
- ✅ **Configuration automatique** des variables d'environnement
- ✅ **Arrêt propre** avec Ctrl+C
- ✅ **Hot reload** pour tous les services
- ✅ **Logs centralisés** et monitoring intégré

### Pour la Production  
- ✅ **Séparation claire** DEV/PROD
- ✅ **Configuration sécurisée** avec variables d'environnement appropriées
- ✅ **Docker complet** pour la production
- ✅ **SSL automatique** avec Let's Encrypt

## 🔍 Dépannage

### Problèmes Courants

#### Ports occupés
```bash
# Le script vérifie automatiquement les ports
# Si erreur : arrêter les processus existants
pkill -f "node.*server"
pkill -f "python.*main"
```

#### Services qui ne démarrent pas
```bash
# Vérifier les logs
cat translator/translator.log
cat gateway/gateway.log
cat frontend/frontend.log

# Redémarrer seulement l'infrastructure
docker-compose -f docker-compose.dev.yml restart
```

#### Variables d'environnement
Les fichiers `.env.local` sont automatiquement créés par le script dans :
- `/meeshy/.env.local` (global)
- `/frontend/.env.local` 
- `/gateway/.env.local`
- `/translator/.env.local`

## 📚 Scripts Supprimés

Scripts inutiles supprimés pour simplifier :
- ❌ Anciens `start-local.sh` et `start-local-simple.sh`
- ❌ Scripts de configuration redondants
- ❌ Scripts de test/validation non utilisés  
- ❌ Scripts de déploiement obsolètes

Seuls les scripts essentiels sont conservés pour une maintenance plus facile.
