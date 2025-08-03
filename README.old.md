# Meeshy - High-Performance Multilingual Messaging Platform

Meeshy is a real-time messaging application with backend translation system designed for high throughput (10,000 messages/second) using advanced ML models.

## 📋 Architecture

### System Overview
```
Frontend (Next.js) 
    ↓ WebSocket/HTTP
Gateway Service (Fastify)
    ↓ gRPC/ZMQ/RabbitMQ + Protobuf
Translation Service (FastAPI + Transformers)
    ↓ Shared Database
PostgreSQL + Redis Cache
```

### Service Responsibilities

#### Gateway Service (Fastify)
- **Read**: Messages (display only)
- **CRUD**: Users, conversations, groups, preferences, presence
- **Real-time**: WebSocket connections, message routing
- **Communication**: gRPC client, ZMQ/RabbitMQ consumer/publisher

#### Translation Service (FastAPI)
- **CRUD**: Messages (create, update, delete, read)
- **Read**: Conversations, user preferences
- **Translation**: MT5/NLLB via Transformers library
- **Cache**: Robust Redis-based translation caching
- **Communication**: gRPC server, ZMQ/RabbitMQ consumer/publisher

### Communication Protocols
- **Synchronous**: gRPC with Protocol Buffers (real-time message flow)
- **Asynchronous**: ZMQ or RabbitMQ with Protocol Buffers (batch operations)
- **Serialization**: Protocol Buffers for all inter-service communication

## 🚀 Performance Targets

### Key Metrics
- **Throughput**: 10,000 messages/second sustained
- **Latency**: <50ms end-to-end message delivery
- **Translation**: <100ms per message
- **Cache Hit Rate**: >80% for translations
- **Uptime**: 99.9% service availability

### Infrastructure
- **Database**: PostgreSQL cluster (shared between services)
- **Cache**: Redis cluster for translation cache
- **Message Queue**: RabbitMQ or ZeroMQ for async operations
- **Monitoring**: Prometheus + Grafana
- **Load Balancing**: Nginx reverse proxy

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15 with TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **Real-time**: WebSocket client with reconnection logic
- **State Management**: React hooks with SWR for data fetching

### Backend Services
- **Gateway**: Fastify with TypeScript (high-performance Node.js)
- **Translation**: FastAPI with Python + Transformers
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis with intelligent TTL management
- **Authentication**: JWT with bcrypt hashing

## 🏗️ Project Structure

```
├── frontend/                     # Next.js application
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   ├── components/           # React components
│   │   ├── hooks/                # WebSocket & SWR hooks
│   │   └── types/                # TypeScript interfaces
│
├── backend/
│   ├── gateway-service/          # Fastify service
│   │   ├── src/
│   │   │   ├── routes/           # HTTP endpoints
│   │   │   ├── websocket/        # WebSocket handlers
│   │   │   ├── grpc/             # gRPC client
│   │   │   ├── queue/            # ZMQ/RabbitMQ client
│   │   │   └── database/         # DB connection
│   │
│   ├── translation-service/      # FastAPI service
│   │   ├── src/
│   │   │   ├── api/              # HTTP endpoints
│   │   │   ├── grpc/             # gRPC server
│   │   │   ├── queue/            # Message queue consumer
│   │   │   ├── models/           # ML model management
│   │   │   ├── cache/            # Translation cache
│   │   │   └── database/         # DB connection
│   │
│   └── shared/                   # Shared resources
│       ├── proto/                # Protocol Buffer definitions
│       ├── types/                # Shared TypeScript types
│       └── config/               # Environment configuration
│
├── docker/                       # Docker configurations
├── monitoring/                   # Prometheus & Grafana configs
└── scripts/                      # Deployment & management scripts
```

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- 8GB RAM minimum (for ML models)
- Python 3.9+ (for translation service)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd meeshy

# DÉVELOPPEMENT LOCAL UNIQUEMENT
# Démarrer avec Docker Compose (développement)
./docker-manage.sh dev:build
./docker-manage.sh dev:up -d

# PRODUCTION
# Utiliser les images Docker séparément
# Voir section "🔧 Configuration" pour les variables d'environnement
```

### Services Disponibles

#### Développement Local (Docker Compose)
- **Frontend**: http://localhost:3001 (Next.js dev server)
- **Backend API**: http://localhost:3002 (Fastify avec hot-reload)
- **Translation Service**: http://localhost:50052 (gRPC + FastAPI)
- **WebSocket**: ws://localhost:3002/ws
- **PostgreSQL**: localhost:5433
- **Redis**: localhost:6380
- **Health Checks**: http://localhost:3002/health

#### Production (Images Séparées)
- **Frontend**: Port configuré dans .env.frontend (défaut: 3000)
- **Backend API**: Port configuré dans .env.backend (défaut: 3001)
- **Translation Service**: Port configuré dans .env.translator (défaut: 50051)
- **Bases de données**: Selon votre infrastructure

## 🐳 Docker Deployment

### ⚠️ Important: Docker Compose Usage

**Docker Compose est utilisé UNIQUEMENT pour le développement local**. En production, chaque service est déployé séparément avec ses propres images Docker.

### Développement Local (Docker Compose)
```bash
# Démarrage rapide du stack de développement
./docker-manage.sh dev:build
./docker-manage.sh dev:up -d

# Ou manuellement
docker-compose -f docker-compose.dev.yml up -d
```

### Production (Images Séparées)
```bash
# Build des images de production
docker build -f Dockerfile.frontend -t meeshy/frontend:latest .
docker build -f backend/fastify-service/Dockerfile -t meeshy/backend:latest ./backend
docker build -f backend/translation-service/Dockerfile -t meeshy/translator:latest ./backend

# Déploiement séparé (Kubernetes, Docker Swarm, etc.)
docker run -d --name meeshy-frontend -p 3000:3000 meeshy/frontend:latest
docker run -d --name meeshy-backend -p 3001:3001 meeshy/backend:latest
docker run -d --name meeshy-translator -p 50051:50051 meeshy/translator:latest
```

### Ports et Services
| Service | Développement | Production | Description |
|---------|---------------|------------|-------------|
| Frontend | 3001:3000 | 3000:3000 | Next.js application |
| Backend | 3002:3001 | 3001:3001 | Fastify API gateway |
| Translation | 50052:50051 | 50051:50051 | gRPC translation service |
| PostgreSQL | 5433:5432 | 5432:5432 | Primary database |
| Redis | 6380:6379 | 6379:6379 | Cache & sessions |

For detailed Docker instructions, see [DOCKER_README.md](./DOCKER_README.md).

## 🔄 Translation Flow

### Real-time Message Flow (Synchronous)
```
1. User sends message → Gateway (WebSocket)
2. Gateway → Translator (gRPC + Protobuf): translation request
3. Translator: cache check → model inference → cache store
4. Translator → Gateway (gRPC + Protobuf): translated message
5. Gateway broadcasts to recipients (WebSocket)
```

### Translation Logic
```
Message Analysis:
├── Cache lookup: hash(text + source_lang + target_lang)
├── If cache hit: Return cached translation
└── If cache miss:
    ├── Short/simple (≤50 chars) → MT5 model
    ├── Long/complex → NLLB model
    └── Store result in cache with TTL
```

### Batch Operations (Asynchronous)
```
1. Gateway publishes to queue (ZMQ/RabbitMQ + Protobuf)
2. Translator consumes from queue
3. Batch processing with database operations
4. Results published back to Gateway queue
```

## 🔧 Configuration

### Variables d'Environnement

#### 🔧 Développement Local (Docker Compose)

**Variables automatiques** - Ces variables sont définies dans `docker-compose.dev.yml`:

```yaml
# Backend Fastify (Développement)
NODE_ENV: development
FASTIFY_PORT: 3001
FASTIFY_HOST: 0.0.0.0
DATABASE_URL: postgresql://meeshy_user:meeshy_password@postgres-dev:5432/meeshy_dev
JWT_SECRET: meeshy-jwt-secret-dev
GRPC_TRANSLATION_HOST: translation-service-dev
GRPC_TRANSLATION_PORT: 50051
REDIS_URL: redis://redis-dev:6379
LOG_LEVEL: debug

# Translation Service (Développement)
PYTHONPATH: /app
GRPC_PORT: 50051
GRPC_HOST: 0.0.0.0
DATABASE_URL: postgresql://meeshy_user:meeshy_password@postgres-dev:5432/meeshy_dev
REDIS_URL: redis://redis-dev:6379
BASIC_MODEL: t5-small
MEDIUM_MODEL: nllb-200-distilled-600M
PREMIUM_MODEL: nllb-200-distilled-1.3B
LOG_LEVEL: DEBUG

# Frontend (Développement)
NODE_ENV: development
NEXT_PUBLIC_API_URL: http://localhost:3002
NEXT_PUBLIC_WS_URL: ws://localhost:3002
NEXT_PUBLIC_BACKEND_URL: http://backend-dev:3001
```

#### 🚀 Production (Images Séparées)

**Fichiers .env requis** pour le déploiement en production:

**Backend Service** (`.env.backend`):
```env
NODE_ENV=production
FASTIFY_PORT=3001
FASTIFY_HOST=0.0.0.0
DATABASE_URL=postgresql://user:password@your-db-host:5432/meeshy
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_EXPIRES_IN=1h
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=60000
GRPC_TRANSLATION_HOST=your-translation-host
GRPC_TRANSLATION_PORT=50051
LOG_LEVEL=info
WS_MAX_CONNECTIONS=10000
WS_PING_INTERVAL=30000
CORS_ORIGINS=https://your-frontend-domain.com
REDIS_URL=redis://your-redis-host:6379
DB_POOL_SIZE=20
```

**Translation Service** (`.env.translator`):
```env
PYTHONPATH=/app
PYTHONUNBUFFERED=1
GRPC_PORT=50051
GRPC_HOST=0.0.0.0
DATABASE_URL=postgresql://user:password@your-db-host:5432/meeshy
REDIS_URL=redis://your-redis-host:6379
MODEL_CACHE_DIR=/app/models
SUPPORTED_LANGUAGES=fr,en,es,de,pt,zh,ja,ar
MAX_TEXT_LENGTH=5000
DEFAULT_LANGUAGE=fr
BASIC_MODEL=t5-small
MEDIUM_MODEL=nllb-200-distilled-600M
PREMIUM_MODEL=nllb-200-distilled-1.3B
DEVICE=cpu
LOG_LEVEL=INFO
CACHE_TTL=3600
WORKERS=4
GPU_MEMORY_FRACTION=0.8
```

**Frontend** (`.env.frontend`):
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com
NEXT_PUBLIC_BACKEND_URL=https://api.your-domain.com
NEXT_PUBLIC_TRANSLATION_URL=https://translate.your-domain.com
PORT=3000
```
CACHE_TTL=3600
WORKERS=4
GPU_MEMORY_FRACTION=0.8
```

#### 📊 Infrastructure (Production)

**Database** (PostgreSQL):
```env
POSTGRES_DB=meeshy
POSTGRES_USER=meeshy_production_user
POSTGRES_PASSWORD=your-secure-db-password
POSTGRES_HOST_AUTH_METHOD=md5
```

**Cache** (Redis):
```env
REDIS_PASSWORD=your-secure-redis-password
REDIS_MAXMEMORY=2gb
REDIS_MAXMEMORY_POLICY=allkeys-lru
```

### Commandes de Déploiement

#### Développement Local
```bash
# Démarrer le stack de développement
./docker-manage.sh dev:up -d

# Voir les logs de développement
./docker-manage.sh dev:logs -f

# Arrêter le développement
./docker-manage.sh dev:down
```

#### Production
```bash
# Build des images de production
docker build -f Dockerfile.frontend -t meeshy/frontend:v1.0.0 .
docker build -f backend/fastify-service/Dockerfile -t meeshy/backend:v1.0.0 ./backend
docker build -f backend/translation-service/Dockerfile -t meeshy/translator:v1.0.0 ./backend

# Déploiement avec variables d'environnement
docker run -d \
  --name meeshy-backend \
  --env-file .env.backend \
  -p 3001:3001 \
  meeshy/backend:v1.0.0

docker run -d \
  --name meeshy-translator \
  --env-file .env.translator \
  -p 50051:50051 \
  -v /path/to/models:/app/models \
  meeshy/translator:v1.0.0

docker run -d \
  --name meeshy-frontend \
  --env-file .env.frontend \
  -p 3000:3000 \
  meeshy/frontend:v1.0.0
```

## 🌐 Translation Features

### Supported Languages
- **Primary**: French, English, Spanish, German
- **Extended**: Portuguese, Chinese, Japanese, Arabic
- **Models**: MT5 (short messages), NLLB (complex messages)
- **Cache**: Intelligent Redis caching with 80%+ hit rate

### Performance Optimizations
- **Model Loading**: Lazy loading with memory optimization
- **Batch Processing**: Group translation requests
- **GPU Utilization**: CUDA acceleration when available
- **Connection Pooling**: Database and Redis connections
- **Async Processing**: Non-blocking I/O throughout

## 📈 Monitoring & Health Checks

### Health Endpoints
```bash
# Gateway Service Health
GET /health/gateway           # Basic health check
GET /health/detailed         # Complete service status
GET /health/ready           # Kubernetes readiness probe
GET /health/live            # Kubernetes liveness probe

# Translation Service Health  
GET /translate/health        # Translation service status
GET /translate/models        # Model loading status
GET /translate/cache/stats   # Cache performance metrics

# System Metrics
GET /metrics/performance     # Throughput, latency metrics
GET /metrics/queue          # Queue depth, processing rates
GET /metrics/database       # DB connection, query performance
```

### Grafana Dashboards
- **System Performance**: CPU, memory, network, disk I/O
- **Application Metrics**: Message throughput, translation speed
- **Service Health**: Uptime, error rates, response times
- **Business Intelligence**: User activity, language usage patterns

## 🛡️ Production Deployment

### Performance Tuning
```yaml
# docker-compose.prod.yml
services:
  gateway:
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
    environment:
      - NODE_ENV=production
      - WS_MAX_CONNECTIONS=10000
      
  translator:
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 8G
          cpus: '2.0'
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

### Load Testing
```bash
# Test message throughput
./scripts/load-test.sh --messages 10000 --concurrent 100

# Test translation performance  
./scripts/translation-benchmark.sh --batch-size 32

# WebSocket stress test
./scripts/websocket-stress.sh --connections 1000
```

## 🔍 Development

### Local Development Setup
```bash
# Install dependencies
npm install          # Frontend
cd backend/fastify-service && npm install
cd ../translation-service && pip install -r requirements.txt

# DÉVELOPPEMENT AVEC DOCKER COMPOSE (Recommandé)
./docker-manage.sh dev:build
./docker-manage.sh dev:up -d

# OU DÉVELOPPEMENT NATIF (Sans Docker)
npm run dev          # Frontend development server
cd backend/fastify-service && npm run dev    # Gateway with hot-reload
cd backend/translation-service && python translation_server.py  # Translation service

# Protocol Buffer compilation
./scripts/compile-proto.sh
```

### Debugging

#### Docker Compose (Développement)
```bash
# View service logs
./docker-manage.sh dev:logs backend-dev
./docker-manage.sh dev:logs translation-service-dev

# Monitor containers
docker-compose -f docker-compose.dev.yml ps

# Check Redis cache
docker exec -it meeshy-redis-dev redis-cli monitor
```

#### Production (Images Séparées)
```bash
# View service logs
docker logs meeshy-backend
docker logs meeshy-translator
docker logs meeshy-frontend

# Health checks
curl http://your-backend-host:3001/health
curl http://your-translation-host:50051/health
```

## 🚀 Deployment Scripts

### Production Deployment
```bash
# Deploy all services
./scripts/deploy-prod.sh

# Scale services
./scripts/scale-services.sh --gateway 5 --translator 3

# Database migration
./scripts/migrate-db.sh

# Health check
./scripts/health-check.sh
```

### Backup & Recovery
```bash
# Backup database
./scripts/backup-db.sh

# Backup Redis cache
./scripts/backup-cache.sh

# Restore from backup
./scripts/restore-backup.sh --date 2024-01-15
```

## 🔄 API Documentation

### Gateway REST API
- **Authentication**: `POST /auth/login`, `POST /auth/refresh`
- **Users**: `GET /users`, `POST /users`, `PUT /users/:id`
- **Conversations**: `GET /conversations`, `POST /conversations`
- **Messages**: `GET /conversations/:id/messages`

### Translation gRPC API
```protobuf
service TranslationService {
  rpc TranslateMessage(TranslationRequest) returns (TranslationResponse);
  rpc BatchTranslate(BatchTranslationRequest) returns (BatchTranslationResponse);
  rpc GetCacheStats(Empty) returns (CacheStatsResponse);
}
```

### WebSocket Events
- **Connection**: `connection`, `disconnect`
- **Messages**: `message:send`, `message:receive`, `message:typing`
- **Presence**: `user:online`, `user:offline`

## 📊 Performance Benchmarks

### Expected Performance
- **Message Processing**: 10,000+ messages/second
- **Translation Speed**: 50-100ms average
- **WebSocket Connections**: 10,000+ concurrent
- **Database Queries**: <10ms average response time
- **Cache Hit Rate**: 80-90% for translations

### Scalability Targets
- **Horizontal Scaling**: Add gateway/translator instances
- **Database Sharding**: Support for multiple database clusters  
- **Geographic Distribution**: Multi-region deployment support
- **Auto-scaling**: Based on CPU, memory, and queue depth

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/new-feature`)
3. Follow performance guidelines (10k msg/sec target)
4. Ensure type safety across services
5. Add tests for new functionality
6. Submit pull request with performance benchmarks

## 📝 License

This project is licensed under the MIT License. See `LICENSE` file for details.

## 📞 Support

- **Issues**: Create GitHub issue with performance impact assessment
- **Documentation**: Check `/docs` folder for detailed guides
- **Performance**: Include benchmark results with bug reports
- **Architecture**: Contact development team for system design questions

---

**Built for Scale**: Designed to handle 100,000+ messages/second with real-time translation and sub-50ms latency.