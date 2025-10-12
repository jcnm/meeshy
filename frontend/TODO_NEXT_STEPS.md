# 📋 TODO - Prochaines Étapes

**Date** : 12 octobre 2025  
**Statut** : En attente de tests utilisateur

---

## ✅ TERMINÉ

### Migration /conversations
- [x] Analyse des 5 problèmes UI/UX
- [x] Correction responsive (2 composants → 1)
- [x] Correction cohérence (imports modernes)
- [x] Correction accessibilité (6+ attributs ARIA)
- [x] Correction intuitif (structure simplifiée)
- [x] Correction dark mode (variables CSS)
- [x] Vérification TypeScript (0 erreurs)
- [x] Documentation complète

### Corrections Popovers
- [x] Analyse problèmes de visibilité
- [x] Correction popover traduction (collision)
- [x] Correction popover participants (CSS + collision)
- [x] Vérification TypeScript (0 erreurs)
- [x] Documentation complète

---

## 🔄 EN COURS - Tests Utilisateur

### 1. Tests Page /conversations

#### Responsive
- [ ] **Mobile (< 768px)** : Liste OU Conversation (un seul à la fois)
  - [ ] Affichage liste conversations
  - [ ] Sélection d'une conversation
  - [ ] Affichage conversation (liste cachée)
  - [ ] Bouton retour vers liste
  - [ ] Pas de dépassement horizontal
  
- [ ] **Tablet (768-1024px)** : Liste + Conversation côte à côte
  - [ ] Sidebar liste visible (w-80)
  - [ ] Zone conversation principale
  - [ ] Transitions fluides
  
- [ ] **Desktop (> 1024px)** : Liste + Conversation + Détails
  - [ ] Sidebar liste (w-96)
  - [ ] Zone conversation centrale
  - [ ] Sidebar détails (si ouverte)
  - [ ] Toutes zones visibles simultanément

#### Dark Mode
- [ ] Basculer vers dark mode
- [ ] Vérifier fond : `bg-card`, `bg-background`
- [ ] Vérifier borders : `border-border`
- [ ] Vérifier textes : `text-foreground`, `text-muted-foreground`
- [ ] Vérifier hover : `hover:bg-accent`
- [ ] Vérifier composer : fond adaptatif
- [ ] Aucune couleur hardcodée visible

#### Accessibilité
- [ ] Navigation clavier (Tab pour naviguer)
- [ ] Entrée pour sélectionner conversation
- [ ] Échap pour fermer sidebar détails
- [ ] Screen reader (VoiceOver sur Mac, Cmd+F5)
  - [ ] Écoute "Conversations application"
  - [ ] Écoute "Liste des conversations"
  - [ ] Écoute "Conversation avec [nom]"
  - [ ] Écoute "Liste des messages"
  - [ ] Écoute "Détails de la conversation"

#### Fonctionnalités
- [ ] Créer nouvelle conversation
- [ ] Sélectionner conversation existante
- [ ] Envoyer message
- [ ] Recevoir message (WebSocket)
- [ ] Ouvrir sidebar détails
- [ ] Fermer sidebar détails
- [ ] Rechercher dans conversations

---

### 2. Tests Popover de Traduction

#### Visibilité
- [ ] Ouvrir conversation avec plusieurs messages
- [ ] Scroller jusqu'au **dernier message** (tout en bas)
- [ ] Cliquer sur bouton traduction (icône 🌐)
- [ ] **VÉRIFIER** : Popover entièrement visible (pas de contenu coupé)
- [ ] **VÉRIFIER** : Popover au-dessus du message (side="top")
- [ ] **VÉRIFIER** : Popover aligné à gauche (align="start")

#### Collision Detection
- [ ] Message en bas d'écran : Popover doit se repositionner automatiquement
- [ ] Message à gauche : Popover doit rester dans l'écran
- [ ] Message à droite : Popover doit rester dans l'écran
- [ ] Pas de débordement hors viewport

#### Dark Mode
- [ ] Basculer en dark mode
- [ ] Vérifier fond popover : `bg-white dark:bg-gray-800`
- [ ] Vérifier border : `border-gray-200 dark:border-gray-700`
- [ ] Vérifier textes visibles
- [ ] Vérifier tabs (Traductions / Traduire vers)
- [ ] Vérifier barre de recherche
- [ ] Vérifier liste des langues

#### Fonctionnalités
- [ ] Voir traductions existantes
- [ ] Filtrer langues disponibles
- [ ] Demander nouvelle traduction
- [ ] Changer langue d'affichage du message
- [ ] Fermer popover (clic extérieur)
- [ ] Fermer popover (hover away)

---

### 3. Tests Popover des Participants

#### Visibilité
- [ ] Ouvrir conversation de groupe
- [ ] Cliquer sur bouton participants (👥, en haut à droite)
- [ ] **VÉRIFIER** : Popover entièrement visible
- [ ] **VÉRIFIER** : Popover en dessous du bouton (side="bottom")
- [ ] **VÉRIFIER** : Popover aligné à droite (align="end")

#### Collision Detection
- [ ] Bouton en haut à droite : Popover doit rester dans l'écran
- [ ] Liste longue : Scroll interne fonctionne (max-h-64)
- [ ] Pas de débordement hors viewport

#### Dark Mode
- [ ] Basculer en dark mode
- [ ] **Fond** : `bg-card` adaptatif ✅
- [ ] **Border** : `border-border` adaptatif ✅
- [ ] **Header** : `text-foreground` visible ✅
- [ ] **Barre recherche** :
  - [ ] Fond : `bg-accent/50 dark:bg-accent/30` ✅
  - [ ] Border : `border-border` ✅
  - [ ] Texte : `text-foreground` ✅
  - [ ] Placeholder : `text-muted-foreground` ✅
- [ ] **Sections** : `text-muted-foreground` visible ✅
- [ ] **Cartes participants** :
  - [ ] Hover : `hover:bg-accent` visible ✅
  - [ ] Texte : `text-foreground` ✅
  - [ ] Avatar en ligne : `bg-primary/10` ✅
  - [ ] Avatar hors ligne : `bg-muted` ✅
  - [ ] Badge en ligne : bordure `border-card` ✅
  - [ ] Badge hors ligne : `bg-muted-foreground/50` ✅
- [ ] **Bouton suppression** : `text-destructive hover:bg-destructive/10` ✅

#### Fonctionnalités
- [ ] Voir liste participants (en ligne / hors ligne)
- [ ] Rechercher participant
- [ ] Créer lien d'invitation (si admin)
- [ ] Inviter utilisateur (si admin)
- [ ] Retirer participant (si admin)
- [ ] Badges de rôle visibles (👑 admin/créateur)
- [ ] Statut en ligne/hors ligne correct
- [ ] Fermer popover (clic extérieur)

---

## 🐛 BUGS À SIGNALER (Si trouvés)

### Template de rapport de bug

```markdown
**Page/Composant** : [ex: /conversations, Popover traduction]
**Type** : [Visuel, Fonctionnel, Performance, Accessibilité]
**Sévérité** : [Critique, Majeur, Mineur]

**Description** :
[Décrire le problème en détail]

**Étapes pour reproduire** :
1. [Action 1]
2. [Action 2]
3. [Action 3]

**Résultat attendu** :
[Ce qui devrait se passer]

**Résultat observé** :
[Ce qui se passe réellement]

**Environnement** :
- Navigateur : [Chrome 120, Firefox 121, Safari 17, etc.]
- OS : [macOS 14, Windows 11, iOS 17, Android 14]
- Taille écran : [1920x1080, 375x667, etc.]
- Mode : [Light, Dark]

**Captures d'écran** :
[Si applicable]

**Console Errors** :
[Copier erreurs de la console (F12)]
```

---

## 📈 MÉTRIQUES DE SUCCÈS

### Page /conversations
- [ ] **Responsive** : Fonctionne sur mobile, tablet, desktop
- [ ] **Dark mode** : Aucune couleur incohérente
- [ ] **Accessibilité** : Navigation clavier + screen reader OK
- [ ] **Performance** : Pas de lag, transitions fluides
- [ ] **Fonctionnalités** : Toutes fonctionnent correctement

### Popovers
- [ ] **Visibilité** : Toujours dans la zone visible (0 débordement)
- [ ] **Dark mode** : Toutes couleurs adaptées
- [ ] **Collision** : Repositionnement automatique fonctionne
- [ ] **Performance** : Ouverture/fermeture fluide
- [ ] **Fonctionnalités** : Toutes fonctionnent correctement

### Critères d'acceptation
- [ ] ✅ 0 bugs critiques
- [ ] ✅ 0 bugs majeurs
- [ ] ⚠️ Max 2-3 bugs mineurs (acceptable)
- [ ] ✅ Tests sur 3+ navigateurs
- [ ] ✅ Tests sur mobile + desktop
- [ ] ✅ Tests dark + light mode

---

## 🚀 APRÈS VALIDATION

### Si tests réussis ✅
1. [ ] Supprimer fichiers `.bak` (optionnel, après confirmation)
   ```bash
   cd frontend/components
   rm common/bubble-message.tsx.bak
   rm conversations/*.bak
   ```

2. [ ] Supprimer fichier `.archived` (optionnel)
   ```bash
   rm conversations/ConversationLayoutResponsive.tsx.archived
   ```

3. [ ] Commit des changements
   ```bash
   git add .
   git commit -m "feat(conversations): Migration UI/UX + Popover visibility fixes
   
   - Merge ConversationLayout + ConversationLayoutResponsive (-66% code)
   - Add ARIA attributes for accessibility (+6 attributes)
   - Fix dark mode uniformity (100% CSS variables)
   - Fix popover visibility (collision detection + padding)
   - Fix popover dark mode (all hardcoded colors removed)
   
   Closes #[numéro_issue]"
   ```

4. [ ] Push vers repository
   ```bash
   git push origin feature/selective-improvements
   ```

5. [ ] Créer Pull Request avec référence aux fichiers de documentation

### Si bugs trouvés ❌
1. [ ] Documenter tous les bugs (template ci-dessus)
2. [ ] Prioriser par sévérité (Critique > Majeur > Mineur)
3. [ ] Corriger bugs critiques en premier
4. [ ] Re-tester après corrections
5. [ ] Répéter jusqu'à validation complète

---

## 📞 ASSISTANCE

### Restaurer backups si nécessaire

```bash
# Restaurer un fichier depuis backup
cd frontend/components
cp common/bubble-message.tsx.bak common/bubble-message.tsx
cp conversations/conversation-participants-popover.tsx.bak conversations/conversation-participants-popover.tsx
```

### Consulter documentation

- `SESSION_COMPLETE_SUMMARY.md` - Vue d'ensemble session
- `CONVERSATIONS_FINAL_REPORT.md` - Migration /conversations détaillée
- `POPOVER_VISIBILITY_FIXES.md` - Corrections popovers détaillées
- `POPOVER_FIXES_SUMMARY.md` - Récapitulatif popovers

### Vérifier TypeScript

```bash
cd frontend
pnpm run type-check
```

### Lancer l'application

```bash
cd frontend
pnpm run dev
# Ouvrir http://localhost:3000
```

---

**Dernière mise à jour** : 12 octobre 2025  
**Prochaine étape** : Tests utilisateur  
**Objectif** : Validation complète avant production
