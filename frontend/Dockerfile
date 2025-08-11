# Frontend Dockerfile - Meeshy Next.js Application (Autonomous Build)
FROM node:22-alpine AS base

# Install system dependencies and pnpm
RUN apk add --no-cache \
    tini \
    curl \
    git \
    libc6-compat \
    python3 \
    make \
    g++ \
    && corepack enable pnpm \
    && corepack prepare pnpm@latest --activate

ENTRYPOINT ["/sbin/tini", "--"]

# === BUILD STAGE ===
FROM base AS builder
WORKDIR /app

# Copy entire frontend application
COPY . ./
COPY .env.docker .env

# Environment variables for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install all dependencies including dev dependencies for build
RUN pnpm install --no-frozen-lockfile
RUN ls -ila
# Build the application
RUN pnpm next build

# === PRODUCTION STAGE ===
FROM base AS runner
WORKDIR /app

# Runtime environment variables
ARG NODE_ENV=production
ARG PORT=3100
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION=true
ARG NEXT_PUBLIC_USE_API_TRANSLATION_ONLY=true

ENV NODE_ENV=${NODE_ENV}
ENV PORT=${PORT}
ENV HOSTNAME=0.0.0.0
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_TELEMETRY_DISABLED=${NEXT_TELEMETRY_DISABLED}
ENV NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION=${NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION}
ENV NEXT_PUBLIC_USE_API_TRANSLATION_ONLY=${NEXT_PUBLIC_USE_API_TRANSLATION_ONLY}

# Create system user and logs directory
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S -G nodejs nextjs && \
    mkdir -p logs && \
    chown -R nextjs:nodejs logs

# Copy built application and shared libraries
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/shared ./shared
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs package.json ./
COPY .env.docker .env

USER nextjs

EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://0.0.0.0:${PORT}', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "server.js"]
