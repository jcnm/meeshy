#!/bin/bash

# Script de suppression sécurisée du code non utilisé
# Date: 2025-01-XX
# Contexte: Nettoyage après audit complet du codebase

set -e  # Exit on error

echo "🔍 Vérification de la sécurité avant suppression..."
echo ""

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction de vérification
check_file_unused() {
    local file=$1
    local search_pattern=$2
    
    echo -n "Vérification: $file ... "
    
    # Chercher les imports (exclure les scripts d'analyse et docs)
    local matches=$(grep -r "$search_pattern" frontend/ \
        --exclude-dir=node_modules \
        --exclude="*.md" \
        --exclude="analyze-*.ts" \
        --exclude="*-cleanup.sh" \
        --exclude="remove-unused-*.sh" \
        2>/dev/null || true)
    
    if [ -z "$matches" ]; then
        echo -e "${GREEN}✓ Non utilisé${NC}"
        return 0
    else
        echo -e "${RED}✗ Encore utilisé!${NC}"
        echo "$matches"
        return 1
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 1: Vérification des fichiers à supprimer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SAFE_TO_DELETE=true

# Vérifier use-anonymous-messages
if ! check_file_unused \
    "frontend/hooks/use-anonymous-messages.ts" \
    "use-anonymous-messages"; then
    SAFE_TO_DELETE=false
fi

# Vérifier use-translation-performance
if ! check_file_unused \
    "frontend/hooks/use-translation-performance.ts" \
    "use-translation-performance"; then
    SAFE_TO_DELETE=false
fi

# Vérifier advanced-translation.service
if ! check_file_unused \
    "frontend/services/advanced-translation.service.ts" \
    "advanced-translation.service"; then
    SAFE_TO_DELETE=false
fi

# Vérifier meeshy-socketio-compat (celui-ci est un alias, doit être vérifié manuellement)
echo -n "Vérification: frontend/services/meeshy-socketio-compat.ts ... "
local compat_matches=$(grep -r "meeshy-socketio-compat" frontend/ \
    --exclude-dir=node_modules \
    --exclude="*.md" \
    --exclude="remove-unused-*.sh" \
    2>/dev/null || true)

if [ -z "$compat_matches" ]; then
    echo -e "${GREEN}✓ Alias non utilisé${NC}"
    DELETE_COMPAT=true
else
    echo -e "${YELLOW}⚠ Alias potentiellement utilisé (vérification manuelle nécessaire)${NC}"
    echo "$compat_matches"
    DELETE_COMPAT=false
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$SAFE_TO_DELETE" = false ]; then
    echo -e "${RED}❌ ARRÊT: Certains fichiers sont encore utilisés!${NC}"
    echo "Veuillez vérifier manuellement avant de continuer."
    exit 1
fi

echo -e "${GREEN}✓ Tous les fichiers sont confirmés non utilisés${NC}"
echo ""

# Demander confirmation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 2: Confirmation de suppression"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Fichiers à supprimer:"
echo "  1. frontend/hooks/use-anonymous-messages.ts"
echo "  2. frontend/hooks/use-translation-performance.ts"
echo "  3. frontend/services/advanced-translation.service.ts"

if [ "$DELETE_COMPAT" = true ]; then
    echo "  4. frontend/services/meeshy-socketio-compat.ts"
fi

echo ""
read -p "Confirmer la suppression? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Suppression annulée"
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 3: Suppression des fichiers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Fonction de suppression sécurisée
safe_delete() {
    local file=$1
    if [ -f "$file" ]; then
        echo "Suppression: $file"
        rm "$file"
        echo -e "${GREEN}✓ Supprimé${NC}"
    else
        echo -e "${YELLOW}⚠ Fichier déjà supprimé: $file${NC}"
    fi
}

# Supprimer les hooks
safe_delete "frontend/hooks/use-anonymous-messages.ts"
safe_delete "frontend/hooks/use-translation-performance.ts"

# Supprimer le service
safe_delete "frontend/services/advanced-translation.service.ts"

# Supprimer l'alias si confirmé
if [ "$DELETE_COMPAT" = true ]; then
    safe_delete "frontend/services/meeshy-socketio-compat.ts"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 4: Nettoyage des index.ts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Backup des fichiers index
cp frontend/hooks/index.ts frontend/hooks/index.ts.backup
cp frontend/services/index.ts frontend/services/index.ts.backup

echo "Nettoyage de frontend/hooks/index.ts ..."
# Supprimer les lignes d'export des hooks supprimés
sed -i.tmp '/use-anonymous-messages/d' frontend/hooks/index.ts
sed -i.tmp '/use-translation-performance/d' frontend/hooks/index.ts
rm frontend/hooks/index.ts.tmp
echo -e "${GREEN}✓ Nettoyé${NC}"

echo "Nettoyage de frontend/services/index.ts ..."
# Supprimer les lignes d'export du service supprimé
sed -i.tmp '/advanced-translation.service/d' frontend/services/index.ts
if [ "$DELETE_COMPAT" = true ]; then
    sed -i.tmp '/meeshy-socketio-compat/d' frontend/services/index.ts
fi
rm frontend/services/index.ts.tmp
echo -e "${GREEN}✓ Nettoyé${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 5: Vérification finale"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Compter les fichiers supprimés
FILES_DELETED=3
if [ "$DELETE_COMPAT" = true ]; then
    FILES_DELETED=4
fi

echo "Statistiques:"
echo "  • Fichiers supprimés: $FILES_DELETED"
echo "  • Index nettoyés: 2"
echo "  • Backups créés: 2"
echo ""

# Vérifier le build TypeScript
echo "Vérification TypeScript ..."
cd frontend
if pnpm tsc --noEmit 2>/dev/null; then
    echo -e "${GREEN}✓ TypeScript OK${NC}"
else
    echo -e "${RED}⚠ Erreurs TypeScript détectées${NC}"
    echo "Veuillez vérifier manuellement"
fi
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Nettoyage terminé avec succès!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Prochaines étapes:"
echo "  1. Exécuter les tests: cd frontend && pnpm test"
echo "  2. Tester l'application: cd frontend && pnpm dev"
echo "  3. Committer les changements:"
echo "     git add ."
echo "     git commit -m 'Remove unused hooks and services'"
echo ""
echo "En cas de problème:"
echo "  • Restaurer hooks: mv frontend/hooks/index.ts.backup frontend/hooks/index.ts"
echo "  • Restaurer services: mv frontend/services/index.ts.backup frontend/services/index.ts"
echo "  • Ou annuler avec: git checkout ."
echo ""
