#!/bin/bash

# Script pour résoudre le conflit de variables d'environnement Prisma

echo "🔧 Résolution du conflit Prisma..."

# Sauvegarder les variables d'environnement actuelles
export OLD_REDIS_URL=$REDIS_URL

# Définir temporairement les variables pour Prisma
export REDIS_URL="redis://localhost:6379"

# Générer le client Prisma
echo "✅ Génération du client Prisma..."
prisma generate --schema=../shared/schema.prisma

# Restaurer les variables d'origine
export REDIS_URL=$OLD_REDIS_URL

echo "✅ Conflit résolu !"

