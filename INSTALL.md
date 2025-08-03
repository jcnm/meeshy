# Guide d'Installation Meeshy 🛠️

Ce guide vous accompagne dans l'installation complète de Meeshy, de la récupération du code source au déploiement.

## 📋 Prérequis Système

### 🖥️ Configuration Minimale Recommandée
- **CPU**: 4 cœurs (8 cœurs recommandés pour production)
- **RAM**: 8 GB (16 GB recommandés pour production)
- **Stockage**: 20 GB d'espace libre
- **OS**: Linux (Ubuntu 20.04+), macOS (10.15+), Windows 10/11

### 🔧 Logiciels Requis

#### Option 1: Installation Complète (Développement Local)
```bash
# Node.js 18+ et pnpm
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 18
fnm use 18
npm install -g pnpm

# Python 3.9+ et pip
# Ubuntu/Debian
sudo apt update && sudo apt install python3 python3-pip

# macOS
brew install python3

# PostgreSQL 15+
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql

# Redis 7+
# Ubuntu/Debian
sudo apt install redis-server

# macOS
brew install redis
```

#### Option 2: Docker Uniquement (Recommandé)
```bash
# Docker Desktop
# Télécharger depuis: https://www.docker.com/products/docker-desktop

# Ou installation en ligne de commande:
# Ubuntu
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# macOS
brew install --cask docker

# Vérification
docker --version
docker-compose --version
```

## 📥 Récupération du Code Source

### Depuis GitHub
```bash
# Cloner le repository principal
git clone https://github.com/sylorion/meeshy.git
cd meeshy

# Vérifier la structure
ls -la
```

### Structure du Projet Attendue
```
meeshy/
├── frontend/          # Application Next.js
├── gateway/           # Service Fastify (si présent)
├── translator/        # Service FastAPI
├── shared/            # Schema Prisma et types partagés
├── docker/            # Configuration Nginx
├── docker-compose.yml # Configuration Docker
├── dev-local.sh       # Script développement local
├── dev-docker.sh      # Script Docker
└── README.md          # Documentation principale
```

## 🚀 Installation et Démarrage

### Option A: Docker (Le Plus Simple)

#### 1. Prérequis Docker Uniquement
```bash
# Vérifier que Docker fonctionne
docker info
docker-compose --version
```

#### 2. Configuration Rapide
```bash
cd meeshy

# Le script configure automatiquement tout
./dev-docker.sh start
```

#### 3. Première Utilisation avec Construction Complète
```bash
# Pour une installation propre (recommandé au premier lancement)
./dev-docker.sh start --clean
```

#### 4. Vérification du Déploiement
```bash
# Vérifier l'état des services
./dev-docker.sh status

# Vérifier la santé des services
./dev-docker.sh health

# Voir les logs en temps réel
./dev-docker.sh logs
```

### Option B: Développement Local

#### 1. Installation des Dépendances Système
```bash
# Vérifier la disponibilité des services
pg_isready -h localhost -p 5432  # PostgreSQL
redis-cli ping                   # Redis
```

#### 2. Démarrage des Services de Base
```bash
# PostgreSQL (si pas déjà démarré)
sudo systemctl start postgresql  # Linux
brew services start postgresql   # macOS

# Redis (si pas déjà démarré)
sudo systemctl start redis       # Linux
brew services start redis        # macOS

# Ou via Docker pour les services uniquement
docker run -d -p 5432:5432 \
  -e POSTGRES_DB=meeshy \
  -e POSTGRES_USER=meeshy \
  -e POSTGRES_PASSWORD=MeeshyP@ssword \
  postgres:15-alpine

docker run -d -p 6379:6379 redis:7-alpine
```

#### 3. Installation et Démarrage Automatique
```bash
cd meeshy

# Le script installe tout et démarre les services
./dev-local.sh
```

## 🔧 Configuration Avancée

### Variables d'Environnement
Le fichier `.env` est créé automatiquement par les scripts. Pour une configuration personnalisée:

```bash
# Copier le template
cp .env.example .env

# Éditer selon vos besoins
nano .env
```

#### Configuration Base de Données
```env
# PostgreSQL
POSTGRES_DB=meeshy
POSTGRES_USER=meeshy
POSTGRES_PASSWORD=MeeshyP@ssword
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# URL complète
DATABASE_URL=postgresql://meeshy:MeeshyP@ssword@localhost:5432/meeshy
```

#### Configuration Services
```env
# Ports des services
TRANSLATOR_HTTP_PORT=8000
TRANSLATOR_GRPC_PORT=50051
GATEWAY_PORT=3000
FRONTEND_PORT=3100

# URLs publiques
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

#### Configuration Traduction
```env
# Langues supportées
SUPPORTED_LANGUAGES=fr,en,es,de,pt,zh,ja,ar
DEFAULT_LANGUAGE=fr

# Modèles ML
ML_BATCH_SIZE=32
DEVICE=cpu  # ou 'cuda' si GPU disponible
```

### Configuration Réseau (Production)
```env
# Nginx
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

# Domaine
DOMAIN=votre-domaine.com

# Sécurité
JWT_SECRET=votre-cle-secrete-super-complexe
```

## 🔍 Vérification de l'Installation

### Tests de Fonctionnement
```bash
# Test des services via curl
curl http://localhost:8000/health  # Translator
curl http://localhost:3000/health  # Gateway (si disponible)
curl http://localhost:3100         # Frontend

# Test de la base de données
docker-compose exec postgres pg_isready -U meeshy -d meeshy

# Test du cache Redis
docker-compose exec redis redis-cli ping
```

### Accès aux Services
Une fois l'installation terminée, vous pouvez accéder à:

| Service | URL | Description |
|---------|-----|-------------|
| **Application principale** | http://localhost | Via Nginx (Docker uniquement) |
| **Frontend** | http://localhost:3100 | Interface utilisateur Next.js |
| **API Gateway** | http://localhost:3000 | API REST et WebSocket |
| **Translator API** | http://localhost:8000 | Service de traduction |
| **Translator gRPC** | localhost:50051 | Service gRPC de traduction |
| **Base de données** | localhost:5432 | PostgreSQL |
| **Cache Redis** | localhost:6379 | Cache en mémoire |

## 🛠️ Dépannage

### Problèmes Courants

#### Docker Build Failed
```bash
# Nettoyer le cache Docker
docker system prune -a

# Reconstruire sans cache
./dev-docker.sh start --clean
```

#### Ports Déjà Utilisés
```bash
# Vérifier les ports en cours d'utilisation
lsof -i :3000  # Gateway
lsof -i :3100  # Frontend
lsof -i :8000  # Translator HTTP
lsof -i :50051 # Translator gRPC
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# Tuer les processus si nécessaire
sudo kill -9 <PID>
```

#### Base de Données Non Accessible
```bash
# Vérifier PostgreSQL
docker-compose exec postgres pg_isready -U meeshy

# Recréer les tables
docker-compose exec translator python -c "
from prisma import Prisma
db = Prisma()
db.connect()
print('Database connected successfully')
"
```

#### Services Python (Translator)
```bash
# Vérifier les dépendances Python
cd translator
pip install -r requirements.txt

# Test du service translator
python -c "
import uvicorn
from main import app
print('Translator service loads successfully')
"
```

### Logs de Débogage
```bash
# Docker: logs détaillés
docker-compose logs -f <service_name>

# Local: logs des processus
tail -f /var/log/meeshy/*.log
```

## 📊 Performance et Optimisation

### Configuration Production
```bash
# Variables pour production
export NODE_ENV=production
export PYTHON_ENV=production

# Optimisation base de données
# Augmenter les pools de connexions
export DATABASE_POOL_SIZE=20
export REDIS_POOL_SIZE=10
```

### Monitoring
```bash
# Surveillance des ressources
docker stats  # Docker
htop          # Système local
```

## 🔄 Mise à Jour

### Mise à Jour du Code
```bash
cd meeshy

# Récupérer les dernières modifications
git pull origin main

# Docker: reconstruction
./dev-docker.sh start --clean

# Local: réinstallation
./dev-local.sh
```

### Migration Base de Données
```bash
# Les migrations se font automatiquement au démarrage
# Ou manuellement:
cd shared
pnpm prisma migrate deploy
```

## 🆘 Support

### Ressources d'Aide
- **Documentation**: [README.md](README.md)
- **Issues GitHub**: https://github.com/sylorion/meeshy/issues
- **Discord**: [Lien Discord] (si disponible)

### Collecte d'Informations pour Support
```bash
# Informations système
./dev-docker.sh status
docker-compose ps
docker system info

# Logs récents
./dev-docker.sh logs | tail -100
```

---

🎉 **Félicitations!** Meeshy devrait maintenant être opérationnel sur votre système.

Pour débuter avec l'application, rendez-vous sur http://localhost:3100 et créez votre premier compte utilisateur.
