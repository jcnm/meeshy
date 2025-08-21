# Meeshy 🚀

**High-performance real-time multilingual messaging platform**

*Meet without shyness! Connect the world, one translation at a time.*

Meeshy is a modern, high-performance messaging application designed to handle thousands of messages per second with automatic real-time translation to multiple languages simultaneously. Built with enterprise-grade architecture and optimized for scalability.

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![Performance](https://img.shields.io/badge/Performance-100k_msg/sec-green)
![Languages](https://img.shields.io/badge/Languages-8_supported-orange)
![License](https://img.shields.io/badge/License-MIT-brightgreen)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ed)
![Version](https://img.shields.io/badge/Version-0.5.4--alpha-blue)

## ✨ Why Meeshy?

Breaking language barriers in real-time communication! Meeshy empowers global teams, communities, and friends to chat naturally in their preferred languages while everyone receives messages in their own language instantly.

**🌟 Key Highlights:**
- **Zero Language Barriers**: Automatic translation to 8 major languages
- **Enterprise Performance**: Handle 100k+ concurrent connections with optimized architecture
- **Real-time Communication**: WebSocket-based messaging with instant translation
- **Developer Friendly**: Full Docker setup, modern tech stack, automated CI/CD
- **Open Source**: MIT licensed with active community

## 🎯 Core Features

### 🔐 Robust Authentication & User Management
- **Centralized authentication** with JWT tokens
- **Anonymous sessions** for shared conversations
- **Role-based access control** (USER, ADMIN, MODO, AUDIT, ANALYST, BIGBOSS)
- **Automatic route protection** with configurable guards
- **Secure data cleanup** on logout

### 💬 Real-Time Messaging
- **High-performance WebSocket** with Socket.IO and Fastify
- **100k+ simultaneous connections** support with optimized architecture
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
- **Load balancing** ready architecture
- **Docker deployment** with unified container option
- **Multi-platform builds** (linux/amd64, linux/arm64)

## 🏛️ System Architecture

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

# Run with unified container
docker-compose -f docker-compose.unified.yml up -d
```

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
- **Unified**: http://localhost (via Nginx proxy)

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
- **Translation throughput**: 50+ concurrent translations
- **Translation latency**: <100ms end-to-end
- **Cache hit ratio**: >85% on translations
- **Database queries**: <5ms average response time
- **WebSocket connections**: 100k+ simultaneous
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

#### Database & Cache
```env
DATABASE_URL=postgresql://meeshy:MeeshyP@ssword@localhost:5432/meeshy
POSTGRES_DB=meeshy
POSTGRES_USER=meeshy
POSTGRES_PASSWORD=MeeshyP@ssword
REDIS_URL=redis://localhost:6379
```

#### Services
```env
TRANSLATOR_HTTP_PORT=8000
TRANSLATOR_GRPC_PORT=50051
GATEWAY_PORT=3000
FRONTEND_PORT=3100
```

#### Translation & Performance
```env
SUPPORTED_LANGUAGES=fr,en,es,de,pt,zh,ja,ar
DEFAULT_LANGUAGE=fr
QUANTIZATION_LEVEL=float16
TRANSLATION_WORKERS=50
ML_BATCH_SIZE=4
DEVICE=cpu
```

#### Security & CORS
```env
JWT_SECRET=your-secret-key
CORS_ORIGINS=http://localhost,http://localhost:80,http://127.0.0.1
ALLOWED_ORIGINS=http://localhost,http://localhost:80,http://127.0.0.1
```

## 📈 Performance & Monitoring

### Performance Targets
- **Message throughput**: 100k messages/second
- **Translation latency**: <100ms end-to-end
- **Cache hit ratio**: >85% on translations
- **Database queries**: <5ms average response time
- **WebSocket connections**: 100k+ simultaneous
- **Memory usage**: <8GB for full stack

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

### Docker Registry Images
```bash
# Pull latest images
docker pull isopen/meeshy-translator:0.5.4-alpha
docker pull isopen/meeshy-gateway:0.5.4-alpha
docker pull isopen/meeshy-frontend:0.5.4-alpha
docker pull isopen/meeshy:0.5.4-alpha
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

- [ ] **Video/Voice Chat** with real-time translation
- [ ] **Mobile Apps** (React Native)
- [ ] **AI Chat Assistants** with multilingual support
- [ ] **Enterprise SSO** integration
- [ ] **Advanced Analytics** dashboard
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
- **PostgreSQL 15** - Primary database
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