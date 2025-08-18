# syntax=docker.io/docker/dockerfile:1
FROM node:22-alpine AS base

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
ARG PORT=80
ARG PNPM_VERSION=9.15.0
ARG NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3000
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
ARG NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION=false
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
    PATH="$PATH" \
    NPM_CONFIG_CACHE="/tmp/.npm" \
    YARN_CACHE_FOLDER="/tmp/.yarn" \
    NEXT_CACHE_DIR="/app/.next/cache"

# ===== DEPS STAGE =====
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat tini
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# ===== BUILDER STAGE =====
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set build environment variables
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://gateway:3000} \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL:-ws://gateway:3000} \
    NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL:-http://gateway:3000} \
    NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION=${NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION:-false} \
    NEXT_PUBLIC_USE_API_TRANSLATION_ONLY=${NEXT_PUBLIC_USE_API_TRANSLATION_ONLY:-true}

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

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

# Copy public assets
COPY --from=builder /app/public ./public

# Copy package.json for npm scripts
COPY --from=builder /app/package.json ./package.json

# Copy node_modules from the builder stage (full dependencies)
COPY --from=builder /app/node_modules ./node_modules

# Copy the entire .next directory from the builder stage
COPY --from=builder /app/.next ./.next

# Ensure .next directory structure is correct
RUN ls -la .next/ && ls -la .next/static/ && echo "✅ Static files verified"

# Create logs directory and set permissions
RUN mkdir -p /app/logs && \
    chown -R nextjs:nodejs /app && \
    chmod -R 755 /app

# Switch to non-root user
USER nextjs

# Expose port 80 (requires running container with appropriate permissions)
EXPOSE 80

# Set port to 80
ENV PORT=80
ENV HOSTNAME="0.0.0.0"

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# === HEALTH CHECK ===
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node -e "const http=require('http');const req=http.get({hostname:'0.0.0.0',port:80,path:'/api/health',timeout:5000},(res)=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1);});"

# Start Next.js in production mode
CMD ["npm", "start"]