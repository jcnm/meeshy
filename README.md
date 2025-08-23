# Meeshy 🚀

**High-performance real-time multilingual messaging platform**

*Meet without shyness! Connect the world, one translation at a time.*

Meeshy is a modern, high-performance messaging application designed to handle thousands of messages per second with automatic real-time translation to multiple languages simultaneously. Built with enterprise-grade architecture and optimized for scalability.

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![Performance](https://img.shields.io/badge/Performance-100k_msg/sec-green)
![Languages](https://img.shields.io/badge/Languages-8_supported-orange)
![License](https://img.shields.io/badge/License-MIT-brightgreen)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ed)
![Version](https://img.shields.io/badge/Version-0.5.0--alpha-blue)

## ✨ Why Meeshy?

Breaking language barriers in real-time communication! Meeshy empowers global teams, communities, and friends to chat naturally in their preferred languages while everyone receives messages in their own language instantly.

**🌟 Key Highlights:**
- **Zero Language Barriers**: Automatic translation to 8 major languages
- **High Performance**: Optimized Docker deployment with unified and microservices options
- **Real-time Communication**: WebSocket-based messaging with instant translation
- **Developer Friendly**: Full Docker setup, modern tech stack, automated testing
- **Open Source**: MIT licensed with professional documentation and community setup

## 🎯 Core Features

### 🔐 Robust Authentication & User Management
- **Centralized authentication** with JWT tokens
- **Anonymous sessions** for shared conversations
- **Role-based access control** (USER, ADMIN, MODO, AUDIT, ANALYST, BIGBOSS)
- **Automatic route protection** with configurable guards
- **Secure data cleanup** on logout

### 💬 Real-Time Messaging
- **High-performance WebSocket** with Socket.IO and Fastify
- **Optimized connection handling** with efficient architecture
- **Live typing indicators** and message status
- **Group conversations** with role management
- **Message persistence** with PostgreSQL

### 🌐 Advanced Multilingual Translation
- **Instant translation** to 8 languages (FR, EN, ES, DE, PT, ZH, JA, AR)
- **Advanced ML models**: T5-small (basic), NLLB-200-distilled-600M (medium), NLLB-200-distilled-1.3B (premium)
- **Quantized models** for optimal performance (float16, float32)
- **Intelligent caching** with Redis + persistent database
- **Automatic language detection** for source messages
- **High-performance workers** (50+ concurrent translations)

### 🏗️ Enterprise Architecture
- **Frontend**: Next.js 15 + React 19 + TypeScript 5.8 + Tailwind CSS 3.4
- **Gateway**: Fastify 5.1 + WebSocket + gRPC + ZeroMQ
- **Translator**: FastAPI + PyTorch 2.0+ + Transformers 4.35+
- **Database**: PostgreSQL 15 + Prisma 6.13 ORM
- **Cache**: Redis 7 for optimal performance
- **Communication**: gRPC + Protocol Buffers + ZeroMQ

### 🚀 Performance & Scalability
- **Asynchronous processing** with worker pools
- **Optimized database** with intelligent indexing and Prisma
- **High-performance caching** with Redis
- **Docker deployment** with unified and microservices options
- **Multi-platform builds** (linux/amd64, linux/arm64)
- **Automated testing** and build pipeline

## 🏛️ System Architecture

### Microservices Architecture
```
┌─────────────────┐    WebSocket/HTTP   ┌──────────────────┐
│   Frontend      │◄───────────────────►│    Gateway       │
│   (Next.js 15)  │   Socket.IO + JWT   │   (Fastify 5.1)  │
│   React 19      │   Authentication    │   WebSocket      │
└─────────────────┘                     └──────────────────┘
                                                  │
                                         gRPC + ZeroMQ + Protobuf
                                                  ▼
┌─────────────────┐                     ┌──────────────────┐
│   PostgreSQL    │◄────────────────────┤   Translator     │
│   + Prisma      │    Shared Database  │   (FastAPI)      │
│   + Redis       │    + Cache          │   PyTorch 2.0+   │
└─────────────────┘                     └──────────────────┘
```

### Unified Architecture (Nginx Reverse Proxy)
```
┌─────────────────────────────────────────────────────────────┐
│                    Nginx Reverse Proxy                      │
│                    (Port 80 - Public)                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼──────┐ ┌────▼────┐ ┌──────▼──────┐
│   Frontend   │ │ Gateway │ │ Translator  │
│   (Port 3100)│ │(Port 3000)│ │ (Port 8000) │
│   (Internal) │ │(Internal)│ │ (Internal)  │
└──────────────┘ └─────────┘ └─────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
              ┌───────▼──────┐
              │  PostgreSQL  │
              │  + Redis     │
              │  (Internal)  │
              └──────────────┘
```

**Avantages de l'architecture unifiée :**
- **Port unique** : Seul le port 80 est exposé publiquement
- **Sécurité renforcée** : Services internes non accessibles directement
- **Load balancing** : Nginx gère la distribution des requêtes
- **SSL/TLS centralisé** : Configuration SSL unique sur Nginx
- **Simplification** : Un seul container pour tous les services

### Service Responsibilities

#### 🎨 Frontend (Next.js 15 + React 19)
- **Modern UI** with Radix UI components and Tailwind CSS
- **Real-time messaging** with Socket.IO client
- **Type-safe development** with TypeScript 5.8
- **Responsive design** with Framer Motion animations
- **Theme support** with next-themes
- **Form handling** with React Hook Form

#### ⚡ Gateway (Fastify 5.1)
- **Full CRUD operations**: Users, conversations, groups, preferences
- **WebSocket management** with Socket.IO
- **JWT authentication** and role-based access control
- **gRPC communication** with Translator service
- **ZeroMQ messaging** for high-performance translation requests
- **Rate limiting** and security with Helmet
- **CORS configuration** for cross-origin requests

#### 🤖 Translator (FastAPI + PyTorch)
- **ML-powered translation** with Transformers 4.35+
- **Quantized models** for optimal performance
- **Worker pool architecture** (50+ concurrent workers)
- **gRPC server** for high-performance communication
- **ZeroMQ PUB/SUB** for real-time message processing
- **Model quantization** (float16, float32) for memory optimization
- **Automatic language detection** with langdetect

#### 🗄️ Database & Cache
- **PostgreSQL 15** with optimized schema
- **Prisma 6.13** ORM with type-safe queries
- **Redis 7** for high-performance caching
- **Connection pooling** for optimal performance
- **Automatic migrations** and schema management

## 🌐 Multilingual Translation Flow

### User Language Configuration
```typescript
interface UserLanguageConfig {
  systemLanguage: string;              // Default: "fr"
  regionalLanguage: string;            // Default: "fr"
  customDestinationLanguage?: string;  // Optional
  autoTranslateEnabled: boolean;       // Default: true
  translateToSystemLanguage: boolean;  // Default: true
  translateToRegionalLanguage: boolean; // Default: false
  useCustomDestination: boolean;       // Default: false
}
```

### High-Performance Translation Flow
```
1. User A sends "Hello" (English) → Gateway (WebSocket)
2. Gateway determines required languages for participants
3. Gateway → Translator (gRPC + ZeroMQ): Request translation to all languages
4. Translator processes with worker pool:
   • Checks cache (Redis + MessageTranslation)
   • Translates missing languages with quantized ML models
   • Stores translations with optimized cache keys
   • Processes 50+ concurrent translations
5. Translator → Gateway: All translations via gRPC
6. Gateway broadcasts via WebSocket based on preferences:
   • User B (systemLanguage: "fr") → receives "Bonjour"
   • User C (regionalLanguage: "es") → receives "Hola"
   • User D (systemLanguage: "en") → receives "Hello"
```

## 📸 Screenshots

### 🔐 Authentication & User Management
![Login Modal](assets/login_modal.png)
*Modal de connexion avec gestion des sessions utilisateur*

![Authentication Loading](assets/auth_loading.png)
*Écran de chargement pendant l'authentification*

![Shared Conversation](assets/shared_conversation.png)
*Conversation partagée avec traduction multilingue*

### 🎛️ User Interface & Dashboard
![User Dashboard](assets/user_dashboard.png)
*Tableau de bord utilisateur avec navigation intuitive*

### ⚠️ Error Handling
![Session Token Error](assets/session_token_error.png)
*Gestion d'erreur pour les tokens de session expirés*
---

## 🚀 Quick Start

### Prerequisites
- Node.js 22+ and pnpm
- Python 3.12+ 
- Docker and Docker Compose
- PostgreSQL 15+ and Redis 7

### Option 1: Docker Compose (Microservices)
```bash
# Clone the project
git clone https://github.com/jcnm/meeshy.git
cd meeshy

# Run with Docker Compose
docker-compose up -d
```

### Option 2: Docker Compose Unified (All-in-One)
```bash
# Clone the project
git clone https://github.com/jcnm/meeshy.git
cd meeshy

# Run with unified container (Nginx reverse proxy)
docker-compose -f docker-compose.unified.yml up -d
```

**Note**: L'architecture unifiée utilise Nginx comme reverse proxy. Seul le port 80 est exposé publiquement. Les services internes (Frontend:3100, Gateway:3000, Translator:8000) ne sont accessibles que via Nginx.

### Option 3: Automated Pipeline
```bash
# Clone the project
git clone https://github.com/jcnm/meeshy.git
cd meeshy

# Run complete pipeline with tests and build
./scripts/build-and-test-applications.sh
```

🌐 **Access the application**: 
- **Microservices**: http://localhost:3100 (Frontend), http://localhost:3000 (Gateway)
- **Unified**: http://localhost (Nginx reverse proxy - Frontend + API unifiés)

## 📊 Supported Languages & Performance

| Language | Code | Model | Performance | Quality |
|----------|------|-------|-------------|---------|
| French | `fr` | NLLB-200 | Native | Excellent |
| English | `en` | NLLB-200 | Native | Excellent |
| Spanish | `es` | NLLB-200 | Excellent | Excellent |
| German | `de` | NLLB-200 | Very Good | Very Good |
| Portuguese | `pt` | NLLB-200 | Very Good | Very Good |
| Chinese | `zh` | NLLB-200 | Good | Good |
| Japanese | `ja` | NLLB-200 | Good | Good |
| Arabic | `ar` | NLLB-200 | Good | Good |

### Performance Metrics
- **Translation throughput**: Optimized for concurrent translations
- **Translation latency**: <100ms end-to-end target
- **Cache hit ratio**: Intelligent caching system
- **Database queries**: Optimized with Prisma ORM
- **WebSocket connections**: High-performance messaging
- **Memory usage**: Optimized with quantized models

## 🛠️ Development

### Project Structure
```
meeshy/
├── frontend/          # Next.js 15 + React 19 + TypeScript
├── gateway/           # Fastify 5.1 + WebSocket + gRPC
├── translator/        # FastAPI + PyTorch + Transformers
├── shared/            # Prisma Schema + Proto files
├── docker/            # Nginx Configuration
├── scripts/           # Automated CI/CD pipeline
├── docker-compose.yml # Microservices setup
└── docker-compose.unified.yml # All-in-one setup
```

### Available Scripts
```bash
# Automated pipeline
./scripts/build-and-test-applications.sh

# Individual components
./scripts/tests/run-unit-tests.sh
./scripts/tests/run-integration-tests.sh
./scripts/deployment/build-and-push-docker-images.sh

# Version management
./scripts/utils/version-manager.sh auto-increment patch

# Docker management
docker-compose up -d          # Start microservices
docker-compose -f docker-compose.unified.yml up -d  # Start unified
```

## 🔧 Configuration

### Environment Variables

Meeshy uses comprehensive environment variable configuration for all services. Copy `env.example` to `.env` and configure your values.

| Variable Name | Used By | Default Value | Description |
|---------------|---------|---------------|-------------|
| **NODE_ENV** | All Services | `development` | Node.js environment (`development`, `production`, `test`) |
| **DEBUG** | All Services | `false` | Enable debug logging (`true`, `false`) |
| **LOG_LEVEL** | All Services | `info` | Logging level (`debug`, `info`, `warn`, `error`) |
| **DATABASE_URL** | Gateway, Translator | `postgresql://meeshy:MeeshyP@ssword@localhost:5432/meeshy` | PostgreSQL connection string |
| **POSTGRES_DB** | PostgreSQL | `meeshy` | Database name |
| **POSTGRES_USER** | PostgreSQL | `meeshy` | Database user |
| **POSTGRES_PASSWORD** | PostgreSQL | `MeeshyP@ssword` | Database password |
| **POSTGRES_PORT** | PostgreSQL | `5432` | Database port |
| **REDIS_URL** | Gateway, Translator | `redis://localhost:6379` | Redis connection string |
| **REDIS_PORT** | Redis | `6379` | Redis port |
| **TRANSLATION_CACHE_TTL** | Translator | `3600` | Translation cache TTL in seconds |
| **CACHE_MAX_ENTRIES** | Translator | `10000` | Maximum cache entries |
| **JWT_SECRET** | Gateway | `your-super-secret-jwt-key-change-in-production` | JWT signing secret (CHANGE IN PRODUCTION!) |
| **JWT_EXPIRES_IN** | Gateway | `7d` | JWT token expiration |
| **GATEWAY_PORT** | Gateway | `3000` | Gateway service port |
| **PORT** | Gateway | `3000` | Service port (fallback) |
| **TRANSLATOR_HTTP_PORT** | Translator | `8000` | Translator HTTP port |
| **TRANSLATOR_GRPC_PORT** | Translator | `50051` | Translator gRPC port |
| **FASTAPI_PORT** | Translator | `8000` | FastAPI port |
| **GRPC_PORT** | Translator | `50051` | gRPC port |
| **FRONTEND_PORT** | Frontend | `3100` | Frontend service port |
| **ZMQ_PORT** | Gateway, Translator | `5555` | ZeroMQ base port |
| **ZMQ_TRANSLATOR_HOST** | Gateway | `localhost` | Translator ZMQ host |
| **ZMQ_TRANSLATOR_PUSH_PORT** | Gateway | `5555` | ZMQ push port |
| **ZMQ_TRANSLATOR_SUB_PORT** | Gateway | `5558` | ZMQ subscribe port |
| **ZMQ_TRANSLATOR_PULL_PORT** | Translator | `5555` | ZMQ pull port |
| **ZMQ_TRANSLATOR_PUB_PORT** | Translator | `5558` | ZMQ publish port |
| **ZMQ_TIMEOUT** | Gateway | `3000` | ZMQ timeout in milliseconds |
| **SUPPORTED_LANGUAGES** | Translator | `fr,en,es,de,pt,zh,ja,ar` | Comma-separated supported languages |
| **DEFAULT_LANGUAGE** | Translator | `fr` | Default language code |
| **AUTO_DETECT_LANGUAGE** | Translator | `true` | Enable automatic language detection |
| **TRANSLATION_TIMEOUT** | Translator | `30` | Translation timeout in seconds |
| **MAX_TEXT_LENGTH** | Translator | `1000` | Maximum text length for translation |
| **CONCURRENT_TRANSLATIONS** | Translator | `10` | Maximum concurrent translations |
| **TRANSLATION_WORKERS** | Translator | `50` | Number of translation workers |
| **BASIC_MODEL** | Translator | `t5-small` | Basic ML model name |
| **MEDIUM_MODEL** | Translator | `nllb-200-distilled-600M` | Medium ML model name |
| **PREMIUM_MODEL** | Translator | `nllb-200-distilled-1.3B` | Premium ML model name |
| **DEVICE** | Translator | `cpu` | ML device (`cpu`, `cuda`, `mps`) |
| **ML_BATCH_SIZE** | Translator | `4` | ML batch size |
| **GPU_MEMORY_FRACTION** | Translator | `0.8` | GPU memory fraction (0.0-1.0) |
| **QUANTIZATION_LEVEL** | Translator | `float16` | Model quantization (`float16`, `float32`) |
| **MODELS_PATH** | Translator | `models` | Path to ML models |
| **TORCH_HOME** | Translator | `models` | PyTorch home directory |
| **HF_HOME** | Translator | `models` | HuggingFace home directory |
| **MODEL_CACHE_DIR** | Translator | `models` | Model cache directory |
| **AUTO_CLEANUP_CORRUPTED_MODELS** | Translator | `true` | Auto-cleanup corrupted models |
| **FORCE_MODEL_REDOWNLOAD** | Translator | `false` | Force model re-download |
| **WS_MAX_CONNECTIONS** | Gateway | `100000` | Maximum WebSocket connections |
| **WS_PING_INTERVAL** | Gateway | `30000` | WebSocket ping interval (ms) |
| **WS_PING_TIMEOUT** | Gateway | `5000` | WebSocket ping timeout (ms) |
| **CORS_ORIGINS** | Gateway | `http://localhost:3100,http://localhost:3000` | CORS allowed origins |
| **CORS_ORIGIN** | Gateway | `http://localhost:3100` | CORS origin |
| **ALLOWED_ORIGINS** | Gateway | `http://localhost:3100,http://localhost:3000` | Allowed origins |
| **RATE_LIMIT_MAX** | Gateway | `1000` | Rate limit maximum requests |
| **RATE_LIMIT_WINDOW** | Gateway | `60000` | Rate limit window (ms) |
| **NEXT_PUBLIC_API_URL** | Frontend | `http://localhost:3000` | Public API URL |
| **NEXT_PUBLIC_WS_URL** | Frontend | `ws://localhost:3000` | Public WebSocket URL |
| **NEXT_PUBLIC_BACKEND_URL** | Frontend | `http://localhost:3000` | Public backend URL |
| **NEXT_PUBLIC_TRANSLATION_URL** | Frontend | `http://localhost:8000` | Public translation URL |
| **NEXT_PUBLIC_FRONTEND_URL** | Frontend | `http://localhost:3100` | Public frontend URL |
| **NEXT_TELEMETRY_DISABLED** | Frontend | `1` | Disable Next.js telemetry |
| **NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION** | Frontend | `true` | Disable client-side translation |
| **NEXT_PUBLIC_USE_API_TRANSLATION_ONLY** | Frontend | `true` | Use API translation only |
| **NEXT_PUBLIC_DEBUG_LOGS** | Frontend | `false` | Enable debug logs |
| **INTERNAL_BACKEND_URL** | Frontend | `http://gateway:3000` | Internal backend URL (SSR) |
| **INTERNAL_WS_URL** | Frontend | `ws://gateway:3000` | Internal WebSocket URL (SSR) |
| **DOCKER_BUILDKIT** | Docker | `1` | Enable Docker BuildKit |
| **DOCKER_DEFAULT_PLATFORM** | Docker | `linux/amd64` | Docker default platform |
| **PYTORCH_CUDA_ALLOC_CONF** | Translator | `max_split_size_mb:128` | PyTorch CUDA allocation config |
| **OMP_NUM_THREADS** | Translator | `4` | OpenMP number of threads |
| **MKL_NUM_THREADS** | Translator | `4` | MKL number of threads |
| **NUMEXPR_NUM_THREADS** | Translator | `4` | NumExpr number of threads |
| **PYTHONUNBUFFERED** | Translator | `1` | Unbuffered Python output |
| **WORKERS** | Translator | `4` | Number of workers |
| **NORMAL_WORKERS** | Translator | `2` | Number of normal workers |
| **ANY_WORKERS** | Translator | `1` | Number of any workers |
| **HEALTH_CHECK_INTERVAL** | All Services | `30` | Health check interval (seconds) |
| **HEALTH_CHECK_TIMEOUT** | All Services | `5` | Health check timeout (seconds) |
| **HEALTH_CHECK_RETRIES** | All Services | `3` | Health check retries |
| **HELMET_ENABLED** | Gateway | `true` | Enable Helmet security headers |
| **CONTENT_SECURITY_POLICY** | Gateway | `true` | Enable CSP headers |
| **FASTIFY_RELOAD** | Gateway | `true` | Enable Fastify hot reload |
| **NEXT_FAST_REFRESH** | Frontend | `true` | Enable Next.js fast refresh |
| **PRISMA_POOL_SIZE** | Gateway, Translator | `10` | Prisma connection pool size |
| **PRISMA_QUERY_ENGINE_LIBRARY** | Gateway, Translator | `` | Prisma query engine library |
| **PRISMA_CLIENT_ENGINE_TYPE** | Gateway, Translator | `library` | Prisma client engine type |
| **PRISMA_DISABLE_WARNINGS** | Gateway, Translator | `false` | Disable Prisma warnings |

### Quick Configuration Examples

#### Development
```bash
# Copy environment template
cp env.example .env

# Basic development setup
NODE_ENV=development
DEBUG=true
LOG_LEVEL=debug
```

#### Production
```bash
# Production configuration
NODE_ENV=production
DEBUG=false
LOG_LEVEL=warn
JWT_SECRET=your-super-secure-production-secret
```

#### Docker Compose
```bash
# Docker Compose with custom values
DATABASE_URL=postgresql://meeshy:password@postgres:5432/meeshy
REDIS_URL=redis://redis:6379
JWT_SECRET=your-docker-secret
```

For complete configuration options, see `env.example` file.

## 📈 Performance & Monitoring

### Performance Targets
- **Message throughput**: Optimized for high performance
- **Translation latency**: <100ms end-to-end target
- **Cache hit ratio**: Intelligent caching system
- **Database queries**: Optimized with Prisma ORM
- **WebSocket connections**: High-performance messaging
- **Memory usage**: Optimized for Docker containers

### Monitoring & Logging
- **Structured logging** with Winston and Loguru
- **Real-time performance metrics** with Prometheus
- **Health checks** for all services
- **Performance threshold alerts**
- **Request tracing** and error tracking

## 🚀 Production Deployment

### Docker Compose (Microservices)
```bash
docker-compose up -d
```

### Docker Compose Unified (All-in-One)
```bash
docker-compose -f docker-compose.unified.yml up -d
```

**Architecture unifiée** : Nginx reverse proxy sur le port 80, services internes non exposés

### Docker Registry Images
```bash
# Pull latest images
docker pull isopen/meeshy-translator:0.5.15-alpha
docker pull isopen/meeshy-gateway:0.5.15-alpha
docker pull isopen/meeshy-frontend:0.5.15-alpha
docker pull isopen/meeshy:0.5.15-alpha
```

### Automated Deployment
```bash
# Complete pipeline with tests and deployment
./scripts/build-and-test-applications.sh --auto-increment patch
```

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork** the project
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow TypeScript/Python best practices
- Add tests for new features
- Update documentation
- Ensure Docker builds work
- Run performance tests

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📋 Roadmap

- [ ] **Performance Optimization** - Further Docker and ML optimizations
- [ ] **Enhanced UI/UX** - Improved user interface and experience
- [ ] **Mobile Apps** (React Native)
- [ ] **Video/Voice Chat** with real-time translation
- [ ] **AI Chat Assistants** with multilingual support
- [ ] **Enterprise Features** - SSO integration and advanced security
- [ ] **Plugin System** for custom integrations
- [ ] **Kubernetes deployment** configurations
- [ ] **Auto-scaling** based on load

## 📊 Tech Stack

### Frontend
- **Next.js 15** - React framework with SSR and App Router
- **React 19** - Latest React with concurrent features
- **TypeScript 5.8** - Type-safe development
- **Tailwind CSS 3.4** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **Framer Motion** - Animation library
- **Socket.IO Client** - Real-time communication

### Backend
- **Fastify 5.1** - High-performance Node.js framework
- **FastAPI** - Modern Python web framework
- **gRPC** - High-performance RPC with Protocol Buffers
- **ZeroMQ** - High-performance asynchronous messaging
- **Socket.IO** - Real-time WebSocket communication
- **JWT** - Stateless authentication

### Database & Cache
- **PostgreSQL 17** - Primary database
- **Prisma 6.13** - Modern type-safe ORM
- **Redis 7** - High-performance cache and session store

### ML & AI
- **PyTorch 2.0+** - Deep learning framework
- **Transformers 4.35+** - HuggingFace ML library
- **NLLB-200** - Facebook's multilingual model
- **T5-small** - Google's multilingual model
- **Model quantization** - Memory optimization

### DevOps & Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Buildx** - Multi-platform builds
- **Nginx** - Reverse proxy and load balancing
- **Automated CI/CD** - Complete testing and deployment pipeline

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Fastify](https://www.fastify.io/) for WebSocket performance
- [Next.js](https://nextjs.org/) for the amazing React framework
- [Prisma](https://www.prisma.io/) for modern ORM
- [Transformers](https://huggingface.co/transformers/) for ML models
- [NLLB-200](https://ai.facebook.com/research/no-language-left-behind/) for multilingual translation
- [PyTorch](https://pytorch.org/) for deep learning framework
- The open-source community for inspiration and tools

## 📞 Support

- **GitHub Issues**: [Report bugs](https://github.com/jcnm/meeshy/issues)
- **Discussions**: [Community chat](https://github.com/jcnm/meeshy/discussions)
- **Documentation**: [Full docs](https://docs.meeshy.com) *(coming soon)*

## ⭐ Show Your Support

Give a ⭐ if this project helped you break language barriers in your communications!

---

**Meeshy** - Meet without shyness! Connect the world, one translation at a time 🌍✨

*Made with ❤️ by developers who believe communication should have no boundaries.*