# syntax=docker.io/docker/dockerfile:1
# Build context: frontend/ directory (distribute.sh copies shared/ into frontend/)
FROM node:22-alpine AS base

# === MAINTAINER INFORMATION ===
LABEL maintainer="Meeshy Development Team <dev@meeshy.me>" \
      description="Meeshy Frontend - Next.js Application with SSR/SSG support" \
      version="1.0.0" \
      org.opencontainers.image.source="https://github.com/jcnm/meeshy/frontend" \
      org.opencontainers.image.documentation="https://docs.meeshy.me/frontend" \
      org.opencontainers.image.vendor="Meeshy" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.title="Meeshy Frontend" \
      org.opencontainers.image.description="Next.js frontend application for Meeshy platform"

# === BUILD ARGUMENTS ===
ARG PNPM_VERSION=9.15.0
ARG NEXT_TELEMETRY_DISABLED=1

# === ENVIRONMENT VARIABLES ===
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NPM_CONFIG_CACHE="/tmp/.npm" \
    YARN_CACHE_FOLDER="/tmp/.yarn" \
    NEXT_CACHE_DIR="/app/.next/cache"

# ===== DEPS STAGE =====
FROM base AS deps
RUN apk add --no-cache libc6-compat tini
WORKDIR /app

# Copy workspace configuration (distribute.sh copies these to frontend/)
COPY pnpm-workspace.yaml ./
COPY shared/package.json ./shared/

# Copy frontend package files (context is now frontend/)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies with pnpm (no frozen lockfile for CI compatibility)
RUN corepack enable pnpm && pnpm i --no-frozen-lockfile

# ===== BUILDER STAGE =====
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy frontend source code (context is now frontend/)
COPY . ./

# Set build environment variables
ARG NEXT_PUBLIC_API_URL=https://gate.meeshy.me
ARG NEXT_PUBLIC_WS_URL=wss://gate.meeshy.me
ARG NEXT_PUBLIC_BACKEND_URL=https://gate.meeshy.me
ARG NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION=false
ARG NEXT_PUBLIC_USE_API_TRANSLATION_ONLY=true

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL} \
    NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL} \
    NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION=${NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION} \
    NEXT_PUBLIC_USE_API_TRANSLATION_ONLY=${NEXT_PUBLIC_USE_API_TRANSLATION_ONLY} \
    NEXT_TELEMETRY_DISABLED=1

# Build the application with pnpm
RUN corepack enable pnpm && pnpm run build

# ===== RUNNER STAGE =====
FROM base AS runner
WORKDIR /app

# Production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create nextjs user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install tini for proper signal handling
RUN apk add --no-cache tini

# OPTIMISATION: Utiliser le mode standalone de Next.js
# Copie uniquement les fichiers nécessaires (~90% plus petit que node_modules complet)

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone output (includes minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static files (not included in standalone)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Verify build artifacts
RUN ls -la .next/ && echo "Standalone build verified"

# Create logs directory
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

# Switch to non-root user
USER nextjs

# Expose port 3100 (used by Traefik routing)
EXPOSE 3100

# Set port to 3100 (matching docker-compose.traefik.yml)
ENV PORT=3100
ENV HOSTNAME="0.0.0.0"

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# === HEALTH CHECK ===
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node -e "const http=require('http');const req=http.get({hostname:'0.0.0.0',port:3100,path:'/api/health',timeout:5000},(res)=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1);});"

# Start Next.js standalone server
CMD ["node", "server.js"]
