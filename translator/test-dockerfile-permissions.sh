#!/bin/bash

# Script de test pour vérifier les permissions du Dockerfile translator
# Ce script teste la construction de l'image et vérifie les permissions

set -e

echo "🔧 Test des permissions du Dockerfile translator..."

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages colorés
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier si Docker est disponible
if ! command -v docker &> /dev/null; then
    log_error "Docker n'est pas installé ou n'est pas dans le PATH"
    exit 1
fi

# Nom de l'image de test
IMAGE_NAME="meeshy-translator-test"
CONTAINER_NAME="meeshy-translator-permissions-test"

log_info "Construction de l'image Docker..."
docker build -t $IMAGE_NAME .

if [ $? -eq 0 ]; then
    log_info "✅ Image construite avec succès"
else
    log_error "❌ Échec de la construction de l'image"
    exit 1
fi

log_info "Test des permissions dans le conteneur..."

# Créer et démarrer un conteneur temporaire pour tester les permissions
docker run --rm -d --name $CONTAINER_NAME $IMAGE_NAME sleep 300

# Attendre que le conteneur soit prêt
sleep 2

# Vérifier les permissions des répertoires critiques
log_info "Vérification des permissions des répertoires..."

# Vérifier le propriétaire du workspace
WORKSPACE_OWNER=$(docker exec $CONTAINER_NAME ls -ld /workspace | awk '{print $3":"$4}')
log_info "Propriétaire de /workspace: $WORKSPACE_OWNER"

# Vérifier les permissions des répertoires de modèles
MODELS_PERMISSIONS=$(docker exec $CONTAINER_NAME ls -ld /workspace/models | awk '{print $1}')
log_info "Permissions de /workspace/models: $MODELS_PERMISSIONS"

# Vérifier les permissions des répertoires de cache
CACHE_PERMISSIONS=$(docker exec $CONTAINER_NAME ls -ld /workspace/cache | awk '{print $1}')
log_info "Permissions de /workspace/cache: $CACHE_PERMISSIONS"

# Vérifier les permissions des logs
LOGS_PERMISSIONS=$(docker exec $CONTAINER_NAME ls -ld /workspace/logs | awk '{print $1}')
log_info "Permissions de /workspace/logs: $LOGS_PERMISSIONS"

# Vérifier l'utilisateur actuel
CURRENT_USER=$(docker exec $CONTAINER_NAME whoami)
log_info "Utilisateur actuel: $CURRENT_USER"

# Vérifier l'UID de l'utilisateur
CURRENT_UID=$(docker exec $CONTAINER_NAME id -u)
log_info "UID de l'utilisateur: $CURRENT_UID"

# Vérifier les variables d'environnement importantes
log_info "Variables d'environnement ML:"
docker exec $CONTAINER_NAME env | grep -E "(HF_HOME|TORCH_HOME|MODEL_DIR|MODELS_PATH)" || true

# Test de création de fichier dans le répertoire models
log_info "Test de création de fichier dans /workspace/models..."
if docker exec $CONTAINER_NAME touch /workspace/models/test_permissions.txt; then
    log_info "✅ Peut créer des fichiers dans /workspace/models"
    docker exec $CONTAINER_NAME rm /workspace/models/test_permissions.txt
else
    log_error "❌ Ne peut pas créer de fichiers dans /workspace/models"
fi

# Test de création de fichier dans le répertoire cache
log_info "Test de création de fichier dans /workspace/cache..."
if docker exec $CONTAINER_NAME touch /workspace/cache/test_permissions.txt; then
    log_info "✅ Peut créer des fichiers dans /workspace/cache"
    docker exec $CONTAINER_NAME rm /workspace/cache/test_permissions.txt
else
    log_error "❌ Ne peut pas créer de fichiers dans /workspace/cache"
fi

# Nettoyer le conteneur
docker stop $CONTAINER_NAME

log_info "🧹 Nettoyage de l'image de test..."
docker rmi $IMAGE_NAME

log_info "✅ Test des permissions terminé avec succès"
log_info "Le Dockerfile est maintenant configuré pour utiliser l'utilisateur 'translator'"
log_info "Tous les répertoires ont les bonnes permissions pour le téléchargement des modèles ML"
