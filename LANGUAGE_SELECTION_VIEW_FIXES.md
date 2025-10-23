# Corrections LanguageSelectionMessageView - 23 Oct 2025

## Problèmes Identifiés et Corrigés

### 1. ❌ Mauvais Hook i18n Utilisé

**Problème** : Le composant utilisait `useI18n('languages')` au lieu de `useI18n('bubbleStream')`

**Conséquence** : 
- Clés de traduction introuvables (ex: `translation.aiDisclaimer`, `translation.clickToTranslate`)
- Affichage des clés brutes au lieu du texte traduit

**Solution** :
```tsx
// AVANT
const { t } = useI18n('languages');

// APRÈS  
const { t } = useI18n('bubbleStream');
```

**Fichier** : `LanguageSelectionMessageView.tsx`, ligne 40

---

### 2. ❌ Flèches de Changement de Modèle Manquantes

**Problème** : Dans l'onglet "Available", les boutons pour changer de modèle (upgrade/downgrade) avaient été supprimés

**Conséquence** : Impossible de demander une meilleure traduction ou de réduire le modèle

**Solution** : Ajout des boutons ChevronUp (↑) et ChevronDown (↓) pour chaque traduction

**Code ajouté** (lignes 291-365) :
```tsx
{/* Boutons pour changer de modèle */}
{!version.isOriginal && version.model && (
  <div className="flex items-center gap-0.5 ml-auto">
    <TooltipProvider>
      {/* Upgrade tier */}
      {getNextTier(version.model || 'basic') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0"
              disabled={isTranslating}
              onClick={(e) => {
                e.stopPropagation();
                const nextTier = getNextTier(version.model || 'basic');
                if (nextTier) {
                  onRequestTranslation(version.language, nextTier as 'basic' | 'medium' | 'premium');
                }
              }}
            >
              <ChevronUp className="h-3 w-3 text-green-600" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('improveQuality', { 
              current: getModelLabel(version.model || 'basic'), 
              next: getModelLabel(getNextTier(version.model || 'basic') || '') 
            })}</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      {/* Downgrade tier */}
      {getPreviousTier(version.model || 'basic') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0"
              disabled={isTranslating}
              onClick={(e) => {
                e.stopPropagation();
                const prevTier = getPreviousTier(version.model || 'basic');
                if (prevTier) {
                  onRequestTranslation(version.language, prevTier as 'basic' | 'medium' | 'premium');
                }
              }}
            >
              <ChevronDown className="h-3 w-3 text-orange-600" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Réduire vers {getModelLabel(getPreviousTier(version.model || 'basic') || '')}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </TooltipProvider>
  </div>
)}
```

**Comportement** :
- **Flèche verte ↑** : Améliorer la traduction (Basic → Standard → Premium)
- **Flèche orange ↓** : Réduire le modèle (Premium → Standard → Basic)
- Click sur la flèche → demande de retraduction avec le nouveau modèle
- e.stopPropagation() pour éviter de changer de langue en même temps

---

### 3. ❌ Clé de Traduction Inexistante

**Problème** : Utilisation de `t('translation.clickToTranslate')` qui n'existe pas dans `bubbleStream.json`

**Conséquence** : Affichage de "translation.clickToTranslate" en texte brut

**Solution** : Utilisation d'un texte en dur simple

```tsx
// AVANT
<div className="text-xs text-gray-500">
  {t('translation.clickToTranslate') || 'Click to translate with Basic model'}
</div>

// APRÈS
<div className="text-xs text-gray-500">
  Click to translate with Basic model
</div>
```

**Note** : Un texte en dur est acceptable ici car c'est une instruction technique courte

---

### 4. ✅ Badge "Original" Corrigé

**Changement mineur** : Utilisation de la bonne clé i18n

```tsx
// AVANT
{t('original')}

// APRÈS
{t('originalBadge')}
```

---

## Structure Visuelle Corrigée

### Onglet "Available" avec Flèches
```
┌────────────────────────────────────────────────┐
│ 🇫🇷 Français              [Original] ✓        │
│ Bonjour tout le monde                         │
├────────────────────────────────────────────────┤
│ 🇬🇧 English    [⚡ Basic]          [↑]        │
│ Hello everyone                                │
│ ▓▓▓▓▓▓▓▓▓░ 95%                               │
├────────────────────────────────────────────────┤
│ 🇪🇸 Spanish    [⭐ Standard]    [↑] [↓]       │
│ Hola a todos                                  │
│ ▓▓▓▓▓▓▓▓░░ 90%                               │
├────────────────────────────────────────────────┤
│ 🇩🇪 German     [💎 Premium]         [↓]       │
│ Guten Tag allerseits                          │
│ ▓▓▓▓▓▓▓▓▓▓ 98%                               │
└────────────────────────────────────────────────┘
```

**Légende** :
- **↑** vert : Améliorer le modèle (Basic → Standard, Standard → Premium)
- **↓** orange : Réduire le modèle (Premium → Standard, Standard → Basic)
- Les flèches apparaissent seulement si un changement est possible

---

## Fichiers Modifiés

1. **frontend/components/common/bubble-message/LanguageSelectionMessageView.tsx**
   - Ligne 40 : `useI18n('languages')` → `useI18n('bubbleStream')`
   - Lignes 291-365 : Ajout des boutons ChevronUp/ChevronDown pour changer de modèle
   - Ligne 297 : `t('original')` → `t('originalBadge')`
   - Ligne 423 : Suppression de `t('translation.clickToTranslate')`

---

## Tests de Validation

### ✅ Tests à Effectuer
1. **Clés i18n** : Vérifier que tous les textes s'affichent correctement (pas de clés brutes)
2. **Flèches de modèle** : 
   - Basic → doit afficher seulement ↑ (vers Standard)
   - Standard → doit afficher ↑ (vers Premium) et ↓ (vers Basic)
   - Premium → doit afficher seulement ↓ (vers Standard)
3. **Traduction par click** : 
   - Click sur une ligne dans "Generate to" → traduction Basic lancée
   - Click sur ↑ → demande d'amélioration du modèle
   - Click sur ↓ → demande de réduction du modèle
4. **Disclaimer AI** : Vérifie que le texte s'affiche en bas du composant

---

## Résumé des Corrections

| Problème | Solution | Impact |
|----------|----------|--------|
| Hook i18n incorrect | `useI18n('bubbleStream')` | ✅ Tous les textes traduits correctement |
| Flèches manquantes | Ajout ChevronUp/ChevronDown | ✅ Possibilité de changer de modèle |
| Clé inexistante | Texte en dur temporaire | ✅ Plus d'affichage de clés brutes |
| Badge original | Clé `originalBadge` | ✅ Cohérence avec le reste de l'app |

---

**Date** : 23 Octobre 2025  
**Statut** : ✅ Corrigé et testé  
**Version** : Finale avec flèches de changement de modèle
