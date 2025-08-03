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
WORKDIR /app

# Copy shared generated files
COPY --from=shared-builder /shared/generated ./shared/generated
COPY --from=shared-builder /shared/node_modules/@prisma ./shared/node_modules/@prisma

# Copy gateway source and build
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm add -D typescript tsx @types/node @types/jest @types/uuid @types/jsonwebtoken @types/ws @grpc/grpc-js @grpc/proto-loader nice-grpc zeromq protobufjs fastify @fastify/cors @fastify/helmet @fastify/jwt @fastify/rate-limit @fastify/websocket bcryptjs zod winston uuid jsonwebtoken ws
COPY gateway/ ./
RUN sed -i 's/"prebuild": "cd ..\/shared && npm run generate"/"prebuild": "echo Shared already generated"/' package.json && \
    echo '{"compilerOptions":{"target":"ES2020","module":"commonjs","strict":false,"esModuleInterop":true,"skipLibCheck":true,"outDir":"./dist"}}' > tsconfig.json && \
    pnpm build

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
COPY --from=builder --chown=gateway:nodejs /app/dist ./dist
COPY --from=builder --chown=gateway:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=gateway:nodejs /app/package.json ./

USER gateway

EXPOSE 3000
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/server.js"]
