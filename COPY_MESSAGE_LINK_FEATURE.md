# Feature: Bouton "Copier le lien" pour messages sans texte

## 🎯 Objectif
Permettre de copier le lien d'un message qui contient uniquement des attachments (sans contenu textuel).

## 🐛 Problème identifié
Avant cette modification :
- Messages avec texte : Bouton "Copier" disponible → copie le texte + le lien ✅
- Messages avec attachments seuls : Aucun moyen de copier le lien ❌

## ✅ Solution implémentée

### 1. Nouvelle fonction `handleCopyMessageLink`
Copie **uniquement** le lien du message (sans le contenu textuel) :

```typescript
const handleCopyMessageLink = useCallback(async () => {
  try {
    // Générer l'URL du message selon le contexte actuel
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    
    let messageUrl: string;
    
    if (conversationId) {
      // Si on est dans /chat/, utiliser /chat/, sinon /conversations/
      if (currentPath.startsWith('/chat/')) {
        messageUrl = `${baseUrl}/chat/${conversationId}/#message-${message.id}`;
      } else {
        messageUrl = `${baseUrl}/conversations/${conversationId}/#message-${message.id}`;
      }
    } else {
      messageUrl = `${baseUrl}/message/${message.id}`;
    }
    
    // Copier uniquement l'URL
    await navigator.clipboard.writeText(messageUrl);
    toast.success(t('linkCopied') || 'Lien copié !');
  } catch (error) {
    console.error('Failed to copy message link:', error);
    toast.error(t('copyFailed'));
  }
}, [conversationId, message.id, t]);
```

### 2. Nouveau bouton dans la section "Attachments seuls"
Ajout du bouton entre "Réaction" et "Supprimer" :

```tsx
{/* Bouton copier le lien */}
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopyMessageLink}
      className="h-7 w-7 p-0 rounded-full transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100"
      aria-label={t('copyLink') || 'Copier le lien'}
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>{t('copyLink') || 'Copier le lien'}</p>
  </TooltipContent>
</Tooltip>
```

## 📐 Layout final

### Messages avec attachments seuls
```
[Avatar] 📎 Image.jpg              
         📄 Document.pdf
         
         💬 😀 📋 🗑️                ← Actions
         │  │  │  └─ Supprimer
         │  │  └──── Copier le lien (NOUVEAU)
         │  └─────── Réagir
         └────────── Commenter
```

### Comparaison avec messages textuels
```
Message avec texte:
- Bouton "Copier" → Copie texte + lien

Message avec attachments seuls:
- Bouton "Copier le lien" → Copie uniquement le lien
```

## 🎨 Bénéfices UX

### 1. **Partage facilité**
- Les utilisateurs peuvent maintenant partager des messages avec médias uniquement
- Le lien pointe directement vers le message (ancre `#message-{id}`)

### 2. **Cohérence**
- Tous les messages ont un moyen de copier/partager leur lien
- Même comportement que les apps modernes

### 3. **Clarté d'intention**
- Messages avec texte : "Copier" (texte + lien)
- Messages sans texte : "Copier le lien" (lien uniquement)

## 🔄 Formats d'URL générés

### Dans une conversation
```
/chat/{conversationId}/#message-{messageId}
/conversations/{conversationId}/#message-{messageId}
```

### Message isolé
```
/message/{messageId}
```

## 📱 Cas d'usage

### Scénario 1 : Partage d'une photo
```
Utilisateur A envoie une photo dans le groupe
Utilisateur B clique sur "Copier le lien"
→ Colle le lien dans Slack/Email
→ Collègues cliquent et voient directement la photo
```

### Scénario 2 : Référencement d'un document
```
Utilisateur envoie un PDF important
Plus tard, quelqu'un demande "où est le doc?"
→ Click "Copier le lien"
→ Partage le lien direct vers le message avec le PDF
```

### Scénario 3 : Signalement/Modération
```
Message avec image inappropriée
Modérateur copie le lien
→ Rapporte le lien exact aux admins
→ Navigation directe vers le message problématique
```

## 🧪 Tests recommandés

### Fonctionnels
- [ ] Click sur "Copier le lien" dans message avec image seule
- [ ] Click sur "Copier le lien" dans message avec plusieurs fichiers
- [ ] Vérifier que le lien est bien copié dans le clipboard
- [ ] Coller le lien et vérifier la navigation vers le message
- [ ] Vérifier le toast de succès "Lien copié !"

### Rétrocompatibilité
- [ ] Messages avec texte : Bouton "Copier" fonctionne toujours ✅
- [ ] Messages avec texte + attachments : Bouton "Copier" fonctionne ✅
- [ ] Messages texte seul : Comportement inchangé ✅

### Edge cases
- [ ] Message sans conversationId (message direct)
- [ ] URL générée dans /chat/ vs /conversations/
- [ ] Erreur clipboard (permissions refusées)

## 🎯 Fichiers modifiés

### Frontend
- `frontend/components/common/bubble-message/BubbleMessageNormalView.tsx`
  - Ajout de `handleCopyMessageLink()` (ligne ~293)
  - Ajout du bouton "Copier le lien" (ligne ~1030)

### Traductions requises (optionnel)
Ajout recommandé dans les fichiers de traduction :

```json
{
  "copyLink": "Copier le lien",
  "linkCopied": "Lien copié !"
}
```

Fichiers concernés :
- `frontend/locales/fr/bubbleMessage.json` (ou common.json)
- `frontend/locales/en/bubbleMessage.json`

## 📊 Statistiques

### Lignes de code ajoutées
- Fonction `handleCopyMessageLink` : ~30 lignes
- Bouton UI : ~16 lignes
- **Total** : ~46 lignes

### Complexité
- ✅ Faible complexité
- ✅ Réutilise la logique existante
- ✅ Aucune dépendance externe

### Performance
- ✅ Aucun impact (fonction appelée uniquement au click)
- ✅ Pas de re-render supplémentaire
- ✅ Pas de calcul coûteux

## 🚀 Déploiement

### Aucune modification backend
- ✅ Changement purement frontend
- ✅ Aucune API modifiée
- ✅ Aucune migration DB

### Build
```bash
cd frontend
pnpm run build
```

### Compatibilité
- ✅ Compatible avec tous les navigateurs modernes (Clipboard API)
- ⚠️ Fallback possible pour navigateurs anciens (si nécessaire)

---

**Date**: 21 octobre 2025  
**Version**: 1.9.3  
**Auteur**: Équipe Meeshy  
**Status**: ✅ Implémenté et prêt à tester
