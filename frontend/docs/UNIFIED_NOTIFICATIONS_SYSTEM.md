# Système de Notifications Unifié

## Vue d'ensemble

Le système de notifications unifié de Meeshy centralise la gestion de toutes les notifications (messages, système, conversations, traductions) en dissociant complètement la réception des messages de celle des notifications.

## Architecture

### Frontend

#### Service de Notifications (`notification.service.ts`)
- **Singleton** : Une seule instance pour toute l'application
- **Gestion centralisée** : Toutes les notifications passent par ce service
- **Types de notifications** : `message`, `system`, `user_action`, `conversation`, `translation`
- **Multilingue** : Support des traductions FR/EN/ES
- **Compteurs** : Suivi automatique des notifications lues/non lues

#### Hook `useNotifications`
- **Interface unifiée** : Un seul hook pour toutes les notifications
- **État réactif** : Mise à jour automatique des compteurs et listes
- **Actions** : Marquer comme lu, supprimer, vider
- **Toasts** : Affichage automatique des notifications

#### Composants

##### `NotificationBell`
- **Pastille dynamique** : Affiche le nombre de notifications non lues
- **Responsive** : S'adapte à différents contextes (header, navigation)
- **Actions** : Clic pour ouvrir le centre de notifications

##### `NotificationCenter`
- **Interface complète** : Liste, actions, filtres
- **Types visuels** : Icônes et couleurs par type de notification
- **Actions** : Marquer comme lu, supprimer, vider tout
- **Navigation** : Clic pour aller à la conversation

##### `NotificationProvider`
- **Initialisation automatique** : Se connecte quand l'utilisateur est authentifié
- **Gestion du cycle de vie** : Connexion/déconnexion automatique

### Backend

#### Service Unifié (`UnifiedNotificationService.ts`)
- **Dissociation** : Complètement séparé de la gestion des messages
- **Types multiples** : Gère tous les types de notifications
- **Logique métier** : Détermine qui doit recevoir quelles notifications
- **Multilingue** : Construit les messages dans les 3 langues

#### Intégration Socket.IO
- **Événements dédiés** : `newNotification` pour toutes les notifications
- **Ciblage précis** : Envoi uniquement aux utilisateurs concernés
- **États de connexion** : Prise en compte des utilisateurs connectés/déconnectés

## Types de Notifications

### Messages (`message`)
- **Déclencheur** : Nouveau message dans une conversation
- **Cible** : Membres de la conversation non connectés
- **Contenu** : Message original + traductions disponibles
- **Action** : Redirection vers la conversation

### Système (`system`)
- **Déclencheur** : Événements système (mises à jour, maintenance)
- **Cible** : Utilisateurs spécifiques ou tous
- **Contenu** : Message système
- **Action** : Aucune action spécifique

### Conversations (`conversation`)
- **Déclencheur** : Changements dans les conversations (ajout/suppression de membres)
- **Cible** : Membres de la conversation
- **Contenu** : Description de l'action
- **Action** : Redirection vers la conversation

### Traductions (`translation`)
- **Déclencheur** : Traduction disponible pour un message
- **Cible** : Membres de la conversation non connectés
- **Contenu** : Message original + nouvelle traduction
- **Action** : Redirection vers la conversation

## Flux de Données

### Réception d'un Message
1. **Message reçu** → `MeeshySocketIOManager._handleNewMessage`
2. **Diffusion** → Envoi aux utilisateurs connectés dans la conversation
3. **Notification** → `UnifiedNotificationService.sendMessageNotification`
4. **Ciblage** → Utilisateurs non connectés ou pas dans la conversation
5. **Envoi** → Socket.IO `newNotification` event

### Traduction Disponible
1. **Traduction terminée** → `MeeshySocketIOManager._handleTranslationReady`
2. **Diffusion** → Envoi aux utilisateurs connectés
3. **Notification** → `UnifiedNotificationService.sendTranslationNotification`
4. **Ciblage** → Utilisateurs non connectés
5. **Envoi** → Socket.IO `newNotification` event

### Frontend
1. **Connexion** → `NotificationService.initialize`
2. **Écoute** → Socket.IO events (`newMessageNotification`, `systemNotification`, etc.)
3. **Traitement** → Construction des objets `Notification`
4. **Stockage** → Map locale des notifications
5. **Affichage** → Toast + mise à jour des compteurs
6. **Interface** → `NotificationBell` et `NotificationCenter`

## Configuration

### Variables d'Environnement
```typescript
// Frontend
NEXT_PUBLIC_BACKEND_URL=ws://localhost:3001

// Backend
SOCKET_IO_PATH=/socket.io/
```

### Types Socket.IO
```typescript
// Nouveaux événements
NEW_NOTIFICATION: 'newNotification'

// Interface
[SERVER_EVENTS.NEW_NOTIFICATION]: (data: any) => void;
```

## Utilisation

### Intégration dans un Composant
```tsx
import { useNotifications } from '@/hooks/use-notifications';

function MyComponent() {
  const { unreadCount, notifications, markAsRead } = useNotifications();
  
  return (
    <div>
      <NotificationBell />
      {unreadCount > 0 && (
        <p>Vous avez {unreadCount} notifications non lues</p>
      )}
    </div>
  );
}
```

### Ajout d'une Notification Système
```typescript
// Backend
await unifiedNotificationService.sendSystemNotification(
  userId,
  'Mise à jour disponible',
  'Une nouvelle version de l\'application est disponible',
  { version: '2.0.0' }
);
```

### Personnalisation des Toasts
```typescript
const { showToast } = useNotifications();

// Toast personnalisé
showToast({
  id: 'custom-1',
  type: 'system',
  title: 'Action terminée',
  message: 'Votre action a été effectuée avec succès',
  timestamp: new Date(),
  isRead: false
});
```

## Avantages

### Architecture
- **Séparation des responsabilités** : Messages ≠ Notifications
- **Extensibilité** : Facile d'ajouter de nouveaux types
- **Maintenabilité** : Code centralisé et organisé

### Performance
- **Ciblage précis** : Seuls les utilisateurs concernés reçoivent les notifications
- **Optimisation réseau** : Un seul canal Socket.IO pour toutes les notifications
- **Cache local** : Notifications stockées côté client

### Expérience Utilisateur
- **Pastilles dynamiques** : Compteurs en temps réel
- **Multilingue** : Messages dans les 3 langues
- **Actions contextuelles** : Redirection vers les conversations
- **Gestion complète** : Marquer comme lu, supprimer, vider

## Tests

### Tests Unitaires
- **Service** : Initialisation, gestion des notifications
- **Hook** : État, actions, intégration
- **Composants** : Affichage, interactions

### Tests d'Intégration
- **Flux complet** : Message → Notification → Affichage
- **Multilingue** : Traductions et affichage
- **États de connexion** : Connecté/déconnecté

## Migration

### Depuis l'Ancien Système
1. **Remplacer** les anciens hooks par `useNotifications`
2. **Mettre à jour** les composants pour utiliser `NotificationBell`
3. **Migrer** les événements Socket.IO vers `newNotification`
4. **Tester** le flux complet

### Compatibilité
- **Rétrocompatible** : L'ancien système continue de fonctionner
- **Migration progressive** : Peut être fait composant par composant
- **Rollback** : Possibilité de revenir en arrière si nécessaire

