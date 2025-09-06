#!/bin/bash

# Script de migration des types utilisateur
# Remplace les imports de User par SocketIOUser pour réduire la redondance

echo "🔄 Migration des types utilisateur - User vers SocketIOUser"
echo "=========================================================="

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages colorés
log_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    log_error "Ce script doit être exécuté depuis la racine du projet Meeshy"
    exit 1
fi

log_info "Recherche des fichiers utilisant l'ancien type User..."

# Trouver tous les fichiers qui importent User depuis user.ts
FILES_TO_MIGRATE=$(grep -r "import.*User.*from.*user" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".git" | cut -d: -f1 | sort -u)

if [ -z "$FILES_TO_MIGRATE" ]; then
    log_info "Aucun fichier trouvé utilisant l'ancien type User"
    exit 0
fi

echo "Fichiers à migrer :"
echo "$FILES_TO_MIGRATE"
echo ""

# Demander confirmation
read -p "Voulez-vous procéder à la migration ? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warn "Migration annulée"
    exit 0
fi

# Compteur de fichiers migrés
MIGRATED_COUNT=0

# Migrer chaque fichier
for file in $FILES_TO_MIGRATE; do
    log_info "Migration de $file..."
    
    # Créer une sauvegarde
    cp "$file" "$file.backup"
    
    # Remplacer les imports
    sed -i.tmp 's/import.*User.*from.*user/import { SocketIOUser as User } from ".\/shared\/types\/socketio-events"/g' "$file"
    sed -i.tmp 's/import.*User.*from.*user/import { SocketIOUser as User } from "..\/shared\/types\/socketio-events"/g' "$file"
    sed -i.tmp 's/import.*User.*from.*user/import { SocketIOUser as User } from "..\/..\/shared\/types\/socketio-events"/g' "$file"
    
    # Nettoyer les fichiers temporaires
    rm -f "$file.tmp"
    
    # Vérifier si la migration a réussi
    if grep -q "SocketIOUser as User" "$file"; then
        log_info "✅ $file migré avec succès"
        ((MIGRATED_COUNT++))
    else
        log_warn "⚠️  $file - Migration partielle ou échec"
        # Restaurer la sauvegarde
        mv "$file.backup" "$file"
    fi
done

echo ""
log_info "Migration terminée !"
log_info "Fichiers migrés : $MIGRATED_COUNT"
log_info "Fichiers traités : $(echo "$FILES_TO_MIGRATE" | wc -l)"

# Afficher les prochaines étapes
echo ""
log_info "Prochaines étapes :"
echo "1. Vérifier que les tests passent"
echo "2. Tester l'application"
echo "3. Supprimer les fichiers .backup une fois validé"
echo "4. Mettre à jour la documentation"

# Afficher les fichiers de sauvegarde créés
echo ""
log_warn "Fichiers de sauvegarde créés :"
find . -name "*.backup" -type f | head -10
if [ $(find . -name "*.backup" -type f | wc -l) -gt 10 ]; then
    echo "... et $(($(find . -name "*.backup" -type f | wc -l) - 10)) autres"
fi

echo ""
log_info "Pour supprimer les sauvegardes : find . -name '*.backup' -delete"
