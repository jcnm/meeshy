# ✅ MongoDB Replica Set - Mise à Jour Complète

## 📋 Résumé des Modifications

J'ai mis à jour tous les scripts et configurations pour gérer correctement le **MongoDB Replica Set** nécessaire au bon fonctionnement de Meeshy.

## 🔧 Fichiers Mis à Jour

### 1. **start-dev.sh** - Script Principal ⭐
**Nouvelles fonctionnalités:**
- ✅ Fonction `init_replica_set()` qui initialise automatiquement le replica set
- ✅ Détection si le replica set est déjà initialisé
- ✅ Attente intelligente que MongoDB soit PRIMARY
- ✅ Nouvelle commande `./start-dev.sh init-replica` pour initialisation manuelle

**Workflow au démarrage:**
```bash
./start-dev.sh
# 1. Démarre tous les services
# 2. Attend que MongoDB soit prêt
# 3. Vérifie si replica set existe
# 4. L'initialise si nécessaire
# 5. Attend qu'il soit PRIMARY
# 6. Affiche les URLs d'accès
```

### 2. **check-replica-set.sh** - Outil de Diagnostic 🏥
**Nouveau script complet de vérification:**
- ✅ Vérifie que MongoDB est disponible
- ✅ Vérifie l'état du replica set
- ✅ L'initialise automatiquement si nécessaire
- ✅ Affiche toutes les informations importantes
- ✅ Teste la connexion avec replica set
- ✅ Fournit les commandes de troubleshooting

**Utilisation:**
```bash
./check-replica-set.sh
# Diagnostic complet et auto-réparation
```

### 3. **translator/start_local_dev.sh** - Développement Natif
**Mise à jour:**
```bash
# Avant
export DATABASE_URL="file:../shared/dev.db"

# Après
export DATABASE_TYPE=MONGODB
export DATABASE_URL="mongodb://localhost:27017/meeshy?replicaSet=rs0"
```

### 4. **Makefile** - Nouvelle Commande
**Ajout:**
```makefile
make init-replica  # Initialiser/vérifier le replica set
```

### 5. **MONGODB_REPLICA_SET.md** - Documentation Complète 📚
**Nouveau guide avec:**
- ✅ Explication du replica set et pourquoi il est nécessaire
- ✅ Configuration automatique et manuelle
- ✅ Vérification du statut
- ✅ URLs de connexion
- ✅ Troubleshooting complet
- ✅ Tous les états possibles du replica set
- ✅ Tests manuels
- ✅ Checklist de démarrage

## 🚀 Comment Utiliser

### Démarrage Standard (Recommandé)

```bash
# Démarrer tous les services avec auto-init du replica set
./start-dev.sh
```

Le replica set est initialisé automatiquement au démarrage!

### Vérification du Replica Set

```bash
# Option 1: Script dédié (recommandé)
./check-replica-set.sh

# Option 2: Via le script principal
./start-dev.sh init-replica

# Option 3: Via Makefile
make init-replica
```

### Développement Natif (Translator local)

```bash
# 1. Démarrer l'infrastructure
docker-compose -f docker-compose.dev.yml up database redis -d

# 2. Initialiser le replica set
./check-replica-set.sh

# 3. Démarrer le translator en mode natif
cd translator
./start_local_dev.sh
```

## 🔍 Commandes de Diagnostic

### Vérifier l'État du Replica Set

```bash
# Via script (recommandé)
./check-replica-set.sh

# Manuellement
docker exec meeshy-dev-database mongosh --eval "rs.status()"
```

### Vérifier si c'est PRIMARY

```bash
docker exec meeshy-dev-database mongosh --eval "rs.status().myState"
# Doit retourner: 1 (PRIMARY)
```

### Test de Connexion

```bash
# Depuis le conteneur
docker exec meeshy-dev-database mongosh "mongodb://database:27017/meeshy?replicaSet=rs0" --eval "db.adminCommand('ping')"

# Depuis l'hôte
docker exec meeshy-dev-database mongosh "mongodb://localhost:27017/meeshy?replicaSet=rs0" --eval "db.adminCommand('ping')"
```

## 🐛 Résolution de Problèmes

### Problème 1: Service Translator ne démarre pas

**Symptômes:**
```
Error: no primary exists currently
MongoServerError: not master
```

**Solution:**
```bash
# 1. Vérifier et initialiser le replica set
./check-replica-set.sh

# 2. Redémarrer le translator
docker restart meeshy-dev-translator
```

### Problème 2: Replica Set en état "RSGhost"

**Solution:**
```bash
# Initialiser manuellement
./start-dev.sh init-replica

# Ou via le script de vérification
./check-replica-set.sh
```

### Problème 3: Le translator prend du temps à démarrer

**C'est normal!** Le service translator charge les modèles ML (T5-small, NLLB-600M, etc.) ce qui prend **2-5 minutes** selon votre machine.

**Vérifier les logs:**
```bash
docker logs meeshy-dev-translator -f

# Vous verrez:
# 📥 Chargement basic: t5-small
# ✅ Modèle basic chargé
# 📥 Chargement medium: facebook/nllb-200-distilled-600M
# ✅ Modèle medium chargé
```

### Problème 4: Réinitialisation Complète

```bash
# 1. Tout supprimer
./start-dev.sh clean
# Confirmer avec "oui"

# 2. Redémarrer proprement
./start-dev.sh

# 3. Vérifier
./check-replica-set.sh
```

## 📊 Statut du Replica Set

### États Possibles

| Valeur | État | Description |
|--------|------|-------------|
| 1 | PRIMARY | ✅ Prêt pour lecture/écriture |
| 2 | SECONDARY | Réplication en cours |
| 0 | STARTUP | Démarrage initial |
| 5 | STARTUP2 | Initialisation du RS |
| 6 | UNKNOWN | État inconnu |

### Vérification Rapide

```bash
# État actuel
docker exec meeshy-dev-database mongosh --eval "rs.status().myState"
# Doit retourner: 1

# Nom du replica set
docker exec meeshy-dev-database mongosh --eval "rs.conf()._id"
# Doit retourner: rs0

# Membre PRIMARY
docker exec meeshy-dev-database mongosh --eval "rs.isMaster().primary"
# Doit retourner: database:27017
```

## 🌐 URLs de Connexion Correctes

### Depuis un Conteneur Docker

```env
DATABASE_URL=mongodb://database:27017/meeshy?replicaSet=rs0
```

### Depuis la Machine Hôte (localhost)

```env
DATABASE_URL=mongodb://localhost:27017/meeshy?replicaSet=rs0
```

### Important ⚠️

- ✅ **Toujours inclure** `?replicaSet=rs0`
- ✅ **Utiliser** `database` dans les conteneurs Docker
- ✅ **Utiliser** `localhost` pour le développement natif

## 🎯 Checklist de Démarrage

Avant de commencer à développer:

```bash
# 1. Démarrer les services
./start-dev.sh

# 2. Vérifier le replica set
./check-replica-set.sh

# 3. Attendre le chargement des modèles ML (2-5 min)
docker logs meeshy-dev-translator -f

# 4. Vérifier tous les services
./health-check.sh
```

## 💡 Commandes Utiles

```bash
# Logs MongoDB
docker logs meeshy-dev-database -f

# Logs Translator
docker logs meeshy-dev-translator -f

# Shell MongoDB interactif
docker exec -it meeshy-dev-database mongosh

# Statut complet des services
./start-dev.sh status

# Redémarrer un service spécifique
docker restart meeshy-dev-translator
```

## 📚 Documentation Complète

Pour plus de détails, consultez:
- **[MONGODB_REPLICA_SET.md](./MONGODB_REPLICA_SET.md)** - Guide complet du replica set
- **[DEPLOYMENT_LOCAL_DOCKER.md](./DEPLOYMENT_LOCAL_DOCKER.md)** - Guide de déploiement
- **[DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)** - Résumé de tous les fichiers

## ✅ Résumé

**Ce qui a été corrigé:**
1. ✅ Ajout de l'initialisation automatique du replica set dans `start-dev.sh`
2. ✅ Création du script `check-replica-set.sh` pour diagnostic
3. ✅ Mise à jour de `translator/start_local_dev.sh` avec la bonne URL MongoDB
4. ✅ Ajout de la commande `make init-replica`
5. ✅ Documentation complète dans `MONGODB_REPLICA_SET.md`

**Ce qui fonctionne maintenant:**
- ✅ Le replica set est initialisé automatiquement au démarrage
- ✅ Les services se connectent correctement à MongoDB
- ✅ Le développement natif (translator local) fonctionne
- ✅ Outils de diagnostic et auto-réparation disponibles

**Note importante:**
Le service **translator prend 2-5 minutes à démarrer** car il charge les modèles ML. C'est **normal** et attendu. Soyez patient! 🚀

---

**Utilisez `./check-replica-set.sh` pour tout problème de replica set!** 🎯
