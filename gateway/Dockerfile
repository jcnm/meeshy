# Gateway Dockerfile - Meeshy Fastify Service (Optimized)
FROM node:22-alpine

# === MAINTAINER INFORMATION ===
LABEL maintainer="Meeshy Development Team <dev@meeshy.com>" \
      description="Meeshy Gateway - Fastify API Service with WebSocket, gRPC and ZMQ support" \
      version="1.0.0" \
      org.opencontainers.image.source="https://github.com/jcnm/meeshy/gateway" \
      org.opencontainers.image.documentation="https://docs.meeshy.com/gateway" \
      org.opencontainers.image.vendor="Meeshy" \
      org.opencontainers.image.licenses="MIT"

# === BUILD ARGUMENTS ===
ARG NODE_ENV=production
ARG PNPM_VERSION=latest

# === ENVIRONMENT VARIABLES ===
ENV NODE_ENV=${NODE_ENV} \
    PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH" \
    NPM_CONFIG_CACHE="/tmp/.npm" \
    YARN_CACHE_FOLDER="/tmp/.yarn"

# === RUNTIME CONFIGURATION ===
ARG DATABASE_URL
ARG REDIS_URL
ARG JWT_SECRET
ARG JWT_EXPIRES_IN=24h
ARG FASTIFY_PORT=3000
ARG FASTIFY_HOST=0.0.0.0
ARG GATEWAY_PORT=3000
ARG LOG_LEVEL=info
ARG DEBUG=false
ARG WS_MAX_CONNECTIONS=100000
ARG WS_PING_INTERVAL=30000
ARG RATE_LIMIT_MAX=1000
ARG RATE_LIMIT_WINDOW=60000
ARG CORS_ORIGINS
ARG ALLOWED_ORIGINS
ARG FRONTEND_URL=http://localhost:3100
ARG BCRYPT_ROUNDS=12
ARG GRPC_TRANSLATION_HOST
ARG GRPC_TRANSLATION_PORT=50051
ARG TRANSLATOR_GRPC_URL
ARG ZMQ_TRANSLATOR_HOST
ARG ZMQ_TRANSLATOR_PUSH_PORT=5555
ARG ZMQ_TRANSLATOR_SUB_PORT=5558
ARG ZMQ_TRANSLATOR_PORT=5555
ARG ZMQ_TIMEOUT=30000

# Configuration des variables d'environnement runtime
ENV DATABASE_URL=${DATABASE_URL} \
    REDIS_URL=${REDIS_URL} \
    JWT_SECRET=${JWT_SECRET} \
    JWT_EXPIRES_IN=${JWT_EXPIRES_IN} \
    FASTIFY_PORT=${FASTIFY_PORT} \
    FASTIFY_HOST=${FASTIFY_HOST} \
    GATEWAY_PORT=${GATEWAY_PORT} \
    LOG_LEVEL=${LOG_LEVEL} \
    DEBUG=${DEBUG} \
    WS_MAX_CONNECTIONS=${WS_MAX_CONNECTIONS} \
    WS_PING_INTERVAL=${WS_PING_INTERVAL} \
    RATE_LIMIT_MAX=${RATE_LIMIT_MAX} \
    RATE_LIMIT_WINDOW=${RATE_LIMIT_WINDOW} \
    CORS_ORIGINS=${CORS_ORIGINS} \
    ALLOWED_ORIGINS=${ALLOWED_ORIGINS} \
    FRONTEND_URL=${FRONTEND_URL} \
    BCRYPT_ROUNDS=${BCRYPT_ROUNDS} \
    GRPC_TRANSLATION_HOST=${GRPC_TRANSLATION_HOST} \
    GRPC_TRANSLATION_PORT=${GRPC_TRANSLATION_PORT} \
    TRANSLATOR_GRPC_URL=${TRANSLATOR_GRPC_URL} \
    ZMQ_TRANSLATOR_HOST=${ZMQ_TRANSLATOR_HOST} \
    ZMQ_TRANSLATOR_PUSH_PORT=${ZMQ_TRANSLATOR_PUSH_PORT} \
    ZMQ_TRANSLATOR_SUB_PORT=${ZMQ_TRANSLATOR_SUB_PORT} \
    ZMQ_TRANSLATOR_PORT=${ZMQ_TRANSLATOR_PORT} \
    ZMQ_TIMEOUT=${ZMQ_TIMEOUT} \
    PORT=${FASTIFY_PORT}

# === SYSTEM SETUP ===
# Installation des dépendances système et configuration utilisateur en une seule layer
RUN apk add --no-cache \
        tini \
        curl \
        git \
        python3 \
        make \
        g++ \
    && corepack enable pnpm \
    && corepack prepare pnpm@${PNPM_VERSION} --activate \
    && addgroup -g 1001 -S nodejs \
    && adduser -u 1001 -S -G nodejs gateway \
    && mkdir -p /app/logs \
    && chown -R gateway:nodejs /app

WORKDIR /app

# === DEPENDENCY INSTALLATION ===
# Copie des fichiers de dépendances en premier (pour le cache Docker)
COPY --chown=gateway:nodejs package.json pnpm-lock.yaml* ./
COPY --chown=gateway:nodejs .env.docker ./.env

# Installation des dépendances et nettoyage en une seule layer
RUN pnpm install --no-frozen-lockfile --prod=false \
    && pnpm store prune \
    && rm -rf /tmp/.npm /tmp/.yarn ~/.cache

# === APPLICATION BUILD ===
# Copie du code source et des ressources partagées
COPY --chown=gateway:nodejs src/ ./src/
COPY --chown=gateway:nodejs shared/ ./shared/
COPY --chown=gateway:nodejs tsconfig.json ./

# Build de l'application avec nettoyage
RUN npx prisma generate --schema=./shared/schema.prisma \
    && npx tsc \
    && rm -rf src/ tsconfig.json \
    && pnpm install --prod --ignore-scripts \
    && pnpm store prune \
    && rm -rf /tmp/.npm /tmp/.yarn ~/.cache

# === FINAL CONFIGURATION ===
# Configuration finale des permissions
RUN chown -R gateway:nodejs /app \
    && chmod -R 755 /app/logs

USER gateway

EXPOSE ${FASTIFY_PORT}

ENTRYPOINT ["/sbin/tini", "--"]

# === HEALTH CHECK ===
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${FASTIFY_PORT}/health || exit 1

# === STARTUP COMMAND ===
CMD ["node", "dist/src/server.js"]