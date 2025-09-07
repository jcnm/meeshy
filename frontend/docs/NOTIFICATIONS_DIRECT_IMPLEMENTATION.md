# Implémentation des Notifications pour Conversations Directes

## Vue d'ensemble

Cette implémentation ajoute un système de notifications toast pour les conversations directes avec support multilingue (français, anglais, espagnol).

## Fonctionnalités

### 1. Notifications Multilingues
- **Français (🇫🇷)** : Langue de base du système
- **Anglais (🇺🇸)** : Traduction automatique
- **Espagnol (🇪🇸)** : Traduction automatique

### 2. Types de Conversations Supportés
- **Direct** : Messages privés entre deux utilisateurs (💬)
- **Groupe** : Messages dans un groupe (👥)
- **Public** : Messages dans une conversation publique (🌐)
- **Global** : Messages globaux (🌍)

### 3. Fonctionnalités des Toasts
- Affichage du message original et des traductions
- Durée d'affichage adaptée (6s si traductions, 4s sinon)
- Bouton "Voir" pour rediriger vers la conversation
- Icônes adaptées au type de conversation

## Structure des Fichiers

```
frontend/
├── hooks/
│   └── use-notifications.ts          # Hook principal pour les notifications
├── utils/
│   └── notification-translations.ts  # Utilitaires pour les traductions
├── services/
│   └── notification.service.ts       # Service de gestion des notifications
├── components/
│   └── notifications/
│       └── NotificationProvider.tsx  # Provider pour initialisation auto
└── __tests__/
    └── notifications-direct.test.tsx # Tests unitaires
```

## Utilisation

### 1. Initialisation Automatique

Le `NotificationProvider` s'initialise automatiquement lors de l'authentification :

```tsx
import { NotificationProvider } from '@/components/notifications/NotificationProvider';

function App() {
  return (
    <NotificationProvider>
      {/* Votre application */}
    </NotificationProvider>
  );
}
```

### 2. Utilisation du Hook

```tsx
import { useNotifications } from '@/hooks/use-notifications';

function MyComponent() {
  const { 
    notifications, 
    isConnected, 
    connectToNotifications,
    markAsRead 
  } = useNotifications();

  // Les notifications sont automatiquement gérées
  return (
    <div>
      <p>Statut: {isConnected ? 'Connecté' : 'Déconnecté'}</p>
      <p>Notifications: {notifications.length}</p>
    </div>
  );
}
```

### 3. Format des Données de Notification

```typescript
interface MessageNotificationData {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  conversationId: string;
  conversationType: 'direct' | 'group' | 'public' | 'global';
  timestamp: string;
  translations?: {
    fr?: string;
    en?: string;
    es?: string;
  };
}
```

## Exemple de Toast

### Message Direct avec Traductions

```
💬 Message direct de Jean Dupont

🇫🇷 Salut ! Comment ça va ?
🇺🇸 Hi! How are you?
🇪🇸 ¡Hola! ¿Cómo estás?

[Voir] (bouton)
```

### Message Simple

```
💬 Message direct de Marie Martin

Bonjour, j'espère que vous allez bien.

[Voir] (bouton)
```

## Configuration

### Variables d'Environnement

```env
# URL du backend pour les WebSockets
NEXT_PUBLIC_BACKEND_URL=ws://localhost:3001
```

### Personnalisation

Vous pouvez modifier les langues supportées dans `notification-translations.ts` :

```typescript
export interface NotificationTranslations {
  fr?: string;
  en?: string;
  es?: string;
  // Ajouter d'autres langues si nécessaire
  de?: string;
  it?: string;
}
```

## Tests

Exécuter les tests :

```bash
npm test notifications-direct.test.tsx
```

## Intégration Backend

Le backend doit envoyer des événements WebSocket avec la structure suivante :

```typescript
// Événement: newMessageNotification
{
  messageId: "msg-123",
  senderId: "user-456", 
  senderName: "Jean Dupont",
  content: "Message original",
  conversationId: "conv-789",
  conversationType: "direct",
  timestamp: "2024-01-15T10:30:00Z",
  translations: {
    fr: "Message original",
    en: "Original message", 
    es: "Mensaje original"
  }
}
```

## Dépannage

### Problèmes Courants

1. **Notifications non reçues**
   - Vérifier que l'utilisateur est authentifié
   - Vérifier la connexion WebSocket
   - Vérifier les logs de la console

2. **Traductions manquantes**
   - Vérifier que le service de traduction est actif
   - Vérifier la structure des données reçues

3. **Toasts non affichés**
   - Vérifier que Sonner est correctement configuré
   - Vérifier les permissions du navigateur

### Logs de Debug

```typescript
// Activer les logs détaillés
console.log('🔔 Connecté au service de notifications');
console.log('💬 Nouvelle notification reçue:', data);
```

## Performance

- **Connexions WebSocket** : Une seule connexion par utilisateur
- **Mémoire** : Maximum 10 notifications en mémoire
- **Durée d'affichage** : Adaptée au contenu (4-6 secondes)
- **Troncature** : Messages limités à 30 caractères par langue

