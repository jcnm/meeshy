# Mapping Complet Pages Frontend / Endpoints Backend - Meeshy

## Pages Frontend Existantes

### Authentification
- **src/app/page.tsx** - Landing page (accueil)
- **src/app/login/page.tsx** - Page de connexion
- **src/app/dashboard/page.tsx** - Tableau de bord principal

### Messagerie
- **src/app/conversations/page.tsx** - Liste des conversations
- **src/app/conversations/[id]/page.tsx** - Conversation spécifique
- **src/app/chat/[id]/page.tsx** - Interface de chat temps réel

### Groupes
- **src/app/groups/page.tsx** - Liste des groupes
- **src/app/groups/[id]/page.tsx** - Groupe spécifique

### Gestion
- **src/app/contacts/page.tsx** - Gestion des contacts
- **src/app/settings/page.tsx** - Paramètres utilisateur
- **src/app/links/page.tsx** - Gestion des liens de partage
- **src/app/join/[linkId]/page.tsx** - Rejoindre via lien
- **src/app/test/page.tsx** - Page de test/développement

## Endpoints Backend Disponibles

### Authentification (`/auth`)
- **POST** `/auth/register` - Inscription utilisateur
- **POST** `/auth/login` - Connexion utilisateur  
- **GET** `/auth/me` - Profil utilisateur connecté
- **GET** `/auth/profile` - Profil utilisateur (alias)
- **POST** `/auth/logout` - Déconnexion

### Utilisateurs (`/users`)
- **GET** `/users` - Liste de tous les utilisateurs
- **GET** `/users/search?q=query` - Recherche d'utilisateurs
- **GET** `/users/me` - Mon profil
- **PATCH** `/users/me` - Mettre à jour mon profil
- **GET** `/users/me/stats` - Mes statistiques
- **GET** `/users/:id` - Profil d'un utilisateur
- **GET** `/users/:id/stats` - Statistiques d'un utilisateur

### Conversations (`/conversation`)
- **POST** `/conversation` - Créer une conversation
- **GET** `/conversation` - Mes conversations
- **GET** `/conversation/link/:linkId` - Info conversation par lien
- **POST** `/conversation/join/:linkId` - Rejoindre par lien
- **GET** `/conversation/:id` - Détails conversation
- **POST** `/conversation/join` - Rejoindre conversation
- **DELETE** `/conversation/:id/leave` - Quitter conversation
- **GET** `/conversation/:id/messages` - Messages d'une conversation
- **POST** `/conversation/:id/messages` - Envoyer message
- **GET** `/conversation/user/:userId` - Conversations d'un utilisateur
- **GET** `/conversation/links/user/:userId` - Liens d'un utilisateur
- **POST** `/conversation/create-link` - Créer lien de partage
- **GET** `/conversation/group/:groupId` - Conversations d'un groupe

### Groupes (`/groups`)
- **POST** `/groups` - Créer un groupe
- **GET** `/groups` - Mes groupes
- **GET** `/groups/search?q=query&page=1` - Rechercher groupes publics
- **GET** `/groups/:id` - Détails d'un groupe
- **PATCH** `/groups/:id` - Mettre à jour groupe
- **POST** `/groups/:id/join` - Rejoindre groupe
- **DELETE** `/groups/:id/leave` - Quitter groupe
- **POST** `/groups/:id/members/:userId` - Ajouter membre
- **DELETE** `/groups/:id/members/:userId` - Supprimer membre
- **PATCH** `/groups/:id/members/:userId/role` - Changer rôle membre

### Messages (`/message`)
- **POST** `/message` - Créer message
- **GET** `/message/conversation/:conversationId?page=1&limit=50` - Messages par conversation
- **PATCH** `/message/:id` - Modifier message
- **DELETE** `/message/:id` - Supprimer message
- **GET** `/message/search/:conversationId?q=query` - Rechercher dans messages

### Notifications (`/notifications`)
- **GET** `/notifications` - Mes notifications
- **DELETE** `/notifications/:notificationId` - Marquer notification lue
- **DELETE** `/notifications` - Marquer toutes lues
- **GET** `/notifications/preferences` - Préférences notifications
- **POST** `/notifications/preferences` - Mettre à jour préférences
- **POST** `/notifications/test` - Envoyer notification test
- **GET** `/notifications/stats` - Statistiques notifications

### Santé/Monitoring (`/health`)
- **GET** `/health` - Check basique
- **GET** `/health/detailed` - Check complet avec métriques
- **GET** `/health/ready` - Kubernetes readiness probe
- **GET** `/health/live` - Kubernetes liveness probe
- **GET** `/health/metrics` - Métriques système

## Pages Frontend Manquantes

### 1. Profil Utilisateur
**Page manquante :** `src/app/profile/page.tsx` ou `src/app/users/[id]/page.tsx`
**Endpoints disponibles :**
- `GET /users/:id` - Profil utilisateur
- `GET /users/:id/stats` - Statistiques utilisateur
- `PATCH /users/me` - Modifier profil (si c'est mon profil)

### 2. Mon Profil / Paramètres Profil
**Page manquante :** `src/app/profile/edit/page.tsx` ou section dans settings
**Endpoints disponibles :**
- `GET /users/me` - Mon profil
- `PATCH /users/me` - Modifier mon profil
- `GET /users/me/stats` - Mes statistiques

### 3. Recherche Globale
**Page manquante :** `src/app/search/page.tsx`
**Endpoints disponibles :**
- `GET /users/search?q=query` - Rechercher utilisateurs
- `GET /groups/search?q=query&page=1` - Rechercher groupes
- `GET /message/search/:conversationId?q=query` - Rechercher messages

### 4. Notifications
**Page manquante :** `src/app/notifications/page.tsx`
**Endpoints disponibles :**
- `GET /notifications` - Liste notifications
- `DELETE /notifications/:id` - Marquer lue
- `DELETE /notifications` - Marquer toutes lues
- `GET/POST /notifications/preferences` - Gérer préférences

### 5. Historique de Traduction
**Page manquante :** `src/app/translations/page.tsx`
**Endpoints à créer :** Système de cache localStorage côté client

### 6. Administration / Modération
**Pages manquantes :**
- `src/app/admin/page.tsx` - Dashboard admin
- `src/app/admin/users/page.tsx` - Gestion utilisateurs
- `src/app/admin/groups/page.tsx` - Gestion groupes
**Endpoints disponibles partiels :**
- `GET /users` - Tous les utilisateurs
- `GET /health/*` - Monitoring système
- `GET /notifications/stats` - Stats notifications

### 7. Aide et Support
**Pages manquantes :**
- `src/app/help/page.tsx` - Centre d'aide
- `src/app/about/page.tsx` - À propos
- `src/app/privacy/page.tsx` - Politique de confidentialité
- `src/app/terms/page.tsx` - Conditions d'utilisation

### 8. Gestion des Sessions
**Page manquante :** `src/app/sessions/page.tsx`
**Endpoints manquants :** Sessions actives, révocation tokens

## Services Frontend Manquants

### 1. NotificationsService
**Fichier manquant :** `src/services/notificationsService.ts`
**Endpoints backend :** Tous disponibles

### 2. UsersService
**Fichier manquant :** `src/services/usersService.ts`
**Endpoints backend :** Tous disponibles

### 3. MessagesService
**Fichier manquant :** `src/services/messagesService.ts`
**Endpoints backend :** Tous disponibles

### 4. TranslationService
**Fichier manquant :** `src/services/translationService.ts`
**Logique :** Côté client uniquement (TensorFlow.js + cache localStorage)

### 5. WebSocketService
**Fichier manquant :** `src/services/websocketService.ts`
**Backend :** Gateway WebSocket disponible

## Endpoints Backend Non Utilisés

### Conversations avancées
- `GET /conversation/user/:userId` - Conversations d'un autre utilisateur
- `GET /conversation/links/user/:userId` - Liens d'un autre utilisateur
- `GET /conversation/group/:groupId` - Conversations d'un groupe

### Messages avancés
- `GET /message/search/:conversationId?q=query` - Recherche dans messages

### Monitoring
- `GET /health/ready` - Kubernetes readiness
- `GET /health/live` - Kubernetes liveness  
- `GET /health/metrics` - Métriques système

### Notifications avancées
- `POST /notifications/test` - Test notifications
- `GET /notifications/stats` - Statistiques

## Priorités de Développement

### Phase 1 - Fonctionnalités Essentielles
1. **NotificationsService** + Page notifications
2. **UsersService** + Pages profil utilisateur
3. **MessagesService** + Amélioration chat
4. **Page de recherche globale**

### Phase 2 - Fonctionnalités Avancées
1. **TranslationService** + Cache localStorage
2. **WebSocketService** + Temps réel
3. **Historique de traduction**
4. **Gestion des sessions**

### Phase 3 - Administration
1. **Pages d'administration**
2. **Monitoring frontend**
3. **Aide et support**

## Notes Techniques

### Types Partagés
- Vérifier cohérence types frontend/backend
- Exporter types manquants depuis `src/types/index.ts`

### Sécurité
- Tous les endpoints backend sont protégés par JWT
- Validation côté client ET serveur nécessaire

### Performance
- Cache localStorage pour traductions
- Pagination sur tous les endpoints de liste
- WebSockets pour temps réel

### UX/UI
- Interface responsive (mobile/desktop)
- Loading states et error handling
- Notifications sonores avec Sonner
- Accessibilité (ARIA, navigation clavier)
