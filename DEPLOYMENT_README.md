# 🚀 Meeshy - Déploiement Docker Complet

## Vue d'ensemble

Meeshy est une application de messagerie temps réel avec traduction automatique, construite avec une architecture microservices containerisée.

### Architecture des Services

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (Port 80)                     │
│                    Reverse Proxy                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼───┐   ┌─────▼────┐   ┌────▼──────┐
   │Frontend│   │ Gateway  │   │Translator │
   │Next.js │   │ Fastify  │   │FastAPI+ML │
   │:3100   │   │   :3000  │   │   :8000   │
   └────────┘   └─────┬────┘   └───────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼───┐   ┌─────▼────┐
   │Postgres│   │  Redis   │
   │  :5432 │   │  :6379   │
   └────────┘   └──────────┘
```

## 🔧 Services

| Service | Port | Description |
|---------|------|-------------|
| **Frontend** | 3100 | Interface utilisateur Next.js |
| **Gateway** | 3000 | API REST/WebSocket avec Fastify |
| **Translator** | 8000 | Service de traduction avec ML |
| **PostgreSQL** | 5432 | Base de données principale |
| **Redis** | 6379 | Cache et sessions |
| **Nginx** | 80/443 | Reverse proxy et load balancer |

## 🚀 Déploiement Rapide

### 1. Prérequis

```bash
# Docker et Docker Compose
docker --version
docker compose --version

# Git (pour cloner le projet)
git --version
```

### 2. Déploiement Complet

```bash
# Cloner le projet
git clone <repository-url>
cd meeshy

# Déployer tous les services
./deploy-complete.sh

# Ou manuellement :
docker compose build --no-cache
docker compose up -d
```

### 3. Vérification du Déploiement

```bash
# Tests complets
./test-complete.sh

# Tests rapides
./test-complete.sh quick

# Statut des services
docker compose ps
```

## 📋 Scripts Disponibles

### `deploy-complete.sh`
Script principal de déploiement avec options :

```bash
./deploy-complete.sh          # Déploiement complet
./deploy-complete.sh stop     # Arrêter tous les services
./deploy-complete.sh logs     # Voir les logs
./deploy-complete.sh status   # Statut des services
./deploy-complete.sh clean    # Nettoyage complet
```

### `test-complete.sh`
Suite de tests complète :

```bash
./test-complete.sh test       # Tests complets
./test-complete.sh quick      # Tests de base
./test-complete.sh api        # Tests API seulement
./test-complete.sh performance # Tests de performance
```

## 🔧 Configuration

### Variables d'Environnement

Créer un fichier `.env` avec :

```env
# Base de données
POSTGRES_DB=meeshy
POSTGRES_USER=meeshy
POSTGRES_PASSWORD=MeeshyP@ssword
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379

# Services
GATEWAY_PORT=3000
FRONTEND_PORT=3100
TRANSLATOR_HTTP_PORT=8000
TRANSLATOR_GRPC_PORT=50051

# Nginx
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

# Sécurité
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

### Personnalisation des Services

#### Gateway (API)
- Configuration: `gateway/src/server.ts`
- Routes: `gateway/src/routes/`
- WebSocket: `gateway/src/websocket/`

#### Frontend (UI)
- Configuration: `frontend/next.config.ts`
- Pages: `frontend/app/`
- Composants: `frontend/components/`

#### Translator (ML)
- Configuration: `translator/src/config.py`
- API: `translator/src/main_clean.py`
- Modèles: `translator/models/`

## 🐛 Debugging

### Logs des Services

```bash
# Tous les services
docker compose logs -f

# Service spécifique
docker compose logs -f [service_name]

# Dernières 100 lignes
docker compose logs --tail=100 [service_name]
```

### Connexion aux Conteneurs

```bash
# Shell dans un conteneur
docker compose exec [service_name] sh

# Exemples
docker compose exec postgres psql -U meeshy -d meeshy
docker compose exec redis redis-cli
docker compose exec gateway node -e "console.log('Hello from gateway')"
```

### Problèmes Courants

#### 1. Service ne démarre pas
```bash
# Vérifier les logs
docker compose logs [service_name]

# Vérifier la santé
docker compose ps

# Redémarrer un service
docker compose restart [service_name]
```

#### 2. Base de données inaccessible
```bash
# Vérifier PostgreSQL
docker compose exec postgres pg_isready -U meeshy

# Vérifier les connexions
docker compose exec gateway npx prisma db push
```

#### 3. Port déjà utilisé
```bash
# Changer les ports dans .env
GATEWAY_PORT=3001
FRONTEND_PORT=3101

# Ou arrêter les processus conflictuels
sudo lsof -i :3000
kill -9 [PID]
```

## 🔄 Mise à Jour

### Déploiement d'une nouvelle version

```bash
# Arrêter les services
docker compose down

# Nettoyer les images
docker system prune -f

# Reconstruire
docker compose build --no-cache

# Redémarrer
docker compose up -d
```

### Mise à jour de la base de données

```bash
# Migrations Prisma
docker compose exec gateway npx prisma migrate dev

# Reset (développement seulement)
docker compose exec gateway npx prisma migrate reset --force
```

## 📊 Monitoring

### Métriques des Services

```bash
# Utilisation des ressources
docker stats

# Espace disque
docker system df

# Santé des services
docker compose ps --services --filter "status=running"
```

### URLs de Monitoring

- Frontend: http://localhost:3100
- Gateway API: http://localhost:3000/health
- Translator: http://localhost:8000/health
- Nginx: http://localhost:80

## 🔒 Sécurité

### Production
- Changer tous les mots de passe par défaut
- Utiliser HTTPS avec certificats SSL
- Configurer un firewall
- Limiter l'accès aux ports de base de données

### Backup

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U meeshy meeshy > backup.sql

# Restore
docker compose exec -T postgres psql -U meeshy -d meeshy < backup.sql
```

## 🆘 Support

### Commandes d'Urgence

```bash
# Arrêt d'urgence
docker compose kill

# Nettoyage complet
docker compose down -v
docker system prune -af --volumes

# Reconstruction complète
./deploy-complete.sh clean
./deploy-complete.sh
```

### Diagnostic Complet

```bash
# Informations système
docker info
docker compose version

# Statut complet
./test-complete.sh test > diagnostic.log 2>&1
```

---

## 📞 Contact & Support

Pour toute question ou problème, consultez :
- Les logs des services
- La documentation des tests
- Les scripts de diagnostic

**Version:** 1.0.0  
**Dernière mise à jour:** Décembre 2024
