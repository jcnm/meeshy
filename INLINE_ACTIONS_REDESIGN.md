# 🎨 Redesign: Actions Inline pour BubbleMessage

**Date**: 20 octobre 2025  
**Objectif**: Remplacer les popovers problématiques par des transformations inline du message

---

## 🎯 Problème Actuel

### Limitations des Popovers
1. **Mobile**: Popover tronqué, difficile à manipuler sur petit écran
2. **Z-index**: Problèmes de superposition complexes à gérer
3. **UX**: Interruption du flux de lecture, nécessite des clics précis
4. **Accessibilité**: Difficile à atteindre pour certains utilisateurs

### Code Actuel (Popover pour traductions)
```tsx
<Popover open={isTranslationPopoverOpen} onOpenChange={handlePopoverOpenChange}>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="sm">
      <Languages className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    {/* Contenu de sélection de langue */}
  </PopoverContent>
</Popover>
```

---

## ✨ Solution: Transformation Inline

### Concept
Le message se **transforme temporairement** pour afficher les options, puis revient à son état normal :

```
┌─────────────────────────────────┐
│ Message normal                   │
│ [Répondre] [Réagir] [Plus]      │  ← État normal
└─────────────────────────────────┘
              ↓ Click sur "Réagir"
┌─────────────────────────────────┐
│ 😀 😂 ❤️ 👍 🎉 🚀 ...           │  ← Transformation inline
│ [← Annuler]                      │
└─────────────────────────────────┘
              ↓ Sélection emoji
┌─────────────────────────────────┐
│ Message normal                   │
│ [Répondre] [Réagir] [Plus]      │  ← Retour à l'état normal
│ Réactions: 😀(2) ❤️(1)          │
└─────────────────────────────────┘
```

---

## 🏗️ Architecture Proposée

### États du Message

```typescript
type MessageState = 
  | 'normal'           // Affichage standard
  | 'selecting-emoji'  // Sélecteur d'emoji inline
  | 'selecting-lang'   // Sélecteur de langue inline
  | 'editing'          // Mode édition
  | 'confirming-delete'; // Confirmation suppression

interface BubbleMessageState {
  mode: MessageState;
  previousMode: MessageState; // Pour retour arrière
  data?: any; // Données contextuelles (langue sélectionnée, etc.)
}
```

### Composant Principal

```tsx
function BubbleMessageInner({ message, currentUser, ... }: BubbleMessageProps) {
  // État principal du message
  const [messageState, setMessageState] = useState<BubbleMessageState>({
    mode: 'normal',
    previousMode: 'normal'
  });
  
  // Actions pour changer d'état
  const enterEmojiSelection = () => {
    setMessageState(prev => ({ 
      mode: 'selecting-emoji', 
      previousMode: prev.mode 
    }));
  };
  
  const enterLanguageSelection = () => {
    setMessageState(prev => ({ 
      mode: 'selecting-lang', 
      previousMode: prev.mode 
    }));
  };
  
  const exitToNormal = () => {
    setMessageState({ mode: 'normal', previousMode: 'normal' });
  };
  
  return (
    <motion.div
      layout
      className="bubble-message"
    >
      {/* Rendu conditionnel selon l'état */}
      {messageState.mode === 'normal' && (
        <NormalMessageView 
          message={message}
          onEmojiClick={enterEmojiSelection}
          onLanguageClick={enterLanguageSelection}
        />
      )}
      
      {messageState.mode === 'selecting-emoji' && (
        <EmojiSelectionView 
          message={message}
          onSelect={handleEmojiSelect}
          onCancel={exitToNormal}
        />
      )}
      
      {messageState.mode === 'selecting-lang' && (
        <LanguageSelectionView 
          message={message}
          availableLanguages={usedLanguages}
          onSelect={handleLanguageSelect}
          onCancel={exitToNormal}
        />
      )}
      
      {/* ... autres états ... */}
    </motion.div>
  );
}
```

---

## 📱 Vues Spécifiques

### 1. Vue Normale (État par défaut)

```tsx
function NormalMessageView({ 
  message, 
  onEmojiClick, 
  onLanguageClick,
  onReplyClick,
  onEditClick,
  onDeleteClick 
}: NormalMessageViewProps) {
  return (
    <>
      {/* En-tête du message */}
      <MessageHeader message={message} />
      
      {/* Contenu du message */}
      <MessageContent message={message} />
      
      {/* Attachments */}
      {message.attachments && (
        <MessageAttachments attachments={message.attachments} />
      )}
      
      {/* Réactions existantes */}
      {message.reactions && (
        <MessageReactions reactions={message.reactions} />
      )}
      
      {/* Barre d'actions */}
      <motion.div 
        className="flex gap-1 mt-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onReplyClick}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="ml-1 text-xs">Répondre</span>
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onEmojiClick}
        >
          <Smile className="h-4 w-4" />
          <span className="ml-1 text-xs">Réagir</span>
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onLanguageClick}
        >
          <Languages className="h-4 w-4" />
          <span className="ml-1 text-xs">Traduire</span>
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onEditClick}>
              <Edit className="h-4 w-4 mr-2" />
              Éditer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDeleteClick}>
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    </>
  );
}
```

### 2. Vue Sélection Emoji

```tsx
function EmojiSelectionView({ 
  message, 
  onSelect, 
  onCancel 
}: EmojiSelectionViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<'recent' | 'smileys' | 'symbols'>('recent');
  
  const filteredEmojis = useMemo(() => {
    // Filtrer les emojis selon la recherche
    return ALL_EMOJIS.filter(emoji => 
      emoji.keywords.some(kw => kw.includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery]);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="p-4 bg-background border rounded-lg"
    >
      {/* En-tête avec annulation */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">Choisir une réaction</h4>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Barre de recherche */}
      <div className="relative mb-3">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un emoji..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>
      
      {/* Catégories (Tabs inline) */}
      <Tabs value={category} onValueChange={(v) => setCategory(v as any)}>
        <TabsList className="w-full mb-3">
          <TabsTrigger value="recent" className="flex-1">Récents</TabsTrigger>
          <TabsTrigger value="smileys" className="flex-1">Smileys</TabsTrigger>
          <TabsTrigger value="symbols" className="flex-1">Symboles</TabsTrigger>
        </TabsList>
        
        <TabsContent value="recent">
          <EmojiGrid 
            emojis={getRecentEmojis()} 
            onSelect={onSelect}
          />
        </TabsContent>
        
        <TabsContent value="smileys">
          <EmojiGrid 
            emojis={filteredEmojis.filter(e => e.category === 'smileys')} 
            onSelect={onSelect}
          />
        </TabsContent>
        
        <TabsContent value="symbols">
          <EmojiGrid 
            emojis={filteredEmojis.filter(e => e.category === 'symbols')} 
            onSelect={onSelect}
          />
        </TabsContent>
      </Tabs>
      
      {/* Grille d'emojis */}
      <div className="grid grid-cols-8 gap-2 max-h-[200px] overflow-y-auto">
        {filteredEmojis.map(emoji => (
          <Button
            key={emoji.char}
            variant="ghost"
            size="sm"
            className="text-2xl p-2"
            onClick={() => {
              onSelect(emoji.char);
              onCancel(); // Retour automatique à la vue normale
            }}
          >
            {emoji.char}
          </Button>
        ))}
      </div>
    </motion.div>
  );
}
```

### 3. Vue Sélection Langue

```tsx
function LanguageSelectionView({ 
  message, 
  availableLanguages,
  currentLanguage,
  onSelect, 
  onCancel,
  onForceTranslation 
}: LanguageSelectionViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [translationModel, setTranslationModel] = useState<'basic' | 'medium' | 'premium'>('basic');
  
  const filteredLanguages = useMemo(() => {
    return SUPPORTED_LANGUAGES.filter(lang => 
      availableLanguages.includes(lang.code) &&
      lang.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [availableLanguages, searchQuery]);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="p-4 bg-background border rounded-lg"
    >
      {/* En-tête */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">Choisir une langue</h4>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Message original */}
      <Card className="mb-3 bg-muted">
        <CardContent className="p-2">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {getLanguageInfo(message.originalLanguage)?.flag} Original
            </Badge>
          </div>
          <p className="text-sm line-clamp-2">{message.originalContent}</p>
        </CardContent>
      </Card>
      
      {/* Recherche de langue */}
      <div className="relative mb-3">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une langue..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>
      
      {/* Sélecteur de modèle de traduction */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1 block">
          Qualité de traduction
        </label>
        <div className="flex gap-1">
          <Button
            variant={translationModel === 'basic' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setTranslationModel('basic')}
          >
            <span className="text-xs">Rapide</span>
          </Button>
          <Button
            variant={translationModel === 'medium' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setTranslationModel('medium')}
          >
            <span className="text-xs">Standard</span>
          </Button>
          <Button
            variant={translationModel === 'premium' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setTranslationModel('premium')}
          >
            <span className="text-xs">Premium</span>
          </Button>
        </div>
      </div>
      
      {/* Liste des langues disponibles */}
      <div className="space-y-1 max-h-[250px] overflow-y-auto">
        {filteredLanguages.map(lang => {
          const hasTranslation = message.translations?.some(
            t => t.targetLanguage === lang.code
          );
          const isCurrentLanguage = currentLanguage === lang.code;
          
          return (
            <Button
              key={lang.code}
              variant={isCurrentLanguage ? 'default' : 'ghost'}
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                if (hasTranslation) {
                  onSelect(lang.code);
                } else {
                  onForceTranslation(message.id, lang.code, translationModel);
                }
                onCancel(); // Retour à la vue normale
              }}
            >
              <span className="mr-2">{lang.flag}</span>
              <span className="flex-1 text-left">{lang.name}</span>
              {hasTranslation && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {!hasTranslation && (
                <Badge variant="outline" className="text-xs">
                  Générer
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </motion.div>
  );
}
```

---

## 🎨 Animations Framer Motion

### Transition Fluide entre États

```tsx
<AnimatePresence mode="wait">
  {messageState.mode === 'normal' && (
    <motion.div
      key="normal"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <NormalMessageView {...props} />
    </motion.div>
  )}
  
  {messageState.mode === 'selecting-emoji' && (
    <motion.div
      key="emoji"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <EmojiSelectionView {...props} />
    </motion.div>
  )}
  
  {/* ... autres états ... */}
</AnimatePresence>
```

### Layout Animation (Changement de Taille)

```tsx
<motion.div
  layout
  transition={{ 
    layout: { duration: 0.3, ease: 'easeInOut' } 
  }}
  className="bubble-message-container"
>
  {/* Contenu qui change de taille */}
</motion.div>
```

---

## 📱 Responsive Design

### Mobile (< 768px)
```tsx
// Vue Emoji: Grille 6 colonnes au lieu de 8
<div className="grid grid-cols-6 md:grid-cols-8 gap-2">
  {/* Emojis */}
</div>

// Vue Langue: Hauteur max réduite
<div className="max-h-[200px] md:max-h-[300px] overflow-y-auto">
  {/* Langues */}
</div>
```

### Tablette (768px - 1024px)
```tsx
// Vue Emoji: Grille 7 colonnes
<div className="grid grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-2">
  {/* Emojis */}
</div>
```

### Desktop (> 1024px)
```tsx
// Vue Emoji: Grille 8 colonnes (valeur par défaut)
<div className="grid grid-cols-8 gap-2">
  {/* Emojis */}
</div>
```

---

## 🚀 Avantages de l'Approche Inline

### ✅ Résolution des Problèmes
1. **Mobile**: Pas de popover tronqué, tout est dans le flux normal
2. **Z-index**: Plus de problèmes de superposition
3. **UX**: Transition fluide et naturelle
4. **Accessibilité**: Facilement atteignable, navigation clavier simple

### ✅ Bénéfices Additionnels
1. **Performance**: Moins de composants à gérer (pas de portals)
2. **Maintenabilité**: Code plus simple, état géré localement
3. **Cohérence**: Même comportement mobile/desktop
4. **Animations**: Transitions plus naturelles avec Framer Motion

### ✅ Extensibilité
Facile d'ajouter de nouveaux modes :
- Mode édition inline
- Mode confirmation de suppression
- Mode partage
- Mode copie

---

## 📋 Plan de Migration

### Phase 1: Créer les Nouveaux Composants
```
✅ Créer MessageState type
✅ Créer NormalMessageView
✅ Créer EmojiSelectionView
✅ Créer LanguageSelectionView
```

### Phase 2: Intégrer dans BubbleMessage
```
✅ Ajouter useState pour messageState
✅ Ajouter AnimatePresence pour transitions
✅ Connecter les actions aux changements d'état
```

### Phase 3: Supprimer l'Ancien Code
```
❌ Supprimer Popover pour traductions
❌ Supprimer useFixTranslationPopoverZIndex
❌ Supprimer PopoverTrigger/PopoverContent imports
```

### Phase 4: Tests
```
✅ Tester sur mobile (iOS/Android)
✅ Tester sur tablette
✅ Tester sur desktop
✅ Tester navigation clavier
✅ Tester avec lecteur d'écran
```

---

## 🎯 Prochaines Étapes

1. **Créer les composants de vues** (NormalMessageView, EmojiSelectionView, LanguageSelectionView)
2. **Intégrer dans BubbleMessage** avec système d'états
3. **Ajouter animations Framer Motion**
4. **Tester sur différents devices**
5. **Supprimer le code legacy des popovers**

---

**Fait le 20 octobre 2025 par GitHub Copilot** 🤖
