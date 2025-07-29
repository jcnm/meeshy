# ===== MEESHY BACKEND FASTIFY DOCKERFILE =====
# Multi-stage build avec pnpm et structure backend refactorisée

# === BASE STAGE ===
FROM node:18-alpine AS base
RUN npm install -g pnpm@latest && \
    apk add --no-cache dumb-init tini \
    python3 make g++ sqlite openssl curl
ENTRYPOINT ["/sbin/tini", "--"]

# === BUILDER STAGE ===
FROM base AS builder
WORKDIR /app

# Copie des packages des shared dependencies
COPY shared/package*.json ./shared/
COPY shared/prisma/ ./shared/prisma/
COPY shared/proto/ ./shared/proto/

# Installation des shared dependencies
WORKDIR /app/shared
RUN pnpm install --no-frozen-lockfile

# Configuration Prisma - Génération du client avec le bon schéma
RUN pnpm prisma generate --schema=./prisma/schema.prisma

# Copie des packages du service Fastify
WORKDIR /app
COPY fastify-service/package*.json ./fastify-service/
COPY fastify-service/tsconfig.json ./fastify-service/

WORKDIR /app/fastify-service
RUN pnpm install --no-frozen-lockfile --prod=false

# Copie du code source
COPY fastify-service/src/ ./src/
COPY shared/ ../shared/

# Construire l'application avec optimisations
RUN pnpm run build && \
    pnpm prune --prod && \
    pnpm store prune

# === PRODUCTION STAGE FINAL ===
FROM base AS production
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs fastify
WORKDIR /app
RUN chown fastify:nodejs /app
USER fastify

# Copie des dépendances de production depuis builder
COPY --from=builder --chown=fastify:nodejs /app/shared ./shared
COPY --from=builder --chown=fastify:nodejs /app/fastify-service/node_modules ./fastify-service/node_modules
COPY --from=builder --chown=fastify:nodejs /app/fastify-service/dist ./fastify-service/dist
COPY --from=builder --chown=fastify:nodejs /app/fastify-service/package*.json ./fastify-service/

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app/fastify-service

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001

CMD ["node", "dist/server.js"]
