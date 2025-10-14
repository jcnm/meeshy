# 🔧 MongoDB Replica Set - Configuration et Troubleshooting

## 📋 Vue d'ensemble

Meeshy utilise MongoDB avec un **Replica Set** pour plusieurs raisons importantes:

1. **Change Streams** - Nécessaire pour la synchronisation temps réel
2. **Transactions** - Support des transactions ACID multi-documents
3. **Haute Disponibilité** - Préparation pour la production
4. **Cohérence des Données** - Garanties de lecture/écriture

## 🚀 Configuration Automatique

Le replica set est **automatiquement initialisé** au démarrage:

```bash
./start-dev.sh
```

Le script détecte si le replica set est déjà configuré et l'initialise si nécessaire.

## ✅ Vérification du Replica Set

### Méthode 1: Script de Vérification (Recommandé)

```bash
./check-replica-set.sh
```

Ce script va:
- ✅ Vérifier que MongoDB est disponible
- ✅ Vérifier l'état du replica set
- ✅ L'initialiser si nécessaire
- ✅ Afficher les informations de connexion
- ✅ Tester la connexion

### Méthode 2: Commande Makefile

```bash
make init-replica
```

### Méthode 3: Commande start-dev.sh

```bash
./start-dev.sh init-replica
```

### Méthode 4: Manuellement avec Docker

```bash
# Vérifier le statut
docker exec meeshy-dev-database mongosh --eval "rs.status()"

# Initialiser manuellement
docker exec meeshy-dev-database mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'database:27017'}]})"
```

## 🔍 États du Replica Set

| État | Valeur | Description |
|------|--------|-------------|
| PRIMARY | 1 | Membre principal (lecture/écriture) |
| SECONDARY | 2 | Membre secondaire (lecture seule) |
| RECOVERING | 3 | En cours de récupération |
| STARTUP | 0 | Démarrage en cours |
| STARTUP2 | 5 | Initialisation du replica set |
| UNKNOWN | 6 | État inconnu |
| ARBITER | 7 | Arbitre (ne stocke pas de données) |
| DOWN | 8 | Membre hors ligne |
| ROLLBACK | 9 | Rollback en cours |
| REMOVED | 10 | Retiré du replica set |

Pour le développement local, vous devriez avoir **PRIMARY (1)**.

## 🌐 URLs de Connexion

### Depuis un Conteneur Docker

```
mongodb://database:27017/meeshy?replicaSet=rs0
```

### Depuis la Machine Hôte (localhost)

```
mongodb://localhost:27017/meeshy?replicaSet=rs0
```

### Variables d'Environnement

**Dans `.env.dev`:**
```env
DATABASE_TYPE=MONGODB
DATABASE_URL=mongodb://database:27017/meeshy?replicaSet=rs0
```

**Pour le développement natif (translator/start_local_dev.sh):**
```bash
export DATABASE_TYPE=MONGODB
export DATABASE_URL="mongodb://localhost:27017/meeshy?replicaSet=rs0"
```

## 🐛 Troubleshooting

### Problème: "MongoServerError: no primary available"

**Symptômes:**
```
MongoServerError: no primary available for write
```

**Solution:**
```bash
# 1. Vérifier l'état du replica set
./check-replica-set.sh

# 2. Si nécessaire, réinitialiser
docker exec meeshy-dev-database mongosh --eval "rs.reconfig({_id: 'rs0', members: [{_id: 0, host: 'database:27017'}]}, {force: true})"

# 3. Redémarrer le conteneur
docker restart meeshy-dev-database

# 4. Réinitialiser le replica set
./start-dev.sh init-replica
```

### Problème: "not master and slaveOk=false"

**Symptômes:**
```
MongoServerError: not master and slaveOk=false
```

**Cause:** Le replica set n'a pas de PRIMARY.

**Solution:**
```bash
# Vérifier l'état
docker exec meeshy-dev-database mongosh --eval "rs.status()"

# Forcer la reconfiguration
docker exec meeshy-dev-database mongosh --eval "rs.reconfig({_id: 'rs0', members: [{_id: 0, host: 'database:27017'}]}, {force: true})"

# Attendre quelques secondes
sleep 5

# Vérifier à nouveau
./check-replica-set.sh
```

### Problème: "Collection [local.oplog.rs] not found"

**Symptômes:**
```
Collection [local.oplog.rs] not found. This is normal for...
```

**Cause:** MongoDB n'est pas démarré en mode replica set.

**Solution:**
```bash
# Vérifier la commande MongoDB dans docker-compose.dev.yml
# Elle DOIT contenir: mongod --replSet rs0 --bind_ip_all --noauth

# Arrêter et nettoyer
docker-compose -f docker-compose.dev.yml down -v

# Redémarrer
./start-dev.sh
```

### Problème: "RSGhost" au lieu de "PRIMARY"

**Symptômes:**
```
Topology Description {
  type: 'ReplicaSetNoPrimary',
  servers: Map {
    'database:27017' => {
      type: 'RSGhost',
```

**Cause:** Le replica set n'est pas initialisé.

**Solution:**
```bash
# Initialiser le replica set
./start-dev.sh init-replica

# Ou manuellement
docker exec meeshy-dev-database mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'database:27017'}]})"
```

### Problème: Services ne peuvent pas se connecter

**Symptômes:**
```
Error connecting to MongoDB: getaddrinfo ENOTFOUND database
```

**Cause:** Utilisation du mauvais hostname dans l'URL.

**Solution:**

**Dans Docker (services dans conteneurs):**
```env
DATABASE_URL=mongodb://database:27017/meeshy?replicaSet=rs0
```

**En mode natif (service sur l'hôte):**
```env
DATABASE_URL=mongodb://localhost:27017/meeshy?replicaSet=rs0
```

### Problème: Le replica set prend du temps à s'initialiser

**Symptômes:**
Le service translator démarre avant que le replica set soit prêt.

**Solution:**

**Option 1: Attendre et redémarrer**
```bash
# Attendre 30 secondes
sleep 30

# Redémarrer translator
docker restart meeshy-dev-translator
```

**Option 2: Utiliser depends_on avec condition**
Dans `docker-compose.dev.yml`, on utilise déjà:
```yaml
translator:
  depends_on:
    database:
      condition: service_healthy
```

Le healthcheck attend que MongoDB réponde, mais le replica set peut prendre quelques secondes de plus.

## 🔄 Réinitialisation Complète

Si vous avez des problèmes persistants:

```bash
# 1. Arrêter et nettoyer TOUT
./start-dev.sh clean
# Confirmer avec "oui"

# 2. Redémarrer proprement
./start-dev.sh

# 3. Vérifier le replica set
./check-replica-set.sh

# 4. Tester la connexion
docker exec meeshy-dev-database mongosh "mongodb://database:27017/meeshy?replicaSet=rs0" --eval "db.adminCommand('ping')"
```

## 🧪 Tests Manuels

### Test 1: Connexion Simple

```bash
docker exec meeshy-dev-database mongosh --eval "db.adminCommand('ping')"
```

**Résultat attendu:**
```javascript
{ ok: 1 }
```

### Test 2: Statut du Replica Set

```bash
docker exec meeshy-dev-database mongosh --eval "rs.status()"
```

**Résultat attendu:**
```javascript
{
  set: 'rs0',
  myState: 1,  // PRIMARY
  members: [
    {
      _id: 0,
      name: 'database:27017',
      health: 1,
      state: 1,
      stateStr: 'PRIMARY',
      ...
    }
  ],
  ok: 1
}
```

### Test 3: Connexion avec Replica Set

```bash
docker exec meeshy-dev-database mongosh "mongodb://database:27017/meeshy?replicaSet=rs0" --eval "db.adminCommand('ping')"
```

**Résultat attendu:**
```javascript
{ ok: 1 }
```

### Test 4: Insertion de Données

```bash
docker exec meeshy-dev-database mongosh "mongodb://database:27017/meeshy?replicaSet=rs0" --eval "db.test.insertOne({message: 'Hello from replica set'})"
```

**Résultat attendu:**
```javascript
{
  acknowledged: true,
  insertedId: ObjectId('...')
}
```

## 📊 Monitoring du Replica Set

### Commandes Utiles

```bash
# Statut complet
docker exec meeshy-dev-database mongosh --eval "rs.status()"

# Configuration
docker exec meeshy-dev-database mongosh --eval "rs.conf()"

# État du serveur
docker exec meeshy-dev-database mongosh --eval "rs.isMaster()"

# Membres du replica set
docker exec meeshy-dev-database mongosh --eval "rs.status().members"

# Voir les logs MongoDB
docker logs meeshy-dev-database --tail 50 -f
```

### Commandes de Dépannage

```bash
# Shell interactif MongoDB
docker exec -it meeshy-dev-database mongosh

# Puis dans le shell MongoDB:
rs.status()
rs.conf()
rs.isMaster()
db.adminCommand('ping')
use meeshy
show collections
```

## 🎯 Checklist de Démarrage

Avant de commencer le développement, vérifiez:

- [ ] MongoDB est démarré: `docker ps | grep meeshy-dev-database`
- [ ] Replica set initialisé: `./check-replica-set.sh`
- [ ] État PRIMARY: Vérifier que `myState: 1`
- [ ] Connexion OK: Test de ping réussi
- [ ] Services connectés: Vérifier les logs des services

```bash
# Commande complète de vérification
./start-dev.sh status && ./check-replica-set.sh && ./health-check.sh
```

## 🔐 Sécurité (Production)

Pour la production, ajoutez l'authentification:

```yaml
# docker-compose.yml (production)
database:
  command: mongod --replSet rs0 --bind_ip_all --keyFile /data/configdb/mongodb-keyfile --auth
  environment:
    MONGO_INITDB_ROOT_USERNAME: admin
    MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_PASSWORD}
```

URL de connexion avec auth:
```
mongodb://admin:password@database:27017/meeshy?replicaSet=rs0&authSource=admin
```

## 📚 Ressources

- [MongoDB Replica Set Documentation](https://docs.mongodb.com/manual/replication/)
- [MongoDB Connection Strings](https://docs.mongodb.com/manual/reference/connection-string/)
- [Change Streams](https://docs.mongodb.com/manual/changeStreams/)
- [Transactions](https://docs.mongodb.com/manual/core/transactions/)

## 💡 Résumé des Commandes

```bash
# Démarrage avec replica set
./start-dev.sh                      # Démarre et initialise automatiquement

# Vérification
./check-replica-set.sh              # Vérifier et initialiser si besoin
make init-replica                   # Avec Makefile
./start-dev.sh init-replica         # Commande directe

# Troubleshooting
docker exec meeshy-dev-database mongosh --eval "rs.status()"
docker exec meeshy-dev-database mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'database:27017'}]})"
docker restart meeshy-dev-database
./start-dev.sh clean && ./start-dev.sh

# Monitoring
docker logs meeshy-dev-database -f
docker exec -it meeshy-dev-database mongosh
```

---

**En cas de doute, utilisez `./check-replica-set.sh` pour diagnostiquer et résoudre automatiquement! 🚀**
