# 🚀 Guide de Déploiement Meeshy

## 📋 Résumé des Modes de Déploiement

### 🔧 Développement Local
- **Outil**: Docker Compose (`docker-compose.dev.yml`)
- **Usage**: Développement, tests, debug
- **Configuration**: Variables automatiques dans le docker-compose
- **Ports**: Ports de développement (3001, 3002, 50052, etc.)

### 🚀 Production
- **Outil**: Images Docker séparées
- **Usage**: Déploiement en production, staging
- **Configuration**: Fichiers .env séparés par service
- **Infrastructure**: Kubernetes, Docker Swarm, VM, Cloud services

---

## 🔧 Développement Local avec Docker Compose

### Prérequis
- Docker Desktop
- Docker Compose v2.0+
- 8GB RAM minimum
- 10GB espace disque libre

### Démarrage Rapide
```bash
# Cloner le projet
git clone <repo-url>
cd meeshy

# Construire et démarrer tous les services
./docker-manage.sh dev:build
./docker-manage.sh dev:up -d

# Vérifier le statut
./docker-manage.sh dev:logs
```

### Services de Développement
| Service | Container Name | Port Local | Port Interne | URL d'accès |
|---------|----------------|------------|--------------|-------------|
| Frontend | meeshy-frontend-dev | 3001:3000 | 3000 | http://localhost:3001 |
| Backend | meeshy-backend-dev | 3002:3001 | 3001 | http://localhost:3002 |
| Translation | meeshy-translation-dev | 50052:50051 | 50051 | grpc://localhost:50052 |
| PostgreSQL | meeshy-postgres-dev | 5433:5432 | 5432 | localhost:5433 |
| Redis | meeshy-redis-dev | 6380:6379 | 6379 | localhost:6380 |

### Hot Reload
- **Frontend**: Code dans `./src` → Hot reload automatique
- **Backend**: Code dans `./backend/fastify-service/src` → Hot reload automatique
- **Translation**: Code dans `./backend/translation-service/src` → Hot reload automatique

### Commandes Utiles (Développement)
```bash
# Voir les logs d'un service spécifique
./docker-manage.sh dev:logs backend-dev -f

# Redémarrer un service
./docker-manage.sh dev:restart

# Nettoyer l'environnement de développement
./docker-manage.sh dev:clean

# Accéder au shell d'un container
docker exec -it meeshy-backend-dev sh
docker exec -it meeshy-translation-dev bash
```

---

## 🚀 Déploiement Production

### Architecture de Production
```
Load Balancer (Nginx/Traefik)
    ↓
Frontend Containers (meeshy/frontend:v1.0.0)
    ↓ HTTP/WS
Backend Containers (meeshy/backend:v1.0.0)
    ↓ gRPC
Translation Containers (meeshy/translator:v1.0.0)
    ↓
Database (PostgreSQL) + Cache (Redis)
```

### Étape 1: Préparation des Images

```bash
# Build des images de production
docker build -f Dockerfile.frontend -t meeshy/frontend:v1.0.0 .
docker build -f backend/fastify-service/Dockerfile -t meeshy/backend:v1.0.0 ./backend
docker build -f backend/translation-service/Dockerfile -t meeshy/translator:v1.0.0 ./backend

# Push vers registry (optionnel)
docker push meeshy/frontend:v1.0.0
docker push meeshy/backend:v1.0.0  
docker push meeshy/translator:v1.0.0
```

### Étape 2: Configuration des Variables d'Environnement

Créez les fichiers suivants à partir des exemples dans `.env.production.example`:

**`.env.backend`** (Service Backend):
```env
NODE_ENV=production
FASTIFY_PORT=3001
DATABASE_URL=postgresql://user:password@db-host:5432/meeshy
JWT_SECRET=your-secure-jwt-secret
GRPC_TRANSLATION_HOST=translation-service-host
REDIS_URL=redis://redis-host:6379
```

**`.env.translator`** (Service de Traduction):
```env
PYTHONPATH=/app
GRPC_PORT=50051
DATABASE_URL=postgresql://user:password@db-host:5432/meeshy
REDIS_URL=redis://redis-host:6379
BASIC_MODEL=t5-small
MEDIUM_MODEL=nllb-200-distilled-600M
PREMIUM_MODEL=nllb-200-distilled-1.3B
```

**`.env.frontend`** (Frontend):
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com
PORT=3000
```

### Étape 3: Déploiement des Services

#### Option A: Docker Simple
```bash
# 1. Infrastructure (Base de données et cache)
docker run -d --name meeshy-postgres \
  -e POSTGRES_DB=meeshy \
  -e POSTGRES_USER=meeshy_user \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 \
  postgres:15-alpine

docker run -d --name meeshy-redis \
  -p 6379:6379 \
  redis:7-alpine

# 2. Services Applicatifs
docker run -d --name meeshy-translator \
  --env-file .env.translator \
  -p 50051:50051 \
  -v /path/to/models:/app/models \
  meeshy/translator:v1.0.0

docker run -d --name meeshy-backend \
  --env-file .env.backend \
  -p 3001:3001 \
  --link meeshy-postgres:postgres \
  --link meeshy-redis:redis \
  --link meeshy-translator:translation-service \
  meeshy/backend:v1.0.0

docker run -d --name meeshy-frontend \
  --env-file .env.frontend \
  -p 3000:3000 \
  meeshy/frontend:v1.0.0
```

#### Option B: Docker Compose Production
```bash
# Utiliser docker-compose.prod.yml (si créé)
docker-compose -f docker-compose.prod.yml up -d
```

#### Option C: Kubernetes
```yaml
# Exemple de déploiement Kubernetes
apiVersion: apps/v1
kind: Deployment
metadata:
  name: meeshy-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: meeshy-backend
  template:
    metadata:
      labels:
        app: meeshy-backend
    spec:
      containers:
      - name: backend
        image: meeshy/backend:v1.0.0
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: meeshy-backend-config
        - secretRef:
            name: meeshy-backend-secrets
```

### Étape 4: Vérification du Déploiement

```bash
# Health checks
curl http://your-domain:3001/health
curl http://your-domain:3000/health

# Vérifier les logs
docker logs meeshy-backend
docker logs meeshy-translator
docker logs meeshy-frontend

# Tester l'API
curl -X POST http://your-domain:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

---

## 🛡️ Sécurité en Production

### Checklist de Sécurité
- [ ] Changez tous les mots de passe par défaut
- [ ] Utilisez HTTPS/TLS pour toutes les connexions
- [ ] Configurez des pare-feu appropriés
- [ ] Limitez l'accès aux ports de base de données
- [ ] Utilisez des secrets managers (AWS Secrets, Azure Key Vault)
- [ ] Activez l'audit et logging
- [ ] Configurez des sauvegardes automatiques
- [ ] Surveillez les métriques de performance

### Variables Sensibles
```bash
# NE JAMAIS commiter ces valeurs en production
JWT_SECRET=generate-secure-random-string
POSTGRES_PASSWORD=secure-database-password  
REDIS_PASSWORD=secure-redis-password
```

---

## 📊 Monitoring en Production

### Métriques à Surveiller
- **Performance**: Latence, throughput, erreurs
- **Ressources**: CPU, mémoire, disque, réseau
- **Services**: Santé des containers, connexions DB
- **Applicatif**: Messages traduits, cache hit rate

### Outils Recommandés
- **Métriques**: Prometheus + Grafana
- **Logs**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Alertes**: PagerDuty, Slack notifications
- **APM**: New Relic, DataDog, AppDynamics

---

## 🔄 Mise à Jour et Rollback

### Déploiement Blue-Green
```bash
# 1. Déploiement de la nouvelle version (Green)
docker run -d --name meeshy-backend-green \
  --env-file .env.backend \
  -p 3002:3001 \
  meeshy/backend:v1.1.0

# 2. Test de la nouvelle version
curl http://localhost:3002/health

# 3. Switch du traffic (Load Balancer)
# 4. Arrêt de l'ancienne version (Blue)
docker stop meeshy-backend-blue
```

### Rollback Rapide
```bash
# En cas de problème, retourner à la version précédente
docker stop meeshy-backend-green
docker start meeshy-backend-blue
# Puis ajuster le load balancer
```

---

## 🔍 Troubleshooting

### Problèmes Courants

**Service ne démarre pas:**
```bash
# Vérifier les logs
docker logs container-name

# Vérifier la configuration
docker exec -it container-name env

# Tester la conectivité
docker exec -it container-name ping database-host
```

**Performance lente:**
```bash
# Vérifier les ressources
docker stats

# Vérifier la base de données
docker exec -it postgres-container pg_stat_activity

# Vérifier le cache
docker exec -it redis-container redis-cli info memory
```

**Erreurs de traduction:**
```bash
# Vérifier les modèles ML
docker exec -it meeshy-translator ls -la /app/models

# Tester gRPC directement
grpcurl -plaintext localhost:50051 list
```

---

## 📞 Support

Pour toute question sur le déploiement:
1. Consultez les logs des services
2. Vérifiez la configuration des variables d'environnement
3. Testez la connectivité entre services
4. Créez une issue GitHub avec les détails de l'erreur
