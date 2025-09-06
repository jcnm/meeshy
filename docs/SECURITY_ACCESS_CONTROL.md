# Contrôle d'Accès Sécurisé - Meeshy

## Vue d'ensemble

Ce document décrit la configuration de sécurité pour l'accès aux interfaces d'administration de Meeshy via Traefik avec authentification HTTP Basic.

## Services Sécurisés

### 1. Traefik Dashboard
- **URL**: `https://traefik.meeshy.me`
- **Authentification**: Variable `TRAEFIK_USERS`
- **Usage**: Interface d'administration Traefik pour la gestion des routes et certificats SSL

### 2. MongoDB Interface (NoSQL Client)
- **URL**: `https://mongo.meeshy.me`
- **Authentification**: Variable `MONGO_USERS`
- **Usage**: Interface web pour administrer MongoDB
- **Nouveau**: Sécurisé avec authentification HTTP Basic

### 3. Redis Interface (P3X Redis UI)
- **URL**: `https://redis.meeshy.me`
- **Authentification**: Variable `REDIS_USERS`
- **Usage**: Interface web pour administrer Redis
- **Nouveau**: Sécurisé avec authentification HTTP Basic

## Services API Publics

Ces services restent publics car ils sont utilisés par l'application frontend :

### 1. Gateway API
- **URL**: `https://gate.meeshy.me`
- **Authentification**: Authentification applicative (tokens)
- **Usage**: API principale de l'application

### 2. Translator Service
- **URL**: `https://ml.meeshy.me`
- **Authentification**: Authentification applicative (tokens)
- **Usage**: Service de traduction ML

### 3. Frontend
- **URL**: `https://meeshy.me`
- **Authentification**: Aucune (accès public)
- **Usage**: Interface utilisateur principale

## Configuration des Variables d'Authentification

Dans le fichier `.env`, configurez les utilisateurs pour chaque service :

```bash
# Authentification Traefik Dashboard
TRAEFIK_USERS=admin:$$2y$$05$$68mdMKVZcGuuU55m.AMTU.TBcTsX0cLJVt33a6e7xU.CYOPN/YD2i

# Authentification MongoDB Interface
MONGO_USERS=admin:$$2y$$05$$z6ZkQkKYgXgKwOYn8gFxdO6KJ2FiMwMsDYdyADsPY.06MZdIChJBC

# Authentification Redis Interface
REDIS_USERS=admin:$$2y$$05$$z6ZkQkKYgXgKwOYn8gFxdO6KJ2FiMwMsDYdyADsPY.06MZdIChJBC
```

## Génération des Hash de Mots de Passe

Pour générer des hash de mots de passe compatibles avec Traefik :

```bash
# Installation d'apache2-utils (contient htpasswd)
sudo apt-get install apache2-utils

# Génération d'un hash bcrypt pour un utilisateur
htpasswd -nB username
```

**Note importante**: Dans Docker Compose, les caractères `$` doivent être échappés avec `$$`.

## Middleware Traefik

Les middlewares suivants sont configurés dans `docker-compose.traefik.yml` :

1. **traefik-auth**: Pour le dashboard Traefik
2. **mongo-auth**: Pour l'interface MongoDB
3. **redis-auth**: Pour l'interface Redis

## Exemple de Configuration Traefik

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.service.rule=Host(`service.domain.com`)"
  - "traefik.http.routers.service.middlewares=service-auth"
  - "traefik.http.middlewares.service-auth.basicauth.users=${SERVICE_USERS}"
```

## Sécurité Additionnelle

### Recommandations

1. **Mots de passe forts**: Utilisez des mots de passe complexes
2. **Rotation régulière**: Changez les mots de passe régulièrement
3. **Accès restreint**: Limitez l'accès aux adresses IP de confiance si possible
4. **Surveillance**: Activez les logs d'accès Traefik pour surveiller les tentatives de connexion

### Limitations par IP (Optionnel)

Pour restreindre l'accès par IP, ajoutez un middleware IP allowlist :

```yaml
labels:
  - "traefik.http.middlewares.admin-ipallowlist.ipallowlist.sourcerange=192.168.1.0/24,10.0.0.0/8"
  - "traefik.http.routers.service.middlewares=admin-ipallowlist,service-auth"
```

## Dépannage

### Problèmes d'Authentification

1. Vérifiez que les variables d'environnement sont correctement définies
2. Assurez-vous que les caractères `$` sont échappés (`$$`)
3. Redémarrez les services après modification des variables

### Test d'Accès

```bash
# Test avec curl
curl -u username:password https://mongo.meeshy.me
curl -u username:password https://redis.meeshy.me
curl -u username:password https://traefik.meeshy.me
```

## Logs et Monitoring

Pour surveiller les accès :

```bash
# Logs Traefik
docker logs meeshy-traefik

# Logs d'accès en temps réel
docker logs -f meeshy-traefik | grep "mongo\|redis\|traefik"
```
