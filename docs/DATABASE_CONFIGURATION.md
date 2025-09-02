# Configuration MongoDB - Meeshy

## Vue d'Ensemble

Meeshy utilise **exclusivement MongoDB** comme base de données. Cette configuration simplifiée offre :
- **Performance optimisée** pour les données documentaires
- **Scalabilité horizontale** native
- **Schéma flexible** adapté aux applications de messagerie
- **Support des transactions** pour la cohérence des données

## 🚀 Configuration Rapide

### Configuration MongoDB
```bash
./scripts/configure-database.sh
```

### Configuration avec Image Personnalisée
```bash
./scripts/configure-database.sh -i mongo:7.0
```

## 📁 Fichiers de Configuration

### Fichiers Créés/Modifiés
- **`.env.database`** - Configuration MongoDB
- **`docker-compose.yml`** - Services Docker avec MongoDB
- **`shared/init-mongo.js`** - Script d'initialisation MongoDB

### Schéma Prisma
- **`shared/schema.prisma`** - Schéma MongoDB exclusif

## 🔧 Configuration Détaillée

### Variables d'Environnement

#### MongoDB
```bash
DATABASE_TYPE=MONGODB
DATABASE_URL=mongodb://meeshy:MeeshyPassword123@database:27017/meeshy?authSource=admin
MONGODB_DATABASE=meeshy
MONGODB_USER=meeshy
MONGODB_PASSWORD=MeeshyPassword123
```

### Configuration Prisma
```bash
# MongoDB (exclusif)
DATABASE_URL=${MONGODB_URL}
PRISMA_SCHEMA_PATH=./shared/schema.prisma
```

## 🐳 Services Docker

### Service MongoDB
Le service `database` utilise MongoDB exclusivement :

```yaml
database:
  image: ${DATABASE_IMAGE:-mongo:8.0}
  environment:
    MONGO_INITDB_DATABASE: ${MONGODB_DATABASE:-meeshy}
    MONGO_INITDB_ROOT_USERNAME: ${MONGODB_USER:-meeshy}
    MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_PASSWORD:-MeeshyPassword123}
  ports:
    - "27017:27017"
```

### Ports
- **MongoDB** : `27017`

## 📊 Avantages de MongoDB

| Aspect | Avantage |
|--------|----------|
| **Performance** | Excellente pour lectures et écritures |
| **Scalabilité** | Horizontale native avec sharding |
| **Schéma** | Flexible et évolutif |
| **Transactions** | Supportées (4.0+) |
| **Requêtes** | Agrégation puissante avec pipeline |
| **Indexation** | Multi-dimensionnelle et géospatiale |
| **JSON** | Support natif des documents JSON |

## 🚀 Déploiement

### Déploiement Local
```bash
# 1. Configurer MongoDB
./scripts/configure-database.sh

# 2. Démarrer les services
docker-compose up -d

# 3. Vérifier les logs
docker-compose logs -f
```

### Déploiement sur Serveur
```bash
# Déploiement MongoDB
./scripts/deploy-configurable.sh 157.230.15.51

# Déploiement avec SSL
./scripts/deploy-configurable.sh -s -d meeshy.me 157.230.15.51
```

## 🛠️ Scripts Disponibles

### Configuration
- **`configure-database.sh`** - Configuration MongoDB exclusive
- **`deploy-configurable.sh`** - Déploiement MongoDB

### Build et Push
- **`build-and-push-images.sh`** - Construction et push des images Docker

### Utilisation
```bash
# Aide
./scripts/configure-database.sh -h
./scripts/deploy-configurable.sh -h
./scripts/build-and-push-images.sh -h
```

## 🔍 Vérification

### Vérifier la Configuration
```bash
# Vérifier le type de base de données
cat .env.database | grep DATABASE_TYPE

# Vérifier les variables Prisma
cat .env.database | grep DATABASE_URL
```

### Vérifier les Services
```bash
# Statut des services
docker-compose ps

# Logs de MongoDB
docker-compose logs database

# Test de connexion
docker-compose exec database mongosh --eval "db.adminCommand('ping')"
```

## 🚨 Dépannage

### Problèmes Courants

#### 1. Échec d'Authentification
```bash
# Vérifier les variables d'environnement
docker-compose exec database env | grep MONGO

# Vérifier les utilisateurs
docker-compose exec database mongosh --eval "db.getUsers()"
```

#### 2. Schéma Prisma Incorrect
```bash
# Vérifier le chemin du schéma
echo $PRISMA_SCHEMA_PATH

# Régénérer le client Prisma
docker-compose exec translator prisma generate
```

#### 3. Ports en Conflit
```bash
# Vérifier les ports utilisés
lsof -i :27017

# Modifier les ports dans .env.database si nécessaire
```

## 📚 Ressources Supplémentaires

### Documentation
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Prisma MongoDB Documentation](https://www.prisma.io/docs/concepts/database-connectors/mongodb)

### Scripts d'Initialisation
- **MongoDB** : `shared/init-mongo.js`

### Configuration Docker
- **Template** : `docker-compose.configurable.yml`
- **Généré** : `docker-compose.yml`

## 🎯 Recommandations MongoDB

### Optimisations
- **Indexation** : Créer des index sur les champs fréquemment utilisés
- **Sharding** : Pour les très grandes bases de données
- **Réplica Set** : Pour la haute disponibilité
- **Compression** : Activer la compression des données

### Monitoring
- **MongoDB Compass** : Interface graphique pour la gestion
- **MongoDB Ops Manager** : Monitoring et alertes
- **Logs** : Surveiller les logs de performance

## 🔄 Migration et Maintenance

### Sauvegarde
```bash
# Sauvegarde complète
mongodump --db meeshy --out ./backup

# Sauvegarde d'une collection spécifique
mongodump --db meeshy --collection User --out ./backup
```

### Restauration
```bash
# Restauration complète
mongorestore --db meeshy ./backup/meeshy

# Restauration d'une collection
mongorestore --db meeshy --collection User ./backup/meeshy/User.bson
```

### Mise à Jour
```bash
# Mise à jour de MongoDB
docker-compose pull database
docker-compose up -d database
```

---

**Note** : Meeshy utilise MongoDB exclusivement pour offrir une expérience optimisée et cohérente. Cette approche simplifie la maintenance et garantit la compatibilité avec toutes les fonctionnalités de l'application.
