# Feature: Smart Date Formatting pour les Réponses aux Messages

## Date: 12 octobre 2025
## Status: ✅ COMPLETE

## Problème
Lors de la réponse à un message, seule l'heure était affichée dans le MessageComposer et dans le message parent affiché dans BubbleMessage. Pour les messages d'hier ou plus anciens, cela manquait de contexte.

## Solution Implémentée

### Fonction `formatReplyDate`
Une fonction intelligente qui adapte l'affichage de la date selon le contexte :

```typescript
const formatReplyDate = (date: Date | string) => {
  const messageDate = new Date(date);
  const now = new Date();
  
  // Réinitialiser l'heure pour comparer uniquement les dates
  const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const isSameDay = messageDateOnly.getTime() === nowDateOnly.getTime();
  const isSameYear = messageDate.getFullYear() === now.getFullYear();
  
  if (isSameDay) {
    // Même jour : afficher seulement l'heure
    return messageDate.toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } else if (isSameYear) {
    // Même année mais jour différent : afficher jour + mois + heure
    return messageDate.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } else {
    // Année différente : afficher date complète + heure
    return messageDate.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};
```

## Comportement

### Scénario 1: Message du Même Jour
**Contexte**: Message envoyé aujourd'hui à 14:30  
**Affichage**: `14:30`  
**Raison**: L'heure suffit, le jour est implicite

### Scénario 2: Message d'un Autre Jour (Même Année)
**Contexte**: Message envoyé le 5 octobre 2025 à 14:30  
**Date actuelle**: 12 octobre 2025  
**Affichage**: `5 oct, 14:30`  
**Raison**: Le jour et le mois sont nécessaires pour le contexte, l'année est implicite

### Scénario 3: Message d'une Autre Année
**Contexte**: Message envoyé le 15 décembre 2024 à 14:30  
**Date actuelle**: 12 octobre 2025  
**Affichage**: `15 déc 2024, 14:30`  
**Raison**: Date complète nécessaire pour éviter toute ambiguïté

## Fichiers Modifiés

### 1. MessageComposer (`frontend/components/common/message-composer.tsx`)
**Lignes 56-92**: Ajout de la fonction `formatReplyDate`  
**Ligne 162**: Utilisation de `formatReplyDate(replyingTo.createdAt)`

**Avant**:
```typescript
<span className="text-xs text-blue-600/60 dark:text-blue-400/60">
  {new Date(replyingTo.createdAt).toLocaleString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  })}
</span>
```

**Après**:
```typescript
<span className="text-xs text-blue-600/60 dark:text-blue-400/60">
  {formatReplyDate(replyingTo.createdAt)}
</span>
```

### 2. BubbleMessage (`frontend/components/common/bubble-message.tsx`)
**Lignes 110-146**: Ajout de la fonction `formatReplyDate`  
**Ligne 605**: Utilisation de `formatReplyDate(message.replyTo.createdAt)`

**Avant**:
```typescript
<span className="text-[10px] text-blue-600/60 dark:text-blue-400/60 flex-shrink-0">
  {new Date(message.replyTo.createdAt).toLocaleString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short'
  })}
</span>
```

**Après**:
```typescript
<span className="text-[10px] text-blue-600/60 dark:text-blue-400/60 flex-shrink-0">
  {formatReplyDate(message.replyTo.createdAt)}
</span>
```

## Avantages

### 1. Meilleure UX
✅ **Contexte clair** : L'utilisateur sait immédiatement si le message est récent ou ancien  
✅ **Pas de surcharge d'informations** : Affichage minimal pour les messages récents  
✅ **Informations complètes** : Date complète pour les messages anciens

### 2. Cohérence
✅ **Même logique** : MessageComposer et BubbleMessage utilisent la même fonction  
✅ **Format uniforme** : Même format de date partout dans l'application

### 3. Maintenabilité
✅ **Code réutilisable** : Fonction définie dans chaque composant (pourrait être extraite dans un util)  
✅ **Facile à modifier** : Un seul endroit par composant pour changer le format

## Exemples Visuels

### Dans MessageComposer (Zone de Réponse)
```
┌──────────────────────────────────────────────┐
│ 💬 Répondre à John Doe • 14:30              │← Même jour
│ "Voici le contenu du message..."            │
│ 🔤 3 traductions                            │
└──────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────┐
│ 💬 Répondre à Alice • 5 oct, 14:30          │← Autre jour
│ "Message d'hier ou plus ancien..."          │
│ 🔤 2 traductions                            │
└──────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────┐
│ 💬 Répondre à Bob • 15 déc 2024, 14:30      │← Autre année
│ "Message de l'année dernière..."            │
│ 🔤 5 traductions                            │
└──────────────────────────────────────────────┘
```

### Dans BubbleMessage (Message Parent Affiché)
```
┌────────────────────────────────────────────┐
│ John Doe • 14:30 🇫🇷 FR 🔤 3 💬           │← Même jour
│ "Voici le contenu..."                      │
└────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────┐
│ Alice • 5 oct, 14:30 🇬🇧 EN 🔤 2 💬       │← Autre jour
│ "Message d'hier..."                        │
└────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────┐
│ Bob • 15 déc 2024, 14:30 🇪🇸 ES 🔤 5 💬   │← Autre année
│ "Message ancien..."                        │
└────────────────────────────────────────────┘
```

## Tests

### Test 1: Message du Jour
1. Répondre à un message envoyé aujourd'hui
2. ✅ Vérifier que seule l'heure s'affiche (ex: "14:30")

### Test 2: Message d'Hier
1. Répondre à un message envoyé hier
2. ✅ Vérifier que le jour et le mois s'affichent (ex: "11 oct, 14:30")

### Test 3: Message de l'Année Dernière
1. Répondre à un message de 2024 (si on est en 2025)
2. ✅ Vérifier que l'année complète s'affiche (ex: "15 déc 2024, 14:30")

### Test 4: Changement de Jour à Minuit
1. À 23:59, répondre à un message de 14:30 aujourd'hui → "14:30"
2. Attendre minuit (00:01)
3. ✅ Le même message devrait maintenant afficher "11 oct, 14:30"

## Notes Techniques

### Comparaison de Dates
La fonction compare les dates en **réinitialisant l'heure à 00:00** pour éviter les problèmes de comparaison avec les heures, minutes, secondes.

```typescript
const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
```

### Format Français
Utilisation de `'fr-FR'` pour les formats de date conformes aux attentes françaises :
- `oct` au lieu de `Oct`
- `déc` au lieu de `Dec`
- Format `jour mois` au lieu de `mois jour`

### Amélioration Future Possible
Extraire cette fonction dans un fichier utilitaire partagé :
```typescript
// frontend/utils/date-formatting.ts
export const formatReplyDate = (date: Date | string) => {
  // ... même implémentation
};
```

Puis l'importer dans les composants :
```typescript
import { formatReplyDate } from '@/utils/date-formatting';
```

## Impact

✅ **UX améliorée** : Les utilisateurs ont maintenant le contexte temporel complet  
✅ **Pas de régression** : Les messages du jour affichent toujours juste l'heure  
✅ **Cohérence** : Même logique dans MessageComposer et BubbleMessage  
✅ **Performance** : Calcul léger, pas d'impact notable

---

**Status Final**: ✅ **PRODUCTION READY**

**Testé sur**:
- Messages du jour ✅
- Messages d'hier ✅  
- Messages de la semaine dernière ✅
- Messages de l'année dernière ✅

**Composants impactés**:
- MessageComposer (zone de réponse) ✅
- BubbleMessage (affichage du message parent) ✅

