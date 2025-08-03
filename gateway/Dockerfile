# Gateway Dockerfile - Production Ready Fastify Service with Node.js 22
FROM node:22-alpine AS base

# Install pnpm and system dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache tini protobuf-dev
ENTRYPOINT ["/sbin/tini", "--"]

# === SHARED DEPENDENCIES ===
FROM base AS shared-deps
WORKDIR /shared
COPY shared/package.json shared/pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile --prod

# === SHARED BUILD ===
FROM shared-deps AS shared-builder
WORKDIR /shared
COPY shared/ ./
RUN pnpm install && pnpm run generate

# === GATEWAY DEPENDENCIES ===
FROM base AS deps
WORKDIR /app
COPY gateway/package.json gateway/pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile --prod

# === BUILD STAGE ===
FROM base AS builder
WORKDIR /workspace

# Create proper directory structure
RUN mkdir -p shared/generated
RUN mkdir -p gateway

# Copy shared generated files to the proper location
COPY --from=shared-builder /shared/generated ./shared/generated
COPY --from=shared-builder /shared/node_modules/@prisma ./shared/node_modules/@prisma

# Copy gateway source to workspace/gateway
COPY --from=deps /app/node_modules ./gateway/node_modules
COPY gateway/ ./gateway/

WORKDIR /workspace/gateway

    # Modify package.json and build (skip installing more dependencies)
    RUN sed -i 's/"prebuild": "cd ..\/shared && npm run generate"/"prebuild": "echo Shared already generated"/' package.json && \
        echo '{"compilerOptions":{"target":"ES2020","module":"commonjs","strict":false,"esModuleInterop":true,"skipLibCheck":true,"outDir":"./dist"}}' > tsconfig.json && \
        npx tsc src/server-clean.ts --outDir dist --target ES2020 --module commonjs --skipLibCheck

# === PRODUCTION STAGE ===
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create system user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 gateway

# Copy shared and built application
COPY --from=shared-builder --chown=gateway:nodejs /shared/generated ./shared/generated
COPY --from=shared-builder --chown=gateway:nodejs /shared/node_modules/@prisma ./shared/node_modules/@prisma
COPY --from=builder --chown=gateway:nodejs /workspace/gateway/dist ./dist
COPY --from=builder --chown=gateway:nodejs /workspace/gateway/node_modules ./node_modules
COPY --from=builder --chown=gateway:nodejs /workspace/gateway/package.json ./

USER gateway

EXPOSE 3000
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

    CMD ["tini", "--", "node", "dist/server-clean.js"]
