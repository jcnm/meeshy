#!/bin/bash

# Cleanup Old Scripts for Meeshy
# Removes obsolete scripts and renames them to generic names

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Nettoyage des anciens scripts Meeshy${NC}"
echo -e "${BLUE}=====================================${NC}"

# Liste des scripts à supprimer (obsolètes)
SCRIPTS_TO_DELETE=(
    "build-and-push-0.5.1-alpha.sh"
    "build-and-push-v0.4.9-alpha.sh"
    "build-and-push-v0.4.8-alpha.sh"
    "cleanup-v0.4.9-alpha.sh"
    "test-translator-debug.sh"
    "test-unified-fix.sh"
    "test-unified-simple.sh"
    "build-and-test-unified.sh"
    "test-performance-real.sh"
    "test-venv-simple.sh"
    "test-performance-venv.sh"
    "test-with-venv.sh"
    "test-quantization-performance.py"
    "test-quantized-service.py"
    "build-and-test-optimized.sh"
    "test-zmq-translator.py"
    "test-translator-only.sh"
    "test-stress-translator.py"
    "restart-dev.sh"
    "stop-dev.sh"
    "start-dev.sh"
    "run-internal.sh"
    "debug-container.sh"
    "test-all-modes.sh"
    "start-with-external-db.sh"
    "test-services.sh"
    "start-meeshy-docker.sh"
    "build-and-run-unique-docker.sh"
    "build-and-push-docker-images.sh"
    "test-links-security.sh"
    "test-auth-debug.sh"
    "start_and_monitor.sh"
    "monitor_services.sh"
    "build-docker-images.sh"
    "check-meeshy.sh"
    "kill-all-meeshy.sh"
    "start-all.sh"
    "start_meeshy_services.sh"
    "start_services_simple.sh"
    "test_cleanup.sh"
    "monitor_logs.sh"
)

# Liste des fichiers à supprimer (obsolètes)
FILES_TO_DELETE=(
    "V0.4.9-ALPHA_DEPLOYMENT_SUMMARY.md"
    "RELEASE_NOTES_v0.4.9-alpha.md"
    "env.docker"
    "env.internal.tmp"
    "docker-compose.dev.yml"
    "Dockerfile.dev"
    "docker-compose.external.yml"
    "docker-start.sh"
    "env.docker.external"
    "debug-auth.html"
    "test-login.html"
    "start-all.log"
    "COMPTES_DE_TEST.md"
)

# Fonction pour supprimer un fichier
delete_file() {
    local file=$1
    if [ -f "$file" ]; then
        rm -f "$file"
        echo -e "${GREEN}✅ Supprimé: $file${NC}"
    else
        echo -e "${YELLOW}⚠️  Non trouvé: $file${NC}"
    fi
}

# Supprimer les scripts obsolètes
echo -e "${BLUE}🗑️  Suppression des scripts obsolètes...${NC}"
for script in "${SCRIPTS_TO_DELETE[@]}"; do
    delete_file "$script"
done

# Supprimer les fichiers obsolètes
echo -e "${BLUE}🗑️  Suppression des fichiers obsolètes...${NC}"
for file in "${FILES_TO_DELETE[@]}"; do
    delete_file "$file"
done

# Renommer les scripts utiles en génériques
echo -e "${BLUE}🔄 Renommage des scripts utiles...${NC}"

# Renommer build-and-push-docker-images.sh s'il existe encore
if [ -f "build-and-push-docker-images.sh" ]; then
    mv build-and-push-docker-images.sh build-and-push-docker-images.sh.old
    echo -e "${GREEN}✅ Renommé: build-and-push-docker-images.sh → .old${NC}"
fi

echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}🎉 Nettoyage terminé !${NC}"
echo -e "${BLUE}📋 Scripts génériques disponibles:${NC}"
echo -e "  • scripts/build-and-test-applications.sh"
echo -e "  • scripts/deployment/build-and-push-docker-images.sh"
echo -e "  • scripts/tests/run-unit-tests.sh"
echo -e "  • scripts/tests/run-integration-tests.sh"
echo -e "  • scripts/utils/version-manager.sh"
