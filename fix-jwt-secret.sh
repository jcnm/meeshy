#!/bin/bash
# Script pour corriger le JWT_SECRET et autres variables problématiques

DROPLET_IP="$1"
if [ -z "$DROPLET_IP" ]; then
    echo "Usage: $0 DROPLET_IP"
    exit 1
fi

echo "🔧 Correction du JWT_SECRET sur $DROPLET_IP..."

# JWT_SECRET complet (sur une seule ligne)
JWT_SECRET_FULL="JifEemKSYUdbJfSeoGun7egUAj9wbgfNb6EGPgtl6CyjYo070LZ3AAmKyvkjI8VM9fsdywDyoB9FWM56XY4FA"

# Corriger le fichier .env
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "cat > /opt/meeshy/.env << 'EOF'
# ===== MEESHY DIGITALOCEAN DEPLOYMENT CONFIGURATION =====
# Environment variables for DigitalOcean deployment with MongoDB
# Copy this file to .env for production deployment

# ===== DEPLOYMENT ENVIRONMENT =====
NODE_ENV=production
DEBUG=false
LOG_LEVEL=info
DEPLOYMENT_ENV=digitalocean
DEPLOYMENT_REGION=nyc3

# ===== PORTS AND URLS =====
PORT=3000
GATEWAY_PORT=3000
FRONTEND_PORT=3100
TRANSLATION_PORT=8000
GRPC_PORT=50051
ZMQ_PORT=5555

# ===== DATABASE CONFIGURATION =====
DATABASE_URL=mongodb://admin:3x1xfX0z9oOyQ8onWJ8vRybD@database:27017/meeshy?authSource=admin
MONGODB_URL=mongodb://admin:3x1xfX0z9oOyQ8onWJ8vRybD@database:27017/meeshy?authSource=admin
MONGODB_DATABASE=meeshy
MONGODB_USERNAME=admin
MONGODB_PASSWORD=3x1xfX0z9oOyQ8onWJ8vRybD

# ===== REDIS CONFIGURATION =====
REDIS_URL=redis://admin:Qm4175ndn8t6WAH4J69p@redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=Qm4175ndn8t6WAH4J69p

# ===== JWT CONFIGURATION =====
JWT_SECRET=${JWT_SECRET_FULL}
JWT_EXPIRES_IN=7d

# ===== CORS CONFIGURATION =====
CORS_ORIGINS=https://meeshy.me,https://www.meeshy.me,https://gate.meeshy.me,https://ml.meeshy.me,https://traefik.meeshy.me,https://mongo.meeshy.me,https://redis.meeshy.me,http://157.230.15.51
ALLOWED_ORIGINS=https://meeshy.me,https://www.meeshy.me,https://gate.meeshy.me,https://ml.meeshy.me,https://traefik.meeshy.me,https://mongo.meeshy.me,https://redis.meeshy.me,http://157.230.15.51

# ===== FRONTEND CONFIGURATION =====
NEXT_PUBLIC_FRONTEND_URL=https://meeshy.me
NEXT_PUBLIC_BACKEND_URL=https://gate.meeshy.me
NEXT_PUBLIC_WS_URL=wss://gate.meeshy.me
NEXT_PUBLIC_TRANSLATION_URL=https://ml.meeshy.me/translate
NEXT_PUBLIC_API_URL=https://gate.meeshy.me
NEXT_PUBLIC_DISABLE_CLIENT_TRANSLATION=true
NEXT_PUBLIC_USE_API_TRANSLATION_ONLY=true
NEXT_PUBLIC_DEBUG_LOGS=false

# ===== INTERNAL URLS (for SSR) =====
INTERNAL_BACKEND_URL=http://gateway:3000
INTERNAL_WS_URL=ws://gateway:3000

# ===== TRANSLATION SERVICE =====
FASTAPI_PORT=8000
TRANSLATION_CACHE_TTL=3600
CACHE_MAX_ENTRIES=10000

# ===== AUTHENTICATION HASHES =====
TRAEFIK_USERS=admin:\$2y\$05\$57BhDUlXTrcEebSStNqQ3.645jJOMP0PRjpXF23opyIv1euCPEN1W
API_USERS=admin:\$2y\$05\$FAZ6qJKKgidBFVCY.RzeXuAmvOekUtmk.bPJIuU/rknG5N4F7nwi.
MONGO_USERS=admin:\$2y\$05\$EkGYl6oTdxKa2pmOteEQL.EQ62b.T6uMHWWlfTg7KuX5WsjRy.YL.
REDIS_USERS=admin:\$2y\$05\$fzDuH6VLfghQBsoV09cl8.C/C5JXuBPsi76.knBfMHmMAQtzFfnx6

# ===== USER PASSWORDS =====
ADMIN_PASSWORD=xYipoticeNIp0PwBYk7Z
MEESHY_PASSWORD=mtMlICIB30hM1tW214tk
ATABETH_PASSWORD=IUaAasGtFD8QrXixxdWz

# ===== EMAIL CONFIGURATION =====
ADMIN_EMAIL=admin@meeshy.me
MEESHY_EMAIL=meeshy@meeshy.me
ATABETH_EMAIL=atabeth@meeshy.me
SUPPORT_EMAIL=support@meeshy.me
FEEDBACK_EMAIL=feedback@meeshy.me

# ===== DOMAIN CONFIGURATION =====
DOMAIN=meeshy.me

# ===== USER CONFIGURATION =====
ADMIN_USERNAME=admin
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=Manager
ADMIN_ROLE=ADMIN
ADMIN_SYSTEM_LANGUAGE=es
ADMIN_REGIONAL_LANGUAGE=de
ADMIN_CUSTOM_DESTINATION_LANGUAGE=zh

MEESHY_USERNAME=meeshy
MEESHY_FIRST_NAME=Meeshy
MEESHY_LAST_NAME=Sama
MEESHY_ROLE=BIGBOSS
MEESHY_SYSTEM_LANGUAGE=en
MEESHY_REGIONAL_LANGUAGE=fr
MEESHY_CUSTOM_DESTINATION_LANGUAGE=pt

ATABETH_USERNAME=atabeth
ATABETH_FIRST_NAME=André
ATABETH_LAST_NAME=Tabeth
ATABETH_ROLE=USER
ATABETH_SYSTEM_LANGUAGE=fr
ATABETH_REGIONAL_LANGUAGE=fr
ATABETH_CUSTOM_DESTINATION_LANGUAGE=en

# ===== DATABASE RESET =====
FORCE_DB_RESET=true
EOF"

echo "✅ Fichier .env corrigé avec JWT_SECRET complet"
echo "🔄 Redémarrage des services..."

# Redémarrer les services
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker-compose -f /opt/meeshy/docker-compose.yml restart gateway frontend"

echo "✅ Services redémarrés"
echo "🔍 Vérification du JWT_SECRET..."

# Vérifier que le JWT_SECRET est correct
sleep 10
JWT_CHECK=$(ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker exec meeshy-gateway env | grep JWT_SECRET")
echo "JWT_SECRET dans le container: $JWT_CHECK"

if [[ "$JWT_CHECK" == *"JifEemKSYUdbJfSeoGun7egUAj9wbgfNb6EGPgtl6CyjYo070LZ3AAmKyvkjI8VM9fsdywDyoB9FWM56XY4FA"* ]]; then
    echo "✅ JWT_SECRET correctement configuré"
else
    echo "❌ JWT_SECRET incorrect ou manquant"
fi
