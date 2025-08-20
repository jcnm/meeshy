# Meeshy 🚀

**High-performance messaging platform with real-time multilingual translation**

*Meet without shyness! Connect the world, one translation at a time.*

Meeshy is a modern messaging application designed to handle thousands of messages per second with automatic real-time translation to multiple languages simultaneously.

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![Performance](https://img.shields.io/badge/Performance-100k_msg/sec-green)
![Languages](https://img.shields.io/badge/Languages-8_supported-orange)
![License](https://img.shields.io/badge/License-MIT-brightgreen)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ed)

## ✨ Why Meeshy?

Breaking language barriers in real-time communication! Meeshy empowers global teams, communities, and friends to chat naturally in their preferred languages while everyone receives messages in their own language instantly.

**🌟 Key Highlights:**
- **Zero Language Barriers**: Automatic translation to 8 major languages
- **Enterprise Performance**: Handle 100k+ concurrent connections
- **Developer Friendly**: Full Docker setup, modern tech stack
- **Open Source**: MIT licensed with active community

## 🎯 Features

### 🔐 Robust Authentication
- **Centralized authentication** state management
- **Anonymous sessions** for shared conversations
- **Automatic route protection** with configurable guards
- **Secure data cleanup** on logout

### 💬 Real-Time Messaging
- **High-performance WebSocket** with Fastify
- **100k+ simultaneous connections** support
- **Live typing indicators** and message status
- **Group conversations** with role management

### 🌐 Automatic Multilingual Translation
- **Instant translation** to 8 languages (FR, EN, ES, DE, PT, ZH, JA, AR)
- **Advanced ML models**: T5-small (basic), NLLB-200-distilled-600M (medium), NLLB-200-distilled-1.3B (premium)
- **Intelligent caching** with Redis + persistent database
- **Automatic language detection** for source messages

### 🏗️ Distributed Architecture
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Gateway**: Fastify + WebSocket (user management, message routing)
- **Translator**: FastAPI + Transformers (ML translation)
- **Database**: PostgreSQL 15 + Prisma ORM
- **Cache**: Redis 7 for optimal performance

### 🚀 Performance & Scalability
- **gRPC communication** between services with Protocol Buffers
- **Asynchronous queues** with ZMQ for batch operations
- **Optimized database** with intelligent indexing
- **Docker deployment** with unified container option

## 🏛️ System Architecture

```
┌─────────────────┐    WebSocket/HTTP   ┌──────────────────┐
│   Frontend      │◄───────────────────►│    Gateway       │
│   (Next.js 15)  │   Access & Session  │   (Fastify)      │
└─────────────────┘        Token        └──────────────────┘
                                                  │
                                         gRPC + Protobuf + 0MQ
                                                  ▼
┌─────────────────┐                     ┌──────────────────┐
│   PostgreSQL    │◄────────────────────┤   Translator     │
│   + Prisma      │    Shared Database  │   (FastAPI)      │
└─────────────────┘      and Types      └──────────────────┘
                                                 │
┌─────────────────┐                              │
│     Redis       │◄─────────────────────────────┘
│    (Cache)      │         Translation Cache
└─────────────────┘
```

### Service Responsibilities

#### 🎨 Frontend (Next.js 15)
- Modern and responsive user interface
- WebSocket management for real-time features
- Message reception in user's configured language
- State management with React hooks + SWR

#### ⚡ Gateway (Fastify)
- **Full CRUD**: Users, conversations, groups, preferences
- **Read-only messages**: Display and routing only
- **WebSocket**: Real-time connections and intelligent routing
- **Language filtering**: Distribution based on user preferences

#### 🤖 Translator (FastAPI)
- **Message CRUD**: Create, modify, delete messages
- **ML Translation**: T5-small and NLLB-200 models via Transformers
- **Intelligent cache**: Robust caching system by language pairs
- **Simultaneous translation**: To all required languages at once

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

### Translation Flow Example
```
1. User A sends "Hello" (English) → Gateway (WebSocket)
2. Gateway determines required languages for participants
3. Gateway → Translator (gRPC): Request translation to all languages
4. Translator processes:
   • Checks cache (MessageTranslation + Redis)
   • Translates missing languages with ML
   • Stores translations with cache key
5. Translator → Gateway: All translations
6. Gateway broadcasts based on preferences:
   • User B (systemLanguage: "fr") → receives "Bonjour"
   • User C (regionalLanguage: "es") → receives "Hola"
   • User D (systemLanguage: "en") → receives "Hello"
```

## 🚀 Quick Start

### Prerequisites
- Node.js 22+ and pnpm
- Python 3.12+ 
- Transformers
- Accelerate
- PostgreSQL 15+ and Redis 7 (or Docker)

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

### Option 3: Local Development
```bash
# Clone the project
git clone https://github.com/jcnm/meeshy.git
cd meeshy

# Start development environment
./scripts/start-dev.sh
```

🌐 **Access the application**: 
- **Microservices**: http://localhost:3100 (Frontend), http://localhost:3000 (Gateway)
- **Unified**: http://localhost (via Nginx proxy)

## 📊 Supported Languages

| Language | Code | Model | Performance |
|----------|------|-------|-------------|
| French | `fr` | NLLB-200 | Native |
| English | `en` | NLLB-200 | Excellent |
| Spanish | `es` | NLLB-200 | Excellent |
| German | `de` | NLLB-200 | Very Good |
| Portuguese | `pt` | NLLB-200 | Very Good |
| Chinese | `zh` | NLLB-200 | Good |
| Japanese | `ja` | NLLB-200 | Good |
| Arabic | `ar` | NLLB-200 | Good |

## 🛠️ Development

### Project Structure
```
meeshy/
├── frontend/          # Next.js 15 + TypeScript
├── gateway/           # Fastify + WebSocket
├── translator/        # FastAPI + ML Models
├── shared/            # Prisma Schema + Proto
├── docker/            # Nginx Configuration
├── scripts/           # Development scripts
├── docker-compose.yml # Microservices setup
└── docker-compose.unified.yml # All-in-one setup
```

### Available Scripts
```bash
# Development
./scripts/start-dev.sh

# Docker Microservices
docker-compose up -d          # Start services
docker-compose down           # Stop services
docker-compose logs           # View logs

# Docker Unified
docker-compose -f docker-compose.unified.yml up -d
docker-compose -f docker-compose.unified.yml down
docker-compose -f docker-compose.unified.yml logs

# Build and publish
./build-and-push-0.5.1-alpha.sh  # Build and push to registry
```

## 🔧 Configuration

### Environment Variables

#### Database
```env
DATABASE_URL=postgresql://meeshy:MeeshyP@ssword@localhost:5432/meeshy
POSTGRES_DB=meeshy
POSTGRES_USER=meeshy
POSTGRES_PASSWORD=MeeshyP@ssword
```

#### Services
```env
TRANSLATOR_HTTP_PORT=8000
TRANSLATOR_GRPC_PORT=50051
GATEWAY_PORT=3000
FRONTEND_PORT=3100
```

#### Translation
```env
SUPPORTED_LANGUAGES=fr,en,es,de,pt,zh,ja,ar
DEFAULT_LANGUAGE=fr
QUANTIZATION_LEVEL=float16
TRANSLATION_WORKERS=50
```

#### CORS
```env
CORS_ORIGINS=http://localhost,http://localhost:80,http://127.0.0.1,http://127.0.0.1:80,http://localhost:3100
ALLOWED_ORIGINS=http://localhost,http://localhost:80,http://127.0.0.1,http://127.0.0.1:80,http://localhost:3100
```

## 📈 Performance & Metrics

### Performance Targets
- **Message throughput**: 10k messages/second
- **Translation latency**: <50ms end-to-end
- **Cache hit ratio**: >80% on translations
- **Database queries**: <10ms average response time
- **WebSocket connections**: 10k+ simultaneous

### Monitoring
- Structured logging with configurable detail levels
- Real-time performance metrics
- Health checks for all services
- Performance threshold alerts

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
docker pull isopen/meeshy-translator:0.5.2-alpha
docker pull isopen/meeshy-gateway:0.5.2-alpha
docker pull isopen/meeshy-frontend:0.5.2-alpha
docker pull isopen/meeshy:0.5.2-alpha
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

## 📊 Tech Stack

### Frontend
- **Next.js 15** - React framework with SSR
- **TypeScript 5.8** - Type-safe development
- **Tailwind CSS 3.4** - Utility-first styling
- **React 19** - Latest React version

### Backend
- **Fastify 5.1** - High-performance Node.js framework
- **FastAPI 0.104+** - Modern Python web framework
- **gRPC** - High-performance RPC
- **ZeroMQ** - High-performance asynchronous communication
- **WebSockets** - Real-time communication

### Database & Cache
- **PostgreSQL 15** - Primary database
- **Prisma 6.13** - Modern ORM
- **Redis 7** - High-performance cache

### ML & AI
- **Transformers 4.35+** - HuggingFace ML library
- **NLLB-200** - Facebook's multilingual model
- **T5-small** - Google's multilingual model
- **PyTorch 2.0+** - Deep learning framework

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Buildx** - Multi-platform builds
- **Nginx** - Reverse proxy

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Fastify](https://www.fastify.io/) for WebSocket performance
- [Next.js](https://nextjs.org/) for the amazing React framework
- [Prisma](https://www.prisma.io/) for modern ORM
- [Transformers](https://huggingface.co/transformers/) for ML models
- [NLLB-200](https://ai.facebook.com/research/no-language-left-behind/) for multilingual translation
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