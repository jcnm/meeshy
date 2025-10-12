# Debug - Ordre des Messages dans /conversations

## Problème Rapporté
L'ordre n'est pas totalement respecté dans `/conversations/[id]`.

## Analyse du Flux Actuel

### 1. Backend (API)
```sql
ORDER BY createdAt DESC
```
Retourne: `[msg_recent, ..., msg_ancien]`

### 2. Hook useConversationMessages

**Premier chargement** (ligne 159):
```typescript
setMessages(newMessages); // Garde l'ordre backend: [récent, ..., ancien]
```

**Nouveau message temps réel** (ligne 228):
```typescript
addMessage = (message) => {
  return [message, ...prev]; // Ajoute à l'index 0
}
```

Résultat après addMessage: `[NOUVEAU, récent, ..., ancien]`

### 3. MessagesDisplay

**Avec reverseOrder=true**:
```typescript
return reverseOrder ? [...transformedMessages].reverse() : transformedMessages;
```

Résultat affiché: `[ancien, ..., récent, NOUVEAU]` ✅

## Problème Potentiel Identifié

Le système devrait fonctionner, mais il pourrait y avoir des cas où l'ordre n'est pas respecté:

### Scénario Problématique 1: Messages Reçus Hors Ordre
Si le WebSocket reçoit des messages dans le désordre (réseau, timing):
- Message B envoyé à 10:00:02
- Message A envoyé à 10:00:01
- Mais A arrive avant B via WebSocket

Résultat: `[A, B]` au lieu de `[B, A]`

### Scénario Problématique 2: Pas de Tri dans addMessage
`addMessage` ajoute toujours en index 0 sans vérifier le `createdAt`.

### Scénario Problématique 3: Messages Chargés par Pagination
Quand on scroll et qu'on charge plus de messages anciens, ils sont ajoutés mais peut-être pas au bon endroit.

## Solution Proposée

Ajouter un **tri explicite par createdAt** après ajout de message pour garantir l'ordre.

