# Gateway Dockerfile - Simplified with local libs approach
FROM node:22-alpine AS base

# Install pnpm and system dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache tini curl
ENTRYPOINT ["/sbin/tini", "--"]

# === DEPENDENCIES STAGE ===
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

# === BUILD STAGE ===
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code including libs
COPY . ./

# Install dev dependencies for TypeScript compilation
RUN pnpm add -D typescript tsx @types/node @types/jest @types/uuid @types/jsonwebtoken @types/ws

# Create simple tsconfig for compilation
RUN echo '{"compilerOptions":{"target":"ES2020","module":"commonjs","strict":false,"esModuleInterop":true,"skipLibCheck":true,"outDir":"./dist","resolveJsonModule":true}}' > tsconfig.json

# Build the application
RUN npx tsc

# === PRODUCTION STAGE ===
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create system user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 gateway

# Copy built application
COPY --from=builder --chown=gateway:nodejs /app/dist ./dist
COPY --from=builder --chown=gateway:nodejs /app/libs ./libs
COPY --from=deps --chown=gateway:nodejs /app/node_modules ./node_modules
COPY --chown=gateway:nodejs package.json ./

USER gateway

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
