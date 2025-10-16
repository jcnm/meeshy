# Guide de Développement Natif - Meeshy

Ce guide explique comment développer Meeshy avec les applications natives (translator, gateway, frontend) tout en utilisant l'infrastructure Docker (MongoDB, Redis).

## Architecture

- **Infrastructure Docker** : MongoDB, Redis, NoSQLClient UI, P3X Redis UI
- **Applications Natives** : Translator (Python), Gateway (Node.js), Frontend (Next.js)

### Avantages

- ✅ Rechargement à chaud (hot reload) pour le développement
- ✅ Débogage facile dans l'IDE
- ✅ Performance optimale pour les services natives
- ✅ Infrastructure isolée dans Docker
- ✅ Ctrl+C n'arrête que les applications, pas les bases de données

## Prérequis

- Docker et Docker Compose
- Node.js 22+
- Python 3.12+
- pnpm (pour Node.js)

## Démarrage Rapide

### 1. Démarrage Complet (Recommandé)

```bash
# Tout en une commande
./start-dev.sh
```

Ce script va automatiquement :
1. Vérifier et démarrer l'infrastructure Docker si nécessaire
2. Démarrer les services natifs (translator, gateway, frontend)
3. Afficher les URLs d'accès

**Important** : Quand vous appuyez sur `Ctrl+C`, seules les applications natives s'arrêtent. Les containers Docker (MongoDB, Redis) restent actifs.

### 2. Gestion de l'Infrastructure Séparément

Si vous voulez plus de contrôle sur l'infrastructure Docker :

```bash
# Démarrer uniquement l'infrastructure
./scripts/infra.sh start

# Vérifier l'état de l'infrastructure
./scripts/infra.sh status

# Voir les logs de l'infrastructure
./scripts/infra.sh logs

# Arrêter l'infrastructure (quand vous avez terminé)
./scripts/infra.sh stop

# Redémarrer l'infrastructure
./scripts/infra.sh restart
```

### 3. Démarrage Manuel des Services

Si vous préférez démarrer les services un par un :

```bash
# 1. Démarrer l'infrastructure
./scripts/infra.sh start

# 2. Démarrer le translator (dans un terminal)
cd translator
./translator.sh

# 3. Démarrer le gateway (dans un autre terminal)
cd gateway
./gateway.sh

# 4. Démarrer le frontend (dans un troisième terminal)
cd frontend
./frontend.sh
```

## URLs d'Accès

### Applications

- **Frontend** : http://localhost:3100
- **Gateway API** : http://localhost:3000
- **Translator API** : http://localhost:8000

### Infrastructure

- **MongoDB** : mongodb://localhost:27017
- **NoSQLClient UI** : http://localhost:3001 (Interface MongoDB)
- **Redis** : redis://localhost:6379
- **P3X Redis UI** : http://localhost:7843 (Interface Redis)

## Logs

Les logs des applications natives sont disponibles dans le dossier `logs/` :

```bash
# Voir les logs en temps réel
tail -f logs/translator.log
tail -f logs/gateway.log
tail -f logs/frontend.log

# Voir les logs de l'infrastructure
./scripts/infra.sh logs
```

## Arrêt des Services

### Arrêter les Applications Natives

```bash
# Si lancées via start-dev.sh
Ctrl+C dans le terminal du script

# Si lancées manuellement
Ctrl+C dans chaque terminal
```

**Note** : Les containers Docker restent actifs !

### Arrêter l'Infrastructure Docker

```bash
# Quand vous avez vraiment terminé
./scripts/infra.sh stop

# Ou avec docker-compose directement
docker-compose -f docker-compose.infra.yml down
```

## Workflow de Développement Typique

### Journée de Travail

```bash
# Matin - Premier démarrage
./start-dev.sh

# Pendant la journée - Redémarrages multiples
# Ctrl+C pour arrêter les apps
# ./start-dev.sh pour redémarrer
# Les containers Docker restent actifs toute la journée

# Soir - Arrêt complet
Ctrl+C                          # Arrêter les apps natives
./scripts/infra.sh stop         # Arrêter l'infrastructure
```

### Débogage d'un Service Spécifique

```bash
# 1. S'assurer que l'infrastructure tourne
./scripts/infra.sh status

# 2. Arrêter le service à déboguer (ex: gateway)
# Ctrl+C dans son terminal

# 3. Lancer le service avec votre débogueur IDE
# Ou relancer manuellement avec des logs supplémentaires
cd gateway
DEBUG=* ./gateway.sh
```

## Résolution de Problèmes

### L'infrastructure ne démarre pas

```bash
# Vérifier Docker
docker ps

# Voir les logs d'infrastructure
./scripts/infra.sh logs

# Nettoyer et redémarrer
./scripts/infra.sh restart
```

### MongoDB n'est pas prêt

```bash
# Vérifier la connexion MongoDB
docker exec meeshy-dev-database mongosh --eval "db.adminCommand('ping')"

# Vérifier les logs MongoDB
docker logs meeshy-dev-database
```

### Redis ne répond pas

```bash
# Vérifier la connexion Redis
docker exec meeshy-dev-redis redis-cli ping

# Vérifier les logs Redis
docker logs meeshy-dev-redis
```

### Les services natifs ne se connectent pas à l'infrastructure

Vérifiez que les variables d'environnement dans les scripts pointent vers `localhost`:
- MongoDB : `mongodb://localhost:27017`
- Redis : `redis://localhost:6379`

## Comparaison avec le Mode Docker Complet

### Mode Natif (Ce Guide)

✅ Hot reload instantané  
✅ Débogage facile  
✅ Performance optimale  
✅ Ctrl+C n'arrête pas les DB  
❌ Nécessite installation locale des dépendances  

### Mode Docker Complet

✅ Environnement isolé  
✅ Pas d'installation locale  
✅ Proche de la production  
❌ Pas de hot reload  
❌ Débogage plus complexe  

Pour utiliser le mode Docker complet :

```bash
docker-compose -f docker-compose.dev.yml up -d
```

## Scripts Utiles

| Script | Description |
|--------|-------------|
| `./start-dev.sh` | Démarre tout (infra + apps natives) |
| `./scripts/infra.sh start` | Démarre uniquement l'infrastructure |
| `./scripts/infra.sh status` | État de l'infrastructure |
| `./scripts/infra.sh stop` | Arrête l'infrastructure |
| `./scripts/infra.sh logs` | Logs de l'infrastructure |

## Support

Pour plus d'informations :
- Documentation principale : [README.md](../README.md)
- Docker Compose complet : [docker-compose.dev.yml](../docker-compose.dev.yml)
- Infrastructure Docker : [docker-compose.infra.yml](../docker-compose.infra.yml)

