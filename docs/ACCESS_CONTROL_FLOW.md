# Flux de contrôle d'accès dans Meeshy

## Vue d'ensemble

Ce document décrit comment les différents types d'utilisateurs accèdent aux différentes pages de l'application.

## Types d'utilisateurs

1. **Utilisateurs non authentifiés** : Aucune session active
2. **Utilisateurs authentifiés** : Session avec compte permanent
3. **Participants anonymes** : Session temporaire liée à une conversation spécifique

## Contrôle d'accès par page

### Page d'accueil (`/`)

- **Non authentifiés** ✅ : Voient la landing page
- **Authentifiés** ✅ : Voient BubbleStreamPage dans DashboardLayout
- **Anonymes** ↪️ : Redirigés vers `/chat/[id]` s'ils ont une conversation en cours

**Composants de protection** :
- `AnonymousRedirect` : Redirige les anonymes avec conversation active

### Page de chat (`/chat/[conversationShareLinkId]`)

- **Non authentifiés** ✅ : Peuvent rejoindre comme anonymes
- **Authentifiés** ✅ : Accès complet
- **Anonymes** ✅ : Accès à leur conversation spécifique uniquement

**Composants de protection** :
- Aucun - Accès ouvert mais limité au contexte de la conversation

### Page conversations (`/conversations`)

- **Non authentifiés** ❌ : Redirigés vers `/login`
- **Authentifiés** ✅ : Accès complet
- **Anonymes** ❌ : Bloqués par `AuthGuard`

**Composants de protection** :
- `AuthGuard` avec `requireAuth={true}` et `allowAnonymous={false}`

## Flux de navigation

### Pour un participant anonyme

```
1. Rejoint via /join/[linkId]
   ↓
2. Crée une session anonyme
   ↓
3. Redirigé vers /chat/[conversationShareLinkId]
   ↓
4. S'il navigue vers / → Redirigé automatiquement vers /chat/[id]
5. S'il essaie d'accéder à /conversations → Bloqué
```

### Pour un utilisateur authentifié

```
1. Se connecte via /login
   ↓
2. Peut accéder à :
   - / (BubbleStreamPage)
   - /conversations (toutes ses conversations)
   - /chat/[id] (conversations partagées)
```

## Composants de protection

### `AuthGuard`
```tsx
<AuthGuard requireAuth={true} allowAnonymous={false}>
  {/* Contenu protégé */}
</AuthGuard>
```

### `AnonymousRedirect`
```tsx
<AnonymousRedirect redirectToChat={true}>
  {/* Contenu qui redirige les anonymes */}
</AnonymousRedirect>
```

## Stockage local pour les anonymes

Les participants anonymes utilisent le localStorage pour maintenir leur session :
- `anonymous_session_token` : Token de session
- `anonymous_participant` : Données du participant
- `anonymous_current_share_link` : ID du lien de partage
- `anonymous_current_link_id` : ID du lien original

## Règles importantes

1. **Les participants anonymes ne peuvent JAMAIS accéder à `/conversations`**
2. **Les participants anonymes sont toujours liés à UNE SEULE conversation**
3. **La transition anonyme → authentifié nécessite la création d'un compte**
4. **Les données anonymes sont effacées lors du logout ou de la création de compte**
