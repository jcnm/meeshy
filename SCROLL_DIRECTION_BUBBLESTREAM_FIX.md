# Correction du Scroll Automatique pour BubbleStream

## 📅 Date
21 octobre 2025

## 🎯 Problème
Dans les pages `/` et `/chat` (BubbleStream), le scroll automatique allait vers le **bas** au lieu d'aller vers le **haut**, ce qui créait une expérience utilisateur confuse :
- ❌ Au chargement initial → scroll vers le bas
- ❌ À la réception d'un message → scroll vers le bas
- ❌ À l'envoi d'un message → scroll vers le bas

**Comportement attendu** : En mode BubbleStream avec `scrollDirection='down'`, les messages récents sont affichés **EN HAUT**, donc le scroll automatique doit aller vers le **HAUT** (top: 0).

## 🏗️ Architecture du Système

### Concept de scrollDirection

```typescript
scrollDirection='up'   // Messages classiques : récents EN BAS → scroll vers le bas
scrollDirection='down' // BubbleStream : récents EN HAUT → scroll vers le haut
```

### Flux de Données
```
bubble-stream-page.tsx
    ↓ (utilise)
useConversationMessages hook (scrollDirection='down')
    ↓ (fournit messages à)
ConversationMessages.tsx (scrollDirection='down')
    ↓ (affiche)
BubbleMessageNormalView.tsx
```

## 🔧 Modifications Effectuées

### 1. **bubble-stream-page.tsx** (2 modifications)

#### A. Réception de Message d'Autre Utilisateur
**Ligne ~608-623**

**Avant** :
```typescript
// Scroll automatique pour les nouveaux messages d'autres utilisateurs
if (message.senderId !== user.id && message.anonymousSenderId !== user.id) {
  setTimeout(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // Si proche du bas (300px), scroll vers le bas
      if (distanceFromBottom < 300) {
        messagesContainerRef.current.scrollTo({
          top: scrollHeight,  // ❌ MAUVAIS
          behavior: 'smooth'
        });
      }
    }
  }, 300);
}
```

**Après** :
```typescript
// Scroll automatique pour les nouveaux messages d'autres utilisateurs
if (message.senderId !== user.id && message.anonymousSenderId !== user.id) {
  setTimeout(() => {
    if (messagesContainerRef.current) {
      const { scrollTop } = messagesContainerRef.current;
      
      // En mode scrollDirection='down', les nouveaux messages sont EN HAUT
      // Donc on scroll vers le haut (top: 0) si l'utilisateur est déjà proche du haut
      if (scrollTop < 300) {
        messagesContainerRef.current.scrollTo({
          top: 0,  // ✅ CORRECT
          behavior: 'smooth'
        });
      }
    }
  }, 300);
}
```

#### B. Envoi de Message par l'Utilisateur
**Ligne ~1136-1143**

**Avant** :
```typescript
// Scroll automatique vers le bas pour voir le message envoyé
setTimeout(() => {
  if (messagesContainerRef.current) {
    const { scrollHeight } = messagesContainerRef.current;
    messagesContainerRef.current.scrollTo({
      top: scrollHeight,  // ❌ MAUVAIS
      behavior: 'smooth'
    });
  }
}, 300);
```

**Après** :
```typescript
// Scroll automatique vers le HAUT pour voir le message envoyé (scrollDirection='down')
setTimeout(() => {
  if (messagesContainerRef.current) {
    messagesContainerRef.current.scrollTo({
      top: 0,  // ✅ CORRECT
      behavior: 'smooth'
    });
  }
}, 300);
```

### 2. **ConversationMessages.tsx** (3 modifications)

#### A. Ajout de la Fonction scrollToTop
**Ligne ~120**

```typescript
// Fonction pour scroller vers le haut (pour BubbleStream avec scrollDirection='down')
const scrollToTop = useCallback((smooth = true) => {
  if (scrollAreaRef.current) {
    scrollAreaRef.current.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
}, []);
```

#### B. Premier Chargement avec Détection de scrollDirection
**Ligne ~207-228**

**Avant** :
```typescript
// Scénario 1 : Premier chargement
useEffect(() => {
  if (isFirstLoadRef.current && messages.length > 0 && !isLoadingMessages) {
    setTimeout(() => {
      const firstUnreadMessage = findFirstUnreadMessage();
      
      if (firstUnreadMessage) {
        scrollToMessage(firstUnreadMessage.id, false);
      } else {
        scrollToBottom(false);  // ❌ TOUJOURS vers le bas
      }
      
      isFirstLoadRef.current = false;
    }, 100);
  }
}, [messages.length, isLoadingMessages, ...]);
```

**Après** :
```typescript
// Scénario 1 : Premier chargement
useEffect(() => {
  if (isFirstLoadRef.current && messages.length > 0 && !isLoadingMessages) {
    setTimeout(() => {
      // En mode scrollDirection='down' (BubbleStream), les messages récents sont EN HAUT
      if (scrollDirection === 'down') {
        console.log('[ConversationMessages] 🚀 Premier chargement (BubbleStream) - scroll vers le haut');
        scrollToTop(false);  // ✅ Vers le haut en BubbleStream
      } else {
        // Mode classique : chercher les messages non lus ou aller en bas
        const firstUnreadMessage = findFirstUnreadMessage();
        
        if (firstUnreadMessage) {
          scrollToMessage(firstUnreadMessage.id, false);
        } else {
          scrollToBottom(false);  // ✅ Vers le bas en mode classique
        }
      }
      
      isFirstLoadRef.current = false;
    }, 100);
  }
}, [messages.length, isLoadingMessages, scrollDirection, ...]);
```

#### C. Nouveaux Messages en Temps Réel
**Ligne ~231-266**

**Avant** :
```typescript
// Scénario 2 & 3 : Nouveaux messages en temps réel
useEffect(() => {
  if (messages.length > 0 && !isFirstLoadRef.current) {
    // ...
    
    if (currentCount > previousCount) {
      const lastMessage = messages[messages.length - 1];
      
      // Si c'est notre propre message, TOUJOURS scroller
      if (lastMessage && lastMessage.senderId === currentUser?.id) {
        scrollToBottom(false);  // ❌ TOUJOURS vers le bas
      } else {
        const userIsAtBottom = isUserAtBottom();
        if (userIsAtBottom) {
          scrollToBottom();  // ❌ TOUJOURS vers le bas
        }
      }
    }
  }
}, [messages, ...]);
```

**Après** :
```typescript
// Scénario 2 & 3 : Nouveaux messages en temps réel
useEffect(() => {
  if (messages.length > 0 && !isFirstLoadRef.current) {
    // ...
    
    if (currentCount > previousCount) {
      const lastMessage = messages[messages.length - 1];
      
      // Si c'est notre propre message, TOUJOURS scroller
      if (lastMessage && lastMessage.senderId === currentUser?.id) {
        // En mode scrollDirection='down' (BubbleStream), scroller vers le haut
        if (scrollDirection === 'down') {
          scrollToTop(false);  // ✅ Vers le haut en BubbleStream
        } else {
          scrollToBottom(false);  // ✅ Vers le bas en mode classique
        }
      } else {
        // Pour les messages d'autres utilisateurs, scroller SEULEMENT si proche
        if (scrollDirection === 'down') {
          // En BubbleStream, vérifier si l'utilisateur est proche du haut
          const container = scrollAreaRef.current;
          if (container && container.scrollTop < 300) {
            scrollToTop();  // ✅ Vers le haut si proche du haut
          }
        } else {
          // Mode classique : vérifier si l'utilisateur est en bas
          const userIsAtBottom = isUserAtBottom();
          if (userIsAtBottom) {
            scrollToBottom();  // ✅ Vers le bas si en bas
          }
        }
      }
    }
  }
}, [messages, scrollDirection, ...]);
```

## 📊 Matrice de Comportement

| Scénario | scrollDirection='up' | scrollDirection='down' |
|----------|----------------------|------------------------|
| **Premier chargement** | Scroll vers le bas (récents en bas) | ✅ Scroll vers le haut (récents en haut) |
| **Envoi message** | Scroll vers le bas | ✅ Scroll vers le haut |
| **Réception message** | Scroll vers le bas si proche du bas | ✅ Scroll vers le haut si proche du haut |
| **Chargement infini** | Charger quand scrollTop < 100 | ✅ Charger quand distanceFromBottom < 100 |

## 🎯 Comportement Final

### Au Chargement Initial (`/` ou `/chat`)
```
1. Messages chargés depuis le serveur (récents → anciens)
2. Affichage : Message récent EN HAUT ↓ Message ancien EN BAS
3. Scroll automatique : top: 0 (vers le haut)
4. Utilisateur voit les messages récents immédiatement
```

### À la Réception d'un Message
```
1. Nouveau message arrive via WebSocket
2. Message ajouté EN HAUT de la liste
3. Si utilisateur proche du haut (scrollTop < 300) → scroll vers top: 0
4. Si utilisateur en train de consulter l'historique → pas de scroll
```

### À l'Envoi d'un Message
```
1. Message envoyé via WebSocket
2. Message ajouté EN HAUT de la liste
3. Scroll automatique vers top: 0 (toujours)
4. Utilisateur voit son message immédiatement en haut
```

### Scroll pour Charger Plus
```
1. Utilisateur scroll vers le BAS
2. Quand distanceFromBottom < 100px → charger messages plus anciens
3. Messages anciens ajoutés EN BAS
4. Pas de perturbation du scroll
```

## ✅ Avantages de cette Correction

1. **UX Cohérente** : Le scroll va toujours vers les messages récents (haut en BubbleStream)
2. **Performance** : Pas de calculs inutiles de scrollHeight
3. **Prédictibilité** : Comportement clair et logique
4. **Flexibilité** : Support des deux modes (up/down) dans le même composant
5. **Respect de l'Utilisateur** : Ne dérange pas l'utilisateur qui consulte l'historique

## 🔍 Points Techniques

### Seuils de Déclenchement
```typescript
// Pour savoir si l'utilisateur est "proche" des nouveaux messages
scrollDirection='up'   → distanceFromBottom < 300px
scrollDirection='down' → scrollTop < 300px

// Pour charger plus de messages
scrollDirection='up'   → scrollTop < 100px
scrollDirection='down' → distanceFromBottom < 100px
```

### Délais de Scroll
```typescript
setTimeout(() => {
  // Scroll automatique
}, 300); // Délai pour laisser le DOM se mettre à jour
```

## 📝 Fichiers Modifiés

1. ✅ `frontend/components/common/bubble-stream-page.tsx`
   - Ligne ~608-623 : Réception de message
   - Ligne ~1136-1143 : Envoi de message

2. ✅ `frontend/components/conversations/ConversationMessages.tsx`
   - Ligne ~120 : Ajout de `scrollToTop()`
   - Ligne ~207-228 : Premier chargement
   - Ligne ~231-266 : Nouveaux messages en temps réel

## 🚀 Résultat

**✅ COMPLÉTÉ** - Le scroll automatique fonctionne maintenant correctement en mode BubbleStream :
- ✅ Chargement initial → scroll vers le haut
- ✅ Envoi de message → scroll vers le haut
- ✅ Réception de message → scroll vers le haut (si proche)
- ✅ Scroll down → chargement des anciens messages

---

*Modification réalisée le 21 octobre 2025*
