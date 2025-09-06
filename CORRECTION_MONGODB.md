# Correction du problème d'enregistrement MongoDB

## Problème identifié

L'erreur d'enregistrement des utilisateurs était causée par le fait que **MongoDB doit être configuré comme un replica set pour que Prisma puisse effectuer des transactions**.

### Erreur originale
```
PrismaClientKnownRequestError: 
Prisma needs to perform transactions, which requires your MongoDB server to be run as a replica set.
```

## Solution implémentée

### 1. Configuration MongoDB en replica set

**Fichier modifié :** `docker-compose.dev.yml`

```yaml
database:
  image: mongo:8.0
  container_name: meeshy-dev-database
  restart: unless-stopped
  command: mongod --bind_ip_all --replSet rs0 --keyFile /data/configdb/mongodb-keyfile
  environment:
    MONGO_INITDB_ROOT_USERNAME: meeshy
    MONGO_INITDB_ROOT_PASSWORD: MeeshyPassword123
    MONGO_INITDB_DATABASE: meeshy
    MONGO_REPLICA_SET: rs0
  volumes:
    - ./shared/mongodb-keyfile:/data/configdb/mongodb-keyfile
```

### 2. Création du fichier de clé MongoDB

```bash
openssl rand -base64 756 > shared/mongodb-keyfile
chmod 600 shared/mongodb-keyfile
```

### 3. Script d'initialisation du replica set

**Nouveau fichier :** `scripts/development/init-mongodb-replica.sh`

Ce script :
- Vérifie la connectivité MongoDB
- Initialise le replica set `rs0` avec un seul membre
- Vérifie le statut du replica set

### 4. Mise à jour des chaînes de connexion

**Fichier modifié :** `scripts/development/start-local.sh`

```bash
export DATABASE_URL="mongodb://meeshy:MeeshyPassword123@localhost:27017/meeshy?authSource=admin&replicaSet=rs0"
```

### 5. Intégration dans le script de démarrage

Le script `start-local.sh` inclut maintenant automatiquement l'initialisation du replica set MongoDB.

## Scripts de test

### Test complet d'enregistrement
```bash
./scripts/development/test-registration.sh
```

Ce script teste :
- ✅ Vérification des services
- ✅ Statut du replica set MongoDB
- ✅ Enregistrement d'utilisateur
- ✅ Vérification en base de données
- ✅ Test de connexion

## Résultat

L'enregistrement d'utilisateurs fonctionne maintenant correctement :

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "68bc629b524f98e0cd359a74",
      "username": "testuser_1757176455",
      "email": "test_1757176455@example.com",
      "firstName": "Test",
      "lastName": "User",
      "displayName": "Test User",
      "role": "USER",
      "systemLanguage": "fr",
      "regionalLanguage": "fr"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

## Commandes utiles

### Redémarrer l'environnement complet
```bash
./scripts/development/start-local.sh
```

### Tester l'enregistrement
```bash
./scripts/development/test-registration.sh
```

### Vérifier le statut du replica set
```bash
mongosh --eval "rs.status()" --username meeshy --password MeeshyPassword123 --authenticationDatabase admin
```

### Tester l'endpoint d'enregistrement
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123","firstName":"Test","lastName":"User"}'
```

## Notes importantes

1. **Replica set requis** : Prisma nécessite un replica set MongoDB pour les transactions
2. **Fichier de clé** : MongoDB avec authentification nécessite un fichier de clé pour les replica sets
3. **Chaîne de connexion** : Doit inclure `replicaSet=rs0` pour fonctionner correctement
4. **Initialisation automatique** : Le script de démarrage initialise automatiquement le replica set

## Fichiers modifiés

- `docker-compose.dev.yml` - Configuration MongoDB en replica set
- `scripts/development/start-local.sh` - Chaînes de connexion et initialisation
- `shared/mongodb-keyfile` - Fichier de clé MongoDB (nouveau)
- `scripts/development/init-mongodb-replica.sh` - Script d'initialisation (nouveau)
- `scripts/development/test-registration.sh` - Script de test (nouveau)