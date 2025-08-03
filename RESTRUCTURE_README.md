# Meeshy - Restructured Microservices Architecture

## 🏗️ New Project Structure

```
meeshy/
├── shared/                     # Shared resources (Prisma, ProtoBuffers)
│   ├── prisma/                # Database schema and migrations
│   ├── proto/                 # gRPC protocol definitions
│   └── generated/             # Generated types and clients
│
├── gateway/                    # Fastify Gateway Service (Node.js 22)
│   ├── src/                   # Gateway source code
│   ├── Dockerfile             # Production-ready container
│   └── package.json           # Gateway dependencies
│
├── translator/                 # FastAPI Translation Service (Python 3.12)
│   ├── src/                   # Translation service source
│   ├── models/                # ML models (moved from public/)
│   ├── Dockerfile             # Production-ready container
│   └── requirements.txt       # Python dependencies
│
├── frontend/                   # Next.js Frontend (Node.js 22)
│   ├── src/                   # Frontend source code
│   ├── public/                # Static assets
│   ├── Dockerfile             # Production-ready container
│   └── package.json           # Frontend dependencies
│
├── docker-compose.new.yml      # Updated Docker Compose
└── package.json                # Root orchestration
```

## 🚀 Getting Started

### Development Mode

```bash
# Install all dependencies
npm run install:all

# Start all services in development
npm run dev

# Or start individual services
npm run dev:frontend    # Next.js on :3100
npm run dev:gateway     # Fastify on :3000  
npm run dev:translator  # FastAPI on :8000
```

### Production Mode

```bash
# Build all services
npm run build

# Start with Docker Compose
npm run docker:up

# Or use the new compose file
docker-compose -f docker-compose.new.yml up -d
```

## 📊 Service Architecture

### 🔌 Gateway Service (Port 3000)
- **Technology**: Fastify + WebSocket + Node.js 22
- **Responsibilities**: 
  - Real-time messaging via WebSocket
  - User/conversation CRUD operations
  - Language filtering and message routing
  - Authentication and authorization
- **Database**: Read messages, CRUD everything else via Prisma

### 🌐 Translator Service (Port 8000)
- **Technology**: FastAPI + Transformers + Python 3.12
- **Responsibilities**:
  - Message creation and translation management
  - Multi-language ML translation (MT5/NLLB)
  - Translation caching and optimization
  - gRPC server for real-time communication
- **Database**: Full CRUD on messages and translations via Prisma
- **Models**: Now located in `translator/models/`

### 💻 Frontend Service (Port 3100)
- **Technology**: Next.js 15 + TypeScript + Tailwind CSS + Node.js 22
- **Responsibilities**:
  - User interface and experience
  - WebSocket client for real-time messaging
  - Language preference management
  - Receives messages only in user's configured language

### 🗄️ Shared Service
- **Technology**: Prisma ORM + Protocol Buffers
- **Responsibilities**:
  - Database schema management
  - Type generation for all services
  - gRPC protocol definitions
  - Cross-service communication contracts

## 🔧 Production Features

### Docker Containers
- **Node.js 22** for all JavaScript services
- **Python 3.12** for translation service
- **Multi-stage builds** for optimized images
- **Non-root users** for security
- **Health checks** for all services
- **Tini init system** for proper signal handling

### Performance Optimizations
- **pnpm** for faster package management
- **Frozen lockfiles** for reproducible builds
- **Production-only dependencies** in final images
- **Shared volumes** for generated types
- **Redis caching** for translations
- **Connection pooling** for database access

## 🌍 Multi-Language Flow

1. **User sends message** → Gateway (WebSocket)
2. **Gateway determines languages** needed for conversation participants  
3. **Gateway → Translator** (gRPC): Translation request for all required languages
4. **Translator processes** using ML models (MT5/NLLB) with caching
5. **Translator → Gateway**: All translations returned
6. **Gateway broadcasts** to users in their configured language only

## 📝 Key Changes Made

1. ✅ **Moved models** from `public/models/` to `translator/models/`
2. ✅ **Restructured** into four main services (shared, gateway, translator, frontend)
3. ✅ **Upgraded** to Node.js 22 for all JavaScript services
4. ✅ **Upgraded** to Python 3.12 for translation service
5. ✅ **Created production-ready** Dockerfiles with multi-stage builds
6. ✅ **Added workspace management** with pnpm workspaces
7. ✅ **Updated Docker Compose** for new architecture
8. ✅ **Added health checks** and proper container orchestration

## 🎯 Next Steps

1. Update environment variables in `.env` files
2. Run database migrations: `cd shared && pnpm run migrate`
3. Test the new structure: `npm run docker:up`
4. Verify all services are healthy: `docker-compose logs -f`

The new architecture provides better separation of concerns, improved scalability, and production-ready containerization while maintaining the high-performance multi-language messaging capabilities.
