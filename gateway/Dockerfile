# Gateway Dockerfile - Meeshy Fastify Service (Autonomous Build)
FROM node:22-alpine AS base

# Install system dependencies and pnpm
RUN apk add --no-cache \
    tini \
    curl \
    git \
    python3 \
    make \
    g++ \
    && corepack enable pnpm \
    && corepack prepare pnpm@latest --activate

ENTRYPOINT ["/sbin/tini", "--"]

# === BUILD STAGE ===
FROM base AS builder
WORKDIR /app

# Copy entire gateway application (including shared that was pre-copied)
COPY . ./
COPY .env.docker .env

# Environment variables for build
ENV NODE_ENV=production
# Clean up previous node_modules and prisma directories
RUN rm -rf node_modules/.prisma && \
    rm -rf prisma
    
# Install all dependencies including dev dependencies for build
RUN pnpm install --no-frozen-lockfile
# Generate Prisma client
RUN npx prisma generate --schema=./shared/schema.prisma
# Build the application
RUN npx tsc 

# RUN npx tsc --noEmit false --skipLibCheck true --strict false

# === PRODUCTION STAGE ===
FROM base AS runner
WORKDIR /app

# Runtime environment variables
ARG NODE_ENV=production
ARG DATABASE_URL
ARG REDIS_URL
ARG JWT_SECRET
ARG JWT_EXPIRES_IN=24h
ARG FASTIFY_PORT=3000
ARG FASTIFY_HOST=0.0.0.0
ARG LOG_LEVEL=info
ARG WS_MAX_CONNECTIONS=100000
ARG WS_PING_INTERVAL=30000
ARG RATE_LIMIT_MAX=1000
ARG RATE_LIMIT_WINDOW=60000
ARG CORS_ORIGINS
ARG GRPC_TRANSLATION_HOST
ARG GRPC_TRANSLATION_PORT=50051
ARG TRANSLATOR_GRPC_URL

ENV NODE_ENV=${NODE_ENV}
ENV DATABASE_URL=${DATABASE_URL}
ENV REDIS_URL=${REDIS_URL}
ENV JWT_SECRET=${JWT_SECRET}
ENV JWT_EXPIRES_IN=${JWT_EXPIRES_IN}
ENV FASTIFY_PORT=${FASTIFY_PORT}
ENV FASTIFY_HOST=${FASTIFY_HOST}
ENV LOG_LEVEL=${LOG_LEVEL}
ENV WS_MAX_CONNECTIONS=${WS_MAX_CONNECTIONS}
ENV WS_PING_INTERVAL=${WS_PING_INTERVAL}
ENV RATE_LIMIT_MAX=${RATE_LIMIT_MAX}
ENV RATE_LIMIT_WINDOW=${RATE_LIMIT_WINDOW}
ENV CORS_ORIGINS=${CORS_ORIGINS}
ENV GRPC_TRANSLATION_HOST=${GRPC_TRANSLATION_HOST}
ENV GRPC_TRANSLATION_PORT=${GRPC_TRANSLATION_PORT}
ENV TRANSLATOR_GRPC_URL=${TRANSLATOR_GRPC_URL}
# ZMQ Configuration
ENV ZMQ_TRANSLATOR_HOST=${ZMQ_TRANSLATOR_HOST}
ENV ZMQ_TRANSLATOR_PORT=${ZMQ_TRANSLATOR_PORT}
ENV ZMQ_TIMEOUT=${ZMQ_TIMEOUT}
ENV PORT=${FASTIFY_PORT}

# Create system user and logs directory
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S -G nodejs gateway && \
    mkdir -p logs && \
    chown -R gateway:nodejs logs

# Copy built application and shared libraries
COPY --from=builder --chown=gateway:nodejs /app/dist ./dist
COPY --from=builder --chown=gateway:nodejs /app/shared ./dist/shared
COPY --from=builder --chown=gateway:nodejs /app/node_modules ./node_modules
COPY --chown=gateway:nodejs package.json ./

COPY .env.docker .env

USER gateway

EXPOSE ${FASTIFY_PORT}

RUN cp -i .env /app/dist
# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${FASTIFY_PORT}/health || exit 1

CMD ["node", "dist/src/server.js"]
