# Configuration de Base de Données Configurable - Meeshy

## Vue d'Ensemble

Meeshy supporte maintenant **deux types de bases de données** de manière configurable :
- **MongoDB** (par défaut) - Base de données NoSQL orientée document
- **PostgreSQL** - Base de données relationnelle robuste

Cette configuration permet de choisir la base de données selon vos besoins et contraintes d'infrastructure.

## 🚀 Configuration Rapide

### 1. Configuration MongoDB (Par Défaut)
```bash
./scripts/configure-database.sh -t MONGODB
```

### 2. Configuration PostgreSQL
```bash
./scripts/configure-database.sh -t POSTGRESQL
```

### 3. Configuration avec Image Personnalisée
```bash
./scripts/configure-database.sh -t POSTGRESQL -i postgres:16
```

## 📁 Fichiers de Configuration

### Fichiers Créés/Modifiés
- **`.env.database`** - Configuration de la base de données
- **`docker-compose.yml`** - Services Docker avec base configurable
- **`shared/init-mongo.js`** - Script d'initialisation MongoDB
- **`shared/init-postgresql.sql`** - Script d'initialisation PostgreSQL

### Schémas Prisma
- **`shared/schema.prisma`** - Schéma MongoDB
- **`shared/schema.postgresql.prisma`** - Schéma PostgreSQL

## 🔧 Configuration Détaillée

### Variables d'Environnement

#### MongoDB
```bash
DATABASE_TYPE=MONGODB
MONGODB_URL=mongodb://meeshy:MeeshyPassword123@database:27017/meeshy?authSource=admin
MONGODB_DATABASE=meeshy
MONGODB_USER=meeshy
MONGODB_PASSWORD=MeeshyPassword123
```

#### PostgreSQL
```bash
DATABASE_TYPE=POSTGRESQL
POSTGRESQL_URL=postgresql://meeshy:MeeshyPassword123@database:5432/meeshy
POSTGRESQL_DATABASE=meeshy
POSTGRESQL_USER=meeshy
POSTGRESQL_PASSWORD=MeeshyPassword123
```

### Configuration Prisma
```bash
# MongoDB
PRISMA_DATABASE_URL=${MONGODB_URL}
PRISMA_SCHEMA_PATH=./shared/schema.prisma

# PostgreSQL
PRISMA_DATABASE_URL=${POSTGRESQL_URL}
PRISMA_SCHEMA_PATH=./shared/schema.postgresql.prisma
```

## 🐳 Services Docker

### Service de Base de Données
Le service `database` s'adapte automatiquement selon le type choisi :

```yaml
database:
  image: ${DATABASE_IMAGE:-mongo:8.0}  # ou postgres:15-alpine
  environment:
    # Variables MongoDB
    MONGO_INITDB_DATABASE: ${MONGODB_DATABASE:-meeshy}
    MONGO_INITDB_ROOT_USERNAME: ${MONGODB_USER:-meeshy}
    MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_PASSWORD:-MeeshyPassword123}
    # Variables PostgreSQL
    POSTGRES_DB: ${POSTGRESQL_DATABASE:-meeshy}
    POSTGRES_USER: ${POSTGRESQL_USER:-meeshy}
    POSTGRES_PASSWORD: ${POSTGRESQL_PASSWORD:-MeeshyPassword123}
```

### Ports
- **MongoDB** : `27017`
- **PostgreSQL** : `5432`

## 📊 Comparaison des Bases de Données

| Aspect | MongoDB | PostgreSQL |
|--------|---------|------------|
| **Type** | NoSQL Document | SQL Relationnel |
| **Performance** | Excellente pour lectures | Excellente pour transactions |
| **Scalabilité** | Horizontale native | Verticale + extensions |
| **Schéma** | Flexible | Strict |
| **Transactions** | Supportées (4.0+) | ACID complètes |
| **Requêtes** | Agrégation puissante | SQL standard |
| **Indexation** | Multi-dimensionnelle | B-tree, GIN, GiST |

## 🚀 Déploiement

### Déploiement Local
```bash
# 1. Configurer la base de données
./scripts/configure-database.sh -t MONGODB

# 2. Démarrer les services
docker-compose up -d

# 3. Vérifier les logs
docker-compose logs -f
```

### Déploiement sur Serveur
```bash
# Déploiement MongoDB
./scripts/deploy-configurable.sh 157.230.15.51

# Déploiement PostgreSQL
./scripts/deploy-configurable.sh -t POSTGRESQL 157.230.15.51

# Déploiement avec SSL
./scripts/deploy-configurable.sh -s -d meeshy.me 157.230.15.51
```

## 🔄 Migration entre Bases

### MongoDB → PostgreSQL
```bash
# 1. Sauvegarder les données MongoDB
mongodump --db meeshy --out ./backup

# 2. Configurer PostgreSQL
./scripts/configure-database.sh -t POSTGRESQL

# 3. Migrer les données (script personnalisé requis)
# 4. Redémarrer les services
docker-compose up -d
```

### PostgreSQL → MongoDB
```bash
# 1. Sauvegarder les données PostgreSQL
pg_dump -U meeshy -d meeshy > ./backup.sql

# 2. Configurer MongoDB
./scripts/configure-database.sh -t MONGODB

# 3. Migrer les données (script personnalisé requis)
# 4. Redémarrer les services
docker-compose up -d
```

## 🛠️ Scripts Disponibles

### Configuration
- **`configure-database.sh`** - Configuration de la base de données
- **`deploy-configurable.sh`** - Déploiement configurable

### Build et Push
- **`build-and-push-images.sh`** - Construction et push des images Docker

### Utilisation
```bash
# Aide
./scripts/configure-database.sh -h
./scripts/deploy-configurable.sh -h
./scripts/build-and-push-images.sh -h

# Mode dry-run
./scripts/build-and-push-images.sh -d
```

## 🔍 Vérification

### Vérifier la Configuration
```bash
# Vérifier le type de base de données
cat .env.database | grep DATABASE_TYPE

# Vérifier les variables Prisma
cat .env.database | grep PRISMA
```

### Vérifier les Services
```bash
# Statut des services
docker-compose ps

# Logs de la base de données
docker-compose logs database

# Test de connexion
docker-compose exec database mongosh --eval "db.adminCommand('ping')"  # MongoDB
docker-compose exec database pg_isready -U meeshy -d meeshy            # PostgreSQL
```

## 🚨 Dépannage

### Problèmes Courants

#### 1. Échec d'Authentification
```bash
# Vérifier les variables d'environnement
docker-compose exec database env | grep -E "(MONGO|POSTGRES)"

# Vérifier les utilisateurs
docker-compose exec database mongosh --eval "db.getUsers()"  # MongoDB
docker-compose exec database psql -U meeshy -d meeshy -c "\du"  # PostgreSQL
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
lsof -i :27017  # MongoDB
lsof -i :5432   # PostgreSQL

# Modifier les ports dans .env.database si nécessaire
```

## 📚 Ressources Supplémentaires

### Documentation
- [MongoDB Documentation](https://docs.mongodb.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)

### Scripts d'Initialisation
- **MongoDB** : `shared/init-mongo.js`
- **PostgreSQL** : `shared/init-postgresql.sql`

### Configuration Docker
- **Template** : `docker-compose.configurable.yml`
- **Généré** : `docker-compose.yml`

## 🎯 Recommandations

### MongoDB Recommandé Pour
- Applications avec schémas flexibles
- Données non structurées ou semi-structurées
- Besoins de scalabilité horizontale
- Requêtes d'agrégation complexes

### PostgreSQL Recommandé Pour
- Applications avec schémas stricts
- Besoins de transactions ACID
- Intégrité référentielle importante
- Requêtes SQL complexes

---

**Note** : Cette configuration permet de basculer facilement entre MongoDB et PostgreSQL selon vos besoins, sans modifier le code de l'application.
