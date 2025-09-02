# MongoDB AI Deploy - Guide de dépannage

## Problèmes de connectivité MongoDB sur AI Deploy

### Problème identifié
```
MongoDB error Kind: Server selection timeout: No available servers. 
Topology: { Type: ReplicaSetNoPrimary, Set Name: replicaset, Servers: [...] }, 
Error: Kind: I/O error: unexpected end of file
```

### Solutions implémentées

#### 1. Configuration DATABASE_URL optimisée
```bash
DATABASE_URL="mongodb+srv://user:password@host/db?replicaSet=replicaset&tls=true&authMechanism=SCRAM-SHA-256&authSource=admin&readPreference=primaryPreferred&maxPoolSize=50&minPoolSize=5&maxIdleTimeMS=30000&serverSelectionTimeoutMS=60000&connectTimeoutMS=60000&socketTimeoutMS=60000&heartbeatFrequencyMS=10000&retryWrites=true&retryReads=true"
```

**Paramètres clés ajoutés :**
- `readPreference=primaryPreferred` : Préférence pour le serveur primaire
- `serverSelectionTimeoutMS=60000` : Timeout étendu à 60 secondes
- `connectTimeoutMS=60000` : Timeout de connexion à 60 secondes
- `socketTimeoutMS=60000` : Timeout de socket à 60 secondes
- `maxPoolSize=50` : Pool de connexions plus large
- `retryWrites=true&retryReads=true` : Retry automatique

#### 2. Script de health check MongoDB
Le script `mongodb-health-check.py` effectue :
- Test de résolution DNS
- Test de connectivité TCP
- Test de connexion MongoDB via Prisma

#### 3. Améliorations du script d'entrée

**Test de connectivité amélioré :**
- 30 tentatives avec timeout de 10 secondes chacune
- Test DNS avec résolution des enregistrements A et SRV
- Test TCP basique avant tentative MongoDB

**Gestion des migrations Prisma :**
- 3 tentatives pour `prisma db push`
- Fallback vers `prisma migrate deploy`
- Mode dégradé si toutes les migrations échouent
- Timeouts étendus à 10 minutes par tentative

#### 4. Variables d'environnement optimisées
```bash
MONGODB_DIRECT_CONNECTION=false
MONGODB_READ_PREFERENCE=primaryPreferred
MONGODB_CONNECT_TIMEOUT_MS=60000
MONGODB_SERVER_SELECTION_TIMEOUT_MS=60000
MONGODB_SOCKET_TIMEOUT_MS=60000
MONGODB_HEARTBEAT_FREQUENCY_MS=10000
MONGODB_MAX_STALENESS_SECONDS=120
PRISMA_CLIENT_ENGINE_TYPE=library
```

### Déploiement sur AI Deploy

#### Variables d'environnement recommandées
```bash
DATABASE_URL=mongodb+srv://user:password@host/db?[paramètres_optimisés]
DEBUG=false
LOG_LEVEL=info
WORKERS=2
TRANSLATION_WORKERS=4
```

#### Configuration des ressources
- **CPU** : Minimum 1 vCPU
- **Memory** : Minimum 2GB
- **Timeout** : Augmenter le timeout de démarrage à 10 minutes

### Diagnostic en cas de problème

#### 1. Vérifier la connectivité
```bash
# Dans le conteneur AI Deploy
python3 /workspace/mongodb-health-check.py
```

#### 2. Tester la résolution DNS
```bash
# Vérifier la résolution DNS
nslookup mongodb-31217e73-o6739ab9b.30e4c693.database.cloud.ovh.net
```

#### 3. Tester la connectivité TCP
```bash
# Test de connectivité basique
nc -zv mongodb-31217e73-o6739ab9b.30e4c693.database.cloud.ovh.net 27017
```

#### 4. Logs utiles
```bash
# Variables d'environnement MongoDB
env | grep -E "(MONGO|DATABASE|PRISMA)"

# Logs Prisma avec debug
DEBUG=*prisma* prisma db push --schema=./shared/prisma/schema.prisma
```

### Modes de fonctionnement

#### Mode normal
- Connexion MongoDB réussie
- Migrations appliquées
- Application démarrée normalement

#### Mode dégradé
- Connexion MongoDB échouée ou migrations échouées
- Application démarre sans base de données
- Logs d'avertissement mais pas d'arrêt

### Optimisations réseau pour AI Deploy

#### 1. Configuration DNS
- Utilisation de DNS resolver avec timeouts étendus
- Test des enregistrements A et SRV
- Fallback en cas d'échec DNS

#### 2. Configuration TCP
- Socket timeout à 60 secondes
- Test de connectivité avant tentative MongoDB
- Retry avec backoff exponentiel

#### 3. Configuration MongoDB
- Pool de connexions optimisé
- Read preference adaptée à l'environnement cloud
- Heartbeat réduit pour détection rapide des problèmes

### Commandes de reconstruction

#### Construction rapide avec corrections
```bash
./build-mongodb-fix.sh
```

#### Construction manuelle
```bash
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -f Dockerfile.mongodb \
    -t isopen/meeshy-translator:mongodb-ovh-latest \
    . --push
```

### Support et monitoring

#### Logs de démarrage
Les logs montrent clairement :
- État de la connectivité réseau
- Résultats des tests MongoDB
- État des migrations Prisma
- Mode de fonctionnement (normal/dégradé)

#### Métriques importantes
- Temps de connexion MongoDB
- Succès/échec des migrations
- Latence réseau vers MongoDB
- État du health check

### Contact et support
Pour des problèmes persistants, vérifier :
1. La configuration réseau AI Deploy
2. Les paramètres de sécurité MongoDB
3. La disponibilité du cluster MongoDB OVH
4. Les quotas et limites AI Deploy
