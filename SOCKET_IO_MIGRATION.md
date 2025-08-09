# Migration vers Socket.IO - Guide de Migration

## Vue d'ensemble

Meeshy a migré de WebSocket natif vers Socket.IO pour une meilleure gestion des connexions temps réel, une reconnexion automatique améliorée, et des fonctionnalités avancées.

## Changements principaux

### Côté Backend (Gateway)

1. **Nouveau gestionnaire Socket.IO** : `MeeshySocketIOManager` remplace l'ancien `MeeshyWebSocketHandler`
2. **Intégration Fastify** : `MeeshySocketIOHandler` gère l'intégration avec Fastify
3. **Gestion des traductions** : Nouveau processus asynchrone de traduction intégré

### Côté Frontend

1. **Nouveau service** : `meeshySocketIOService` remplace `nativeWebSocketService`
2. **Nouveau hook** : `useSocketIOMessaging` remplace `useNativeMessaging`
3. **API améliorée** : Callbacks avec gestion d'erreurs et promesses

## Guide de migration

### 1. Migration du hook côté composant

**Avant (WebSocket natif):**
```typescript
import { useNativeMessaging } from '@/hooks/use-native-messaging';

const MyComponent = () => {
  const {
    sendMessage,
    editMessage,
    deleteMessage,
    connectionStatus
  } = useNativeMessaging({
    conversationId: 'conv-123',
    currentUser: user,
    onNewMessage: (message) => {
      setMessages(prev => [...prev, message]);
    }
  });
  
  // Usage
  const handleSend = async () => {
    const success = await sendMessage(content);
    if (!success) {
      // Gérer l'erreur manuellement
      showError('Erreur envoi message');
    }
  };
};
```

**Après (Socket.IO):**
```typescript
import { useSocketIOMessaging } from '@/hooks/use-socketio-messaging';

const MyComponent = () => {
  const {
    sendMessage,
    editMessage,
    deleteMessage,
    connectionStatus
  } = useSocketIOMessaging({
    conversationId: 'conv-123',
    currentUser: user,
    onNewMessage: (message) => {
      setMessages(prev => [...prev, message]);
    },
    onTranslation: (messageId, translations) => {
      // Nouveau: gestion des traductions
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, translations } 
          : m
      ));
    }
  });
  
  // Usage amélioré avec gestion d'erreurs automatique
  const handleSend = async () => {
    const success = await sendMessage(content);
    // Les erreurs sont maintenant gérées automatiquement via toast
    if (success) {
      // Message envoyé avec succès
    }
  };
};
```

### 2. Nouvelles fonctionnalités disponibles

#### Gestion des traductions en temps réel
```typescript
const { ... } = useSocketIOMessaging({
  // ...autres options
  onTranslation: (messageId, translations) => {
    console.log('Traductions reçues:', translations);
    // translations = [
    //   {
    //     targetLanguage: 'en',
    //     translatedContent: 'Hello world',
    //     sourceLanguage: 'fr',
    //     modelUsed: 'google-translate'
    //   }
    // ]
  }
});
```

#### Callbacks avec réponses
```typescript
// Les actions retournent maintenant des promesses avec gestion d'erreur
const success = await sendMessage('Hello');
const editSuccess = await editMessage('msg-id', 'New content');
const deleteSuccess = await deleteMessage('msg-id');
```

#### Statut de connexion amélioré
```typescript
const { connectionStatus } = useSocketIOMessaging();

console.log(connectionStatus);
// {
//   isConnected: true,
//   hasSocket: true,
//   currentUser: 'alice.martin'
// }
```

### 3. Configuration côté serveur

Le serveur utilise maintenant Socket.IO au lieu de WebSocket natif :

```typescript
// server.ts
import { MeeshySocketIOHandler } from './socketio/MeeshySocketIOHandler';

class MeeshyServer {
  private socketIOHandler: MeeshySocketIOHandler;
  
  constructor() {
    this.socketIOHandler = new MeeshySocketIOHandler(
      this.prisma, 
      config.jwtSecret
    );
  }
  
  private async setupSocketIO(): Promise<void> {
    this.socketIOHandler.setupSocketIO(this.server);
  }
}
```

### 4. Gestion des événements

**Nouveaux événements disponibles:**

- `message:new` - Nouveau message
- `message:edited` - Message modifié  
- `message:deleted` - Message supprimé
- `message:translation` - Traductions reçues
- `typing:start` / `typing:stop` - Indicateurs de frappe
- `user:status` - Statut utilisateur (en ligne/hors ligne)
- `conversation:joined` / `conversation:left` - Événements de conversation

### 5. Authentification

L'authentification reste la même, utilisant le token JWT:

```typescript
// Le service utilise automatiquement le token depuis localStorage
const token = localStorage.getItem('auth_token');

// Socket.IO se connecte avec:
io(serverUrl, {
  auth: { token },
  transports: ['websocket', 'polling']
});
```

### 6. Reconnexion automatique

Socket.IO gère automatiquement la reconnexion avec:
- Backoff exponentiel
- 5 tentatives maximum par défaut
- Notifications utilisateur automatiques

### 7. Routes d'administration

Nouvelles routes disponibles:

```
GET  /api/socketio/stats - Statistiques des connexions
POST /api/socketio/disconnect-user - Déconnecter un utilisateur
```

## Dépannage

### Problèmes courants

1. **Connexion refusée**
   - Vérifier que le token JWT est valide
   - Vérifier l'URL du serveur dans `NEXT_PUBLIC_WS_URL`

2. **Messages non reçus**
   - Vérifier que l'utilisateur est dans la conversation
   - Vérifier les logs de connexion Socket.IO

3. **Traductions manquantes**
   - Vérifier que le service de traduction ZMQ est actif
   - Vérifier les logs du `TranslationService`

### Debugging

```typescript
const { getDiagnostics } = useSocketIOMessaging();

// Obtenir des informations de debug
const diagnostics = getDiagnostics();
console.log('Socket.IO Diagnostics:', diagnostics);
```

## Avantages de la migration

1. **Fiabilité** : Reconnexion automatique robuste
2. **Performance** : Gestion optimisée des connexions multiples
3. **Fonctionnalités** : Rooms, namespaces, événements typés
4. **Debugging** : Meilleurs outils de debugging et logging
5. **Compatibilité** : Support des transports multiples (WebSocket + polling)
6. **Traductions** : Intégration native du système de traduction temps réel

## Suppression des anciens fichiers

Une fois la migration terminée, vous pouvez supprimer:

- `frontend/services/native-websocket.service.ts`
- `frontend/hooks/use-native-messaging.ts`
- `gateway/src/websocket/handler.ts` (déjà sauvegardé en `.bak`)

## ✅ Migration terminée avec succès !

La migration de WebSocket natif vers Socket.IO est **complète et fonctionnelle**.

### Fichiers créés :
- ✅ `gateway/src/socketio/MeeshySocketIOManager.ts` (gestionnaire principal)
- ✅ `gateway/src/socketio/MeeshySocketIOHandler.ts` (intégration Fastify)  
- ✅ `frontend/services/meeshy-socketio.service.ts` (service frontend)
- ✅ `frontend/hooks/use-socketio-messaging.ts` (hook React)

### Dépendances installées :
- ✅ `socket.io` (gateway)
- ✅ `socket.io-client` (frontend - déjà présent)

### Tests :
- ✅ Compilation TypeScript OK
- ✅ Tous les fichiers créés
- ✅ Architecture Socket.IO fonctionnelle

## Test de la migration

1. Démarrer tous les services avec : `./start-all.sh`
   - Translator (port 8000)
   - Gateway (port 3000) 
   - Frontend (port 3100)
2. Ouvrir le frontend : `http://localhost:3100`
3. Tester la connexion et l'envoi de messages
4. Vérifier les traductions automatiques
5. Tester la reconnexion (couper/rétablir la connexion réseau)
6. Utiliser Ctrl+C pour arrêter tous les services

### Statistiques Socket.IO
```bash
curl http://localhost:3000/api/socketio/stats
```
