#!/bin/bash

# Script de test pour vérifier l'intégration des optimisations

set -e

echo "🧪 Test d'intégration des optimisations Meeshy..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Test 1: Vérifier que tous les nouveaux fichiers existent
print_status "Vérification des nouveaux fichiers..."

NEW_FILES=(
    "./components/conversations/ConversationList.tsx"
    "./components/conversations/ConversationMessages.tsx"
    "./components/conversations/ConversationEmptyState.tsx"
    "./components/conversations/ConversationLayoutResponsiveRefactored.tsx"
    "./components/conversations/VirtualizedMessageList.tsx"
    "./context/ConversationContext.tsx"
    "./hooks/use-swr-conversations.ts"
    "./services/optimized-socketio.service.ts"
    "./shared/types/unified-message.ts"
    "./app/conversations/page-refactored.tsx"
)

for file in "${NEW_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "✅ $file existe"
    else
        print_error "❌ $file manquant"
    fi
done

# Test 2: Vérifier les imports TypeScript
print_status "Vérification des imports TypeScript..."

# Changer vers le répertoire frontend pour les tests
cd frontend

# Test de compilation TypeScript
if pnpm run build > /dev/null 2>&1; then
    print_success "✅ Compilation TypeScript réussie"
else
    print_error "❌ Erreurs de compilation TypeScript"
    echo "Détails des erreurs:"
    pnpm run build 2>&1 | grep -E "(error|Error)" || true
fi

# Test 3: Vérifier les dépendances
print_status "Vérification des dépendances..."

REQUIRED_DEPS=("swr" "react-window" "react-window-infinite-loader")

for dep in "${REQUIRED_DEPS[@]}"; do
    if pnpm list "$dep" > /dev/null 2>&1; then
        print_success "✅ $dep installé"
    else
        print_warning "⚠️  $dep non installé"
        echo "Installation de $dep..."
        pnpm add "$dep"
    fi
done

# Test 4: Vérifier la structure des composants
print_status "Vérification de la structure des composants..."

# Vérifier que ConversationList n'a pas trop de hooks
CONVERSATION_LIST_HOOKS=$(grep -c "use[A-Z]" ./components/conversations/ConversationList.tsx || echo "0")
if [ "$CONVERSATION_LIST_HOOKS" -lt 20 ]; then
    print_success "✅ ConversationList: $CONVERSATION_LIST_HOOKS hooks (< 20)"
else
    print_warning "⚠️  ConversationList: $CONVERSATION_LIST_HOOKS hooks (>= 20)"
fi

# Vérifier que ConversationMessages n'a pas trop de hooks
CONVERSATION_MESSAGES_HOOKS=$(grep -c "use[A-Z]" ./components/conversations/ConversationMessages.tsx || echo "0")
if [ "$CONVERSATION_MESSAGES_HOOKS" -lt 20 ]; then
    print_success "✅ ConversationMessages: $CONVERSATION_MESSAGES_HOOKS hooks (< 20)"
else
    print_warning "⚠️  ConversationMessages: $CONVERSATION_MESSAGES_HOOKS hooks (>= 20)"
fi

# Test 5: Vérifier les types unifiés
print_status "Vérification des types unifiés..."

if grep -q "export interface UnifiedMessage" ./shared/types/unified-message.ts; then
    print_success "✅ Type UnifiedMessage défini"
else
    print_error "❌ Type UnifiedMessage manquant"
fi

if grep -q "export.*UnifiedMessage" ./shared/types/index.ts; then
    print_success "✅ Type UnifiedMessage exporté"
else
    print_error "❌ Type UnifiedMessage non exporté"
fi

# Test 6: Vérifier le contexte
print_status "Vérification du contexte..."

if grep -q "useReducer" ./context/ConversationContext.tsx; then
    print_success "✅ ConversationContext utilise useReducer"
else
    print_error "❌ ConversationContext n'utilise pas useReducer"
fi

if grep -q "UnifiedMessage" ./context/ConversationContext.tsx; then
    print_success "✅ ConversationContext utilise UnifiedMessage"
else
    print_error "❌ ConversationContext n'utilise pas UnifiedMessage"
fi

# Test 7: Vérifier SWR
print_status "Vérification de SWR..."

if grep -q "useSWR" ./hooks/use-swr-conversations.ts; then
    print_success "✅ SWR hooks implémentés"
else
    print_error "❌ SWR hooks manquants"
fi

# Test 8: Vérifier Socket.IO optimisé
print_status "Vérification de Socket.IO optimisé..."

if grep -q "lazy loading" ./services/optimized-socketio.service.ts; then
    print_success "✅ Socket.IO optimisé avec lazy loading"
else
    print_warning "⚠️  Socket.IO optimisé sans lazy loading"
fi

if grep -q "destroy" ./services/optimized-socketio.service.ts; then
    print_success "✅ Socket.IO optimisé avec cleanup"
else
    print_warning "⚠️  Socket.IO optimisé sans cleanup"
fi

# Test 9: Vérifier la virtualisation
print_status "Vérification de la virtualisation..."

if grep -q "react-window" ./components/conversations/VirtualizedMessageList.tsx; then
    print_success "✅ Virtualisation implémentée"
else
    print_error "❌ Virtualisation manquante"
fi

# Test 10: Vérifier la documentation
print_status "Vérification de la documentation..."

if [ -f "OPTIMIZATION_GUIDE.md" ]; then
    print_success "✅ Guide d'optimisation créé"
else
    print_error "❌ Guide d'optimisation manquant"
fi

# Résumé
echo ""
echo "🎯 RÉSUMÉ DES TESTS:"
echo "===================="

TOTAL_TESTS=10
PASSED_TESTS=0

# Compter les tests réussis (approximation basée sur les messages de succès)
PASSED_TESTS=$(grep -c "✅" <<< "$(cat)" || echo "0")

echo "Tests réussis: $PASSED_TESTS/$TOTAL_TESTS"

if [ "$PASSED_TESTS" -ge 8 ]; then
    print_success "🎉 Optimisations correctement intégrées!"
    echo ""
    echo "Prochaines étapes:"
    echo "1. Tester l'interface utilisateur"
    echo "2. Vérifier les performances"
    echo "3. Déployer en production"
else
    print_warning "⚠️  Certaines optimisations nécessitent des corrections"
    echo ""
    echo "Actions recommandées:"
    echo "1. Corriger les erreurs identifiées"
    echo "2. Relancer les tests"
    echo "3. Vérifier l'intégration"
fi

echo ""
echo "📚 Documentation: OPTIMIZATION_GUIDE.md"
echo "🔧 Script de migration: scripts/optimization-migration.sh"
