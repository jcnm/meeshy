# Frontend Dockerfile - Production Ready with Node.js 22
FROM node:22-alpine AS base

# Install pnpm and system dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# === DEPENDENCIES STAGE ===
FROM base AS deps
WORKDIR /app

# Copy package files for frontend
COPY frontend/package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile --prod

# === BUILDER STAGE ===
FROM base AS builder
WORKDIR /app

# Copy over the node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the application source
COPY frontend/ .

# Install all dev dependencies for build (including TailwindCSS)
RUN pnpm install --no-frozen-lockfile

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# === PRODUCTION STAGE ===
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create system user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3100
ENV PORT=3100

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3100', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "server.js"]