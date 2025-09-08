# Guide de Test - Communication ZMQ Meeshy

Ce guide explique comment tester la communication ZMQ entre la Gateway et le Translator après les corrections.

## Scripts de Test Disponibles

### 1. Test API REST (`test-api-rest.js`)

Teste la communication ZMQ via l'API REST de traduction.

```bash
# Exécuter le test
node test-api-rest.js

# Ou directement
./test-api-rest.js
```

**Ce que teste le script :**
- ✅ Endpoint `/info` - Informations sur le service
- ✅ Endpoint `/health` - Santé des services
- ✅ Endpoint `/translate` - Traduction via ZMQ
- ✅ Vérification de la confiance (doit être > 0.9)
- ✅ Vérification du modèle (ne doit pas être "fallback")
- ✅ Mesure des temps de traitement

**Résultats attendus :**
```
📝 Test: Traduction EN → FR
   Texte: "Hello world from REST API test"
   Langue: en → fr
   ✅ Succès (3045ms)
   📄 Traduit: "Bonjour le monde test API REST"
   🎯 Confiance: 0.95
   🤖 Modèle: medium
   ⏱️  Temps ML: 3.045s
   🚀 Communication ZMQ: ✅
```

### 2. Test WebSocket (`test-websocket.js`)

Teste la communication WebSocket avec traduction automatique.

```bash
# Installer les dépendances si nécessaire
pnpm add socket.io-client

# Exécuter le test
node test-websocket.js
```

**Ce que teste le script :**
- ✅ Connexion WebSocket avec authentification JWT
- ✅ Envoi de message via `message:send`
- ✅ Réception de la réponse avec messageId
- ✅ Traduction automatique via ZMQ
- ✅ Réception des traductions via `translation:ready`

**Résultats attendus :**
```
🔌 Test de communication WebSocket...
✅ Connecté au WebSocket
🆔 Socket ID: 2eFVacfEQ-e1TrUMAAAF
📤 Envoi d'un message de test...
📥 Réponse du message: { success: true, data: { messageId: '68bf3d3cb2ad658cdea7b0b4' } }
✅ Message envoyé avec succès, ID: 68bf3d3cb2ad658cdea7b0b4
🔄 Traduction automatique en cours via ZMQ...
🌍 Traduction ZMQ reçue: {
  messageId: '68bf3d3cb2ad658cdea7b0b4',
  translatedText: 'Bonjour le monde du test WebSocket',
  targetLanguage: 'fr',
  confidence: 0.95
}
```

## Tests Manuels

### Test API REST avec curl

```bash
# Test de traduction
curl -X POST https://gate.meeshy.me/translate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "text": "Hello world test",
    "source_language": "en",
    "target_language": "fr",
    "conversation_id": "68be015e7ac0a15c903f47a8"
  }' \
  -k
```

### Test de connectivité ZMQ

```bash
# Vérifier que les ports ZMQ sont ouverts
ssh root@157.230.15.51 "docker exec meeshy-gateway nc -zv translator 5555"
ssh root@157.230.15.51 "docker exec meeshy-gateway nc -zv translator 5558"

# Vérifier les variables d'environnement
ssh root@157.230.15.51 "docker exec meeshy-gateway env | grep ZMQ"
```

## Monitoring des Logs

### Logs de la Gateway

```bash
# Suivre les logs en temps réel
ssh root@157.230.15.51 "docker logs -f meeshy-gateway"

# Filtrer les logs ZMQ
ssh root@157.230.15.51 "docker logs meeshy-gateway | grep -E 'ZMQ|translation|pong'"
```

**Logs importants à surveiller :**
- `📤 [ZMQ-Client] Commande PUSH envoyée` - Envoi réussi
- `📨 [ZMQ-Client] Message reçu dans la boucle` - Réception réussie
- `🏓 [GATEWAY] Pong reçu du Translator` - Communication bidirectionnelle
- `✅ [GATEWAY] Traduction terminée` - Traduction ZMQ réussie

### Logs du Translator

```bash
# Suivre les logs en temps réel
ssh root@157.230.15.51 "docker logs -f meeshy-translator"

# Filtrer les logs de traduction
ssh root@157.230.15.51 "docker logs meeshy-translator | grep -E 'translation|ZMQ|ML'"
```

**Logs importants à surveiller :**
- `📥 [TRANSLATOR] Commande PULL reçue` - Réception de la requête
- `✅ [ML-ZMQ] 'text' → 'translation'` - Traduction ML réussie
- `📤 [TRANSLATOR] Résultat envoyé à la Gateway` - Envoi de la réponse

## Indicateurs de Succès

### ✅ Communication ZMQ Fonctionnelle

1. **Confiance élevée** : `confidence > 0.9` (au lieu de 0.1)
2. **Modèle ML** : `model_used = "medium"` (au lieu de "fallback")
3. **Temps de traitement** : `processing_time > 1s` (temps réel ML)
4. **Ping/Pong** : Communication bidirectionnelle active

### ✅ Traduction en Temps Réel

1. **API REST** : Traduction immédiate via ZMQ
2. **WebSocket** : Messages traduits automatiquement
3. **Multi-langues** : Traduction en plusieurs langues simultanément
4. **Performance** : Pas de timeout de 10 secondes

## Dépannage

### Problème : Mode Fallback

**Symptômes :**
- `confidence: 0.1`
- `model_used: "fallback"`
- `processing_time: 0.001s`

**Solutions :**
1. Vérifier les variables d'environnement ZMQ
2. Redémarrer la gateway avec la bonne configuration
3. Vérifier la connectivité réseau entre conteneurs

### Problème : Timeout de 10 secondes

**Symptômes :**
- Message "Timeout de traduction après 10000ms"
- Utilisation du mode fallback

**Solutions :**
1. Vérifier que le translator est en cours d'exécution
2. Vérifier les ports ZMQ (5555, 5558)
3. Vérifier les logs du translator

### Problème : WebSocket ne reçoit pas de traductions

**Symptômes :**
- Message envoyé mais pas de traduction reçue
- Pas d'événement `translation:ready`

**Solutions :**
1. Vérifier l'authentification JWT
2. Vérifier que l'utilisateur est membre de la conversation
3. Vérifier les logs de la gateway pour les erreurs

## Configuration Requise

### Variables d'Environnement Gateway

```bash
ZMQ_TRANSLATOR_HOST=translator
ZMQ_TRANSLATOR_PUSH_PORT=5555
ZMQ_TRANSLATOR_SUB_PORT=5558
ZMQ_PUSH_URL=tcp://translator:5555
ZMQ_SUB_URL=tcp://translator:5558
```

### Variables d'Environnement Translator

```bash
ZMQ_PUSH_PORT=5555
ZMQ_SUB_PORT=5558
```

## Support

En cas de problème, vérifier :
1. Les logs des deux services
2. La connectivité réseau entre conteneurs
3. Les variables d'environnement
4. L'état des services Docker

Pour plus d'informations, voir `ZMQ_COMMUNICATION_FIX.md`.
