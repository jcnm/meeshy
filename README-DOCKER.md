# 🐳 Meeshy Docker - Guide d'utilisation

Ce guide explique comment utiliser Meeshy avec Docker dans différents modes de déploiement.

## 📋 Prérequis

- Docker et Docker Compose installés
- Au moins 4GB de RAM disponible
- Connexion Internet pour télécharger les modèles de traduction

## 🚀 Modes de déploiement

### 1. Mode Tout Interne (Recommandé pour le développement)

Meeshy avec PostgreSQL et Redis inclus dans le même conteneur.

```bash
# Démarrer en mode tout interne
./run-internal.sh
```

**Avantages :**
- ✅ Simple à utiliser
- ✅ Un seul conteneur
- ✅ Parfait pour le développement
- ✅ Pas de configuration externe

**Ports exposés :**
- Frontend: http://localhost:3100
- Gateway: http://localhost:3000
- Translator: http://localhost:8000

### 2. Mode Externe (Recommandé pour la production)

Meeshy avec PostgreSQL et Redis dans des conteneurs séparés.

```bash
# Démarrer avec bases de données externes
docker-compose -f docker-compose.external.yml up -d
```

**Avantages :**
- ✅ Séparation des responsabilités
- ✅ Scalabilité des bases de données
- ✅ Persistance des données
- ✅ Gestion indépendante des services

**Services :**
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- Frontend: http://localhost:3100
- Gateway: http://localhost:3000
- Translator: http://localhost:8000

### 3. Mode Hybride

Utiliser des bases de données externes avec le script de démarrage.

```bash
# Démarrer avec des bases de données externes existantes
./start-meeshy-docker.sh --external-db --env-file env.docker.external
```

## 🧪 Tests automatisés

### Test de tous les modes

```bash
# Test interactif
./test-all-modes.sh

# Test du mode interne uniquement
./test-all-modes.sh internal

# Test du mode externe uniquement
./test-all-modes.sh external

# Test complet (les deux modes)
./test-all-modes.sh all
```

### Test des services

```bash
# Test des services en cours d'exécution
./test-services.sh
```

## 🔧 Configuration

### Variables d'environnement

Le fichier `env.docker` contient toutes les variables de configuration :

```bash
# Mode de base de données
USE_EXTERNAL_DB=false          # true pour utiliser des DB externes
START_POSTGRES=true           # false pour désactiver PostgreSQL interne
START_REDIS=true              # false pour désactiver Redis interne

# Configuration PostgreSQL
POSTGRES_DB=meeshy
POSTGRES_USER=meeshy
POSTGRES_PASSWORD=MeeshyP@ssword
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Configuration Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# URLs de base de données
DATABASE_URL=postgresql://meeshy:MeeshyP@ssword@localhost:5432/meeshy
REDIS_URL=redis://localhost:6379
```

### Personnalisation

Pour personnaliser la configuration :

1. **Mode interne** : Modifier `env.docker`
2. **Mode externe** : Modifier `docker-compose.external.yml`
3. **Mode hybride** : Créer un fichier d'environnement personnalisé

## 🛠️ Scripts disponibles

| Script | Description |
|--------|-------------|
| `run-internal.sh` | Démarrage en mode tout interne |
| `start-meeshy-docker.sh` | Démarrage avec options configurables |
| `test-all-modes.sh` | Tests automatisés de tous les modes |
| `test-services.sh` | Test des services en cours d'exécution |
| `start-with-external-db.sh` | Démarrage avec DB externes (déprécié) |

## 🔍 Dépannage

### Problèmes courants

1. **Ports déjà utilisés**
   ```bash
   # Vérifier les ports utilisés
   lsof -i :3100 -i :3000 -i :8000 -i :5432 -i :6379
   
   # Arrêter les services existants
   docker-compose -f docker-compose.external.yml down
   ```

2. **Services qui ne démarrent pas**
   ```bash
   # Vérifier les logs
   docker logs meeshy-app
   
   # Redémarrer les services
   docker-compose -f docker-compose.external.yml restart
   ```

3. **Problèmes de permissions**
   ```bash
   # Vérifier les permissions des scripts
   chmod +x *.sh
   ```

### Logs des services

```bash
# Logs du conteneur principal
docker logs meeshy-app

# Logs des services externes
docker logs meeshy-postgres
docker logs meeshy-redis

# Logs des services internes (dans le conteneur)
docker exec meeshy-app cat /app/logs/translator.log
docker exec meeshy-app cat /app/logs/gateway.log
docker exec meeshy-app cat /app/logs/frontend.log
```

## 📊 Monitoring

### Vérification de la santé des services

```bash
# Frontend
curl http://localhost:3100

# Gateway
curl http://localhost:3000/health

# Translator
curl http://localhost:8000/health

# Test de traduction
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "source_lang": "en", "target_lang": "fr"}'
```

## 🚀 Production

Pour la production, il est recommandé d'utiliser le mode externe avec :

1. **Volumes persistants** pour les bases de données
2. **Variables d'environnement sécurisées**
3. **Reverse proxy** (Nginx/Traefik)
4. **Monitoring** (Prometheus/Grafana)
5. **Logs centralisés** (ELK Stack)

## 📝 Notes importantes

- Les modèles de traduction sont téléchargés automatiquement au premier démarrage
- Le premier démarrage peut prendre plusieurs minutes
- Les données PostgreSQL et Redis sont persistées dans des volumes Docker
- Le conteneur utilise Supervisor pour gérer les processus internes
