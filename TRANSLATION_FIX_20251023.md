# Fix du système de traduction frontend

**Date**: 23 octobre 2025  
**Problème**: Les traductions ne s'affichaient pas correctement après une demande de traduction, et après rafraîchissement elles disparaissaient complètement.

## 🐛 Problèmes identifiés

### 1. Simulation de traduction au lieu d'utiliser la vraie traduction du backend
**Fichier**: `frontend/components/common/messages-display.tsx`
**Ligne**: 143-167

Le code créait une **fausse traduction** ("Translation in progress...") au lieu d'attendre la vraie traduction du backend via WebSocket :

```typescript
// ❌ AVANT (code problématique)
if (onTranslation) {
  setTimeout(() => {
    onTranslation(messageId, [{
      translatedContent: result.translationId ? 'Translation in progress...' : 'Translation requested',
      // ...
    }]);
    
    // Arrêter l'état de traduction IMMÉDIATEMENT
    setMessageDisplayStates(prev => ({
      ...prev,
      [messageId]: { ...prev[messageId], isTranslating: false }
    }));
  }, 1000);
}
```

**Conséquence** : L'utilisateur voyait le texte original ou "Translation in progress..." au lieu du contenu traduit réel.

### 2. Mauvais ordre de priorité dans le mapping des traductions
**Fichier**: `frontend/components/common/bubble-message.tsx`
**Lignes**: 522, 385, 412

Le mapping utilisait `t.content || t.translatedContent` au lieu de `t.translatedContent || t.content`, ce qui donnait priorité à un champ potentiellement vide ou legacy au lieu du contenu traduit réel venant du backend.

```typescript
// ❌ AVANT
content: t.content || t.translatedContent  // Mauvais ordre !

// ✅ APRÈS
content: t.translatedContent || t.content  // Priorise le backend
```

### 3. Manque de logs pour le debugging
Les traductions arrivaient via WebSocket mais il n'y avait aucun log pour suivre le flux et comprendre ce qui se passait.

## ✅ Corrections apportées

### 1. Suppression de la fausse traduction dans `messages-display.tsx`
```typescript
// ✅ CORRECTION
// NOTE: Ne pas simuler de traduction !
// La vraie traduction sera reçue via WebSocket (événement MESSAGE_TRANSLATION)
// et traitée par le callback onTranslation du composant parent

console.log(`🔄 [MessagesDisplay] Traduction demandée pour ${messageId} vers ${targetLanguage}`, result);

// Garder l'état "isTranslating" actif jusqu'à réception de la vraie traduction via WebSocket
// L'état sera désactivé dans le callback onTranslation quand la traduction arrivera
```

### 2. Correction de l'ordre de priorité dans `bubble-message.tsx`

**Ligne 520** - Dans `availableVersions` :
```typescript
// ✅ CORRECTION
content: t.translatedContent || t.content  // Priorise translatedContent (backend)
```

**Ligne 383** - Dans `currentContent` :
```typescript
// ✅ CORRECTION
// CRITIQUE: Prioriser translatedContent (backend) sur content (legacy)
const content = ((translation as any)?.translatedContent || (translation as any)?.content);
```

**Ligne 410** - Dans `replyToContent` :
```typescript
// ✅ CORRECTION
// CRITIQUE: Prioriser translatedContent (backend) sur content (legacy)
const content = ((translation as any)?.translatedContent || (translation as any)?.content);
```

### 3. Ajout de logs de debugging dans `bubble-stream-page.tsx`
```typescript
// ✅ AJOUT
console.log(`🌍 [BubbleStreamPage] Traduction reçue via WebSocket:`, {
  messageId,
  translationsCount: translations.length,
  translations: translations.map(t => ({
    targetLanguage: t.targetLanguage || t.language,
    contentPreview: (t.translatedContent || t.content)?.substring(0, 50) + '...',
    hasTranslatedContent: !!t.translatedContent,
    hasContent: !!t.content
  }))
});

console.log(`🔍 [BubbleStreamPage] Message avant mise à jour des traductions:`, { ... });

console.log(`✅ [BubbleStreamPage] Message après mise à jour des traductions:`, { ... });
```

## 🔄 Flux de traduction corrigé

1. **Utilisateur demande une traduction** (clic sur langue dans le popover)
   - `handleForceTranslation` dans `bubble-message.tsx`
   - Appelle `onForceTranslation` du parent (messages-display)
   - `messageTranslationService.requestTranslation()` envoie la requête à l'API Gateway

2. **API Gateway traite la requête** (`/api/translate`)
   - `gateway/src/routes/translation-non-blocking.ts`
   - Récupère le message de la BDD
   - Envoie la requête au Translator via ZMQ
   - Répond IMMÉDIATEMENT au client (non-bloquant)

3. **Translator traduit le message**
   - `translator/src/api/translation_api.py`
   - Utilise le modèle ML (MT5/NLLB)
   - Sauvegarde la traduction dans `MessageTranslation`
   - Envoie le résultat via ZMQ PUB

4. **Gateway reçoit la traduction**
   - `gateway/src/services/zmq-translation-client.ts`
   - Émet un événement `translationCompleted`
   - `TranslationService` sauvegarde dans la BDD
   - `MeeshySocketIOManager` broadcast via WebSocket

5. **Frontend reçoit la traduction via WebSocket**
   - `frontend/services/meeshy-socketio.service.ts` écoute `MESSAGE_TRANSLATION`
   - `use-socketio-messaging.ts` transforme en callback `onTranslation(messageId, translations)`
   - `bubble-stream-page.tsx` appelle `handleTranslation`
   - Met à jour le message avec `updateMessageTranslations`

6. **UI met à jour l'affichage**
   - `messages-display.tsx` détecte la nouvelle traduction
   - Change automatiquement `currentDisplayLanguage` si c'est la langue de l'utilisateur
   - `bubble-message.tsx` re-render avec la traduction
   - L'utilisateur voit le contenu traduit !

## 🧪 Tests à effectuer

1. **Test de traduction basique**
   - Envoyer un message en français
   - Demander une traduction en anglais
   - ✅ Vérifier que le contenu traduit s'affiche (pas "Translation in progress...")

2. **Test après rafraîchissement**
   - Demander une traduction
   - Attendre qu'elle s'affiche
   - Rafraîchir la page (F5)
   - ✅ Vérifier que la traduction est toujours là

3. **Test de changement de langue**
   - Avoir plusieurs traductions pour un message
   - Changer la langue d'affichage dans le popover
   - ✅ Vérifier que le contenu change correctement

4. **Test de retraduction (upgrade de modèle)**
   - Traduire avec "basic"
   - Upgrader vers "medium" ou "premium"
   - ✅ Vérifier que la nouvelle traduction remplace l'ancienne

## 📊 Structure des données

### MessageTranslation (Backend - Prisma)
```typescript
{
  id: string
  messageId: string
  sourceLanguage: string
  targetLanguage: string
  translatedContent: string        // ⭐ Contenu traduit (backend)
  translationModel: 'basic' | 'medium' | 'premium'
  cacheKey: string
  confidenceScore: number
  cached: boolean
  createdAt: Date
}
```

### Translation (Frontend - WebSocket event)
```typescript
{
  id: string
  messageId: string
  sourceLanguage: string
  targetLanguage: string
  translatedContent: string        // ⭐ Contenu traduit (prioritaire)
  content?: string                 // Legacy fallback
  translationModel: 'basic' | 'medium' | 'premium'
  cacheKey: string
  confidenceScore: number
  cached: boolean
  createdAt: Date
}
```

## 🔍 Commandes de debugging

Ouvrir la console du navigateur et filtrer par :
- `🌍` - Traductions reçues
- `🔄` - Requêtes de traduction
- `✅` - Mises à jour réussies
- `❌` - Erreurs

## 📝 Notes importantes

1. **Non-bloquant** : L'API `/translate` répond immédiatement, la traduction arrive via WebSocket
2. **Priorité `translatedContent`** : Toujours utiliser `translatedContent` avant `content`
3. **Pas de simulation** : Ne jamais créer de fausses traductions, attendre la vraie via WebSocket
4. **Cache** : Les traductions sont en cache dans `MessageTranslation`, donc disponibles après rafraîchissement

## ✨ Améliorations futures

1. **Loading state visuel** : Afficher un spinner pendant `isTranslating`
2. **Error handling** : Meilleur feedback si la traduction échoue
3. **Retry logic** : Réessayer automatiquement en cas d'échec
4. **Batch translations** : Traduire plusieurs messages en une seule requête

---
**Testé par** : @jcnm  
**Status** : ✅ Corrections appliquées, tests à effectuer
