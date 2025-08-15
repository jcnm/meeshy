# Frontend Dockerfile - Meeshy Next.js Application (Optimized)
FROM node:22-alpine

# === MAINTAINER INFORMATION ===
LABEL maintainer="Meeshy Development Team <dev@meeshy.com>" \
      description="Meeshy Frontend - Next.js Application with SSR/SSG support" \
      version="1.0.0" \
      org.opencontainers.image.source="https://github.com/jcnm/meeshy/frontend" \
      org.opencontainers.image.documentation="https://docs.meeshy.com/frontend" \
      org.opencontainers.image.vendor="Meeshy" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.title="Meeshy Frontend" \
      org.opencontainers.image.description="Next.js frontend application for Meeshy platform"

# === BUILD ARGUMENTS ===
ARG NODE_ENV=production
ARG PNPM_VERSION=latest
ARG PORT=3100

# === NEXT.JS CONFIGURATION ===
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION=true
ARG NEXT_PUBLIC_USE_API_TRANSLATION_ONLY=true

# === ENVIRONMENT VARIABLES ===
ENV NODE_ENV=${NODE_ENV} \
    PORT=${PORT} \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=${NEXT_TELEMETRY_DISABLED} \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL} \
    NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL} \
    NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION=${NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION} \
    NEXT_PUBLIC_USE_API_TRANSLATION_ONLY=${NEXT_PUBLIC_USE_API_TRANSLATION_ONLY} \
    PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH" \
    NPM_CONFIG_CACHE="/tmp/.npm" \
    YARN_CACHE_FOLDER="/tmp/.yarn" \
    NEXT_CACHE_DIR="/app/.next/cache"

# === SYSTEM SETUP ===
# Installation système, pnpm et configuration utilisateur en une seule layer
RUN apk add --no-cache \
        tini \
        curl \
        git \
        libc6-compat \
        python3 \
        make \
        g++ \
    && corepack enable pnpm \
    && corepack prepare pnpm@${PNPM_VERSION} --activate \
    && addgroup -g 1001 -S nodejs \
    && adduser -u 1001 -S -G nodejs nextjs \
    && mkdir -p /app/logs /app/.next/cache \
    && chown -R nextjs:nodejs /app

WORKDIR /app

# === DEPENDENCY INSTALLATION ===
# Copie des fichiers de dépendances (pour optimiser le cache Docker)
COPY --chown=nextjs:nodejs package.json pnpm-lock.yaml* ./
COPY --chown=nextjs:nodejs .env.docker ./.env

# Installation des dépendances avec optimisation cache
RUN pnpm install --no-frozen-lockfile --prod=false \
    && pnpm store prune \
    && rm -rf /tmp/.npm /tmp/.yarn ~/.cache

# === APPLICATION BUILD ===
# Copie du code source et ressources
COPY --chown=nextjs:nodejs . ./

# Build Next.js avec optimisations
RUN echo "🚀 Building Next.js application..." \
    && pnpm run build \
    && echo "✅ Build completed successfully" \
    && ls -la .next/ \
    && pnpm install --prod --ignore-scripts \
    && pnpm store prune \
    && rm -rf /tmp/.npm /tmp/.yarn ~/.cache src/ \
    && rm -f next.config.* tsconfig.json tailwind.config.* postcss.config.*

# === FINAL CONFIGURATION ===
# Optimisation des permissions et nettoyage final
RUN chown -R nextjs:nodejs /app \
    && chmod -R 755 /app/logs /app/.next/cache \
    && find /app -name "*.map" -type f -delete 2>/dev/null || true \
    && find /app -name "*.md" -type f -delete 2>/dev/null || true

USER nextjs

EXPOSE ${PORT}

ENTRYPOINT ["/sbin/tini", "--"]

# === HEALTH CHECK ===
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node -e " \
        const http = require('http'); \
        const options = { hostname: '0.0.0.0', port: process.env.PORT || 3100, path: '/api/health' || '/', timeout: 5000 }; \
        const req = http.get(options, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); \
        req.on('error', () => process.exit(1)); \
        req.on('timeout', () => { req.destroy(); process.exit(1); }); \
    "

# === STARTUP COMMAND ===
CMD ["node", "server.js"]