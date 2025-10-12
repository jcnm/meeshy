#!/bin/bash

# Script pour corriger les traductions en doublon
# Ce script applique toutes les corrections nécessaires

set -e  # Arrêter en cas d'erreur

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "🔧 Correction des traductions en doublon"
echo "=========================================="
echo ""

# Couleurs pour les logs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonction pour afficher les logs
log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Vérifier si on est dans le bon répertoire
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    log_error "Ce script doit être exécuté depuis le répertoire racine du projet"
    exit 1
fi

# Étape 1: Vérifier que Node.js est installé
echo "📋 Étape 1: Vérification des prérequis"
if ! command -v node &> /dev/null; then
    log_error "Node.js n'est pas installé"
    exit 1
fi
log_info "Node.js version: $(node --version)"
echo ""

# Étape 2: Nettoyer les doublons existants (mode dry-run d'abord)
echo "📋 Étape 2: Test de nettoyage des doublons (dry-run)"
log_warning "Exécution en mode dry-run (aucune modification)"
cd "$PROJECT_ROOT"
node scripts/cleanup-duplicate-translations.js --dry-run

echo ""
read -p "Voulez-vous continuer et supprimer réellement les doublons? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warning "Opération annulée par l'utilisateur"
    exit 0
fi

# Étape 3: Nettoyer les doublons existants (réel)
echo ""
echo "📋 Étape 3: Nettoyage des doublons"
node scripts/cleanup-duplicate-translations.js
log_info "Nettoyage terminé"
echo ""

# Étape 4: Générer les clients Prisma
echo "📋 Étape 4: Génération des clients Prisma"
cd "$PROJECT_ROOT/gateway"
log_info "Génération du client Prisma..."
npx prisma generate
log_info "Client Prisma généré"
echo ""

# Étape 5: Instructions pour créer l'index MongoDB
echo "📋 Étape 5: Création de l'index unique MongoDB"
echo ""
log_warning "IMPORTANT: Vous devez créer manuellement l'index unique dans MongoDB"
echo ""
echo "Exécutez les commandes suivantes dans mongosh:"
echo ""
echo "----------------------------------------"
echo "use meeshy"
echo ""
echo "db.MessageTranslation.createIndex("
echo "  { messageId: 1, targetLanguage: 1 },"
echo "  { unique: true, name: \"message_target_language_unique\" }"
echo ")"
echo ""
echo "db.MessageTranslation.getIndexes()"
echo "----------------------------------------"
echo ""

read -p "Appuyez sur Entrée une fois l'index créé dans MongoDB..." -r
echo ""

# Étape 6: Vérifier l'index
echo "📋 Étape 6: Vérification de l'index MongoDB"
log_info "Vérification de l'index..."
echo ""
echo "Exécutez cette commande pour vérifier:"
echo "mongosh --eval 'use meeshy; db.MessageTranslation.getIndexes()'"
echo ""

# Étape 7: Redémarrer les services
echo "📋 Étape 7: Redémarrage des services"
read -p "Voulez-vous redémarrer les services? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$PROJECT_ROOT"
    if [ -f "docker-compose.yml" ]; then
        log_info "Redémarrage via docker-compose..."
        docker-compose restart gateway
    else
        log_warning "docker-compose.yml non trouvé, redémarrage manuel nécessaire"
    fi
fi

echo ""
echo "=========================================="
echo "✅ Corrections appliquées avec succès!"
echo "=========================================="
echo ""
echo "📝 Prochaines étapes:"
echo "  1. Vérifier les logs du gateway"
echo "  2. Tester l'envoi de messages"
echo "  3. Vérifier qu'il n'y a plus de doublons"
echo ""
echo "📄 Consultez TRADUCTIONS_DOUBLONS_FIX.md pour plus de détails"
echo ""

