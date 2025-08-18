# 🚀 Mode Développement Meeshy

Ce guide explique comment utiliser Meeshy en mode développement avec Docker pour un développement rapide et efficace.

## 🎯 Avantages du Mode Développement

- **Hot Reload** : Les modifications du code source sont prises en compte automatiquement
- **Pas de rebuild** : Pas besoin de reconstruire l'image Docker à chaque modification
- **Environnement isolé** : Base de données et services séparés du système hôte
- **Développement rapide** : Démarrage rapide et configuration automatique

## 📋 Prérequis

- Docker
- Docker Compose
- Git

## 🚀 Démarrage Rapide

### 1. Démarrer le mode développement

```bash
./start-dev.sh
```

Cette commande va :
- Construire l'image de développement
- Démarrer PostgreSQL et Redis
- Démarrer tous les services Meeshy
- Monter le code source en volume pour le hot reload

### 2. Accéder aux services

Une fois démarré, vous pouvez accéder à :

- **Frontend** : http://localhost:3100
- **Gateway** : http://localhost:3000
- **Translator** : http://localhost:8000
- **PostgreSQL** : localhost:5432
- **Redis** : localhost:6379

### 3. Arrêter le mode développement

```bash
./stop-dev.sh
```

## 🔧 Commandes Utiles

### Voir les logs en temps réel
```bash
docker-compose -f docker-compose.dev.yml logs -f
```

### Voir les logs d'un service spécifique
```bash
docker-compose -f docker-compose.dev.yml logs -f meeshy-dev
```

### Accéder au conteneur de développement
```bash
docker exec -it meeshy-dev bash
```

### Redémarrer un service
```bash
docker-compose -f docker-compose.dev.yml restart meeshy-dev
```

### Reconstruire l'image
```bash
docker-compose -f docker-compose.dev.yml build --no-cache
```

## 📁 Structure des Volumes

Le mode développement monte les répertoires suivants :

```
./frontend     → /app/frontend     (code source)
./gateway      → /app/gateway      (code source)
./translator   → /app/translator   (code source)
./shared       → /app/shared       (code source)
./scripts      → /app/scripts      (scripts)
./docker       → /app/docker       (configurations)
./logs         → /app/logs         (logs)
./data         → /app/data         (données)
```

## 🔄 Hot Reload

### Frontend (Next.js)
- Les modifications dans `./frontend/` sont automatiquement détectées
- Le serveur de développement redémarre automatiquement

### Gateway (Node.js)
- Les modifications dans `./gateway/` sont automatiquement détectées
- Le serveur redémarre automatiquement grâce à `tsx`

### Translator (Python)
- Les modifications dans `./translator/` sont automatiquement détectées
- Le serveur redémarre automatiquement

## 🗄️ Base de Données

### PostgreSQL
- **Host** : `postgres` (dans le réseau Docker)
- **Port** : `5432`
- **Base** : `meeshy`
- **Utilisateur** : `meeshy`
- **Mot de passe** : `MeeshyP@ssword`

### Redis
- **Host** : `redis` (dans le réseau Docker)
- **Port** : `6379`
- **Base** : `0`

## 🔍 Débogage

### Voir les logs d'un service spécifique
```bash
# Logs du Translator
docker exec meeshy-dev tail -f /app/logs/translator.log

# Logs du Gateway
docker exec meeshy-dev tail -f /app/logs/gateway.log

# Logs du Frontend
docker exec meeshy-dev tail -f /app/logs/frontend.log
```

### Accéder à la base de données
```bash
# Se connecter à PostgreSQL
docker exec -it meeshy-postgres-dev psql -U meeshy -d meeshy

# Se connecter à Redis
docker exec -it meeshy-redis-dev redis-cli
```

### Vérifier les processus
```bash
# Voir les processus dans le conteneur
docker exec meeshy-dev ps aux

# Voir les PIDs des services
docker exec meeshy-dev ls -la /app/logs/*.pid
```

## 🛠️ Configuration

### Variables d'environnement
Les variables d'environnement sont définies dans :
- `env.docker` : Configuration générale
- `docker-compose.dev.yml` : Configuration spécifique au développement

### Personnalisation
Vous pouvez modifier :
- `docker-compose.dev.yml` : Configuration des services
- `Dockerfile.dev` : Image de développement
- `scripts/start-dev.sh` : Script de démarrage

## 🚨 Dépannage

### Service ne démarre pas
1. Vérifiez les logs : `docker-compose -f docker-compose.dev.yml logs`
2. Vérifiez les ports : assurez-vous qu'ils ne sont pas utilisés
3. Reconstruisez l'image : `docker-compose -f docker-compose.dev.yml build --no-cache`

### Hot reload ne fonctionne pas
1. Vérifiez que les volumes sont bien montés : `docker inspect meeshy-dev`
2. Redémarrez le service : `docker-compose -f docker-compose.dev.yml restart meeshy-dev`

### Problème de permissions
1. Vérifiez les permissions des fichiers : `ls -la`
2. Modifiez les permissions si nécessaire : `chmod -R 755 .`

## 📚 Ressources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Development](https://nextjs.org/docs/development)
- [FastAPI Development](https://fastapi.tiangolo.com/tutorial/)
- [Prisma Development](https://www.prisma.io/docs/guides/development-and-testing)

## 🤝 Contribution

Pour contribuer au développement :

1. Clonez le repository
2. Lancez le mode développement : `./start-dev.sh`
3. Faites vos modifications
4. Testez vos changements
5. Committez et poussez vos modifications

Le hot reload vous permettra de voir vos modifications en temps réel !
