# Translator Dockerfile - Meeshy FastAPI Service (Optimized for ML)
FROM python:3.12-slim

# === MAINTAINER INFORMATION ===
LABEL maintainer="Meeshy Development Team <dev@meeshy.com>" \
      description="Meeshy Translator - FastAPI Service with ML Models" \
      version="1.0.0" \
      org.opencontainers.image.source="https://github.com/jcnm/meeshy/translator" \
      org.opencontainers.image.documentation="https://docs.meeshy.com/translator" \
      org.opencontainers.image.vendor="Meeshy" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.title="Meeshy Translator" \
      org.opencontainers.image.description="FastAPI translation service with ML models for Meeshy platform"

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
    # OPTIMISATION ML: Variables d'environnement pour PyTorch
    PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:128 \
    OMP_NUM_THREADS=4 \
    MKL_NUM_THREADS=4 \
    NUMEXPR_NUM_THREADS=4 \
    TOKENIZERS_PARALLELISM=false

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
ARG ML_BATCH_SIZE=4
ARG GPU_MEMORY_FRACTION=0.8
ARG TRANSLATION_TIMEOUT=60
ARG CONCURRENT_TRANSLATIONS=5
ARG WORKERS=2
ARG TRANSLATION_WORKERS=4
ARG PRISMA_POOL_SIZE=15
ARG CACHE_MAX_ENTRIES=10000
ARG AUTO_DETECT_LANGUAGE=true
ARG AUTO_CLEANUP_CORRUPTED_MODELS=true
ARG FORCE_MODEL_REDOWNLOAD=false
ARG TRANSLATION_CACHE_TTL=3600
ARG NORMAL_POOL_SIZE=10000
ARG ANY_POOL_SIZE=10000
ARG NORMAL_WORKERS=2
ARG ANY_WORKERS=1

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

# OPTIMISATION: Installation en une seule layer avec cleanup et optimisations ML
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        wget \
        unzip \
        gnupg \
        tini \
        curl \
        git \
        # OPTIMISATION ML: Dépendances système pour PyTorch (sans libatlas-base-dev obsolète)
        libopenblas-dev \
        liblapack-dev \
        gfortran \
        pkg-config \
        # OPTIMISATION: Outils PostgreSQL pour les migrations Prisma
        postgresql-client \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g pnpm@${PNPM_VERSION} prisma \
    && groupadd -g 1001 translator \
    && useradd -u 1001 -g translator -m translator \
    && mkdir -p /app/{logs,cache,models,shared,generated} \
    && chown -R translator:translator /app \
    # OPTIMISATION: Nettoyage pour réduire la taille de l'image
    && apt-get purge -y --auto-remove build-essential wget unzip gnupg curl git \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && npm cache clean --force

WORKDIR /app

# Copie des fichiers de dépendances d'abord (pour le cache Docker)
COPY --chown=translator:translator requirements.txt ./
COPY --chown=translator:translator .env.docker ./.env

# OPTIMISATION: Installation des dépendances Python avec optimisations ML
RUN pip install --upgrade pip --no-cache-dir \
    && pip install --no-cache-dir prisma python-dotenv \
    # OPTIMISATION ML: Installation de PyTorch CPU optimisé
    && pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu \
    && pip install --default-timeout=300 --no-cache-dir -r requirements.txt \
    && rm -rf ~/.cache/pip

# Copie du code source et du schéma Prisma
COPY --chown=translator:translator . .

# Copie du dossier shared pour les migrations Prisma
COPY --chown=translator:translator ../shared ./shared

# OPTIMISATION: Génération du client Prisma pendant le build (après installation des dépendances)
RUN echo "🔧 Génération du client Prisma..." \
    && mkdir -p /app/generated \
    && chown -R translator:translator /app/generated \
    && npx prisma@5.17.0 generate --schema=./shared/prisma/schema.prisma \
    && chown -R translator:translator /app/generated \
    && echo "✅ Client Prisma généré avec succès"

# OPTIMISATION: Pré-téléchargement des modèles ML de base
RUN echo "🤖 Pré-téléchargement des modèles ML de base..." \
    && python3 -c "import os; from transformers import AutoTokenizer, AutoModelForSeq2SeqLM; import torch; print('📥 Téléchargement t5-small...'); tokenizer = AutoTokenizer.from_pretrained('t5-small', cache_dir='/app/models'); model = AutoModelForSeq2SeqLM.from_pretrained('t5-small', cache_dir='/app/models'); print('✅ t5-small téléchargé avec succès'); del tokenizer, model; torch.cuda.empty_cache() if torch.cuda.is_available() else None" || echo "⚠️ Pré-téléchargement des modèles échoué (normal au build)"

# OPTIMISATION: Configuration des permissions et optimisation finale
RUN chown -R translator:translator /app \
    && chmod +x /app/docker-diagnostic.sh \
    && chmod +x /app/docker-entrypoint.sh \
    && python3 -m compileall /app/src \
    && find /app -name '*.pyc' -delete

# OPTIMISATION: Utilisateur non-root pour la sécurité
USER translator

# OPTIMISATION: Point d'entrée avec gestion d'erreurs
ENTRYPOINT ["/usr/bin/tini", "--"]

# OPTIMISATION: Commande de démarrage avec migrations Prisma
CMD ["/app/docker-entrypoint.sh"]