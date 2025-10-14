# 🚀 Meeshy - Guide de Déploiement Local avec Docker

Ce guide explique comment déployer l'ensemble des services Meeshy en local en utilisant les dernières images Docker.

## 📋 Prérequis

- **Docker Desktop** installé et en cours d'exécution
- **Docker Compose** v2.0+ (inclus avec Docker Desktop)
- Au moins **8 GB de RAM** disponible pour Docker
- **10 GB d'espace disque** pour les images et volumes

## 🏗️ Architecture des Services

L'environnement de développement local déploie tous les services suivants :

### Services Applicatifs
- **Frontend** (Next.js) : Interface utilisateur sur http://localhost:3100
- **Gateway** (Fastify) : API Gateway et WebSocket sur http://localhost:3000
- **Translator** (FastAPI) : Service de traduction ML sur http://localhost:8000

### Services Infrastructure
- **MongoDB** : Base de données avec Replica Set sur port 27017
- **Redis** : Cache et sessions sur port 6379

### Services UI d'Administration
- **NoSQLClient** : Interface MongoDB sur http://localhost:3001
- **P3X Redis UI** : Interface Redis sur http://localhost:7843

## 🚀 Démarrage Rapide

### 1. Cloner le dépôt (si ce n'est pas déjà fait)

```bash
git clone <votre-repo>
cd meeshy
```

### 2. Télécharger les dernières images Docker

```bash
./start-dev.sh pull
```

### 3. Démarrer tous les services

```bash
./start-dev.sh
# ou
./start-dev.sh up
```

Le script va :
- ✅ Démarrer tous les services Docker
- ✅ Configurer le réseau Docker
- ✅ Initialiser la base de données
- ✅ Créer les utilisateurs par défaut
- ✅ Afficher les URLs d'accès

## 📍 URLs d'Accès

Une fois les services démarrés, vous pouvez accéder à :

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3100 | Interface utilisateur principale |
| **Gateway API** | http://localhost:3000 | API REST et WebSocket |
| **Translator API** | http://localhost:8000 | API de traduction ML |
| **MongoDB UI** | http://localhost:3001 | Interface NoSQLClient |
| **Redis UI** | http://localhost:7843 | Interface P3X Redis |

## 🔐 Utilisateurs par Défaut

Trois utilisateurs sont créés automatiquement :

| Utilisateur | Email | Mot de passe | Langue |
|-------------|-------|--------------|--------|
| **Admin** | admin@meeshy.local | admin123 | Français |
| **Meeshy** | meeshy@meeshy.local | meeshy123 | Anglais |
| **Atabeth** | atabeth@meeshy.local | atabeth123 | Espagnol |

## 🛠️ Commandes Disponibles

### Gestion des Services

```bash
# Démarrer tous les services
./start-dev.sh up

# Arrêter tous les services
./start-dev.sh stop

# Redémarrer tous les services
./start-dev.sh restart

# Voir le statut des services
./start-dev.sh status
```

### Visualisation des Logs

```bash
# Voir tous les logs (temps réel)
./start-dev.sh logs

# Voir les logs d'un service spécifique
./start-dev.sh logs frontend
./start-dev.sh logs gateway
./start-dev.sh logs translator
./start-dev.sh logs database
./start-dev.sh logs redis
```

### Maintenance

```bash
# Télécharger les dernières images
./start-dev.sh pull

# Réinitialiser la base de données
./start-dev.sh reset

# Nettoyage complet (supprime tout)
./start-dev.sh clean
```

## ⚙️ Configuration

### Variables d'Environnement

Le fichier `.env.dev` contient toutes les configurations. Vous pouvez le modifier selon vos besoins :

```bash
# Éditer la configuration
nano .env.dev
```

**Variables principales :**

```env
# Images Docker (dernières versions)
TRANSLATOR_IMAGE=isopen/meeshy-translator:latest
GATEWAY_IMAGE=isopen/meeshy-gateway:latest
FRONTEND_IMAGE=isopen/meeshy-frontend:latest

# Base de données
DATABASE_TYPE=MONGODB
DATABASE_URL=mongodb://database:27017/meeshy

# Utilisateurs par défaut
ADMIN_PASSWORD=admin123
MEESHY_PASSWORD=meeshy123
ATABETH_PASSWORD=atabeth123

# Reset de la base au démarrage (true/false)
FORCE_DB_RESET=false
```

### Personnalisation des Utilisateurs

Pour modifier les utilisateurs par défaut, éditez `.env.dev` :

```env
# Exemple : Changer le mot de passe admin
ADMIN_PASSWORD=mon_nouveau_mot_de_passe

# Exemple : Changer la langue de Meeshy
MEESHY_SYSTEM_LANGUAGE=fr
```

Puis redémarrez avec reset :

```bash
./start-dev.sh reset
```

## 🔍 Vérification de l'Installation

### 1. Vérifier que tous les services sont en cours d'exécution

```bash
./start-dev.sh status
```

Vous devriez voir tous les services avec l'état "Up".

### 2. Tester le Frontend

Ouvrez http://localhost:3100 dans votre navigateur et connectez-vous avec un utilisateur par défaut.

### 3. Tester l'API Gateway

```bash
# Vérifier la santé du service
curl http://localhost:3000/health

# Connexion d'un utilisateur
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@meeshy.local","password":"admin123"}'
```

### 4. Tester le Translator

```bash
# Vérifier la santé du service
curl http://localhost:8000/health

# Test de traduction
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","source_language":"en","target_language":"fr"}'
```

## 🐛 Dépannage

### Les services ne démarrent pas

1. **Vérifier Docker Desktop**
   ```bash
   docker info
   ```

2. **Vérifier les logs d'un service**
   ```bash
   ./start-dev.sh logs [service]
   ```

3. **Redémarrer proprement**
   ```bash
   ./start-dev.sh stop
   ./start-dev.sh up
   ```

### Problème de port déjà utilisé

Si un port est déjà utilisé, modifiez `docker-compose.dev.yml` :

```yaml
# Exemple : Changer le port frontend de 3100 à 3200
ports:
  - "3200:3100"
```

### Base de données corrompue

Réinitialisez complètement :

```bash
./start-dev.sh clean
./start-dev.sh up
```

### Images Docker obsolètes

Mettez à jour les images :

```bash
./start-dev.sh pull
./start-dev.sh restart
```

## 📊 Monitoring et Debug

### Voir les ressources utilisées

```bash
docker stats
```

### Accéder à un conteneur

```bash
# Shell dans le conteneur gateway
docker exec -it meeshy-dev-gateway sh

# Shell dans le conteneur translator
docker exec -it meeshy-dev-translator bash

# Shell MongoDB
docker exec -it meeshy-dev-database mongosh meeshy
```

### Voir les réseaux Docker

```bash
docker network ls
docker network inspect meeshy-dev-network
```

## 🔄 Workflow de Développement

### Développement avec Hot Reload

Pour développer avec hot reload, vous pouvez :

1. **Arrêter le service que vous développez**
   ```bash
   docker-compose -f docker-compose.dev.yml stop frontend
   ```

2. **Démarrer le service en mode développement natif**
   ```bash
   cd frontend
   ./frontend.sh
   ```

3. **Garder les autres services Docker actifs**

### Tester une nouvelle image

1. **Builder votre nouvelle image**
   ```bash
   cd gateway
   docker build -t isopen/meeshy-gateway:test .
   ```

2. **Modifier `.env.dev`**
   ```env
   GATEWAY_IMAGE=isopen/meeshy-gateway:test
   ```

3. **Redémarrer**
   ```bash
   ./start-dev.sh restart gateway
   ```

## 📦 Volumes Docker

Les données persistantes sont stockées dans des volumes Docker :

| Volume | Description |
|--------|-------------|
| `meeshy-dev-database-data` | Données MongoDB |
| `meeshy-dev-database-config` | Config MongoDB |
| `meeshy-dev-redis-data` | Données Redis |
| `meeshy-dev-models-data` | Modèles ML (Transformers) |
| `meeshy-dev-redis-ui-data` | Config Redis UI |

### Sauvegarder les volumes

```bash
# Backup MongoDB
docker run --rm -v meeshy-dev-database-data:/data -v $(pwd):/backup mongo:8.0 \
  tar czf /backup/meeshy-db-backup-$(date +%Y%m%d).tar.gz /data

# Backup Redis
docker run --rm -v meeshy-dev-redis-data:/data -v $(pwd):/backup redis:8-alpine \
  tar czf /backup/meeshy-redis-backup-$(date +%Y%m%d).tar.gz /data
```

### Restaurer les volumes

```bash
# Restore MongoDB
docker run --rm -v meeshy-dev-database-data:/data -v $(pwd):/backup mongo:8.0 \
  tar xzf /backup/meeshy-db-backup-YYYYMMDD.tar.gz -C /
```

## 🚀 Passage en Production

Pour déployer en production, utilisez plutôt :

```bash
# Avec Traefik (recommandé)
docker-compose -f docker-compose.traefik.yml up -d

# Ou sans Traefik
docker-compose -f docker-compose.yml up -d
```

## 📝 Notes Importantes

1. **Performance** : Les images Docker sont optimisées pour la production. En développement, privilégiez le mode natif pour le hot reload.

2. **Sécurité** : Les mots de passe par défaut sont à usage de développement uniquement. Changez-les en production.

3. **Ressources** : MongoDB avec Replica Set et les modèles ML nécessitent de la RAM. Allouez au moins 8GB à Docker.

4. **Réseau** : Tous les services communiquent via le réseau Docker `meeshy-dev-network`.

## 🆘 Support

Pour toute question ou problème :

1. Consultez les logs : `./start-dev.sh logs`
2. Vérifiez la documentation : `/docs`
3. Ouvrez une issue sur GitHub

---

**Bon développement avec Meeshy! 🚀**
