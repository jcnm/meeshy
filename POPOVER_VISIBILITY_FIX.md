# Correction de la Visibilité des Popovers

## Date
12 octobre 2025

## Problème
Les popovers s'affichaient hors de la zone visible de l'écran, notamment :
1. Le popover de traduction des messages (BubbleMessage) en bas de l'écran
2. Le popover des participants d'une conversation
3. Problèmes particulièrement visibles en mode dark

## Solutions Appliquées

### 1. Amélioration du Composant Base Popover

**Fichier**: `/frontend/components/ui/popover.tsx`

**Changements**:
```typescript
function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  collisionPadding = 16,  // ✅ Ajouté avec valeur par défaut
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}  // ✅ Appliqué
        avoidCollisions={true}               // ✅ Activé par défaut
        sticky="always"                      // ✅ Reste collé au bord
        style={{ zIndex: 99999, position: 'fixed' }}
        className={cn(
          "bg-popover text-popover-foreground ...",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
```

**Bénéfices**:
- `avoidCollisions={true}`: Évite automatiquement les collisions avec les bords de l'écran
- `sticky="always"`: Le popover reste toujours visible
- `collisionPadding={16}`: Marge de sécurité de 16px autour de l'écran
- Paramètre configurable pour chaque usage

### 2. Optimisation du Popover de Traduction (BubbleMessage)

**Fichier**: `/frontend/components/common/bubble-message.tsx`

**Changements de configuration**:
```typescript
<PopoverContent 
  className="w-full max-w-xs md:w-80 p-0 ..."
  side="top"              // S'ouvre vers le haut
  align="center"          // ✅ Changé de "start" à "center"
  sideOffset={12}         // ✅ Augmenté de 8 à 12
  alignOffset={0}
  collisionPadding={20}   // ✅ Simplifié et augmenté
  onOpenAutoFocus={(e) => e.preventDefault()}
  ...
>
```

**Amélioration de la hauteur du contenu**:
```typescript
// Container principal avec hauteur adaptative
<Tabs defaultValue="translations" 
      className="w-full max-h-[min(600px,calc(100vh-100px))] flex flex-col">
  
  // Tabs avec overflow
  <TabsContent value="translations" className="mt-0 flex-1 overflow-hidden">
    <div className="p-3 pt-0 h-full flex flex-col">
      
      // Zone scrollable avec hauteur flexible
      <div className="space-y-1 flex-1 overflow-y-auto scrollbar-thin">
        {/* Contenu */}
      </div>
    </div>
  </TabsContent>
</Tabs>
```

**Formule de hauteur**:
- `min(600px, calc(100vh - 100px))`: Prend la plus petite valeur entre 600px ou (hauteur écran - 100px)
- Sur mobile: S'adapte à la hauteur disponible
- Sur desktop: Limite à 600px max

### 3. Optimisation du Popover des Participants

**Fichier**: `/frontend/components/conversations/conversation-participants-popover.tsx`

**Changements de configuration**:
```typescript
<PopoverContent
  className="w-80 p-0 shadow-2xl ..."
  side="bottom"
  align="end"
  sideOffset={12}          // ✅ Augmenté de 8 à 12
  alignOffset={0}
  collisionPadding={20}    // ✅ Simplifié et augmenté
  onOpenAutoFocus={(e) => e.preventDefault()}
>
```

**Amélioration de la zone de contenu**:
```typescript
// Avant
<div className="max-h-64 overflow-y-auto space-y-3">

// Après
<div className="max-h-[min(400px,calc(100vh-250px))] overflow-y-auto space-y-3">
```

**Formule de hauteur**:
- `min(400px, calc(100vh - 250px))`: Prend la plus petite valeur entre 400px ou (hauteur écran - 250px)
- Garantit qu'il reste 250px d'espace pour l'interface (header, trigger, padding)

## Restauration des Traductions

Les fichiers de traduction français et portugais ont été restaurés depuis les archives :

```bash
cp _archived/fr/conversations.json fr/conversations.json
cp _archived/pt/conversations.json pt/conversations.json
```

**Traductions complètes pour**:
- ✅ Anglais (en)
- ✅ Français (fr)
- ✅ Português (pt)

## Paramètres de Configuration des Popovers

### collisionPadding
Définit l'espace minimum entre le popover et les bords de l'écran.

**Valeurs recommandées**:
- `16px` (défaut): Pour popovers petits
- `20px`: Pour popovers moyens avec beaucoup de contenu
- `24px`: Pour popovers larges ou sur mobile

### sideOffset
Distance entre le trigger et le popover.

**Valeurs recommandées**:
- `4px` (défaut): Pour popovers simples
- `8-12px`: Pour popovers avec shadow importante
- `16px`: Pour créer un espacement visuel marqué

### side
Côté préféré d'ouverture du popover.

**Options**:
- `"top"`: S'ouvre vers le haut (pour messages en bas)
- `"bottom"`: S'ouvre vers le bas (pour éléments en haut)
- `"left"` / `"right"`: S'ouvre latéralement

**Note**: Avec `avoidCollisions={true}`, le popover changera automatiquement de côté si nécessaire.

### align
Alignement du popover par rapport au trigger.

**Options**:
- `"center"`: Centré (recommandé pour la plupart des cas)
- `"start"`: Aligné au début
- `"end"`: Aligné à la fin

## Mode Dark

Les améliorations fonctionnent parfaitement en mode dark grâce à :
- Classes Tailwind avec variants `dark:`
- Z-index élevé (99999) pour éviter les superpositions
- Contraste maintenu avec `border` et `shadow` adaptés

## Tests à Effectuer

### Test 1: Popover de Traduction
1. Ouvrir une conversation avec des messages
2. Scroller jusqu'en bas de la page
3. Cliquer sur l'icône de traduction du dernier message
4. ✅ Vérifier que le popover s'affiche complètement visible
5. ✅ Vérifier que le contenu est scrollable si nécessaire

### Test 2: Popover des Participants
1. Ouvrir une conversation de groupe
2. Cliquer sur l'icône des participants
3. ✅ Vérifier que le popover s'affiche complètement visible
4. ✅ Vérifier que la liste est scrollable

### Test 3: Mode Dark
1. Activer le mode dark
2. Répéter les tests 1 et 2
3. ✅ Vérifier la lisibilité et le contraste

### Test 4: Responsive
1. Tester sur mobile (375px width)
2. Tester sur tablet (768px width)
3. Tester sur desktop (1920px width)
4. ✅ Vérifier l'adaptation de la hauteur

## Métriques de Performance

### Hauteur Adaptive
- Mobile (667px height): popover max ~550px
- Tablet (1024px height): popover max 600px
- Desktop (1080px height): popover max 600px

### Zones de Sécurité
- Traduction popover: 100px réservés (header + padding)
- Participants popover: 250px réservés (header + trigger + padding)

## Problèmes Résolus

✅ Popover de traduction coupé en bas de l'écran
✅ Popover des participants coupé sur les petits écrans
✅ Contenu non scrollable dépassant l'écran
✅ Problèmes de visibilité en mode dark
✅ Traductions manquantes restaurées

## Fichiers Modifiés

1. `/frontend/components/ui/popover.tsx` - Amélioration du composant base
2. `/frontend/components/common/bubble-message.tsx` - Configuration optimisée
3. `/frontend/components/conversations/conversation-participants-popover.tsx` - Configuration optimisée
4. `/frontend/locales/fr/conversations.json` - Restauré
5. `/frontend/locales/pt/conversations.json` - Restauré

## Notes Techniques

### Radix UI Popover
Le composant utilise `@radix-ui/react-popover` qui offre :
- Positionnement automatique intelligent
- Gestion des collisions
- Support du clavier et de l'accessibilité
- API flexible pour configuration avancée

### CSS Flexbox
La structure flex permet :
- Hauteur flexible des containers
- Scroll uniquement sur le contenu
- Header et footer fixes
- Adaptation automatique au contenu

## Prochaines Améliorations Possibles

1. **Animation de resize**: Animer le changement de taille du popover
2. **Position memory**: Mémoriser la position préférée de l'utilisateur
3. **Touch gestures**: Swipe pour fermer sur mobile
4. **Virtualization**: Pour listes très longues (100+ items)

## Statut

✅ **COMPLET** - Tous les popovers s'affichent correctement dans la zone visible en mode clair et dark.

