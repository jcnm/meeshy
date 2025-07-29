# Stage 1: Build stage
FROM node:18-alpine AS builder

# Installer pnpm et des outils de build optimisés
RUN npm install -g pnpm@latest && \
    apk add --no-cache python3 make g++ && \
    npm cache clean --force

# Créer le répertoire de l'application
WORKDIR /app

# Copier les fichiers de package pour optimiser le cache Docker
COPY fastify-service/package*.json fastify-service/pnpm-lock.yaml* ./
COPY fastify-service/tsconfig.json ./

# Installer les dépendances avec pnpm (plus rapide et efficient)
RUN pnpm install --frozen-lockfile --prod=false

# Copier le code source
COPY fastify-service/src/ ./src/
COPY shared/ ./shared/

# Construire l'application avec optimisations
RUN pnpm run build && \
    pnpm prune --prod && \
    pnpm store prune

# Stage 2: Production stage optimisée
FROM node:18-alpine AS production

# Installer dumb-init pour une meilleure gestion des processus
RUN apk add --no-cache dumb-init tini curl

# Créer un utilisateur non-root avec des permissions optimisées
RUN addgroup -g 1001 -S nodejs && \
    adduser -S fastify -u 1001 -G nodejs

# Créer le répertoire de l'application avec les bonnes permissions
WORKDIR /app
RUN chown fastify:nodejs /app

# Changer vers l'utilisateur non-root tôt pour la sécurité
USER fastify

# Copier les fichiers de production depuis le build stage
COPY --from=builder --chown=fastify:nodejs /app/dist ./dist
COPY --from=builder --chown=fastify:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=fastify:nodejs /app/package.json ./package.json

# Copier les fichiers partagés nécessaires
COPY --chown=fastify:nodejs shared/prisma ./shared/prisma
COPY --chown=fastify:nodejs shared/proto ./shared/proto

# Créer les répertoires nécessaires avec les bonnes permissions
USER root
RUN mkdir -p /app/logs /tmp/app-cache && \
    chown -R fastify:nodejs /app/logs /tmp/app-cache
USER fastify

# Exposer le port
EXPOSE 3001

# Optimisations de production Node.js
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=1024 --enable-source-maps" \
    NPM_CONFIG_CACHE=/tmp/app-cache

# Health check optimisé
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Utiliser tini pour une meilleure gestion des signaux et processus zombies
ENTRYPOINT ["tini", "--"]

# Commande de démarrage optimisée
CMD ["node", "--enable-source-maps", "dist/server.js"]
