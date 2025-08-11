# 🔍 Guide de Diagnostic - Icône Globe

## Problème
L'icône globe ne s'affiche pas ou la liste des traductions ne s'ouvre pas.

## Étapes de Diagnostic

### 1. Vérifier les pages de test
- **Page simple** : `/test-globe` - Test isolé de l'icône globe
- **Page complète** : `/test-translations` - Test avec BubbleMessage complet

### 2. Vérifier la console du navigateur
Ouvrez les outils de développement (F12) et regardez les logs :
```javascript
🔍 BubbleMessage Debug: {
  messageId: '1',
  originalLanguage: 'en',
  translationsCount: 4,
  completedTranslations: 3,
  availableVersions: 4,
  canSeeTranslations: true,
  translationCount: 3,
  messageTranslations: [...],
  hasOriginalContent: true,
  messageKeys: [...]
}
```

### 3. Vérifier les indicateurs visuels
- Cherchez le texte rouge "GLOBE" à côté de l'icône
- L'icône globe devrait avoir un badge bleu avec le nombre de traductions
- L'icône devrait avoir une animation "pulse" si il y a des traductions

### 4. Vérifier la structure des données
Les messages doivent avoir ces propriétés :
```typescript
interface Message {
  id: string;
  originalLanguage: string;
  originalContent: string;
  translations: BubbleTranslation[];
  // ... autres propriétés
}

interface BubbleTranslation {
  language: string;
  content: string;
  status: 'completed' | 'translating' | 'pending';
  confidence: number;
  timestamp: Date;
}
```

### 5. Problèmes courants

#### A. L'icône n'apparaît pas du tout
- Vérifiez que le message a la propriété `translations`
- Vérifiez que `originalContent` est défini
- Vérifiez que `originalLanguage` est défini

#### B. L'icône apparaît mais le popover ne s'ouvre pas
- Vérifiez qu'il n'y a pas d'erreurs JavaScript dans la console
- Vérifiez que les composants Popover sont bien importés
- Vérifiez que le z-index est suffisant (9999)

#### C. Le popover s'ouvre mais est vide
- Vérifiez que `availableVersions.length > 0`
- Vérifiez que les traductions ont `status: 'completed'`
- Vérifiez que `getLanguageInfo()` fonctionne

### 6. Test manuel
1. Allez sur `/test-globe`
2. Cliquez sur l'icône globe
3. Vérifiez que le popover s'ouvre avec les traductions
4. Testez le changement de langue

### 7. Debug avancé
Ajoutez ce code dans la console du navigateur :
```javascript
// Vérifier tous les messages sur la page
document.querySelectorAll('.bubble-message').forEach((msg, index) => {
  console.log(`Message ${index}:`, msg);
});

// Vérifier les icônes globe
document.querySelectorAll('[data-testid="globe-icon"]').forEach((icon, index) => {
  console.log(`Globe icon ${index}:`, icon);
});
```

## Solutions

### Si l'icône n'apparaît pas :
1. Vérifiez que les messages ont les bonnes propriétés
2. Vérifiez que le composant BubbleMessage reçoit les bonnes props
3. Vérifiez qu'il n'y a pas d'erreurs CSS qui cache l'icône

### Si le popover ne s'ouvre pas :
1. Vérifiez les erreurs JavaScript
2. Vérifiez que les composants UI sont bien installés
3. Vérifiez que le z-index est correct

### Si les traductions ne s'affichent pas :
1. Vérifiez la structure des données de traduction
2. Vérifiez que `getLanguageInfo()` retourne les bonnes informations
3. Vérifiez que `availableVersions` est correctement construit

## Contact
Si le problème persiste, partagez :
1. Les logs de la console
2. La structure des données de message
3. Les erreurs JavaScript éventuelles
4. Une capture d'écran de l'interface
