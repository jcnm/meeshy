# 📚 Modules Réutilisables - Bubble Stream

Cette documentation explique comment utiliser les modules extraits du `bubble-stream-page` pour les réutiliser partout dans le projet Meeshy.

## 🎯 Modules Disponibles

### 1. **Constants et Types** (`/lib/constants/languages.ts`)
```typescript
import { 
  SUPPORTED_LANGUAGES, 
  MAX_MESSAGE_LENGTH, 
  TOAST_SHORT_DURATION,
  type LanguageStats,
  getLanguageInfo,
  getLanguageName,
  getLanguageFlag,
  getLanguageColor
} from '@/lib/constants/languages';
```

### 2. **Composants UI Réutilisables**

#### `FoldableSection` - Section pliable générique
```typescript
import { FoldableSection } from '@/components/ui/foldable-section';

<FoldableSection
  title="Mon Titre"
  icon={<Icon className="h-4 w-4 mr-2" />}
  defaultExpanded={true}
>
  <p>Contenu de la section</p>
</FoldableSection>
```

#### `LanguageIndicators` - Indicateurs de langues avec statistiques
```typescript
import { LanguageIndicators } from '@/components/language/language-indicators';

<LanguageIndicators 
  languageStats={stats} 
  maxVisible={7}
  className="custom-class"
/>
```

#### `SidebarLanguageHeader` - En-tête de communication globale
```typescript
import { SidebarLanguageHeader } from '@/components/language/sidebar-language-header';

<SidebarLanguageHeader
  languageStats={languageStats}
  userLanguage={userLanguage}
/>
```

### 3. **Utilitaires de Gestion des Langues** (`/utils/user-language-preferences.ts`)
```typescript
import {
  getUserLanguageChoices,
  resolveUserPreferredLanguage,
  getUserLanguagePreferences,
  getRequiredLanguagesForConversation
} from '@/utils/user-language-preferences';

// Obtenir les choix de langues d'un utilisateur
const choices = getUserLanguageChoices(user);

// Résoudre la langue préférée
const preferredLang = resolveUserPreferredLanguage(user);

// Obtenir toutes les langues utilisées
const userLanguages = getUserLanguagePreferences(user);

// Pour une conversation multi-utilisateurs
const requiredLanguages = getRequiredLanguagesForConversation(users);
```

### 4. **Types TypeScript** (`/types/bubble-stream.ts`)
```typescript
import type {
  BubbleStreamMessage,
  BubbleStreamPageProps,
  LanguageChoice,
  UserLanguageConfig
} from '@/types/bubble-stream';
```

## 🚀 Import Unifié

Pour faciliter les imports, utilisez le module centralisé :

```typescript
import {
  // Composants
  BubbleMessage,
  FoldableSection,
  LanguageIndicators,
  SidebarLanguageHeader,
  
  // Constants
  SUPPORTED_LANGUAGES,
  MAX_MESSAGE_LENGTH,
  TOAST_SHORT_DURATION,
  
  // Utilitaires
  getUserLanguageChoices,
  resolveUserPreferredLanguage,
  getUserLanguagePreferences,
  
  // Types
  type LanguageStats,
  type BubbleStreamMessage,
  type LanguageChoice
} from '@/lib/bubble-stream-modules';
```

## 📖 Exemples d'Usage

### Sidebar avec Langues et Sections Pliables
```typescript
function MySidebar({ user, languageStats }: Props) {
  const userLanguage = resolveUserPreferredLanguage(user);
  
  return (
    <div className="w-80 bg-white/60 backdrop-blur-lg">
      <SidebarLanguageHeader 
        languageStats={languageStats} 
        userLanguage={userLanguage}
      />
      
      <FoldableSection
        title="Langues Actives"
        icon={<Languages className="h-4 w-4 mr-2" />}
        defaultExpanded={true}
      >
        <LanguageIndicators languageStats={languageStats} />
      </FoldableSection>
      
      <FoldableSection
        title="Trending"
        icon={<TrendingUp className="h-4 w-4 mr-2" />}
      >
        <TrendingContent />
      </FoldableSection>
    </div>
  );
}
```

### Interface de Sélection de Langue
```typescript
function LanguageSelector({ user, onLanguageChange }: Props) {
  const choices = getUserLanguageChoices(user);
  const currentLanguage = resolveUserPreferredLanguage(user);
  
  return (
    <Select value={currentLanguage} onValueChange={onLanguageChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choices.map(choice => (
          <SelectItem key={choice.code} value={choice.code}>
            <div className="flex items-center gap-2">
              <span>{choice.flag}</span>
              <span>{choice.name}</span>
              {choice.isDefault && <Badge>Par défaut</Badge>}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Stream de Messages avec Traductions
```typescript
function MessageStream({ user }: Props) {
  const [messages, setMessages] = useState<BubbleStreamMessage[]>([]);
  const userLanguages = getUserLanguagePreferences(user);
  const userLanguage = resolveUserPreferredLanguage(user);
  
  return (
    <div className="space-y-4">
      {messages.map(message => (
        <BubbleMessage
          key={message.id}
          message={message}
          currentUser={user}
          userLanguage={userLanguage}
          usedLanguages={userLanguages}
        />
      ))}
    </div>
  );
}
```

## 🔧 Configuration et Personnalisation

### Personnaliser les Langues Supportées
```typescript
// Dans /lib/constants/languages.ts, ajoutez de nouvelles langues :
export const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷', color: 'bg-blue-500' },
  { code: 'en', name: 'English', flag: '🇬🇧', color: 'bg-red-500' },
  // Ajouter de nouvelles langues ici
] as const;
```

### Personnaliser les Constantes
```typescript
// Modifier les valeurs par défaut selon vos besoins
export const MAX_MESSAGE_LENGTH = 500; // Augmenter la limite
export const TOAST_SHORT_DURATION = 1500; // Réduire la durée
```

## ✅ Avantages de cette Architecture

1. **Réutilisabilité** : Composants utilisables dans tout le projet
2. **Cohérence** : Interface uniforme pour la gestion des langues
3. **Maintenabilité** : Modifications centralisées
4. **Performance** : Logique optimisée et partagée
5. **TypeScript** : Types stricts et auto-complétion
6. **Modularité** : Import seulement ce qui est nécessaire

## 🎨 Thème et Styling

Tous les composants respectent le design system de Meeshy :
- **Couleurs** : Dégradés bleu/indigo cohérents
- **Transparence** : Backdrop blur et opacités harmonisées
- **Animations** : Transitions fluides
- **Responsive** : Mobile-first design
- **Accessibilité** : Contrast et navigation clavier

## 🔄 Migration depuis le Code Existant

Pour migrer du code existant :

1. **Remplacer** les imports individuels par le module unifié
2. **Supprimer** les définitions locales de constants/types
3. **Utiliser** les utilitaires centralisés pour la logique des langues
4. **Adopter** les composants standardisés

Exemple de migration :
```typescript
// Avant ❌
const SUPPORTED_LANGUAGES = [/*...*/];
function getLanguageChoices() {/*...*/}

// Après ✅
import { SUPPORTED_LANGUAGES, getUserLanguageChoices } from '@/lib/bubble-stream-modules';
```

Cette architecture garantit une base solide et évolutive pour toutes les fonctionnalités multi-langues de Meeshy ! 🚀
