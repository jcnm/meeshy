# Navigation sans rechargement - Documentation technique

## Vue d'ensemble

Cette documentation décrit l'implémentation de la navigation sans rechargement dans l'application Meeshy, permettant une expérience utilisateur fluide et performante.

## Problème résolu

### Avant l'optimisation
- La page `/conversations` se rechargeait complètement lors de la sélection d'une conversation
- Utilisation de `router.push()` causait une navigation Next.js complète
- Perte de l'état local (messages, scroll, etc.)
- Performance dégradée avec des temps de chargement longs

### Après l'optimisation
- Navigation instantanée basée sur l'état React
- Préservation de la position de scroll
- URL synchronisée sans rechargement
- Support complet des boutons navigateur (retour/avancer)

## Architecture de la solution

### 1. Gestion de l'état

```typescript
// États principaux
const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
const [showConversationList, setShowConversationList] = useState(true);
const conversationListRef = useRef<HTMLDivElement>(null);
const scrollPositionRef = useRef<number>(0);
```

### 2. Navigation sans rechargement

```typescript
const handleSelectConversation = useCallback((conversation: Conversation) => {
  // Sauvegarde de la position de scroll
  saveScrollPosition();
  
  // Mise à jour de l'état
  setSelectedConversation(conversation);
  
  // Mise à jour de l'URL sans navigation
  window.history.replaceState(
    { conversationId: conversation.id }, 
    '', 
    `/conversations/${conversation.id}`
  );
  
  // Restauration du scroll
  setTimeout(restoreScrollPosition, 100);
}, [selectedConversation?.id, isMobile, saveScrollPosition, restoreScrollPosition]);
```

### 3. Gestion des boutons navigateur

```typescript
useEffect(() => {
  const handlePopState = (event: PopStateEvent) => {
    const conversationId = event.state?.conversationId || null;
    
    if (conversationId) {
      const conversation = conversations.find(c => c.id === conversationId);
      if (conversation) {
        setSelectedConversation(conversation);
      }
    } else {
      setSelectedConversation(null);
    }
  };

  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, [conversations, isMobile]);
```

### 4. Préservation du scroll

```typescript
const saveScrollPosition = useCallback(() => {
  if (conversationListRef.current) {
    const scrollContainer = conversationListRef.current.querySelector('.overflow-y-auto');
    if (scrollContainer) {
      scrollPositionRef.current = scrollContainer.scrollTop;
    }
  }
}, []);

const restoreScrollPosition = useCallback(() => {
  if (conversationListRef.current) {
    const scrollContainer = conversationListRef.current.querySelector('.overflow-y-auto');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollPositionRef.current;
    }
  }
}, []);
```

## Flux de données

### Sélection de conversation
1. Utilisateur clique sur une conversation
2. `handleSelectConversation` est appelé
3. Position de scroll sauvegardée
4. État mis à jour (conversation sélectionnée)
5. URL mise à jour avec `replaceState`
6. Messages chargés via effet React
7. Position de scroll restaurée

### Retour à la liste
1. Utilisateur clique sur le bouton retour
2. `handleBackToList` est appelé
3. Conversation désélectionnée
4. URL mise à jour vers `/conversations`
5. État vide affiché

### Navigation directe par URL
1. Utilisateur accède directement à `/conversations/[id]`
2. Effet React détecte l'ID dans l'URL
3. Conversation correspondante sélectionnée
4. Messages chargés automatiquement

## Optimisations de performance

### 1. Chargement initial unique
```typescript
useEffect(() => {
  if (user && conversations.length === 0) {
    loadData();
  }
}, [user]); // Dépendance minimale
```

### 2. Mémorisation des calculs
- Utilisation de `useMemo` pour les listes filtrées
- Utilisation de `useCallback` pour les handlers
- Props stables pour éviter les re-rendus

### 3. Chargement des messages optimisé
- Chargement uniquement si conversation différente
- Clear des messages de l'ancienne conversation
- Éviter les requêtes en double

## Points d'attention

### Mobile vs Desktop
- Sur mobile : masquer/afficher la liste selon la sélection
- Sur desktop : toujours afficher la liste

### WebSocket
- Maintien des abonnements lors de la navigation
- Pas de reconnexion inutile
- Gestion des événements en temps réel

### Sécurité
- Validation des IDs de conversation
- Gestion des erreurs de chargement
- Fallback en cas d'échec

## Tests recommandés

1. **Navigation basique**
   - Sélectionner une conversation
   - Vérifier l'absence de rechargement
   - Vérifier la mise à jour de l'URL

2. **Préservation du scroll**
   - Faire défiler la liste
   - Sélectionner une conversation
   - Revenir et vérifier la position

3. **Boutons navigateur**
   - Utiliser retour/avancer
   - Vérifier la synchronisation

4. **Performance**
   - Mesurer le temps de sélection
   - Vérifier l'absence de fuites mémoire
   - Monitorer les re-rendus

## Maintenance

### Ajout de nouvelles fonctionnalités
1. Maintenir la séparation état/navigation
2. Utiliser `replaceState` pour les changements d'URL
3. Éviter `router.push` pour la navigation interne

### Debugging
- Logs avec préfixe `[NAVIGATION]` pour le flux
- Logs avec préfixe `[SCROLL]` pour la position
- Console warnings pour les cas d'erreur

## Conclusion

Cette implémentation offre une navigation fluide et performante, améliorant significativement l'expérience utilisateur tout en maintenant la synchronisation avec l'URL pour le partage et les marque-pages.
