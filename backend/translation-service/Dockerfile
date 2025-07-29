# ===== DOCKERFILE TRANSLATION SERVICE =====
FROM python:3.11-slim AS builder

# Installation des dépendances système
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copie des requirements
COPY translation-service/requirements.txt .

# Installation des dépendances Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ===== STAGE PRODUCTION =====
FROM python:3.11-slim AS production

# Installation des dépendances système pour la production
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Création de l'utilisateur non-root
RUN groupadd -r translator && useradd -r -g translator translator

WORKDIR /app

# Copie des dépendances depuis le builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copie du code source
COPY --chown=translator:translator translation-service/src/ ./src/
COPY --chown=translator:translator translation-service/translation_server.py ./
COPY --chown=translator:translator translation-service/translation.proto ./
COPY --chown=translator:translator shared/proto/ ./proto/

# Création des dossiers nécessaires
RUN mkdir -p models logs cache && \
    chown -R translator:translator models logs cache

# Variables d'environnement
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV GRPC_PORT=50051
ENV MODEL_CACHE_DIR=/app/models
ENV SUPPORTED_LANGUAGES="fr,en,es,de,pt,zh,ja,ar"
ENV MAX_TEXT_LENGTH=5000
ENV DEFAULT_MODEL="nllb-200-distilled-600M"
ENV DEVICE=cpu

# Exposition du port gRPC
EXPOSE 50051

# Changement vers l'utilisateur non-root
USER translator

# Health check gRPC
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python3 -c "import grpc; channel = grpc.insecure_channel('localhost:50051'); channel.close()" || exit 1

# Point d'entrée
CMD ["python3", "translation_server.py"]
