# 🚀 Démarrage Rapide - Tests E2E Meeshy

## Installation (30 secondes)

```bash
cd tests/
pnpm install
chmod +x run-test.sh
```

## Test Rapide (1 minute)

```bash
# Test rapide sur la conversation "meeshy"
./run-test.sh quick meeshy
```

**Ce que fait ce test:**
1. ✅ Se connecte au WebSocket
2. ✅ Envoie un message de test
3. ✅ Affiche les traductions reçues en temps réel
4. ✅ Résultat en 10 secondes

## Test Complet (2-3 minutes)

```bash
# Test exhaustif avec tous les utilisateurs
./run-test.sh full meeshy
```

**Ce que fait ce test:**
1. ✅ Récupère tous les utilisateurs de la conversation
2. ✅ Connecte chaque utilisateur au WebSocket
3. ✅ Envoie un message et attend toutes les traductions
4. ✅ Compare traductions reçues vs attendues
5. ✅ Vérifie en base de données
6. ✅ Génère un rapport détaillé avec diagnostics

## Interprétation des résultats

### ✅ Test réussi
```
✅ TEST RÉUSSI - Toutes les traductions ont été reçues
```
**Signification:** Le système fonctionne correctement, toutes les traductions sont diffusées.

### ❌ Test échoué - Aucune traduction
```
❌ TEST ÉCHOUÉ - Des traductions sont manquantes
Traductions reçues: 0
```

**Causes possibles:**
- Le service de traduction n'est pas démarré
- ZMQ non configuré correctement
- La conversation n'a qu'un seul participant

**Solution:**
```bash
# Vérifier que le translator est actif
docker ps | grep translator

# Si non actif, démarrer
docker-compose up -d translator

# Vérifier les logs
docker logs meeshy-translator-1 -f
```

### ❌ Test échoué - Traductions partielles
```
❌ TEST ÉCHOUÉ - Des traductions sont manquantes
Langues attendues: fr, en, es, de
Langues reçues: fr
Langues manquantes: en, es, de
```

**Signification:** Une seule traduction est reçue au lieu de toutes (votre problème actuel!)

**Causes possibles:**
1. Le TranslationService filtre incorrectement les langues cibles
2. Seule la première traduction est diffusée via WebSocket
3. L'événement 'translationReady' est émis une seule fois au lieu de plusieurs fois

**Solution - Vérifier le code:**

```typescript
// Dans gateway/src/services/TranslationService.ts
// Ligne ~263 : _processTranslationsAsync()

// VÉRIFIER ICI:
const filteredTargetLanguages = targetLanguages.filter(targetLang => {
  // Cette ligne filtre les langues identiques
  if (sourceLang === targetLang) {
    return false;
  }
  return true;
});

console.log(`🌍 Langues cibles finales (après filtrage): ${filteredTargetLanguages.join(', ')}`);
// ⚠️ Vérifier que TOUTES les langues s'affichent ici
```

```typescript
// Dans gateway/src/services/TranslationService.ts
// Ligne ~511 : _handleTranslationCompleted()

// VÉRIFIER ICI:
this.emit('translationReady', {
  taskId: data.taskId,
  result: data.result,
  targetLanguage: data.targetLanguage,
  translationId: translationId,
  metadata: data.metadata || {}
});
// ⚠️ Cet événement doit être émis pour CHAQUE langue
```

```typescript
// Dans gateway/src/socketio/MeeshySocketIOManager.ts
// Ligne ~847 : _handleTranslationReady()

// VÉRIFIER ICI:
this.io.to(roomName).emit('message:translation', translationData);
// ⚠️ Cette ligne doit diffuser à TOUS les clients dans la room
```

## Diagnostic avancé

Si le problème persiste, utilisez ces commandes pour investiguer:

### 1. Vérifier les logs du gateway en temps réel
```bash
docker logs meeshy-gateway-1 -f | grep -E "(Translation|Langue|targetLanguage)"
```

### 2. Vérifier combien de traductions sont créées en base
```bash
# Connexion à PostgreSQL
docker exec -it meeshy-postgres-1 psql -U meeshy -d meeshy

# Vérifier les traductions d'un message
SELECT 
  m.id AS message_id,
  m.content,
  m."originalLanguage",
  COUNT(mt.id) AS translation_count,
  STRING_AGG(mt."targetLanguage", ', ') AS languages
FROM "Message" m
LEFT JOIN "MessageTranslation" mt ON mt."messageId" = m.id
WHERE m.id = 'VOTRE_MESSAGE_ID'
GROUP BY m.id;
```

### 3. Vérifier les participants et leurs langues
```bash
# Dans psql
SELECT 
  c.id AS conversation_id,
  c.title,
  u.username,
  u."systemLanguage",
  u."regionalLanguage",
  u."autoTranslateEnabled"
FROM "Conversation" c
JOIN "ConversationMember" cm ON cm."conversationId" = c.id
JOIN "User" u ON u.id = cm."userId"
WHERE c.id = 'meeshy'
AND cm."isActive" = true;
```

### 4. Tracer le flux complet avec logs
```bash
# Terminal 1: Gateway
docker logs meeshy-gateway-1 -f

# Terminal 2: Translator
docker logs meeshy-translator-1 -f

# Terminal 3: Lancer le test
./run-test.sh quick meeshy
```

## Problème spécifique: Une seule traduction reçue

Si vous recevez toujours une seule traduction, voici le code à vérifier en priorité:

### 🔍 Point de contrôle 1: Extraction des langues
```typescript
// gateway/src/services/TranslationService.ts:419
private async _extractConversationLanguages(conversationId: string): Promise<string[]>
```
**Ajouter ce log:**
```typescript
console.log(`🔍 DEBUG: Langues extraites brutes:`, Array.from(languages));
```

### 🔍 Point de contrôle 2: Filtrage des langues
```typescript
// gateway/src/services/TranslationService.ts:290
const filteredTargetLanguages = targetLanguages.filter(...)
```
**Ajouter ce log:**
```typescript
console.log(`🔍 DEBUG: Avant filtrage:`, targetLanguages);
console.log(`🔍 DEBUG: Après filtrage:`, filteredTargetLanguages);
console.log(`🔍 DEBUG: Langue source:`, message.originalLanguage);
```

### 🔍 Point de contrôle 3: Requête ZMQ
```typescript
// gateway/src/services/TranslationService.ts:308
const request: TranslationRequest = {
  ...
  targetLanguages: filteredTargetLanguages,
  ...
};
```
**Ajouter ce log:**
```typescript
console.log(`🔍 DEBUG: Requête ZMQ:`, JSON.stringify(request, null, 2));
```

### 🔍 Point de contrôle 4: Réception des traductions
```typescript
// gateway/src/services/TranslationService.ts:511
private async _handleTranslationCompleted(data)
```
**Ajouter ce log:**
```typescript
console.log(`🔍 DEBUG: Traduction reçue - taskId: ${data.taskId}, langue: ${data.targetLanguage}`);
console.log(`🔍 DEBUG: Total traductions reçues: ${this.stats.translations_received}`);
```

### 🔍 Point de contrôle 5: Diffusion WebSocket
```typescript
// gateway/src/socketio/MeeshySocketIOManager.ts:847
private async _handleTranslationReady(data)
```
**Ajouter ce log:**
```typescript
console.log(`🔍 DEBUG: Broadcasting traduction ${data.result.messageId} -> ${data.targetLanguage}`);
console.log(`🔍 DEBUG: Clients dans la room: ${clientCount}`);
```

## 📞 Besoin d'aide?

Si le problème persiste après ces vérifications:

1. Collectez les logs complets: `docker logs meeshy-gateway-1 > gateway.log`
2. Exportez les résultats du test: `./run-test.sh full meeshy > test-results.txt`
3. Vérifiez la base de données (requête SQL ci-dessus)
4. Partagez ces 3 fichiers pour analyse

## 🎯 Prochaines étapes

Une fois le problème identifié:

1. **Corriger le code** dans le service approprié
2. **Re-tester** avec `./run-test.sh full meeshy`
3. **Valider** que toutes les traductions sont reçues
4. **Documenter** la correction dans le changelog

Bonne chance! 🚀

