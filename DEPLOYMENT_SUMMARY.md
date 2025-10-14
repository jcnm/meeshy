# 📦 Déploiement Docker Local - Résumé des Fichiers Créés

## ✅ Configuration Complète du Déploiement Local

Voici tous les fichiers créés pour permettre un déploiement Docker complet en local.

### 📋 Fichiers Créés

#### 1. **docker-compose.dev.yml** ⭐
Configuration Docker Compose complète pour développement local avec:
- MongoDB (avec Replica Set)
- Redis (cache)
- Translator (service ML)
- Gateway (API + WebSocket)
- Frontend (Next.js)
- NoSQLClient (MongoDB UI)
- P3X Redis UI (Redis UI)

**Tous les services utilisent les dernières images Docker**

#### 2. **.env.dev**
Variables d'environnement pour le développement local:
- Images Docker (latest)
- Configuration MongoDB et Redis
- Utilisateurs par défaut
- URLs et CORS

#### 3. **start-dev.sh** 🚀
Script principal de démarrage avec commandes:
- `./start-dev.sh` - Démarrer
- `./start-dev.sh stop` - Arrêter
- `./start-dev.sh logs` - Voir les logs
- `./start-dev.sh status` - Statut
- `./start-dev.sh clean` - Nettoyer
- `./start-dev.sh reset` - Reset DB

#### 4. **health-check.sh** 🏥
Script de vérification de santé qui teste:
- Conteneurs Docker
- Services HTTP
- API endpoints
- Traductions

#### 5. **update-dev.sh** 🔄
Script de mise à jour automatique:
- Télécharge les dernières images
- Redémarre les services
- Vérifie la santé

#### 6. **validate-setup.sh** ✅
Script de validation de configuration:
- Prérequis (Docker, curl, etc.)
- Fichiers de configuration
- Permissions des scripts
- Structure du projet

#### 7. **Makefile** 🔨
Commandes Make pour faciliter l'utilisation:
```bash
make start      # Démarrer
make stop       # Arrêter
make logs       # Voir logs
make health     # Vérifier santé
make pull       # Mettre à jour images
```

### 📚 Documentation Créée

#### 8. **README.md** 📖
README principal complet avec:
- Vue d'ensemble du projet
- Architecture
- Quick start
- Stack technique
- Monitoring

#### 9. **QUICKSTART_DEV.md** 🏃
Guide de démarrage rapide en 3 étapes:
1. Télécharger les images
2. Démarrer les services
3. Accéder à l'application

#### 10. **DEPLOYMENT_LOCAL_DOCKER.md** 📘
Documentation complète du déploiement Docker local:
- Architecture des services
- URLs d'accès
- Commandes disponibles
- Configuration
- Dépannage
- Monitoring

#### 11. **DEPLOYMENT_COMPARISON.md** 🔄
Comparaison des 3 modes de déploiement:
- Development Local (docker-compose.dev.yml)
- Production Traefik (docker-compose.traefik.yml)
- Production Simple (docker-compose.yml)

## 🚀 Comment Utiliser

### Méthode 1: Script de Démarrage (Recommandé)

```bash
# 1. Valider la configuration
./validate-setup.sh

# 2. Télécharger les images
./start-dev.sh pull

# 3. Démarrer tous les services
./start-dev.sh

# 4. Vérifier la santé
./health-check.sh
```

### Méthode 2: Makefile

```bash
# Démarrage complet avec validation
make quick

# Ou étape par étape
make pull
make start
make health
```

### Méthode 3: Docker Compose Direct

```bash
docker-compose -f docker-compose.dev.yml --env-file .env.dev up -d
```

## 📍 URLs d'Accès après Démarrage

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3100 | Interface utilisateur |
| **Gateway** | http://localhost:3000 | API REST + WebSocket |
| **Translator** | http://localhost:8000 | API de traduction ML |
| **MongoDB UI** | http://localhost:3001 | NoSQLClient |
| **Redis UI** | http://localhost:7843 | P3X Redis UI |

## 🔐 Utilisateurs de Test

| Email | Mot de passe | Langue |
|-------|--------------|--------|
| admin@meeshy.local | admin123 | 🇫🇷 Français |
| meeshy@meeshy.local | meeshy123 | 🇬🇧 Anglais |
| atabeth@meeshy.local | atabeth123 | 🇪🇸 Espagnol |

## 📊 Structure des Fichiers

```
meeshy/
├── docker-compose.dev.yml          # Config Docker Compose dev
├── docker-compose.traefik.yml      # Config Docker Compose prod (Traefik)
├── docker-compose.yml              # Config Docker Compose prod (simple)
│
├── .env.dev                        # Variables env dev
│
├── start-dev.sh                    # Script de démarrage
├── health-check.sh                 # Script de vérification santé
├── update-dev.sh                   # Script de mise à jour
├── validate-setup.sh               # Script de validation
│
├── Makefile                        # Commandes Make
│
├── README.md                       # Documentation principale
├── QUICKSTART_DEV.md              # Quick start
├── DEPLOYMENT_LOCAL_DOCKER.md     # Guide déploiement Docker
├── DEPLOYMENT_COMPARISON.md        # Comparaison déploiements
│
├── frontend/                       # Service Frontend
├── gateway/                        # Service Gateway
├── translator/                     # Service Translator
└── shared/                         # Code partagé
```

## ⚙️ Configuration Avancée

### Changer les Ports

Éditez `docker-compose.dev.yml`:

```yaml
services:
  frontend:
    ports:
      - "3200:3100"  # Changer 3100 en 3200
```

### Utiliser des Images Personnalisées

Éditez `.env.dev`:

```env
TRANSLATOR_IMAGE=mon-registry/meeshy-translator:custom
GATEWAY_IMAGE=mon-registry/meeshy-gateway:custom
FRONTEND_IMAGE=mon-registry/meeshy-frontend:custom
```

### Activer le Debug

Éditez `.env.dev`:

```env
NEXT_PUBLIC_DEBUG_LOGS=true
FORCE_DB_RESET=true  # Reset DB au démarrage
```

## 🔧 Commandes Utiles

```bash
# Voir les logs d'un service spécifique
./start-dev.sh logs gateway
./start-dev.sh logs translator
./start-dev.sh logs frontend

# Redémarrer un service spécifique
docker-compose -f docker-compose.dev.yml restart gateway

# Accéder à un conteneur
docker exec -it meeshy-dev-gateway sh
docker exec -it meeshy-dev-translator bash

# Voir les volumes
docker volume ls | grep meeshy-dev

# Nettoyer tout
./start-dev.sh clean
```

## 🐛 Dépannage

### Les services ne démarrent pas

```bash
# 1. Vérifier Docker
docker info

# 2. Voir les logs
./start-dev.sh logs

# 3. Redémarrer proprement
./start-dev.sh stop
./start-dev.sh start
```

### Problème de plateforme (Mac M1/M2)

Note: Les images sont buildées pour `linux/amd64`. Sur Mac M1/M2 (ARM), il peut y avoir des avertissements mais les services fonctionnent via Rosetta.

Pour forcer la plateforme ARM locale, modifiez `docker-compose.dev.yml`:

```yaml
services:
  translator:
    platform: linux/arm64  # Ajouter cette ligne
```

### Port déjà utilisé

```bash
# Trouver le processus utilisant le port
lsof -i :3000

# Ou changer le port dans docker-compose.dev.yml
```

## 📈 Performance

### Ressources Recommandées

- **RAM**: 8 GB minimum
- **CPU**: 4 cores minimum
- **Disque**: 15 GB (10 GB pour les modèles ML)

### Allouer Plus de Ressources à Docker

Docker Desktop → Préférences → Resources:
- Memory: 8 GB
- CPUs: 4
- Disk: 20 GB

## 🎯 Prochaines Étapes

1. ✅ Environnement de développement local configuré
2. ✅ Scripts automatisés créés
3. ✅ Documentation complète
4. 🔄 Tester et développer vos fonctionnalités
5. 🚀 Déployer en production avec `docker-compose.traefik.yml`

## 📞 Support

Pour toute question:
1. Consultez [DEPLOYMENT_LOCAL_DOCKER.md](./DEPLOYMENT_LOCAL_DOCKER.md)
2. Vérifiez [DEPLOYMENT_COMPARISON.md](./DEPLOYMENT_COMPARISON.md)
3. Ouvrez une issue sur GitHub

---

**Tout est prêt pour le développement! 🎉**

Démarrez avec:
```bash
./start-dev.sh
```

Puis accédez à http://localhost:3100
