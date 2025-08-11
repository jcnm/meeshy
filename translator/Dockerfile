# Translator Dockerfile - Meeshy FastAPI Service (Autonomous Build)
FROM python:3.12-slim AS base

# Install system dependencies including GPU support and Node.js for Prisma
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    protobuf-compiler \
    wget \
    unzip \
    gnupg \
    tini \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

ENTRYPOINT ["/usr/bin/tini", "--"]

# === BUILD STAGE ===
FROM base AS builder
WORKDIR /app

# Copy entire translator application (including shared that was pre-copied)
COPY . ./
COPY .env.docker .env

# Environment variables for build
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
RUN rm -rf /app/.venv /app/venv
# Install Python dependencies and generate Prisma client
RUN pip install --upgrade pip && \
    pip install --no-cache-dir prisma python-dotenv && \
    pip install --default-timeout=300 --no-cache-dir -r requirements.txt

# Copy schema.prisma and generate Prisma Python client
COPY schema.prisma ./
RUN prisma generate

# Install Node.js dependencies for shared libraries if needed
RUN if [ -f shared/package.json ]; then \
        cd shared && pnpm install --no-frozen-lockfile && pnpm run generate; \
    fi

# === PRODUCTION STAGE ===
FROM base AS runner
WORKDIR /app

# Runtime environment variables
ARG DATABASE_URL
ARG REDIS_URL
ARG PYTHONPATH=/app
ARG PYTHONUNBUFFERED=1
ARG GRPC_HOST=0.0.0.0
ARG GRPC_PORT=50051
ARG HTTP_PORT=8000
ARG ZMQ_PORT=5555
ARG LOG_LEVEL=info
ARG SUPPORTED_LANGUAGES="fr,en,es,de,pt,zh,ja,ar"
ARG DEFAULT_LANGUAGE=fr
ARG MAX_TEXT_LENGTH=5000
ARG BASIC_MODEL=t5-small
ARG MEDIUM_MODEL=nllb-200-distilled-600M
ARG PREMIUM_MODEL=nllb-200-distilled-1.3B
ARG DEVICE=cpu
ARG ML_BATCH_SIZE=8
ARG GPU_MEMORY_FRACTION=0.8
ARG TRANSLATION_TIMEOUT=30
ARG CONCURRENT_TRANSLATIONS=10
ARG WORKERS=4
ARG AUTO_CLEANUP_CORRUPTED_MODELS=true
ARG FORCE_MODEL_REDOWNLOAD=false
ARG TRANSLATION_CACHE_TTL=3600

ENV DATABASE_URL=${DATABASE_URL}
ENV REDIS_URL=${REDIS_URL}
ENV PYTHONPATH=${PYTHONPATH}
ENV PYTHONUNBUFFERED=${PYTHONUNBUFFERED}
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV GRPC_HOST=${GRPC_HOST}
ENV GRPC_PORT=${GRPC_PORT}
ENV HTTP_PORT=${HTTP_PORT}
ENV ZMQ_PORT=${ZMQ_PORT}
ENV LOG_LEVEL=${LOG_LEVEL}
ENV CACHE_DIR=/app/cache
ENV LOG_DIR=/app/logs
ENV MODELS_PATH=/app/models
ENV MODEL_DIR=/app/models
ENV MODEL_CACHE_DIR=/app/models
ENV TORCH_HOME=/app/models
ENV HF_HOME=/app/models
ENV TRANSFORMERS_CACHE=/app/models
ENV SUPPORTED_LANGUAGES=${SUPPORTED_LANGUAGES}
ENV DEFAULT_LANGUAGE=${DEFAULT_LANGUAGE}
ENV MAX_TEXT_LENGTH=${MAX_TEXT_LENGTH}
ENV BASIC_MODEL=${BASIC_MODEL}
ENV MEDIUM_MODEL=${MEDIUM_MODEL}
ENV PREMIUM_MODEL=${PREMIUM_MODEL}
ENV DEVICE=${DEVICE}
ENV ML_BATCH_SIZE=${ML_BATCH_SIZE}
ENV GPU_MEMORY_FRACTION=${GPU_MEMORY_FRACTION}
ENV TRANSLATION_TIMEOUT=${TRANSLATION_TIMEOUT}
ENV CONCURRENT_TRANSLATIONS=${CONCURRENT_TRANSLATIONS}
ENV WORKERS=${WORKERS}
ENV AUTO_CLEANUP_CORRUPTED_MODELS=${AUTO_CLEANUP_CORRUPTED_MODELS}
ENV FORCE_MODEL_REDOWNLOAD=${FORCE_MODEL_REDOWNLOAD}
ENV TRANSLATION_CACHE_TTL=${TRANSLATION_CACHE_TTL}

# Create system user and logs directory
RUN groupadd -g 1001 translator && \
    useradd -u 1001 -g translator translator && \
    mkdir -p logs cache models && \
    chown -R translator:translator logs cache models

# Copy built application and dependencies including generated Prisma client
COPY --from=builder --chown=translator:translator /app/src ./src
COPY --from=builder --chown=translator:translator /app/start_service.py ./start_service.py
COPY --from=builder --chown=translator:translator /app/models ./models
COPY --from=builder --chown=translator:translator /app/shared ./shared
COPY --from=builder --chown=translator:translator /app/schema.prisma ./schema.prisma
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --chown=translator:translator requirements.txt ./
COPY .env.docker .env

# Ensure models directory has correct permissions
RUN chown -R translator:translator models && \
    chmod -R 755 models

USER translator

EXPOSE ${HTTP_PORT} ${GRPC_PORT} ${ZMQ_PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=120s --retries=5 \
    CMD python3 -c "import requests; requests.get('http://localhost:${HTTP_PORT}/health', timeout=10)" || exit 1

CMD ["python3", "start_service.py"]