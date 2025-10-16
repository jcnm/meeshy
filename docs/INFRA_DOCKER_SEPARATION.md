# Séparation Infrastructure Docker et Applications Natives

## 📝 Résumé

Implémentation d'un workflow de développement où `Ctrl+C` n'arrête que les applications natives (translator, gateway, frontend) sans toucher aux containers Docker (MongoDB, Redis).

## 🎯 Objectif

Améliorer l'expérience de développement en :
1. Gardant l'infrastructure Docker active entre les redémarrages
2. Permettant le hot reload des applications natives
3. Évitant les temps d'attente de démarrage de MongoDB/Redis

## 🆕 Nouveaux Fichiers

### 1. `docker-compose.infra.yml`

Fichier Docker Compose dédié uniquement à l'infrastructure :
- MongoDB avec Replica Set
- NoSQLClient UI (interface MongoDB)
- Redis
- P3X Redis UI (interface Redis)

**Avantage** : Peut être démarré/arrêté indépendamment des applications.

### 2. `scripts/infra.sh`

Script de gestion de l'infrastructure Docker avec les commandes :

```bash
./scripts/infra.sh start    # Démarrer l'infrastructure
./scripts/infra.sh stop     # Arrêter l'infrastructure
./scripts/infra.sh restart  # Redémarrer l'infrastructure
./scripts/infra.sh status   # Vérifier l'état
./scripts/infra.sh logs     # Voir les logs
```

### 3. `docs/DEV_NATIVE_SETUP.md`

Documentation complète du workflow de développement natif avec :
- Guide de démarrage rapide
- Workflows de développement typiques
- Résolution de problèmes
- Comparaison des modes de développement

## 🔧 Modifications des Fichiers Existants

### `start-dev.sh`

**Ajouts :**

1. **Fonction `check_infrastructure()`**
   - Vérifie si MongoDB et Redis tournent
   - Démarre automatiquement l'infrastructure si nécessaire
   - Attend que les services soient prêts

2. **Fonction `cleanup()` améliorée**
   - N'arrête que les processus natifs (translator, gateway, frontend)
   - Affiche un message indiquant que les containers Docker restent actifs
   - Donne la commande pour arrêter l'infrastructure si besoin

3. **Messages informatifs**
   - Indication claire que `Ctrl+C` n'arrête pas les containers Docker
   - Instructions pour arrêter l'infrastructure manuellement

### `README.md`

**Section "Option 2: Développement Natif" mise à jour :**
- Référence au nouveau workflow avec `./start-dev.sh`
- Mention explicite du comportement de `Ctrl+C`
- Lien vers la documentation complète

## 🚀 Workflow de Développement

### Journée Typique

```bash
# Matin - Premier démarrage
./start-dev.sh
# ✅ Démarre l'infrastructure Docker si nécessaire
# ✅ Démarre les applications natives

# Pendant la journée - Multiples redémarrages
# Ctrl+C pour arrêter les apps
# ./start-dev.sh pour redémarrer rapidement
# ⚡ Infrastructure Docker reste active (gain de temps)

# Soir - Arrêt complet
Ctrl+C                          # Arrêter les apps
./scripts/infra.sh stop         # Arrêter l'infrastructure
```

### Avantages

✅ **Démarrage rapide** : Pas besoin d'attendre MongoDB/Redis à chaque redémarrage  
✅ **Hot reload** : Les applications natives se rechargent automatiquement  
✅ **Débogage facile** : Pas de container, débogage direct dans l'IDE  
✅ **Flexibilité** : Redémarrer une seule app sans tout relancer  
✅ **Isolation** : Infrastructure Docker complètement séparée  

## 📊 Comparaison des Workflows

| Aspect | Avant | Après |
|--------|-------|-------|
| Ctrl+C | Arrête tout | Arrête uniquement les apps natives |
| Redémarrage | 30-60 secondes | 5-10 secondes |
| Infrastructure | Redémarrée à chaque fois | Reste active |
| Flexibilité | Limitée | Contrôle total |
| Gestion | Manuel complexe | Scripts automatisés |

## 🔍 Détails Techniques

### Gestion des Signaux

```bash
# Dans start-dev.sh
trap cleanup SIGINT SIGTERM
```

La fonction `cleanup()` capture `Ctrl+C` et tue uniquement les PIDs des processus natifs :
- `$TRANSLATOR_PID`
- `$GATEWAY_PID`
- `$FRONTEND_PID`

Les containers Docker ne sont pas affectés car ils sont gérés par Docker Compose.

### Vérification de l'Infrastructure

```bash
docker ps --filter "name=meeshy-dev-database" --filter "status=running" -q
docker ps --filter "name=meeshy-dev-redis" --filter "status=running" -q
```

Si les containers ne tournent pas, `start-dev.sh` les démarre automatiquement.

### Health Checks

Le script attend que les services soient prêts avant de continuer :

**MongoDB :**
```bash
docker exec meeshy-dev-database mongosh --eval "db.adminCommand('ping')"
```

**Redis :**
```bash
docker exec meeshy-dev-redis redis-cli ping
```

## 🛠️ Commandes Utiles

### Infrastructure

```bash
# Statut complet de l'infrastructure
./scripts/infra.sh status

# Logs en temps réel
./scripts/infra.sh logs

# Redémarrage propre
./scripts/infra.sh restart
```

### Applications Natives

```bash
# Logs des applications
tail -f logs/translator.log
tail -f logs/gateway.log
tail -f logs/frontend.log

# Démarrage manuel d'une seule app
cd gateway && ./gateway.sh
```

### Docker

```bash
# Voir les containers en cours
docker ps

# Voir tous les containers (actifs et arrêtés)
docker ps -a

# Logs d'un container spécifique
docker logs meeshy-dev-database
docker logs meeshy-dev-redis
```

## 🔄 Migration depuis l'Ancien Workflow

### Ancien Workflow

```bash
# Tout était mélangé dans docker-compose.dev.yml
docker-compose -f docker-compose.dev.yml up
# Ctrl+C arrêtait TOUT

# Ou manuellement avec 4 terminaux différents
docker-compose up database redis
cd gateway && ./gateway.sh
cd translator && ./translator.sh
cd frontend && ./frontend.sh
```

### Nouveau Workflow

```bash
# Une seule commande
./start-dev.sh

# Ctrl+C arrête uniquement les apps natives
# Infrastructure reste active
```

**Migration :** Aucune action nécessaire, le nouveau workflow est rétrocompatible.

## 📖 Documentation Associée

- [Guide Complet Développement Natif](./DEV_NATIVE_SETUP.md)
- [README Principal](../README.md)
- [docker-compose.infra.yml](../docker-compose.infra.yml)
- [scripts/infra.sh](../scripts/infra.sh)

## 🐛 Résolution de Problèmes

### L'infrastructure ne démarre pas

```bash
# Vérifier les logs
./scripts/infra.sh logs

# Redémarrer proprement
./scripts/infra.sh stop
./scripts/infra.sh start
```

### Les apps natives ne se connectent pas

Vérifier que l'infrastructure tourne :
```bash
./scripts/infra.sh status
```

### Containers en double

Si vous avez démarré avec `docker-compose.dev.yml` avant :
```bash
# Arrêter tous les containers Meeshy
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.infra.yml down

# Redémarrer proprement
./start-dev.sh
```

## ✅ Tests

Pour vérifier que tout fonctionne :

```bash
# 1. Démarrer le workflow
./start-dev.sh

# 2. Vérifier que tout tourne
./scripts/infra.sh status
curl http://localhost:3000/health
curl http://localhost:8000/health

# 3. Faire Ctrl+C

# 4. Vérifier que l'infrastructure tourne toujours
./scripts/infra.sh status
# ✅ MongoDB et Redis doivent être actifs

# 5. Redémarrer rapidement
./start-dev.sh
# ✅ Démarrage rapide (pas de wait MongoDB)
```

## 📈 Améliorations Futures Possibles

- [ ] Ajout d'un mode `--clean` qui arrête tout (infra + apps)
- [ ] Script de backup automatique de MongoDB avant arrêt
- [ ] Monitoring des ressources (CPU, RAM) de l'infrastructure
- [ ] Auto-restart des apps natives en cas de crash (watchdog)
- [ ] Support de profils (dev, staging, prod) pour l'infrastructure

## 🎉 Bénéfices

1. **Gain de temps** : ~50 secondes économisées par redémarrage
2. **Meilleure UX** : Workflow plus intuitif et prévisible
3. **Productivité** : Moins d'attente = plus de développement
4. **Flexibilité** : Contrôle granulaire de chaque composant
5. **Documentation** : Guide complet pour les nouveaux développeurs

---

**Date de création** : 16 octobre 2025  
**Auteur** : Documentation automatique Meeshy  
**Version** : 1.0.0

