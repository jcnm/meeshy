# Composants Réutilisables - Meeshy

## Architecture des Composants Partagés

Ce document décrit l'architecture des composants réutilisables pour la messagerie, les fichiers joints et les citations dans Meeshy.

## 📝 Composants Principaux

### 1. MessageComposer (`components/common/message-composer.tsx`)

**Composant principal** pour la saisie de messages avec support complet :
- ✅ Saisie de texte multi-ligne avec auto-resize
- ✅ Sélection de langue d'envoi
- ✅ Support des fichiers joints (upload)
- ✅ Support des citations (reply-to)
- ✅ Détection automatique de texte collé volumineux
- ✅ Drag & drop de fichiers
- ✅ Authentification unifiée (JWT + Session anonyme)

**Props disponibles :**
```typescript
interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  location?: string;
  isComposingEnabled?: boolean;
  placeholder?: string;
  onKeyPress?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
  choices?: LanguageChoice[];
  onAttachmentsChange?: (attachmentIds: string[]) => void;
  token?: string; // Token d'authentification (auth ou anonymous)
}
```

**Utilisé dans :**
- `/` - Page principale (via BubbleStreamPage)
- `/chat/[id]` - Conversations anonymes (via BubbleStreamPage)
- `/conversations` - Conversations authentifiées (via ConversationLayout)

---

### 2. Composants d'Attachments

#### AttachmentCarousel (`components/attachments/AttachmentCarousel.tsx`)

**Affichage des fichiers avant upload** dans le composer :
- Icônes par type de fichier
- Barre de progression d'upload
- Bouton de suppression
- Tooltip avec informations du fichier

```typescript
interface AttachmentCarouselProps {
  files: File[];
  onRemove: (index: number) => void;
  uploadProgress?: { [key: number]: number };
  disabled?: boolean;
}
```

#### MessageAttachments (`components/attachments/MessageAttachments.tsx`)

**Affichage des fichiers joints dans un message** :
- Prévisualisation d'images
- Icônes pour autres types de fichiers
- Téléchargement
- Click pour ouvrir en grand (images)

```typescript
interface MessageAttachmentsProps {
  attachments: Attachment[];
  onImageClick?: (attachmentId: string) => void;
}
```

#### AttachmentGallery (`components/attachments/AttachmentGallery.tsx`)

**Galerie d'images en plein écran** :
- Navigation entre images
- Zoom
- Téléchargement
- Navigation vers le message source

---

### 3. Système de Citations (Reply)

#### ReplyStore (`stores/reply-store.ts`)

**Store Zustand centralisé** pour gérer l'état des citations :

```typescript
interface ReplyingToMessage {
  id: string;
  content: string;
  originalLanguage: string;
  sender?: {
    id: string;
    username?: string;
    displayName?: string;
    // ...
  };
  createdAt: Date;
  translations?: Array<{
    targetLanguage: string;
    translatedContent: string;
  }>;
}

// Hooks disponibles
const { replyingTo, setReplyingTo, clearReply } = useReplyStore();
```

**Affichage dans MessageComposer** :
- Aperçu du message cité
- Nom de l'expéditeur
- Date formatée intelligemment
- Indicateur de traductions disponibles
- Bouton pour annuler la citation

---

## 🔐 Authentification Unifiée

### TokenUtils (`utils/token-utils.ts`)

**Utilitaire centralisé** pour gérer les tokens d'authentification :

```typescript
// Récupérer le token actuel (auth ou anonymous)
const tokenInfo = getAuthToken();
// tokenInfo.type: 'auth' | 'anonymous'
// tokenInfo.value: string
// tokenInfo.header: { name: string, value: string }

// Créer les headers d'authentification appropriés
const headers = createAuthHeaders(token);
// Retourne automatiquement:
// - { 'Authorization': 'Bearer <token>' } pour JWT
// - { 'X-Session-Token': '<token>' } pour session anonyme

// Vérifications
isAuthenticated(): boolean
isAnonymousUser(): boolean
```

### AttachmentService (`services/attachmentService.ts`)

**Service mis à jour** avec authentification unifiée :
- ✅ Support JWT (utilisateurs enregistrés)
- ✅ Support Session Token (utilisateurs anonymes)
- ✅ Détection automatique du type de token
- ✅ Headers corrects selon le type

---

## 🎯 Pages et Utilisation

### Page Principale (`/`)

Utilise **BubbleStreamPage** qui intègre :
- MessageComposer avec token
- AttachmentCarousel
- MessageAttachments
- AttachmentGallery
- ReplyStore

### Conversations Anonymes (`/chat/[id]`)

Utilise **BubbleStreamPage** avec :
- Mode anonyme activé
- Token de session anonyme
- Tous les composants réutilisables

### Conversations Authentifiées (`/conversations`)

Utilise **ConversationLayout** qui intègre :
- MessageComposer avec token
- AttachmentCarousel
- MessageAttachments
- ReplyStore

---

## ✅ Checklist de Réutilisabilité

- [x] **MessageComposer** : Composant unique pour toutes les pages
- [x] **Fichiers joints** : Support complet (upload, affichage, téléchargement)
- [x] **Citations** : Store centralisé + affichage intégré
- [x] **Authentification** : Gestion unifiée JWT + Session anonyme
- [x] **Types de fichiers** : Images, vidéos, audio, documents, texte
- [x] **Drag & drop** : Fonctionnel sur toutes les pages
- [x] **Mobile responsive** : Optimisé pour tous les écrans
- [x] **Accessibilité** : Tooltips, labels, ARIA

---

## 🔧 Comment Ajouter le Support sur une Nouvelle Page

1. **Importer MessageComposer** :
```typescript
import { MessageComposer } from '@/components/common/message-composer';
import { getAuthToken } from '@/utils/token-utils';
```

2. **Ajouter les états nécessaires** :
```typescript
const [message, setMessage] = useState('');
const [selectedLanguage, setSelectedLanguage] = useState('fr');
const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
```

3. **Utiliser le composant** :
```typescript
<MessageComposer
  value={message}
  onChange={setMessage}
  onSend={handleSend}
  selectedLanguage={selectedLanguage}
  onLanguageChange={setSelectedLanguage}
  onAttachmentsChange={setAttachmentIds}
  token={typeof window !== 'undefined' ? getAuthToken()?.value : undefined}
/>
```

4. **Gérer l'envoi avec attachments** :
```typescript
const handleSend = async () => {
  if (attachmentIds.length > 0) {
    await messaging.sendMessageWithAttachments(
      message,
      attachmentIds,
      selectedLanguage,
      replyToId
    );
  } else {
    await messaging.sendMessage(message, selectedLanguage, replyToId);
  }
};
```

---

## 📦 Dépendances des Composants

```
MessageComposer
  ├── AttachmentCarousel (affichage fichiers avant upload)
  ├── AttachmentService (upload vers serveur)
  ├── ReplyStore (affichage citation)
  ├── TokenUtils (authentification)
  └── LanguageFlagSelector (sélection langue)

BubbleStreamPage / ConversationLayout
  ├── MessageComposer
  ├── MessageAttachments (affichage dans messages)
  ├── AttachmentGallery (galerie plein écran)
  └── MessagingService (envoi messages)
```

---

## 🐛 Problèmes Résolus

### ❌ Problème Initial
- Upload de fichiers échouait sur `/chat` avec "Invalid JWT token"
- Token anonyme utilisait le mauvais header (`Authorization` au lieu de `X-Session-Token`)

### ✅ Solution Implémentée
1. Création de `token-utils.ts` pour détecter le type de token
2. Mise à jour d'`AttachmentService` pour utiliser les bons headers
3. Utilisation de `getAuthToken()` dans tous les composants
4. Support unifié JWT + Session Token

---

## 📚 Ressources

- **Types d'attachments** : `shared/types/attachment.ts`
- **Types de messages** : `shared/types/conversation.ts`
- **Configuration API** : `lib/config.ts`
- **Service de messaging** : `services/messaging.service.ts`

---

**Dernière mise à jour** : 2025-10-16  
**Version** : 1.0.0

