# Translator Dockerfile - Production Ready FastAPI Service with Python 3.12
FROM python:3.12-slim AS base

# Install system dependencies including GPU support
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    protobuf-compiler \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# === DEPENDENCIES STAGE ===
FROM base AS deps
WORKDIR /app

# Copy requirements and install Python dependencies
COPY translator/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# === PRODUCTION STAGE ===
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN groupadd -r translator && useradd -r -g translator translator

# Copy Python dependencies
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Create necessary directories FIRST
RUN mkdir -p logs cache models src proto && \
    chown -R translator:translator logs cache models src proto

# Copy application code and models with correct ownership
COPY --chown=translator:translator translator/src/ ./src/
COPY --chown=translator:translator translator/main.py ./main.py
COPY --chown=translator:translator translator/models/ ./models/
COPY --chown=translator:translator shared/proto/ ./proto/

# Ensure models directory has correct permissions and content
RUN ls -la ./models/ && \
    chown -R translator:translator models && \
    chmod -R 755 models

# Environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1
ENV GRPC_PORT=50051
ENV HTTP_PORT=8000
ENV ZMQ_PORT=5555
ENV LOG_LEVEL=info
ENV CACHE_DIR=/app/cache
ENV LOG_DIR=/app/logs
ENV MODELS_PATH=/app/models
ENV MODEL_DIR=/app/models
ENV MODEL_CACHE_DIR=/app/models
ENV SUPPORTED_LANGUAGES="fr,en,es,de,pt,zh,ja,ar"
ENV MAX_TEXT_LENGTH=5000
ENV TORCH_HOME=/app/models
ENV HF_HOME=/app/models
ENV TRANSFORMERS_CACHE=/app/models

# Switch to non-root user
USER translator

EXPOSE 8000 50051 5555

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=120s --retries=5 \
    CMD python3 -c "import requests; requests.get('http://localhost:8000/health', timeout=10)" || exit 1

CMD ["python3", "main.py"]
