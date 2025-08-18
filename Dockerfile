# Meeshy - Docker unique multi-stage avec optimisation
# Build complet de l'application avec nettoyage des caches et fichiers inutiles

# ===== STAGE 1: BASE IMAGE =====
FROM python:3.12-slim AS base

# Définir les arguments de build pour optimiser le cache
ARG NODE_VERSION=22
ARG DEBIAN_FRONTEND=noninteractive
ARG PNPM_VERSION=latest

# Installation en une seule layer avec cleanup
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        wget \
        unzip \
        gnupg \
        tini \
        curl \
        git \
        postgresql-client \
        postgresql \
        redis-server \
        supervisor \
        nginx \
        postgresql-contrib \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g pnpm@${PNPM_VERSION} prisma \
    && apt-get purge -y --auto-remove build-essential wget unzip gnupg curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && npm cache clean --force

# Créer l'utilisateur meeshy
RUN groupadd -g 1001 meeshy && \
    useradd -u 1001 -g meeshy -m -s /bin/bash meeshy

# ===== STAGE 2: SHARED DEPENDENCIES =====
FROM base AS shared-builder
WORKDIR /app/shared

# Copier les fichiers shared (optimisation du cache)
COPY shared/package*.json ./
COPY shared/pnpm-lock.yaml ./
COPY shared/schema.prisma ./

# Installer pnpm et dépendances (cache séparé)
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Générer le client Prisma avec le schéma SQLite (cache séparé)
ENV PRISMA_CLIENT_OUTPUT_DIRECTORY=/app/shared/node_modules/.prisma/client
RUN cp schema.sqlite.prisma schema.prisma && pnpm run generate

# ===== STAGE 3: TRANSLATOR BUILDER =====
FROM base AS translator-builder
WORKDIR /app/translator

# Variables d'environnement pour PyTorch et ML
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    CACHE_DIR=/app/cache \
    LOG_DIR=/app/logs \
    MODELS_PATH=/app/models \
    MODEL_DIR=/app/models \
    MODEL_CACHE_DIR=/app/models \
    TORCH_HOME=/app/models \
    HF_HOME=/app/models \
    TRANSFORMERS_CACHE=/app/models

# Installer les dépendances Python avec timeout étendu pour PyTorch
COPY translator/requirements.txt ./
RUN pip install --upgrade pip --no-cache-dir \
    && pip install --default-timeout=300 --no-cache-dir -r requirements.txt \
    && rm -rf ~/.cache/pip

# Copier le code source
COPY translator/ ./
COPY --from=shared-builder /app/shared ./shared

# Générer le client Prisma Python
RUN if [ -f shared/prisma/schema.prisma ]; then \
        prisma generate --schema=shared/prisma/schema.prisma; \
    fi

# ===== STAGE 4: GATEWAY BUILDER =====
FROM base AS gateway-builder
WORKDIR /app/gateway

# Copier les fichiers de dépendances
COPY gateway/package*.json ./
COPY gateway/pnpm-lock.yaml ./
COPY gateway/tsconfig.json ./

# Installer les dépendances
RUN npm install -g pnpm tsx && \
    pnpm install --frozen-lockfile

# Copier le code source
COPY gateway/ ./
COPY --from=shared-builder /app/shared ./shared

# Générer le client Prisma seulement (pas de compilation TypeScript)
RUN npx prisma generate --schema=./shared/schema.prisma && \
    pnpm install --prod --ignore-scripts && \
    pnpm store prune && \
    rm -rf /tmp/.npm /tmp/.yarn ~/.cache

# ===== STAGE 5: FRONTEND BUILDER =====
FROM base AS frontend-builder
WORKDIR /app/frontend

# Copier les fichiers de dépendances
COPY frontend/package*.json ./
COPY frontend/pnpm-lock.yaml ./
COPY frontend/next.config.ts ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/tsconfig.json ./

# Installer les dépendances
RUN npm install -g pnpm tsx && \
    pnpm install --frozen-lockfile

# Copier le code source
COPY frontend/ ./
COPY --from=shared-builder /app/shared ./shared

# Installation des dépendances de production seulement (pas de build)
RUN pnpm install --prod --ignore-scripts && \
    pnpm store prune && \
    rm -rf /tmp/.npm /tmp/.yarn ~/.cache

# ===== STAGE 6: FINAL IMAGE =====
FROM base AS final
WORKDIR /app

# Créer la structure des répertoires
RUN mkdir -p /app/translator && \
    mkdir -p /app/gateway && \
    mkdir -p /app/frontend && \
    mkdir -p /app/shared && \
    mkdir -p /app/scripts && \
    mkdir -p /app/logs && \
    mkdir -p /app/data && \
    chown -R meeshy:meeshy /app

# Copier les binaires et dépendances
COPY --from=translator-builder --chown=meeshy:meeshy /app/translator /app/translator
COPY --from=gateway-builder --chown=meeshy:meeshy /app/gateway /app/gateway
COPY --from=frontend-builder --chown=meeshy:meeshy /app/frontend /app/frontend
COPY --from=shared-builder --chown=meeshy:meeshy /app/shared /app/shared

# Copier les scripts de démarrage
COPY docker-start.sh /app/docker-start.sh
COPY scripts/ /app/scripts/
RUN chmod +x /app/docker-start.sh && \
    chmod +x /app/scripts/*.sh

# Configuration Supervisor pour gérer tous les services
COPY docker/supervisor/ /etc/supervisor/conf.d/

# Configuration Nginx
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Nettoyage des caches et fichiers inutiles
RUN rm -rf /app/translator/{__pycache__,*.pyc,*.pyo,*.pyd,.pytest_cache,.coverage,htmlcov,.tox,.venv,venv} && \
    rm -rf /app/gateway/{node_modules/.cache,dist,.nyc_output,coverage} && \
    rm -rf /app/frontend/{.next,.cache,node_modules/.cache,coverage} && \
    rm -rf /app/shared/{node_modules/.cache,dist} && \
    find /app -name "*.log" -delete && \
    find /app -name "*.tmp" -delete && \
    find /app -name ".DS_Store" -delete && \
    find /app -name "Thumbs.db" -delete

# Installer tsx et tsconfig-paths globalement dans l'image finale
RUN npm install -g tsx tsconfig-paths

# Copier les dépendances Python depuis le stage translator-builder
COPY --from=translator-builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PORT=3100
ENV GATEWAY_PORT=3000
ENV TRANSLATOR_PORT=8000
ENV POSTGRES_PORT=5432
ENV REDIS_PORT=6379

# Exposer les ports
EXPOSE 3100 3000 8000 5432 6379

# Point d'entrée avec Tini
ENTRYPOINT ["/usr/bin/tini", "--"]

# Commande de démarrage
CMD ["/app/docker-start.sh"]
