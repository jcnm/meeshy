# Communication en Temps Réel - Meeshy

## Fonctionnalités Implémentées

### 1. Détection Automatique de Connexion WebSocket
- **Mode Hybride** : Le système démarre en mode démo et bascule automatiquement en mode temps réel quand la connexion WebSocket est établie
- **Indicateur Visuel** : Badge coloré en haut de l'interface qui montre le statut actuel
  - 🟢 Vert : Messages en temps réel (WebSocket connecté)
  - 🟠 Orange : Mode démonstration (WebSocket déconnecté)
- **Bouton de Reconnexion** : Permet de forcer une reconnexion en cas de problème

### 2. Réception des Messages des Autres Utilisateurs
- **Hook `useMessaging` Étendu** : Ajoute le support des événements de frappe et de statut utilisateur
- **Gestion des Messages Entrants** : 
  - Filtrage par conversation (global_stream)
  - Notifications toast pour les nouveaux messages
  - Évitement des doublons
  - Auto-scroll vers les nouveaux messages

### 3. Indicateurs de Frappe en Temps Réel
- **Affichage des Utilisateurs qui Écrivent** : Indicateur animé avec points qui bougent
- **Messages Contextuels** :
  - 1 utilisateur : "Alice est en train d'écrire..."
  - 2 utilisateurs : "Alice et Bob sont en train d'écrire..."
  - 3+ utilisateurs : "Alice et 2 autres sont en train d'écrire..."
- **Nettoyage Automatique** : Les indicateurs disparaissent après 5 secondes d'inactivité

### 4. Chargement des Messages Existants
- **Synchronisation** : Charge automatiquement les messages existants depuis le serveur quand on passe en mode temps réel
- **API Endpoint** : `/api/conversations/global_stream/messages`
- **Authentification** : Utilise le token JWT stocké en localStorage

### 5. Gestion d'État Avancée
- **Optimistic Updates** : Les messages sont affichés immédiatement, puis confirmés par le serveur
- **Rollback en Cas d'Erreur** : Si l'envoi échoue, le message est retiré de l'interface
- **Persistance** : Les messages restent affichés même en cas de déconnexion temporaire

## Architecture Technique

### Service de Messaging (`messaging.service.ts`)
- **Point Unique** : Gère toutes les communications WebSocket
- **Événements Supportés** :
  - `newMessage` : Nouveau message reçu
  - `messageEdited` : Message modifié
  - `messageDeleted` : Message supprimé
  - `userTyping` : Utilisateur en train d'écrire
  - `userStatusChanged` : Changement de statut utilisateur

### Hook useMessaging (`use-messaging.ts`)
- **Interface Simplifiée** : Abstrait la complexité du service
- **Callbacks Configurables** :
  - `onNewMessage` : Traite les nouveaux messages
  - `onUserTyping` : Gère les événements de frappe
  - `onUserStatus` : Suit les changements de statut

### Composant BubbleStreamPage
- **État Hybride** : Bascule automatiquement entre mode démo et temps réel
- **Interfaces Réactives** : Mise à jour en temps réel des indicateurs
- **Gestion des Erreurs** : Fallback gracieux en cas de problème réseau

## Configuration WebSocket

### URL de Connexion
```typescript
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001';
```

### Événements Écoutés
- `connect` : Connexion établie
- `disconnect` : Connexion perdue
- `newMessage` : Nouveau message global
- `userTyping` : Frappe utilisateur
- `userStatusChanged` : Statut en ligne/hors ligne

## Utilisation

### Pour les Développeurs
1. **Démarrer le Serveur WebSocket** : S'assurer que le gateway est lancé
2. **Configuration d'Environnement** : Définir `NEXT_PUBLIC_WEBSOCKET_URL`
3. **Test de Connexion** : Ouvrir plusieurs onglets pour tester la communication

### Pour les Utilisateurs
1. **Interface Intuitive** : L'indicateur de statut montre automatiquement le mode actuel
2. **Reconnexion Manuelle** : Cliquer sur "Reconnecter" si nécessaire
3. **Messages Temps Réel** : Les messages apparaissent instantanément quand la connexion est active

## Dépannage

### Problèmes Courants
1. **Mode Démo Persistant** : Vérifier que le serveur WebSocket est démarré
2. **Messages Non Reçus** : Contrôler la console pour les erreurs de connexion
3. **Indicateurs de Frappe Bloqués** : Le nettoyage automatique se fait après 5 secondes

### Logs de Debug
- `🚀 Initialisation de la connexion WebSocket`
- `📨 Nouveau message reçu`
- `⌨️ Événement de frappe`
- `🎉 Transition: Mode démo → Mode temps réel`

## Évolutions Futures
- [ ] Accusés de réception des messages
- [ ] Statut de lecture/non lu
- [ ] Notifications push
- [ ] Historique des conversations
- [ ] Chiffrement end-to-end
