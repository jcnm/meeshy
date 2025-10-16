# 🚀 Guide de Build Docker Frontend - Solutions aux Timeouts

Ce guide explique comment résoudre les problèmes de timeout lors du build multi-plateforme du frontend Meeshy.

## 🔍 Problème Initial

La commande suivante échoue après 60 secondes:
```bash
cd frontend && docker buildx build --platform linux/arm64,linux/amd64 --progress=plain -t isopen/meeshy-frontend:latest -f Dockerfile . --push
```

## 💡 Causes Communes

1. **Build multi-plateforme lente**: ARM64 + AMD64 nécessite QEMU pour émuler l'autre architecture
2. **Pas de cache**: Chaque build recompile tout depuis zéro
3. **Installation pnpm lente**: ~80+ dépendances à télécharger et installer
4. **Build Next.js lente**: Compilation TypeScript + génération static/SSR
5. **Upload lent**: Push de l'image vers Docker Hub
6. **Timeout réseau**: Connexion instable ou lente

## ✅ Solutions Disponibles

### Solution 1: Build Optimisé avec Cache (RECOMMANDÉ)

**Avantages**: 
- ⚡ Jusqu'à 10x plus rapide après le premier build
- 💾 Utilise le cache Docker Registry
- 🔄 Build incrémentale
- 📦 Un seul manifest multi-arch

**Utilisation**:
```bash
cd frontend

# Build et push avec cache (recommandé)
./scripts/docker-build-optimized.sh

# Build local uniquement (pour tester)
PUSH=false ./scripts/docker-build-optimized.sh

# Build avec tag personnalisé
DOCKER_TAG=v1.0.0 ./scripts/docker-build-optimized.sh

# Build pour une seule plateforme (plus rapide)
PLATFORMS=linux/arm64 ./scripts/docker-build-optimized.sh
```

**Comment ça marche**:
- Utilise `Dockerfile.optimized` avec RUN --mount cache
- Cache pnpm store pour éviter de re-télécharger les packages
- Cache .next/cache pour build incrémentale
- Sauvegarde le cache dans Docker Hub (ref:buildcache)

### Solution 2: Build Séparé par Plateforme

**Avantages**:
- 🛡️ Plus fiable pour connexions instables
- 🔄 Peut reprendre une plateforme sans tout refaire
- 📊 Visibilité sur chaque plateforme

**Inconvénients**:
- ⏱️ Plus long (2 builds séquentielles)
- 💾 Plus d'espace disque utilisé

**Utilisation**:
```bash
cd frontend
./scripts/docker-build-separate.sh
```

**Comment ça marche**:
1. Build ARM64 → push → cache
2. Build AMD64 → push → cache
3. Crée un manifest multi-arch combinant les deux

### Solution 3: Build Locale puis Push

**Avantages**:
- 🧪 Tester localement avant de push
- 🚫 Pas de risque d'image cassée sur Docker Hub

**Utilisation**:
```bash
cd frontend

# Build locale seulement
PUSH=false PLATFORMS=linux/arm64 ./scripts/docker-build-optimized.sh

# Tester l'image
docker run -p 3100:80 isopen/meeshy-frontend:latest

# Si OK, push
docker push isopen/meeshy-frontend:latest
```

## 🔧 Configuration Buildx

### Vérifier la configuration actuelle
```bash
docker buildx ls
docker buildx inspect meeshy-builder-fresh
```

### Recréer le builder (si problèmes)
```bash
# Supprimer l'ancien builder
docker buildx rm meeshy-builder-fresh

# Créer un nouveau builder optimisé
docker buildx create \
  --name meeshy-builder-fresh \
  --driver docker-container \
  --driver-opt network=host \
  --bootstrap

# L'utiliser par défaut
docker buildx use meeshy-builder-fresh
```

## 📊 Comparaison des Temps de Build

| Méthode | Premier Build | Builds suivantes | Fiabilité |
|---------|--------------|------------------|-----------|
| Sans cache (original) | ~15-20 min | ~15-20 min | ⭐⭐⭐ |
| Avec cache (optimisé) | ~15-20 min | ~2-5 min | ⭐⭐⭐⭐ |
| Séparé par plateforme | ~20-30 min | ~20-30 min | ⭐⭐⭐⭐⭐ |
| Local puis push | ~8-10 min | ~8-10 min | ⭐⭐⭐⭐ |

## 🐛 Dépannage

### Erreur "failed to solve with frontend dockerfile.v0"
```bash
# Nettoyer le cache buildx
docker buildx prune -af

# Recréer le builder
docker buildx rm meeshy-builder-fresh
docker buildx create --name meeshy-builder-fresh --bootstrap
docker buildx use meeshy-builder-fresh
```

### Erreur "timeout exceeded while awaiting headers"
```bash
# Vérifier la connexion réseau
ping docker.io

# Augmenter le timeout (si supporté)
export BUILDKIT_STEP_LOG_MAX_SIZE=50000000
export BUILDKIT_STEP_LOG_MAX_SPEED=10000000

# Ou utiliser le script séparé
./scripts/docker-build-separate.sh
```

### Erreur "failed to push: insufficient_scope"
```bash
# Re-login Docker Hub
docker logout
docker login

# Vérifier les permissions
docker info | grep Username
```

### Build trop lente même avec cache
```bash
# Vérifier l'utilisation du cache
docker buildx du --verbose

# Vérifier l'espace disque
df -h

# Nettoyer si nécessaire
docker system prune -a --volumes
```

## 🎯 Recommandations

### Pour le Développement
```bash
# Build locale rapide (ARM64 seulement sur Mac Silicon)
PUSH=false PLATFORMS=linux/arm64 ./scripts/docker-build-optimized.sh
```

### Pour la Production
```bash
# Build complète avec cache (recommandé)
./scripts/docker-build-optimized.sh

# Ou si problèmes de connexion
./scripts/docker-build-separate.sh
```

### Pour CI/CD
```bash
# Utiliser GitHub Actions / GitLab CI avec cache
# Exemple GitHub Actions:
# - uses: docker/build-push-action@v5
#   with:
#     cache-from: type=registry,ref=isopen/meeshy-frontend:buildcache
#     cache-to: type=registry,ref=isopen/meeshy-frontend:buildcache,mode=max
```

## 📝 Fichiers Créés

- `Dockerfile.optimized` - Dockerfile avec cache mount optimisé
- `scripts/docker-build-optimized.sh` - Script de build avec cache
- `scripts/docker-build-separate.sh` - Script de build séparé par plateforme

## 🔗 Ressources

- [Docker Buildx Documentation](https://docs.docker.com/buildx/working-with-buildx/)
- [BuildKit Cache](https://docs.docker.com/build/cache/)
- [Multi-platform Images](https://docs.docker.com/build/building/multi-platform/)

## ⚡ Quick Start

```bash
# Méthode la plus rapide après le premier build
cd frontend
./scripts/docker-build-optimized.sh
```

C'est tout ! Le cache fera le reste. 🚀

