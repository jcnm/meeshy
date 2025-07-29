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

# Start all services
./start-backend.sh

# Or manually with Docker Compose
docker-compose up -d
```

### Services Available
- **Frontend**: http://localhost:3000
- **Gateway API**: http://localhost:3001
- **Translation Service**: http://localhost:8000
- **WebSocket**: ws://localhost:3001/ws
- **Health Checks**: http://localhost:3001/health
- **Grafana**: http://localhost:3003 (admin/admin)
- **Prometheus**: http://localhost:9090

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

### Environment Variables

**Gateway Service** (`.env.gateway`):
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:password@postgres:5432/meeshy
REDIS_URL=redis://redis:6379
JWT_SECRET=your-production-secret
GRPC_TRANSLATION_HOST=translation-service
GRPC_TRANSLATION_PORT=50051
WS_MAX_CONNECTIONS=10000
DB_POOL_SIZE=20
```

**Translation Service** (`.env.translator`):
```env
FASTAPI_PORT=8000
DATABASE_URL=postgresql://user:password@postgres:5432/meeshy
REDIS_URL=redis://redis:6379
GRPC_PORT=50051
ML_BATCH_SIZE=32
CACHE_TTL=3600
WORKERS=4
GPU_MEMORY_FRACTION=0.8
```

**Message Queue** (`.env.queue`):
```env
RABBITMQ_URL=amqp://user:password@rabbitmq:5672
# OR for ZeroMQ
ZMQ_GATEWAY_PORT=5555
ZMQ_TRANSLATOR_PORT=5556
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
cd backend/gateway-service && npm install
cd ../translation-service && pip install -r requirements.txt

# Start services individually
npm run dev:frontend        # Frontend development server
npm run dev:gateway         # Gateway with hot-reload
python -m uvicorn main:app --reload  # Translation service

# Protocol Buffer compilation
./scripts/compile-proto.sh
```

### Debugging
```bash
# View service logs
docker-compose logs gateway-service
docker-compose logs translation-service

# Monitor message queue
docker exec -it rabbitmq rabbitmqctl list_queues

# Check Redis cache
docker exec -it redis redis-cli monitor
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