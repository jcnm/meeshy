#!/bin/bash

# Script de démarrage simplifié pour l'environnement local
set -e

echo "🚀 Démarrage de l'environnement Meeshy en local (version simplifiée)..."

# Variables d'environnement pour le développement local
export DATABASE_TYPE=MONGODB
export DATABASE_URL="mongodb://meeshy:MeeshyPassword123@database:27017/meeshy?authSource=admin"
export PRISMA_SCHEMA_PATH="./shared/schema.prisma"

# URLs pour le frontend
export NEXT_PUBLIC_API_URL="http://meeshy.me/api"
export NEXT_PUBLIC_TRANSLATION_URL="http://meeshy.me/translate"
export NEXT_PUBLIC_WS_URL="ws://meeshy.me/api/ws"

# Environnement
export NODE_ENV="development"

# URLs de base de données corrigées
export REDIS_URL="redis://redis:6379"
export TRANSLATOR_URL="http://translator:8000"
export ZMQ_PUSH_URL="tcp://translator:5555"
export ZMQ_SUB_URL="tcp://translator:5558"

echo "📋 Variables d'environnement configurées:"
echo "  DATABASE_TYPE: $DATABASE_TYPE"
echo "  DATABASE_URL: ${DATABASE_URL/\/\/.*@/\/\/***@}"

echo "🐳 Démarrage des services de base (database, redis)..."
docker-compose up -d database redis

echo "⏳ Attente du démarrage des services de base..."
sleep 10

echo "📊 Statut des services de base:"
docker-compose ps database redis

echo ""
echo "✅ Services de base démarrés !"
echo "🌐 URLs d'accès:"
echo "  Database: mongodb://localhost:27017"
echo "  Redis: redis://localhost:6379"
echo ""
echo "💡 Pour démarrer les autres services, utilisez:"
echo "  docker-compose up -d translator"
echo "  docker-compose up -d gateway"
echo "  docker-compose up -d frontend"
