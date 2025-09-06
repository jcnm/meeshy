# Guide des Toasts Traduits

Ce guide explique comment utiliser le système de toasts traduits dans l'application Meeshy.

## Problème résolu

Avant cette mise à jour, les messages de toast étaient codés en dur en français, ce qui causait des problèmes d'internationalisation. Maintenant, tous les toasts utilisent le système de traduction i18n.

## Utilisation

### 1. Hook useTranslatedToast (Recommandé)

Pour les nouveaux composants, utilisez le hook `useTranslatedToast` :

```typescript
import { useTranslatedToast } from '@/hooks/use-translated-toast';

function MyComponent() {
  const { toastSuccess, toastError, toastWarning, toastInfo } = useTranslatedToast();

  const handleAction = () => {
    toastSuccess('toasts.messages.sent');
    toastError('toasts.messages.sendError');
  };
}
```

### 2. Hook useTranslations (Pour les composants existants)

Pour les composants qui utilisent déjà `useTranslations`, vous pouvez directement utiliser les clés de traduction :

```typescript
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

function MyComponent() {
  const t = useTranslations();

  const handleAction = () => {
    toast.success(t('toasts.messages.sent'));
    toast.error(t('toasts.messages.sendError'));
  };
}
```

## Clés de traduction disponibles

### Connexion
- `toasts.connection.established` - "Connexion établie"
- `toasts.connection.disconnected` - "Déconnecté par le serveur"
- `toasts.connection.lost` - "Connexion perdue, reconnexion..."
- `toasts.connection.reconnecting` - "Connexion en cours - Veuillez patienter..."
- `toasts.connection.websocketConnecting` - "Connexion WebSocket en cours..."
- `toasts.connection.reconnectSuccess` - "Reconnexion réussie !"
- `toasts.connection.reconnectFailed` - "Reconnexion échouée - Vérifiez le serviteur"
- `toasts.connection.cannotReconnect` - "Impossible de se reconnecter. Veuillez recharger la page."

### Messages
- `toasts.messages.sent` - "Message envoyé !"
- `toasts.messages.sendError` - "Erreur lors de l'envoi du message"
- `toasts.messages.editSoon` - "Édition de message bientôt disponible"
- `toasts.messages.translationError` - "Erreur lors de la demande de traduction"
- `toasts.messages.translationMaxTier` - "Cette traduction utilise déjà le tier le plus élevé"
- `toasts.messages.translationInProgress` - "Traduction en cours..."
- `toasts.messages.retranslationInProgress` - "Retraduction forcée en cours..."
- `toasts.messages.translationSuccess` - "Message traduit avec {model}"
- `toasts.messages.textCopied` - "Texte copié"

### Conversations
- `toasts.conversations.loadError` - "Impossible de charger les conversations"
- `toasts.conversations.loadErrorGeneric` - "Erreur lors du chargement de la conversation"

### Authentification
- `toasts.auth.logoutSuccess` - "Déconnexion réussie"
- `toasts.auth.fillAllFields` - "Veuillez remplir tous les champs"
- `toasts.auth.connectionError` - "Erreur de connexion"
- `toasts.auth.serverConnectionError` - "Erreur de connexion au serveur"

### Paramètres
- `toasts.settings.saved` - "Paramètres sauvegardés avec succès"
- `toasts.settings.saveError` - "Erreur lors de la sauvegarde"
- `toasts.settings.reset` - "Paramètres réinitialisés"

### Liens
- `toasts.links.copied` - "Lien copié dans le presse-papiers"
- `toasts.links.generated` - "Lien généré avec succès !"
- `toasts.links.generatedAndCopied` - "Lien généré et copié dans le presse-papiers !"
- `toasts.links.generateError` - "Erreur lors de la génération du lien"

### Participants
- `toasts.participants.removed` - "Participant supprimé de la conversation"
- `toasts.participants.removeError` - "Erreur lors de la suppression du participant"

### Conversation
- `toasts.conversation.nameUpdated` - "Nom de la conversation mis à jour"
- `toasts.conversation.nameUpdateError` - "Erreur lors de la mise à jour du nom"
- `toasts.conversation.created` - "Conversation créée avec succès"

## Interpolation de variables

Pour les messages avec des variables, utilisez les méthodes avec `WithVars` :

```typescript
const { toastSuccessWithVars } = useTranslatedToast();

toastSuccessWithVars('toasts.messages.translationSuccess', { model: 'GPT-4' });
```

## Ajout de nouvelles traductions

1. Ajoutez la clé dans les trois fichiers de langue :
   - `frontend/locales/fr.json`
   - `frontend/locales/en.json`
   - `frontend/locales/pt.json`

2. Utilisez la clé dans votre code avec le hook approprié.

## Test

Utilisez le composant `ToastDemo` pour tester les traductions :

```typescript
import { ToastDemo } from '@/components/demo/ToastDemo';

// Dans votre page de test
<ToastDemo />
```

## Migration

Pour migrer les toasts existants :

1. Remplacez les messages codés en dur par des clés de traduction
2. Ajoutez les traductions manquantes dans les fichiers de langue
3. Testez que les toasts s'affichent dans la bonne langue

## Exemple complet

```typescript
import { useTranslatedToast } from '@/hooks/use-translated-toast';

function MessageSender() {
  const { toastSuccess, toastError, toastSuccessWithVars } = useTranslatedToast();

  const sendMessage = async (content: string) => {
    try {
      await messageService.send(content);
      toastSuccess('toasts.messages.sent');
    } catch (error) {
      toastError('toasts.messages.sendError');
    }
  };

  const translateMessage = async (messageId: string, model: string) => {
    try {
      await translationService.translate(messageId);
      toastSuccessWithVars('toasts.messages.translationSuccess', { model });
    } catch (error) {
      toastError('toasts.messages.translationError');
    }
  };

  return (
    // Votre composant
  );
}
```
