# Documentation Docker - Meeshy Backend Refactored

## Vue d'ensemble

Cette configuration Docker containerise l'ensemble du backend Meeshy refactorisé avec Fastify, incluant :

- **Service Fastify** : API REST et WebSocket (port 3001)
- **Service de traduction gRPC** : Traduction automatique (port 50051)
- **Base de données PostgreSQL** : Stockage des données (port 5432)
- **Redis** : Cache et sessions (port 6379)
- **Nginx** : Reverse proxy et load balancer (port 80)
- **Monitoring** : Prometheus (9090) + Grafana (3003)

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │────│      Nginx       │────│  Fastify API    │
│  (Next.js)      │    │  (Port 80/443)   │    │   (Port 3001)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ├─────────────────┐
                                                         │                 │
                                         ┌─────────────────┐    ┌─────────────────┐
                                         │   PostgreSQL    │    │ Translation gRPC│
                                         │   (Port 5432)   │    │   (Port 50051)  │
                                         └─────────────────┘    └─────────────────┘
                                                         │
                                         ┌─────────────────┐
                                         │      Redis      │
                                         │   (Port 6379)   │
                                         └─────────────────┘
```

## Démarrage rapide

### Prérequis

- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- Au moins 4GB de RAM disponible

### Installation

1. **Cloner et naviguer vers le répertoire :**
   ```bash
   cd /Users/smpceo/Downloads/Meeshy/meeshy/backend-refactored
   ```

2. **Rendre le script de gestion exécutable :**
   ```bash
   chmod +x docker-manage.sh
   ```

3. **Démarrer en mode développement :**
   ```bash
   ./docker-manage.sh start-dev
   ```

4. **Vérifier que tout fonctionne :**
   ```bash
   ./docker-manage.sh health
   ```

## Commandes de gestion

Le script `docker-manage.sh` fournit toutes les commandes nécessaires :

### Démarrage et arrêt
```bash
# Démarrer en développement
./docker-manage.sh start-dev

# Démarrer en production
./docker-manage.sh start-prod

# Arrêter tous les services
./docker-manage.sh stop

# Redémarrer
./docker-manage.sh restart [dev|prod]
```

### Monitoring et debugging
```bash
# Status des services
./docker-manage.sh status

# Logs de tous les services
./docker-manage.sh logs

# Logs d'un service spécifique
./docker-manage.sh logs fastify-service

# Health check
./docker-manage.sh health
```

### Maintenance
```bash
# Construire les images
./docker-manage.sh build

# Sauvegarder la DB
./docker-manage.sh backup

# Restaurer la DB
./docker-manage.sh restore ./backups/backup_file.sql

# Nettoyage complet
./docker-manage.sh clean
```

## Accès aux services

### Mode développement
- **API Fastify** : http://localhost:3001
- **Health Check** : http://localhost:3001/health
- **API Info** : http://localhost:3001/api/info
- **WebSocket** : ws://localhost:3001/ws
- **Nginx** : http://localhost:80
- **PostgreSQL** : localhost:5432 (user: meeshy, db: meeshy_db)
- **Redis** : localhost:6379

### Mode production (services supplémentaires)
- **Grafana** : http://localhost:3003 (admin/admin)
- **Prometheus** : http://localhost:9090

## Configuration

### Variables d'environnement

**Développement** (`.env`) :
- `NODE_ENV=development`
- `DATABASE_URL=file:../shared/prisma/dev.db`
- `JWT_SECRET=your-secret-key`

**Production** (`.env.production`) :
- `NODE_ENV=production`
- `DATABASE_URL=postgresql://...`
- `JWT_SECRET=${JWT_SECRET}` (depuis l'environnement)

### Personnalisation

1. **Modifier les ports** : Éditer `docker-compose.yml`
2. **Changer les variables** : Modifier `.env.docker`
3. **Configuration Nginx** : Éditer `nginx/nginx.conf`
4. **Monitoring** : Configurer `monitoring/prometheus.yml`

## Volumes persistants

Les données suivantes sont persistées :
- **postgres-data** : Base de données PostgreSQL
- **redis-data** : Cache Redis
- **translation-models** : Modèles de traduction
- **fastify-logs** : Logs du service Fastify
- **nginx-logs** : Logs Nginx (production)

## Sécurité

### Développement
- Ports exposés pour faciliter le debug
- Logs détaillés activés
- Hot reload activé

### Production
- Utilisateurs non-root dans les conteneurs
- Secrets via variables d'environnement
- Health checks complets
- Monitoring et métriques
- Logs rotatifs

## Troubleshooting

### Problèmes courants

1. **Port déjà utilisé**
   ```bash
   # Vérifier les ports occupés
   lsof -i :3001
   # Arrêter les services
   ./docker-manage.sh stop
   ```

2. **Problème de permissions**
   ```bash
   # Reconstruire les images
   ./docker-manage.sh build
   ```

3. **Base de données corrompue**
   ```bash
   # Nettoyer et redémarrer
   ./docker-manage.sh clean
   ./docker-manage.sh start-dev
   ```

4. **Problème de réseau**
   ```bash
   # Recréer le réseau Docker
   docker network prune
   ./docker-manage.sh restart
   ```

### Logs et debugging

```bash
# Logs détaillés d'un service
docker logs -f meeshy-fastify

# Entrer dans un conteneur
docker exec -it meeshy-fastify /bin/sh

# Vérifier l'état des conteneurs
docker ps -a

# Inspecter un conteneur
docker inspect meeshy-fastify
```

## Performance

### Optimisations appliquées

1. **Build multi-stage** : Images optimisées pour la production
2. **Cache intelligent** : Réutilisation des layers Docker
3. **Health checks** : Détection rapide des problèmes
4. **Ressources limitées** : Prévention de la consommation excessive
5. **Réseau optimisé** : Communication interne efficace

### Monitoring des performances

- **Grafana** : Dashboards visuels des métriques
- **Prometheus** : Collecte des métriques système
- **Health endpoints** : Vérification continue de l'état
- **Logs structurés** : Analyse des performances

## Déploiement production

### Checklist avant déploiement

- [ ] Changer tous les mots de passe par défaut
- [ ] Configurer les certificats SSL
- [ ] Activer les sauvegardes automatiques
- [ ] Configurer le monitoring externe
- [ ] Tester la restauration des sauvegardes

### Variables critiques à modifier

```bash
# Dans .env.production
JWT_SECRET=your-production-secret-very-long-and-secure
POSTGRES_PASSWORD=your-secure-database-password
GRAFANA_PASSWORD=your-secure-grafana-password
```

## Support

Pour les problèmes ou questions :
1. Vérifier les logs : `./docker-manage.sh logs`
2. Vérifier la santé : `./docker-manage.sh health`
3. Consulter cette documentation
4. Vérifier les issues GitHub du projet
