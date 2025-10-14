# 🚀 Meeshy - High-Performance Real-Time Messaging with Multi-Language Translation

> **Meeshy** est un système de messagerie temps réel haute performance (100k msg/sec) avec traduction automatique multi-langues via ML.

[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11-green)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-green)](https://www.fastify.io/)
[![FastAPI](https://img.shields.io/badge/FastAPI-latest-teal)](https://fastapi.tiangolo.com/)

## 📋 Table des Matières

- [Architecture](#-architecture)
- [Démarrage Rapide](#-démarrage-rapide)
- [Documentation](#-documentation)
- [Développement](#-développement)
- [Production](#-production)
- [Fonctionnalités](#-fonctionnalités)

## 🏗️ Architecture

```
Frontend (Next.js) 
    ↓ WebSocket/HTTP
Gateway (Fastify + WebSocket)
    ↓ gRPC/ZMQ + Protobuf
Translator (FastAPI + Transformers)
    ↓ Shared Database
MongoDB + Redis
```

### Services Principaux

- **Frontend**: Interface utilisateur Next.js avec WebSocket temps réel
- **Gateway**: API Gateway Fastify avec WebSocket pour messaging
- **Translator**: Service FastAPI de traduction ML (MT5 + NLLB)
- **Database**: MongoDB avec Replica Set via Prisma ORM
- **Redis**: Cache et gestion des sessions

## 🚀 Démarrage Rapide

### Option 1: Développement Local avec Docker (Recommandé)

Déployez l'ensemble des services en local avec les dernières images Docker :

```bash
# 1. Télécharger les dernières images
./start-dev.sh pull

# 2. Démarrer tous les services
./start-dev.sh

# 3. Vérifier la santé des services
./health-check.sh
```

**Accès:**
- 🎨 Frontend: http://localhost:3100
- 🚪 Gateway API: http://localhost:3000
- 🤖 Translator API: http://localhost:8000
- 🗄️ MongoDB UI: http://localhost:3001
- 💾 Redis UI: http://localhost:7843

**Utilisateurs de test:**
- Admin: `admin@meeshy.local` / `admin123`
- Meeshy: `meeshy@meeshy.local` / `meeshy123`
- Atabeth: `atabeth@meeshy.local` / `atabeth123`

### Option 2: Développement Natif

Pour développer avec hot reload :

```bash
# Terminal 1 - Infrastructure (MongoDB + Redis)
docker-compose -f docker-compose.dev.yml up database redis

# Terminal 2 - Gateway
cd gateway && ./gateway.sh

# Terminal 3 - Translator
cd translator && ./translator.sh

# Terminal 4 - Frontend
cd frontend && ./frontend.sh
```

### Option 3: Production avec Traefik

```bash
# Configurer le domaine
export DOMAIN=meeshy.com
export CERTBOT_EMAIL=admin@meeshy.com

# Démarrer avec SSL automatique
docker-compose -f docker-compose.traefik.yml up -d
```

## 📚 Documentation

### Guides de Déploiement

- **[🏃 Quick Start](./QUICKSTART_DEV.md)** - Démarrage rapide en 3 étapes
- **[🐳 Docker Local](./DEPLOYMENT_LOCAL_DOCKER.md)** - Guide complet du déploiement local avec Docker
- **[🔄 Comparaison](./DEPLOYMENT_COMPARISON.md)** - Comparaison des modes de déploiement
- **[⚙️ Copilot Instructions](./.github/copilot-instructions.md)** - Guide technique du projet

### Documentation par Service

- **Frontend**: [frontend/README.md](./frontend/README.md)
- **Gateway**: [gateway/README.md](./gateway/README.md)
- **Translator**: [translator/README.md](./translator/README.md)
- **Shared**: [shared/README.md](./shared/README.md)

## 🛠️ Développement

### Commandes Utiles

```bash
# Avec le script de démarrage
./start-dev.sh              # Démarrer tous les services
./start-dev.sh logs         # Voir les logs
./start-dev.sh logs gateway # Logs d'un service spécifique
./start-dev.sh status       # Statut des services
./start-dev.sh stop         # Arrêter
./start-dev.sh clean        # Nettoyer tout

# Avec Make (alternative)
make start                  # Démarrer
make logs SERVICE=gateway   # Logs d'un service
make health                 # Vérifier la santé
make stop                   # Arrêter
```

### Mise à Jour des Images

```bash
# Télécharger et redémarrer avec les dernières images
./update-dev.sh

# Ou manuellement
./start-dev.sh pull
./start-dev.sh restart
```

### Vérification de Santé

```bash
# Vérifier tous les services
./health-check.sh

# Ou avec Make
make health
```

## 🚀 Production

### Prérequis

- Serveur Linux (Ubuntu 22.04+ recommandé)
- Docker et Docker Compose installés
- Nom de domaine configuré (pour Traefik)
- Ports 80 et 443 ouverts (pour Traefik)

### Déploiement avec Traefik (SSL Automatique)

```bash
# 1. Cloner le repo
git clone <votre-repo>
cd meeshy

# 2. Configurer les variables d'environnement
cp env.example .env
nano .env  # Éditer avec vos valeurs

# 3. Démarrer
docker-compose -f docker-compose.traefik.yml up -d

# 4. Vérifier
docker-compose -f docker-compose.traefik.yml ps
```

**Accès en production:**
- Frontend: https://meeshy.com
- Gateway: https://gate.meeshy.com
- Translator: https://ml.meeshy.com
- MongoDB UI: https://mongo.meeshy.com (avec auth)
- Redis UI: https://redis.meeshy.com (avec auth)
- Traefik Dashboard: https://traefik.meeshy.com (avec auth)

### Variables d'Environnement Importantes

```env
# Domaine
DOMAIN=meeshy.com
CERTBOT_EMAIL=admin@meeshy.com

# Database
DATABASE_TYPE=MONGODB
DATABASE_URL=mongodb://database:27017/meeshy

# Security
JWT_SECRET=your-production-secret-key-change-this
ADMIN_PASSWORD=secure-admin-password
MEESHY_PASSWORD=secure-meeshy-password

# Authentication pour UI admin (htpasswd format)
TRAEFIK_USERS=admin:$apr1$...
MONGO_USERS=admin:$apr1$...
REDIS_USERS=admin:$apr1$...
```

### Générer les Hash de Mots de Passe

```bash
# Installer htpasswd
brew install httpd  # macOS
sudo apt install apache2-utils  # Linux

# Générer un hash
htpasswd -nb admin your-password
```

## ✨ Fonctionnalités

### Messagerie Temps Réel
- ✅ WebSocket bidirectionnel
- ✅ 100k messages/seconde
- ✅ Conversations 1-to-1 et groupes
- ✅ Indicateurs de frappe
- ✅ Présence utilisateur
- ✅ Réponses et citations

### Traduction Multi-Langues
- ✅ Traduction automatique backend (MT5 + NLLB)
- ✅ Support de 50+ langues
- ✅ Cache intelligent des traductions
- ✅ Configuration linguistique par utilisateur
- ✅ Modèles : basic, medium (600M), premium (1.3B)

### Architecture Distribuée
- ✅ Microservices avec Docker
- ✅ Communication gRPC/ZMQ + Protobuf
- ✅ Base de données partagée (Prisma ORM)
- ✅ Cache Redis multi-niveaux
- ✅ Réplication MongoDB

### Sécurité
- ✅ JWT Authentication
- ✅ CORS configuré
- ✅ SSL/TLS automatique (Traefik)
- ✅ Basic Auth sur UI admin
- ✅ Network isolation

## 🔧 Stack Technique

### Frontend
- Next.js 15 + TypeScript
- Tailwind CSS + shadcn/ui
- WebSocket client avec reconnexion
- SWR pour data fetching

### Gateway
- Fastify (Node.js haute performance)
- WebSocket pour temps réel
- Prisma ORM (MongoDB)
- gRPC + ZMQ client

### Translator
- FastAPI (Python async)
- Transformers (MT5 + NLLB)
- Prisma ORM (MongoDB)
- gRPC + ZMQ server

### Infrastructure
- MongoDB 8.0 avec Replica Set
- Redis 8 Alpine
- Traefik 3.3 (reverse proxy + SSL)
- Docker + Docker Compose

## 📊 Monitoring

### Logs en Temps Réel

```bash
# Tous les services
./start-dev.sh logs

# Service spécifique
./start-dev.sh logs gateway
./start-dev.sh logs translator
./start-dev.sh logs frontend
```

### Interfaces d'Administration

- **NoSQLClient** (MongoDB): http://localhost:3001
- **P3X Redis UI** (Redis): http://localhost:7843
- **Traefik Dashboard** (Prod): https://traefik.meeshy.com

### Health Checks

```bash
# Vérification automatique
./health-check.sh

# Endpoints de santé
curl http://localhost:3000/health  # Gateway
curl http://localhost:8000/health  # Translator
```

## 🐛 Dépannage

### Les services ne démarrent pas

```bash
# Vérifier Docker
docker info

# Voir les logs
./start-dev.sh logs

# Redémarrer proprement
./start-dev.sh stop
./start-dev.sh start
```

### Base de données corrompue

```bash
# Reset complet
./start-dev.sh clean
./start-dev.sh start

# Ou reset DB uniquement
./start-dev.sh reset
```

### Images obsolètes

```bash
# Mettre à jour
./update-dev.sh

# Ou manuellement
./start-dev.sh pull
./start-dev.sh restart
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📝 License

Ce projet est sous licence [MIT](./LICENSE).

## 🆘 Support

Pour toute question ou problème :

1. Consultez la [documentation complète](./DEPLOYMENT_LOCAL_DOCKER.md)
2. Vérifiez les [issues GitHub](https://github.com/yourusername/meeshy/issues)
3. Contactez l'équipe de développement

---

**Développé avec ❤️ par l'équipe Meeshy**

🚀 **Bon développement!**
