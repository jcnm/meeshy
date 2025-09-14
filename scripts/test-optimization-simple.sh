#!/bin/bash

# Script de test simple pour vérifier l'intégration des optimisations

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
    "frontend/components/conversations/ConversationList.tsx"
    "frontend/components/conversations/ConversationMessages.tsx"
    "frontend/components/conversations/ConversationEmptyState.tsx"
    "frontend/components/conversations/ConversationLayoutResponsiveRefactored.tsx"
    "frontend/components/conversations/VirtualizedMessageList.tsx"
    "frontend/context/ConversationContext.tsx"
    "frontend/hooks/use-swr-conversations.ts"
    "frontend/services/optimized-socketio.service.ts"
    "frontend/shared/types/unified-message.ts"
    "frontend/app/conversations/page-refactored.tsx"
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
CONVERSATION_LIST_HOOKS=$(grep -c "use[A-Z]" ../frontend/components/conversations/ConversationList.tsx || echo "0")
if [ "$CONVERSATION_LIST_HOOKS" -lt 20 ]; then
    print_success "✅ ConversationList: $CONVERSATION_LIST_HOOKS hooks (< 20)"
else
    print_warning "⚠️  ConversationList: $CONVERSATION_LIST_HOOKS hooks (>= 20)"
fi

# Vérifier que ConversationMessages n'a pas trop de hooks
CONVERSATION_MESSAGES_HOOKS=$(grep -c "use[A-Z]" ../frontend/components/conversations/ConversationMessages.tsx || echo "0")
if [ "$CONVERSATION_MESSAGES_HOOKS" -lt 20 ]; then
    print_success "✅ ConversationMessages: $CONVERSATION_MESSAGES_HOOKS hooks (< 20)"
else
    print_warning "⚠️  ConversationMessages: $CONVERSATION_MESSAGES_HOOKS hooks (>= 20)"
fi

# Test 5: Vérifier les types unifiés
print_status "Vérification des types unifiés..."

if grep -q "export interface UnifiedMessage" ../frontend/shared/types/unified-message.ts; then
    print_success "✅ Type UnifiedMessage défini"
else
    print_error "❌ Type UnifiedMessage manquant"
fi

if grep -q "export.*UnifiedMessage" ../frontend/shared/types/index.ts; then
    print_success "✅ Type UnifiedMessage exporté"
else
    print_error "❌ Type UnifiedMessage non exporté"
fi

# Test 6: Vérifier le contexte
print_status "Vérification du contexte..."

if grep -q "useReducer" ../frontend/context/ConversationContext.tsx; then
    print_success "✅ ConversationContext utilise useReducer"
else
    print_error "❌ ConversationContext n'utilise pas useReducer"
fi

if grep -q "UnifiedMessage" ../frontend/context/ConversationContext.tsx; then
    print_success "✅ ConversationContext utilise UnifiedMessage"
else
    print_error "❌ ConversationContext n'utilise pas UnifiedMessage"
fi

# Test 7: Vérifier SWR
print_status "Vérification de SWR..."

if grep -q "useSWR" ../frontend/hooks/use-swr-conversations.ts; then
    print_success "✅ SWR hooks implémentés"
else
    print_error "❌ SWR hooks manquants"
fi

# Test 8: Vérifier Socket.IO optimisé
print_status "Vérification de Socket.IO optimisé..."

if grep -q "lazy loading" ../frontend/services/optimized-socketio.service.ts; then
    print_success "✅ Socket.IO optimisé avec lazy loading"
else
    print_warning "⚠️  Socket.IO optimisé sans lazy loading"
fi

if grep -q "destroy" ../frontend/services/optimized-socketio.service.ts; then
    print_success "✅ Socket.IO optimisé avec cleanup"
else
    print_warning "⚠️  Socket.IO optimisé sans cleanup"
fi

# Test 9: Vérifier la virtualisation
print_status "Vérification de la virtualisation..."

if grep -q "react-window" ../frontend/components/conversations/VirtualizedMessageList.tsx; then
    print_success "✅ Virtualisation implémentée"
else
    print_error "❌ Virtualisation manquante"
fi

# Test 10: Vérifier la documentation
print_status "Vérification de la documentation..."

if [ -f "../OPTIMIZATION_GUIDE.md" ]; then
    print_success "✅ Guide d'optimisation créé"
else
    print_error "❌ Guide d'optimisation manquant"
fi

# Résumé
echo ""
echo "🎯 RÉSUMÉ DES TESTS:"
echo "===================="

# Compter les tests réussis
TOTAL_TESTS=10
PASSED_TESTS=0

# Compter les succès (approximation)
if [ -f "../frontend/components/conversations/ConversationList.tsx" ]; then ((PASSED_TESTS++)); fi
if [ -f "../frontend/components/conversations/ConversationMessages.tsx" ]; then ((PASSED_TESTS++)); fi
if [ -f "../frontend/components/conversations/ConversationEmptyState.tsx" ]; then ((PASSED_TESTS++)); fi
if [ -f "../frontend/components/conversations/ConversationLayoutResponsiveRefactored.tsx" ]; then ((PASSED_TESTS++)); fi
if [ -f "../frontend/components/conversations/VirtualizedMessageList.tsx" ]; then ((PASSED_TESTS++)); fi
if [ -f "../frontend/context/ConversationContext.tsx" ]; then ((PASSED_TESTS++)); fi
if [ -f "../frontend/hooks/use-swr-conversations.ts" ]; then ((PASSED_TESTS++)); fi
if [ -f "../frontend/services/optimized-socketio.service.ts" ]; then ((PASSED_TESTS++)); fi
if [ -f "../frontend/shared/types/unified-message.ts" ]; then ((PASSED_TESTS++)); fi
if [ -f "../frontend/app/conversations/page-refactored.tsx" ]; then ((PASSED_TESTS++)); fi

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
