# Guide de Dépannage - Connexion WebSocket

## Problème : "Mode démo persistant" 

### Vérifications à effectuer

1. **Serveur Gateway démarré ?**
   ```bash
   curl http://localhost:3000/health
   ```
   - ✅ Réponse : Le serveur fonctionne
   - ❌ Erreur : Démarrer le gateway

2. **WebSocket accessible ?**
   ```bash
   # Si wscat est installé
   wscat -c ws://localhost:3000/ws
   
   # Sinon tester dans la console du navigateur
   new WebSocket('ws://localhost:3000/ws')
   ```

3. **Variables d'environnement correctes ?**
   - Vérifier `frontend/.env` :
     ```
     NEXT_PUBLIC_WS_URL=ws://localhost:3000
     ```

4. **Token d'authentification valide ?**
   - Ouvrir DevTools → Application → Local Storage
   - Vérifier la présence de `auth_token`

## Solutions

### 1. Démarrer les services

**Option A : Avec Docker**
```bash
docker-compose up
```

**Option B : Mode développement**
```bash
./scripts/start-dev.sh
```

### 2. Réinitialiser la connexion

1. Cliquer sur "Debug" dans l'interface
2. Vérifier les diagnostics dans la console
3. Cliquer sur "Reconnecter"

### 3. Vérifier les logs

**Frontend :**
- Console du navigateur (F12)
- Chercher les messages `NativeWebSocketService`

**Gateway :**
- Logs du conteneur Docker
- Fichier `logs/gateway.log` en mode dev

### 4. Problèmes courants

**"Token non trouvé"**
- Se reconnecter à l'application
- Vérifier l'expiration du token

**"Connexion refusée"**
- Vérifier que le port 3000 n'est pas occupé
- Redémarrer le gateway

**"WebSocket fermé immédiatement"**
- Vérifier l'authentification
- Regarder les logs du serveur

## Tests manuels

### Test 1 : Connexion WebSocket
```javascript
// Dans la console du navigateur
const ws = new WebSocket('ws://localhost:3000/ws?token=' + localStorage.getItem('auth_token'));
ws.onopen = () => console.log('✅ Connexion WebSocket OK');
ws.onerror = (e) => console.error('❌ Erreur WebSocket:', e);
```

### Test 2 : Service de messaging
```javascript
// Dans la console du navigateur
window.nativeWebSocketService?.getConnectionDiagnostics()
```

### Test 3 : Envoi de message
```javascript
// Dans la console du navigateur avec connexion active
ws.send(JSON.stringify({
  type: 'new_message',
  conversationId: 'global_stream',
  data: { content: 'Test message', senderId: 'test' }
}));
```

## Contacts

Si le problème persiste :
1. Capturer les logs du navigateur et du serveur
2. Noter les messages d'erreur exacts
3. Vérifier la configuration réseau/firewall
