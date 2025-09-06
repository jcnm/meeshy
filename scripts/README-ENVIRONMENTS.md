# 🚀 Environnements Meeshy - DEV vs PROD

Ce document décrit la séparation claire entre les environnements de développement (DEV) et de production (PROD) pour Meeshy.

## 📋 Vue d'ensemble

### Environnement DEV (Local)
- **Architecture**: Services Node.js natifs + Services Docker (MongoDB, Redis)
- **Utilisation**: Développement local avec hot-reload
- **Performance**: Optimisé pour le développement rapide
- **Sécurité**: Configuration de développement avec clés de test

### Environnement PROD (DigitalOcean)  
- **Architecture**: Tous services Docker + Traefik + SSL automatique
- **Utilisation**: Production avec haute performance et sécurité
- **Performance**: Optimisé pour 100k messages/seconde
- **Sécurité**: SSL/TLS automatique, variables sécurisées

## 🏗️ Structure des Scripts

```
scripts/
├── development/           # Scripts pour l'environnement DEV
│   ├── start-local.sh    # ⭐ Démarrage environnement local
│   ├── stop-local.sh     # 🛑 Arrêt environnement local  
│   └── configure-dev.sh  # 🔧 Configuration environnement DEV
├── production/            # Scripts pour l'environnement PROD
│   ├── start-production.sh     # ⭐ Démarrage production
│   ├── stop-production.sh      # 🛑 Arrêt production
│   └── configure-production.sh # 🔧 Configuration production
└── deployment/            # Scripts de déploiement (inchangés)
```

## 🚀 Démarrage Rapide

### Environnement DEV (Local)

```bash
# 1. Configuration initiale
./scripts/development/configure-dev.sh

# 2. Démarrage de l'environnement local
./scripts/development/start-local.sh

# 3. Arrêt de l'environnement local
./scripts/development/stop-local.sh
```

### Environnement PROD (DigitalOcean)

```bash
# 1. Configuration initiale (copie env.digitalocean)
./scripts/production/configure-production.sh

# 2. Démarrage de la production
./scripts/production/start-production.sh

# 3. Arrêt de la production
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
| **Performance** | Dev optimisé | Production optimisée |
| **Logs** | Console + fichiers | Docker logs |
| **Configuration** | .env.local | .env.production |

## 🔧 Configuration Détaillée

### Environnement DEV

#### Variables d'environnement (.env.local)
```bash
NODE_ENV=development
DATABASE_URL=mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/ws
```

#### Services et Ports
- **Frontend**: http://localhost:3100 (Next.js dev server)
- **Gateway**: http://localhost:3000 (Fastify dev)  
- **Translator**: http://localhost:8000 (FastAPI dev)
- **MongoDB**: mongodb://localhost:27017 (Docker)
- **Redis**: redis://localhost:6379 (Docker)

#### Architecture DEV
```
Frontend (localhost:3100) ← Node.js natif
    ↓ HTTP/WebSocket
Gateway (localhost:3000) ← Node.js natif
    ↓ gRPC/ZMQ
Translator (localhost:8000) ← Python natif  
    ↓ 
MongoDB (localhost:27017) ← Docker
Redis (localhost:6379) ← Docker
```

### Environnement PROD

#### Variables d'environnement (.env.production)
```bash
NODE_ENV=production
DATABASE_URL=mongodb://user:pass@database:27017/meeshy?authSource=admin
DOMAIN_NAME=meeshy.me
CERTBOT_EMAIL=admin@meeshy.me
TRANSLATOR_IMAGE=isopen/meeshy-translator:latest
GATEWAY_IMAGE=isopen/meeshy-gateway:latest
FRONTEND_IMAGE=isopen/meeshy-frontend:latest
```

#### Services et URLs
- **Frontend**: https://meeshy.me
- **Gateway**: https://gate.meeshy.me
- **Translator**: https://ml.meeshy.me
- **Traefik Dashboard**: http://meeshy.me:8080

#### Architecture PROD
```
Internet
    ↓ HTTPS (SSL Let's Encrypt)
Traefik (port 80/443)
    ↓ 
Frontend (Docker) ← meeshy.me
Gateway (Docker) ← gate.meeshy.me  
Translator (Docker) ← ml.meeshy.me
    ↓
MongoDB (Docker)
Redis (Docker)
```

## 🎯 Flux de Travail Recommandé

### 1. Développement Local

```bash
# Démarrer l'environnement de développement
./scripts/development/start-local.sh

# Développer avec hot-reload
# - Frontend: Modifications automatiquement rechargées
# - Gateway: Redémarrage automatique avec nodemon
# - Translator: Redémarrage automatique avec uvicorn --reload

# Tester les fonctionnalités
curl http://localhost:3000/health
curl http://localhost:8000/health

# Arrêter l'environnement
./scripts/development/stop-local.sh
```

### 2. Déploiement Production

```bash
# Configurer la production
./scripts/production/configure-production.sh

# Démarrer en production
./scripts/production/start-production.sh

# Vérifier les services
curl https://gate.meeshy.me/health
curl https://ml.meeshy.me/health

# Surveiller les logs
docker-compose -f docker-compose.prod.yml logs -f

# Arrêter si nécessaire
./scripts/production/stop-production.sh
```

## 🛠️ Scripts Détaillés

### scripts/development/start-local.sh
- ✅ Vérifie les ports disponibles
- 🐳 Démarre MongoDB et Redis via Docker
- 🚀 Lance Translator, Gateway, Frontend en natif
- 📊 Affiche les URLs et PIDs des services
- 📝 Crée des fichiers de logs pour chaque service

### scripts/development/stop-local.sh  
- 🛑 Arrête tous les processus Node.js/Python
- 🐳 Arrête les conteneurs Docker
- 🧹 Nettoie les fichiers de logs
- ✅ Vérifie la libération des ports

### scripts/production/start-production.sh
- 📦 Pull les dernières images Docker
- 🔍 Valide la configuration production
- 🚀 Démarre tous les services via docker-compose.prod.yml  
- 🔒 Configure SSL automatique avec Let's Encrypt
- 📊 Teste la connectivité des services

### scripts/production/stop-production.sh
- 💾 Sauvegarde optionnelle des logs
- 🛑 Arrêt gracieux des services
- 🗑️ Options de nettoyage (conteneurs, volumes, images)
- ✅ Vérification finale

## 🔍 Dépannage

### Problèmes Courants DEV

#### Ports occupés
```bash
# Identifier les processus
lsof -ti:3000
lsof -ti:3100  
lsof -ti:8000

# Tuer les processus
pkill -f "node.*server.js"
pkill -f "python.*main.py"
```

#### Services Docker non démarrés
```bash
# Vérifier les conteneurs
docker-compose ps

# Redémarrer les services de base
docker-compose up -d database redis
```

### Problèmes Courants PROD

#### SSL non configuré
```bash
# Vérifier Traefik
docker-compose -f docker-compose.prod.yml logs traefik

# Vérifier DNS
nslookup meeshy.me
```

#### Services non accessibles
```bash
# Vérifier tous les services
docker-compose -f docker-compose.prod.yml ps

# Redémarrer un service spécifique
docker-compose -f docker-compose.prod.yml restart gateway
```

## 📚 Ressources

- **Docker Compose**: Configuration dans `docker-compose.yml` (dev) et `docker-compose.prod.yml` (prod)
- **Variables d'environnement**: `.env.local` (dev) et `.env.production` (prod)
- **Documentation Traefik**: Configuration SSL automatique
- **Monitoring**: Logs Docker et fichiers de logs locaux

## 🎉 Migration des Anciens Scripts

Les anciens scripts ont été remplacés :
- ❌ `start-local.sh` → ✅ `scripts/development/start-local.sh`
- ❌ `start-local-simple.sh` → ✅ `scripts/development/start-local.sh`

La nouvelle structure offre :
- 🎯 Séparation claire DEV/PROD
- 🔧 Configuration automatisée
- 📊 Meilleur monitoring
- 🛠️ Scripts plus robustes
- 📝 Documentation intégrée
