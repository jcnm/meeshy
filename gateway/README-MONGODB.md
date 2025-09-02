# Meeshy Gateway - Version MongoDB

Ce répertoire contient la version MongoDB de la Gateway Meeshy, optimisée pour fonctionner avec MongoDB comme base de données.

## 🏗️ Build Docker

### Build Multi-Platform

Pour construire l'image Docker avec support multi-platform (linux/amd64, linux/arm64) :

```bash
# Utiliser le script automatique
./build-mongodb-direct.sh

# Ou utiliser la commande manuelle
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --progress=plain \
    -t isopen/meeshy-gateway:mongodb \
    -t isopen/meeshy-gateway:mongodb-ovh \
    -f Dockerfile.mongodb \
    . \
    --push
```

### Build Local (Single Platform)

Pour construire l'image localement pour votre plateforme :

```bash
docker build -f Dockerfile.mongodb -t meeshy-gateway:mongodb .
```

## 🚀 Utilisation

### Variables d'environnement requises

```bash
# Base de données MongoDB
DATABASE_URL=mongodb://username:password@host:port/database

# Redis
REDIS_URL=redis://host:port

# JWT
JWT_SECRET=your-secret-key

# Autres configurations
FASTIFY_PORT=3000
LOG_LEVEL=info
```

### Exécution avec Docker

```bash
# Exécution simple
docker run -p 3000:3000 \
    -e DATABASE_URL="mongodb://localhost:27017/meeshy" \
    -e REDIS_URL="redis://localhost:6379" \
    -e JWT_SECRET="your-secret" \
    isopen/meeshy-gateway:mongodb

# Exécution avec docker-compose
docker-compose up gateway-mongodb
```

## 🔧 Différences avec la version PostgreSQL

### Configuration Prisma

- Utilise le schéma MongoDB (`schema.prisma`)
- Génération du client Prisma pour MongoDB
- Support des ObjectIDs MongoDB

### Variables d'environnement

- `DATABASE_URL` doit pointer vers une instance MongoDB
- Format : `mongodb://username:password@host:port/database`

### Fonctionnalités

- Support complet des liens partagés avec MongoDB
- Gestion des conversations avec identifiants (comme "meeshy")
- Support des participants anonymes
- Intégration avec le service de traduction

## 📋 Scripts disponibles

- `build-mongodb.sh` : Script de build avec versioning
- `build-mongodb-direct.sh` : Script de build direct (commande exacte)

## 🏥 Health Check

L'image inclut un health check qui vérifie l'endpoint `/health` :

```bash
curl http://localhost:3000/health
```

## 🔍 Debug

Pour activer le mode debug :

```bash
docker run -e DEBUG=true -e LOG_LEVEL=debug isopen/meeshy-gateway:mongodb
```

## 📦 Images disponibles

- `isopen/meeshy-gateway:mongodb` : Version MongoDB
- `isopen/meeshy-gateway:mongodb-ovh` : Version MongoDB pour OVH
- `isopen/meeshy-gateway:mongodb-{version}` : Version avec timestamp

## 🌐 Plateformes supportées

- linux/amd64
- linux/arm64
