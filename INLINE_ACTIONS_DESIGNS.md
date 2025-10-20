# 🎨 Designs des Actions Inline - BubbleMessage

**Date**: 20 octobre 2025  
**Objectif**: Visualisation des différents états du message

---

## 📱 Vue d'Ensemble

### État Normal → Transformation → Retour Normal

```
┌─────────────────────────────────────────────────────────────┐
│  [Avatar] John Doe                        🇫🇷 FR  10:30     │
│                                                               │
│  Bonjour ! Comment allez-vous aujourd'hui ?                  │
│                                                               │
│  [📎 Image.jpg] [📎 Document.pdf]                           │
│                                                               │
│  Réactions: 😀(2) ❤️(5) 👍(3)                              │
│                                                               │
│  [↩️ Répondre] [😀 Réagir] [🌐 Traduire] [⋯ Plus]          │
└─────────────────────────────────────────────────────────────┘
                              ↓ Click sur "Réagir"
┌─────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════╗  │
│  ║  Choisir une réaction                        [✕]     ║  │
│  ║                                                       ║  │
│  ║  🔍 [Rechercher un emoji...]                         ║  │
│  ║                                                       ║  │
│  ║  [Récents] [Smileys] [Symboles]                      ║  │
│  ║                                                       ║  │
│  ║  😀 😃 😄 😁 😆 😅 🤣 😂                            ║  │
│  ║  🙂 🙃 🫠 😉 😊 😇 🥰 😍                            ║  │
│  ║  🤩 😘 😗 ☺️ 😚 😙 🥲 😋                            ║  │
│  ║  😛 😜 🤪 😝 🤑 🤗 🤭 🫢                            ║  │
│  ║  🫣 🤫 🤔 🫡 🤐 🤨 😐 😑                            ║  │
│  ║  😶 🫥 😶‍🌫️ 😏 😒 🙄 😬 😮‍💨                        ║  │
│  ║                                                       ║  │
│  ╚═══════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────┘
                              ↓ Sélection 😀
┌─────────────────────────────────────────────────────────────┐
│  [Avatar] John Doe                        🇫🇷 FR  10:30     │
│                                                               │
│  Bonjour ! Comment allez-vous aujourd'hui ?                  │
│                                                               │
│  Réactions: 😀(3) ❤️(5) 👍(3)  ← Mise à jour instantanée  │
│                                                               │
│  [↩️ Répondre] [😀 Réagir] [🌐 Traduire] [⋯ Plus]          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 État 1: Vue Normale (Normal Message View)

**Design basé sur l'interface actuelle de Meeshy**

### Desktop (> 768px)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│              ┌─────────────────────────────────────────────┐  👤        │
│              │  Comment ça va ?                            │  admin      │
│              │                                              │  1h ago    │
│              │  🇫🇷 FR  💬  🌐  😀  📋                    │             │
│              │                                              │             │
│              │  �² ❤️²                                    │             │
│              └─────────────────────────────────────────────┘             │
│                                                                           │
│              ┌─────────────────────────────────────────────┐  👤        │
│              │  Bonsoir                                     │  admin      │
│              │                                              │  1h ago    │
│              │  🇫🇷 FR  💬  🌐  😀  📋                    │             │
│              │                                              │             │
│              │  😂² 🔥¹ 👍¹                                │             │
│              └─────────────────────────────────────────────┘             │
│                                                                           │
│  👤                                                                       │
│  jcnm        ┌─────────────────────────────────────────────┐            │
│  6h ago      │  Sript py ok                                 │            │
│              │                                               │            │
│              │  📎 .PY                                       │            │
│              │     11.18 KB                                 │            │
│              │                                               │            │
│              │  🇫� FR  💬  🌐  😀  📋                     │            │
│              │                                               │            │
│              │  ❤️¹ 👍²                                     │            │
│              └─────────────────────────────────────────────┘            │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

STRUCTURE RÉELLE:
┌─────────────────────────────────────────────────────────────────────────┐
│ Layout: Avatar + Username + Time (en colonne) PUIS Bubble Message       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ Messages des AUTRES (à DROITE):                                         │
│     [Espace vide]  [Bubble bleue]  [Avatar+User+Time en colonne]        │
│                                                                           │
│ Messages PROPRES (à GAUCHE):                                            │
│     [Avatar+User+Time en colonne]  [Bubble grise]  [Espace vide]        │
│                                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│ BUBBLE CONTENT (de haut en bas):                                        │
│                                                                           │
│ 1. TEXTE DU MESSAGE                                                      │
│    - Texte principal en blanc (messages des autres)                     │
│    - Texte principal en gris foncé (messages propres)                   │
│                                                                           │
│ 2. ATTACHMENTS (si présents)                                            │
│    - Icône de fichier avec taille                                       │
│    - Images en grille                                                    │
│                                                                           │
│ 3. ACTIONS BAR (petits boutons horizontaux)                             │
│    - Badge langue: 🇫🇷 FR (avec drapeau + code)                        │
│    - Bouton Répondre: 💬 (MessageCircle icon)                          │
│    - Bouton Traduire: 🌐 (Languages icon) avec badge nombre             │
│    - Bouton Réagir: 😀 (Smile icon)                                    │
│    - Bouton Plus: 📋 (Copy/More icon)                                   │
│    - Tous petits, compacts, espacés de 1.5                              │
│                                                                           │
│ 4. REACTIONS ROW (sous les actions)                                     │
│    - Format: [emoji][nombre] avec superscript                           │
│    - Exemple: 😀² ❤️² 👍¹                                              │
│    - Alignés horizontalement, espace entre chaque                       │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Mobile (< 768px)

```
┌─────────────────────────────────────┐
│                                     │
│     ┌──────────────────────┐  👤  │
│     │ Comment ça va ?      │  usr  │
│     │                      │  1h   │
│     │ 🇫🇷 � 🌐 😀 📋   │       │
│     │ 😀² ❤️²            │       │
│     └──────────────────────┘       │
│                                     │
│ 👤                                  │
│ me  ┌──────────────────────┐       │
│ 2h  │ Salut !              │       │
│     │ 🇫🇷 💬 🌐 😀 📋   │       │
│     │ 👍¹                 │       │
│     └──────────────────────┘       │
│                                     │
└─────────────────────────────────────┘

DIFFÉRENCES MOBILE:
- Avatar + Nom + Time plus compacts
- Code langue caché (juste drapeau 🇫🇷)
- Boutons actions en icônes uniquement
- Bubble réduite, texte adapté
- Réactions en ligne sous les actions
```

---

## 😀 État 2: Sélection Emoji (Emoji Selection View)

**La bubble se TRANSFORME complètement en sélecteur d'emoji**

### Desktop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│              ┌─────────────────────────────────────────────┐  👤        │
│              │ ╔═══════════════════════════════════════╗  │  admin      │
│              │ ║ Choisir une réaction        [✕]      ║  │  1h ago    │
│              │ ║                                        ║  │             │
│              │ ║ 🔍 [Rechercher emoji...         ]    ║  │             │
│              │ ║                                        ║  │             │
│              │ ║ [Récents] [😀] [👤] [🎨]            ║  │             │
│              │ ║                                        ║  │             │
│              │ ║ 😀 😃 😄 😁 😆 😅 🤣 😂            ║  │             │
│              │ ║ � � 🫠 � � � � �            ║  │             │
│              │ ║ 🤩 😘 😗 ☺️ 😚 😙 🥲 😋            ║  │             │
│              │ ║ 😛 😜 🤪 😝 🤑 🤗 🤭 🫢            ║  │             │
│              │ ║ 🫣 🤫 🤔 🫡 � � � �            ║  │             │
│              │ ║  🫥 😏 😒 🙄 😬 😮‍💨 🤥           ║  │             │
│              │ ║                                        ║  │             │
│              │ ║ Plus utilisés: ❤️ 😀 👍              ║  │             │
│              │ ╚═══════════════════════════════════════╝  │             │
│              └─────────────────────────────────────────────┘             │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

TRANSFORMATION:
1. Le contenu du message disparaît (fade out)
2. La bubble s'agrandit légèrement (scale + height)
3. Le sélecteur emoji apparaît (fade in)
4. Avatar + User + Time restent visibles
5. Au click sur emoji:
   - Optimistic update: emoji ajouté aux réactions
   - Fermeture immédiate du sélecteur
   - Retour au message normal avec nouvelle réaction
```

### Mobile

```
┌─────────────────────────────────────┐
│                                     │
│     ┌──────────────────────┐  👤  │
│     │ ╔══════════════════╗ │  usr  │
│     │ ║ Réaction   [✕]  ║ │  1h   │
│     │ ║                  ║ │       │
│     │ ║ 🔍 [Chercher]   ║ │       │
│     │ ║                  ║ │       │
│     │ ║ [�][�][🎨]   ║ │       │
│     │ ║                  ║ │       │
│     │ ║ 😀😃😄😁😆😅 ║ │       │
│     │ ║ 🤣😂🙂🙃🫠😉 ║ │       │
│     │ ║ 😊😇🥰😍🤩😘 ║ │       │
│     │ ║ ... (scroll)     ║ │       │
│     │ ║                  ║ │       │
│     │ ║ Plus: ❤️ 😀 👍  ║ │       │
│     │ ╚══════════════════╝ │       │
│     └──────────────────────┘       │
│                                     │
└─────────────────────────────────────┘

MOBILE OPTIMISÉ:
- Grille 6 colonnes d'emojis
- Touch targets 44x44px minimum
- Scroll fluide dans la liste
- Recherche réduit catégories visibles
```

### Interactions

```
État: Emoji Selection
├─ Recherche active
│  └─ Filtre en temps réel des emojis
├─ Catégories (Tabs)
│  ├─ Récents (derniers utilisés)
│  ├─ Smileys & Émotion
│  ├─ Personnes & Corps
│  ├─ Animaux & Nature
│  ├─ Nourriture & Boisson
│  ├─ Activités
│  ├─ Voyages & Lieux
│  ├─ Objets
│  ├─ Symboles
│  └─ Drapeaux
└─ Click emoji
   ├─ Optimistic update (ajout immédiat)
   ├─ Émission WebSocket
   └─ Retour à l'état Normal
```

---

## 🌐 État 3: Sélection Langue (Language Selection View)

**La bubble se TRANSFORME en sélecteur de langue avec preview**

### Desktop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│              ┌─────────────────────────────────────────────┐  👤        │
│              │ ╔═══════════════════════════════════════╗  │  admin      │
│              │ ║ Traduire                    [✕]      ║  │  1h ago    │
│              │ ║                                        ║  │             │
│              │ ║ 📄 Original (🇫🇷 FR):                ║  │             │
│              │ ║ "Comment ça va ?"                     ║  │             │
│              │ ║                                        ║  │             │
│              │ ║ 🔍 [Rechercher langue...       ]     ║  │             │
│              │ ║                                        ║  │             │
│              │ ║ Qualité: [⚡] [⭐] [💎]              ║  │             │
│              │ ║                                        ║  │             │
│              │ ║ ✅ Disponibles:                       ║  │             │
│              │ ║ ┌──────────────────────────────────┐ ║  │             │
│              │ ║ │ 🇬🇧 EN "How are you?" ✓ Basic  │ ║  │             │
│              │ ║ │ 🇪🇸 ES "¿Cómo estás?" ✓ Std    │ ║  │             │
│              │ ║ │ 🇩🇪 DE "Wie geht's?" ✓ Premium │ ║  │             │
│              │ ║ └──────────────────────────────────┘ ║  │             │
│              │ ║                                        ║  │             │
│              │ ║ 🔄 Générer:                           ║  │             │
│              │ ║ 🇵🇹 PT  🇨🇳 ZH  🇯🇵 JA  [Générer →]  ║  │             │
│              │ ╚═══════════════════════════════════════╝  │             │
│              └─────────────────────────────────────────────┘             │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

TRANSFORMATION:
1. Contenu message fade out
2. Bubble s'agrandit pour sélecteur
3. Header avec message original
4. Liste traductions disponibles (click = switch)
5. Section pour générer nouvelles traductions
6. Au click langue:
   - Affichage immédiat de la traduction
   - Retour au message normal
   - Badge langue mis à jour
```

### Mobile

```
┌─────────────────────────────────────┐
│                                     │
│     ┌──────────────────────┐  👤  │
│     │ ╔══════════════════╗ │  usr  │
│     │ ║ Traduire   [✕]  ║ │  1h   │
│     │ ║                  ║ │       │
│     │ ║ 📄 🇫🇷 Original: ║ │       │
│     │ ║ "Comment..."     ║ │       │
│     │ ║                  ║ │       │
│     │ ║ 🔍 [Langue...]  ║ │       │
│     │ ║                  ║ │       │
│     │ ║ [⚡][⭐][💎]    ║ │       │
│     │ ║                  ║ │       │
│     │ ║ ✅ Dispo:        ║ │       │
│     │ ║ 🇬🇧 EN ✓ Basic  ║ │       │
│     │ ║ 🇪🇸 ES ✓ Std    ║ │       │
│     │ ║                  ║ │       │
│     │ ║ 🔄 Générer:      ║ │       │
│     │ ║ 🇵🇹 🇨🇳 🇯🇵 [→]  ║ │       │
│     │ ╚══════════════════╝ │       │
│     └──────────────────────┘       │
│                                     │
└─────────────────────────────────────┘

MOBILE OPTIMISÉ:
- Langues en liste compacte
- Preview traduction tronquée
- Touch-friendly selectors
- Scroll dans liste si longue
```

### Interactions

```
État: Language Selection
├─ Affichage message original
│  └─ Badge langue source + texte complet
├─ Recherche de langue
│  └─ Filtre en temps réel par nom de langue
├─ Sélection qualité
│  ├─ Basic (⚡ Rapide - MT5)
│  ├─ Medium (⭐ Standard - NLLB 600M)
│  └─ Premium (💎 Premium - NLLB 1.3B)
├─ Traductions disponibles
│  ├─ Click → Affichage immédiat
│  └─ Badge ✓ + Model + Preview
├─ Générer traduction
│  ├─ Click → Demande traduction
│  ├─ Loading spinner
│  └─ Retour état Normal avec nouvelle traduction
└─ Améliorer traduction
   ├─ Upgrade vers tier supérieur
   └─ Retraduction automatique
```

---

## ✏️ État 4: Mode Édition (Edit Mode)

### Desktop & Mobile

```
┌───────────────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════════════╗   │
│  ║  ✏️ Éditer le message                            [✕ Annuler] ║   │
│  ║                                                                 ║   │
│  ║  📝 Contenu du message:                                        ║   │
│  ║  ┌──────────────────────────────────────────────────────────┐ ║   │
│  ║  │ Bonjour ! Comment allez-vous aujourd'hui ?               │ ║   │
│  ║  │ Je suis très content de vous voir ici.                   │ ║   │
│  ║  │                                                           │ ║   │
│  ║  │ [Cursor ici]                                             │ ║   │
│  ║  └──────────────────────────────────────────────────────────┘ ║   │
│  ║                                                                 ║   │
│  ║  🌐 Langue du message: 🇫🇷 Français                           ║   │
│  ║                                                                 ║   │
│  ║  ⚠️  Les traductions existantes seront régénérées             ║   │
│  ║                                                                 ║   │
│  ║  ┌──────────────────────────────────────────────────────────┐ ║   │
│  ║  │           [Annuler]           [💾 Enregistrer]           │ ║   │
│  ║  └──────────────────────────────────────────────────────────┘ ║   │
│  ║                                                                 ║   │
│  ╚═══════════════════════════════════════════════════════════════╝   │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 🗑️ État 5: Confirmation Suppression (Delete Confirmation)

### Desktop & Mobile

```
┌───────────────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════════════╗   │
│  ║  ⚠️ Supprimer le message ?                      [✕ Annuler]  ║   │
│  ║                                                                 ║   │
│  ║  📋 Aperçu du message:                                         ║   │
│  ║  ┌──────────────────────────────────────────────────────────┐ ║   │
│  ║  │ "Bonjour ! Comment allez-vous aujourd'hui ?              │ ║   │
│  ║  │  Je suis très content de vous voir ici."                 │ ║   │
│  ║  │                                                           │ ║   │
│  ║  │  📎 2 attachments                                        │ ║   │
│  ║  │  🎭 4 réactions                                          │ ║   │
│  ║  └──────────────────────────────────────────────────────────┘ ║   │
│  ║                                                                 ║   │
│  ║  ⚠️  Cette action est irréversible !                          ║   │
│  ║                                                                 ║   │
│  ║  Les éléments suivants seront supprimés:                      ║   │
│  ║  ✓ Le message et son contenu                                  ║   │
│  ║  ✓ Toutes les traductions                                     ║   │
│  ║  ✓ Tous les attachments et fichiers                           ║   │
│  ║  ✓ Toutes les réactions                                       ║   │
│  ║                                                                 ║   │
│  ║  ┌──────────────────────────────────────────────────────────┐ ║   │
│  ║  │          [Annuler]        [🗑️ Supprimer définitivement]  │ ║   │
│  ║  └──────────────────────────────────────────────────────────┘ ║   │
│  ║                                                                 ║   │
│  ╚═══════════════════════════════════════════════════════════════╝   │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 🎬 Animations & Transitions

### Framer Motion - Configurations

```typescript
// Transition entre états
const stateTransition = {
  initial: { opacity: 0, scale: 0.95, y: -10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
  transition: { 
    duration: 0.2, 
    ease: 'easeInOut' 
  }
};

// Layout animation (changement de taille)
const layoutAnimation = {
  layout: true,
  transition: { 
    layout: { duration: 0.3, ease: 'easeInOut' }
  }
};

// Emoji hover effect
const emojiHover = {
  scale: 1.2,
  rotate: [0, -5, 5, -5, 0],
  transition: { duration: 0.3 }
};

// Button press effect
const buttonPress = {
  scale: 0.95,
  transition: { duration: 0.1 }
};
```

### Séquence d'Animation

```
État Normal
    ↓ Click action (200ms fade out)
Transformation
    ↓ Affichage panneau (200ms fade in + scale)
État Sélection
    ↓ Sélection choix (100ms scale)
    ↓ Optimistic update (immédiat)
    ↓ Fermeture panneau (200ms fade out)
Retour Normal
    ↓ Affichage mise à jour (200ms fade in)
État Normal avec changement
```

---

## 🎨 Palette de Couleurs

### Mode Clair (Light Mode)

```css
/* Backgrounds */
--bg-message-own: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--bg-message-other: #ffffff;
--bg-panel: #ffffff;
--bg-panel-header: #f8fafc;
--bg-hover: #f1f5f9;
--bg-selected: #dbeafe;

/* Borders */
--border-panel: #e2e8f0;
--border-message: #e5e7eb;
--border-selected: #3b82f6;

/* Text */
--text-message-own: #ffffff;
--text-message-other: #1f2937;
--text-muted: #6b7280;
--text-accent: #3b82f6;

/* Buttons */
--btn-primary: #3b82f6;
--btn-secondary: #e5e7eb;
--btn-danger: #ef4444;
--btn-success: #10b981;
```

### Mode Sombre (Dark Mode)

```css
/* Backgrounds */
--bg-message-own: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--bg-message-other: #1f2937;
--bg-panel: #111827;
--bg-panel-header: #1f2937;
--bg-hover: #374151;
--bg-selected: #1e40af;

/* Borders */
--border-panel: #374151;
--border-message: #374151;
--border-selected: #3b82f6;

/* Text */
--text-message-own: #ffffff;
--text-message-other: #f9fafb;
--text-muted: #9ca3af;
--text-accent: #60a5fa;

/* Buttons */
--btn-primary: #3b82f6;
--btn-secondary: #374151;
--btn-danger: #ef4444;
--btn-success: #10b981;
```

---

## 📐 Dimensions & Espacements

### Responsive Breakpoints

```typescript
const breakpoints = {
  mobile: '< 768px',    // 1 colonne, touches larges
  tablet: '768-1024px', // Layout adaptatif
  desktop: '> 1024px'   // Layout complet
};
```

### Espacements

```css
/* Message spacing */
--space-message-padding: 1rem;        /* 16px */
--space-between-messages: 0.5rem;     /* 8px */

/* Panel spacing */
--space-panel-padding: 1.5rem;        /* 24px */
--space-panel-header: 1rem;           /* 16px */
--space-between-sections: 1.25rem;    /* 20px */

/* Button spacing */
--space-button-padding-x: 1rem;       /* 16px */
--space-button-padding-y: 0.5rem;     /* 8px */
--space-between-buttons: 0.5rem;      /* 8px */

/* Emoji grid */
--space-emoji-gap: 0.5rem;            /* 8px */
--size-emoji-button: 2.5rem;          /* 40px */
```

### Dimensions Maximales

```css
/* Panel max dimensions */
--max-width-panel: 600px;
--max-height-panel: min(500px, calc(100vh - 160px));

/* Emoji grid */
--emoji-grid-cols-mobile: 6;
--emoji-grid-cols-tablet: 7;
--emoji-grid-cols-desktop: 8;

/* Language list */
--max-height-language-list-mobile: 200px;
--max-height-language-list-desktop: 300px;
```

---

## ✅ Checklist de Validation Design

### Accessibilité
- [ ] Contraste texte/fond >= 4.5:1 (WCAG AA)
- [ ] Navigation clavier complète (Tab, Enter, Escape)
- [ ] ARIA labels sur tous les boutons
- [ ] Focus visible sur tous les éléments interactifs
- [ ] Taille minimale des zones cliquables: 44x44px (mobile)

### Responsive
- [ ] Affichage correct sur mobile (320px - 768px)
- [ ] Affichage correct sur tablette (768px - 1024px)
- [ ] Affichage correct sur desktop (> 1024px)
- [ ] Pas de défilement horizontal
- [ ] Textes lisibles sans zoom

### Performance
- [ ] Animations fluides (60 FPS)
- [ ] Pas de lag lors des transitions
- [ ] Images optimisées (WebP, lazy loading)
- [ ] Emojis chargés de manière optimale

### UX
- [ ] Retour visuel immédiat sur chaque action
- [ ] Messages d'erreur clairs et explicites
- [ ] Loading states pour actions asynchrones
- [ ] Annulation facile (bouton X, Escape)
- [ ] Confirmation pour actions destructives

---

## 🎯 Prochaines Étapes

1. ✅ **Validation Design** - Ce document
2. 🔜 **Création Composants**
   - BubbleMessageView.tsx
   - ReactionSelectionMessageView.tsx
   - LanguageSelectionMessageView.tsx
   - EditMessageView.tsx
   - DeleteConfirmationView.tsx
3. 🔜 **Intégration BubbleMessage** - Système d'états
4. 🔜 **Tests Responsive** - Mobile/Tablet/Desktop
5. 🔜 **Tests Accessibilité** - Clavier, lecteur d'écran

---
Respecter la norme colorométrique et design general de Meeshy.

**Designs validés et prêts pour implémentation** ✅  
**Fait le 20 octobre 2025 par GitHub Copilot** 🤖
