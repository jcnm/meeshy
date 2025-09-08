# Correction de la Communication ZMQ entre Gateway et Translator

## Problème identifié

La communication ZMQ entre la gateway et le translator ne fonctionnait pas en production, causant :
- Utilisation du mode "fallback" au lieu du translator ML
- Traductions avec une confiance de 0.1 au lieu de 0.95
- Timeout de 10 secondes avant fallback
- Pas de communication WebSocket → ZMQ → Translator

## Cause racine

La gateway se connectait à `0.0.0.0:5555` et `0.0.0.0:5558` au lieu de `translator:5555` et `translator:5558` car la variable d'environnement `ZMQ_TRANSLATOR_HOST` n'était pas définie.

## Solution implémentée

### 1. Configuration Docker Compose

Ajout des variables d'environnement manquantes dans `docker-compose.traefik.yml` :

```yaml
gateway:
  environment:
    - ZMQ_TRANSLATOR_HOST=translator
    - ZMQ_TRANSLATOR_PUSH_PORT=5555
    - ZMQ_TRANSLATOR_SUB_PORT=5558
```

### 2. Script de déploiement

Correction du script `meeshy-deploy.sh` pour charger correctement les secrets de production :

```bash
# Chargement des secrets de production
if [ -f "/opt/meeshy/secrets/production-secrets.env" ]; then
    echo "🔐 Chargement des secrets de production..."
    set -a
    source /opt/meeshy/secrets/production-secrets.env
    set +a
    echo "✅ Secrets de production chargés"

    # Ajouter les secrets au fichier .env pour docker-compose
    echo "" >> .env
    echo "# ===== SECRETS DE PRODUCTION ======" >> .env
    echo "# Générés automatiquement le $(date)" >> .env
    cat /opt/meeshy/secrets/production-secrets.env >> .env
    echo "✅ Secrets ajoutés au fichier .env"
fi
```

## Résultats obtenus

### ✅ Communication ZMQ fonctionnelle
- **PUSH** : Gateway → Translator (port 5555) ✅
- **SUB** : Gateway ← Translator (port 5558) ✅
- **Ping/Pong** : Communication bidirectionnelle ✅

### ✅ Traduction ML en temps réel
- **Confiance** : 0.95 (au lieu de 0.1)
- **Modèle** : Medium (au lieu de fallback)
- **Temps de traitement** : ~3-5 secondes (temps réel ML)

### ✅ Communication WebSocket
- **Envoi de messages** : `message:send` fonctionne ✅
- **Traduction automatique** : Messages traduits en temps réel ✅
- **Émission aux clients** : Traductions diffusées via WebSocket ✅

## Tests de validation

### API REST
```bash
curl -X POST https://gate.meeshy.me/translate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"text": "Hello world", "source_language": "en", "target_language": "fr", "conversation_id": "<id>"}'
```

**Résultat** : `"translated_text": "Bonjour le monde"` avec `"confidence": 0.95`

### WebSocket
```javascript
socket.emit('message:send', {
  conversationId: 'meeshy',
  content: 'Hello world from WebSocket test',
  originalLanguage: 'en',
  messageType: 'TEXT'
});
```

**Résultat** : Message traduit automatiquement en espagnol et français

## Architecture de communication

```
Frontend (WebSocket) 
    ↓
Gateway (Socket.IO)
    ↓
ZMQ PUSH (port 5555)
    ↓
Translator (ML Service)
    ↓
ZMQ SUB (port 5558)
    ↓
Gateway (Socket.IO)
    ↓
Frontend (WebSocket)
```

## Variables d'environnement critiques

```bash
# Gateway
ZMQ_TRANSLATOR_HOST=translator
ZMQ_TRANSLATOR_PUSH_PORT=5555
ZMQ_TRANSLATOR_SUB_PORT=5558
ZMQ_PUSH_URL=tcp://translator:5555
ZMQ_SUB_URL=tcp://translator:5558

# Translator
ZMQ_PUSH_PORT=5555
ZMQ_SUB_PORT=5558
```

## Monitoring

### Logs de la Gateway
- `📤 [ZMQ-Client] Commande PUSH envoyée` : Envoi réussi
- `📨 [ZMQ-Client] Message reçu dans la boucle` : Réception réussie
- `🏓 [GATEWAY] Pong reçu du Translator` : Communication bidirectionnelle

### Logs du Translator
- `📥 [TRANSLATOR] Commande PULL reçue` : Réception de la requête
- `✅ [ML-ZMQ] 'text' → 'translation'` : Traduction ML réussie
- `📤 [TRANSLATOR] Résultat envoyé à la Gateway` : Envoi de la réponse

## Date de correction

**8 septembre 2025** - Communication ZMQ entièrement fonctionnelle en production

## Impact

- ✅ Traductions ML en temps réel
- ✅ Performance optimisée (confiance 0.95)
- ✅ Communication WebSocket → ZMQ → Translator
- ✅ Architecture microservices fonctionnelle
- ✅ Expérience utilisateur améliorée
