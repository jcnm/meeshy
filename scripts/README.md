# Scripts de Migration et Maintenance MongoDB

Ce dossier contient des scripts utilitaires pour la maintenance de la base de données MongoDB de Meeshy.

## 📋 Scripts Disponibles

### 1. `fix-null-identifiers.js`
**Objectif**: Corriger les champs `identifier` null dans les collections qui nécessitent des identifiers uniques.

**Utilisation**:
```bash
node scripts/fix-null-identifiers.js
```

**Collections concernées**:
- `Conversation` → Génère des identifiers au format `conv_<timestamp>_<random>_<index>`
- `ConversationShareLink` → Génère des identifiers au format `share_<timestamp>_<random>_<index>`
- `Community` → Génère des identifiers au format `comm_<timestamp>_<random>_<index>`

**Quand l'utiliser**:
- Avant d'appliquer `prisma db push` pour la première fois
- Quand l'erreur `E11000 duplicate key error` apparaît pour `identifier: null`

### 2. `cleanup-message-status.mongodb.js`
**Objectif**: Supprimer les doublons dans la collection `message_status`.

**Utilisation**:
```bash
mongosh mongodb://localhost:27017/meeshy --quiet scripts/cleanup-message-status.mongodb.js
```

**Logique**:
- Trouve tous les doublons basés sur `messageId` + `userId`
- Garde le document le plus récent (`createdAt`)
- Supprime tous les autres

**Quand l'utiliser**:
- Avant d'appliquer `prisma db push` pour la première fois
- Quand l'erreur `E11000 duplicate key error` apparaît pour `message_status_messageId_userId_key`

### 3. `cleanup-user-stats.mongodb.js`
**Objectif**: Supprimer les doublons dans la collection `UserStats`.

**Utilisation**:
```bash
mongosh mongodb://localhost:27017/meeshy --quiet scripts/cleanup-user-stats.mongodb.js
```

**Logique**:
- Trouve tous les doublons basés sur `userId`
- Garde le document le plus récent (`createdAt`)
- Supprime tous les autres

**Quand l'utiliser**:
- Avant d'appliquer `prisma db push` pour la première fois
- Quand l'erreur `E11000 duplicate key error` apparaît pour `UserStats_userId_key`

### 4. `fix-message-status-duplicates.js`
**Objectif**: Version Node.js du script de nettoyage message_status (utilise mongosh en interne).

**Utilisation**:
```bash
node scripts/fix-message-status-duplicates.js
```

## 🔄 Workflow de Migration Complet

Lorsque vous rencontrez des erreurs d'index lors de `prisma db push`, suivez ces étapes :

### Étape 1: Identifier l'erreur
```bash
cd gateway
pnpm prisma db push --schema=shared/prisma/schema.prisma
```

### Étape 2: Appliquer les corrections nécessaires

**Pour les identifiers null**:
```bash
node scripts/fix-null-identifiers.js
```

**Pour les doublons message_status**:
```bash
mongosh mongodb://localhost:27017/meeshy --quiet scripts/cleanup-message-status.mongodb.js
```

**Pour les doublons UserStats**:
```bash
mongosh mongodb://localhost:27017/meeshy --quiet scripts/cleanup-user-stats.mongodb.js
```

### Étape 3: Réappliquer Prisma
```bash
cd gateway
pnpm prisma db push --schema=shared/prisma/schema.prisma
```

## 📊 Exemple de Sortie

### fix-null-identifiers.js
```
✅ Connexion à MongoDB via mongosh...

🔍 Vérification de la collection Conversation...
   Trouvé 8 documents avec identifier: null
✅ 68bd4e495adf599956567f7a: conv_mgr6r7a6_qm1ue_0
✅ 68bd6afa4f77c3f8d94b4e0e: conv_mgr6r7ct_o4vqk_1
   ✅ Documents mis à jour dans Conversation

🔍 Vérification de la collection ConversationShareLink...
   Trouvé 66 documents avec identifier: null
   ✅ Documents mis à jour dans ConversationShareLink

✅ Migration terminée
```

### cleanup-message-status.mongodb.js
```
🔍 Trouvé 163 groupes de doublons

🗑️  Supprimé doublon: 68c28b3feaf65f7e0b866378
🗑️  Supprimé doublon: 68c292d12b071c5be5c501eb
...

✅ 273 doublons supprimés
```

## ⚠️ Précautions

1. **Backup**: Toujours faire un backup de la base de données avant d'exécuter ces scripts
2. **Environnement**: Ces scripts sont conçus pour l'environnement de développement
3. **Production**: Sur production, vérifier manuellement les données avant suppression
4. **DATABASE_URL**: Les scripts utilisent `process.env.DATABASE_URL` ou `mongodb://localhost:27017/meeshy` par défaut

## 🔧 Configuration

Les scripts utilisent la variable d'environnement `DATABASE_URL` pour se connecter à MongoDB.

**Exemple**:
```bash
export DATABASE_URL="mongodb://localhost:27017/meeshy"
node scripts/fix-null-identifiers.js
```

Ou directement dans la commande :
```bash
DATABASE_URL="mongodb://user:pass@host:27017/db" node scripts/fix-null-identifiers.js
```

## 📝 Notes Importantes

- Ces scripts sont **idempotents** : ils peuvent être exécutés plusieurs fois sans danger
- Les identifiers générés sont **uniques** grâce au timestamp + random
- Les doublons sont identifiés par **date de création** (le plus récent est gardé)
- Tous les scripts affichent des **logs détaillés** de leurs actions

## 🐛 Debugging

Si un script échoue, vérifier :

1. **MongoDB est démarré**: `mongosh mongodb://localhost:27017/meeshy --eval "db.stats()"`
2. **Permissions**: L'utilisateur MongoDB a les droits d'écriture
3. **DATABASE_URL**: La variable d'environnement est correcte
4. **Collections**: Les collections existent dans la base de données

## 📚 Ressources

- [Prisma MongoDB Guide](https://www.prisma.io/docs/concepts/database-connectors/mongodb)
- [MongoDB Index Documentation](https://www.mongodb.com/docs/manual/indexes/)
- [Prisma db push](https://www.prisma.io/docs/reference/api-reference/command-reference#db-push)
