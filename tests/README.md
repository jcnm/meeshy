# Tests End-to-End Meeshy

Ce dossier contient des tests end-to-end pour valider le flux complet de traduction multilingue de Meeshy.

## 🎯 Objectif

Identifier et résoudre le problème où un utilisateur ne reçoit qu'une seule traduction au lieu de toutes les traductions pour les langues des participants d'une conversation.

## 📋 Tests disponibles

### 1. Test Complet (`e2e-translation-test.ts`)

Test exhaustif qui simule plusieurs utilisateurs avec différentes langues et vérifie que toutes les traductions sont correctement diffusées.

**Fonctionnalités:**
- ✅ Récupère automatiquement les utilisateurs et langues de la conversation
- ✅ Connecte plusieurs utilisateurs au WebSocket
- ✅ Envoie un message et attend les traductions
- ✅ Compare les traductions reçues vs attendues
- ✅ Vérifie en base de données
- ✅ Fournit un rapport détaillé avec diagnostics

**Usage:**
```bash
# Dans le dossier tests/
pnpm install
pnpm test:translation meeshy

# Ou directement
ts-node e2e-translation-test.ts meeshy
```

**Variables d'environnement:**
```bash
GATEWAY_URL=http://localhost:3001
TEST_CONVERSATION_ID=meeshy
```

### 2. Test Rapide (`quick-translation-test.ts`)

Test simple et rapide pour vérifier rapidement si les traductions sont reçues.

**Fonctionnalités:**
- ✅ Connexion rapide d'un seul utilisateur
- ✅ Envoi d'un message
- ✅ Affichage des traductions reçues en temps réel
- ✅ Résultats simplifiés

**Usage:**
```bash
pnpm test:quick meeshy

# Ou directement
ts-node quick-translation-test.ts meeshy
```

## 🔍 Flux testé

Le test valide le flux complet suivant:

```
1. Utilisateur envoie un message
   ↓
2. Gateway sauvegarde le message (Prisma)
   ↓
3. Gateway extrait les langues des participants
   ↓
4. Gateway envoie requête de traduction (ZMQ → Translator)
   ↓
5. Translator traite et renvoie les traductions (ZMQ PUB/SUB)
   ↓
6. Gateway reçoit les traductions
   ↓
7. Gateway sauvegarde les traductions en base
   ↓
8. Gateway diffuse via WebSocket (event: 'message:translation')
   ↓
9. Tous les clients dans la room reçoivent les traductions
```

## 📊 Analyse des résultats

Le test complet fournit:

### Statistiques globales
- Nombre d'utilisateurs connectés
- Langues attendues vs reçues
- Temps de traitement

### Détails par utilisateur
- Messages originaux reçus
- Traductions reçues (par langue)
- Langues manquantes

### Vérification base de données
- Traductions sauvegardées en DB
- Comparaison DB vs WebSocket

### Diagnostics
- Utilisateurs sans messages
- Utilisateurs sans traductions
- Langues manquantes et causes probables

## 🐛 Problèmes courants identifiés

### Problème 1: Une seule traduction reçue
**Symptôme:** L'utilisateur ne reçoit qu'une traduction au lieu de toutes

**Causes possibles:**
1. Le service de traduction filtre incorrectement les langues
2. Les traductions ne sont pas toutes diffusées via WebSocket
3. La room de conversation n'est pas correctement configurée

**Vérification:**
```typescript
// Dans TranslationService._extractConversationLanguages()
// Vérifier que toutes les langues sont extraites:
console.log('Langues extraites:', languages);
```

### Problème 2: Aucune traduction reçue
**Symptôme:** Aucune traduction n'arrive via WebSocket

**Causes possibles:**
1. Le service de traduction n'est pas démarré
2. ZMQ PUB/SUB non configuré correctement
3. L'événement 'translationReady' n'est pas écouté

**Vérification:**
```bash
# Vérifier que le translator est actif
docker ps | grep translator

# Vérifier les logs gateway
docker logs meeshy-gateway-1 --tail 100 -f
```

### Problème 3: Traductions en base mais pas reçues
**Symptôme:** Les traductions sont en DB mais pas diffusées via WebSocket

**Causes possibles:**
1. L'événement 'translationReady' n'est pas émis
2. Le SocketIOManager ne diffuse pas correctement
3. Les clients ne sont pas dans la bonne room

**Vérification:**
```typescript
// Dans MeeshySocketIOManager._handleTranslationReady()
console.log('Broadcasting to room:', roomName);
console.log('Clients in room:', clientCount);
```

## 🔧 Configuration requise

### Prérequis
- Node.js 22+
- TypeScript 5.8+
- Gateway Meeshy en cours d'exécution
- Service de traduction actif
- Base de données PostgreSQL accessible

### Installation
```bash
cd tests/
pnpm install
```

### Variables d'environnement
Créer un fichier `.env` dans le dossier `tests/`:
```env
GATEWAY_URL=http://localhost:3001
TEST_CONVERSATION_ID=meeshy
TEST_USER_ID=test-user-1
TEST_USER_LANGUAGE=fr
DATABASE_URL=postgresql://user:password@localhost:5432/meeshy
```

## 📝 Créer une conversation de test

Pour créer une conversation de test avec plusieurs utilisateurs et langues:

```typescript
// Exemple avec Prisma
const conversation = await prisma.conversation.create({
  data: {
    id: 'test-multilingual',
    identifier: 'mshy_test-multilingual-20251012',
    title: 'Test Multilingue',
    type: 'group',
    members: {
      create: [
        {
          userId: 'user-fr',
          role: 'member',
          // User systemLanguage: 'fr'
        },
        {
          userId: 'user-en',
          role: 'member',
          // User systemLanguage: 'en'
        },
        {
          userId: 'user-es',
          role: 'member',
          // User systemLanguage: 'es'
        }
      ]
    }
  }
});
```

## 🚀 Utilisation recommandée

### 1. Test de développement
Utilisez le test rapide pendant le développement:
```bash
pnpm test:quick meeshy
```

### 2. Test de validation
Utilisez le test complet pour valider les corrections:
```bash
pnpm test:translation meeshy
```

### 3. Tests continus
Intégrez dans le CI/CD pour valider automatiquement:
```yaml
# .github/workflows/e2e-tests.yml
- name: Run E2E Translation Tests
  run: |
    cd tests
    pnpm install
    pnpm test:translation meeshy
```

## 📚 Ressources

- [Architecture de traduction Meeshy](../gateway/src/services/TranslationService.ts)
- [Gestion WebSocket](../gateway/src/socketio/MeeshySocketIOManager.ts)
- [Documentation Socket.IO](https://socket.io/docs/v4/)
- [ZMQ PUB/SUB Pattern](https://zeromq.org/socket-api/#publish-subscribe-pattern)

## 🤝 Contribution

Pour ajouter de nouveaux tests:

1. Créer un nouveau fichier `xxx-test.ts`
2. Suivre la structure existante
3. Ajouter un script dans `package.json`
4. Documenter dans ce README

## 📄 Licence

Ce code est privé et fait partie du projet Meeshy.

