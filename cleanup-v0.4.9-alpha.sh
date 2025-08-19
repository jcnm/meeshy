#!/bin/bash

# Script de nettoyage pour Meeshy v0.4.9-alpha
# Supprime les conteneurs, images, volumes et fichiers temporaires

set -e

VERSION="0.4.9-alpha"
REGISTRY="isopen"

echo "🧹 Nettoyage Meeshy v${VERSION}..."

# 1. Arrêter et supprimer les conteneurs
echo "📦 Arrêt des conteneurs..."
docker-compose down --remove-orphans 2>/dev/null || true

# 2. Supprimer les conteneurs spécifiques
echo "🗑️ Suppression des conteneurs..."
docker rm -f translator gateway frontend postgres redis 2>/dev/null || true

# 3. Supprimer les images Docker
echo "🖼️ Suppression des images Docker..."
docker rmi ${REGISTRY}/meeshy-translator:${VERSION} 2>/dev/null || true
docker rmi ${REGISTRY}/meeshy-gateway:${VERSION} 2>/dev/null || true
docker rmi ${REGISTRY}/meeshy-frontend:${VERSION} 2>/dev/null || true
docker rmi ${REGISTRY}/meeshy-translator:latest 2>/dev/null || true
docker rmi ${REGISTRY}/meeshy-gateway:latest 2>/dev/null || true
docker rmi ${REGISTRY}/meeshy-frontend:latest 2>/dev/null || true

# 4. Supprimer les volumes non utilisés
echo "💾 Nettoyage des volumes..."
docker volume prune -f 2>/dev/null || true

# 5. Supprimer les réseaux non utilisés
echo "🌐 Nettoyage des réseaux..."
docker network prune -f 2>/dev/null || true

# 6. Nettoyer les fichiers temporaires
echo "📁 Nettoyage des fichiers temporaires..."
rm -rf test_temp/ 2>/dev/null || true
rm -rf advanced_test_venv/ 2>/dev/null || true
rm -rf test_env/ 2>/dev/null || true
rm -rf venv/ 2>/dev/null || true
rm -rf translator/__pycache__/ 2>/dev/null || true
rm -rf translator/src/__pycache__/ 2>/dev/null || true
rm -rf translator/src/services/__pycache__/ 2>/dev/null || true
rm -rf translator/src/api/__pycache__/ 2>/dev/null || true
rm -rf gateway/node_modules/ 2>/dev/null || true
rm -rf frontend/node_modules/ 2>/dev/null || true
rm -rf frontend/.next/ 2>/dev/null || true
rm -rf node_modules/ 2>/dev/null || true

# 7. Supprimer les fichiers de logs
echo "📝 Nettoyage des logs..."
rm -f logs.txt 2>/dev/null || true
rm -f start-all.log 2>/dev/null || true
rm -f performance_results_*.json 2>/dev/null || true
rm -f translations_log_*.csv 2>/dev/null || true
rm -f translations_readable_*.txt 2>/dev/null || true

# 8. Nettoyer les images Docker non utilisées
echo "🧽 Nettoyage des images non utilisées..."
docker image prune -f 2>/dev/null || true

# 9. Nettoyer le cache Docker
echo "🗂️ Nettoyage du cache Docker..."
docker builder prune -f 2>/dev/null || true

echo "✅ Nettoyage terminé pour Meeshy v${VERSION}"
echo "💡 Pour reconstruire: ./build-and-push-v0.4.9-alpha.sh"
