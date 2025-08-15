# Mise à jour des variables d'environnement de la Gateway

## 🔄 **Changements majeurs**

### 1. **Configuration ZMQ avec deux ports distincts**

**Avant :**
```bash
ZMQ_TRANSLATOR_PUB_PORT=5555
ZMQ_TRANSLATOR_SUB_PORT=5558
```

**Après :**
```bash
ZMQ_TRANSLATOR_PUSH_PORT=5555    # Port où Gateway PUSH connect (Translator PULL bind)
ZMQ_TRANSLATOR_SUB_PORT=5558     # Port où Gateway SUB connect (Translator PUB bind)
ZMQ_TRANSLATOR_PORT=5555         # Port legacy pour compatibilité
```

**Explication :** La Gateway utilise maintenant une architecture ZMQ PUSH/SUB avec deux ports distincts :
- **ZMQ_TRANSLATOR_PUSH_PORT (5555)** : La Gateway se connecte en mode PUSH pour envoyer les commandes de traduction au Translator
- **ZMQ_TRANSLATOR_SUB_PORT (5558)** : La Gateway se connecte en mode SUB pour recevoir les résultats de traduction du Translator
- **ZMQ_TRANSLATOR_PORT (5555)** : Port legacy maintenu pour compatibilité avec l'ancien code

### 2. **Nouvelles variables d'environnement ajoutées**

#### **Configuration générale :**
- `DEBUG` : Mode debug (false/true)
- `GATEWAY_PORT` : Port alternatif pour la Gateway (compatibilité)

#### **Configuration de sécurité :**
- `BCRYPT_ROUNDS` : Nombre de rounds pour le hachage bcrypt (12)

#### **Configuration CORS :**
- `ALLOWED_ORIGINS` : Origines CORS alternatives (compatibilité)

#### **Configuration frontend :**
- `FRONTEND_URL` : URL du frontend pour les liens d'invitation

#### **Configuration ZMQ :**
- `ZMQ_TRANSLATOR_HOST` : Host du service Translator
- `ZMQ_TIMEOUT` : Timeout pour les connexions ZMQ (30000ms)

### 3. **Variables mises à jour**

#### **Configuration ZMQ :**
- `ZMQ_TRANSLATOR_PUB_PORT` → `ZMQ_TRANSLATOR_PUSH_PORT` : Renommage pour clarifier l'usage
- Ajout de `ZMQ_TRANSLATOR_PORT` pour compatibilité legacy

## 📋 **Liste complète des variables d'environnement**

### **Configuration générale :**
```bash
NODE_ENV=production
DEBUG=false
LOG_LEVEL=info
```

### **Configuration des ports :**
```bash
FASTIFY_PORT=3000
FASTIFY_HOST=0.0.0.0
GATEWAY_PORT=3000
```

### **Configuration base de données :**
```bash
DATABASE_URL=file:../shared/dev.db
```

### **Configuration Redis :**
```bash
REDIS_URL=redis://localhost:6379
```

### **Configuration JWT et sécurité :**
```bash
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12
```

### **Configuration WebSocket :**
```bash
WS_MAX_CONNECTIONS=100000
WS_PING_INTERVAL=30000
```

### **Configuration Rate Limiting :**
```bash
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=60000
```

### **Configuration CORS :**
```bash
CORS_ORIGINS=http://localhost:3100,http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3100,http://localhost:3000
```

### **Configuration frontend :**
```bash
FRONTEND_URL=http://localhost:3100
```

### **Configuration Translator (gRPC) :**
```bash
GRPC_TRANSLATION_HOST=translator
GRPC_TRANSLATION_PORT=50051
TRANSLATOR_GRPC_URL=translator:50051
```

### **Configuration Translator (ZMQ) :**
```bash
ZMQ_TRANSLATOR_HOST=translator
ZMQ_TRANSLATOR_PUSH_PORT=5555
ZMQ_TRANSLATOR_SUB_PORT=5558
ZMQ_TRANSLATOR_PORT=5555
ZMQ_TIMEOUT=30000
```

## 🚀 **Migration**

### **Étapes de migration :**

1. **Mettre à jour le fichier .env :**
   ```bash
   # Remplacer
   ZMQ_TRANSLATOR_PUB_PORT=5555
   
   # Par
   ZMQ_TRANSLATOR_PUSH_PORT=5555
   ZMQ_TRANSLATOR_SUB_PORT=5558
   ZMQ_TRANSLATOR_PORT=5555
   ```

2. **Ajouter les nouvelles variables :**
   ```bash
   DEBUG=false
   GATEWAY_PORT=3000
   ALLOWED_ORIGINS=http://localhost:3100,http://localhost:3000
   FRONTEND_URL=http://localhost:3100
   BCRYPT_ROUNDS=12
   ZMQ_TRANSLATOR_HOST=translator
   ZMQ_TIMEOUT=30000
   ```

3. **Vérifier la compatibilité :**
   ```bash
   # Les anciennes variables sont toujours supportées pour compatibilité
   ZMQ_TRANSLATOR_PORT=5555  # Legacy
   ```

### **Fichiers mis à jour :**

- `gateway/Dockerfile` : Ajout de toutes les nouvelles variables d'environnement
- `build-docker-images.sh` : Mise à jour des build-args pour Docker
- `gateway/env.example` : Documentation complète des variables
- `gateway/VARIABLES_ENV_UPDATE.md` : Ce fichier de documentation

## ⚠️ **Points d'attention**

1. **Ports ZMQ** : Assurez-vous que les ports 5555 et 5558 sont disponibles
2. **Compatibilité** : Les anciennes configurations avec `ZMQ_TRANSLATOR_PUB_PORT` sont remplacées par `ZMQ_TRANSLATOR_PUSH_PORT`
3. **Sécurité** : La variable `BCRYPT_ROUNDS` affecte la sécurité du hachage des mots de passe
4. **CORS** : Les variables `CORS_ORIGINS` et `ALLOWED_ORIGINS` sont toutes les deux supportées

## 🔧 **Test de la configuration**

Après la mise à jour, testez la configuration avec :

```bash
# Vérifier que la Gateway démarre correctement
cd gateway
npm run dev

# Vérifier les logs pour s'assurer que les connexions ZMQ sont bien configurées
# Vous devriez voir :
# 🔌 Socket PUSH connecté: translator:5555 (envoi commandes)
# 🔌 Socket SUB connecté: translator:5558 (réception résultats)
```

## 🔗 **Compatibilité avec le Translator**

La Gateway est maintenant configurée pour communiquer avec le Translator via :

1. **gRPC** : Port 50051 pour les appels API directs
2. **ZMQ PUSH** : Port 5555 pour envoyer les commandes de traduction
3. **ZMQ SUB** : Port 5558 pour recevoir les résultats de traduction

Cette configuration est compatible avec les mises à jour du Translator qui utilise maintenant deux ports ZMQ distincts.
