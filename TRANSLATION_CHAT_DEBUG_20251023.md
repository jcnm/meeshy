# Debug des Traductions dans /chat - 23 Oct 2025

## Problème Signalé

> "Dans /chat on ne voit pas les traductions comme dans / et /conversations !"

## Architecture du Système de Traduction

### Routes et Composants

1. **`/` (Page Publique)** - `app/page.tsx`
   - Utilise: `BubbleStreamPage`
   - Hook: `useConversationMessages(conversationId: "meeshy")`
   - API: `/api/conversations/meeshy/messages`

2. **`/conversations/:id`** - `app/conversations/[id]/page.tsx`
   - Utilise: `ConversationLayout` → `BubbleStreamPage`
   - Hook: `useConversationMessages(conversationId: id)`
   - API: `/api/conversations/:id/messages`

3. **`/chat/:id`** - `app/chat/[id]/page.tsx`
   - Utilise: `BubbleStreamPage`
   - Hook: `useConversationMessages(conversationId, linkId: id)`
   - API: `/api/links/:linkId/messages` (mode anonyme)

## Flux des Traductions

### Backend (Gateway)

#### Endpoint `/api/links/:linkId/messages`
Fichier: `gateway/src/routes/links.ts` (lignes 799-807)

```typescript
translations: {
  select: {
    id: true,
    targetLanguage: true,
    translatedContent: true,
    translationModel: true,
    sourceLanguage: true,
    cacheKey: true,
    confidenceScore: true,
    createdAt: true
  }
}
```

**✅ VÉRIFIÉ**: Le backend inclut bien tous les champs nécessaires des traductions.

### Frontend

#### Hook `useConversationMessages`
Fichier: `frontend/hooks/use-conversation-messages.ts` (ligne 106-108)

```typescript
if (sessionToken && linkId) {
  endpoint = `/api/links/${linkId}/messages`;
  requestOptions.headers = { 'x-session-token': sessionToken };
}
```

**✅ VÉRIFIÉ**: Le hook utilise le bon endpoint pour les liens.

#### Composant `MessagesDisplay`
Fichier: `frontend/components/common/messages-display.tsx`

**🔍 LOGS AJOUTÉS** (ligne 87-120):
```typescript
const getPreferredDisplayLanguage = useCallback((message: any): string => {
  console.log(`🔍 [MESSAGES-DISPLAY] Calcul de la langue préférée pour message ${message.id.substring(0, 8)}:`, {
    originalLanguage: message.originalLanguage,
    userLanguage,
    hasTranslations: !!(message.translations && message.translations.length > 0),
    translationsCount: message.translations?.length || 0,
    availableLanguages: message.translations?.map((t: any) => t.language || t.targetLanguage).join(', ') || 'none'
  });
  
  // ... logique de sélection de langue ...
}, [userLanguage]);
```

Ces logs permettront de voir:
1. Si les messages ont des traductions
2. Quelles langues sont disponibles
3. Quelle langue est choisie pour l'affichage

#### Composant `BubbleMessage`
Fichier: `frontend/components/common/bubble-message.tsx` (ligne 373-390)

```typescript
const currentContent = useMemo(() => {
  const originalLang = message.originalLanguage || 'fr';
  
  if (currentDisplayLanguage === originalLang) {
    return message.originalContent || message.content;
  }
  
  const translation = message.translations?.find((t: any) => 
    (t?.language || t?.targetLanguage) === currentDisplayLanguage
  );
  
  if (translation) {
    // CRITIQUE: Prioriser translatedContent (backend) sur content (legacy)
    const content = ((translation as any)?.translatedContent || (translation as any)?.content);
    return content || message.originalContent || message.content;
  }
  
  return message.originalContent || message.content;
}, [currentDisplayLanguage, message.id, ...]);
```

**✅ VÉRIFIÉ**: La logique d'affichage priorise bien `translatedContent`.

## Tests à Effectuer

### 1. Test avec LinkId Réel
```bash
# LinkId fourni par l'utilisateur
LINK_ID="mshy_68f7a29236c5cf400d9af62f.2510211711_t9meche3"

# Tester l'API avec un token de session anonyme
curl "http://localhost:3000/api/links/${LINK_ID}/messages?limit=5&include_translations=true" \
  -H "x-session-token: YOUR_SESSION_TOKEN"
```

### 2. Vérifier les Logs Frontend

Quand vous ouvrez `/chat/mshy_68f7a29236c5cf400d9af62f.2510211711_t9meche3`:

**Logs attendus dans la console du navigateur:**

```
🔍 [MESSAGES-DISPLAY] Calcul de la langue préférée pour message XXXXXXXX: {
  originalLanguage: "fr",
  userLanguage: "en",
  hasTranslations: true,
  translationsCount: 2,
  availableLanguages: "en, es"
}

🌐 [MESSAGES-DISPLAY] Traduction trouvée pour XXXXXXXX en en {
  hasTranslatedContent: true,
  hasContent: false,
  translatedContentPreview: "Hello everyone...",
  contentPreview: "none"
}
```

**OU (si pas de traductions):**

```
⚠️ [MESSAGES-DISPLAY] Pas de traduction en en pour XXXXXXXX, affichage en fr
```

### 3. Vérifier les Logs Backend

```bash
tail -f gateway/gateway.log | grep "Translation stats"
```

Logs attendus:
```
Translation stats for /chat: { 
  totalMessages: 10, 
  messagesWithTranslations: 5, 
  translationsDetails: [...] 
}
```

## Hypothèses de Problèmes

### Hypothèse 1: Traductions Non Chargées par l'API
**Symptôme**: `translationsCount: 0` dans les logs frontend
**Cause**: L'endpoint `/api/links/:linkId/messages` ne charge pas les traductions
**Solution**: Vérifier que `include_translations=true` est bien passé

### Hypothèse 2: Format de Données Incorrect
**Symptôme**: `hasTranslations: true` mais `availableLanguages: "none"`
**Cause**: Les traductions n'ont pas le bon format (missing `targetLanguage` ou `language`)
**Solution**: Vérifier le mapping Prisma dans `links.ts`

### Hypothèse 3: Langue Utilisateur Non Matchée
**Symptôme**: Traduction trouvée mais pas affichée
**Cause**: `currentDisplayLanguage` ne correspond pas à `targetLanguage`
**Solution**: Vérifier la normalisation des codes de langue (fr vs FR)

### Hypothèse 4: Session Anonyme Invalide
**Symptôme**: Erreur 401 ou messages non chargés
**Cause**: Token de session anonyme manquant ou expiré
**Solution**: Régénérer une session anonyme via `/api/links/:linkId/join`

## Actions Correctives Déjà Effectuées

1. ✅ **Backend** - Ajout de tous les champs de traduction dans `links.ts:799-807`
2. ✅ **Backend** - Ajout de logs de statistiques dans `links.ts:846-855`
3. ✅ **Frontend** - Ajout de logs détaillés dans `messages-display.tsx:87-120`
4. ✅ **Frontend** - Vérification de la priorité `translatedContent` dans `bubble-message.tsx`

## Prochaines Étapes

1. **Tester avec le linkId fourni**: `mshy_68f7a29236c5cf400d9af62f.2510211711_t9meche3`
2. **Capturer les logs frontend** lors du chargement de `/chat/:linkId`
3. **Comparer** avec les logs de `/` et `/conversations` pour identifier les différences
4. **Identifier** quelle hypothèse correspond au problème réel
5. **Corriger** en fonction des logs observés

## Notes Importantes

- **Tous les composants utilisent `BubbleStreamPage`**: Donc la logique d'affichage est identique
- **La différence principale**: L'endpoint API (`/api/links/:linkId/messages` vs `/api/conversations/:id/messages`)
- **Point critique**: Les traductions doivent avoir `translatedContent` ET `targetLanguage` pour être affichées

## Commandes de Debug Utiles

```bash
# Redémarrer les services
./scripts/development/development-stop-local.sh
./scripts/development/development-start-local.sh

# Suivre les logs en temps réel
tail -f frontend/frontend.log | grep MESSAGES-DISPLAY
tail -f gateway/gateway.log | grep "Translation stats"

# Tester l'API directement
curl "http://localhost:3000/api/links/LINK_ID/messages?limit=2&include_translations=true" \
  -H "x-session-token: SESSION_TOKEN" | jq '.data.messages[0].translations'
```
