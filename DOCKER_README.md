# 🐳 Docker Architecture - Meeshy

## 📋 Vue d'ensemble

### 🔧 Développement Local
- **Outil**: Docker Compose
- **Fichier**: `docker-compose.dev.yml`
- **Usage**: Développement avec hot-reload
- **Commande**: `./docker-manage.sh dev:up -d`

### 🚀 Production
- **Outil**: Images Docker séparées  
- **Fichiers**: Dockerfiles individuels
- **Usage**: Déploiement sur infrastructure de production
- **Commande**: Déploiement manuel ou orchestrateur (K8s, Docker Swarm)

---

## 🏗️ Architecture des Services

```
┌─ DÉVELOPPEMENT (docker-compose.dev.yml) ─┐
│                                          │
│  Frontend Dev    Backend Dev    Translation Dev │
│  localhost:3001  localhost:3002  localhost:50052│
│       │               │               │        │
│       └─── PostgreSQL Dev ────┴─── Redis Dev ──┘
│           localhost:5433        localhost:6380
│
└─────────────────────────────────────────────────┘

┌─ PRODUCTION (Images séparées) ─┐
│                                │
│  Frontend       Backend       Translation
│  Image:3000     Image:3001    Image:50051
│       │            │             │
│       └─── PostgreSQL ────┴── Redis
│           Host:5432      Host:6379
│
└────────────────────────────────┘
```

---
---

## 📂 Structure des Dockerfiles

```
├── Dockerfile.frontend              # Frontend production
├── Dockerfile.frontend.dev          # Frontend développement
├── backend/
│   ├── fastify-service/
│   │   ├── Dockerfile               # Backend production
│   │   └── Dockerfile.dev           # Backend développement  
│   └── translation-service/
│       ├── Dockerfile               # Translation production
│       └── Dockerfile.dev           # Translation développement
├── docker-compose.yml               # ⚠️  Ancien - ne pas utiliser
├── docker-compose.dev.yml           # ✅ Développement uniquement
└── .env.production.example          # ✅ Variables production
```

---

## 🔧 Variables d'Environnement

### Développement (Automatique)
Les variables sont définies dans `docker-compose.dev.yml`:
- Ports de développement (3001, 3002, 50052)
- Base de données de développement
- Configuration de debug
- Hot-reload activé

### Production (Manuel)
Créer des fichiers `.env` séparés:
- `.env.backend` - Service backend
- `.env.translator` - Service de traduction  
- `.env.frontend` - Application frontend

Voir `.env.production.example` pour les détails.

---

## ⚡ Commandes Essentielles

### Développement
```bash
# Démarrer le développement
./docker-manage.sh dev:build
./docker-manage.sh dev:up -d

# Voir les logs
./docker-manage.sh dev:logs backend-dev -f

# Nettoyer
./docker-manage.sh dev:clean
```

### Production
```bash
# Build des images
./docker-manage.sh prod:build

# Voir les exemples de déploiement
./docker-manage.sh prod:example

# Déploiement manuel
docker run -d --name meeshy-backend 
  --env-file .env.backend 
  -p 3001:3001 
  meeshy/backend:latest
```

---

## 🚨 Points Importants

1. **Docker Compose = Développement UNIQUEMENT**
   - Ne jamais utiliser docker-compose en production
   - Utiliser les images séparées pour la production

2. **Ports différents en développement**
   - Frontend: 3001 (au lieu de 3000)
   - Backend: 3002 (au lieu de 3001)  
   - Translation: 50052 (au lieu de 50051)

3. **Hot-reload en développement**
   - Code monté en volumes
   - Rechargement automatique des changements

4. **Configuration de production**
   - Variables d'environnement dans des fichiers séparés
   - Sécurité renforcée
   - Optimisations de performance

---

## 🔍 Debugging

### Développement
```bash
# Status des containers
./docker-manage.sh dev:status

# Logs d'un service spécifique
docker-compose -f docker-compose.dev.yml logs backend-dev

# Shell dans un container
docker exec -it meeshy-backend-dev sh
```

### Production
```bash
# Status des containers de production
docker ps | grep meeshy

# Logs d'un service
docker logs meeshy-backend

# Health check
curl http://localhost:3001/health
```

---

## 📚 Documentation Complète

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Guide de déploiement détaillé
- **[.env.production.example](./.env.production.example)** - Variables de production
- **[README.md](./README.md)** - Documentation générale du projet

```

## 🏗️ Architecture Docker

### Services principaux
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  Translation    │
│   (Next.js)     │────│   (Fastify)     │────│   Service       │
│   Port: 3000    │    │   Port: 3001    │    │   Port: 50051   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────┐    ┌─────────────────┐
         │   PostgreSQL    │    │     Redis       │
         │   Port: 5432    │    │   Port: 6379    │
         └─────────────────┘    └─────────────────┘
```

### Réseaux Docker
- **meeshy-network** (production): `172.20.0.0/16`
- **meeshy-dev-network** (développement): `172.21.0.0/16`

## 🚀 Démarrage rapide

### Production
```bash
# 1. Cloner le projet
git clone <repository-url>
cd meeshy

# 2. Configurer l'environnement
cp .env.docker .env

# 3. Construire et démarrer tous les services
./docker-manage.sh prod:build
./docker-manage.sh prod:up -d

# 4. Vérifier le statut
./docker-manage.sh status
```

### Développement
```bash
# 1. Démarrer l'environnement de développement
./docker-manage.sh dev:build
./docker-manage.sh dev:up -d

# 2. Vérifier les logs
./docker-manage.sh dev:logs -f
```

## 🌍 Environnements

### Production (`docker-compose.yml`)
- **Optimisé pour les performances**
- **Images multi-stage minimales**
- **Monitoring intégré**
- **SSL/TLS ready**

**Ports exposés:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Translation gRPC: localhost:50051
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3003

### Développement (`docker-compose.dev.yml`)
- **Hot reload activé**
- **Volumes montés pour le code source**
- **Logs de débogage**
- **Ports séparés pour éviter les conflits**

**Ports exposés:**
- Frontend: http://localhost:3001
- Backend API: http://localhost:3002
- Translation gRPC: localhost:50052
- PostgreSQL: localhost:5433
- Redis: localhost:6380

## 🎯 Services détaillés

### Frontend (Next.js)
```dockerfile
# Production: Multi-stage optimisé
# Développement: Hot reload avec pnpm
```
- **Image**: `node:18-alpine`
- **Build**: Mode standalone
- **Features**: SSR, optimisation d'images, PWA ready

### Backend (Fastify)
```dockerfile
# Production: TypeScript compilé
# Développement: nodemon avec source maps
```
- **Image**: `node:18-alpine`
- **Features**: API REST, WebSocket, gRPC client, JWT auth
- **Base de données**: Prisma ORM

### Translation Service (Python)
```dockerfile
# Production: Python optimisé
# Développement: Hot reload avec modules montés
```
- **Image**: `python:3.11-slim`
- **Features**: gRPC server, modèles ML (T5, NLLB), cache Redis
- **Modèles supportés**:
  - `t5-small` (basic)
  - `nllb-200-distilled-600M` (medium)
  - `nllb-200-distilled-1.3B` (premium)

### Base de données (PostgreSQL)
- **Image**: `postgres:15-alpine`
- **Features**: Migrations automatiques, backup/restore
- **Volumes**: Persistance des données

### Cache (Redis)
- **Image**: `redis:7-alpine`
- **Features**: Cache de traduction, sessions, pub/sub
- **Configuration**: Optimisé pour le cache LRU

## 📝 Commandes utiles

### Script de gestion principal
```bash
# Aide
./docker-manage.sh help

# Production
./docker-manage.sh prod:build      # Construire les images
./docker-manage.sh prod:up -d      # Démarrer en arrière-plan
./docker-manage.sh prod:down       # Arrêter
./docker-manage.sh prod:logs -f    # Voir les logs en temps réel
./docker-manage.sh prod:restart    # Redémarrer
./docker-manage.sh prod:clean      # Nettoyer

# Développement
./docker-manage.sh dev:build       # Construire les images dev
./docker-manage.sh dev:up -d       # Démarrer en arrière-plan
./docker-manage.sh dev:down        # Arrêter
./docker-manage.sh dev:logs -f     # Voir les logs en temps réel

# Base de données
./docker-manage.sh db:migrate      # Exécuter les migrations
./docker-manage.sh db:seed         # Peupler avec des données de test
./docker-manage.sh db:reset        # Réinitialiser la base de données

# Utilitaires
./docker-manage.sh status          # Statut des conteneurs
./docker-manage.sh health          # Vérification de santé
./docker-manage.sh clean:all       # Nettoyer complètement
```

### Commandes Docker directes
```bash
# Logs d'un service spécifique
docker-compose logs -f frontend

# Exécuter une commande dans un conteneur
docker-compose exec backend bash
docker-compose exec postgres psql -U meeshy_user -d meeshy

# Voir les ressources utilisées
docker stats

# Inspecter un conteneur
docker inspect meeshy-frontend

# Voir les volumes
docker volume ls
```

## 🔧 Configuration avancée

### Variables d'environnement importantes

#### Production (`.env.docker`)
```bash
# Changez ces valeurs en production !
JWT_SECRET=your-super-secure-jwt-secret
POSTGRES_PASSWORD=your-secure-password

# Performance
NODE_OPTIONS=--max-old-space-size=2048
PYTHON_MAX_WORKERS=8
```

#### Développement (`.env.dev`)
```bash
NODE_ENV=development
LOG_LEVEL=debug
FAST_REFRESH=true
```

### Personnalisation des modèles de traduction

Pour utiliser des modèles différents, modifiez les variables d'environnement :
```bash
BASIC_MODEL=t5-small
MEDIUM_MODEL=nllb-200-distilled-600M
PREMIUM_MODEL=nllb-200-distilled-1.3B
```

Les modèles sont téléchargés automatiquement au premier démarrage et sauvegardés dans `./public/models/`.

## 🐛 Troubleshooting

### Problèmes courants

#### 1. Erreur de port déjà utilisé
```bash
# Vérifier les ports utilisés
netstat -tulpn | grep :3000

# Arrêter tous les conteneurs
./docker-manage.sh prod:down
./docker-manage.sh dev:down
```

#### 2. Problème de mémoire
```bash
# Vérifier l'utilisation des ressources
docker stats

# Augmenter la mémoire Docker (Docker Desktop)
# Settings > Resources > Memory > 8GB+
```

#### 3. Échec de téléchargement des modèles
```bash
# Vérifier l'espace disque
df -h

# Télécharger manuellement un modèle
docker-compose exec translation-service python3 -c "
from transformers import pipeline;
pipe = pipeline('translation', model='facebook/nllb-200-distilled-600M')
"
```

#### 4. Base de données non accessible
```bash
# Vérifier le statut de PostgreSQL
docker-compose exec postgres pg_isready -U meeshy_user

# Se connecter à la base de données
docker-compose exec postgres psql -U meeshy_user -d meeshy

# Réinitialiser la base de données
./docker-manage.sh db:reset
```

#### 5. Service de traduction lent
```bash
# Vérifier les logs
docker-compose logs translation-service

# Redémarrer seulement le service de traduction
docker-compose restart translation-service

# Vider le cache Redis
docker-compose exec redis redis-cli FLUSHALL
```

### Commandes de diagnostic
```bash
# Vérifier la santé de tous les services
./docker-manage.sh health

# Voir les logs d'erreur
docker-compose logs --tail=100 | grep ERROR

# Inspecter les réseaux Docker
docker network ls
docker network inspect meeshy_meeshy-network

# Vérifier les volumes
docker volume ls
docker volume inspect meeshy_translation_models
```

## ⚡ Performance et optimisation

### Optimisations de production

#### 1. Ressources système
```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'
```

#### 2. Cache Redis optimisé
```bash
# Configuration Redis pour la performance
CONFIG SET maxmemory 1GB
CONFIG SET maxmemory-policy allkeys-lru
CONFIG SET save "900 1 300 10 60 10000"
```

#### 3. PostgreSQL tuning
```sql
-- Optimisations PostgreSQL
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
```

### Monitoring

#### Prometheus metrics
- Accès: http://localhost:9090
- Métriques automatiques pour tous les services
- Alertes configurables

#### Grafana dashboards
- Accès: http://localhost:3003 (admin/admin)
- Dashboards pré-configurés pour chaque service
- Visualisation en temps réel

### Backup et restauration

#### Base de données
```bash
# Backup
docker-compose exec postgres pg_dump -U meeshy_user meeshy > backup.sql

# Restauration
docker-compose exec -T postgres psql -U meeshy_user meeshy < backup.sql
```

#### Volumes Docker
```bash
# Backup des volumes
docker run --rm -v meeshy_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .

# Restauration
docker run --rm -v meeshy_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_backup.tar.gz -C /data
```

## 🚀 Déploiement en production

### Checklist de production

#### Sécurité
- [ ] Changer tous les mots de passe par défaut
- [ ] Configurer HTTPS avec certificats SSL
- [ ] Restreindre l'accès aux ports de base de données
- [ ] Activer les logs d'audit
- [ ] Configurer le pare-feu

#### Performance
- [ ] Configurer un reverse proxy (Nginx)
- [ ] Activer la compression gzip
- [ ] Configurer les limites de ressources
- [ ] Optimiser les images Docker
- [ ] Mettre en place un CDN

#### Monitoring
- [ ] Configurer les alertes Prometheus
- [ ] Mettre en place la collecte de logs
- [ ] Configurer les health checks
- [ ] Activer les métriques applicatives

#### Backup
- [ ] Automatiser les sauvegardes de base de données
- [ ] Tester la procédure de restauration
- [ ] Sauvegarder les volumes persistants
- [ ] Documenter la procédure de disaster recovery

## 📞 Support

Pour obtenir de l'aide :

1. **Logs détaillés** : `./docker-manage.sh [env]:logs -f`
2. **Status des services** : `./docker-manage.sh health`
3. **Documentation API** : http://localhost:3001/docs (une fois démarré)
4. **Monitoring** : http://localhost:3003 (Grafana)

---

💡 **Conseil** : Commencez toujours par l'environnement de développement pour vous familiariser avec l'architecture avant de passer en production.
