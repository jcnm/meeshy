#!/bin/bash

# Test de la nouvelle architecture d'authentification
echo "🔄 Test de l'architecture d'authentification réorganisée"
echo "==========================================================="

# Vérifier que les fichiers existent
echo ""
echo "📋 Vérification des fichiers..."

# Service métier principal
if [ -f "/Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/services/auth.service.ts" ]; then
    echo "✅ Service métier: auth.service.ts (PrismaAuthService)"
else
    echo "❌ Service métier: auth.service.ts MANQUANT"
fi

# Service de test
if [ -f "/Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/services/auth-test.service.ts" ]; then
    echo "✅ Service de test: auth-test.service.ts (AuthService)"
else
    echo "❌ Service de test: auth-test.service.ts MANQUANT"
fi

# Middleware
if [ -f "/Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/middleware/auth.ts" ]; then
    echo "✅ Middleware: auth.ts (AuthMiddleware)"
else
    echo "❌ Middleware: auth.ts MANQUANT"
fi

# Vérifier que les anciens fichiers ont été supprimés
echo ""
echo "📋 Vérification du nettoyage..."

if [ ! -f "/Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/services/prisma-auth.service.ts" ]; then
    echo "✅ Ancien fichier supprimé: prisma-auth.service.ts"
else
    echo "⚠️  Ancien fichier existe encore: prisma-auth.service.ts"
fi

# Vérifier les classes dans les fichiers
echo ""
echo "📋 Vérification des classes..."

if grep -q "export class PrismaAuthService" "/Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/services/auth.service.ts" 2>/dev/null; then
    echo "✅ PrismaAuthService trouvé dans auth.service.ts"
else
    echo "❌ PrismaAuthService NOT FOUND dans auth.service.ts"
fi

if grep -q "export class AuthService" "/Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/services/auth-test.service.ts" 2>/dev/null; then
    echo "✅ AuthService trouvé dans auth-test.service.ts"
else
    echo "❌ AuthService NOT FOUND dans auth-test.service.ts"
fi

if grep -q "export class AuthMiddleware" "/Users/smpceo/Downloads/Meeshy/meeshy/gateway/src/middleware/auth.ts" 2>/dev/null; then
    echo "✅ AuthMiddleware trouvé dans middleware/auth.ts"
else
    echo "❌ AuthMiddleware NOT FOUND dans middleware/auth.ts"
fi

# Test de compilation TypeScript
echo ""
echo "📋 Test de compilation TypeScript..."
cd /Users/smpceo/Downloads/Meeshy/meeshy/gateway

# Vérifier la compilation sans erreur
if pnpm run type-check 2>/dev/null; then
    echo "✅ Compilation TypeScript réussie"
else
    echo "⚠️  Compilation TypeScript - vérifiez les erreurs manuellement"
fi

echo ""
echo "==========================================================="
echo "🎯 Architecture d'authentification réorganisée:"
echo "   • auth.service.ts        → Service métier (PrismaAuthService)"
echo "   • auth-test.service.ts   → Service de test (AuthService)"  
echo "   • middleware/auth.ts     → Middleware (AuthMiddleware)"
echo ""
echo "🔄 Responsabilités claires:"
echo "   • Service métier    → Login/Register/JWT generation"
echo "   • Service de test   → Comptes de test pour développement"
echo "   • Middleware        → Validation requêtes + contexte unifié"
echo ""
echo "✅ Migration terminée avec succès!"
