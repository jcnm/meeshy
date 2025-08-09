# Correction affichage du message original de l'auteur

## Problème identifié

Dans la liste des "Versions disponibles" et lors du clic sur "afficher l'original", le contenu affiché n'était pas toujours le message original tel qu'écrit par l'auteur, car le hook `useMessageTranslations` modifiait le champ `content` pour afficher la traduction préférée.

## Solution implémentée

### 1. Ajout de la propriété `originalContent`

**Fichier :** `/frontend/hooks/use-message-translations.ts`

Ajout d'une nouvelle propriété dans `BubbleStreamMessage` :
```typescript
interface BubbleStreamMessage extends Message {
  location?: string;
  originalLanguage: string;
  isTranslated: boolean;
  translatedFrom?: string;
  translations: BubbleTranslation[];
  originalContent: string; // NOUVEAU : contenu original de l'auteur
}
```

### 2. Préservation du contenu original

Dans `processMessageWithTranslations()` :
```typescript
const result: BubbleStreamMessage = {
  ...message,
  content: displayContent,           // Contenu d'affichage (peut être traduit)
  originalContent: message.content,  // Contenu original de l'auteur (jamais modifié)
  originalLanguage,
  isTranslated,
  translatedFrom,
  location: message.location || 'Paris',
  translations
};
```

### 3. Correction des versions disponibles

**Fichier :** `/frontend/components/common/bubble-message.tsx`

Correction de la liste des versions disponibles :
```typescript
const availableVersions = [
  {
    language: message.originalLanguage,
    content: message.originalContent, // UTILISE le contenu original de l'auteur
    isOriginal: true,
    status: 'completed' as const,
    confidence: 1,
    timestamp: new Date(message.createdAt)
  },
  ...message.translations.filter(t => t.status === 'completed').map(t => ({
    ...t,
    isOriginal: false
  }))
];
```

### 4. Correction de l'affichage du contenu

Modification de `getCurrentContent()` :
```typescript
const getCurrentContent = () => {
  // Si on affiche la langue originale, retourner TOUJOURS le contenu original de l'auteur
  if (currentDisplayLanguage === message.originalLanguage) {
    return message.originalContent; // UTILISE originalContent au lieu de content
  }
  
  // Chercher la traduction pour la langue d'affichage actuelle
  const translation = message.translations.find(t => 
    t.language === currentDisplayLanguage && t.status === 'completed'
  );
  
  return translation?.content || message.originalContent; // Fallback sur originalContent
};
```

## Comportement corrigé

### ✅ Avant la correction
- ❌ Le message "original" pouvait afficher une traduction
- ❌ Clic sur "afficher l'original" montrait parfois une traduction
- ❌ Incohérence entre l'affichage et la version originale

### ✅ Après la correction
- ✅ Le message original affiche TOUJOURS le texte de l'auteur
- ✅ Clic sur "afficher l'original" montre le vrai contenu original
- ✅ Cohérence garantie entre versions disponibles et affichage
- ✅ Séparation claire entre contenu d'affichage et contenu original

## Flux de données

```
Message Backend → Hook Processing → BubbleMessage
      ↓               ↓               ↓
   content      originalContent    getCurrentContent()
 (original)       (préservé)       (sélection intelligente)
      ↓               ↓               ↓
   content        displayContent    Affichage selon langue
(peut être       (optimisé pour     sélectionnée
  traduit)       langue utilisateur)
```

## Tests de validation

Pour valider la correction :

1. **Test version originale :**
   - Créer un message en français
   - Vérifier que "Français (Original)" montre le texte exact de l'auteur
   - Cliquer sur afficher original → doit montrer le même texte

2. **Test traductions :**
   - Basculer vers une traduction anglaise
   - Revenir à "Français (Original)"
   - Vérifier que le texte original n'a pas changé

3. **Test copies :**
   - Copier le contenu en mode original
   - Vérifier que le texte copié est le texte original de l'auteur

Cette correction garantit que l'intégrité du message original de l'auteur est toujours préservée et correctement affichée.
