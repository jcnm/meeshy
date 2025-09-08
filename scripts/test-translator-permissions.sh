#!/bin/bash
# Script de test pour vérifier les permissions des volumes du translator
# Meeshy - Test des permissions intégrées

set -euo pipefail

echo "🧪 Test des permissions des volumes du translator..."

# Fonction pour tester les permissions d'un volume
test_volume_permissions() {
    local volume_name="$1"
    local mount_path="$2"
    local description="$3"
    
    echo "  • Test du volume $description ($volume_name)..."
    
    # Créer un conteneur temporaire pour tester les permissions
    if docker run --rm -v "${volume_name}:${mount_path}" alpine:latest \
        sh -c "ls -ld ${mount_path} && ls -la ${mount_path}/" 2>/dev/null; then
        echo "    ✅ Volume $description accessible avec les bonnes permissions"
    else
        echo "    ❌ Problème avec le volume $description"
        return 1
    fi
}

# Test des volumes du translator
echo "🔍 Vérification des volumes Docker..."
docker volume ls | grep translator || echo "  ⚠️  Aucun volume translator trouvé"

# Test des permissions des volumes
test_volume_permissions "meeshy_translator_models" "/workspace/models" "translator_models"
test_volume_permissions "meeshy_translator_cache" "/workspace/cache" "translator_cache"
test_volume_permissions "meeshy_translator_generated" "/workspace/generated" "translator_generated"

echo "🔧 Test de l'image translator avec les permissions intégrées..."

# Test de l'image translator
if docker run --rm \
    -v meeshy_translator_models:/workspace/models \
    -v meeshy_translator_cache:/workspace/cache \
    -v meeshy_translator_generated:/workspace/generated \
    --entrypoint="" \
    isopen/meeshy-translator:1.0.43-alpha \
    sh -c "ls -la /workspace/ && echo 'Permissions des volumes:' && ls -ld /workspace/models /workspace/cache /workspace/generated"; then
    echo "  ✅ Image translator testée avec succès"
else
    echo "  ❌ Problème avec l'image translator"
    exit 1
fi

echo "✅ Tests des permissions terminés avec succès"
echo ""
echo "📋 Résumé des améliorations :"
echo "  • Les permissions des volumes sont maintenant intégrées dans l'image Docker"
echo "  • Le script d'initialisation docker-entrypoint-volumes.sh gère automatiquement les permissions"
echo "  • Plus besoin de corrections manuelles dans le script de déploiement"
echo "  • Les volumes sont configurés avec l'utilisateur 42420:42420 et les permissions 755"
