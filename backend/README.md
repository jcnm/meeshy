# Meeshy Backend Refactorisé 🚀

Architecture moderne avec **Fastify** et **FastAPI** communicant via **gRPC**.

## 🏗 Architecture

```
┌─────────────────┐    gRPC     ┌──────────────────┐
│   Fastify       │◄─────────────┤   FastAPI        │
│   (WebSocket)   │   protobuf   │   (Translation)  │
│   - Auth        │              │   - Messages     │
│   - Users       │              │   - Translation  │
│   - Conversations│              │   - MT5/NLLB     │
│   - Groups      │              │                  │
└─────────────────┘              └──────────────────┘
         │                                  │
         └────────────────┬─────────────────┘
                          │
                 ┌─────────────────┐
                 │   SQLite DB     │
                 │   (Prisma ORM)  │
                 └─────────────────┘
```

## 📁 Structure des Dossiers

```
backend-refactored/
├── shared/                     # Ressources partagées
│   ├── prisma/
│   │   └── schema.prisma      # Schéma unique pour les deux services
│   ├── proto/
│   │   └── messaging.proto    # Définition gRPC
│   └── .env                   # Configuration partagée
│
├── fastify-service/           # Service principal (TypeScript)
│   ├── src/
│   │   ├── server.ts         # Point d'entrée Fastify
│   │   ├── routes/           # Routes REST API
│   │   ├── websocket/        # Gestionnaire WebSocket
│   │   └── grpc/            # Client gRPC
│   └── package.json
│
├── translation-service/       # Service de traduction (Python)
│   ├── src/
│   │   ├── grpc/            # Serveur gRPC
│   │   └── translation/     # Logique de traduction
│   ├── main.py              # Point d'entrée FastAPI + gRPC
│   └── requirements.txt
│
└── start.sh                  # Script de démarrage
```

## 🔧 Fonctionnalités

### Service Fastify (Port 3001)
- ✅ **WebSocket** en temps réel
- ✅ **Authentification JWT** sécurisée
- ✅ **CRUD complet** pour utilisateurs, conversations, groupes
- ✅ **Lecture seule** des messages (via gRPC)
- ✅ **Rate limiting** et sécurité
- ✅ **Client gRPC** intégré

### Service FastAPI (Port 8000)
- ✅ **Serveur gRPC** (Port 50051)
- ✅ **CRUD complet** des messages
- ✅ **Traduction intelligente** (MT5 + NLLB)
- ✅ **Cache de traduction** optimisé
- ✅ **Lecture seule** des autres données
- ✅ **API REST** pour tests et monitoring

## 🚀 Démarrage Rapide

### Prérequis
- **Node.js** 18+
- **Python** 3.8+
- **npm** ou **yarn**

### Installation et démarrage
```bash
# Cloner et naviguer
cd backend-refactored

# Démarrage automatique (développement)
./start.sh dev

# Ou démarrage manuel
./start.sh setup  # Configuration initiale
./start.sh dev     # Démarrage des services
```

### Vérification
```bash
# Santé des services
./start.sh health

# URLs d'accès
curl http://localhost:3001/health  # Fastify
curl http://localhost:8000/health  # FastAPI
```

## 🌐 Endpoints

### Fastify Service (3001)
```
# Authentification
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
GET  /api/auth/verify

# Utilisateurs
GET    /api/users
GET    /api/users/:id
PUT    /api/users/:id
DELETE /api/users/:id

# Conversations
GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/:id
PUT    /api/conversations/:id
DELETE /api/conversations/:id

# WebSocket
WS /ws?token=JWT_TOKEN
```

### FastAPI Service (8000)
```
# Santé et monitoring
GET /health
GET /models/status
GET /cache/stats

# Test de traduction directe
POST /translate
```

## 🔌 Communication gRPC

### Services disponibles
- `CreateMessage` - Créer un message avec traduction
- `GetMessage` - Récupérer un message
- `UpdateMessage` - Modifier un message
- `DeleteMessage` - Supprimer un message
- `TranslateMessage` - Traduire un message existant
- `GetConversationMessages` - Messages d'une conversation
- `MarkMessageAsRead` - Marquer comme lu

### Exemple TypeScript (Fastify)
```typescript
// Envoi d'un message via gRPC
const response = await grpcClient.createMessage({
  conversationId: "conv-123",
  senderId: "user-456",
  content: "Hello world!",
  originalLanguage: "en"
});
```

## 🔒 Permissions et Sécurité

### Fastify Service
- ✅ **CRUD complet** : users, conversations, groups, friendRequests, etc.
- ❌ **Lecture seule** : messages (via gRPC uniquement)
- ✅ **JWT Authentication** avec bcrypt
- ✅ **Rate limiting** et CORS

### FastAPI Service  
- ✅ **CRUD complet** : messages, messageTranslations, messageReadStatus
- ❌ **Lecture seule** : users, conversations, groups (pour permissions)
- ✅ **Validation des permissions** via Prisma
- ✅ **Cache intelligent** de traduction

## 🧠 Intelligence de Traduction

### Sélection automatique de modèle
- **MT5** : Messages courts (≤50 caractères) et simples
- **NLLB** : Messages longs et complexes

### Cache optimisé
- **Clé unique** : hash(content + source_lang + target_lang)
- **Persistance DB** : Traductions sauvées en base
- **Stats temps réel** : Hit rate, performance

### Langues supportées
`fr`, `en`, `es`, `de`, `it`, `pt`, `ru`, `zh`, `ja`, `ar`

## 📊 Monitoring

### Santé des services
```bash
# Vérification complète
curl http://localhost:3001/health
curl http://localhost:8000/health

# Statut des modèles
curl http://localhost:8000/models/status

# Stats du cache
curl http://localhost:8000/cache/stats
```

### Logs structurés
- **Fastify** : winston avec rotation
- **FastAPI** : logging Python standard
- **gRPC** : logs d'erreurs et performance

## 🔧 Configuration

### Variables d'environnement (.env)
```env
# Base de données
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="1h"

# gRPC
GRPC_HOST="localhost"
GRPC_PORT="50051"

# Services
FASTIFY_PORT="3001"
FASTAPI_PORT="8000"

# Traduction
MODELS_PATH="../models"
CACHE_TTL="3600"
```

## 🚀 Déploiement

### Docker (à venir)
```dockerfile
# Multi-stage build
# Stage 1: Fastify
# Stage 2: FastAPI
# Stage 3: Production
```

### Production
```bash
# Mode production
./start.sh prod

# Avec PM2 (recommandé)
pm2 start ecosystem.config.js
```

## 🧪 Tests

### Tests unitaires
```bash
# Fastify
cd fastify-service && npm test

# FastAPI
cd translation-service && python -m pytest
```

### Tests d'intégration
```bash
# Test gRPC
./scripts/test-grpc.sh

# Test WebSocket
./scripts/test-websocket.sh
```

## 📈 Performance

### Optimisations
- **gRPC** : Communication binaire haute performance
- **Cache intelligent** : Réduction des traductions redondantes
- **Prisma** : Requêtes optimisées avec relations
- **Lazy loading** : Modèles chargés à la demande

### Métriques attendues
- **Latence gRPC** : <50ms
- **Cache hit rate** : >80%
- **Memory usage** : <2GB par service
- **Concurrent users** : 1000+ WebSocket

## 🔄 Migration depuis NestJS

### Correspondances
- **NestJS Guards** → **Fastify hooks**
- **NestJS Services** → **Fastify decorators**
- **NestJS WebSocket** → **@fastify/websocket**
- **Python translator** → **Refactorisé avec gRPC**

### Avantages de la refactorisation
1. **Performance** : Fastify 2x plus rapide que NestJS
2. **Simplicité** : Moins de boilerplate
3. **Séparation** : Services découplés via gRPC
4. **Scalabilité** : Services indépendants
5. **Maintenabilité** : Code plus clair et modulaire

---

**🎉 Meeshy Backend Refactorisé - Prêt pour la production !**
