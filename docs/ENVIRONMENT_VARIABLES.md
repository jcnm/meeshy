# Variables d'Environnement Meeshy

## Vue d'ensemble

Ce document explique la logique des variables d'environnement utilisées dans Meeshy, en particulier pour la communication entre le frontend et la gateway.

## Variables Frontend

### Variables NEXT_PUBLIC_* (Côté Client/Navigateur)

Ces variables sont accessibles côté client (navigateur) et définissent les URLs utilisées par le code JavaScript qui s'exécute dans le navigateur.

```bash
# URLs pour les requêtes depuis le navigateur
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_TRANSLATION_URL=http://localhost:8000
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3100
```

### Variables INTERNAL_* (Côté Serveur/SSR)

Ces variables sont utilisées côté serveur (SSR - Server Side Rendering) pour la communication entre containers Docker.

```bash
# URLs pour la communication entre containers
INTERNAL_BACKEND_URL=http://gateway:3000
INTERNAL_WS_URL=ws://gateway:3000
```

## Logique de Sélection des URLs

### Dans `frontend/lib/config.ts`

```typescript
export const getBackendUrl = (): string => {
  if (isBrowser()) {
    // Côté client (navigateur) - utiliser NEXT_PUBLIC_BACKEND_URL
    return trimSlashes(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000');
  }
  // Côté serveur (SSR) - utiliser INTERNAL_BACKEND_URL
  return trimSlashes(process.env.INTERNAL_BACKEND_URL || 'http://localhost:3000');
};
```

### Comportement

1. **Côté Client (Navigateur)** :
   - Utilise `NEXT_PUBLIC_BACKEND_URL=http://localhost:3000`
   - Le navigateur fait des requêtes vers `http://localhost:3000`
   - ✅ Fonctionne car le port 3000 est exposé sur l'hôte

2. **Côté Serveur (SSR)** :
   - Utilise `INTERNAL_BACKEND_URL=http://gateway:3000`
   - Le container frontend fait des requêtes vers le container gateway
   - ✅ Fonctionne car les containers sont sur le même réseau Docker

## Configuration par Environnement

### Développement Local

```bash
# .env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
INTERNAL_BACKEND_URL=http://localhost:3000
```

### Containers Séparés

```bash
# docker-compose.yml
environment:
  NEXT_PUBLIC_BACKEND_URL: http://localhost:3000  # Pour le navigateur
  INTERNAL_BACKEND_URL: http://gateway:3000       # Pour SSR
```

### Container Unifié

```bash
# docker-compose.unified.yml
environment:
  NEXT_PUBLIC_BACKEND_URL: http://localhost/api   # Pour le navigateur
  INTERNAL_BACKEND_URL: http://localhost:3000     # Pour SSR interne
```

## Variables Backend

### Gateway

```bash
# Configuration de base
PORT=3000
NODE_ENV=production
JWT_SECRET=your-secret-key

# Base de données
DATABASE_URL=postgresql://user:pass@postgres:5432/meeshy
REDIS_URL=redis://redis:6379

# Communication avec Translator
TRANSLATOR_GRPC_URL=translator:50051
ZMQ_TRANSLATOR_HOST=translator
ZMQ_TRANSLATOR_PUSH_PORT=5555
ZMQ_TRANSLATOR_SUB_PORT=5558

# CORS
CORS_ORIGIN=http://localhost:3100
CORS_ORIGINS=http://localhost:3100
ALLOWED_ORIGINS=http://localhost:3100
```

### Translator

```bash
# Configuration HTTP/gRPC
HTTP_PORT=8000
GRPC_PORT=50051
FASTAPI_PORT=8000

# Configuration ZMQ
ZMQ_PUSH_PORT=5555
ZMQ_SUB_PORT=5558

# Configuration ML
DEVICE=cpu
ML_BATCH_SIZE=4
TRANSLATION_WORKERS=50
QUANTIZATION_LEVEL=float16
```

## Variables Base de Données

```bash
# PostgreSQL
POSTGRES_DB=meeshy
POSTGRES_USER=meeshy
POSTGRES_PASSWORD=MeeshyP@ssword
POSTGRES_PORT=5432
DATABASE_URL=postgresql://meeshy:MeeshyP@ssword@postgres:5432/meeshy

# Redis
REDIS_URL=redis://redis:6379
REDIS_PORT=6379
```

## Variables de Cache

```bash
# Configuration du cache
TRANSLATION_CACHE_TTL=3600
CACHE_MAX_ENTRIES=10000
PRISMA_POOL_SIZE=10
```

## Variables de Sécurité

```bash
# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Mots de passe par défaut
MEESHY_BIGBOSS_PASSWORD=bigboss123
ADMIN_PASSWORD=admin123
```

## Variables de Performance

```bash
# PyTorch
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:128
OMP_NUM_THREADS=4
MKL_NUM_THREADS=4
NUMEXPR_NUM_THREADS=4

# Workers
WORKERS=4
TRANSLATION_WORKERS=50
NORMAL_WORKERS=2
ANY_WORKERS=1
```

## Variables de Monitoring

```bash
# Health checks
HEALTH_CHECK_INTERVAL=30
HEALTH_CHECK_TIMEOUT=5
HEALTH_CHECK_RETRIES=3

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=logs/meeshy.log
```

## Bonnes Pratiques

1. **Toujours utiliser les variables d'environnement** au lieu de valeurs codées en dur
2. **Séparer les URLs client et serveur** avec NEXT_PUBLIC_* et INTERNAL_*
3. **Utiliser des valeurs par défaut sécurisées** pour la production
4. **Documenter toutes les variables** dans ce fichier
5. **Tester la configuration** avec les scripts de diagnostic

## Scripts de Diagnostic

```bash
# Tester la configuration
./scripts/test-separated-containers.sh

# Diagnostiquer les containers
./scripts/diagnostic-separated.sh

# Redémarrer avec nouvelle configuration
./scripts/restart-separated.sh
```


