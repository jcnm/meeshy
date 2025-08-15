# Translator Dockerfile - Meeshy FastAPI Service (Optimized)
FROM python:3.12-slim

# Configuration des arguments de build
ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_VERSION=22
ARG PNPM_VERSION=latest

# Variables d'environnement pour l'application
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

# Variables d'environnement configurables via build args
ARG GRPC_HOST=0.0.0.0
ARG GRPC_PORT=50051
ARG HTTP_PORT=8000
ARG FASTAPI_PORT=8000
ARG ZMQ_PUSH_PORT=5555
ARG ZMQ_SUB_PORT=5558
ARG LOG_LEVEL=info
ARG DEBUG=false
ARG SUPPORTED_LANGUAGES="fr,en,es,de,pt,zh,ja,ar"
ARG DEFAULT_LANGUAGE=fr
ARG MAX_TEXT_LENGTH=5000
ARG BASIC_MODEL=t5-small
ARG MEDIUM_MODEL=nllb-200-distilled-600M
ARG PREMIUM_MODEL=nllb-200-distilled-1.3B
ARG DEVICE=cpu
ARG ML_BATCH_SIZE=32
ARG GPU_MEMORY_FRACTION=0.8
ARG TRANSLATION_TIMEOUT=30
ARG CONCURRENT_TRANSLATIONS=10
ARG WORKERS=4
ARG TRANSLATION_WORKERS=10
ARG PRISMA_POOL_SIZE=15
ARG CACHE_MAX_ENTRIES=10000
ARG AUTO_DETECT_LANGUAGE=true
ARG AUTO_CLEANUP_CORRUPTED_MODELS=true
ARG FORCE_MODEL_REDOWNLOAD=false
ARG TRANSLATION_CACHE_TTL=3600
ARG NORMAL_POOL_SIZE=10000
ARG ANY_POOL_SIZE=10000
ARG NORMAL_WORKERS=3
ARG ANY_WORKERS=2

# Configuration des variables d'environnement depuis les args
ENV GRPC_HOST=${GRPC_HOST} \
    GRPC_PORT=${GRPC_PORT} \
    HTTP_PORT=${HTTP_PORT} \
    FASTAPI_PORT=${FASTAPI_PORT} \
    ZMQ_PUSH_PORT=${ZMQ_PUSH_PORT} \
    ZMQ_SUB_PORT=${ZMQ_SUB_PORT} \
    LOG_LEVEL=${LOG_LEVEL} \
    DEBUG=${DEBUG} \
    SUPPORTED_LANGUAGES=${SUPPORTED_LANGUAGES} \
    DEFAULT_LANGUAGE=${DEFAULT_LANGUAGE} \
    MAX_TEXT_LENGTH=${MAX_TEXT_LENGTH} \
    BASIC_MODEL=${BASIC_MODEL} \
    MEDIUM_MODEL=${MEDIUM_MODEL} \
    PREMIUM_MODEL=${PREMIUM_MODEL} \
    DEVICE=${DEVICE} \
    ML_BATCH_SIZE=${ML_BATCH_SIZE} \
    GPU_MEMORY_FRACTION=${GPU_MEMORY_FRACTION} \
    TRANSLATION_TIMEOUT=${TRANSLATION_TIMEOUT} \
    CONCURRENT_TRANSLATIONS=${CONCURRENT_TRANSLATIONS} \
    WORKERS=${WORKERS} \
    TRANSLATION_WORKERS=${TRANSLATION_WORKERS} \
    PRISMA_POOL_SIZE=${PRISMA_POOL_SIZE} \
    CACHE_MAX_ENTRIES=${CACHE_MAX_ENTRIES} \
    AUTO_DETECT_LANGUAGE=${AUTO_DETECT_LANGUAGE} \
    AUTO_CLEANUP_CORRUPTED_MODELS=${AUTO_CLEANUP_CORRUPTED_MODELS} \
    FORCE_MODEL_REDOWNLOAD=${FORCE_MODEL_REDOWNLOAD} \
    TRANSLATION_CACHE_TTL=${TRANSLATION_CACHE_TTL} \
    NORMAL_POOL_SIZE=${NORMAL_POOL_SIZE} \
    ANY_POOL_SIZE=${ANY_POOL_SIZE} \
    NORMAL_WORKERS=${NORMAL_WORKERS} \
    ANY_WORKERS=${ANY_WORKERS}

# Installation en une seule layer avec cleanup
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        wget \
        unzip \
        gnupg \
        tini \
        curl \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g pnpm@${PNPM_VERSION} prisma \
    && groupadd -g 1001 translator \
    && useradd -u 1001 -g translator -m translator \
    && mkdir -p /app/{logs,cache,models,shared} \
    && chown -R translator:translator /app \
    && apt-get purge -y --auto-remove build-essential wget unzip gnupg curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && npm cache clean --force

WORKDIR /app

# Copie des fichiers de dépendances d'abord (pour le cache Docker)
COPY --chown=translator:translator requirements.txt ./
COPY --chown=translator:translator .env.docker ./.env

# Installation des dépendances Python en une seule layer
RUN pip install --upgrade pip --no-cache-dir \
    && pip install --no-cache-dir prisma python-dotenv \
    && pip install --default-timeout=300 --no-cache-dir -r requirements.txt \
    && rm -rf ~/.cache/pip

# Copie du code source et du schéma Prisma
COPY --chown=translator:translator src/ ./src/
COPY --chown=translator:translator shared/ ./shared/
COPY --chown=translator:translator start_service.py ./

# Génération du client Prisma (conditionnel)
RUN if [ -f shared/prisma/schema.prisma ]; then \
        echo "✅ Génération du client Prisma..." \
        && cp shared/prisma/schema.prisma ./schema.prisma \
        && prisma generate; \
    else \
        echo "⚠️  Schema Prisma non trouvé, génération ignorée"; \
    fi

# Configuration finale des permissions
RUN chown -R translator:translator /app \
    && chmod -R 755 /app/models

USER translator

EXPOSE ${HTTP_PORT} ${GRPC_PORT} ${ZMQ_PUSH_PORT} ${ZMQ_SUB_PORT}

ENTRYPOINT ["/usr/bin/tini", "--"]

# Health check optimisé
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python3 -c "import requests; requests.get(f'http://localhost:{os.getenv(\"HTTP_PORT\", \"8000\")}/health', timeout=5)" || exit 1

CMD ["python3", "start_service.py"]